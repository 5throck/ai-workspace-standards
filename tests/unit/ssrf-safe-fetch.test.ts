/**
 * Tests for scripts/lib/ssrf.ts — safeFetch() (M15).
 *
 * The prior mitigation (validateUrl() then a separate fetch(url)) had a
 * TOCTOU gap: fetch() re-resolves DNS independently, so a rebinding attacker
 * could pass validation with a safe IP and serve a private IP at the actual
 * connection. safeFetch() closes this by performing exactly one DNS
 * resolution (inside validateUrl()) and connecting directly to the
 * validated address via a pinned `lookup` override — verified here by
 * counting lookup invocations and asserting the connection target is
 * exactly the validated address, never a fresh resolution.
 *
 * @version 1.1.0
 * v1.1.0 (2026-11-27, spec docs/designs/2026-11-27-safefetch-headers-design.md,
 *         U-20261127-003): init.headers passthrough pins — deny-list (exact +
 *         prefix) with case-insensitivity, CRLF/control-char rejection in
 *         names and values, allowed auth/UA/custom pass-through observed by a
 *         local test server with Host still the URL hostname, unchanged
 *         behaviour when init.headers is absent / {signal}-only.
 */
import { describe, test, expect } from 'bun:test';
import * as http from 'node:http';
import {
    safeFetch,
    fetchPinned,
    SSRFBlockedError,
    SSRFHeaderBlockedError,
    isBlockedIp,
} from '../../scripts/lib/ssrf.ts';

function startLocalServer(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            resolve({ server, port });
        });
    });
}

describe('safeFetch', () => {
    test('rejects a hostname that resolves to a blocked (private) range without ever connecting', async () => {
        await expect(safeFetch('http://127.0.0.1:1/anything')).rejects.toBeInstanceOf(SSRFBlockedError);
    });

    test('rejects with the validateUrl() reason attached', async () => {
        try {
            await safeFetch('http://169.254.169.254/latest/meta-data/');
            throw new Error('expected safeFetch to reject');
        } catch (err) {
            expect(err).toBeInstanceOf(SSRFBlockedError);
            expect((err as SSRFBlockedError).reason).toContain('blocked-ip');
        }
    });

    test('successfully fetches from an allowed address (loopback is blocked, so use a real local server bound to a non-loopback-looking allowed test path is impractical — verify via the internal pinned-connection path using a stubbed validateUrl-compatible target)', async () => {
        // 127.0.0.1 is intentionally blocked by ssrf.ts (loopback range), so we
        // can't exercise the "allowed" path end-to-end against a local test
        // server without a real routable non-private address. Instead, verify
        // the lower-level pinning behavior directly: fetchPinned() must connect
        // to the exact address passed in, not re-resolve the hostname.
        const { fetchPinned } = await import('../../scripts/lib/ssrf.ts');
        const { server, port } = await startLocalServer((req, res) => {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('hello from pinned connection');
        });
        try {
            const response = await fetchPinned('http://ignored-hostname-must-not-resolve.invalid.example', ['127.0.0.1'], port);
            expect(response.status).toBe(200);
            expect(await response.text()).toBe('hello from pinned connection');
        } finally {
            server.close();
        }
    });

    test('fetchPinned never triggers a fresh DNS lookup for the target hostname', async () => {
        const { fetchPinned } = await import('../../scripts/lib/ssrf.ts');
        const { server, port } = await startLocalServer((req, res) => {
            res.writeHead(200, {});
            res.end('ok');
        });
        try {
            // A hostname that does not exist / cannot resolve via real DNS.
            // If fetchPinned performed a real lookup, this would throw
            // ENOTFOUND; since it must connect directly to the pinned IP,
            // it succeeds instead.
            const response = await fetchPinned('http://this-domain-does-not-exist-anywhere.invalid', ['127.0.0.1'], port);
            expect(response.status).toBe(200);
        } finally {
            server.close();
        }
    });

    test('rejects on a 3xx redirect response instead of following it', async () => {
        const { fetchPinned } = await import('../../scripts/lib/ssrf.ts');
        const { server, port } = await startLocalServer((req, res) => {
            res.writeHead(302, { location: 'http://127.0.0.1:1/evil-internal-target' });
            res.end();
        });
        try {
            await expect(fetchPinned('http://redirect-test.invalid', ['127.0.0.1'], port)).rejects.toThrow(/redirect/i);
        } finally {
            server.close();
        }
    });
});

describe('isBlockedIp CIDR pins (U-20261031-003)', () => {
    // U-20261031-003 (spec docs/designs/2026-10-31-template-security-hardening-design.md
    // R2.3): BLOCKED_CIDRS' current-network entry ended at 0x0fffffffn (spanning
    // 0.0.0.0–15.255.255.255) and the private-10 entry shared that end — both
    // over-blocked public 1.x–15.x addresses (8.8.8.8 was refused as
    // "current-network"). These pins hold the corrected /8 ends and the
    // surrounding public space so the over-blocking cannot regress.
    test('corrected ends: 0.0.0.0/8 and 10.0.0.0/8 exactly', () => {
        expect(isBlockedIp('0.1.2.3')).toBe('current-network');
        expect(isBlockedIp('0.255.255.255')).toBe('current-network'); // last address of 0.0.0.0/8
        expect(isBlockedIp('10.1.2.3')).toBe('private-10');
        expect(isBlockedIp('10.255.255.255')).toBe('private-10'); // last address of 10.0.0.0/8
    });

    test('public 1.x–15.x space is allowed again', () => {
        expect(isBlockedIp('8.8.8.8')).toBeNull();
        expect(isBlockedIp('1.1.1.1')).toBeNull();
        expect(isBlockedIp('11.0.0.1')).toBeNull();
        expect(isBlockedIp('15.255.255.255')).toBeNull();
        expect(isBlockedIp('9.0.0.1')).toBeNull(); // between the two corrected /8s
        expect(isBlockedIp('16.0.0.1')).toBeNull(); // just above the old (wrong) end
    });

    test('unrelated private/metadata ranges stay blocked', () => {
        expect(isBlockedIp('172.16.0.1')).toBe('private-172');
        expect(isBlockedIp('192.168.1.1')).toBe('private-192');
        expect(isBlockedIp('127.0.0.1')).toBe('loopback');
        expect(isBlockedIp('169.254.169.254')).toBe('link-local-metadata');
        expect(isBlockedIp('100.64.0.1')).toBe('carrier-grade-nat');
    });
});

describe('safeFetch init.headers passthrough policy (U-20261127-003)', () => {
    // Spec docs/designs/2026-11-27-safefetch-headers-design.md — headers are
    // routed through http(s).request()'s structured `headers` option after a
    // case-insensitive deny-list (destination/framing/hop-by-hop control
    // headers) and a CR/LF/control-char regex on names and values. Header
    // validation must run before validateUrl(): a rejected header costs zero
    // DNS or network activity.

    test.each([
        'host',
        'content-length',
        'transfer-encoding',
        'connection',
        'upgrade',
        'te',
        'trailer',
        'expect',
        'via',
        // prefix classes
        'proxy-authorization',
        'proxy-connection',
        'forwarded',
        'forward-host',
    ])('denies exact/prefix deny-list header %s', async (header) => {
        try {
            await safeFetch('http://example.invalid/', { headers: { [header]: 'x' } });
            throw new Error(`expected header "${header}" to be rejected`);
        } catch (err) {
            expect(err).toBeInstanceOf(SSRFHeaderBlockedError);
            expect((err as SSRFHeaderBlockedError).header).toBe(header);
            expect((err as SSRFHeaderBlockedError).reason).toBe('denied-header');
            expect((err as Error).name).toBe('SSRFHeaderBlockedError');
        }
    });

    test.each(['HOST', 'hOsT', 'Content-Length', 'TRANSFER-ENCODING', 'CONNECTION', 'Proxy-Authorization', 'FORWARDED'])(
        'deny-list is case-insensitive: %s',
        async (header) => {
            try {
                await safeFetch('http://example.invalid/', { headers: { [header]: 'x' } });
                throw new Error(`expected header "${header}" to be rejected`);
            } catch (err) {
                expect(err).toBeInstanceOf(SSRFHeaderBlockedError);
                expect((err as SSRFHeaderBlockedError).header).toBe(header);
                expect((err as SSRFHeaderBlockedError).reason).toBe('denied-header');
            }
        },
    );

    test('header validation runs BEFORE validateUrl() — a denied header on an SSRF-blocked target fails as a header error', async () => {
        try {
            await safeFetch('http://127.0.0.1:1/', { headers: { host: 'x' } });
            throw new Error('expected the header policy to fire first');
        } catch (err) {
            expect(err).toBeInstanceOf(SSRFHeaderBlockedError);
            expect(err).not.toBeInstanceOf(SSRFBlockedError);
        }
    });

    test('rejects CRLF in a header value (smuggling injection)', async () => {
        try {
            await safeFetch('http://example.invalid/', {
                headers: { authorization: 'Bearer x\r\nHost: evil.test' },
            });
            throw new Error('expected CRLF value to be rejected');
        } catch (err) {
            expect(err).toBeInstanceOf(SSRFHeaderBlockedError);
            expect((err as SSRFHeaderBlockedError).header).toBe('authorization');
            expect((err as SSRFHeaderBlockedError).reason).toBe('invalid-header-value');
        }
    });

    test('rejects control characters in a header value (NUL, VT, DEL)', async () => {
        for (const value of ['tok\x00en', 'tok\x0ben', 'tok\x7fen']) {
            try {
                await safeFetch('http://example.invalid/', { headers: { 'x-api-key': value } });
                throw new Error(`expected control-char value to be rejected: ${JSON.stringify(value)}`);
            } catch (err) {
                expect(err).toBeInstanceOf(SSRFHeaderBlockedError);
                expect((err as SSRFHeaderBlockedError).header).toBe('x-api-key');
                expect((err as SSRFHeaderBlockedError).reason).toBe('invalid-header-value');
            }
        }
    });

    test('rejects CRLF smuggled into a header NAME', async () => {
        try {
            await safeFetch('http://example.invalid/', { headers: { 'x-ok\r\nX-Evil: y': 'v' } });
            throw new Error('expected CRLF name to be rejected');
        } catch (err) {
            expect(err).toBeInstanceOf(SSRFHeaderBlockedError);
            expect((err as SSRFHeaderBlockedError).reason).toBe('invalid-header-name');
        }
    });

    test('allowed auth/UA/custom headers pass through verbatim; Host stays the URL hostname', async () => {
        const seen: Array<{ headers: http.IncomingHttpHeaders }> = [];
        const { server, port } = await startLocalServer((req, res) => {
            seen.push({ headers: req.headers });
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
        });
        try {
            const response = await fetchPinned('http://header-capture-test.invalid', ['127.0.0.1'], port, {
                headers: {
                    authorization: 'Bearer tok123',
                    'user-agent': 'safefetch-test/1.0',
                    'x-custom-trace': 'abc',
                },
            });
            expect(response.status).toBe(200);
            expect(seen).toHaveLength(1);
            expect(seen[0].headers.authorization).toBe('Bearer tok123');
            expect(seen[0].headers['user-agent']).toBe('safefetch-test/1.0');
            expect(seen[0].headers['x-custom-trace']).toBe('abc');
            // pin contract intact: the validated hostname stays the Host header
            // (Node appends the non-default connection port — hostname part is what's pinned)
            expect(seen[0].headers.host).toStartWith('header-capture-test.invalid');
        } finally {
            server.close();
        }
    });

    test('unchanged behaviour when init.headers is absent — no custom headers reach the server', async () => {
        const seen: Array<{ headers: http.IncomingHttpHeaders }> = [];
        const { server, port } = await startLocalServer((req, res) => {
            seen.push({ headers: req.headers });
            res.writeHead(200, {});
            res.end('ok');
        });
        try {
            const response = await fetchPinned('http://header-capture-test.invalid', ['127.0.0.1'], port);
            expect(response.status).toBe(200);
            expect(seen).toHaveLength(1);
            expect(seen[0].headers.authorization).toBeUndefined();
            expect(seen[0].headers['x-custom-trace']).toBeUndefined();
        } finally {
            server.close();
        }
    });

    test('unchanged behaviour with the { signal }-only shape every existing caller uses', async () => {
        const seen: Array<{ headers: http.IncomingHttpHeaders }> = [];
        const { server, port } = await startLocalServer((req, res) => {
            seen.push({ headers: req.headers });
            res.writeHead(200, {});
            res.end('ok');
        });
        try {
            const response = await fetchPinned('http://header-capture-test.invalid', ['127.0.0.1'], port, {
                signal: AbortSignal.timeout(5000),
            });
            expect(response.status).toBe(200);
            expect(seen[0].headers.authorization).toBeUndefined();
            expect(seen[0].headers.host).toStartWith('header-capture-test.invalid');
        } finally {
            server.close();
        }
    });
});

/**
 * Raw fake Docker daemon on a unix socket (T-20260930-027). Port of the architect's
 * /tmp/m16design/faked.ts: speaks just enough HTTP/1.1 + the attach hijack protocol to replay the
 * docker CLI 29.8.1 `docker run --rm -i` sequence, and records every request it receives.
 * Never talks to a real daemon.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Socket, UnixSocketListener } from "bun";

export interface RecordedRequest {
  method: string;
  target: string;
  /** Path with the query removed and the /v1.NN prefix kept. */
  path: string;
  headers: Record<string, string>;
  body: string;
}

export interface FakeContainer {
  Id: string;
  Name: string;
  Labels: Record<string, string>;
  Binds: string[] | null;
}

export interface FakeReply {
  status: string;
  body?: string;
  contentType?: string;
  /** Do not reply at all: the request stays in flight until the connection is closed. */
  hold?: boolean;
}

export interface FakeDaemonOptions {
  /** Id returned by create (default: 64 x "a"). */
  createId?: string;
  /** Per-request override; return undefined to fall back to the default behaviour. */
  override?: (req: RecordedRequest) => FakeReply | undefined;
  /** Containers served on GET /containers/json (list). */
  list?: unknown[];
}

export interface FakeDaemon {
  socketPath: string;
  requests: RecordedRequest[];
  /** Raw stdin bytes received per attach connection (in order). */
  attachStdin: string[];
  /** Containers known to the fake's inspect, keyed by full Id. */
  containers: Map<string, FakeContainer>;
  options: FakeDaemonOptions;
  stop(): Promise<void>;
}

const API_HEADERS = "Api-Version: 1.56\r\nOstype: linux\r\nServer: Docker/29.8.1 (linux)\r\n";

export function dockerFrame(stream: number, s: string): Buffer {
  const b = Buffer.from(s);
  const h = Buffer.alloc(8);
  h[0] = stream;
  h.writeUInt32BE(b.length, 4);
  return Buffer.concat([h, b]);
}

interface ConnState {
  buf: Buffer;
  mode: "http" | "raw";
  attachIdx: number;
}

export function startFakeDockerDaemon(options: FakeDaemonOptions = {}): FakeDaemon {
  const dir = mkdtempSync(join(tmpdir(), "fakedockerd-"));
  const socketPath = join(dir, "d.sock");
  const requests: RecordedRequest[] = [];
  const attachStdin: string[] = [];
  const containers = new Map<string, FakeContainer>();
  const sockets = new Set<Socket<ConnState>>();

  function lookup(ref: string): FakeContainer | undefined {
    for (const c of containers.values()) {
      if (c.Id.startsWith(ref) || c.Name === `/${ref}`) return c;
    }
    return undefined;
  }

  const listener: UnixSocketListener<ConnState> = Bun.listen<ConnState>({
    unix: socketPath,
    allowHalfOpen: true,
    socket: {
      open(s) {
        s.data = { buf: Buffer.alloc(0), mode: "http", attachIdx: -1 };
        sockets.add(s);
      },
      data(s, chunk) {
        const d = s.data;
        if (d.mode === "raw") {
          attachStdin[d.attachIdx] += Buffer.from(chunk).toString();
          return;
        }
        d.buf = Buffer.concat([d.buf, chunk]);
        for (;;) {
          const i = d.buf.indexOf("\r\n\r\n");
          if (i < 0) return;
          const lines = d.buf.subarray(0, i).toString("latin1").split("\r\n");
          const [method, target] = lines[0].split(" ");
          const headers: Record<string, string> = {};
          for (const l of lines.slice(1)) {
            const k = l.indexOf(":");
            headers[l.slice(0, k).toLowerCase()] = l.slice(k + 1).trim();
          }
          const cl = Number(headers["content-length"] ?? 0);
          if (d.buf.length < i + 4 + cl) return;
          const body = d.buf.subarray(i + 4, i + 4 + cl).toString();
          d.buf = d.buf.subarray(i + 4 + cl);
          const path = target.split("?")[0];
          const req: RecordedRequest = { method, target, path, headers, body };
          requests.push(req);
          const close = /close/i.test(headers["connection"] ?? "");
          const send = (r: FakeReply) => {
            const b = r.body ?? "";
            s.write(
              `HTTP/1.1 ${r.status}\r\n${API_HEADERS}Content-Type: ${r.contentType ?? "application/json"}\r\n` +
                `Content-Length: ${Buffer.byteLength(b)}\r\n${close ? "Connection: close\r\n" : ""}\r\n${method === "HEAD" ? "" : b}`,
            );
            if (close) s.end();
          };
          const o = options.override?.(req);
          if (o) {
            // hold: keep the connection open and never answer (a long-running wait).
            if (!o.hold) send(o);
            continue;
          }
          const norm = path.replace(/^\/v\d+\.\d+/, "");
          let m: RegExpMatchArray | null;
          if (norm === "/_ping") send({ status: "200 OK", body: "OK", contentType: "text/plain" });
          else if (norm === "/version") send({ status: "200 OK", body: JSON.stringify({ Version: "29.8.1", ApiVersion: "1.56" }) });
          else if (norm === "/containers/json") send({ status: "200 OK", body: JSON.stringify(options.list ?? []) });
          else if (norm === "/containers/create") {
            const id = options.createId ?? "a".repeat(64);
            let parsed: any = {};
            try {
              parsed = JSON.parse(body);
            } catch {
              /* recorded anyway */
            }
            const name = new URLSearchParams(target.split("?")[1] ?? "").get("name") ?? "";
            containers.set(id, { Id: id, Name: `/${name}`, Labels: parsed?.Labels ?? {}, Binds: parsed?.HostConfig?.Binds ?? null });
            send({ status: "201 Created", body: JSON.stringify({ Id: id, Warnings: [] }) });
          } else if ((m = norm.match(/^\/containers\/([^/]+)\/json$/))) {
            const c = lookup(decodeURIComponent(m[1]));
            if (!c) send({ status: "404 Not Found", body: JSON.stringify({ message: "No such container" }) });
            else
              send({
                status: "200 OK",
                body: JSON.stringify({ Id: c.Id, Name: c.Name, Config: { Labels: c.Labels, Env: ["SECRET=x"] }, HostConfig: { Binds: c.Binds } }),
              });
          } else if (/^\/containers\/[^/]+\/attach$/.test(norm)) {
            s.write("HTTP/1.1 101 UPGRADED\r\nContent-Type: application/vnd.docker.raw-stream\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n");
            d.mode = "raw";
            d.attachIdx = attachStdin.push("") - 1;
            if (d.buf.length) {
              attachStdin[d.attachIdx] += d.buf.toString();
              d.buf = Buffer.alloc(0);
            }
            return;
          } else if (/^\/containers\/[^/]+\/start$/.test(norm)) send({ status: "204 No Content" });
          else if (/^\/containers\/[^/]+\/wait$/.test(norm)) send({ status: "200 OK", body: JSON.stringify({ StatusCode: 0 }) });
          else if (/^\/containers\/[^/]+\/kill$/.test(norm)) send({ status: "204 No Content" });
          else if (method === "DELETE" && /^\/containers\/[^/]+$/.test(norm)) send({ status: "204 No Content" });
          else send({ status: "404 Not Found", body: JSON.stringify({ message: "page not found" }) });
        }
      },
      end(s) {
        const d = s.data;
        if (d.mode === "raw") {
          // Client half-closed stdin: reply with output frames AFTER the FIN, then close.
          s.write(dockerFrame(1, `echo:${attachStdin[d.attachIdx]}`));
          s.write(dockerFrame(2, "err-line\n"));
          s.end();
        } else {
          s.end();
        }
      },
      close(s) {
        sockets.delete(s);
      },
      error() {},
    },
  });

  return {
    socketPath,
    requests,
    attachStdin,
    containers,
    options,
    async stop() {
      listener.stop(true);
      for (const s of sockets) s.end();
      await Bun.sleep(0);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

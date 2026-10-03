import { readKeysFile } from "../config";
import { requireAdminReauth } from "../access";
import { countTokensPayload, estimateTokens, parseAnthropicRequest } from "../anthropic";
import { parseChatRequest } from "../openai";
import { HttpError, jsonResponse, readJsonBody } from "../http";
import { isAdminCaller, assertPrincipalQuota, assertQuota } from "../access";
import { ensureReady, resolveLazyTenant } from "../lifecycle";
import { openaiChatResponse, anthropicChatResponse } from "../responses";
import type { GatewayState } from "../state";
import type { Ctx } from "./ctx";

export async function handleCompat(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  if (req.method === "POST" && path === "/v1/chat/completions") {
    const parsed = parseChatRequest(await readJsonBody(req));
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    if (!state.cfg.variants.includes(parsed.req.model)) {
      throw new HttpError(404, `unknown model: ${parsed.req.model}`);
    }
    // parsed.req.user is intentionally ignored: tenant selection uses the authenticated principal.
    const { rec, promise } = resolveLazyTenant(state, req, parsed.req.model);
    const ready = await ensureReady(state, rec);
    assertQuota(state.cfg, ready);
    assertPrincipalQuota(state, ready.ownerPrincipal ?? "anonymous");
    return await openaiChatResponse(state, ready, parsed.req.message, parsed.req.stream, promise ?? undefined);
  }

  if (req.method === "POST" && path === "/v1/messages") {
    const parsed = parseAnthropicRequest(await readJsonBody(req));
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    if (!state.cfg.variants.includes(parsed.req.model)) {
      throw new HttpError(404, `unknown model: ${parsed.req.model}`);
    }
    // parsed.req.user (metadata.user_id) is intentionally ignored for tenant selection.
    const { rec, promise } = resolveLazyTenant(state, req, parsed.req.model);
    if (promise) await promise;
    const ready = await ensureReady(state, rec);
    assertQuota(state.cfg, ready);
    assertPrincipalQuota(state, ready.ownerPrincipal ?? "anonymous");
    return await anthropicChatResponse(state, ready, parsed.req.message, parsed.req.stream);
  }

  // Phase 2 key rotation: re-read the key file and re-union with the process-immutable env
  // keys — rotation without restart, and a reload can never silently disable auth.
  // SEC-03: admin-only.
  if (req.method === "POST" && path === "/admin/reload") {
    if (!isAdminCaller(state, req)) throw new HttpError(403, "admin only");
    // session-hardening D4: key rotation is destructive-adjacent — re-present the password.
    await requireAdminReauth(state, req);
    const fileKeys = readKeysFile(state.cfg.apiKeysFile);
    const next = [...new Set([...state.cfg.apiKeysEnv, ...fileKeys])];
    if (next.length === 0 && state.cfg.apiKeys.length > 0) {
      throw new HttpError(400, "reload would disable auth (empty key pool) — rejected");
    }
    state.cfg.apiKeys = next;
    state.audit.record("admin", "keys.reload", undefined, `keyCount=${next.length}`);
    return jsonResponse({ reloaded: true, keyCount: next.length });
  }

  if (req.method === "POST" && path === "/v1/messages/count_tokens") {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const estimate = estimateTokens(JSON.stringify(body.messages ?? ""));
    return jsonResponse(countTokensPayload(estimate));
  }

  return null;
}

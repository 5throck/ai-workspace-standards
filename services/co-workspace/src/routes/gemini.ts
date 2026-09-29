import { estimateTokens as geminiEstimateTokens, parseGeminiRequest } from "../gemini";
import { HttpError, jsonResponse, readJsonBody } from "../http";
import { assertPrincipalQuota, assertQuota } from "../access";
import { ensureReady, resolveLazyTenant } from "../lifecycle";
import { geminiChatResponse } from "../responses";
import type { GatewayState } from "../state";
import type { Ctx } from "./ctx";

export async function handleGemini(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  // Gemini wire (Antigravity/Gemini ecosystem). Model id travels in the URL path.
  const geminiCount = path.match(/^\/v1beta\/models\/[^/:]+:countTokens$/);
  if (req.method === "POST" && geminiCount) {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    return jsonResponse({ totalTokens: geminiEstimateTokens(JSON.stringify(body.contents ?? "")) });
  }

  const geminiModels = path.match(/^\/v1beta\/models$/);
  if (req.method === "GET" && geminiModels) {
    return jsonResponse({
      models: state.cfg.variants.map((v) => ({
        name: `models/${v}`,
        displayName: v,
        supportedGenerationMethods: ["generateContent", "streamGenerateContent", "countTokens"],
      })),
    });
  }

  const geminiAction = path.match(/^\/v1beta\/models\/([^/:]+):(generateContent|streamGenerateContent)$/);
  if (req.method === "POST" && geminiAction) {
    const model = decodeURIComponent(geminiAction[1]);
    if (!state.cfg.variants.includes(model)) {
      throw new HttpError(404, `unknown model: ${model}`);
    }
    const parsed = parseGeminiRequest(await readJsonBody(req));
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    // parsed.req.user is intentionally ignored for tenant selection.
    const { rec, promise } = resolveLazyTenant(state, req, model);
    if (promise) await promise;
    const ready = await ensureReady(state, rec);
    assertQuota(state.cfg, ready);
    assertPrincipalQuota(state, ready.ownerPrincipal ?? "anonymous");
    return await geminiChatResponse(state, ready, parsed.req.message, geminiAction[2] === "streamGenerateContent");
  }

  return null;
}

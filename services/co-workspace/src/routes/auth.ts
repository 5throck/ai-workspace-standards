import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { sessionTokenFromCookie, sessionCookieHeader, clearCookieHeader } from "../users";
import { googleConfigured, authorizeUrl, makePkce, exchangeCode, fetchProfile } from "../google-sso";
import { HttpError, cookieSecureFor, jsonResponse, readJsonBody } from "../http";
import { principalTokenUsage, oauthStateMatches } from "../access";
import type { GatewayState } from "../state";
import type { Ctx } from "./ctx";

export async function handleAuth(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { url, path, clientIp } = ctx;
  // ── Wave B1: local accounts (PII-safe flow: login ID + email verification) ──
  if (req.method === "POST" && path === "/auth/signup") {
    if (!state.signupLimiter.allow(clientIp)) throw new HttpError(429, "too many signup attempts — try later");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const loginId = typeof body.loginId === "string" ? body.loginId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : loginId;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "valid email is required");
    if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");
    const result = await state.users.createPendingAccount({ loginId, email, password, name });
    if (!result.ok) {
      const messages: Record<string, string> = {
        login_taken: "this login ID is already taken",
        email_taken: "an account with this email already exists",
        invalid_login: "login ID must be 3-32 chars: a-z, 0-9, hyphen",
      };
      throw new HttpError(409, messages[result.reason] ?? "signup failed");
    }
    // Dev mailer: the verification mail is written to the outbox dir (ops forwards or reads
    // it); a real SMTP integration is operator-side. Token never appears in API responses.
    const outbox = join(state.cfg.dataDir, "mail-outbox");
    mkdirSync(outbox, { recursive: true, mode: 0o700 });
    const verifyUrl = `${url.origin}/auth/verify?token=${result.verificationToken}`;
    writeFileSync(
      join(outbox, `${Date.now()}-${loginId}.txt`),
      `To: ${email}\nSubject: co-workspace account verification\n\nVerify your account (${loginId}):\n${verifyUrl}\n\nOr enter this key in the app: ${result.verificationToken}\n`,
      { mode: 0o600 },
    );
    return jsonResponse({
      ok: true,
      message: "verification mail sent — enter the key from the mail to activate the account",
    });
  }

  if (req.method === "POST" && path === "/auth/verify") {
    if (!state.signupLimiter.allow(clientIp)) throw new HttpError(429, "too many attempts — try later");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const loginId = state.users.verifyEmail(token);
    if (!loginId) throw new HttpError(400, "invalid or expired verification key");
    return jsonResponse({ ok: true, loginId, message: "account activated — sign in with your ID" });
  }

  if (req.method === "POST" && path === "/auth/email/change") {
    if (!state.sessionLimiter.allow(clientIp)) throw new HttpError(429, "too many attempts — try later");
    const user = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!user) throw new HttpError(401, "not signed in");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const result = state.users.createEmailChange(user.id, email);
    if (!result.ok) {
      const messages: Record<string, string> = {
        email_taken: "an account with this email already exists",
        unchanged: "this is already the email on your account",
        invalid_email: "valid email is required",
      };
      throw new HttpError(result.reason === "email_taken" ? 409 : 400, messages[result.reason]);
    }
    // Dev mailer (same as signup): the confirmation mail is written to the outbox dir.
    const outbox = join(state.cfg.dataDir, "mail-outbox");
    mkdirSync(outbox, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(outbox, `${Date.now()}-${user.principal}-email-change.txt`),
      `To: ${email}\nSubject: co-workspace email change\n\nConfirm the new email for ${user.principal}.\nEnter this key in the app: ${result.token}\n`,
      { mode: 0o600 },
    );
    return jsonResponse({ ok: true, message: "verification mail sent — enter the key from the mail to confirm the new email" });
  }

  if (req.method === "POST" && path === "/auth/email/verify") {
    const user = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!user) throw new HttpError(401, "not signed in");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const result = state.users.verifyEmailChange(token);
    if (!result.ok) {
      throw new HttpError(result.reason === "email_taken" ? 409 : 400, result.reason === "email_taken" ? "an account with this email already exists" : "invalid or expired verification key");
    }
    state.audit.record(user.principal, "user.email-change");
    return jsonResponse({ ok: true, message: "email updated" });
  }

  if (req.method === "POST" && path === "/auth/resend") {
    if (!state.signupLimiter.allow(clientIp)) throw new HttpError(429, "too many attempts — try later");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const loginId = typeof body.loginId === "string" ? body.loginId.trim() : "";
    const reissued = state.users.reissueVerification(loginId);
    // Uniform response: a 404-vs-ok difference would let callers enumerate which login
    // IDs have pending verifications (and spam the outbox for existing ones).
    if (!reissued) return jsonResponse({ ok: true, message: "if the account is pending, a verification mail was sent" });
    const outbox = join(state.cfg.dataDir, "mail-outbox");
    mkdirSync(outbox, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(outbox, `${Date.now()}-${loginId}.txt`),
      `To: ${reissued.email}\nSubject: co-workspace account verification\n\nKey: ${reissued.token}\n`,
      { mode: 0o600 },
    );
    return jsonResponse({ ok: true, message: "verification mail re-sent" });
  }

  if (req.method === "POST" && path === "/auth/login") {
    if (!state.loginLimiter.allow(clientIp)) throw new HttpError(429, "too many login attempts — try later");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const loginId = typeof body.loginId === "string" ? body.loginId.trim() : typeof body.email === "string" ? body.email.split("@")[0] : "";
    const password = typeof body.password === "string" ? body.password : "";
    // Per-account limit: a distributed attacker cannot brute-force one account across IPs.
    if (loginId && !state.loginLimiter.allow(`login:${loginId.toLowerCase()}`)) {
      throw new HttpError(429, "too many login attempts — try later");
    }
    const user = await state.users.verifyLoginById(loginId, password);
    if (!user) {
      state.audit.record(loginId || clientIp, "login.failed");
      throw new HttpError(401, "invalid ID or password (or account not yet verified)");
    }
    if (state.users.tempPasswordExpired(user)) {
      state.audit.record(user.principal, "login.failed");
      throw new HttpError(403, "temporary password expired — ask your administrator for a new one");
    }
    state.audit.record(user.principal, "login.success");
    const token = state.users.createSession(user.id);
    return new Response(JSON.stringify({ user: { loginId: user.principal, name: user.name, role: user.role, mustChangePassword: Boolean(user.mustChangePassword) } }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": sessionCookieHeader(token, cookieSecureFor(state.cfg, req)) },
    });
  }

  if (req.method === "POST" && path === "/auth/logout") {
    state.users.destroySession(sessionTokenFromCookie(req));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": clearCookieHeader() },
    });
  }

  if (req.method === "GET" && path === "/auth/me") {
    const user = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!user) throw new HttpError(401, "not signed in");
    const usage = principalTokenUsage(state, user.principal);
    return jsonResponse({
      user: { loginId: user.principal, name: user.name, role: user.role, mustChangePassword: Boolean(user.mustChangePassword) },
      usage: { inputTokens: usage.input, outputTokens: usage.output, totalTokens: usage.input + usage.output },
      budget: state.cfg.principalMaxTokens > 0 ? { maxTokens: state.cfg.principalMaxTokens } : null,
    });
  }

  if (req.method === "PATCH" && path === "/auth/me") {
    const user = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!user) throw new HttpError(401, "not signed in");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) throw new HttpError(400, "password is required");
    if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");
    if (user.mustChangePassword) {
      // R1 forced rotation: the temp credential was verified at sign-in; completing it
      // rotates sessions — the client signs in again with the new password.
      const updated = state.users.completeTempPasswordChange(user.id, password);
      if (!updated) throw new HttpError(404, "user not found");
      state.audit.record(updated.principal, "user.password.rotation");
      return jsonResponse({ ok: true, message: "password updated — sign in with your new password" });
    }
    // R3: a normal password change must present the current credential.
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (!currentPassword || !(await Bun.password.verify(currentPassword, user.passwordHash ?? ""))) {
      throw new HttpError(403, "current password is incorrect");
    }
    const updated = state.users.changePassword(user.id, password, sessionTokenFromCookie(req));
    if (!updated) throw new HttpError(404, "user not found");
    state.audit.record(updated.principal, "user.password.change");
    return jsonResponse({ user: { loginId: updated.principal, name: updated.name, role: updated.role } });
  }

  // ── Wave B2: Google SSO ──
  if (req.method === "GET" && path === "/auth/google/login") {
    if (!googleConfigured()) throw new HttpError(501, "Google SSO not configured (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)");
    const secureFlag = cookieSecureFor(state.cfg, req) ? "; Secure" : "";
    const oauthState = randomBytes(16).toString("hex");
    const { verifier, challenge } = makePkce();
    const url = authorizeUrl(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_REDIRECT_URI!, oauthState, challenge);
    const flags = `HttpOnly; Path=/; SameSite=Lax; Max-Age=600${secureFlag}`;
    const headers = new Headers({ location: url });
    headers.append("set-cookie", `gw_oauth_state=${oauthState}; ${flags}`);
    headers.append("set-cookie", `gw_oauth_verifier=${verifier}; ${flags}`);
    return new Response(null, { status: 302, headers });
  }

  if (req.method === "GET" && path === "/auth/google/callback") {
    if (!googleConfigured()) throw new HttpError(501, "Google SSO not configured");
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const cookie = req.headers.get("cookie") ?? "";
    const expectedState = cookie.match(/gw_oauth_state=([^;]+)/)?.[1];
    const verifier = cookie.match(/gw_oauth_verifier=([^;]+)/)?.[1];
    if (!code || !returnedState || !expectedState || !verifier || !oauthStateMatches(returnedState, expectedState)) {
      throw new HttpError(400, "invalid OAuth state");
    }
    const accessToken = await exchangeCode(code, process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, process.env.GOOGLE_REDIRECT_URI!, verifier);
    const profile = await fetchProfile(accessToken);
    if (!profile.emailVerified) throw new HttpError(401, "Google email not verified");
    let user = state.users.findByGoogleSub(profile.sub);
    if (!user) {
      const byEmail = state.users.findByEmail(profile.email);
      if (byEmail) {
        if (byEmail.googleSub && byEmail.googleSub !== profile.sub) {
          throw new HttpError(409, "account is linked to a different Google identity");
        }
        // H8: never bind a Google identity to an account whose email was not verified.
        if (!state.users.isVerified(byEmail.id)) {
          throw new HttpError(409, "an unverified account uses this email — sign in with your ID and password to link Google");
        }
        if (!byEmail.googleSub) state.users.linkGoogleSub(byEmail.id, profile.sub);
        user = byEmail;
      } else {
        user = state.users.createUser({
          email: profile.email,
          name: profile.name,
          password: null,
          googleSub: profile.sub,
        });
        if (!user) throw new HttpError(500, "account creation failed");
      }
    }
    const token = state.users.createSession(user.id);
    const secureFlag = cookieSecureFor(state.cfg, req) ? "; Secure" : "";
    const headers = new Headers({ location: "/" });
    headers.append("set-cookie", sessionCookieHeader(token, cookieSecureFor(state.cfg, req)));
    headers.append("set-cookie", `gw_oauth_state=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`);
    headers.append("set-cookie", `gw_oauth_verifier=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`);
    return new Response(null, { status: 302, headers });
  }

  return null;
}

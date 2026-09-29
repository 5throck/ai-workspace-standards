/** Unit tests for Team Gateway tenant registry, HERMES_HOME seeding, and config (ADR-0092 W2). */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveLlmProviderKey, resolveLlmProviderName, resolveVariants } from "../../services/co-workspace/src/config";
import { UserStore } from "../../services/co-workspace/src/users";
import {
  publicTenant,
  seedHermesHome,
  sweepTenantStragglers,
  tenantConfigYaml,
} from "../../services/co-workspace/src/tenant";
import { TenantRegistry } from "../../services/co-workspace/src/registry-db";

function tempDir(): string {
  return join(tmpdir(), `co-workspace-test-${crypto.randomUUID().slice(0, 8)}`);
}

describe("GatewayConfig (loadConfig)", () => {
  test("defaults are loopback-local and co-consult only", () => {
    const cfg = loadConfig({});
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.variants).toEqual(["co-consult"]);
    expect(cfg.hermesBin).toBe("hermes");
    expect(cfg.runBudgetSeconds).toBe(300);
    expect(cfg.maxTurns).toBe(100);
    expect(cfg.templateVersion).toBeUndefined();
    expect(cfg.hermesSeedHome).toBeUndefined();
  });

  test("provider key+base-url parse (design 2026-09-29-co-workspace-provider-key-config)", () => {
    const cfg = loadConfig({
      CO_WORKSPACE_LLM_BASE_URL: "https://api.example.com/v1",
      CO_WORKSPACE_LLM_API_KEY: "sk-test",
    });
    expect(cfg.llmBaseUrl).toBe("https://api.example.com/v1");
    expect(cfg.llmApiKey).toBe("sk-test");
    const off = loadConfig({});
    expect(off.llmBaseUrl).toBeUndefined();
    expect(off.llmApiKey).toBeUndefined();
  });

  test("provider selector resolution mirrors the co-newbiz scheme (R6)", () => {
    const withKey = { CO_WORKSPACE_LLM_API_KEY: "sk" };
    // default custom → OPENAI_API_KEY
    expect(resolveLlmProviderKey(loadConfig(withKey))).toEqual({ name: "OPENAI_API_KEY", value: "sk" });
    expect(resolveLlmProviderName(loadConfig(withKey))).toBe("custom");
    expect(resolveLlmProviderKey(loadConfig({ ...withKey, CO_WORKSPACE_LLM_PROVIDER: "openai" }))?.name).toBe("OPENAI_API_KEY");
    expect(resolveLlmProviderKey(loadConfig({ ...withKey, CO_WORKSPACE_LLM_PROVIDER: "anthropic" }))?.name).toBe("ANTHROPIC_API_KEY");
    expect(resolveLlmProviderKey(loadConfig({ ...withKey, CO_WORKSPACE_LLM_PROVIDER: "gemini" }))?.name).toBe("GOOGLE_API_KEY");
    expect(resolveLlmProviderKey(loadConfig({ ...withKey, CO_WORKSPACE_LLM_PROVIDER: "zai" }))?.name).toBe("ZAI_API_KEY");
    expect(resolveLlmProviderName(loadConfig({ ...withKey, CO_WORKSPACE_LLM_PROVIDER: "anthropic" }))).toBe("anthropic");
    // none / unset key = off → legacy shared-store path
    expect(resolveLlmProviderKey(loadConfig({ ...withKey, CO_WORKSPACE_LLM_PROVIDER: "none" }))).toBeNull();
    expect(resolveLlmProviderKey(loadConfig({}))).toBeNull();
  });

  test("env overrides apply, variants split on commas, junk numbers fall back", () => {
    const cfg = loadConfig({
      CO_WORKSPACE_HOST: "0.0.0.0",
      CO_WORKSPACE_PORT: "9999",
      CO_WORKSPACE_VARIANTS: "co-consult, co-develop ,,",
      CO_WORKSPACE_TEMPLATE_VERSION: "0.7.0",
      CO_WORKSPACE_RUN_BUDGET_SECONDS: "not-a-number",
      CO_WORKSPACE_MAX_TURNS: "42",
      CO_WORKSPACE_HERMES_SEED_HOME: "/seed",
      HERMES_BIN: "/usr/local/bin/hermes",
      CO_WORKSPACE_HERMES_EXTRA_ARGS: "--yolo  --verbose",
    });
    expect(cfg.host).toBe("0.0.0.0");
    expect(cfg.port).toBe(9999);
    expect(cfg.variants).toEqual(["co-consult", "co-develop"]);
    expect(cfg.templateVersion).toBe("0.7.0");
    expect(cfg.runBudgetSeconds).toBe(300); // junk → fallback
    expect(cfg.maxTurns).toBe(42);
    expect(cfg.hermesSeedHome).toBe("/seed");
    expect(cfg.hermesBin).toBe("/usr/local/bin/hermes");
    expect(cfg.hermesExtraArgs).toEqual(["--yolo", "--verbose"]);
  });
});

describe("UserStore — PII-safe signup (NOT NULL regression, live-found 2026-09-27)", () => {
  test("createPendingAccount works despite the legacy email NOT NULL constraint", async () => {
    const dataDir = join(tmpdir(), `gw-signup-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dataDir, { recursive: true });
    const store = new UserStore(dataDir);
    const result = await store.createPendingAccount({
      loginId: "techcross",
      email: "techcross@gmail.com",
      password: "longenough1",
    });
    expect(result.ok).toBe(true);
    // verify the account activates and logs in by ID
    if (result.ok) {
      const loginId = store.verifyEmail(result.verificationToken);
      expect(loginId).toBe("techcross");
      const user = await store.verifyLoginById("techcross", "longenough1");
      expect(user?.principal).toBe("techcross");
      // raw email must not persist post-verification
      expect(store.findByEmail("techcross@gmail.com")).toBeNull();
    }
  });
});

describe("resolveVariants — catalog expansion", () => {
  test("explicit comma lists are honored verbatim", () => {
    expect(resolveVariants("co-consult, co-price", "/nowhere")).toEqual(["co-consult", "co-price"]);
  });

  test("all auto-discovers stable variants only from the workspace tree", () => {
    const ws = join(tmpdir(), `gw-variants-${crypto.randomUUID().slice(0, 8)}`);
    for (const [name, status] of [
      ["co-stable-a", "stable"],
      ["co-beta", "beta"],
      ["co-broken", "stable"],
    ] as const) {
      mkdirSync(join(ws, "templates", name), { recursive: true });
      writeFileSync(
        join(ws, "templates", name, "variant.json"),
        name === "co-broken" ? "{ not json" : JSON.stringify({ status }),
      );
    }
    mkdirSync(join(ws, "templates", "not-a-variant"), { recursive: true });
    const variants = resolveVariants("all", ws);
    expect(variants).toEqual(["co-stable-a"]); // beta and unreadable are excluded
    expect(resolveVariants("*", ws)).toEqual(["co-stable-a"]);
  });

  test("all with no templates dir yields empty catalog", () => {
    expect(resolveVariants("all", join(tmpdir(), `gw-empty-${crypto.randomUUID().slice(0, 8)}`))).toEqual([]);
  });
});

describe("TenantRegistry", () => {
  test("create persists to registry.json and survives a reload", () => {
    const dataDir = tempDir();
    mkdirSync(dataDir, { recursive: true });
    const registry = new TenantRegistry(dataDir);
    const rec = registry.create({ dataDir, variant: "co-consult", key: "co-consult::alice" });
    expect(rec.status).toBe("provisioning");
    expect(rec.projectDir).toContain(join("storage", "shared", rec.tenantId, "project"));
    expect(rec.hermesHome).toContain(join("storage", "shared", rec.tenantId, "hermes-home"));
    expect(existsSync(registry.registryPath)).toBe(true);

    const reloaded = new TenantRegistry(dataDir);
    expect(reloaded.get(rec.tenantId)?.variant).toBe("co-consult");
    expect(reloaded.findByKey("co-consult::alice")?.tenantId).toBe(rec.tenantId);
  });

  test("upsert persists status transitions", () => {
    const dataDir = tempDir();
    mkdirSync(dataDir, { recursive: true });
    const registry = new TenantRegistry(dataDir);
    const rec = registry.create({ dataDir, variant: "co-consult" });
    rec.status = "ready";
    rec.sessions = 2;
    registry.upsert(rec);
    const reloaded = new TenantRegistry(dataDir);
    expect(reloaded.get(rec.tenantId)?.status).toBe("ready");
    expect(reloaded.get(rec.tenantId)?.sessions).toBe(2);
  });
});

describe("seedHermesHome — per-tenant isolation and ADR-0088 D7 trust scoping", () => {
  test("copies credential files from the seed home but generates its own config.yaml", () => {
    const dataDir = tempDir();
    const seedHome = tempDir();
    mkdirSync(seedHome, { recursive: true });
    writeFileSync(join(seedHome, "auth.json"), '{"tokens":{}}');
    writeFileSync(join(seedHome, ".env"), "SECRET=1");
    writeFileSync(join(seedHome, "config.yaml"), "model:\n  provider: secret-operator-config\n");

    const registry = new TenantRegistry(dataDir);
    const rec = registry.create({ dataDir, variant: "co-consult" });
    seedHermesHome(rec, seedHome);

    expect(existsSync(join(rec.hermesHome, ".env"))).toBe(true);
    expect(existsSync(join(rec.hermesHome, "auth.json"))).toBe(false); // tokens come via the shared store (Addendum 4)
    const config = readFileSync(join(rec.hermesHome, "config.yaml"), "utf8");
    expect(config).toContain("trusted_project_dirs:");
    expect(config).toContain(`- ${rec.projectDir}`);
    expect(config).toContain("project_discovery: true");
    expect(config).not.toContain("secret-operator-config");
  });

  test("works without a seed home (credentials provisioned later)", () => {
    const dataDir = tempDir();
    const registry = new TenantRegistry(dataDir);
    const rec = registry.create({ dataDir, variant: "co-consult" });
    seedHermesHome(rec, undefined);
    expect(existsSync(join(rec.hermesHome, "config.yaml"))).toBe(true);
    expect(existsSync(join(rec.hermesHome, "auth.json"))).toBe(false);
  });

  test("stamps the gateway model into config.yaml when configured", () => {
    const dataDir = tempDir();
    const registry = new TenantRegistry(dataDir);
    const rec = registry.create({ dataDir, variant: "co-consult" });
    seedHermesHome(rec, undefined, "upstage/solar-pro4:free");
    const config = readFileSync(join(rec.hermesHome, "config.yaml"), "utf8");
    expect(config).toContain('default: "upstage/solar-pro4:free"');
    const withoutModel = tenantConfigYaml("/tmp/project");
    expect(withoutModel).not.toContain("model:");
  });

  test("tenantConfigYaml trusts exactly the tenant project dir", () => {
    const yaml = tenantConfigYaml("/data/tenants/gw-1/project");
    expect(yaml).toContain("- /data/tenants/gw-1/project");
    expect(yaml.match(/trusted_project_dirs:/g)?.length).toBe(1);
  });

  test("provider key mode stamps the custom provider and base_url (2026-09-29 design)", () => {
    const yaml = tenantConfigYaml("/data/tenants/gw-1/project", "my-model", {
      providerName: "custom",
      providerBaseUrl: "https://api.example.com/v1",
      providerApiKey: "sk-test",
    });
    expect(yaml).toContain('default: "my-model"');
    expect(yaml).toContain("provider: custom");
    expect(yaml).toContain('base_url: "https://api.example.com/v1"');
    // Isolated turns mount the same project at /work/project — both trust paths explicit.
    expect(yaml).toContain("- /work/project");
    // Hermes agent turns resolve the key through the profile secret scope (the ambient
    // env is deliberately not borrowed) — the key must be stamped into the config.
    expect(yaml).toContain('api_key: "sk-test"');
    const withoutProvider = tenantConfigYaml("/data/tenants/gw-1/project", "my-model");
    expect(withoutProvider).not.toContain("provider:");
    expect(withoutProvider).not.toContain("api_key:");
    const named = tenantConfigYaml("/data/tenants/gw-1/project", "m", { providerName: "anthropic" });
    expect(named).toContain("provider: anthropic");
    expect(named).not.toContain("base_url:");
  });
});

describe("publicTenant — internal paths stay server-side", () => {
  test("omits hermesHome and projectDir", () => {
    const dataDir = tempDir();
    const registry = new TenantRegistry(dataDir);
    const rec = registry.create({ dataDir, variant: "co-consult", description: "d" });
    const pub = publicTenant(rec) as Record<string, unknown>;
    expect(pub.tenantId).toBe(rec.tenantId);
    expect(pub.variant).toBe("co-consult");
    expect("hermesHome" in pub).toBe(false);
    expect("projectDir" in pub).toBe(false);
  });
});

describe("sweepTenantStragglers (user-reported 2026-09-29: deleted tenants left disk data)", () => {
  test("removes tenantId-prefixed malformed siblings, keeps the canonical folder and unrelated dirs", () => {
    const principalDir = tempDir();
    mkdirSync(join(principalDir, "gw-abc123"), { recursive: true });
    mkdirSync(join(principalDir, "gw-abc123project"), { recursive: true });
    mkdirSync(join(principalDir, "gw-abc123hermes-home"), { recursive: true });
    mkdirSync(join(principalDir, "gw-other999"), { recursive: true });
    writeFileSync(join(principalDir, "gw-abc123project", "leftover.txt"), "x");
    const removed = sweepTenantStragglers(principalDir, "gw-abc123", "gw-abc123");
    expect(removed.sort()).toEqual(["gw-abc123hermes-home", "gw-abc123project"]);
    expect(existsSync(join(principalDir, "gw-abc123"))).toBe(true);
    expect(existsSync(join(principalDir, "gw-other999"))).toBe(true);
    rmSync(principalDir, { recursive: true, force: true });
  });

  test("a missing principal dir is a no-op", () => {
    expect(sweepTenantStragglers(join(tempDir(), "missing"), "gw-x", "gw-x")).toEqual([]);
  });
});

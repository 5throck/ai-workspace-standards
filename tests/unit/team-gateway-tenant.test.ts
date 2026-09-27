/** Unit tests for Team Gateway tenant registry, HERMES_HOME seeding, and config (ADR-0092 W2). */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveVariants } from "../../services/team-gateway/src/config";
import {
  publicTenant,
  seedHermesHome,
  TenantRegistry,
  tenantConfigYaml,
} from "../../services/team-gateway/src/tenant";

function tempDir(): string {
  return join(tmpdir(), `team-gateway-test-${crypto.randomUUID().slice(0, 8)}`);
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

  test("env overrides apply, variants split on commas, junk numbers fall back", () => {
    const cfg = loadConfig({
      TEAM_GATEWAY_HOST: "0.0.0.0",
      TEAM_GATEWAY_PORT: "9999",
      TEAM_GATEWAY_VARIANTS: "co-consult, co-develop ,,",
      TEAM_GATEWAY_TEMPLATE_VERSION: "0.7.0",
      TEAM_GATEWAY_RUN_BUDGET_SECONDS: "not-a-number",
      TEAM_GATEWAY_MAX_TURNS: "42",
      TEAM_GATEWAY_HERMES_SEED_HOME: "/seed",
      HERMES_BIN: "/usr/local/bin/hermes",
      TEAM_GATEWAY_HERMES_EXTRA_ARGS: "--yolo  --verbose",
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
    expect(rec.projectDir).toContain(join("tenants", rec.tenantId, "project"));
    expect(rec.hermesHome).toContain(join("tenants", rec.tenantId, "hermes-home"));
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

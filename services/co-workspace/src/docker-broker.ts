/**
 * Create-body-validating Docker socket broker (T-20260930-008).
 *
 * Replaces the tecnativa/docker-socket-proxy sidecar: the endpoint filter alone cannot
 * inspect the container-create body, so a compromised gateway could still create a
 * privileged container or bind-mount `/` (docker-compose.isolation.yml WARNING, verified
 * live 2026-09-30). This broker adds three controls the endpoint filter cannot express:
 *
 *   1. Create-body validation — image allowlist, no Privileged, CapDrop ALL,
 *      no-new-privileges, fixed uid:gid user, bind sources restricted to the gateway
 *      data-dir host prefix, no host Pid/Network mode, no devices, resource caps present.
 *   2. Name scoping — create/start/wait/kill/attach/inspect/remove only resolve containers
 *      whose name starts with the gateway's turn prefix, so the daemon's other workloads
 *      are invisible even though the gateway still runs `docker ps` for its boot reaper
 *      (the list response is filtered to the prefix before it reaches the gateway).
 *   3. Endpoint allowlist — exactly the verified set (isolation compose, 2026-09-30):
 *      version probe, container create/start/wait/attach/kill, list, inspect, delete.
 *      Everything else (exec, images, volumes, networks, info, build, swarm…) is 403.
 *
 * Run (same gateway image, command override in docker-compose.isolation.yml):
 *   bun src/docker-broker.ts
 *
 * Env: CO_WORKSPACE_BROKER_PORT (2375), CO_WORKSPACE_BROKER_SOCKET (/var/run/docker.sock),
 * CO_WORKSPACE_BROKER_UPSTREAM (http URL override — tests only), CO_WORKSPACE_BROKER_NAME_PREFIX
 * (co-workspace-turn-), CO_WORKSPACE_RUNTIME_IMAGE (image allowlist), CO_WORKSPACE_DATA_DIR_HOST
 * (bind source prefix; set for containerized gateways — compose already requires it).
 */

export interface CreateBodyValidation {
  ok: boolean;
  reason?: string;
}

export interface BrokerConfig {
  port: number;
  socket: string;
  upstream?: string;
  namePrefix: string;
  runtimeImage: string;
  dataDirHost?: string;
}

export function loadBrokerConfig(env: Record<string, string | undefined> = process.env): BrokerConfig {
  return {
    port: Number(env.CO_WORKSPACE_BROKER_PORT ?? 2375),
    socket: env.CO_WORKSPACE_BROKER_SOCKET ?? "/var/run/docker.sock",
    upstream: env.CO_WORKSPACE_BROKER_UPSTREAM || undefined,
    namePrefix: env.CO_WORKSPACE_BROKER_NAME_PREFIX ?? "co-workspace-turn-",
    runtimeImage: env.CO_WORKSPACE_RUNTIME_IMAGE ?? "co-workspace-runtime:latest",
    dataDirHost: env.CO_WORKSPACE_DATA_DIR_HOST || undefined,
  };
}

/** True when a container name (Docker reports them with a leading slash) belongs to
 *  this gateway's turn fleet. */
export function isOwnContainerName(name: string, prefix: string): boolean {
  const bare = name.startsWith("/") ? name.slice(1) : name;
  return bare.startsWith(prefix);
}

/** Validate a POST /containers/create JSON body against the isolation policy.
 *  Pure — every rule the live turn containers satisfy by construction (chat.ts container
 *  options: CapDrop ALL, user 10000:10000, no-new-privileges, memory/cpus/pids caps,
 *  binds only under the host data dir). */
export function validateCreateBody(
  body: {
    Image?: unknown;
    HostConfig?: {
      Privileged?: unknown;
      CapDrop?: unknown;
      SecurityOpt?: unknown;
      User?: unknown;
      Binds?: unknown;
      Mounts?: Array<{ Type?: unknown; Source?: unknown }>;
      PidMode?: unknown;
      NetworkMode?: unknown;
      Devices?: unknown;
      Memory?: unknown;
      PidsLimit?: unknown;
    };
  },
  cfg: Pick<BrokerConfig, "runtimeImage" | "dataDirHost">,
): CreateBodyValidation {
  if (typeof body.Image !== "string" || !body.Image) return { ok: false, reason: "Image missing" };
  const allowedImage = cfg.runtimeImage;
  const imageOk = body.Image === allowedImage ||
    (allowedImage.split(":")[0] !== "" && body.Image.split(":")[0] === allowedImage.split(":")[0] && allowedImage.split(":").length === 1);
  if (!imageOk) return { ok: false, reason: `Image ${body.Image} is not the allowlisted runtime (${allowedImage})` };

  const hc = body.HostConfig ?? {};
  if (hc.Privileged === true) return { ok: false, reason: "Privileged containers are not allowed" };
  if (!Array.isArray(hc.CapDrop) || !hc.CapDrop.includes("ALL")) {
    return { ok: false, reason: "HostConfig.CapDrop must include ALL" };
  }
  if (!Array.isArray(hc.SecurityOpt) || !hc.SecurityOpt.includes("no-new-privileges")) {
    return { ok: false, reason: "HostConfig.SecurityOpt must include no-new-privileges" };
  }
  if (hc.User !== "10000:10000") return { ok: false, reason: 'HostConfig.User must be "10000:10000"' };
  if (hc.PidMode === "host") return { ok: false, reason: "PidMode host is not allowed" };
  if (hc.NetworkMode === "host") return { ok: false, reason: "NetworkMode host is not allowed" };
  if (Array.isArray(hc.Devices) && hc.Devices.length > 0) return { ok: false, reason: "Devices are not allowed" };
  if (typeof hc.Memory !== "number" || hc.Memory <= 0) return { ok: false, reason: "HostConfig.Memory cap required" };
  if (typeof hc.PidsLimit !== "number" || hc.PidsLimit <= 0) return { ok: false, reason: "HostConfig.PidsLimit cap required" };

  if (!cfg.dataDirHost) return { ok: false, reason: "broker misconfigured: CO_WORKSPACE_DATA_DIR_HOST unset — no bind can be validated" };
  const prefix = cfg.dataDirHost.replace(/\/+$/, "") + "/";
  if (Array.isArray(hc.Binds)) {
    for (const bind of hc.Binds) {
      if (typeof bind !== "string") return { ok: false, reason: "HostConfig.Binds entries must be strings" };
      // "src:dst[:opts]" — the source is the first colon-separated part (absolute host path).
      const src = bind.split(":")[0];
      if (!src || !src.startsWith(prefix)) return { ok: false, reason: `Bind source outside the data dir: ${bind}` };
    }
  }
  if (Array.isArray(hc.Mounts)) {
    for (const m of hc.Mounts) {
      if (m.Type === "volume") return { ok: false, reason: "Volume mounts are not allowed" };
      if (typeof m.Source !== "string" || !m.Source.startsWith(prefix)) {
        return { ok: false, reason: `Mount source outside the data dir: ${String(m.Source)}` };
      }
    }
  }
  return { ok: true };
}

/** Route policy: true when the broker forwards this request upstream. Pure. */
export function isAllowedRequest(
  method: string,
  pathWithQuery: string,
  prefix: string,
): { allowed: boolean; reason?: string; scopedName?: string } {
  const path = pathWithQuery.split("?")[0];
  if (method === "GET" && (path === "/version" || path === "/_ping")) return { allowed: true };
  if (method === "GET" && path === "/containers/json") return { allowed: true };
  if (method === "POST" && path === "/containers/create") {
    const name = new URLSearchParams(pathWithQuery.split("?")[1] ?? "").get("name") ?? "";
    if (!name.startsWith(prefix)) return { allowed: false, reason: `container name must start with ${prefix}` };
    return { allowed: true, scopedName: name };
  }
  const containerOp = path.match(/^\/containers\/([^/]+)(\/.*)?$/);
  if (containerOp) {
    const ref = decodeURIComponent(containerOp[1]);
    const action = containerOp[2] ?? "";
    if (!ref.startsWith(prefix)) {
      return { allowed: false, reason: `container ref outside the ${prefix} fleet` };
    }
    if (method === "POST" && ["/start", "/wait", "/kill", "/attach"].includes(action)) return { allowed: true, scopedName: ref };
    if (method === "GET" && action === "/json") return { allowed: true, scopedName: ref };
    if (method === "DELETE" && action === "") return { allowed: true, scopedName: ref };
  }
  return { allowed: false, reason: `endpoint not in the broker allowlist: ${method} ${path}` };
}

/** Filter a GET /containers/json response body down to the gateway's own fleet. */
export function filterContainerList(body: unknown, prefix: string): unknown {
  if (!Array.isArray(body)) return body;
  return body.filter((c) =>
    Array.isArray((c as { Names?: unknown }).Names) &&
    ((c as { Names: string[] }).Names.some((n) => isOwnContainerName(n, prefix))),
  );
}

/** The broker's request handler: policy enforcement + upstream forwarding. Exported so
 *  tests drive the exact production handler (import.meta.main just serves it). */
export function createBrokerHandler(cfg: BrokerConfig): (req: Request) => Promise<Response> {
  /** Forward to the upstream: a TCP URL (tests) or the Docker unix socket
   *  (Bun fetch's non-standard `unix` option). */
  function forward(target: string, init: RequestInit): Promise<Response> {
    if (cfg.upstream) {
      return fetch(cfg.upstream.replace(/\/$/, "") + target, init);
    }
    return fetch(`http://docker${target}`, { ...init, unix: cfg.socket } as RequestInit);
  }

  return async function brokerFetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const target = url.pathname + url.search;
    const policy = isAllowedRequest(req.method, target, cfg.namePrefix);
    if (!policy.allowed) {
      return new Response(JSON.stringify({ error: `docker broker: ${policy.reason}` }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    try {
      if (req.method === "POST" && url.pathname === "/containers/create") {
        const raw = await req.text();
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response(JSON.stringify({ error: "docker broker: create body is not valid JSON" }), { status: 400 });
        }
        const verdict = validateCreateBody(body as Parameters<typeof validateCreateBody>[0], cfg);
        if (!verdict.ok) {
          return new Response(JSON.stringify({ error: `docker broker: ${verdict.reason}` }), { status: 403 });
        }
        const upstream = await forward(target, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: raw,
        });
        return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
      }
      const init: RequestInit = { method: req.method, headers: req.headers };
      if (req.method === "POST" || req.method === "DELETE") {
        // Forward the (usually empty) body; attaches stream through untouched.
        init.body = req.body;
        (init as { duplex?: string }).duplex = "half";
      }
      const upstream = await forward(target, init);
      if (req.method === "GET" && url.pathname === "/containers/json") {
        try {
          const list = await upstream.json();
          return new Response(JSON.stringify(filterContainerList(list, cfg.namePrefix)), {
            status: upstream.status,
            headers: { "content-type": "application/json" },
          });
        } catch {
          return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
        }
      }
      return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
    } catch (err) {
      console.error(`[docker-broker] upstream error: ${(err as Error).message}`);
      return new Response(JSON.stringify({ error: "docker broker: upstream unreachable" }), { status: 502 });
    }
  };
}

if (import.meta.main) {
  const cfg = loadBrokerConfig();
  Bun.serve({
    port: cfg.port,
    idleTimeout: 0, // long attaches/waits must not be cut by the broker
    fetch: createBrokerHandler(cfg),
  });
  console.log(`[docker-broker] listening on :${cfg.port} -> ${cfg.upstream ?? `unix:${cfg.socket}`} (fleet prefix ${cfg.namePrefix})`);
}

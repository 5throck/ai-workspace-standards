/** Boot-time reaper for orphaned sibling turn containers (docker isolation). Never throws. */
export function reapOrphanedTurns(
  cfg: { dockerBin: string; instanceId: string },
  opts?: { timeoutMs?: number },
): { found: number; killed: number; error?: string } {
  try {
    const timeout = opts?.timeoutMs ?? 10_000;
    const ps = Bun.spawnSync(
      [
        cfg.dockerBin, "ps", "-a",
        "--filter", "label=co-workspace.turn=1",
        "--filter", "label=co-workspace.instance=" + cfg.instanceId,
        "--format", "{{.ID}}",
      ],
      { timeout, stdout: "pipe", stderr: "pipe" },
    );
    if (ps.exitCode !== 0) {
      return { found: 0, killed: 0, error: `docker ps failed (exit ${ps.exitCode}): ${ps.stderr.toString().trim().slice(0, 200)}` };
    }
    const ids = ps.stdout
      .toString()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[0-9a-f]{12,64}$/.test(l));
    if (ids.length === 0) return { found: 0, killed: 0 };
    const rm = Bun.spawnSync([cfg.dockerBin, "rm", "-f", ...ids], { timeout, stdout: "pipe", stderr: "pipe" });
    if (rm.exitCode !== 0) {
      return { found: ids.length, killed: 0, error: `docker rm failed (exit ${rm.exitCode}): ${rm.stderr.toString().trim().slice(0, 200)}` };
    }
    return { found: ids.length, killed: ids.length };
  } catch (e) {
    return { found: 0, killed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

// Smoke test against a running Worker: /healthz answers 200, a static asset carries the headers from
// public/_headers, a link is created (201) and redirects (302).
// Needs no Cloudflare account. Usage: bun scripts/ci/smoke.ts [base-url]   (default http://localhost:8787)

const WAIT_MS = 120_000;
const POLL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 5_000;

function timeout(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

export async function waitForHealth(
  base: string,
  fetcher: typeof fetch = fetch,
  timeoutMs: number = WAIT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetcher(`${base}/healthz`, { signal: timeout() });
      if (res.status === 200) return;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline)
      throw new Error(`/healthz did not return 200 within ${timeoutMs} ms`);
    await Bun.sleep(POLL_MS);
  }
}

export async function smoke(base: string, fetcher: typeof fetch = fetch): Promise<string[]> {
  const log: string[] = [];
  await waitForHealth(base, fetcher);
  log.push("GET /healthz -> 200");

  const asset = await fetcher(`${base}/css/app.css`, { signal: timeout() });
  await asset.body?.cancel();
  if (asset.status !== 200) throw new Error(`GET /css/app.css returned ${asset.status}`);
  for (const name of ["Strict-Transport-Security", "X-Content-Type-Options"]) {
    if (!asset.headers.get(name)) throw new Error(`GET /css/app.css has no ${name}`);
  }
  log.push("security headers present on /css/app.css");

  const target = "https://example.com/smoke";
  const created = await fetcher(`${base}/api/v1/links`, {
    method: "POST",
    signal: timeout(),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: target }),
  });
  if (created.status !== 201) {
    throw new Error(`POST /api/v1/links returned ${created.status}, expected 201`);
  }
  const { id } = (await created.json()) as { id?: unknown };
  if (typeof id !== "string") throw new Error("POST /api/v1/links returned no id");
  log.push(`POST /api/v1/links -> 201 (id ${id})`);

  const redirect = await fetcher(`${base}/${id}`, { redirect: "manual", signal: timeout() });
  const location = redirect.headers.get("Location");
  if (redirect.status !== 302)
    throw new Error(`GET /${id} returned ${redirect.status}, expected 302`);
  if (location !== target)
    throw new Error(`GET /${id} redirected to ${location}, expected ${target}`);
  log.push(`GET /${id} -> 302 Location: ${location}`);
  return log;
}

if (import.meta.main) {
  const base = (process.argv[2] ?? "http://localhost:8787").replace(/\/+$/, "");
  try {
    for (const line of await smoke(base)) console.log(line);
    console.log("smoke ok");
  } catch (error) {
    console.error(`smoke failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

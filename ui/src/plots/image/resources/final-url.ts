/**
 * Content-addressing under live / redirecting "query" URLs.
 *
 * A live query URL (e.g. `/api/query?run=latest&tag=…`) does NOT serve bytes
 * itself — it **302-redirects** to a content-addressed blob
 * (`/api/artifacts/{digest}`). Its bytes therefore CHANGE over time as the
 * "latest" resolution moves. cairn-plot's image caches key on the URL STRING
 * (`imageLoadCache`/`imageDataCache` in `image/cache.ts`, and the GPU
 * `DiffCache` content keys), so keying them on the *request* URL would serve
 * stale pixels after a re-resolve.
 *
 * `resolveFinalUrl` probes a URL, follows redirects, and returns the FINAL
 * post-redirect URL (`res.url` — the digest URL). Threaded into the
 * `imageUrl`/`baselineUrl`/`contentKey` props the caches derive from, every
 * existing key expression becomes content-addressed for free: two "latest"
 * resolutions that land on different digests get different cache identities (no
 * stale hit); identical content across queries shares one digest (free dedup).
 *
 * Behavior preservation:
 *  - Non-`http(s)` schemes (`data:`/`blob:` — already self-contained /
 *    content-addressed, and never redirecting) are returned UNCHANGED with no
 *    fetch.
 *  - A non-redirecting `http(s)` URL resolves to `res.url === url` — byte-for-
 *    byte identical cache identity to today.
 *  - Any failure (network, CORS-blocked fetch, non-2xx) falls back to the
 *    original URL, so a cross-origin URL that renders today only via `<img src>`
 *    keeps rendering (just not content-addressed — which live query URLs, being
 *    same-origin by design, never need).
 *
 * The probe prefers `HEAD` (only the final URL is needed, not the body); some
 * endpoints reject `HEAD`, so it falls back to `GET` before giving up.
 */
export async function resolveFinalUrl(url: string): Promise<string> {
  // Only http(s) URLs can redirect; data:/blob:/etc. are self-contained.
  if (!/^https?:/i.test(url)) return url;
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, { method, redirect: "follow" });
      if (res.ok) return res.url || url;
    } catch {
      // network / CORS / method-not-allowed — try the next method, then fall
      // back to the original URL below.
    }
  }
  return url;
}

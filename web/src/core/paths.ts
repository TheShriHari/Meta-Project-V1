/**
 * Path and asset resolution utilities for static hosting.
 *
 * NOTE ON LOCAL FILE ACCESS:
 * Local file access via the `file:///` protocol is NOT supported for dynamic `fetch()`
 * calls due to browser CORS and origin restriction policies (e.g. Fetch API cannot load
 * file:///... URLs). Static assets and web applications must be served over HTTP/HTTPS
 * (e.g., via `vite`, `vite preview`, or any local/cloud HTTP static server).
 */

export interface WindowLocationLike {
  pathname?: string;
  origin?: string;
  protocol?: string;
}

/**
 * Pure asset URL resolver supporting:
 * - Root base ('/') -> '/data/...'
 * - Subpath base ('/hpsim/' or '/hpsim') -> '/hpsim/data/...'
 * - Relative base ('./' or '') -> './data/...'
 * - Mitigation of GitHub Pages trailing-slash drops:
 *   When hosted at a subpath repository URL like `https://<user>.github.io/hpsim`
 *   (where location pathname is `/hpsim` without trailing slash),
 *   relative URLs would otherwise resolve against `/`, breaking asset fetches.
 *   This detects the trailing-slash drop and prepends the repository subpath.
 *
 * @param relPath Relative path to asset (e.g. 'data/micrographs/aluminium.json')
 * @param baseUrl Base URL (e.g. '/', '/hpsim/', './'). Defaults to import.meta.env.BASE_URL if available.
 * @param winLoc Location-like object (defaults to globalThis.location if running in browser)
 */
export function resolveAssetUrl(
  relPath: string,
  baseUrl?: string,
  winLoc?: WindowLocationLike
): string {
  const cleanRel = relPath.replace(/^\/+/, "");

  let effectiveBase = baseUrl;
  if (effectiveBase === undefined) {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      typeof import.meta.env.BASE_URL === "string"
    ) {
      effectiveBase = import.meta.env.BASE_URL;
    } else {
      effectiveBase = "./";
    }
  }

  // Handle absolute base path (e.g. '/' or '/hpsim/' or '/subpath')
  if (effectiveBase.startsWith("/")) {
    const normalizedBase = effectiveBase.endsWith("/") ? effectiveBase : `${effectiveBase}/`;
    return `${normalizedBase}${cleanRel}`;
  }

  // Handle relative base (e.g. './' or '')
  // Mitigate trailing-slash drops on GitHub Pages (e.g. https://<user>.github.io/hpsim)
  const loc: WindowLocationLike | undefined =
    winLoc !== undefined
      ? winLoc
      : typeof globalThis !== "undefined" && "location" in globalThis
      ? (globalThis as unknown as { location?: WindowLocationLike }).location
      : undefined;

  if (loc && loc.pathname) {
    const pathname = loc.pathname;
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";
    const isFile = lastSegment.includes(".");

    if (!pathname.endsWith("/") && !isFile && lastSegment.length > 0) {
      // Missing trailing slash on directory/subpath e.g. '/hpsim'
      const prefix = pathname.startsWith("/") ? pathname : `/${pathname}`;
      return `${prefix}/${cleanRel}`;
    }
  }

  if (effectiveBase === "" || effectiveBase === "./") {
    return `./${cleanRel}`;
  }

  const normalized = effectiveBase.endsWith("/") ? effectiveBase : `${effectiveBase}/`;
  return `${normalized}${cleanRel}`;
}

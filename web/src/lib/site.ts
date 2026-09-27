/**
 * Where the site is served from. On GitHub Pages it lives under /<repo>, so plain asset paths (images, scripts,
 * icons) need that prefix; next/link adds it by itself. Set by next.config.ts from the Pages build.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** A path under the site, e.g. asset("/blazyy.png") → "/BlazeResolver/blazyy.png" on Pages. */
export const asset = (path: string) => `${basePath}${path}`;

/** The public URL, for links that must be absolute (llms.txt). Relative to the site when unknown. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || basePath;

/**
 * Where the site's own widget files reports. GitHub Pages has no server, so the /api/blaze route isn't there:
 * a Pages build shows the widget only when NEXT_PUBLIC_BLAZE_ENDPOINT points at an endpoint hosted elsewhere.
 */
export const widgetEndpoint =
  process.env.NEXT_PUBLIC_BLAZE_ENDPOINT || (process.env.NEXT_PUBLIC_STATIC_EXPORT === "true" ? undefined : "/api/blaze");

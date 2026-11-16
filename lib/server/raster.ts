import "server-only";

/**
 * Rasterize an SVG string to a PNG buffer at a target pixel width, using resvg
 * (a native SVG renderer — no headless browser). Dynamically imported and fully
 * guarded: on ANY failure (the native binary missing on this runtime, a render
 * error) it returns null, so a chart can never break the email — the brief just
 * sends without the image.
 */
export async function svgToPng(svg: string, width: number): Promise<Buffer | null> {
  try {
    const { Resvg } = await import("@resvg/resvg-js");
    const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
    return Buffer.from(png);
  } catch {
    return null;
  }
}

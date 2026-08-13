// ─── Browser-side image preparation ──────────────────────────────────────────
//
// Used before sending a proof file to the AI analyze route. Runs in the
// browser only (it needs createImageBitmap and canvas) — import it from client
// components.
//
// Downscaling here does three jobs at once: it keeps the request body under
// the ~4.5 MB limit serverless hosts apply, it cuts the per-image token cost
// on the model, and it keeps the upload quick on a phone connection. A phone
// screenshot at 1600px on the long edge is still comfortably legible for
// reading chat text.

/** Formats we can decode in-browser and the model can read. */
export const ANALYZABLE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function isAnalyzableFile(file: File): boolean {
  return ANALYZABLE_TYPES.includes(file.type);
}

export interface PreparedImage {
  /** A `data:image/jpeg;base64,...` URL ready to post to the analyze route. */
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate encoded size in bytes, for sanity checks and messaging. */
  bytes: number;
}

/**
 * Decode, downscale to `maxEdge` on the long side, and re-encode as JPEG.
 *
 * Quality is deliberately high (0.92): these images are mostly small text in
 * chat threads, and JPEG artefacts at lower settings start eating the
 * characters we are asking the model to read.
 */
export async function prepareImageForAnalysis(
  file: File,
  maxEdge = 1600
): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be read in the browser. Try a PNG or JPEG screenshot.");
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the image for analysis.");

    // Screenshots are often PNGs with transparency; flatten onto white so the
    // text does not end up dark-on-black once alpha is dropped by JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

    return { dataUrl, width, height, bytes: Math.round((base64.length * 3) / 4) };
  } finally {
    bitmap.close();
  }
}

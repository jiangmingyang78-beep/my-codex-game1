export const BASE_FONT_SIZE = 16;
export const PIXEL_FONT_FAMILY = '"PixelZH", monospace';
export const PIXEL_FONT_SIZE = `${BASE_FONT_SIZE}px`;

let loading: Promise<boolean> | undefined;

export function loadPixelFont(): Promise<boolean> {
  loading ??= (async () => {
    try {
      const faces = await document.fonts.load(
        `${PIXEL_FONT_SIZE} "PixelZH"`,
        "The remaining forests need a secondary fire +123",
      );
      await document.fonts.ready;
      return faces.length > 0;
    } catch {
      return false;
    }
  })();
  return loading;
}

export async function preloadPixelFont(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      loadPixelFont(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, 3000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

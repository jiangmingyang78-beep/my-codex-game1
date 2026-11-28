import type Phaser from "phaser";

const words = new Intl.Segmenter("en", { granularity: "word" });
const glyphs = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Phaser has already synchronized the canvas font before invoking this callback. */
export function wrapToastText(
  value: string,
  text: Phaser.GameObjects.Text,
): string[] {
  const width = text.style.wordWrapWidth ?? Number.POSITIVE_INFINITY;
  const fits = (line: string) => text.context.measureText(line).width <= width;
  const output: string[] = [];
  for (const paragraph of value.split(/\r\n|[\r\n]/)) {
    let line = "";
    const append = (part: string) => {
      const combined = line + part;
      if (line && !fits(combined)) {
        output.push(line.trimEnd());
        line = part.trimStart();
      } else {
        line = line ? combined : part.trimStart();
      }
    };
    for (const { segment } of words.segment(paragraph)) {
      if (fits(segment)) append(segment);
      else for (const glyph of glyphs.segment(segment)) append(glyph.segment);
    }
    output.push(line.trimEnd());
  }
  return output;
}

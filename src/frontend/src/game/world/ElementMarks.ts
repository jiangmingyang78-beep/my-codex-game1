import type { GameEvent } from "@/core/types";
import { elementMark } from "@/core/vfxBridge";
type Rect = (
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
) => void;
type Mark = NonNullable<ReturnType<typeof elementMark>>;

/** A presentation-only cache updated by events, including the initial replay on load. */
export class ElementMarks {
  private marks = new Map<string, Mark>();
  apply(e: GameEvent) {
    const mark = elementMark(e);
    if (!mark) return false;
    const key = `${mark.x},${mark.y}`;
    if (mark.surface === "clear") this.marks.delete(key);
    else this.marks.set(key, mark);
    return true;
  }
  draw(
    rect: Rect,
    view?: { x: number; y: number; width: number; height: number },
  ) {
    for (const { x, y, surface } of this.marks.values()) {
      if (
        view &&
        (x < view.x - 8 ||
          y < view.y - 8 ||
          x > view.x + view.width + 8 ||
          y > view.y + view.height + 8)
      )
        continue;
      if (surface === "burning") {
        rect(0x664438, x - 5, y + 1, 10, 3);
        rect(0xd77339, x - 3, y - 3, 5, 6);
        rect(0xf5c46c, x, y - 5, 2, 6);
      } else if (surface === "scorched") {
        rect(0x574b48, x - 5, y, 10, 3);
        rect(0xb17b57, x + 1, y, 2, 1);
      } else if (surface === "melted") {
        rect(0x718683, x - 5, y, 10, 3);
        rect(0xa1b5b0, x - 2, y, 3, 1);
      } else {
        rect(0x92b9c4, x - 5, y, 9, 2);
        rect(0xc5e2e8, x - 1, y - 3, 2, 6);
      }
    }
  }
}

type Rect = (color: string, x: number, y: number, w: number, h: number) => void;

export function drawRepairedWell(rect: Rect, x: number, y: number) {
  rect("#483332", x - 7, y - 13, 2, 13);
  rect("#684a39", x + 5, y - 13, 2, 13);
  rect("#b27d51", x - 8, y - 13, 16, 3);
  rect("#dbab6a", x - 7, y - 13, 14, 1);
  rect("#e0c292", x, y - 10, 1, 7);
  rect("#815b45", x - 2, y - 6, 5, 3);
  rect("#afbab0", x - 2, y - 6, 5, 1);
}

export function drawRestMat(rect: Rect, x: number, y: number) {
  rect("#704a4c", x - 8, y + 4, 16, 4);
  rect("#af7062", x - 7, y + 4, 14, 3);
  rect("#e4be90", x - 7, y + 5, 14, 1);
  rect("#dfb382", x - 8, y + 6, 1, 2);
  rect("#dfb382", x + 7, y + 6, 1, 2);
}

export function drawFeedingTrough(rect: Rect, x: number, y: number) {
  rect("#34282f", x + 3, y + 2, 6, 4);
  rect("#af754b", x + 2, y + 1, 7, 2);
  rect("#ce9975", x + 2, y + 3, 7, 1);
  rect("#fae0a2", x + 4, y + 1, 1, 1);
  rect("#ecd094", x + 7, y + 1, 1, 1);
}

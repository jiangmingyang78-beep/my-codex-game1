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

export function drawHearthFixtures(
  rect: Rect,
  x: number,
  y: number,
  built: (id: "windHearth" | "kiln" | "dryingRack" | "stoker") => boolean,
) {
  if (built("windHearth")) {
    for (const [dx, dy] of [
      [-7, -2],
      [-5, -4],
      [0, -5],
      [5, -3],
      [6, 0],
      [1, 2],
      [-4, 2],
    ]) {
      rect("#51494b", x + dx, y + dy, 5, 3);
      rect("#bcad99", x + dx, y + dy, 4, 1);
    }
  }
  if (built("kiln")) {
    rect("#5f4945", x - 20, y - 6, 12, 8);
    rect("#a67454", x - 18, y - 9, 8, 5);
    rect("#b88e71", x - 16, y - 12, 4, 6);
    rect("#302c32", x - 16, y - 3, 5, 5);
  }
  if (built("dryingRack")) {
    rect("#745640", x + 13, y - 10, 2, 13);
    rect("#745640", x + 26, y - 10, 2, 13);
    rect("#c1a079", x + 12, y - 10, 17, 2);
    for (const dx of [16, 20, 24]) {
      rect("#879c68", x + dx, y - 8, 2, 6);
      rect("#b5bd83", x + dx - 1, y - 5, 3, 2);
    }
  }
  if (built("stoker")) {
    rect("#545667", x - 10, y - 7, 6, 8);
    rect("#bc986d", x - 10, y - 7, 6, 2);
    rect("#b38b60", x - 6, y - 3, 5, 2);
  }
}

export function drawStakeRing(
  rect: Rect,
  cx: number,
  cy: number,
  radius: number,
) {
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius);
    rect("#87674e", x - 1, y - 3, 3, 7);
    rect("#d5b38a", x, y - 5, 1, 3);
  }
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

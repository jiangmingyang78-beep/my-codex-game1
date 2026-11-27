interface NativeTreeForm {
  palette: Record<string, string>;
  parts: readonly (readonly [x: number, y: number, pattern: string])[];
}

const NATIVE_TREES: Record<number, NativeTreeForm> = {
  2: {
    palette: {
      a: "#19372e",
      b: "#305042",
      c: "#527953",
      h: "#88a766",
      d: "#443736",
      r: "#936d4e",
      s: "#615044",
    },
    parts: [
      [
        4,
        13,
        "..rr.......... ..sr...r...r.. ...sr.rs..rs.. ....rrs..rs... .....rssrs.... ......srs..... ......rrs..... .....rrsss.... ....rr..ssr... ...rs....srr.. .rrs......ssrr rr..........ss",
      ],
      [
        2,
        10,
        "....hhh..hh........ ..hhccchhccch...... .hcccccccccbbcc.... cccbccccbbbbbbcc... .bbaaabbbaaabbbbcc. .ba...bb....baabbba ..a....a.....b..ba. ..a..........a..a..",
      ],
      [
        3,
        6,
        "....hhcc....... ...hccccch..... .hhcccccbccch.. hccccbbcccbbcc. cbbbabbbbbbbbbb .bb..aab..abbaa. ..a....a....a..",
      ],
      [
        7,
        4,
        "...hhcc.... ..hcccch... .hccccbccc. ccbbccbbbbb .bbabbbaaa. ..a..aa....",
      ],
    ],
  },
  4: {
    palette: {
      a: "#273d4b",
      b: "#3e5c6b",
      c: "#7896a5",
      h: "#e0ecea",
      f: "#aecbd2",
      d: "#49414a",
      r: "#a39180",
    },
    parts: [
      [
        5,
        13,
        ".........r..... ........rd..... ..rr...rd...r.. ...dr..rd..rd.. ....drrdr.rd... .....rddrrd.... ......rddd..... ......rd....... ......rd....... .....rddd...... ....rd..dd.....",
      ],
      [
        2,
        11,
        "...hhh............... ..hffhh......hh...... hhfffcchh...hffhh.... .ccbbccfffhhffcffhh.. ..aaabbccffccbbccffh. ....aaabbccbbbbbccffh .......aabbbaaaabbcch ..........aa.....abbc .................aabc ...................ac",
      ],
      [
        4,
        7,
        "....hh........... ...hffhhh........ ..hffcfffhh...... hhffcbbccffhhh... .ccbbabbccfffhh.. ..aa...abbcccffh. ........aabbbbcc. ...........aaabb.",
      ],
      [
        7,
        3,
        "....hh..... ...hffh.... ..hfcffhh.. .hffcbcffh. hffcbbbcffh .cbbaaabcc. ..aa....ab.",
      ],
    ],
  },
  8: {
    palette: {
      a: "#402b40",
      b: "#654459",
      c: "#97607b",
      h: "#dca399",
      g: "#e9bd9c",
      d: "#4a3443",
      r: "#856477",
      s: "#ad8193",
    },
    parts: [
      [
        5,
        9,
        ".......rs..... ......rsd..... ......rdd..... .....ssrd..... ...hghrrd..... ..hcccgrrd.... ...aaasrdd.... ......srrd.... ......srrdgh.. ......rrdhccch .....rsrrdbbba ....hghrrd.... ..hhcccgrdd... ...aaasrrddd.. .....rrd..ddd.",
      ],
      [
        1,
        11,
        "....hhh..... ...hccghh... ..hcccbccch. .hcbbbcccbch hbbbbbbbbbbb .gaaagaaaga. ..aaaaaaba..",
      ],
      [
        11,
        7,
        "....ghhh.... ...hccgchh.. ..ccbcccbch. hccbbbbbbbcc .ggagaaagga. ..aabbbbaa..",
      ],
      [
        5,
        2,
        ".....ghhh...... ...hhccgchh.... ..hcccchcccch.. .hccbbccccbcch. hcbbbbbbbbbbbc. .gagaggaagagga. ..aaaabbbaaaa..",
      ],
    ],
  },
};

export function createSurvivalTreePainter(
  pixelArt: (
    pattern: string,
    palette: Record<string, string>,
  ) => HTMLCanvasElement,
) {
  const stamps = new Map(
    Object.entries(NATIVE_TREES).map(([id, form]) => [
      Number(id),
      form.parts.map(([x, y, pattern]) => ({
        x,
        y,
        image: pixelArt(pattern, form.palette),
      })),
    ]),
  );

  return function paintNativeTree(
    biomeIndex: number,
    variant: number,
    surfaces: CanvasRenderingContext2D[],
  ): boolean {
    const parts = stamps.get(biomeIndex);
    if (!parts) return false;

    // 根部和三层树冠分别绘制，树冠继续使用现有的风摆位移。
    const mirror = variant % 2 === 1;
    const tall = variant >= 2;
    parts.forEach(({ x, y, image }, band) => {
      const context = surfaces[band];
      const rise = tall && band > 1 ? band - 1 : 0;
      context.save();
      if (mirror) context.transform(-1, 0, 0, 1, context.canvas.width, 0);
      context.drawImage(image, x, y - rise);
      context.restore();
    });
    return true;
  };
}

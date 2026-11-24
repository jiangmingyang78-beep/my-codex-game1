// src/vfx/enemyTextures.js

export const ENEMY_TEXTURE_DEFS = [
  {
    // 1. 雪鼬：白身、暗灰背影、红点眼
    key: "enemy:snow_weasel",
    size: 16,
    anchorX: 8,
    anchorY: 12,
    refine: "pad",
    palette: { o: "#1d2230", w: "#eef4f8", s: "#b8cad8", e: "#d94e4e" },
    pattern: [
      "..oo.....",
      ".owwo....",
      "oewsswooo",
      ".owwwwswo",
      "..oswwwo.",
      "..o.oo.o."
    ].join(" ")
  },
  {
    // 2. 霜毛雪鼠：圆滚小巧、冰蓝毛、粉鼻
    key: "enemy:frost_rat",
    size: 16,
    anchorX: 8,
    anchorY: 12,
    refine: "pad",
    palette: { o: "#1d2230", b: "#cfe3f2", d: "#89a8c4", n: "#e58c9b" },
    pattern: [
      ".oo..oo.",
      "obboobbo",
      "onbbbbdo",
      ".obddbo.",
      "..o..o.."
    ].join(" ")
  },
  {
    // 3. 灰烬恶狼：修长狼形、炭灰毛、橙红凶眼
    key: "enemy:ash_wolf",
    size: 16,
    anchorX: 8,
    anchorY: 13,
    refine: "pad",
    palette: { o: "#181a24", g: "#5c6473", d: "#393f4d", e: "#ff6b35", t: "#d8dee9" },
    pattern: [
      ".o.o.......",
      "oggdo......",
      "oegddoooo..",
      "otgggggggo.",
      ".odggdddgo.",
      "..og.o..go.",
      "..o..o..o.."
    ].join(" ")
  },
  {
    // 4. 黑雾山猫：暗紫黑影、幽绿双眼、翘尾
    key: "enemy:shadow_lynx",
    size: 16,
    anchorX: 8,
    anchorY: 13,
    refine: "pad",
    palette: { o: "#12131c", p: "#2f2942", m: "#4b3f6b", e: "#6bffb8" },
    pattern: [
      ".o.o....oo",
      "opmpo....o",
      "oepmpooo.o",
      ".opmmpppo.",
      "..oppppo..",
      "..o.oo.o.."
    ].join(" ")
  },
  {
    // 5. 迷雾朽木人：枯木人形、青苔肩、暗黄眼
    key: "enemy:rotted_woodcutter",
    size: 16,
    anchorX: 8,
    anchorY: 14,
    refine: "pad",
    palette: { o: "#1c1816", w: "#6b4c3b", d: "#473126", m: "#4e7a57", e: "#e6c25a" },
    pattern: [
      "..oooooo..",
      ".owwwwwwo.",
      ".owewwweo.",
      "omwwwwwwmo",
      "odwwddwwdo",
      ".odwwwwdo.",
      "..odwwdo..",
      "..od..do..",
      "..oo..oo.."
    ].join(" ")
  },
  {
    // 6. 余烬焦尸：焦黑躯干、胸口与眼部透出炽热裂纹
    key: "enemy:cinder_husk",
    size: 16,
    anchorX: 8,
    anchorY: 14,
    refine: "pad",
    palette: { o: "#141217", c: "#363038", d: "#241f26", f: "#ff7a2f", y: "#ffd166" },
    pattern: [
      "..oooooo..",
      ".occcccco.",
      ".ocfccfco.",
      ".ooccccoo.",
      "occffyffco",
      "odccffccdo",
      ".odccccdo.",
      "..od..do..",
      "..oo..oo.."
    ].join(" ")
  },
  {
    // 7. 霜甲卫兵：宽肩厚重铁甲、冰蓝棱边、手持盾/刃轮廓
    key: "enemy:frozen_guard",
    size: 16,
    anchorX: 8,
    anchorY: 14,
    refine: "pad",
    palette: { o: "#161b26", a: "#7f96ad", h: "#b8d4ea", d: "#495b70", e: "#66e3ff" },
    pattern: [
      "...oooooo...",
      "..oahhhhao..",
      "..oaehheao..",
      ".ooaaaaaaoo.",
      "oahaaaaaaaho",
      "oadaaaddaaao",
      "oadaaaaaad.o",
      ".oodaaaaao..",
      "..odd..ddo..",
      "..ooo..ooo.."
    ].join(" ")
  },
  {
    // 8. 寒鸦投掷者：展翼黑鸦、冰蓝喙爪、白眼
    key: "enemy:frost_crow",
    size: 16,
    anchorX: 8,
    anchorY: 12,
    refine: "pad",
    palette: { o: "#11131a", k: "#2b3040", b: "#58708c", e: "#eaf6ff", y: "#9ad1f5" },
    pattern: [
      "...oooo...",
      "..okekko..",
      "oookbkkkoo",
      "okbkkkkbko",
      ".ookbbkoo.",
      "...oyyo..."
    ].join(" ")
  },
  {
    // 9. 冻沼毒孢怪：蘑菇/囊泡状、暗绿菌盖、荧光毒斑
    key: "enemy:bog_spitter",
    size: 16,
    anchorX: 8,
    anchorY: 13,
    refine: "pad",
    palette: { o: "#151f1b", g: "#3a6b54", p: "#8be055", d: "#264738", s: "#758c7e" },
    pattern: [
      "..oooooo..",
      ".oggpgggo.",
      "ogpggggpgo",
      "oddddddddo",
      "..osssso..",
      ".oossssoo.",
      "..oo..oo.."
    ].join(" ")
  },
  {
    // 10. 游离鬼火灵：悬浮火焰水滴状、青蓝外焰、白热核心
    key: "enemy:ember_wisp",
    size: 16,
    anchorX: 8,
    anchorY: 12,
    refine: "pad",
    palette: { o: "#132230", b: "#3298db", c: "#7ce8ff", w: "#f0fcff", e: "#142638" },
    pattern: [
      "....o....",
      "...obo...",
      "..obcbo..",
      ".obcwcbo.",
      ".oceweco.",
      ".obcwcbo.",
      "..obcbo..",
      "...obo...",
      "....o...."
    ].join(" ")
  },
  {
    // 11. 旧磨坊督工（炉印守卫）：魁梧铁面、胸嵌炉印红光
    key: "enemy:mill_overseer",
    size: 16,
    anchorX: 8,
    anchorY: 15,
    refine: "pad",
    palette: { o: "#14131a", m: "#595e6b", l: "#8c93a3", d: "#363942", r: "#ff4d2e", g: "#ffbe55" },
    pattern: [
      "...oooooooo...",
      "..omllllllmo..",
      "..omrllllrmo..",
      ".oommmmmmmmoo.",
      "omlmmrggrmmlmo",
      "odmmmrggrmmmdo",
      "odmmmmrrmmmmdo",
      ".odmmmmmmmmdo.",
      "..odmddddmdo..",
      "..oddo..oddo..",
      "..oooo..oooo.."
    ].join(" ")
  },
  {
    // 12. 霜渊守炬者（最终守卫）：冠冕角盔、冰霜巨甲、胸口圣火核心
    key: "enemy:summit_pyre_warden",
    size: 16,
    anchorX: 8,
    anchorY: 15,
    refine: "pad",
    palette: { o: "#121521", i: "#8fb8de", h: "#d8f0ff", d: "#3d506b", f: "#ff6a1a", y: "#ffe07d" },
    pattern: [
      ".oo..oooo..oo.",
      "ohhoihhhiohhoo",
      ".ooiifhfiioo..",
      "..ooiiiiiiioo.",
      "ohiiiffyfiiiho",
      "odiiiffffiiido",
      "odiiiiffiiiido",
      ".odiiiiiiiiido",
      "..oddiiddiido.",
      "..oddd..dddo..",
      "..oooo..oooo.."
    ].join(" ")
  }
];

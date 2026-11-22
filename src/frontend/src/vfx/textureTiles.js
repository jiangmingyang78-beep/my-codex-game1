import { context2d, setBounded, shiftColor, toHex } from "./vfxPrimitives.js";

const hash = (x,y,s=0) => {
  const v = Math.imul(x+83,374761393)^Math.imul(y+31,668265263)^Math.imul(s+4,1686049);
  return ((v^(v>>>13))>>>0)%997/997;
};

export function createTileTextures(makeCanvas) {
  const texCache=new Map();
  const bayer=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  const px=(g,color,x,y,w=1,h=1)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
  const tone=(color,amt)=>toHex(shiftColor(color,amt));
  function groundTexture(land,detail,floor,variant,worldSeed){
    const key="g|"+land+"|"+detail+"|"+floor+"|"+variant+"|"+worldSeed;
    let c=texCache.get(key);
    if(c)return c;
    c=makeCanvas(16,16);
    const g=context2d(c),lt=[tone(land,.06),tone(land,.12)],dk=[tone(land,-.09),tone(land,-.17)];
    const seed=variant*977+land.charCodeAt(2)*31+land.charCodeAt(4)*7+worldSeed;
    px(g,land,0,0,16,16);
    // Soft mottled lumps, wrapped so neighbouring tiles stay seamless; ordered dither softens the edges.
    for(let p=0;p<3;p++){
      const cx=hash(seed,p,1)*16,cy=hash(seed,p,2)*16,rad=3.4+hash(seed,p,3)*3.2,palette=hash(seed,p,4)>.42?lt:dk;
      for(let y=0;y<16;y++)for(let x=0;x<16;x++){
        let dx=Math.abs(x-cx),dy=Math.abs(y-cy);dx=Math.min(dx,16-dx);dy=Math.min(dy,16-dy);
        const level=1-Math.hypot(dx,dy*1.25)/rad;
        if(level<=0)continue;
        if(level>.62)px(g,palette[1],x,y);
        else if(level>.12+bayer[y&3][x&3]/16*.5)px(g,palette[0],x,y);
      }
    }
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const v=hash(x,y,seed);
      if(v<.045)px(g,lt[0],x,y);else if(v>.955)px(g,dk[0],x,y);
    }
    const bright=tone(detail,.22);
    if(floor===3){
      for(let i=0;i<3;i++){
        const x=1+Math.floor(hash(seed,i,5)*12),y=2+Math.floor(hash(seed,i,6)*11),w=1+(hash(seed,i,7)>.5?1:0);
        px(g,dk[1],x,y+1,w+1,1);px(g,detail,x,y,w+1,1);px(g,bright,x,y,1,1);
      }
      if(hash(seed,9,9)>.45){const x=3+Math.floor(hash(seed,9,1)*8),y=4+Math.floor(hash(seed,9,2)*8);px(g,dk[1],x,y,4,1);px(g,dk[0],x+3,y+1,2,1);}
    }else if(floor===4){
      for(let i=0;i<3;i++){
        const x=1+Math.floor(hash(seed,i,5)*11),y=2+Math.floor(hash(seed,i,6)*12);
        px(g,detail,x,y,3,1);px(g,bright,x,y,1,1);px(g,dk[0],x+1,y+1,2,1);
      }
    }else{
      for(let i=0;i<3;i++){
        const x=1+Math.floor(hash(seed,i,5)*13),y=3+Math.floor(hash(seed,i,6)*11);
        px(g,dk[0],x,y+1,1,1);px(g,detail,x,y-1,1,2);px(g,bright,x,y-1,1,1);
        if(i===0){px(g,detail,x+2,y,1,1);px(g,bright,x+2,y-1,1,1);}
      }
    }
    return setBounded(texCache,key,c);
  }
  // Four-frame looping water; waves are periodic over 16px so tiles join seamlessly.
  function waterTexture(variant,frame){
    const key="w|"+variant+"|"+frame;
    let c=texCache.get(key);
    if(c)return c;
    c=makeCanvas(16,16);
    const g=context2d(c),ph=frame*Math.PI/2;
    const ramp=["#0f2f46","#143a53","#1b4a66","#26617d","#3b809a","#8fcfdc"];
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const wave=Math.sin(x*.7854+y*.3927+ph)+.8*Math.sin(-x*.3927+y*1.1781+ph*2+1.3);
      const t=wave+(bayer[y&3][x&3]/16-.5)*.55;
      let i=t>1.3?4:t>.55?3:t>-.25?2:t>-1.05?1:0;
      px(g,ramp[i],x,y);
    }
    for(let i=0;i<2;i++){
      const x=Math.floor(hash(variant,i,frame+3)*14),y=Math.floor(hash(variant,i,frame+9)*14);
      if(hash(variant,i,frame)>.45)px(g,ramp[5],x,y);
    }
    return setBounded(texCache,key,c);
  }
  function tuftSprite(color,lean){
    const key="t|"+color+"|"+lean;
    let c=texCache.get(key);
    if(c)return c;
    c=makeCanvas(13,9);
    const g=context2d(c),ramp=[tone(color,-.2),color,tone(color,.2),tone(color,.42)];
    const blades=[[3,4],[5,6],[7,5],[9,4]];
    for(const [bx,h] of blades){
      for(let r=0;r<h;r++){
        const shift=Math.round(lean*(r/h)*1.15);
        px(g,ramp[r<1?0:r<h-2?1:r<h-1?2:3],bx+shift,8-r);
      }
    }
    return setBounded(texCache,key,c);
  }

  const treePalettes=[
    ["#1b3a2c","#27503a","#386a45","#52874f","#7da35e"],
    ["#0f2a2a","#163a32","#1f4a3a","#2e6044","#4a7e52"],
    ["#18312e","#25453a","#35604a","#4b7a52","#6d9560"],
    ["#2a3126","#3b4430","#505a39","#6b7547","#8a9558"],
    ["#16303a","#214550","#2f5e66","#477a7c","#6f9c98"],
    ["#0f2b2c","#173d3c","#245250","#356b64","#4f857a"],
    ["#3a3326","#524a30","#6e6438","#8c8044","#aa9c55"],
    ["#1f4030","#2c5a3c","#3f7545","#5c9250","#86b061"],
    ["#2e2038","#43304f","#5e4570","#82608f","#a5768e"]
  ];
  const TREE_OX=5,TREE_OY=9;
  function paintCanopy(g,shape,cx,cy,rx,ry,ramp,seed,biomeIdx){
    cx+=TREE_OX;cy+=TREE_OY;
    for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++)for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){
      let dx,dy,d;
      if(shape==="tri"){
        const v=(y+.5-(cy-ry))/(2*ry);
        if(v<0||v>1)continue;
        const half=Math.max(.8,rx*(.12+v*.88));
        dx=(x+.5-cx)/half;dy=(y+.5-cy)/ry;
        const lump=1+.08*Math.sin(y*2.3+seed);
        d=Math.max(Math.abs(dx),Math.abs(dy)*.96)/lump;
      }else{
        dx=(x+.5-cx)/rx;dy=(y+.5-cy)/ry;
        const ang=Math.atan2(dy,dx),lump=1+.13*Math.sin(ang*3+seed)+.08*Math.sin(ang*5+seed*2.3);
        d=Math.hypot(dx,dy)/lump;
      }
      if(d>1)continue;
      const lit=-dx*.5-dy*.78;
      let t=.5+lit*.52-d*d*.28+(hash(x,y,seed|0)-.5)*.2+(bayer[y&3][x&3]/16-.5)*.15;
      let idx=Math.max(0,Math.min(4,Math.floor(t*5)));
      if(d>.86&&lit<.12)idx=Math.min(idx,0);else if(d>.9)idx=Math.min(idx,1);
      let color=ramp[idx];
      if(biomeIdx===4&&lit>.22&&d<.9&&hash(x,y,seed+5)>.25)color=lit>.5?"#e6f1f2":"#b4cdd2";
      else if(biomeIdx===8&&idx>=3&&hash(x,y,seed+9)>.93)color="#e2b3b0";
      else if(biomeIdx===7&&idx>=2&&hash(x,y,seed+11)>.95)color=hash(x,y,seed+2)>.5?"#f0a6b8":"#f4d27a";
      px(g,color,x,y);
    }
    // clustered leaf highlights
    const n=shape==="tri"?4:6;
    for(let k=0;k<n;k++){
      const a=hash(seed,k,3)*6.283,r=hash(seed,k,4)*.55,hx=Math.round(cx+Math.cos(a)*rx*r-rx*.15),hy=Math.round(cy+Math.sin(a)*ry*r-ry*.25);
      if(biomeIdx===4)continue;
      px(g,ramp[4],hx,hy,2,1);px(g,ramp[3],hx-1,hy+1,2,1);
    }
  }
  function treeSprite(biomeIdx,variant){
    const key="tr|"+biomeIdx+"|"+variant;
    let s=texCache.get(key);
    if(s)return s;
    const W=26,H=30,ramp=treePalettes[biomeIdx]??treePalettes[1],seed=variant*13+biomeIdx*101;
    const trunk=makeCanvas(W,H),g0=context2d(trunk);
    g0.fillStyle="rgba(8,24,24,.55)";
    for(let i=0;i<3;i++){g0.fillRect(TREE_OX+3+i,TREE_OY+11+i,10-i*2,1);}
    g0.fillRect(TREE_OX+2,TREE_OY+12,12,2);
    const bark=["#2b1f22","#4a3629","#684e3d","#85654a"];
    px(g0,bark[2],TREE_OX+7,TREE_OY+7,3,7);px(g0,bark[3],TREE_OX+7,TREE_OY+7,1,6);px(g0,bark[1],TREE_OX+9,TREE_OY+7,1,7);
    px(g0,bark[0],TREE_OX+6,TREE_OY+14,5,1);px(g0,bark[1],TREE_OX+6,TREE_OY+13,1,1);px(g0,bark[1],TREE_OX+10,TREE_OY+13,1,1);
    px(g0,bark[0],TREE_OX+8,TREE_OY+9,1,1);
    const layers=[makeCanvas(W,H),makeCanvas(W,H),makeCanvas(W,H)],gs=layers.map(layer=>context2d(layer));
    const jitter=(variant%2?.4:-.4);
    if(biomeIdx===5){
      paintCanopy(gs[0],"tri",8,8.5+jitter,7.4,4.6,ramp,seed+1,biomeIdx);
      paintCanopy(gs[1],"tri",8,3.5,5.8,4.4,ramp,seed+2,biomeIdx);
      paintCanopy(gs[2],"tri",8,-2,3.8,4,ramp,seed+3,biomeIdx);
    }else{
      paintCanopy(gs[0],"ell",8,8.2+jitter,7.7,4.8,ramp,seed+1,biomeIdx);
      paintCanopy(gs[1],"ell",8+jitter,3.8,6.6,4.6,ramp,seed+2,biomeIdx);
      paintCanopy(gs[2],"ell",8.2,-.2,4.9,3.8,ramp,seed+3,biomeIdx);
    }
    return setBounded(texCache,key,{trunk,layers,anchorX:TREE_OX,anchorY:TREE_OY});
  }

  function edgeDither(color,side){
    const key="e|"+color+"|"+side;
    let c=texCache.get(key);
    if(c)return c;
    c=makeCanvas(16,16);
    const g=context2d(c);
    for(let d=0;d<3;d++)for(let a=0;a<16;a++){
      const on=d===0?((a+d)&1)===0||hash(a,side,d)>.7:d===1?((a&1)===0&&hash(a,side,d)>.45):hash(a,side,d+4)>.9;
      if(!on)continue;
      const x=side===1?15-d:side===3?d:a,y=side===0?d:side===2?15-d:a;
      px(g,color,x,y);
    }
    return setBounded(texCache,key,c);
  }
  return {groundTexture,waterTexture,tuftSprite,treeSprite,edgeDither,clear:()=>texCache.clear()};
}

import { context2d, createBrowserCanvas, mixColor, parseColor, radialCanvas, setBounded, shiftColor, toHex } from "./vfxPrimitives.js";
import { createTileTextures } from "./textureTiles.js";

// Pixel shading, edge highlights and optional one-pixel outlines are ported from Emberwood.
function gradeColor(v){
  const lum=(v[0]*.3+v[1]*.59+v[2]*.11),k=lum/255;
  let c=mixColor(v,[lum,lum,lum],.07);
  c=mixColor(c,[34,30,58],(1-k)*.12);
  return mixColor(c,[255,228,184],k*k*.06);
}
function refineSprite(painter,width,height,outlineMap){
  const data=painter.getImageData(0,0,width,height),px=data.data;
  const solid=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&px[(y*width+x)*4+3]>0&&!outlineMap[y*width+x];
  const out=new Uint8ClampedArray(px);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(!px[i+3])continue;
    if(outlineMap[y*width+x]){
      // Selective outline: a dark shade of the neighbouring body colour.
      let r=0,g=0,b=0,n=0;
      for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
        if(solid(x+dx,y+dy)){const j=((y+dy)*width+x+dx)*4;r+=px[j];g+=px[j+1];b+=px[j+2];n++;}
      }
      const ink=[30,29,46],col=n?mixColor(shiftColor([r/n,g/n,b/n],-.66),ink,.4):ink;
      out[i]=col[0];out[i+1]=col[1];out[i+2]=col[2];continue;
    }
    const up=!solid(x,y-1),down=!solid(x,y+1),left=!solid(x-1,y),right=!solid(x+1,y);
    let amt=(.5-y/height)*.1;
    if(up)amt+=down?.04:.15;
    if(left&&!right)amt+=.06;
    if(down&&!up)amt-=.17;
    if(right&&!left)amt-=.08;
    amt=Math.max(-.3,Math.min(.26,Math.round(amt/.07)*.07));
    const col=gradeColor(amt?shiftColor([px[i],px[i+1],px[i+2]],amt):[px[i],px[i+1],px[i+2]]);
    out[i]=col[0];out[i+1]=col[1];out[i+2]=col[2];
  }
  data.data.set(out);painter.putImageData(data,0,0);
}
// refine: true = shade + selective outline from "o" cells, "pad" = also add a 1px outline ring.
function pixelArt(makeCanvas,{pattern,palette,anchorX=0,anchorY=0,size=0,refine=true}){
  if(typeof pattern!=="string"||!pattern.trim()||!palette)throw new TypeError("A non-empty pattern and palette are required.");
  if(refine!==true&&refine!==false&&refine!=="pad")throw new TypeError("refine must be true, false or pad.");
  if(!Number.isInteger(size)||size<0||!Number.isFinite(anchorX)||!Number.isFinite(anchorY))throw new RangeError("Invalid sprite size or anchor.");
  const rows=pattern.trim().split(/\s+/);
  const width=Math.max(...rows.map(row=>row.length));
  const pad=refine==="pad"?1:0;
  if(size&&(size<width||size<rows.length))throw new RangeError("Sprite size is smaller than its pattern.");
  const image=makeCanvas((size||width)+pad*2,(size||rows.length)+pad*2);
  const painter=context2d(image,{willReadFrequently:Boolean(refine)});
  const offsetX=Math.floor((image.width-width)/2);
  const offsetY=Math.floor((image.height-rows.length)/2);
  const outlineMap=new Uint8Array(image.width*image.height);
  rows.forEach((row,y)=>{
    for(let x=0;x<row.length;x++){
      if(row[x]===".")continue;
      const color=palette[row[x]];
      if(typeof color!=="string"||!color)throw new TypeError("Missing sprite palette color: "+row[x]);
      painter.fillStyle=color;
      painter.fillRect(x+offsetX,y+offsetY,1,1);
      if(row[x]==="o")outlineMap[(y+offsetY)*image.width+x+offsetX]=1;
    }
  });
  if(pad){
    const solidPx=painter.getImageData(0,0,image.width,image.height).data;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
      if(solidPx[(y*image.width+x)*4+3])continue;
      let near=false;
      for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]]){
        const nx=x+dx,ny=y+dy;
        if(nx>=0&&ny>=0&&nx<image.width&&ny<image.height&&solidPx[(ny*image.width+nx)*4+3])near=true;
      }
      if(near){painter.fillStyle="#1e1d2e";painter.fillRect(x,y,1,1);outlineMap[y*image.width+x]=1;}
    }
  }
  if(refine)refineSprite(painter,image.width,image.height,outlineMap);
  return {canvas:image,anchorX:anchorX+pad,anchorY:anchorY+pad};
}

const asArt=canvas=>({canvas,anchorX:0,anchorY:0});
const frameIndex=(index,count)=>((Math.trunc(index)%count)+count)%count;
const px=(g,color,x,y,w=1,h=1)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
const tone=(color,amount)=>toHex(shiftColor(color,amount));
const haloStops=[[0,1],[.12,.84],[.28,.58],[.46,.34],[.64,.17],[.82,.06],[1,0]];

export function createTextureGenerator({createCanvas:makeCanvas=createBrowserCanvas}={}) {
  const tiles=createTileTextures(makeCanvas);
  const sprites=new Map(),frames=new Map(),halos=new Map();
  function flameFrame(color,scale,frame){
    const key="f|"+color+"|"+scale+"|"+frame;
    const cached=frames.get(key);
    if(cached)return cached;
    const s=scale,W=Math.ceil(18*s),H=Math.ceil(24*s),ox=W>>1,oy=Math.ceil(17*s);
    const c=makeCanvas(W,H);
    const g=context2d(c),rim=tone(color,-.3),mid=tone(color,.3);
    const rows=Math.round((11+[0,1.4,2.2,1.2,.2,-.8][frame])*s);
    for(let r=0;r<rows;r++){
      const t=r/rows,half=Math.max(.7,3.5*s*Math.pow(1-t,.72)),shift=Math.round(Math.sin(frame*1.0472+t*3.2)*t*1.8*s);
      const y=oy+Math.round(4*s)-r-1,x=ox+shift;
      px(g,rim,Math.round(x-half),y,Math.round(half*2),1);
      if(half>1.6)px(g,color,Math.round(x-half+1),y,Math.round(half*2-2),1);
      if(t<.8&&half>1.9)px(g,mid,Math.round(x-half*.55),y,Math.round(half*1.1),1);
      if(t<.5&&half>2.2)px(g,"#fff0b7",Math.round(x-half*.28),y,Math.max(1,Math.round(half*.56)),1);
    }
    return setBounded(frames,key,{canvas:c,anchorX:ox,anchorY:oy},96);
  }

  // Supply key for a named sprite. Changing the pixel data requires a new key.
  function generate(options){
    const {key,pattern,palette,size=0,anchorX=0,anchorY=0,refine=true}=options;
    if(key===undefined)return pixelArt(makeCanvas,options);
    if(typeof key!=="string"||!key)throw new TypeError("Texture key must be a non-empty string.");
    const signature=JSON.stringify([pattern,palette,size,anchorX,anchorY,refine]);
    const cached=sprites.get(key);
    if(cached){
      if(cached.signature!==signature)throw new Error("Texture key already refers to another sprite: "+key);
      return cached.art;
    }
    const art=pixelArt(makeCanvas,options);
    sprites.set(key,{signature,art});
    return art;
  }

  return {
    generate,
    ground:({land,detail,floor=1,variant=0,seed=0})=>asArt(tiles.groundTexture(toHex(parseColor(land)),toHex(parseColor(detail)),floor,variant,seed|0)),
    water:({variant=0,frame=0}={})=>asArt(tiles.waterTexture(variant,frameIndex(frame,4))),
    tuft:({color,lean=0})=>asArt(tiles.tuftSprite(toHex(parseColor(color)),Math.max(-3,Math.min(3,Math.round(lean))))),
    tree:({biomeIndex=1,variant=0}={})=>tiles.treeSprite(biomeIndex,variant),
    edge:({color,side})=>asArt(tiles.edgeDither(toHex(parseColor(color)),frameIndex(side,4))),
    flame({color="#f49a59",scale=1,frame=0}={}){
      if(!Number.isFinite(scale)||scale<=0)throw new RangeError("Flame scale must be positive.");
      return flameFrame(toHex(parseColor(color)),scale,frameIndex(frame,6));
    },
    halo(color="#ffaa4b"){
      const rgb=parseColor(color);
      const key=rgb.map(channel=>Math.round(channel/6)).join(",");
      return halos.get(key)??setBounded(halos,key,radialCanvas(makeCanvas,rgb,128,haloStops),90);
    },
    clear(){sprites.clear();frames.clear();halos.clear();tiles.clear();}
  };
}

export function registerCanvasTexture(scene,key,{canvas,anchorX=0,anchorY=0}){
  if(typeof key!=="string"||!key)throw new TypeError("Texture key must be a non-empty string.");
  const manager=scene.textures;
  const texture=manager.exists(key)?manager.get(key):manager.addCanvas(key,canvas);
  if(!texture||texture.getSourceImage()!==canvas)throw new Error("Phaser texture key is already in use: "+key);
  const originX=anchorX/canvas.width,originY=anchorY/canvas.height;
  return {key,texture,originX,originY};
}

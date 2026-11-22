import { easeOut, lerp } from "./vfxPrimitives.js";
import { PT } from "./particlePresets.js";

const rectFor=ctx=>(color,x,y,w,h)=>{
  ctx.fillStyle=color;
  ctx.fillRect(Math.round(x),Math.round(y),w,h);
};

function particleAlpha(p){
  const t=p.life/p.dur,a=Math.min(1,t*3.2)*Math.min(1,(1-t)*12+.1);
  return a*a*(3-2*a);
}
export function drawParticles(ctx,particles){
  const rect=rectFor(ctx);
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  for(const p of particles){
    const t=1-p.life/p.dur,a=particleAlpha(p),y=p.y-p.z;
    if(a<=.02)continue;
    const s=lerp(p.s0,p.s1,easeOut(t)),ci=Math.min(7,(t*8)|0),color=p.ramp[ci],size=Math.max(1,Math.round(s));
    ctx.globalAlpha=a;
    switch(p.type){
      case PT.chip:
        rect(color,p.x,y,size,size);break;
      case PT.debris:
        if(p.z>1){ctx.globalAlpha=a*.35;rect("#0c1218",p.x,p.y+1,size,1);ctx.globalAlpha=a;}
        rect(p.ramp[0],p.x,y,size,size);
        if(size>1){ctx.globalAlpha=a*.55;rect("#fff0d6",p.x,y,1,1);}
        break;
      case PT.streak:{
        const tx=p.x-p.dx*.04,ty=y-(p.dy-p.dz)*.04;
        ctx.globalAlpha=a*.3;rect(color,lerp(tx,p.x,.15),lerp(ty,y,.15),1,1);
        ctx.globalAlpha=a*.6;rect(color,lerp(tx,p.x,.55),lerp(ty,y,.55),1,1);
        ctx.globalAlpha=a;rect(color,p.x,y,size,1);
        break;}
      case PT.star:{
        const arm=size>2?2:1;
        rect(color,p.x-arm,y,arm*2+1,1);rect(color,p.x,y-arm,1,arm*2+1);
        if(t<.5){ctx.globalAlpha=a*.9;rect("#ffffff",p.x,y,1,1);}
        break;}
      case PT.smoke:case PT.puff:{
        ctx.globalAlpha=a*(p.type===PT.smoke?.5:.38);
        const r=s*1.4;ctx.drawImage(p.gs,Math.round(p.x-r),Math.round(y-r),Math.round(r*2),Math.round(r*2));
        break;}
      case PT.leaf:case PT.petal:{
        const f=(p.rot|0)&3;
        if(f===0){rect(color,p.x,y,2,1);rect(p.ramp[5],p.x+1,y+1,1,1);}
        else if(f===1){rect(color,p.x,y,1,2);rect(p.ramp[5],p.x+1,y,1,1);}
        else if(f===2){rect(p.ramp[5],p.x,y,2,1);rect(color,p.x,y+1,1,1);}
        else{rect(color,p.x,y,1,1);rect(color,p.x+1,y+1,1,1);rect(p.ramp[5],p.x+1,y,1,1);}
        break;}
      case PT.ember:{
        const flick=.65+.35*Math.sin(p.life*38+p.seed);
        ctx.globalAlpha=a*flick;rect(color,p.x,y,size,size);
        ctx.globalAlpha=a*.35*flick;rect(color,p.x-p.dx*.05,y+p.dz*.05,1,1);rect(color,p.x-p.dx*.1,y+p.dz*.1,1,1);
        break;}
      case PT.ripple:{
        const r=Math.max(1,s);
        for(let k=0;k<14;k++){
          const ang=k*0.4488;
          rect(color,p.x+Math.cos(ang)*r,p.y+Math.sin(ang)*r*.5,1,1);
        }
        break;}
      case PT.flake:
        ctx.globalAlpha=a*(.6+.4*Math.sin(p.life*5+p.seed));rect(color,p.x,y,size,size);break;
      case PT.fly:
        if(Math.sin((p.dur-p.life)*3+p.seed)>-.2)rect("#fff7b8",p.x,y,1,1);
        break;
      case PT.spore:
        rect(color,p.x,y,1,1);break;
      default:break;
    }
  }
  ctx.restore();
}
export function drawParticleGlows(ctx,particles){
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.globalCompositeOperation="lighter";
  for(const p of particles){
    if(!p.glow||!p.gs)continue;
    const t=1-p.life/p.dur,a=particleAlpha(p);
    if(a<=.02)continue;
    let r=Math.max(2.5,lerp(p.s0,p.s1,easeOut(t))*2.6),k=p.glow;
    if(p.type===PT.fly||p.type===PT.spore){k*=.55+.45*Math.sin((p.dur-p.life)*3.2+p.seed);r=5;}
    else if(p.type===PT.ember)k*=.6+.4*Math.sin(p.life*38+p.seed);
    else if(p.type===PT.star&&p.s0>3)r=p.s0*2.4*(1-t*.4);
    ctx.globalAlpha=a*k*.8;
    ctx.drawImage(p.gs,Math.round(p.x-r),Math.round(p.y-p.z-r),Math.round(r*2),Math.round(r*2));
  }
  ctx.restore();
}

export function drawImpactRings(ctx,impactRings){
  const rect=rectFor(ctx);
  ctx.save();
  for(const ring of impactRings){
    const k=ring.age/.28,fade=1-k,radius=4+easeOut(k)*(11+ring.power*17);
    for(let pass=0;pass<2;pass++){
      const r=radius-pass*3.5;
      if(r<2)continue;
      ctx.globalAlpha=(pass?.45:1)*fade*fade;
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8+pass*.2,edge=r+i%2*1.4;
        const x=ring.x+Math.cos(a)*edge,y=ring.y+Math.sin(a)*edge*.72;
        rect(ring.color,x,y,i%2||pass?1:2,1+(i%4===0&&!pass));
        if(ring.age<.05&&i%4===0)rect("#fff3cd",x,y,1,1);
      }
    }
  }
  ctx.restore();
}

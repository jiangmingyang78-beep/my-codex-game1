import { createBrowserCanvas, easeOut, mixColor, parseColor, radialCanvas, setBounded } from "./vfxPrimitives.js";
import { createParticlePresets, PT } from "./particlePresets.js";

const glowStops=[[0,1],[.14,.72],[.38,.3],[.68,.08],[1,0]];
const softStops=[[0,.9],[.45,.5],[.8,.14],[1,0]];
export const impactPresets=Object.freeze({
  strike: {power:.47,color:"#ffe1a3"}, finisher: {power:.67,color:"#ffd18e"},
  boss: {power:.93,color:"#ffd1e0"}, hurt: {power:.72,color:"#ff8581"}
});

export function createParticleSimulation({maxParticles=120,random=Math.random,createCanvas=createBrowserCanvas}={}) {
  if(!Number.isInteger(maxParticles)||maxParticles<1)throw new RangeError("maxParticles must be a positive integer.");
  const particles=[],rings=[],particleFree=[];
  const ramps=new Map(),glowCache=new Map(),softCache=new Map();
  let evictCursor=0,ambientCount=0,ambientAcc=0,tick=0;
  const windAt=(x,y)=>Math.sin(tick*1.1+x*.012+y*.009)*.55+Math.sin(tick*.37+x*.004)*.45;

  function colorRamp(start,end){
    const key=start+'|'+end;
    const cached=ramps.get(key);
    if(cached)return cached;
    const a=parseColor(start),b=parseColor(end);
    const ramp=Array.from({length:8},(_,index)=>'rgb('+mixColor(a,b,index/7).map(Math.round).join(',')+')');
    return setBounded(ramps,key,ramp);
  }
  const glowSprite=color=>glowCache.get(color)??setBounded(glowCache,color,radialCanvas(createCanvas,color,32,glowStops));
  const softSprite=color=>softCache.get(color)??setBounded(softCache,color,radialCanvas(createCanvas,color,24,softStops));

  function spawn(type,x,y,z,dx,dy,dz,life,c0,c1,s0,s1,grav=0,drag=2,bounce=0,glow=0){
    let p;
    if(particles.length>=maxParticles){
      // Pool is full: recycle whichever of a few candidates is closest to dying.
      evictCursor=(evictCursor+7)%particles.length;
      let best=evictCursor,least=Infinity;
      for(let i=0;i<8;i++){const k=(evictCursor+i)%particles.length;if(particles[k].life<least){least=particles[k].life;best=k;}}
      p=particles[best];if(p.amb)ambientCount--;
    }else{p=particleFree.pop()||{};particles.push(p);}
    p.type=type;p.x=x;p.y=y;p.z=z;p.dx=dx;p.dy=dy;p.dz=dz;p.life=life;p.dur=life;
    p.s0=s0;p.s1=s1;p.grav=grav;p.drag=drag;p.bounce=bounce;p.glow=glow;p.amb=0;
    p.ramp=colorRamp(c0,c1);p.gs=glow>0||type===PT.smoke||type===PT.puff||type===PT.spore?
      (type===PT.smoke||type===PT.puff?softSprite(c0):glowSprite(c0)):null;
    p.seed=random()*6.283;p.rot=random()*4;
    return p;
  }
  const {sparks,ambientParticle}=createParticlePresets({spawn,random});

  function pushParticles(x,y,power,radius){
    for(const p of particles){
      if(p.type===PT.ripple)continue;
      const dx=p.x-x,dy=p.y-p.z-y,d=Math.hypot(dx,dy);
      if(d<radius&&d>.1){
        const f=easeOut(1-d/radius)*power*150;
        p.dx+=dx/d*f;p.dy+=dy/d*f*.7;p.dz+=f*.22;
      }
    }
  }

  function stepParticles(dt,view){
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.life-=dt;
      if(p.life<=0||(p.amb&&view&&(p.x<view.x-80||p.x>view.x+view.width+80||p.y<view.y-90||p.y>view.y+view.height+76))){
        if(p.amb)ambientCount--;
        const tail=particles.pop();
        if(tail!==p)particles[i]=tail;
        particleFree.push(p);continue;
      }
      const age=p.dur-p.life;
      switch(p.type){
        case PT.leaf:case PT.petal:
          p.dx+=(Math.sin(age*4.2+p.seed)*20+windAt(p.x,p.y)*16-p.dx)*Math.min(1,dt*2.4);
          p.dy+=(Math.cos(age*3.1+p.seed)*5-p.dy)*Math.min(1,dt*2);
          p.dz+=(-(p.amb?9:16)-p.dz)*Math.min(1,dt*2.2);
          p.rot+=dt*5;
          break;
        case PT.flake:
          p.dx+=(Math.sin(age*2.2+p.seed)*7+windAt(p.x,p.y)*7-p.dx)*Math.min(1,dt*1.6);
          p.rot+=dt*3;
          break;
        case PT.fly:case PT.spore:
          p.dx+=(Math.sin(age*1.3+p.seed)*9-p.dx)*Math.min(1,dt*1.6);
          p.dy+=(Math.cos(age*1.7+p.seed*2)*6-p.dy)*Math.min(1,dt*1.6);
          p.dz+=((p.type===PT.spore?5:Math.sin(age*2.1+p.seed)*5)-p.dz)*Math.min(1,dt*1.8);
          break;
        case PT.smoke:
          p.dx+=(windAt(p.x,p.y)*8-p.dx)*Math.min(1,dt*1.2);
          break;
        case PT.ember:
          p.dx+=Math.sin(age*7+p.seed)*18*dt;
          break;
        default:break;
      }
      const drag=Math.exp(-p.drag*dt);
      p.dx*=drag;p.dy*=drag;p.dz-=p.grav*dt;
      p.x+=p.dx*dt;p.y+=p.dy*dt;p.z+=p.dz*dt;
      if(p.z<0){
        p.z=0;
        if(p.bounce>0&&p.dz<-16){p.dz=-p.dz*p.bounce;p.dx*=.74;p.dy*=.74;}
        else{
          p.dz=0;
          if(p.type===PT.debris){const roll=Math.exp(-6*dt);p.dx*=roll;p.dy*=roll;}
          else if(p.type===PT.leaf||p.type===PT.petal){p.dx*=.9;p.dy*=.9;if(p.life>1.6)p.life=1.6;}
        }
      }
    }
  }

  function impact(x,y,kind="strike",showRing=true){
    const {power,color}=impactPresets[kind]??impactPresets.strike;
    if(showRing){
      if(rings.length>=maxParticles)rings.shift();
      rings.push({x,y:y-6,color,age:0,power});
    }
    pushParticles(x,y-4,power*.85,30+power*34);
    spawn(PT.star,x,y-4,4,0,0,0,.12,"#ffffff",kind==="hurt"?"#ff8581":"#ffe1a3",6+power*5,1,0,0,0,1);
  }

  function update(dt,{view,ambientAt,dark=false,tileSize=16}={}){
    tick+=dt;
    stepParticles(dt,view);
    for(let i=rings.length-1;i>=0;i--){
      rings[i].age+=dt;
      if(rings[i].age>.28)rings.splice(i,1);
    }
    if(!view||!ambientAt)return;
    ambientAcc+=dt*26;
    const ambientLimit=Math.min(150,Math.floor(maxParticles*.6));
    while(ambientAcc>=1){
      ambientAcc--;
      if(ambientCount>=ambientLimit)continue;
      const p=ambientParticle(view,ambientAt,dark,tileSize);
      if(p){p.amb=1;ambientCount++;}
    }
  }

  function clear(){
    particles.length=0;rings.length=0;particleFree.length=0;
    evictCursor=0;ambientCount=0;ambientAcc=0;tick=0;
    ramps.clear();glowCache.clear();softCache.clear();
  }

  return { particles,rings,sparks,impact,update,clear };
}

import { shiftColor, toHex } from "./vfxPrimitives.js";

export const PT=Object.freeze({chip:0,streak:1,smoke:3,leaf:4,puff:5,ember:6,ripple:7,debris:8,flake:9,fly:10,spore:11,star:12,petal:13});

// Emberwood's original bursts and biome-specific ambient accents.
export function createParticlePresets({spawn,random}) {
  const rr=(min,max)=>min+random()*(max-min);
  const shades=new Map();
  function lightOf(color,amt=.45){
    let tones=shades.get(color);
    if(!tones){
      if(shades.size>=256)shades.delete(shades.keys().next().value);
      tones=new Map();shades.set(color,tones);
    }
    if(!tones.has(amt))tones.set(amt,toHex(shiftColor(color,amt)));
    return tones.get(amt);
  }
  function leafBurst(x,y,n,palette=["#5f9a58","#8cb561","#3f7a50"]){
    for(let i=0;i<n;i++){
      const a=rr(0,6.283),sp=rr(6,26),c=palette[i%palette.length];
      spawn(PT.leaf,x+rr(-5,5),y+rr(-2,3),rr(10,22),Math.cos(a)*sp,Math.sin(a)*sp*.5,rr(4,16),rr(.9,1.6),c,lightOf(c,-.35),2,2,26,1.6);
    }
  }
  function smokePuff(x,y,size=5,life=1.5){
    spawn(PT.smoke,x+rr(-1.5,1.5),y,rr(2,6),rr(-3,3),0,rr(9,17),life*rr(.8,1.2),"#a9a39b","#6f6a66",size*.45,size,0,1.5,0,0).amb=0;
  }
  function sparks(x,y,color,n,kind="magic",dx=0,dy=0,leaves=color==="#d4a776"){
    n=Math.min(n,48);
    const directed=dx!==0||dy!==0,heading=Math.atan2(dy,dx);
    const aim=()=>directed?heading+(random()-.5)*1.7:random()*6.2832;
    const bright=lightOf(color,.55),deep=lightOf(color,-.55);
    switch(kind){
      case "steam":
        spawn(PT.puff,x,y,1,rr(-2,2),0,9,.55,color,"#9faeae",1,3,0,1);
        break;
      case "metal":
        for(let i=0;i<n;i++){
          const a=aim(),sp=rr(50,130);
          spawn(PT.streak,x,y,rr(1,5),Math.cos(a)*sp,Math.sin(a)*sp*.7,rr(14,48),rr(.22,.46),"#fff3cc",deep,1.4,.6,230,2.6,.32,.5);
        }
        spawn(PT.star,x,y,3,0,0,0,.16,"#ffffff",color,5,1,0,0,0,1);
        for(let i=0;i<3;i++){const a=aim();spawn(PT.debris,x,y,2,Math.cos(a)*30,Math.sin(a)*20,rr(16,34),rr(.5,.8),"#8d8893","#4a4852",1,1,260,2,.4);}
        break;
      case "wood":{
        for(let i=0;i<n;i++){
          const a=aim(),sp=rr(22,70);
          spawn(PT.debris,x,y,rr(1,4),Math.cos(a)*sp,Math.sin(a)*sp*.7,rr(20,52),rr(.55,.95),i%3?color:bright,deep,i%4?2:1,1,250,2.2,.4);
        }
        for(let i=0;i<2;i++)spawn(PT.puff,x+rr(-2,2),y,2,rr(-8,8),rr(-4,4),rr(4,12),rr(.35,.55),"#bda688","#8a7860",1.5,4.5,10,3);
        if(leaves)leafBurst(x,y-8,Math.min(5,3+(n>12?2:0)));
        break;}
      case "stone":
        for(let i=0;i<n;i++){
          const a=aim(),sp=rr(26,86);
          spawn(PT.debris,x,y,rr(1,4),Math.cos(a)*sp,Math.sin(a)*sp*.7,rr(26,62),rr(.6,1),i%3?color:bright,"#4e4a50",i%4?2:1,1,280,2.4,.46);
        }
        for(let i=0;i<3;i++)spawn(PT.puff,x+rr(-3,3),y,2,rr(-14,14),rr(-7,7),rr(4,10),rr(.4,.7),"#b2aaa0","#7d766f",2,6,8,3);
        spawn(PT.star,x,y,3,0,0,0,.14,"#ffffff",bright,4,1,0,0,0,.8);
        break;
      case "water":
        for(let i=0;i<n;i++){
          const a=aim(),sp=rr(10,40);
          spawn(PT.streak,x,y,rr(1,3),Math.cos(a)*sp,Math.sin(a)*sp*.7,rr(26,56),rr(.35,.6),"#eefcff",color,1.3,1,250,1.6,.2,.3);
        }
        spawn(PT.ripple,x,y+3,0,0,0,0,.6,"#d8f6f8","#6aa9bd",1,7,0,0);
        break;
      case "dust":{
        const a0=aim();
        for(let i=0;i<n;i++){
          const a=directed?a0+rr(-.5,.5):aim(),sp=rr(8,22);
          spawn(PT.puff,x+rr(-2,2),y+rr(-1,1),rr(0,2),Math.cos(a)*sp,Math.sin(a)*sp*.5,rr(3,12),rr(.32,.55),color,lightOf(color,-.25),1.2,rr(3,4.5),14,4.2);
        }
        if(n>=3)spawn(PT.debris,x,y,1,rr(-10,10),rr(-6,6),rr(14,24),rr(.3,.45),lightOf(color,.2),lightOf(color,-.2),1,1,220,3,.3);
        break;}
      case "ember":
        for(let i=0;i<n;i++){
          const a=rr(0,6.283),sp=rr(2,10);
          spawn(PT.ember,x+rr(-2,2),y,rr(1,3),Math.cos(a)*sp,Math.sin(a)*sp*.6,rr(18,42),rr(.7,1.5),"#fff0b8",random()<.4?"#5b2d2c":"#c24a2b",1.6,.4,-10,1.2,0,.6);
        }
        if(random()<.35)smokePuff(x,y-2,4,1.2);
        break;
      default:{
        for(let i=0;i<n;i++){
          const a=aim(),sp=rr(10,46);
          spawn(PT.star,x+rr(-2,2),y+rr(-2,2),rr(0,3),Math.cos(a)*sp,Math.sin(a)*sp*.7,rr(10,42),rr(.45,.95),i%2?bright:"#ffffff",color,2.2,.6,10,3.4,0,.55);
        }
        spawn(PT.ripple,x,y+1,0,0,0,0,.4,bright,color,2,10,0,0,0,0);
        spawn(PT.smoke,x,y,2,0,0,10,.5,color,color,6,10,0,2,0,0).type=PT.puff;
      }
    }
  }

  function ambientParticle(view,ambientAt,dark,tileSize){
    const x=view.x+rr(-20,view.width+20),y=view.y+rr(-20,view.height+20);
    const bi=ambientAt(Math.floor(x/tileSize),Math.floor(y/tileSize)),roll=random();
    if(!Number.isInteger(bi)||bi<0||bi>8)return null;
    let p=null;
    if(bi===4){
      p=spawn(PT.flake,x,y,rr(60,110),rr(-6,6),rr(-2,3),-rr(8,16),rr(5,9),"#ffffff","#bcd2e0",random()<.3?2:1,1,0,.2);
    }else if(bi===6||bi===3){
      if(roll<.5)p=spawn(PT.streak,x,y,rr(4,40),rr(30,52),rr(-4,8),0,rr(2,3.5),bi===6?"#d9b27a":"#a89e94",bi===6?"#a47b4e":"#6c655e",1,1,0,0);
      else p=spawn(PT.flake,x,y,rr(10,60),rr(2,10),rr(-2,2),-rr(1,5),rr(4,7),bi===3?"#8e8780":"#d1a574","#59514a",1,1,0,.3);
      if(p&&p.type===PT.streak)p.glow=0;
    }else if(dark&&roll<.55){
      p=spawn(PT.fly,x,y,rr(4,20),0,0,0,rr(5,10),"#f8f2a0","#9ccf6d",1,1,0,0,0,1);
    }else if(bi===8){
      p=spawn(PT.spore,x,y,rr(2,24),rr(-2,2),rr(-1,1),rr(3,9),rr(5,9),roll<.5?"#7fe8cf":"#c799e8","#5aa6a0",1.2,1,0,0,0,.7);
    }else if(bi===7&&roll<.6){
      const c=random()<.5?"#f0a6b8":"#f4d27a";
      p=spawn(PT.petal,x,y,rr(30,70),rr(2,10),rr(-2,2),-rr(4,9),rr(5,9),c,lightOf(c,-.3),2,2,0,.3);
    }else if(roll<.62){
      const palette=bi===5?["#2f6a52","#3f7f5c"]:bi===0||bi===7?["#8cb561","#c4b45a"]:["#4f8d56","#7ea65b","#b09a50"];
      const c=palette[(random()*palette.length)|0];
      p=spawn(PT.leaf,x,y,rr(30,80),rr(2,12),rr(-2,3),-rr(5,11),rr(5,9),c,lightOf(c,-.35),2,2,0,.3);
    }else{
      p=spawn(PT.flake,x,y,rr(8,50),rr(1,6),rr(-1,1),rr(1,4),rr(4,8),"#f2e8b8","#c9c08a",1,1,0,.2);
    }
    return p;
  }
  return {sparks,ambientParticle};
}

'use strict';
// ── Captura erros JS e mostra na loading screen ─────────────────────────────
window.onerror=function(msg,_s,line){var el=document.getElementById('loading-text');if(el)el.textContent='ERRO (L'+line+'): '+msg;return false;};

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
const GW = 1280, GH = 640;
canvas.width = GW; canvas.height = GH;
ctx.imageSmoothingEnabled = false;

function fitCanvas(){
  const r=GW/GH,ww=window.innerWidth,wh=window.innerHeight;
  let cw,ch;
  if(ww/wh>r){ch=wh;cw=wh*r;}else{cw=ww;ch=ww/r;}
  canvas.style.width=cw+'px'; canvas.style.height=ch+'px';
  canvas.style.left=((ww-cw)/2)+'px'; canvas.style.top=((wh-ch)/2)+'px';
}
window.addEventListener('resize',fitCanvas); fitCanvas();

// ── Difficulty configs ────────────────────────────────────────────────────────
const DIFFICULTIES={
  easy:{
    key:'easy', label:'FACIL', emoji:'🟢',
    color:'#44cc66', colorDark:'#1a5a2a', colorBorder:'#66ee88',
    desc:'Mais tempo e menos obstáculos.',
    finishWX:28000, timerStart:60,
    baseSpeed:4.5, maxSpeed:11, speedRamp:28000,
    obsMinGap:1000, obsMaxGap:1800,
    obsMinH:55, obsMaxH:95,
    coinGapMin:380, coinGapMax:700,
    coffeeGapMin:2200, coffeeGapMax:4200,
    coffeeMult:1.0,
  },
  medium:{
    key:'medium', label:'MEDIO', emoji:'🟡',
    color:'#e8b800', colorDark:'#5a4400', colorBorder:'#ffd700',
    desc:'Equilibrado. Boa sorte!',
    finishWX:55000, timerStart:45,
    baseSpeed:6.5, maxSpeed:16, speedRamp:50000,
    obsMinGap:800, obsMaxGap:1400,
    obsMinH:68, obsMaxH:140,
    coinGapMin:550, coinGapMax:950,
    coffeeGapMin:3000, coffeeGapMax:5500,
    coffeeMult:0.8,
  },
  hard:{
    key:'hard', label:'DIFICIL', emoji:'🔴',
    color:'#ee4444', colorDark:'#5a1010', colorBorder:'#ff6666',
    desc:'Velocidade alta, pouco tempo.',
    finishWX:68000, timerStart:30,
    baseSpeed:8, maxSpeed:22, speedRamp:62000,
    obsMinGap:680, obsMaxGap:1200,
    obsMinH:75, obsMaxH:165,
    coinGapMin:600, coinGapMax:1100,
    coffeeGapMin:2500, coffeeGapMax:4500,
    coffeeMult:1.6,
  },
};
let D = DIFFICULTIES.medium;   // active difficulty — replaced on selection

// ── Character configs ─────────────────────────────────────────────────────────
const CHARS={
  cabral: {label:'Cabral', file:'spritesheet_cabral.png', colW:911/4,
    stand:{col:1,y:60,h:326},walk:{y:697,h:207,frames:4},jump:{y:962,h:216,col:2},
    scale:0.76,bgSat:20,bgBrMin:88,bgBrMax:180},
  bruno:  {label:'Bruno',  file:'spritesheet_bruno.png',  colW:896/4,
    stand:{col:1,y:59,h:326},walk:{y:695,h:208,frames:4},jump:{y:959,h:207,col:2},
    scale:0.76,bgSat:20,bgBrMin:88,bgBrMax:180},
  lisboa: {label:'Lisboa', file:'spritesheet_lisboa.png', colW:896/4,
    stand:{col:1,y:60,h:325},walk:{y:694,h:207,frames:4},jump:{y:957,h:209,col:2},
    scale:0.76,bgSat:20,bgBrMin:88,bgBrMax:180},
  anna:   {label:'Anna',   file:'spritesheet_anna.png',   colW:1822/4,
    stand:{col:1,y:118,h:662},walk:{y:1394,h:425,frames:4},jump:{y:1924,h:440,col:2},
    scale:0.38,bgSat:22,bgBrMin:85,bgBrMax:180},
  arcanjo:{label:'Arcanjo',file:'spritesheet_arcanjo.png',colW:1822/4,
    stand:{col:1,y:121,h:649},walk:{y:1394,h:416,frames:4},jump:{y:1924,h:433,col:2},
    scale:0.38,bgSat:22,bgBrMin:85,bgBrMax:180},
};
const CHAR_KEYS=Object.keys(CHARS);

// ── Background removal ────────────────────────────────────────────────────────
function removeBackground(img,satT,brMin,brMax){
  const oc=document.createElement('canvas');
  oc.width=img.width; oc.height=img.height;
  const c2=oc.getContext('2d');
  c2.drawImage(img,0,0);
  const id=c2.getImageData(0,0,img.width,img.height),d=id.data;
  for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2];
    const sat=Math.max(r,g,b)-Math.min(r,g,b),br=(r+g+b)/3;
    if(sat<satT&&br>brMin&&br<brMax)d[i+3]=0;
  }
  c2.putImageData(id,0,0); return oc;
}

// ── Portrait bounds ───────────────────────────────────────────────────────────
function computePortraitBounds(c){
  const p=c.stand,cw=Math.ceil(c.colW),ch=p.h;
  const oc=document.createElement('canvas');
  oc.width=cw; oc.height=ch;
  const oc2=oc.getContext('2d');
  oc2.drawImage(c.canvas,p.col*c.colW,p.y,c.colW,ch,0,0,cw,ch);
  const px=oc2.getImageData(0,0,cw,ch).data;
  let x0=cw,x1=0;
  for(let y=0;y<ch;y++) for(let x=0;x<cw;x++)
    if(px[(y*cw+x)*4+3]>15){if(x<x0)x0=x;if(x>x1)x1=x;}
  const PAD=4;
  c.portBounds={x:Math.max(0,x0-PAD),w:Math.min(cw,x1+PAD)-Math.max(0,x0-PAD)};
}

// ── Loading ───────────────────────────────────────────────────────────────────
let loadedCount=0;
const _ldBar=document.getElementById('loading-bar-inner');
const _ldTxt=document.getElementById('loading-text');
const _ldScr=document.getElementById('loading-screen');
function _onCharLoaded(){
  loadedCount++;
  if(_ldBar) _ldBar.style.width=(loadedCount/CHAR_KEYS.length*100)+'%';
  if(_ldTxt) _ldTxt.textContent=`Carregando... ${loadedCount}/${CHAR_KEYS.length}`;
  if(loadedCount===CHAR_KEYS.length){
    gameState='start';
    if(_ldScr){
      _ldScr.classList.add('hidden');
      // Garantia: remove o div do DOM depois da transição CSS (0.4s)
      setTimeout(()=>{ _ldScr.style.display='none'; }, 500);
    }
  }
}
function loadAllChars(){
  if(_ldTxt) _ldTxt.textContent='Carregando sprites... 0/'+CHAR_KEYS.length;
  CHAR_KEYS.forEach(key=>{
    const c=CHARS[key]; c.img=new Image();
    c.img.onload=()=>{
      try{
        c.canvas=removeBackground(c.img,c.bgSat,c.bgBrMin,c.bgBrMax);
        computePortraitBounds(c);
      }catch(e){
        // Se o processamento falhar, usa canvas vazio p/ não travar o contador
        c.canvas=Object.assign(document.createElement('canvas'),{width:1,height:1});
      }
      _onCharLoaded();
    };
    c.img.onerror=()=>{
      c.canvas=Object.assign(document.createElement('canvas'),{width:1,height:1});
      _onCharLoaded();
    };
    c.img.src=c.file;
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAYER_X  = 220;
const GROUND_Y  = GH-120;
const COIN_R    = 13;
const COFFEE_R  = 19;
function coffeeBonus(){ return Math.round(Math.max(2,10-(worldX/D.finishWX)*8)*D.coffeeMult); }

// ── Obstacle types ────────────────────────────────────────────────────────────
const OBS_TYPES=[
  {name:'barrier',c1:'#c0392b',c2:'#8b2020',c3:'#ff6b6b'},
  {name:'cone',   c1:'#e67e22',c2:'#994d00',c3:'#ffa040'},
  {name:'crate',  c1:'#7d5a2a',c2:'#4a3010',c3:'#c08840'},
];
// ── Hard-mode mobile obstacle types ─────────────────────────────────────────
const OBS_HARD_TYPES=[
  {name:'drone', c1:'#4a6680',c2:'#1e3048',c3:'#88ccee'}, // floating drone
  {name:'rusher',c1:'#cc3311',c2:'#7a1800',c3:'#ff7755'}, // rushing car
];

// ── World decoration ──────────────────────────────────────────────────────────
const BUILDINGS=[
  {rx:0,w:140,h:220},{rx:180,w:90,h:300},{rx:310,w:200,h:180},
  {rx:560,w:110,h:260},{rx:720,w:160,h:200},{rx:930,w:80,h:340},
  {rx:1060,w:190,h:220},{rx:1310,w:120,h:280},{rx:1480,w:150,h:190},
  {rx:1680,w:100,h:310},{rx:1830,w:180,h:240},{rx:2070,w:130,h:260},
  {rx:2250,w:200,h:190},{rx:2500,w:90,h:350},{rx:2640,w:160,h:210},
];
const BLDG_REPEAT=2900;
const LAMP_POSTS=[{rx:120},{rx:540},{rx:960},{rx:1380},{rx:1800},{rx:2220},{rx:2640}];
const LAMP_REPEAT=2900;
const CLOUD_REPEAT=2560;
const CLOUDS=[
  {wx:130,y:70,w:290,h:88},{wx:520,y:45,w:210,h:68},
  {wx:900,y:100,w:340,h:96},{wx:1310,y:55,w:255,h:80},
  {wx:1760,y:35,w:220,h:72},{wx:2210,y:80,w:305,h:92},
];

// ── Persistent high score ─────────────────────────────────────────────────────
let highScores={easy:0,medium:0,hard:0};
try{
  const saved=JSON.parse(localStorage.getItem('cta_hiscores_v2')||'{}');
  Object.keys(highScores).forEach(k=>{ if(saved[k]) highScores[k]=saved[k]; });
}catch(e){}
function saveHighScore(){
  if(distanceM>highScores[D.key]){ isNewRecord=true; highScores[D.key]=distanceM;
    try{localStorage.setItem('cta_hiscores_v2',JSON.stringify(highScores));}catch(e){}
  }
}

// ── Game state vars ───────────────────────────────────────────────────────────
let gameState='loading';
let activeChar=null;
let dCW,dWH,dJH;
const HB_LEFT=0.34, HB_RIGHT=0.66, HB_BOTTOM=0.04;

let worldX=0, score=0, timeLeft=30, timerMs=0;
let gameOverReason='', currentSpeed=5;
let isNewRecord=false;
let distanceM=0, combo=0, comboTimer=0;
let flashAlpha=0, flashColor='rgba(255,0,0,0.6)';
let startAnimT=0, winAnimT=0;
const confetti=[];

const obstacles=[], coins=[], coffees=[], popups=[], steamParts=[];
let nextObsWX=0, nextCoinWX=0, nextCoffeeWX=0;

// ── Player ────────────────────────────────────────────────────────────────────
const player={
  y:GROUND_Y,vy:0,onGround:true,canDoubleJump:false,
  facing:'right',state:'idle',animFrame:0,animTimer:0,
  ANIM_SPEED:110,JUMP_VY:16,GRAVITY:0.55,
};

function resetPlayer(){
  worldX=0; score=0; timeLeft=D.timerStart; timerMs=0;
  currentSpeed=D.baseSpeed; distanceM=0;
  combo=0; comboTimer=0; flashAlpha=0;
  obstacles.length=0; coins.length=0; coffees.length=0;
  popups.length=0; steamParts.length=0; confetti.length=0;
  nextObsWX=1200; nextCoinWX=500;
  nextCoffeeWX=1800+Math.random()*1800;
  gameOverReason=''; isNewRecord=false;
  Object.assign(player,{y:GROUND_Y,vy:0,onGround:true,canDoubleJump:false,
    facing:'right',state:'idle',animFrame:0,animTimer:0});
}

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONF_COLORS=['#ff4444','#44ff88','#4488ff','#ffee44','#ff44ff','#44ffee','#ff8800','#ffffff'];
function spawnConfetti(){
  for(let i=0;i<130;i++){
    confetti.push({x:Math.random()*GW,y:-20-Math.random()*350,
      vx:(Math.random()-0.5)*6,vy:1.5+Math.random()*3.5,
      w:6+Math.random()*9,h:4+Math.random()*5,
      color:CONF_COLORS[Math.floor(Math.random()*CONF_COLORS.length)],
      rot:Math.random()*Math.PI*2,rotV:(Math.random()-0.5)*0.18,rect:Math.random()<0.6});
  }
}
function updateConfetti(dt){
  for(let i=confetti.length-1;i>=0;i--){
    const c=confetti[i]; c.x+=c.vx; c.y+=c.vy*dt/16; c.rot+=c.rotV; c.vx+=(Math.random()-0.5)*0.1;
    if(c.y>GH+30) confetti.splice(i,1);
  }
  if(gameState==='win'&&confetti.length<70&&Math.random()<0.35){
    confetti.push({x:Math.random()*GW,y:-10,vx:(Math.random()-0.5)*5,vy:1.5+Math.random()*3,
      w:6+Math.random()*9,h:4+Math.random()*5,
      color:CONF_COLORS[Math.floor(Math.random()*CONF_COLORS.length)],
      rot:Math.random()*Math.PI*2,rotV:(Math.random()-0.5)*0.15,rect:Math.random()<0.6});
  }
}
function drawConfetti(){
  confetti.forEach(c=>{
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot); ctx.fillStyle=c.color;
    if(c.rect) ctx.fillRect(-c.w/2,-c.h/2,c.w,c.h);
    else{ctx.beginPath();ctx.ellipse(0,0,c.w/2,c.h/2,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  });
}

// ── Input ─────────────────────────────────────────────────────────────────────
const keys={};
function doJump(){
  if(player.onGround){
    player.vy=-player.JUMP_VY; player.onGround=false; player.state='jumping';
    player.animFrame=0; player.canDoubleJump=true;
  } else if(player.canDoubleJump){
    player.vy=-player.JUMP_VY*0.85; player.canDoubleJump=false;
    if(dCW) popups.push({x:PLAYER_X+dCW/2,y:player.y-40,text:'2x!',color:'#80ffff',life:600,maxLife:600});
  }
}
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'||e.key==='Esc'){
    if(gameState==='playing') gameState='paused';
    else if(gameState==='paused') gameState='playing';
    return;
  }
  if(gameState!=='playing') return;
  if(keys[e.key]) return; keys[e.key]=true;
  if(e.key==='p'||e.key==='P'||e.key===' '||e.key==='ArrowUp'){doJump();e.preventDefault();}
});
window.addEventListener('keyup',e=>{keys[e.key]=false;});
canvas.addEventListener('touchstart',e=>{
  if(gameState==='playing'){e.preventDefault();doJump();}
  else if(gameState==='paused'){e.preventDefault();gameState='playing';}
},{passive:false});

// ── Spawn helpers ─────────────────────────────────────────────────────────────
function overlapsObstacle(wx,margin){
  for(const obs of obstacles){
    if(wx+margin>obs.wx&&wx-margin<obs.wx+obs.w) return true;
  }
  if(Math.abs(wx-nextObsWX)<margin+80) return true;
  return false;
}

function spawnObjects(){
  const prog=Math.min(worldX/D.speedRamp,1);
  const minGap=D.obsMinGap-prog*200, maxGap=D.obsMaxGap-prog*300;

  while(worldX+GW>nextObsWX){
    let t,baseH,w,extra={};
    if(D.key==='hard'&&Math.random()<0.42){
      if(Math.random()<0.55){
        t=OBS_HARD_TYPES[0];baseH=26;w=68;
        extra={floatBase:GROUND_Y-130,floatAmp:36+Math.random()*22,
               floatSpd:550+Math.random()*450,phase:Math.random()*Math.PI*2,yOff:0};
      }else{
        t=OBS_HARD_TYPES[1];baseH=52;w=82;extra={rushVx:3+Math.random()*2.5};
      }
    }else{
      t=OBS_TYPES[Math.floor(Math.random()*OBS_TYPES.length)];
      baseH=Math.floor(D.obsMinH+prog*(D.obsMaxH-D.obsMinH)*0.85+Math.random()*28);
      w=t.name==='cone'?Math.floor(baseH*0.65+16):Math.floor(44+Math.random()*26);
    }
    obstacles.push({wx:nextObsWX,w,h:baseH,type:t,...extra});
    nextObsWX+=Math.max(minGap,400)+Math.random()*(maxGap-minGap);
  }
  while(worldX+GW>nextCoinWX){
    if(!overlapsObstacle(nextCoinWX,90)){
      const cluster=1+Math.floor(Math.random()*3);
      const baseY=GROUND_Y-75-Math.random()*100;
      for(let k=0;k<cluster;k++){
        const arcY=cluster>1?baseY-Math.sin(k/(cluster-1||1)*Math.PI)*40:baseY;
        coins.push({wx:nextCoinWX+k*44,y:arcY,collected:false,spinPhase:Math.random()*Math.PI*2});
      }
    }
    nextCoinWX+=D.coinGapMin+Math.random()*(D.coinGapMax-D.coinGapMin);
  }
  while(worldX+GW>nextCoffeeWX){
    if(!overlapsObstacle(nextCoffeeWX,110))
      coffees.push({wx:nextCoffeeWX,y:GROUND_Y-115-Math.random()*75,collected:false});
    nextCoffeeWX+=D.coffeeGapMin+Math.random()*(D.coffeeGapMax-D.coffeeGapMin);
  }
  while(obstacles.length&&obstacles[0].wx<worldX-200) obstacles.shift();
  while(coins.length    &&coins[0].wx    <worldX-200) coins.shift();
  while(coffees.length  &&coffees[0].wx  <worldX-200) coffees.shift();
}

// ── Collision detection ───────────────────────────────────────────────────────
function getHitbox(){
  const px1=PLAYER_X+dCW*HB_LEFT, px2=PLAYER_X+dCW*HB_RIGHT;
  const py1=player.y-dWH*(1-HB_BOTTOM), py2=player.y-dWH*HB_BOTTOM;
  return{px1,px2,py1,py2,pcx:(px1+px2)/2,pcy:(py1+py2)/2};
}
function checkCollisions(){
  const{px1,px2,py1,py2,pcx,pcy}=getHitbox();
  for(const obs of obstacles){
    const ox=obs.wx-worldX+PLAYER_X;
    let obsTop,obsBot;
    if(obs.floatBase!==undefined){
      const cy=obs.floatBase+(obs.yOff||0);
      obsTop=cy-obs.h/2-2; obsBot=cy+obs.h/2+2;
    }else{obsTop=GROUND_Y-obs.h; obsBot=GROUND_Y;}
    if(px1<ox+obs.w&&px2>ox&&py2>obsTop&&py1<obsBot){
      flashAlpha=1; flashColor='rgba(220,20,20,0.55)';
      gameState='gameover'; gameOverReason='obstacle'; saveHighScore(); return;
    }
  }
  for(const c of coins){
    if(c.collected) continue;
    const sx=c.wx-worldX+PLAYER_X;
    if(sx+COIN_R>px1&&sx-COIN_R<px2&&c.y+COIN_R>py1&&c.y-COIN_R<py2){
      c.collected=true; score++; combo++;
      const txt=combo>=5?`x${combo}!`:'+1';
      const col=combo>=5?'#ff8800':combo>=3?'#ffee00':'#ffe033';
      popups.push({x:sx,y:c.y,text:txt,color:col,life:850,maxLife:850});
      if(combo>0&&combo%5===0){
        const bonus=Math.floor(combo/5); timeLeft=Math.min(timeLeft+bonus,999);
        popups.push({x:PLAYER_X+dCW/2,y:player.y-dWH-10,text:`COMBO! +${bonus}s`,color:'#ffaa00',life:1200,maxLife:1200});
      }
      comboTimer=3000;
    }
  }
  for(const cf of coffees){
    if(cf.collected) continue;
    const sx=cf.wx-worldX+PLAYER_X;
    if(sx+COFFEE_R>px1&&sx-COFFEE_R<px2&&cf.y+COFFEE_R>py1&&cf.y-COFFEE_R<py2){
      cf.collected=true; const bonus=coffeeBonus(); timeLeft=Math.min(timeLeft+bonus,999);
      combo=0; comboTimer=0;
      popups.push({x:sx,y:cf.y,text:`+${bonus}s`,color:'#7de8ff',life:1200,maxLife:1200});
    }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt){
  const prog=Math.min(worldX/D.speedRamp,1);
  currentSpeed=D.baseSpeed+prog*prog*(D.maxSpeed-D.baseSpeed);
  worldX+=currentSpeed; distanceM=Math.floor(worldX/40);

  timerMs+=dt;
  if(timerMs>=1000){timerMs-=1000; timeLeft--;}
  if(timeLeft<=0){
    flashAlpha=1; flashColor='rgba(0,0,60,0.6)';
    gameState='gameover'; gameOverReason='time'; saveHighScore(); return;
  }
  if(worldX>=D.finishWX){
    gameState='win'; spawnConfetti(); saveHighScore(); return;
  }

  // ── Update mobile obstacles ──────────────────────────────────────────
  const mobNow=performance.now();
  for(let mi=obstacles.length-1;mi>=0;mi--){
    const mo=obstacles[mi];
    if(mo.rushVx) mo.wx-=mo.rushVx;
    if(mo.floatAmp!==undefined)
      mo.yOff=Math.sin(mobNow/(mo.floatSpd||700)+mo.phase)*mo.floatAmp;
    if(mo.rushVx&&mo.wx-worldX+PLAYER_X<-350) obstacles.splice(mi,1);
  }
  spawnObjects();

  if(!player.onGround){
    player.vy+=player.GRAVITY; player.y+=player.vy;
    if(player.y>=GROUND_Y){player.y=GROUND_Y;player.vy=0;player.onGround=true;player.state='idle';player.animFrame=0;}
  }
  if(player.onGround) player.state='walking';
  player.animTimer+=dt;
  if(player.animTimer>=player.ANIM_SPEED){player.animTimer-=player.ANIM_SPEED;player.animFrame++;}
  if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)combo=0;}
  if(flashAlpha>0) flashAlpha=Math.max(0,flashAlpha-dt*0.003);

  if(Math.random()<0.18){
    coffees.forEach(cf=>{
      if(cf.collected) return;
      const sx=cf.wx-worldX+PLAYER_X;
      if(sx>-20&&sx<GW+20)
        steamParts.push({x:sx+(Math.random()-0.5)*7,y:cf.y-COFFEE_R-2,
          vx:(Math.random()-0.5)*0.6,vy:-0.9-Math.random()*0.5,life:700,maxLife:700,r:2+Math.random()*3});
    });
  }
  for(let i=steamParts.length-1;i>=0;i--){
    const s=steamParts[i]; s.x+=s.vx;s.y+=s.vy;s.vx+=(Math.random()-0.5)*0.08;s.life-=dt;
    if(s.life<=0)steamParts.splice(i,1);
  }
  for(let i=popups.length-1;i>=0;i--){popups[i].life-=dt;if(popups[i].life<=0)popups.splice(i,1);}
  checkCollisions();
}

// ── Draw helpers ──────────────────────────────────────────────────────────────
function blit(px,py,sx,sy,sw,sh,dw,dh){ctx.drawImage(activeChar.canvas,sx,sy,sw,sh,px,py,dw,dh);}
function drawPlayer(){
  const ac=activeChar,px=PLAYER_X;
  if(player.state==='jumping')
    blit(px,player.y-dJH,ac.jump.col*ac.colW,ac.jump.y,ac.colW,ac.jump.h,dCW,dJH);
  else
    blit(px,player.y-dWH,(player.animFrame%ac.walk.frames)*ac.colW,ac.walk.y,ac.colW,ac.walk.h,dCW,dWH);
}
function drawCloud(x,y,w,h){
  const r=h/2;
  ctx.beginPath(); ctx.arc(x+w*0.25,y+r,r*0.8,Math.PI,0);
  ctx.arc(x+w*0.5,y+r*0.4,r,Math.PI,0); ctx.arc(x+w*0.75,y+r,r*0.7,Math.PI,0);
  ctx.closePath(); ctx.fill();
}
function drawLampPost(x){
  ctx.fillStyle='#4a5566'; ctx.fillRect(x-3,GROUND_Y-90,6,90); ctx.fillRect(x-3,GROUND_Y-90,22,5);
  ctx.fillStyle='#667788'; ctx.fillRect(x+19,GROUND_Y-97,15,12);
  const glow=ctx.createRadialGradient(x+26,GROUND_Y-91,1,x+26,GROUND_Y-91,35);
  glow.addColorStop(0,'rgba(255,240,150,0.22)'); glow.addColorStop(1,'rgba(255,240,150,0)');
  ctx.fillStyle=glow; ctx.fillRect(x-9,GROUND_Y-126,70,70);
}

function drawBackground(){
  const dayProg=Math.min(worldX/32000,1);
  const sky=ctx.createLinearGradient(0,0,0,GROUND_Y);
  sky.addColorStop(0,`rgb(${Math.round(26+dayProg*90)},${Math.round(58+dayProg*18)},${Math.round(110-dayProg*70)})`);
  sky.addColorStop(0.65,`rgb(${Math.round(74+dayProg*130)},${Math.round(144+dayProg*18)},${Math.round(217-dayProg*110)})`);
  sky.addColorStop(1,'#c4e0f0');
  ctx.fillStyle=sky; ctx.fillRect(0,0,GW,GROUND_Y);
  if(dayProg<0.25){
    const sa=(1-dayProg/0.25)*0.7; ctx.fillStyle=`rgba(255,255,255,${sa})`;
    [[80,55],[205,28],[355,78],[505,42],[672,68],[825,22],[952,58],[1105,38],[1205,82],
     [132,118],[402,148],[752,108],[1052,128],[298,28],[652,14],[902,33]].forEach(([x,y])=>ctx.fillRect(x,y,2,2));
  }
  const co=worldX*0.05;
  BUILDINGS.forEach(b=>{
    for(let rep=0;rep<=2;rep++){
      const bx=((b.rx-co%BLDG_REPEAT)+BLDG_REPEAT*rep)%BLDG_REPEAT;
      if(bx+b.w<0||bx>GW) continue;
      ctx.fillStyle='#1e2d45'; ctx.fillRect(bx,GROUND_Y-b.h,b.w,b.h);
      ctx.fillStyle='rgba(255,230,100,0.14)';
      for(let wy=GROUND_Y-b.h+14;wy<GROUND_Y-20;wy+=28)
        for(let wx2=bx+12;wx2<bx+b.w-12;wx2+=22) ctx.fillRect(wx2,wy,10,14);
    }
  });
  ctx.fillStyle='rgba(255,255,255,0.82)';
  const cOff=worldX*0.25%CLOUD_REPEAT;
  CLOUDS.forEach(cl=>{
    for(let rep=-1;rep<=1;rep++){
      const sx=cl.wx-cOff+rep*CLOUD_REPEAT; if(sx+cl.w<0||sx>GW) return;
      drawCloud(sx,cl.y,cl.w,cl.h);
    }
  });
  const lOff=worldX*0.4%LAMP_REPEAT;
  LAMP_POSTS.forEach(lp=>{
    for(let rep=0;rep<=2;rep++){
      const lx=((lp.rx-lOff%LAMP_REPEAT)+LAMP_REPEAT*rep)%LAMP_REPEAT;
      if(lx>-20&&lx<GW+20) drawLampPost(lx);
    }
  });
  ctx.fillStyle='#3a2a14'; ctx.fillRect(0,GROUND_Y,GW,GH-GROUND_Y);
  ctx.fillStyle='#888'; ctx.fillRect(0,GROUND_Y,GW,20);
  ctx.fillStyle='#aaa'; ctx.fillRect(0,GROUND_Y,GW,7);
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.5;
  const tOff=worldX%120;
  for(let x=-tOff;x<GW;x+=120){ctx.beginPath();ctx.moveTo(x,GROUND_Y);ctx.lineTo(x,GROUND_Y+20);ctx.stroke();}
  ctx.fillStyle='#ddaa00'; ctx.fillRect(0,GROUND_Y+20,GW,3);
}

// ── Finish line ───────────────────────────────────────────────────────────────
function drawFinishLine(){
  const sx=D.finishWX-worldX+PLAYER_X;
  if(sx>GW+500||sx<-500) return;
  const now=Date.now();

  // ── Office building backdrop ──────────────────────────────────────────────
  const bW=160, bH=230;
  ctx.fillStyle='#16263a';
  ctx.fillRect(sx-bW/2,GROUND_Y-bH,bW,bH);
  // Glass facade strips
  ctx.fillStyle='rgba(100,160,255,0.08)';
  for(let i=0;i<6;i++) ctx.fillRect(sx-bW/2+i*bW/6,GROUND_Y-bH,bW/6-2,bH);
  // Windows grid
  ctx.fillStyle='rgba(255,240,130,0.25)';
  for(let wy=GROUND_Y-bH+16;wy<GROUND_Y-22;wy+=22)
    for(let wx2=sx-bW/2+14;wx2<sx+bW/2-14;wx2+=20) ctx.fillRect(wx2,wy,12,14);
  // Rooftop details
  ctx.fillStyle='#1e3050';
  ctx.fillRect(sx-bW/2-6,GROUND_Y-bH-8,bW+12,10);
  ctx.fillRect(sx-8,GROUND_Y-bH-26,16,20);
  ctx.fillStyle='#ff4444';
  ctx.beginPath(); ctx.arc(sx,GROUND_Y-bH-26,4,0,Math.PI*2); ctx.fill();
  // "EMPRESA" sign on building
  ctx.fillStyle='rgba(255,215,0,0.8)'; ctx.font='bold 11px monospace'; ctx.textAlign='center';
  ctx.fillText('EMPRESA S.A.',sx,GROUND_Y-bH+16);

  // ── Arch gate ────────────────────────────────────────────────────────────
  const pillarW=20, pillarH=180, span=90;
  const lp=sx-span-pillarW, rp=sx+span;

  // Pillar shadows
  ctx.fillStyle='rgba(0,0,0,0.2)';
  ctx.fillRect(lp+4,GROUND_Y-pillarH+4,pillarW,pillarH);
  ctx.fillRect(rp+4,GROUND_Y-pillarH+4,pillarW,pillarH);

  // Pillars (marble gradient)
  [lp,rp].forEach(px2=>{
    const pg=ctx.createLinearGradient(px2,0,px2+pillarW,0);
    pg.addColorStop(0,'#b0b8c0'); pg.addColorStop(0.4,'#e8eef4'); pg.addColorStop(1,'#9aa2aa');
    ctx.fillStyle=pg; ctx.fillRect(px2,GROUND_Y-pillarH,pillarW,pillarH);
    // Pillar cap
    ctx.fillStyle='#d0d8e0'; ctx.fillRect(px2-4,GROUND_Y-pillarH-8,pillarW+8,10);
  });

  // Arch top
  const archG=ctx.createLinearGradient(sx-span,GROUND_Y-pillarH,sx+span,GROUND_Y-pillarH);
  archG.addColorStop(0,'#9aa2aa'); archG.addColorStop(0.5,'#e8eef4'); archG.addColorStop(1,'#9aa2aa');
  ctx.strokeStyle=archG; ctx.lineWidth=pillarW;
  ctx.beginPath(); ctx.arc(sx,GROUND_Y-pillarH,span+pillarW/2,Math.PI,0); ctx.stroke();
  // Arch highlight
  ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=5;
  ctx.beginPath(); ctx.arc(sx,GROUND_Y-pillarH,span+pillarW/2-6,Math.PI,0); ctx.stroke();

  // ── Checkered banner on arch ──────────────────────────────────────────────
  const bannerY=GROUND_Y-pillarH-16, sq=15;
  const bannerW=Math.floor((span*2+pillarW)/sq)*sq;
  for(let ci=0;ci<bannerW/sq;ci++){
    for(let ri=0;ri<2;ri++){
      ctx.fillStyle=(ci+ri)%2===0?'#ffffff':'#111111';
      ctx.fillRect(lp+pillarW+ci*sq,bannerY+ri*sq,sq,sq);
    }
  }
  // Banner border
  ctx.strokeStyle='rgba(200,200,200,0.6)'; ctx.lineWidth=1.5;
  ctx.strokeRect(lp+pillarW,bannerY,bannerW,sq*2);

  // ── Flags on pillars ──────────────────────────────────────────────────────
  // Left flag (Brazilian green/yellow feel)
  ctx.fillStyle='#009c3b';
  ctx.beginPath(); ctx.moveTo(lp,GROUND_Y-pillarH-10); ctx.lineTo(lp+40,GROUND_Y-pillarH+4);
  ctx.lineTo(lp,GROUND_Y-pillarH+18); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#ffdf00'; ctx.font='bold 9px sans-serif'; ctx.textAlign='left';
  ctx.fillText('✓',lp+8,GROUND_Y-pillarH+7);
  // Right flag (checkered finish)
  const rFlag=rp+pillarW;
  for(let fc=0;fc<3;fc++) for(let fr=0;fr<2;fr++){
    ctx.fillStyle=(fc+fr)%2===0?'#fff':'#000';
    ctx.fillRect(rFlag+fc*12,GROUND_Y-pillarH-10+fr*12,12,12);
  }

  // ── CHEGADA label inside arch ─────────────────────────────────────────────
  ctx.save();
  const gPulse=0.5+0.5*Math.sin(now/400);
  ctx.shadowColor='#ffd700'; ctx.shadowBlur=20+gPulse*10;
  ctx.fillStyle='#ffd700'; ctx.font='bold 20px monospace'; ctx.textAlign='center';
  ctx.fillText('CHEGADA',sx,GROUND_Y-pillarH+50);
  ctx.restore();

  // ── Checkered ground strip ────────────────────────────────────────────────
  const gsq=24;
  for(let col=-3;col<5;col++) for(let row=0;row<3;row++){
    ctx.fillStyle=(col+row)%2===0?'#ffffff':'#111111';
    ctx.fillRect(sx-gsq*3+col*gsq,GROUND_Y+row*gsq,gsq,gsq);
  }

  // ── Animated sparkles orbiting arch when close ────────────────────────────
  const dist=D.finishWX-worldX;
  if(dist>0&&dist<6000){
    const alpha=Math.min(1,(6000-dist)/5000);
    for(let i=0;i<8;i++){
      const angle=now/600+i*(Math.PI*2/8);
      const orbitR=span+pillarW+8+Math.sin(now/300+i)*6;
      const sx2=sx+Math.cos(Math.PI+angle)*orbitR;
      const sy2=GROUND_Y-pillarH+Math.sin(angle)*orbitR*0.35;
      if(sy2<GROUND_Y-pillarH-16) continue;
      ctx.save(); ctx.globalAlpha=alpha*(0.5+0.5*Math.abs(Math.sin(angle+i)));
      ctx.fillStyle='#ffd700'; ctx.shadowColor='#ffd700'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(sx2,sy2,3,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // Distance label
    const pulse=0.82+0.18*Math.sin(now/160);
    ctx.save(); ctx.globalAlpha=alpha*pulse;
    ctx.fillStyle='#ffd700'; ctx.font=`bold ${Math.round(14+alpha*5)}px monospace`; ctx.textAlign='center';
    ctx.fillText(`${Math.floor(dist/40)}m para a chegada!`,GW/2,GROUND_Y-38);
    ctx.restore();
  }
}

// ── Obstacles / Coins / Coffees / Steam / Popups ──────────────────────────────
function drawObstacles(){
  const dnow=Date.now();
  obstacles.forEach(obs=>{
    const sx=obs.wx-worldX+PLAYER_X; if(sx+obs.w<0||sx>GW) return;
    const t=obs.type;

    // ── Drone ──────────────────────────────────────────────────────────────
    if(t.name==='drone'){
      const cy=obs.floatBase+(obs.yOff||0), cx=sx+obs.w/2;
      // Scan beam
      const bA=0.05+0.03*Math.sin(dnow/280);
      const bG=ctx.createLinearGradient(cx,cy,cx,GROUND_Y);
      bG.addColorStop(0,`rgba(255,50,50,${bA*4})`); bG.addColorStop(1,'rgba(255,50,50,0)');
      ctx.fillStyle=bG;
      ctx.beginPath();ctx.moveTo(cx-14,cy);ctx.lineTo(cx+14,cy);
      ctx.lineTo(cx+32,GROUND_Y);ctx.lineTo(cx-32,GROUND_Y);ctx.closePath();ctx.fill();
      // Arms + rotors
      [[cx-24,cy-11],[cx+24,cy-11],[cx+24,cy+11],[cx-24,cy+11]].forEach(([ax,ay])=>{
        ctx.strokeStyle='#2a3d4e';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ax,ay);ctx.stroke();
        ctx.save();ctx.translate(ax,ay);ctx.rotate(dnow/70);
        ctx.strokeStyle='rgba(140,210,255,0.8)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='rgba(140,210,255,0.55)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.stroke();
        ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(0,11);ctx.stroke();
        ctx.restore();
      });
      // Body
      const bBodyG=ctx.createRadialGradient(cx,cy,2,cx,cy,12);
      bBodyG.addColorStop(0,t.c3);bBodyG.addColorStop(1,t.c2);
      ctx.fillStyle=bBodyG;ctx.beginPath();ctx.arc(cx,cy,11,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=t.c1;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,11,0,Math.PI*2);ctx.stroke();
      // Camera
      ctx.fillStyle='#000a';ctx.beginPath();ctx.arc(cx,cy+5,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(80,180,255,0.7)';ctx.beginPath();ctx.arc(cx,cy+5,2,0,Math.PI*2);ctx.fill();
      // Blinking red light
      if(Math.floor(dnow/320)%2===0){
        ctx.save();ctx.fillStyle='#ff2020';ctx.shadowColor='#ff0000';ctx.shadowBlur=10;
        ctx.beginPath();ctx.arc(cx,cy-12,3,0,Math.PI*2);ctx.fill();ctx.restore();
      }
      return;
    }

    // ── Rusher (car) ───────────────────────────────────────────────────────
    if(t.name==='rusher'){
      const oy=GROUND_Y-obs.h;
      ctx.fillStyle='rgba(0,0,0,0.22)';ctx.fillRect(sx+4,GROUND_Y-4,obs.w,7);
      // Body
      const cG=ctx.createLinearGradient(sx,oy,sx,oy+obs.h);
      cG.addColorStop(0,t.c3);cG.addColorStop(0.5,t.c1);cG.addColorStop(1,t.c2);
      ctx.fillStyle=cG;
      ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(sx,oy+10,obs.w,obs.h-10,4);
      else ctx.rect(sx,oy+10,obs.w,obs.h-10);
      ctx.fill();
      // Cabin
      ctx.fillStyle=t.c3;
      ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(sx+obs.w*0.22,oy,obs.w*0.52,obs.h*0.56,3);
      else ctx.rect(sx+obs.w*0.22,oy,obs.w*0.52,obs.h*0.56);
      ctx.fill();
      // Windows
      ctx.fillStyle='rgba(160,240,255,0.75)';
      ctx.fillRect(sx+obs.w*0.25,oy+3,obs.w*0.22,obs.h*0.28);
      ctx.fillRect(sx+obs.w*0.5,oy+3,obs.w*0.22,obs.h*0.28);
      // Wheels
      ctx.fillStyle='#181818';
      [0.15,0.75].forEach(f=>{
        const wx2=sx+obs.w*f,wy=GROUND_Y-8;
        ctx.beginPath();ctx.arc(wx2,wy,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#555';ctx.beginPath();ctx.arc(wx2,wy,5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#181818';
      });
      // Headlights (car faces left = toward player)
      ctx.save();ctx.fillStyle='#ffff80';ctx.shadowColor='#ffee00';ctx.shadowBlur=14;
      ctx.fillRect(sx,oy+obs.h*0.42,5,8);ctx.restore();
      // Speed lines to the right
      ctx.strokeStyle='rgba(255,180,100,0.38)';ctx.lineWidth=1.5;
      for(let li=0;li<4;li++){
        ctx.beginPath();
        ctx.moveTo(sx+obs.w+2,oy+obs.h*0.25+li*10);
        ctx.lineTo(sx+obs.w+20+li*9,oy+obs.h*0.25+li*10);
        ctx.stroke();
      }
      return;
    }

    // ── Ground-based obstacles (barrier / cone / crate) ────────────────────
    const oy=GROUND_Y-obs.h;
    ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(sx+5,GROUND_Y-4,obs.w,6);
    if(t.name==='cone'){
      ctx.fillStyle=t.c1; ctx.beginPath(); ctx.moveTo(sx+obs.w/2,oy); ctx.lineTo(sx,GROUND_Y); ctx.lineTo(sx+obs.w,GROUND_Y); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(sx+obs.w/2,oy); ctx.lineTo(sx,GROUND_Y); ctx.lineTo(sx+obs.w,GROUND_Y); ctx.closePath(); ctx.clip();
      ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=5;
      [obs.h*0.38,obs.h*0.63].forEach(f=>{const s1=oy+f;ctx.beginPath();ctx.moveTo(sx-5,s1);ctx.lineTo(sx+obs.w+5,s1);ctx.stroke();});
      ctx.restore();
    } else if(t.name==='crate'){
      const g=ctx.createLinearGradient(sx,oy,sx+obs.w,oy+obs.h);
      g.addColorStop(0,t.c3);g.addColorStop(0.5,t.c1);g.addColorStop(1,t.c2);
      ctx.fillStyle=g; ctx.fillRect(sx,oy,obs.w,obs.h);
      ctx.strokeStyle=t.c2; ctx.lineWidth=2; ctx.strokeRect(sx+4,oy+4,obs.w-8,obs.h-8);
      ctx.beginPath();ctx.moveTo(sx,oy+obs.h/2);ctx.lineTo(sx+obs.w,oy+obs.h/2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(sx+obs.w/2,oy);ctx.lineTo(sx+obs.w/2,oy+obs.h);ctx.stroke();
    } else {
      const g=ctx.createLinearGradient(sx,oy,sx+obs.w,oy);
      g.addColorStop(0,t.c2);g.addColorStop(0.5,t.c1);g.addColorStop(1,t.c2);
      ctx.fillStyle=g; ctx.fillRect(sx,oy,obs.w,obs.h);
      ctx.save(); ctx.rect(sx,oy,obs.w,obs.h); ctx.clip();
      ctx.strokeStyle='rgba(255,220,0,0.65)'; ctx.lineWidth=6;
      for(let xi=sx-obs.h;xi<sx+obs.w+obs.h;xi+=20){ctx.beginPath();ctx.moveTo(xi,oy);ctx.lineTo(xi+obs.h,oy+obs.h);ctx.stroke();}
      ctx.restore();
      ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(sx+3,oy+3,obs.w-6,8);
      ctx.strokeStyle=t.c2; ctx.lineWidth=2; ctx.strokeRect(sx,oy,obs.w,obs.h);
    }
  });
}
function drawCoins(){
  const now=Date.now();
  coins.forEach(c=>{
    if(c.collected) return;
    const sx=c.wx-worldX+PLAYER_X; if(sx<-40||sx>GW+40) return;
    const spin=Math.sin(now/155+c.spinPhase),scaleX=Math.max(0.12,Math.abs(spin)),face=spin>=0;
    const g=ctx.createRadialGradient(sx,c.y,1,sx,c.y,COIN_R*2.2);
    g.addColorStop(0,'rgba(255,215,0,0.4)'); g.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=g; ctx.fillRect(sx-COIN_R*2.5,c.y-COIN_R*2.5,COIN_R*5,COIN_R*5);
    ctx.save(); ctx.translate(sx,c.y); ctx.scale(scaleX,1);
    ctx.fillStyle=face?'#d4a017':'#b8860b'; ctx.beginPath(); ctx.arc(0,0,COIN_R,0,Math.PI*2); ctx.fill();
    if(face){
      ctx.fillStyle='#ffe033'; ctx.beginPath(); ctx.arc(-2,-2,COIN_R*0.68,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#a07010'; ctx.font=`bold ${Math.floor(COIN_R*1.1)}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★',0,1); ctx.textBaseline='alphabetic';
    }
    ctx.restore();
  });
}
function drawSteam(){
  steamParts.forEach(s=>{
    const t=s.life/s.maxLife; ctx.save(); ctx.globalAlpha=t*0.42; ctx.fillStyle='#cce8f0';
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r*t,0,Math.PI*2); ctx.fill(); ctx.restore();
  });
}
function drawCoffees(){
  const now=Date.now();
  coffees.forEach(cf=>{
    if(cf.collected) return;
    const sx=cf.wx-worldX+PLAYER_X; if(sx<-60||sx>GW+60) return;
    const pulse=0.6+0.4*Math.sin(now/280);
    const g=ctx.createRadialGradient(sx,cf.y,2,sx,cf.y,COFFEE_R*2.4);
    g.addColorStop(0,`rgba(100,220,255,${0.48*pulse})`); g.addColorStop(1,'rgba(100,220,255,0)');
    ctx.fillStyle=g; ctx.fillRect(sx-COFFEE_R*2.6,cf.y-COFFEE_R*2.6,COFFEE_R*5.2,COFFEE_R*5.2);
    ctx.fillStyle='#5c3317'; ctx.beginPath(); ctx.arc(sx,cf.y,COFFEE_R,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#a0522d'; ctx.beginPath(); ctx.arc(sx,cf.y,COFFEE_R*0.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a1a00'; ctx.beginPath(); ctx.arc(sx,cf.y,COFFEE_R*0.45,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font=`bold ${Math.floor(COFFEE_R*0.85)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('☕',sx,cf.y+1); ctx.textBaseline='alphabetic';
    ctx.fillStyle='#7de8ff'; ctx.font='bold 13px monospace'; ctx.textAlign='center';
    ctx.fillText(`+${coffeeBonus()}s`,sx,cf.y+COFFEE_R+15);
  });
}
function drawPopups(){
  popups.forEach(p=>{
    const t=p.life/p.maxLife,yOff=(1-t)*55; ctx.save(); ctx.globalAlpha=Math.min(1,t*2.2);
    ctx.font=`bold ${p.text.length>4?17:22}px monospace`; ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,0.65)'; ctx.lineWidth=3; ctx.strokeText(p.text,p.x,p.y-yOff);
    ctx.fillStyle=p.color; ctx.fillText(p.text,p.x,p.y-yOff); ctx.restore();
  });
}

// ── Pause button ──────────────────────────────────────────────────────────────
const BTN_PAUSE={x:GW-58,y:6,w:48,h:36};
let hovPause=false;
function drawPauseBtn(){
  ctx.fillStyle=hovPause?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.09)';
  rrect(BTN_PAUSE.x,BTN_PAUSE.y,BTN_PAUSE.w,BTN_PAUSE.h,6); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.fillRect(BTN_PAUSE.x+13,BTN_PAUSE.y+9,5,18); ctx.fillRect(BTN_PAUSE.x+25,BTN_PAUSE.y+9,5,18);
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function drawHUD(){
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,GW,50);

  const tColor=timeLeft>15?'#4ade80':timeLeft>8?'#facc15':'#f87171';
  const tPulse=timeLeft<=5?(1+0.14*Math.sin(Date.now()/140)):1;
  ctx.save(); ctx.translate(104,26); ctx.scale(tPulse,tPulse); ctx.translate(-104,-26);
  ctx.fillStyle=tColor; ctx.font='bold 26px monospace'; ctx.textAlign='left';
  ctx.fillText(`⏱ ${timeLeft}s`,16,36); ctx.restore();
  ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(122,17,210,14);
  ctx.fillStyle=tColor; ctx.fillRect(122,17,210*Math.min(timeLeft/D.timerStart,1),14);
  ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.strokeRect(122,17,210,14);

  // ── Barra de progresso da distância ──────────────────────────────────────
  const progPct=Math.min(worldX/D.finishWX,1);
  const totalM=Math.round(D.finishWX/40);
  const BAR_X=16, BAR_Y=GH-28, BAR_W=GW-32, BAR_H=10;
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(BAR_X-2,BAR_Y-16,BAR_W+4,BAR_H+20);
  ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(BAR_X,BAR_Y,BAR_W,BAR_H);
  const barGrad=ctx.createLinearGradient(BAR_X,0,BAR_X+BAR_W,0);
  barGrad.addColorStop(0,D.color); barGrad.addColorStop(1,'#ffffff44');
  ctx.fillStyle=barGrad; ctx.fillRect(BAR_X,BAR_Y,BAR_W*progPct,BAR_H);
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; ctx.strokeRect(BAR_X,BAR_Y,BAR_W,BAR_H);
  // Marcador de posição
  const markerX=BAR_X+BAR_W*progPct;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(markerX,BAR_Y+BAR_H/2,6,0,Math.PI*2); ctx.fill();
  // Texto de distância
  ctx.fillStyle='rgba(200,220,255,0.85)'; ctx.font='bold 11px monospace'; ctx.textAlign='left';
  ctx.fillText(`${distanceM}m`,BAR_X,BAR_Y-4);
  ctx.fillStyle='rgba(200,220,255,0.5)'; ctx.textAlign='right';
  ctx.fillText(`${totalM}m`,BAR_X+BAR_W,BAR_Y-4);
  // Ícone de chegada no final da barra
  ctx.font='12px sans-serif'; ctx.textAlign='right';
  ctx.fillText('🏁',BAR_X+BAR_W+14,BAR_Y+BAR_H);

  ctx.fillStyle='#ffe033'; ctx.font='bold 26px monospace'; ctx.textAlign='center';
  ctx.fillText(`★ ${score}`,GW/2,36);
  if(combo>=3){ctx.fillStyle='#ff8800';ctx.font='bold 14px monospace';ctx.textAlign='left';ctx.fillText(`x${combo}`,GW/2+66,36);}

  // Difficulty badge
  ctx.fillStyle=D.color; ctx.font='bold 13px monospace'; ctx.textAlign='right';
  ctx.fillText(D.label,GW-70,20);

  ctx.fillStyle='rgba(180,210,255,0.7)'; ctx.font='bold 14px monospace'; ctx.textAlign='right';
  ctx.fillText(`${distanceM}m`,GW-70,38);
  drawPauseBtn();

  const hs=highScores[D.key];
  if(hs>0){ctx.fillStyle='rgba(255,215,0,0.4)';ctx.font='11px monospace';ctx.textAlign='right';ctx.fillText(`rec: ${hs}m`,GW-20,GH-8);}
  ctx.fillStyle='rgba(125,232,255,0.4)'; ctx.font='11px monospace'; ctx.textAlign='left';
  ctx.fillText(`☕ +${coffeeBonus()}s`,16,GH-8);

  if(worldX<2500){
    const fa=Math.max(0,1-worldX/1800)*0.45;
    ctx.fillStyle=`rgba(255,255,255,${fa})`; ctx.font='13px monospace'; ctx.textAlign='center';
    ctx.fillText('P / Espaco = Pular  (2x pulos!)',GW/2,GH-8);
  }
  if(flashAlpha>0){ctx.save();ctx.globalAlpha=Math.max(0,flashAlpha);ctx.fillStyle=flashColor;ctx.fillRect(0,0,GW,GH);ctx.restore();}
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function rrect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

// ── Pause overlay ─────────────────────────────────────────────────────────────
const BTN_RESUME={x:GW/2-140,y:GH/2+10,w:280,h:60};
const BTN_PAUSE_MENU={x:GW/2-140,y:GH/2+88,w:280,h:50};
let hovResume=false,hovPauseMenu=false;
function drawPauseScreen(){
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,GW,GH);
  const pw=420,ph=330,px2=GW/2-pw/2,py2=GH/2-ph/2-20;
  ctx.fillStyle='#0d1828'; rrect(px2,py2,pw,ph,16); ctx.fill();
  ctx.strokeStyle='#4a7aaf'; ctx.lineWidth=2; rrect(px2,py2,pw,ph,16); ctx.stroke();
  ctx.textAlign='center';
  ctx.fillStyle='#e0eeff'; ctx.font='bold 44px monospace'; ctx.fillText('PAUSE',GW/2,py2+72);
  ctx.fillStyle='rgba(160,190,230,0.5)'; ctx.font='14px monospace'; ctx.fillText('ESC para continuar',GW/2,py2+108);
  ctx.fillStyle=D.color; ctx.font='bold 14px monospace';
  ctx.fillText(`${D.label} · ${distanceM}m percorridos`,GW/2,py2+140);
  const hR=hovResume;
  const rG=ctx.createLinearGradient(BTN_RESUME.x,BTN_RESUME.y,BTN_RESUME.x,BTN_RESUME.y+BTN_RESUME.h);
  rG.addColorStop(0,hR?'#2a80c8':'#1a60a8'); rG.addColorStop(1,hR?'#1050a0':'#0a3070');
  ctx.fillStyle=rG; rrect(BTN_RESUME.x,BTN_RESUME.y,BTN_RESUME.w,BTN_RESUME.h,12); ctx.fill();
  ctx.strokeStyle=hR?'#80c0ff':'#4a80c0'; ctx.lineWidth=2; rrect(BTN_RESUME.x,BTN_RESUME.y,BTN_RESUME.w,BTN_RESUME.h,12); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 24px monospace'; ctx.textAlign='center';
  ctx.fillText('▶  CONTINUAR',GW/2,BTN_RESUME.y+BTN_RESUME.h/2+9);
  const hM=hovPauseMenu;
  ctx.fillStyle=hM?'#2e2e6e':'#1a1a44'; rrect(BTN_PAUSE_MENU.x,BTN_PAUSE_MENU.y,BTN_PAUSE_MENU.w,BTN_PAUSE_MENU.h,12); ctx.fill();
  ctx.strokeStyle=hM?'#9898ee':'#505098'; ctx.lineWidth=1.5; rrect(BTN_PAUSE_MENU.x,BTN_PAUSE_MENU.y,BTN_PAUSE_MENU.w,BTN_PAUSE_MENU.h,12); ctx.stroke();
  ctx.fillStyle='#aabbdd'; ctx.font='18px monospace'; ctx.textAlign='center';
  ctx.fillText('◄  Dificuldade',GW/2,BTN_PAUSE_MENU.y+BTN_PAUSE_MENU.h/2+6);
}

// ── Difficulty selection screen ───────────────────────────────────────────────
const DIFF_KEYS=['easy','medium','hard'];
let hovDiff=null;
function drawDifficultyScreen(){
  const bg=ctx.createLinearGradient(0,0,0,GH);
  bg.addColorStop(0,'#060e20'); bg.addColorStop(1,'#0e1e38');
  ctx.fillStyle=bg; ctx.fillRect(0,0,GW,GH);

  ctx.textAlign='center';
  ctx.shadowColor='#80b0ff'; ctx.shadowBlur=16;
  ctx.fillStyle='#d0e8ff'; ctx.font='bold 32px monospace';
  ctx.fillText('ESCOLHA A DIFICULDADE',GW/2,58);
  ctx.shadowBlur=0;

  const cW=330, cH=220, cGap=28;
  const totalW=DIFF_KEYS.length*cW+(DIFF_KEYS.length-1)*cGap;
  const cStartX=GW/2-totalW/2;
  const cY=GH/2-cH/2+10;

  DIFF_KEYS.forEach((key,i)=>{
    const d2=DIFFICULTIES[key];
    const cx=cStartX+i*(cW+cGap);
    const hov=hovDiff===key;

    // Card shadow
    ctx.fillStyle='rgba(0,0,0,0.4)'; rrect(cx+5,cY+5,cW,cH,12); ctx.fill();
    // Card bg
    const cG=ctx.createLinearGradient(cx,cY,cx,cY+cH);
    cG.addColorStop(0,hov?d2.colorDark:'#111824'); cG.addColorStop(1,'#0a0f18');
    ctx.fillStyle=cG; rrect(cx,cY,cW,cH,12); ctx.fill();
    // Card border
    ctx.strokeStyle=hov?d2.colorBorder:d2.color;
    ctx.lineWidth=hov?3:1.5; rrect(cx,cY,cW,cH,12); ctx.stroke();

    // Top colour strip
    ctx.fillStyle=d2.color; rrect(cx,cY,cW,8,12); ctx.fill();
    ctx.fillRect(cx,cY+4,cW,4);

    // Emoji + label
    ctx.textAlign='center';
    ctx.font='36px sans-serif'; ctx.fillText(d2.emoji,cx+cW/2,cY+50);
    if(hov){ctx.shadowColor=d2.color; ctx.shadowBlur=14;}
    ctx.fillStyle=hov?d2.colorBorder:'#ddeeff';
    ctx.font=`bold ${hov?28:24}px monospace`;
    ctx.fillText(d2.label,cx+cW/2,cY+88);
    ctx.shadowBlur=0;

    // Desc
    ctx.fillStyle='rgba(180,210,240,0.65)'; ctx.font='14px monospace';
    ctx.fillText(d2.desc,cx+cW/2,cY+114);

    // Stats
    ctx.fillStyle='rgba(200,220,255,0.55)'; ctx.font='13px monospace'; ctx.textAlign='left';
    ctx.fillText(`⏱ Tempo:   ${d2.timerStart}s`, cx+30, cY+150);
    ctx.fillText(`📍 Distância: ${Math.round(d2.finishWX/40)}m`, cx+30, cY+170);

    // High score
    const hs=highScores[key];
    if(hs>0){
      ctx.fillStyle='rgba(255,215,0,0.55)'; ctx.font='12px monospace'; ctx.textAlign='center';
      ctx.fillText(`recorde: ${hs}m`,cx+cW/2,cY+cH-14);
    }
  });

  ctx.fillStyle='rgba(140,170,210,0.4)'; ctx.font='13px monospace'; ctx.textAlign='center';
  ctx.fillText('Clique para selecionar',GW/2,GH-18);
}

function diffCardHit(pos){
  const cW=330, cH=220, cGap=28;
  const totalW=DIFF_KEYS.length*cW+(DIFF_KEYS.length-1)*cGap;
  const cStartX=GW/2-totalW/2;
  const cY=GH/2-cH/2+10;
  for(let i=0;i<DIFF_KEYS.length;i++){
    const cx=cStartX+i*(cW+cGap);
    if(pos.x>=cx&&pos.x<=cx+cW&&pos.y>=cY&&pos.y<=cY+cH) return DIFF_KEYS[i];
  }
  return null;
}

// ── Start screen ──────────────────────────────────────────────────────────────
const BTN_START={x:GW/2-140,y:GH/2+58,w:280,h:64};
let hovBtn=null;
function drawSilhouetteRunner(x,y,t){
  ctx.fillStyle='rgba(8,16,36,0.88)'; const s=0.72,ls=Math.sin(t/180)*20;
  ctx.beginPath(); ctx.arc(x,y-60*s,10*s,0,Math.PI*2); ctx.fill();
  ctx.fillRect(x-8*s,y-50*s,16*s,24*s);
  ctx.save();ctx.translate(x,y-28*s);ctx.rotate(ls*Math.PI/180);ctx.fillRect(-4*s,0,7*s,28*s);ctx.restore();
  ctx.save();ctx.translate(x,y-28*s);ctx.rotate(-ls*Math.PI/180);ctx.fillRect(-3*s,0,7*s,28*s);ctx.restore();
  ctx.save();ctx.translate(x,y-45*s);ctx.rotate(-ls*0.6*Math.PI/180);ctx.fillRect(-14*s,-3*s,13*s,5*s);ctx.restore();
  ctx.save();ctx.translate(x,y-45*s);ctx.rotate(ls*0.6*Math.PI/180);ctx.fillRect(1,-3*s,13*s,5*s);ctx.restore();
}
function drawStartScreen(dt){
  startAnimT+=dt;
  const bg=ctx.createLinearGradient(0,0,0,GH);
  bg.addColorStop(0,'#050c1c'); bg.addColorStop(1,'#0c1c38');
  ctx.fillStyle=bg; ctx.fillRect(0,0,GW,GH);
  [[80,55],[205,28],[355,78],[505,42],[672,68],[825,22],[952,58],[1105,38],[1205,82],
   [132,118],[402,148],[752,108],[1052,128],[298,28],[652,14],[902,33]].forEach(([x,y],i)=>{
    ctx.globalAlpha=0.35+0.65*Math.abs(Math.sin(startAnimT/1000+i*0.73));
    ctx.fillStyle='#fff'; ctx.fillRect(x,y,2,2);
  }); ctx.globalAlpha=1;
  ctx.fillStyle='#0c1830';
  [[48,180],[198,255],[358,162],[528,235],[708,195],[888,272],[1048,205],[1178,245]].forEach(([x,h],i)=>{
    const w=[122,82,162,102,142,92,162,92][i]; ctx.fillRect(x,GH-h-58,w,h);
    ctx.fillStyle='rgba(255,200,60,0.13)';
    for(let wy=GH-h-48;wy<GH-68;wy+=22) for(let wx=x+10;wx<x+w-10;wx+=18) ctx.fillRect(wx,wy,8,11);
    ctx.fillStyle='#0c1830';
  });
  ctx.fillStyle='#1a2a14'; ctx.fillRect(0,GH-60,GW,60); ctx.fillStyle='#243d1a'; ctx.fillRect(0,GH-60,GW,8);
  drawSilhouetteRunner((startAnimT*0.12)%(GW+240)-120,GH-60-Math.abs(Math.sin(startAnimT/190))*7,startAnimT);
  ctx.textAlign='center';
  ctx.shadowColor='#3a80ff'; ctx.shadowBlur=38;
  ctx.fillStyle='#e8f4ff'; ctx.font='bold 80px monospace'; ctx.fillText('CORRIDA',GW/2,GH/2-78);
  ctx.fillStyle='#f0d060'; ctx.fillText('AO TRABALHO',GW/2,GH/2+4);
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(200,220,255,0.5)'; ctx.font='16px monospace';
  ctx.fillText('Pule os obstaculos · colete ★ moedas · chegue ao trabalho!',GW/2,GH/2+44);
  const bestOverall=Math.max(...Object.values(highScores));
  if(bestOverall>0){ctx.fillStyle='rgba(255,215,0,0.6)';ctx.font='14px monospace';ctx.fillText(`Melhor recorde: ${bestOverall} moedas`,GW/2,GH/2+68);}
  const hov=(hovBtn===BTN_START),pulse=0.92+0.08*Math.sin(startAnimT/380);
  ctx.save();
  ctx.translate(GW/2,BTN_START.y+BTN_START.h/2); ctx.scale(hov?1.04:pulse,hov?1.04:pulse);
  ctx.translate(-GW/2,-(BTN_START.y+BTN_START.h/2));
  const bG=ctx.createLinearGradient(BTN_START.x,BTN_START.y,BTN_START.x,BTN_START.y+BTN_START.h);
  bG.addColorStop(0,hov?'#4aa4e8':'#2a80c8'); bG.addColorStop(1,hov?'#1a60a8':'#0f3d7e');
  ctx.fillStyle=bG; rrect(BTN_START.x,BTN_START.y,BTN_START.w,BTN_START.h,14); ctx.fill();
  ctx.strokeStyle=hov?'#90d4ff':'#5aa4d4'; ctx.lineWidth=2; rrect(BTN_START.x,BTN_START.y,BTN_START.w,BTN_START.h,14); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 28px monospace'; ctx.textAlign='center';
  ctx.fillText('▶  JOGAR',GW/2,BTN_START.y+BTN_START.h/2+10); ctx.restore();
  ctx.fillStyle='rgba(150,180,220,0.35)'; ctx.font='12px monospace'; ctx.textAlign='center';
  ctx.fillText('Desenvolvimento Web II  —  UniLaSalle',GW/2,GH-14);
}

// ── Character selection ───────────────────────────────────────────────────────
const N=CHAR_KEYS.length, CW=220, CH=370, CGAP=18;
const BTN_BACK_SELECT={x:GW/2-110,y:GH-52,w:220,h:38};
let hovBackSelect=false;
const CY=GH/2-CH/2+5, CSX=GW/2-(N*CW+(N-1)*CGAP)/2;
function cX(i){return CSX+i*(CW+CGAP);}
let hoveredCard=null;
function drawSelectScreen(){
  const bg=ctx.createLinearGradient(0,0,0,GH);
  bg.addColorStop(0,'#0d1520'); bg.addColorStop(1,'#162035');
  ctx.fillStyle=bg; ctx.fillRect(0,0,GW,GH);
  ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1;
  for(let x=0;x<GW;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,GH);ctx.stroke();}
  for(let y=0;y<GH;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(GW,y);ctx.stroke();}
  // Difficulty badge top-right
  ctx.fillStyle='rgba(0,0,0,0.4)'; rrect(GW-130,8,118,30,8); ctx.fill();
  ctx.strokeStyle=D.color; ctx.lineWidth=1.5; rrect(GW-130,8,118,30,8); ctx.stroke();
  ctx.fillStyle=D.color; ctx.font='bold 14px monospace'; ctx.textAlign='center';
  ctx.fillText(D.emoji+' '+D.label,GW-71,28);
  ctx.shadowColor='#e2c97a'; ctx.shadowBlur=14;
  ctx.fillStyle='#e2c97a'; ctx.font='bold 28px monospace'; ctx.textAlign='center';
  ctx.fillText('SELECIONE SEU PERSONAGEM',GW/2,46); ctx.shadowBlur=0;
  CHAR_KEYS.forEach((key,i)=>{
    const c=CHARS[key],cx=cX(i),hov=hoveredCard===key;
    ctx.fillStyle='rgba(0,0,0,0.4)'; rrect(cx+5,CY+5,CW,CH,8); ctx.fill();
    const cG=ctx.createLinearGradient(cx,CY,cx,CY+CH);
    cG.addColorStop(0,hov?'#253050':'#151d2e'); cG.addColorStop(1,hov?'#1a2540':'#0d1520');
    ctx.fillStyle=cG; rrect(cx,CY,CW,CH,8); ctx.fill();
    ctx.strokeStyle=hov?'#e2c97a':'#2a4060'; ctx.lineWidth=hov?2.5:1.5; rrect(cx,CY,CW,CH,8); ctx.stroke();
    if(c.canvas&&c.portBounds){
      const p=c.stand,pH=310,srcX=p.col*c.colW+c.portBounds.x,srcW=c.portBounds.w;
      const pS=pH/p.h,pW=srcW*pS; ctx.save(); rrect(cx+2,CY+2,CW-4,CH-4,7); ctx.clip();
      ctx.drawImage(c.canvas,srcX,p.y,srcW,p.h,cx+CW/2-pW/2,CY+6,pW,pH); ctx.restore();
    }
    if(hov){ctx.shadowColor='#e2c97a';ctx.shadowBlur=8;}
    ctx.fillStyle=hov?'#e2c97a':'#8aaccc'; ctx.font=`bold ${hov?16:14}px monospace`; ctx.textAlign='center';
    ctx.fillText(c.label,cx+CW/2,CY+CH-14); ctx.shadowBlur=0;
  });
  ctx.fillStyle='#3a5070'; ctx.font='12px monospace'; ctx.textAlign='center';
  ctx.fillText('Clique em um personagem para jogar',GW/2,GH-58);
  // Botão Voltar
  const hbk=hovBackSelect;
  ctx.fillStyle=hbk?'#2e2e6e':'#1a1a44'; rrect(BTN_BACK_SELECT.x,BTN_BACK_SELECT.y,BTN_BACK_SELECT.w,BTN_BACK_SELECT.h,10); ctx.fill();
  ctx.strokeStyle=hbk?'#9898ee':'#505098'; ctx.lineWidth=1.5; rrect(BTN_BACK_SELECT.x,BTN_BACK_SELECT.y,BTN_BACK_SELECT.w,BTN_BACK_SELECT.h,10); ctx.stroke();
  ctx.fillStyle=hbk?'#ddeeff':'#aabbdd'; ctx.font='15px monospace'; ctx.textAlign='center';
  ctx.fillText('◄  Dificuldade',GW/2,BTN_BACK_SELECT.y+BTN_BACK_SELECT.h/2+5);
}
// Loading screen is rendered as HTML — see #loading-screen in index.html

// ── Game Over ─────────────────────────────────────────────────────────────────
const BTN_RETRY={x:GW/2-160,y:GH/2+52,w:320,h:64};
const BTN_MENU ={x:GW/2-160,y:GH/2+134,w:320,h:52};
// Max collectable coins per difficulty (estimated from gap configs × avg cluster size)
const DIFF_MAX_COINS={easy:60,medium:90,hard:130};
function getRating(s){
  // Performance = 55% completion + 45% coin score, each normalised to [0,1]
  const completionPct=Math.min(worldX/D.finishWX,1);
  const scoreNorm=Math.min(s/DIFF_MAX_COINS[D.key],1);
  // On the win screen the player already reached 100%, so weight shifts fully to coins
  const isWin=(gameState==='win');
  const perf=isWin ? scoreNorm : completionPct*0.55+scoreNorm*0.45;
  if(perf>=0.80)return{txt:'S  INCRIVEL!',  col:'#ffd700'};
  if(perf>=0.60)return{txt:'A  Excelente',  col:'#a0ff80'};
  if(perf>=0.40)return{txt:'B  Bom trabalho',col:'#80d0ff'};
  if(perf>=0.22)return{txt:'C  Regular',    col:'#ffcc44'};
  return              {txt:'D  Treine mais!',col:'#ff8888'};
}
function drawGameOverScreen(){
  ctx.fillStyle='rgba(0,0,0,0.76)'; ctx.fillRect(0,0,GW,GH);
  const pw=548,ph=400,px2=GW/2-pw/2,py2=GH/2-ph/2-28;
  ctx.fillStyle='rgba(0,0,0,0.5)'; rrect(px2+6,py2+6,pw,ph,18); ctx.fill();
  const pG=ctx.createLinearGradient(px2,py2,px2,py2+ph);
  pG.addColorStop(0,'#1c0606'); pG.addColorStop(1,'#0d0002');
  ctx.fillStyle=pG; rrect(px2,py2,pw,ph,18); ctx.fill();
  ctx.strokeStyle='#8b0000'; ctx.lineWidth=3; rrect(px2,py2,pw,ph,18); ctx.stroke();
  ctx.textAlign='center';
  ctx.shadowColor='#ff0000'; ctx.shadowBlur=28;
  ctx.fillStyle='#ff3333'; ctx.font='bold 70px monospace'; ctx.fillText('GAME OVER',GW/2,py2+88);
  ctx.shadowBlur=0;
  ctx.fillStyle='#ffaaaa'; ctx.font='18px monospace';
  ctx.fillText(gameOverReason==='time'?'O tempo acabou!':'Voce bateu num obstaculo!',GW/2,py2+126);
  ctx.fillStyle='#ffe033'; ctx.font='bold 32px monospace';
  ctx.fillText(`★ ${score} moeda${score!==1?'s':''}`,GW/2,py2+170);
  const rat=getRating(score);
  ctx.fillStyle=rat.col; ctx.font='bold 20px monospace'; ctx.fillText(rat.txt,GW/2,py2+204);
  ctx.fillStyle='rgba(180,210,255,0.65)'; ctx.font='15px monospace';
  ctx.fillText(`${distanceM}m percorridos · ${D.label}`,GW/2,py2+234);
  const hs=highScores[D.key];
  ctx.fillStyle=isNewRecord?'#ffd700':'rgba(255,215,0,0.45)'; ctx.font=isNewRecord?'bold 16px monospace':'14px monospace';
  ctx.fillText(isNewRecord?`NOVO RECORDE: ${hs}m`:`Recorde ${D.label}: ${hs}m`,GW/2,py2+258);
  const hR=(hovBtn===BTN_RETRY);
  const rG=ctx.createLinearGradient(BTN_RETRY.x,BTN_RETRY.y,BTN_RETRY.x,BTN_RETRY.y+BTN_RETRY.h);
  rG.addColorStop(0,hR?'#3a8f3a':'#267026'); rG.addColorStop(1,hR?'#1d601d':'#143814');
  ctx.fillStyle=rG; rrect(BTN_RETRY.x,BTN_RETRY.y,BTN_RETRY.w,BTN_RETRY.h,14); ctx.fill();
  ctx.strokeStyle=hR?'#6aee6a':'#3aaa3a'; ctx.lineWidth=2; rrect(BTN_RETRY.x,BTN_RETRY.y,BTN_RETRY.w,BTN_RETRY.h,14); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 26px monospace'; ctx.textAlign='center';
  ctx.fillText('↺  REINICIAR',GW/2,BTN_RETRY.y+BTN_RETRY.h/2+9);
  const hM=(hovBtn===BTN_MENU);
  ctx.fillStyle=hM?'#2e2e6e':'#1a1a44'; rrect(BTN_MENU.x,BTN_MENU.y,BTN_MENU.w,BTN_MENU.h,12); ctx.fill();
  ctx.strokeStyle=hM?'#9898ee':'#505098'; ctx.lineWidth=1.5; rrect(BTN_MENU.x,BTN_MENU.y,BTN_MENU.w,BTN_MENU.h,12); ctx.stroke();
  ctx.fillStyle='#aabbdd'; ctx.font='18px monospace'; ctx.textAlign='center';
  ctx.fillText('◄  Dificuldade',GW/2,BTN_MENU.y+BTN_MENU.h/2+6);
}

// ── Win screen ────────────────────────────────────────────────────────────────
const BTN_WIN_RETRY={x:GW/2-170,y:GH/2+88,w:340,h:64};
const BTN_WIN_MENU ={x:GW/2-170,y:GH/2+170,w:340,h:52};
let hovWinRetry=false, hovWinMenu=false;
function drawWinScreen(){
  winAnimT+=16; updateConfetti(16);
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,GW,GH);
  drawConfetti();
  const pw=580,ph=450,px2=GW/2-pw/2,py2=GH/2-ph/2-30;
  ctx.fillStyle='rgba(0,0,0,0.6)'; rrect(px2+6,py2+6,pw,ph,20); ctx.fill();
  const pG=ctx.createLinearGradient(px2,py2,px2,py2+ph);
  pG.addColorStop(0,'#1a1200'); pG.addColorStop(1,'#0d0800');
  ctx.fillStyle=pG; rrect(px2,py2,pw,ph,20); ctx.fill();
  const bp=0.6+0.4*Math.sin(winAnimT/300);
  ctx.strokeStyle=`rgba(255,215,0,${bp})`; ctx.lineWidth=3; rrect(px2,py2,pw,ph,20); ctx.stroke();
  ctx.save(); ctx.globalAlpha=0.07; ctx.font='160px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🏆',GW/2,py2+ph/2); ctx.restore(); ctx.textBaseline='alphabetic';
  const bounce=Math.sin(winAnimT/220)*6;
  ctx.textAlign='center';
  ctx.shadowColor='#ffd700'; ctx.shadowBlur=45;
  ctx.fillStyle='#ffd700'; ctx.font='bold 62px monospace';
  ctx.fillText('VOCE CHEGOU!',GW/2,py2+86+bounce);
  ctx.shadowBlur=0;
  ctx.fillStyle='#ffe8a0'; ctx.font='17px monospace';
  ctx.fillText(`Chegou ao trabalho! Dificuldade: ${D.label}`,GW/2,py2+124);
  ctx.fillStyle='#ffe033'; ctx.font='bold 32px monospace';
  ctx.fillText(`★ ${score} moeda${score!==1?'s':''}`,GW/2,py2+164);
  ctx.fillStyle='#88ff88'; ctx.font='bold 18px monospace';
  ctx.fillText(`Tempo restante: ${timeLeft}s`,GW/2,py2+198);
  const rat=getRating(score);
  ctx.fillStyle=rat.col; ctx.font='bold 22px monospace'; ctx.fillText(rat.txt,GW/2,py2+232);
  ctx.fillStyle='rgba(180,210,255,0.7)'; ctx.font='15px monospace';
  ctx.fillText(`Percurso completo: ${distanceM}m`,GW/2,py2+260);
  const hs=highScores[D.key];
  ctx.fillStyle=isNewRecord?'#ffd700':'rgba(255,215,0,0.5)'; ctx.font=isNewRecord?'bold 16px monospace':'14px monospace';
  ctx.fillText(isNewRecord?`NOVO RECORDE: ${hs}m`:`Recorde ${D.label}: ${hs}m`,GW/2,py2+284);
  const hR=hovWinRetry;
  const rG=ctx.createLinearGradient(BTN_WIN_RETRY.x,BTN_WIN_RETRY.y,BTN_WIN_RETRY.x,BTN_WIN_RETRY.y+BTN_WIN_RETRY.h);
  rG.addColorStop(0,hR?'#c8a000':'#9a7800'); rG.addColorStop(1,hR?'#8a6800':'#5a4400');
  ctx.fillStyle=rG; rrect(BTN_WIN_RETRY.x,BTN_WIN_RETRY.y,BTN_WIN_RETRY.w,BTN_WIN_RETRY.h,14); ctx.fill();
  ctx.strokeStyle=hR?'#ffe066':'#c8a000'; ctx.lineWidth=2; rrect(BTN_WIN_RETRY.x,BTN_WIN_RETRY.y,BTN_WIN_RETRY.w,BTN_WIN_RETRY.h,14); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 24px monospace'; ctx.textAlign='center';
  ctx.fillText('↺  JOGAR NOVAMENTE',GW/2,BTN_WIN_RETRY.y+BTN_WIN_RETRY.h/2+9);
  const hM=hovWinMenu;
  ctx.fillStyle=hM?'#2e2e6e':'#1a1a44'; rrect(BTN_WIN_MENU.x,BTN_WIN_MENU.y,BTN_WIN_MENU.w,BTN_WIN_MENU.h,12); ctx.fill();
  ctx.strokeStyle=hM?'#9898ee':'#505098'; ctx.lineWidth=1.5; rrect(BTN_WIN_MENU.x,BTN_WIN_MENU.y,BTN_WIN_MENU.w,BTN_WIN_MENU.h,12); ctx.stroke();
  ctx.fillStyle='#aabbdd'; ctx.font='18px monospace'; ctx.textAlign='center';
  ctx.fillText('◄  Dificuldade',GW/2,BTN_WIN_MENU.y+BTN_WIN_MENU.h/2+6);
}

// ── Mouse / Touch ─────────────────────────────────────────────────────────────
function canvasXY(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)*(GW/r.width),y:(e.clientY-r.top)*(GH/r.height)};
}
function inBtn(p,b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;}

canvas.addEventListener('mousemove',e=>{
  const pos=canvasXY(e);
  hovBtn=null; hoveredCard=null; hovPause=false; hovResume=false; hovPauseMenu=false;
  hovWinRetry=false; hovWinMenu=false; hovDiff=null; hovBackSelect=false;
  if(gameState==='start')       hovBtn=inBtn(pos,BTN_START)?BTN_START:null;
  else if(gameState==='difficulty') hovDiff=diffCardHit(pos);
  else if(gameState==='select'){CHAR_KEYS.forEach((k,i)=>{const cx=cX(i);if(pos.x>=cx&&pos.x<=cx+CW&&pos.y>=CY&&pos.y<=CY+CH)hoveredCard=k;});hovBackSelect=inBtn(pos,BTN_BACK_SELECT);}
  else if(gameState==='playing') hovPause=inBtn(pos,BTN_PAUSE);
  else if(gameState==='paused'){hovResume=inBtn(pos,BTN_RESUME);hovPauseMenu=inBtn(pos,BTN_PAUSE_MENU);}
  else if(gameState==='gameover') hovBtn=inBtn(pos,BTN_RETRY)?BTN_RETRY:inBtn(pos,BTN_MENU)?BTN_MENU:null;
  else if(gameState==='win'){hovWinRetry=inBtn(pos,BTN_WIN_RETRY);hovWinMenu=inBtn(pos,BTN_WIN_MENU);}
  canvas.style.cursor=(hovBtn||hoveredCard||hovPause||hovResume||hovPauseMenu||hovWinRetry||hovWinMenu||hovDiff||hovBackSelect)?'pointer':'default';
});

canvas.addEventListener('click',e=>{
  const pos=canvasXY(e);
  if(gameState==='start'&&inBtn(pos,BTN_START))         gameState='difficulty';
  else if(gameState==='difficulty'){
    const hit=diffCardHit(pos);
    if(hit){D=DIFFICULTIES[hit]; gameState='select';}
  }
  else if(gameState==='select'){
    if(inBtn(pos,BTN_BACK_SELECT)){gameState='difficulty';}
    else CHAR_KEYS.forEach((k,i)=>{const cx=cX(i);if(pos.x>=cx&&pos.x<=cx+CW&&pos.y>=CY&&pos.y<=CY+CH)startGame(k);});
  }
  else if(gameState==='playing'&&inBtn(pos,BTN_PAUSE))    gameState='paused';
  else if(gameState==='paused'&&inBtn(pos,BTN_RESUME))    gameState='playing';
  else if(gameState==='paused'&&inBtn(pos,BTN_PAUSE_MENU)){resetPlayer();gameState='difficulty';}
  else if(gameState==='gameover'){
    if(inBtn(pos,BTN_RETRY)){resetPlayer();gameState='playing';}
    else if(inBtn(pos,BTN_MENU)){resetPlayer();gameState='difficulty';}
  } else if(gameState==='win'){
    if(inBtn(pos,BTN_WIN_RETRY)){resetPlayer();gameState='playing';}
    else if(inBtn(pos,BTN_WIN_MENU)){resetPlayer();gameState='difficulty';}
  }
});

function startGame(key){
  activeChar=CHARS[key];
  dCW=activeChar.colW*activeChar.scale;
  dWH=activeChar.walk.h*activeChar.scale;
  dJH=activeChar.jump.h*activeChar.scale;
  resetPlayer(); canvas.style.cursor='default'; gameState='playing';
}

// ── Game loop ─────────────────────────────────────────────────────────────────
let lastTs=0;
function loop(ts){
  const dt=Math.min(ts-lastTs,50); lastTs=ts;
  ctx.imageSmoothingEnabled=false;
  switch(gameState){
    case 'loading':    /* HTML overlay handles this */  break;
    case 'start':      drawStartScreen(dt);    break;
    case 'difficulty': drawDifficultyScreen(); break;
    case 'select':     drawSelectScreen();     break;
    case 'playing':
      update(dt);
      drawBackground();
      drawFinishLine();
      drawObstacles(); drawCoins(); drawCoffees(); drawSteam();
      drawPlayer(); drawPopups(); drawHUD();
      break;
    case 'paused':
      drawBackground();
      drawFinishLine();
      drawObstacles(); drawCoins(); drawCoffees(); drawSteam();
      drawPlayer(); drawHUD(); drawPauseScreen();
      break;
    case 'gameover':
      drawBackground();
      drawObstacles(); drawCoins(); drawCoffees(); drawSteam();
      drawPlayer(); drawGameOverScreen();
      break;
    case 'win':
      drawBackground();
      drawObstacles(); drawCoins(); drawCoffees(); drawSteam();
      drawPlayer(); drawWinScreen();
      break;
  }
  requestAnimationFrame(loop);
}

loadAllChars();
requestAnimationFrame(loop);

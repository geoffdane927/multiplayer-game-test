const W=16,H=12;
const MAPS=[
{name:'Crossroads',rows:['################','#..............#','#.####.#####.#.#','#.#..#.#...#.#.#','#.#..#.#.#.#...#','#....#...#.....#','#.######.#.###.#','#........#.....#','#.######.#####.#','#..............#','#..............#','################']},
{name:'Rooms',rows:['################','#......#.......#','#.####.#.#####.#','#.#....#.....#.#','#.#.########.#.#','#.#............#','#.####.#####.###','#......#.......#','#.####.#.#####.#','#......#.......#','#..............#','################']},
{name:'Dead Ends',rows:['################','#..............#','#.#####.#####..#','#.#...#.#...#..#','#.#.#.#.#.#.####','#...#...#.#....#','###.#####.####.#','#...#.......#..#','#.#.#######.#..#','#.#...........##','#..............#','################']},
{name:'Labyrinth',rows:['################','#.....#........#','#.###.#.######.#','#.#...#....#...#','#.#.####.#.#.###','#.#......#.#...#','#.######.#.###.#','#......#.#.....#','#.####.#.#####.#','#....#..........#','#...............#','################']},
{name:'Fortress',rows:['################','#....#.........#','#.##.#.#######.#','#.#..#.#.......#','#.#.##.#.#####.#','#...#..#.....#.#','###.#.####.#.#.#','#...#......#...#','#.########.###.#','#..............#','#..............#','################']}
];

const $=s=>document.querySelector(s);
const status=$('#status'),hostPanel=$('#hostPanel'),joinPanel=$('#joinPanel');
let peer=null,host=false,id=null,players={},selectedMap=null,map=[];
const connections=new Map();
let game=$('#game'),g=game.getContext('2d');
let me={x:1.5,y:1.5,a:0,alive:true};
let keys={},running=false,flash='',lastAtk=0,last=0,lastNet=0;
const MAX_PLAYERS=8;

function makeMap(def){return def.rows.map(row=>row.split('').map(c=>c==='#'?1:0));}
function setStatus(text){status.textContent=text;}
function randomId(){return Math.random().toString(36).slice(2,10);}
function partyCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s;}
function sendTo(c,msg){if(c&&c.open)c.send(msg);}
function broadcast(msg){for(const c of connections.values())sendTo(c,msg);}
function wall(x,y){return x<0||y<0||x>=W||y>=H||map[Math.floor(y)]?.[Math.floor(x)]===1;}

function safeSpawn(preferred,angle){
 const sx=Math.floor(preferred[0]),sy=Math.floor(preferred[1]);
 if(map[sy]?.[sx]===0)return [preferred[0],preferred[1],angle];
 for(let r=1;r<Math.max(W,H);r++){
  for(let y=sy-r;y<=sy+r;y++)for(let x=sx-r;x<=sx+r;x++){
   if(x>=1&&y>=1&&x<W-1&&y<H-1&&map[y]?.[x]===0)return [x+.5,y+.5,angle];
  }
 }
 return [1.5,1.5,angle];
}

function findOpenSpawn(){
 const candidates=[];
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  if(map[y]?.[x]!==0)continue;
  const px=x+.5,py=y+.5;
  if(Object.values(players).some(p=>Math.hypot(p.x-px,p.y-py)<1.25))continue;
  candidates.push([px,py]);
 }
 if(!candidates.length)return safeSpawn([1.5,1.5],0);
 return [...candidates[Math.floor(Math.random()*candidates.length)],Math.random()*Math.PI*2];
}

function setupConnection(c){
 if(!c)return;
 c.on('open',()=>{
  if(!host){
   setStatus('Connected! Loading arena...');
   sendTo(c,{t:'hello',id});
  }else{
   setStatus(`Player connected! ${connections.size} other player${connections.size===1?'':'s'}.`);
  }
 });
 c.on('data',data=>{try{const m=typeof data==='string'?JSON.parse(data):data;handleMessage(c,m);}catch(e){setStatus('Network data error.');}});
 c.on('close',()=>{
  const pid=c.playerId;
  connections.delete(c);
  if(host&&pid){delete players[pid];broadcast({t:'snap',players});setStatus(`Player left. ${connections.size} connected.`);}
 });
 c.on('error',e=>setStatus('Connection error: '+(e?.type||e?.message||'unknown')));
}

function createPeer(peerId){
 return new Promise((resolve,reject)=>{
  peer=new Peer(peerId,{debug:0});
  let done=false;
  const timer=setTimeout(()=>{if(!done){done=true;reject(new Error('PeerJS timed out'));}},12000);
  peer.on('open',()=>{if(done)return;done=true;clearTimeout(timer);resolve();});
  peer.on('error',e=>{if(!done){done=true;clearTimeout(timer);reject(e);}});
 });
}

async function makeHost(){
 const btn=$('#hostBtn');
 if(btn.disabled)return;
 if(!window.Peer){setStatus('PeerJS did not load. Refresh the page and check your internet connection.');return;}
 btn.disabled=true;
 host=true;
 id='host';
 selectedMap=MAPS[Math.floor(Math.random()*MAPS.length)];
 map=makeMap(selectedMap);
 const spawn=safeSpawn([2.5,2.5],0);
 me={x:spawn[0],y:spawn[1],a:spawn[2],alive:true};
 players={host:{id:'host',x:me.x,y:me.y,a:me.a,alive:true,k:0}};
 const party=partyCode();
 $('#partyCode').textContent=party;
 $('#hostWait').textContent='Share this code with the other players. Waiting...';
 setStatus('Creating party '+party+'...');
 try{
  await createPeer(party);
  peer.on('connection',c=>{
   if(connections.size>=MAX_PLAYERS-1){c.close();return;}
   connections.set(c,c);
   setupConnection(c);
  });
  peer.on('disconnected',()=>setStatus('Signaling disconnected. Reconnecting...'));
  $('#mapName').textContent=selectedMap.name;
  start();
  setStatus('Party '+party+' is ready. Waiting for players...');
 }catch(e){
  host=false;btn.disabled=false;
  setStatus('Could not create party: '+(e?.type||e?.message||'unknown error'));
 }
}

async function makeJoin(){
 const btn=$('#joinBtn');
 if(btn.disabled)return;
 if(!window.Peer){setStatus('PeerJS did not load. Refresh the page and check your internet connection.');return;}
 const party=$('#partyInput').value.trim().toUpperCase();
 if(!/^[A-Z0-9]{4}$/.test(party)){setStatus('Enter exactly 4 letters/numbers.');return;}
 btn.disabled=true;
 host=false;
 id=randomId();
 setStatus('Connecting to '+party+'...');
 try{
  await createPeer();
  const c=peer.connect(party,{reliable:true});
  connections.set(c,c);
  setupConnection(c);
  setTimeout(()=>{
   if(!c.open){btn.disabled=false;setStatus('Could not find that party. Check the code and try again.');}
  },12000);
 }catch(e){
  btn.disabled=false;
  setStatus('Could not connect: '+(e?.type||e?.message||'unknown error'));
 }
}

function handleMessage(c,m){
 if(host){
  if(m.t==='hello'){
   if(players[m.id])return;
   if(Object.keys(players).length>=MAX_PLAYERS){sendTo(c,{t:'full'});c.close();return;}
   c.playerId=m.id;
   const spawn=findOpenSpawn();
   players[m.id]={id:m.id,x:spawn[0],y:spawn[1],a:spawn[2],alive:true,k:0};
   sendTo(c,{t:'state',map,players,id:m.id,mapName:selectedMap.name});
   broadcast({t:'snap',players});
   return;
  }
  if(m.t==='input'){
   const p=players[m.id];
   if(!p)return;
   p.x=m.x;p.y=m.y;p.a=m.a;
   if(m.attack&&performance.now()-lastAtk>350){lastAtk=performance.now();stab(m.id);}
  }
 }else{
  if(m.t==='state'){
   map=m.map;players=m.players;id=m.id;
   if(!players[id])return;
   me.x=players[id].x;me.y=players[id].y;me.a=players[id].a;me.alive=players[id].alive;
   $('#mapName').textContent=m.mapName||'Arena';
   start();
  }else if(m.t==='snap'){
   players=m.players||{};
   if(players[id]){me.x=players[id].x;me.y=players[id].y;me.a=players[id].a;me.alive=players[id].alive;}
  }else if(m.t==='hit'){
   flash=m.victim===id?'STABBED!':'HIT!';
   setTimeout(()=>{if(flash==='STABBED!'||flash==='HIT!')flash='';},700);
  }else if(m.t==='full'){
   setStatus('That lobby is full.');
  }
 }
}

function send(msg){
 if(host)broadcast(msg);
 else sendTo(connections.values().next().value,msg);
}

function stab(attackerId){
 const a=players[attackerId];
 if(!a?.alive)return;
 for(const k in players){
  const b=players[k];
  if(k===attackerId||!b.alive)continue;
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d>.95)continue;
  const aim=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-a.a),Math.cos(Math.atan2(dy,dx)-a.a)));
  if(aim>.72)continue;
  const victimToAttacker=Math.atan2(a.y-b.y,a.x-b.x);
  if(Math.cos(victimToAttacker-b.a)<=0){
   b.alive=false;a.k++;
   broadcast({t:'hit',victim:k});
  }
 }
}

$('#hostTab').addEventListener('click',()=>{
 hostPanel.hidden=false;joinPanel.hidden=true;setStatus('Ready to host a game.');
});
$('#joinTab').addEventListener('click',()=>{
 hostPanel.hidden=true;joinPanel.hidden=false;setStatus("Enter the host's party code.");
 setTimeout(()=>$('#partyInput').focus(),0);
});
$('#hostBtn').addEventListener('click',makeHost);
$('#joinBtn').addEventListener('click',makeJoin);
$('#partyInput').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);});

window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault();});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
game.addEventListener('click',()=>game.requestPointerLock?.());
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===game)me.a+=e.movementX*.0025;});

function start(){
 if(running)return;
 if(!host&&!connections.values().next().value?.open)return;
 running=true;$('#menu').hidden=true;game.hidden=false;$('#hud').hidden=false;resize();requestAnimationFrame(loop);
}
function resize(){game.width=Math.min(innerWidth,1280);game.height=Math.min(innerHeight,720);}
window.addEventListener('resize',resize);

function move(dx,dy){
 if(!wall(me.x+dx,me.y)&&!wall(me.x+dx,me.y+.15)&&!wall(me.x+dx,me.y-.15))me.x+=dx;
 if(!wall(me.x,me.y+dy)&&!wall(me.x+.15,me.y+dy)&&!wall(me.x-.15,me.y+dy))me.y+=dy;
}
function ray(angle){
 const sx=Math.cos(angle),sy=Math.sin(angle);let x=me.x,y=me.y,d=0;
 while(d<30){x+=sx*.025;y+=sy*.025;d+=.025;if(wall(x,y))break;}
 return d;
}

function render(){
 const w=game.width,h=game.height;
 g.fillStyle='#171923';g.fillRect(0,0,w,h/2);
 g.fillStyle='#29251f';g.fillRect(0,h/2,w,h/2);
 const f=Math.PI/3,n=Math.ceil(w/3);
 for(let i=0;i<n;i++){
  const angle=me.a-f/2+f*(i+.5)/n;
  const distance=ray(angle)*Math.cos(angle-me.a);
  const hh=Math.min(h*2,h/Math.max(.01,distance));
  const shade=Math.max(25,150-Math.min(distance,30)*4.2);
  g.fillStyle=`rgb(${shade},${shade},${Math.min(255,shade+8)})`;
  g.fillRect(i*w/n,h/2-hh/2,w/n+1,hh);
 }
 const seen=[];
 for(const k in players){
  const p=players[k];
  if(k===id||!p.alive)continue;
  const dx=p.x-me.x,dy=p.y-me.y,d=Math.hypot(dx,dy);
  let angle=Math.atan2(dy,dx)-me.a;
  angle=Math.atan2(Math.sin(angle),Math.cos(angle));
  if(Math.abs(angle)<f*.65&&ray(me.a+angle)>d-.25){
   const x=w/2+Math.tan(angle)/Math.tan(f/2)*w/2;
   const size=Math.min(h*1.5,h/(d*.9));
   seen.push({x,size,d});
  }
 }
 seen.sort((a,b)=>b.d-a.d);
 for(const q of seen){
  const shade=Math.max(45,240-Math.min(q.d,30)*5);
  g.fillStyle=`rgb(${shade},${shade},${shade})`;
  g.fillRect(q.x-q.size*.12,h/2-q.size*.75,q.size*.24,q.size*.7);
  g.fillStyle=`rgb(${Math.max(40,200-q.d*4)},${Math.max(40,200-q.d*4)},${Math.max(50,220-q.d*4)})`;
  g.beginPath();g.arc(q.x,h/2-q.size*.88,q.size*.16,0,Math.PI*2);g.fill();
 }
 g.strokeStyle='#fff';g.beginPath();g.moveTo(w/2-8,h/2);g.lineTo(w/2+8,h/2);g.moveTo(w/2,h/2-8);g.lineTo(w/2,h/2+8);g.stroke();
 if(flash){g.fillStyle='#fff';g.font='bold 32px system-ui';g.textAlign='center';g.fillText(flash,w/2,h*.25);}
}

function loop(t){
 const dt=Math.min(.04,(t-last||16)/1000);last=t;
 if(me.alive){
  const speed=2.7*dt;
  if(keys.KeyW)move(Math.cos(me.a)*speed,Math.sin(me.a)*speed);
  if(keys.KeyS)move(-Math.cos(me.a)*speed,-Math.sin(me.a)*speed);
  if(keys.KeyA)move(Math.cos(me.a-Math.PI/2)*speed,Math.sin(me.a-Math.PI/2)*speed);
  if(keys.KeyD)move(Math.cos(me.a+Math.PI/2)*speed,Math.sin(me.a+Math.PI/2)*speed);
 }
 if(host){
  players.host.x=me.x;players.host.y=me.y;players.host.a=me.a;
  if(keys.Space&&t-lastAtk>350){lastAtk=t;stab('host');}
 }
 if(t-lastNet>50){
  lastNet=t;
  if(host)broadcast({t:'snap',players});
  else send({t:'input',id,x:me.x,y:me.y,a:me.a,attack:keys.Space});
 }
 render();
 $('#players').textContent='Players: '+Object.keys(players).length;
 $('#state').textContent=me.alive?'Alive — flank them':'ELIMINATED';
 requestAnimationFrame(loop);
}

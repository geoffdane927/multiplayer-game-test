const W=16,H=12;
const MAPS=[
{name:'Crossroads',spawn:[[2.5,2.5,0],[13.5,9.5,Math.PI]],rows:['################','#..............#','#.####.#####.#.#','#.#..#.#...#.#.#','#.#..#.#.#.#...#','#....#...#.....#','#.######.#.###.#','#........#.....#','#.######.#####.#','#..............#','#..............#','################']},
{name:'Rooms',spawn:[[2.5,9.5,-Math.PI/2],[13.5,2.5,Math.PI/2]],rows:['################','#......#.......#','#.####.#.#####.#','#.#....#.....#.#','#.#.########.#.#','#.#............#','#.####.#####.###','#......#.......#','#.####.#.#####.#','#......#.......#','#..............#','################']},
{name:'Dead Ends',spawn:[[2.5,2.5,0],[13.5,9.5,Math.PI]],rows:['################','#..............#','#.#####.#####..#','#.#...#.#...#..#','#.#.#.#.#.#.####','#...#...#.#....#','###.#####.####.#','#...#.......#..#','#.#.#######.#..#','#.#...........##','#..............#','################']},
{name:'Labyrinth',spawn:[[2.5,9.5,-Math.PI/2],[13.5,2.5,Math.PI/2]],rows:['################','#.....#........#','#.###.#.######.#','#.#...#....#...#','#.#.####.#.#.###','#.#......#.#...#','#.######.#.###.#','#......#.#.....#','#.####.#.#####.#','#....#..........#','#...............#','################']},
{name:'Fortress',spawn:[[2.5,2.5,0],[13.5,9.5,Math.PI]],rows:['################','#....#.........#','#.##.#.#######.#','#.#..#.#.......#','#.#.##.#.#####.#','#...#..#.....#.#','###.#.####.#.#.#','#...#......#...#','#.########.###.#','#..............#','#..............#','################']}
];
function makeMap(def){return def.rows.map(r=>r.split('').map(c=>c==='#'?1:0))}
const $=s=>document.querySelector(s),status=$('#status'),hp=$('#hostPanel'),jp=$('#joinPanel');
$('#hostTab').addEventListener('click',()=>{hp.hidden=false;jp.hidden=true;status.textContent='Ready to host a game.'});
$('#joinTab').addEventListener('click',()=>{hp.hidden=true;jp.hidden=false;status.textContent='Enter the host\'s party code.';setTimeout(()=>$('#partyInput').focus(),0)});
let peer=null,conn=null,host=false,id=null,players={},selectedMap=null,map=[];
const uid=()=>Math.random().toString(36).slice(2,10);
const code=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s};
function setStatus(s){status.textContent=s}
function setupConnection(c){
 conn=c;
 c.on('open',()=>{setStatus(host?'Player connected!':'Connected! Loading arena...');if(!host)send({t:'hello',id})});
 c.on('data',m=>{try{msg(typeof m==='string'?JSON.parse(m):m)}catch(e){setStatus('Network data error.')}});
 c.on('close',()=>setStatus('Connection closed.'));
 c.on('error',e=>setStatus('Connection error: '+(e?.type||e?.message||'unknown')));
}
function createPeer(peerId){
 return new Promise((resolve,reject)=>{
  peer=new Peer(peerId,{debug:0});
  const timeout=setTimeout(()=>reject(new Error('PeerJS timed out')),10000);
  peer.on('open',()=>{clearTimeout(timeout);resolve()});
  peer.on('error',e=>{clearTimeout(timeout);reject(e)});
 });
}
async function makeHost(){
 const btn=$('#hostBtn');if(btn.disabled)return;
 if(!window.Peer){setStatus('PeerJS did not load. Check your internet connection and refresh.');return}
 btn.disabled=true;host=true;selectedMap=MAPS[Math.floor(Math.random()*MAPS.length)];map=makeMap(selectedMap);id='host';
 players={host:{id:'host',x:selectedMap.spawn[0][0],y:selectedMap.spawn[0][1],a:selectedMap.spawn[0][2],alive:true,k:0}};
 const party=code();$('#partyCode').textContent=party;$('#hostWait').textContent='Share this code with the other player. Waiting...';setStatus('Creating party '+party+'...');
 try{
  await createPeer(party);
  setStatus('Party '+party+' is ready. Waiting for a player...');
  peer.on('connection',c=>{if(conn){c.close();return}setupConnection(c)});
  peer.on('disconnected',()=>setStatus('Signaling server disconnected. Reconnecting...'));
 }catch(e){btn.disabled=false;setStatus('Could not create party: '+(e?.type||e?.message||'unknown error'))}
}
$('#hostBtn').addEventListener('click',makeHost);
async function makeJoin(){
 const btn=$('#joinBtn');if(btn.disabled)return;
 if(!window.Peer){setStatus('PeerJS did not load. Check your internet connection and refresh.');return}
 const party=$('#partyInput').value.trim().toUpperCase();
 if(!/^[A-Z0-9]{4}$/.test(party)){setStatus('Enter exactly 4 letters/numbers.');return}
 btn.disabled=true;host=false;id=uid();setStatus('Connecting to '+party+'...');
 try{
  await createPeer();
  setupConnection(peer.connect(party,{reliable:true}));
  setTimeout(()=>{if(!conn?.open){btn.disabled=false;setStatus('Could not find that party. Check the code and try again.')}},10000);
 }catch(e){btn.disabled=false;setStatus('Could not connect: '+(e?.type||e?.message||'unknown error'))}
}
$('#joinBtn').addEventListener('click',makeJoin);
$('#partyInput').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)});

function send(o){if(conn?.open)conn.send(o)}
function msg(m){
 if(host){
  if(m.t==='hello'&&!players[m.id]){const s=selectedMap.spawn[1];players[m.id]={id:m.id,x:s[0],y:s[1],a:s[2],alive:true,k:0};send({t:'state',map,players,id:m.id,mapName:selectedMap.name})}
  if(m.t==='input'){const p=players[m.id];if(p){p.x=m.x;p.y=m.y;p.a=m.a;if(m.attack&&performance.now()-lastAtk>350){lastAtk=performance.now();stab(m.id)}}}
 }else{
  if(m.t==='state'){map=m.map;players=m.players;id=m.id;me.x=players[id].x;me.y=players[id].y;me.a=players[id].a;me.alive=true;$('#mapName').textContent=m.mapName||'Arena';start()}
  if(m.t==='snap'){players=m.players;if(players[id]){me.x=players[id].x;me.y=players[id].y;me.a=players[id].a;me.alive=players[id].alive}}
  if(m.t==='hit')flash=m.victim===id?'STABBED!':'HIT!'
 }
}
function stab(att){const a=players[att];if(!a?.alive)return;for(const k in players){const b=players[k];if(k===att||!b.alive)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>.95)continue;const aim=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-a.a),Math.cos(Math.atan2(dy,dx)-a.a)));if(aim>.72)continue;const victimToAttacker=Math.atan2(a.y-b.y,a.x-b.x);if(Math.cos(victimToAttacker-b.a)<=0){b.alive=false;a.k++;send({t:'hit',victim:k})}}}

let game=$('#game'),g=game.getContext('2d'),me={x:2.5,y:2.5,a:0,alive:true},keys={},running=false,flash='',lastAtk=0,last=0,lastNet=0;
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault()});window.addEventListener('keyup',e=>keys[e.code]=false);
game.addEventListener('click',()=>game.requestPointerLock?.());document.addEventListener('mousemove',e=>{if(document.pointerLockElement===game)me.a+=e.movementX*.0025});
function start(){if(running||!conn?.open)return;running=true;$('#menu').hidden=true;game.hidden=false;$('#hud').hidden=false;resize();requestAnimationFrame(loop)}
function resize(){game.width=Math.min(innerWidth,1280);game.height=Math.min(innerHeight,720)}window.addEventListener('resize',resize);
function wall(x,y){return x<0||y<0||x>=W||y>=H||map[Math.floor(y)]?.[Math.floor(x)]===1}
function move(dx,dy){if(!wall(me.x+dx,me.y)&&!wall(me.x+dx,me.y+.15)&&!wall(me.x+dx,me.y-.15))me.x+=dx;if(!wall(me.x,me.y+dy)&&!wall(me.x+.15,me.y+dy)&&!wall(me.x-.15,me.y+dy))me.y+=dy}
function ray(a){const sx=Math.cos(a),sy=Math.sin(a);let x=me.x,y=me.y,d=0;while(d<30){x+=sx*.025;y+=sy*.025;d+=.025;if(wall(x,y))break}return d}
function render(){const w=game.width,h=game.height;g.fillStyle='#171923';g.fillRect(0,0,w,h/2);g.fillStyle='#29251f';g.fillRect(0,h/2,w,h/2);const f=Math.PI/3,n=Math.ceil(w/3);for(let i=0;i<n;i++){const a=me.a-f/2+f*(i+.5)/n,d=ray(a)*Math.cos(a-me.a),hh=Math.min(h*2,h/Math.max(.01,d));g.fillStyle='#808a99';g.fillRect(i*w/n,h/2-hh/2,w/n+1,hh)}const seen=[];for(const k in players){const p=players[k];if(!p.alive||(!host&&k===id))continue;const dx=p.x-me.x,dy=p.y-me.y,d=Math.hypot(dx,dy);let a=Math.atan2(dy,dx)-me.a;a=Math.atan2(Math.sin(a),Math.cos(a));if(Math.abs(a)<f*.65&&ray(me.a+a)>d-.25){const x=w/2+Math.tan(a)/Math.tan(f/2)*w/2,s=Math.min(h*1.5,h/(d*.9));seen.push({x,s,d})}}seen.sort((a,b)=>b.d-a.d);for(const q of seen){g.fillStyle='#ddd';g.fillRect(q.x-q.s*.12,h/2-q.s*.75,q.s*.24,q.s*.7);g.fillStyle='#b9c1cf';g.beginPath();g.arc(q.x,h/2-q.s*.88,q.s*.16,0,7);g.fill()}g.strokeStyle='#fff';g.beginPath();g.moveTo(w/2-8,h/2);g.lineTo(w/2+8,h/2);g.moveTo(w/2,h/2-8);g.lineTo(w/2,h/2+8);g.stroke();if(flash){g.fillStyle='#fff';g.font='bold 32px system-ui';g.textAlign='center';g.fillText(flash,w/2,h*.25)}}
function loop(t){const dt=Math.min(.04,(t-last||16)/1000);last=t;if(me.alive){const s=2.7*dt;if(keys.KeyW)move(Math.cos(me.a)*s,Math.sin(me.a)*s);if(keys.KeyS)move(-Math.cos(me.a)*s,-Math.sin(me.a)*s);if(keys.KeyA)move(Math.cos(me.a-Math.PI/2)*s,Math.sin(me.a-Math.PI/2)*s);if(keys.KeyD)move(Math.cos(me.a+Math.PI/2)*s,Math.sin(me.a+Math.PI/2)*s)}if(host){players.host.x=me.x;players.host.y=me.y;players.host.a=me.a;if(keys.Space&&t-lastAtk>350){lastAtk=t;stab('host')}}if(t-lastNet>50){lastNet=t;if(host)send({t:'snap',players});else send({t:'input',id,x:me.x,y:me.y,a:me.a,attack:keys.Space})}render();$('#players').textContent='Players: '+Object.keys(players).length;$('#state').textContent=me.alive?'Alive — flank them':'ELIMINATED';requestAnimationFrame(loop)}

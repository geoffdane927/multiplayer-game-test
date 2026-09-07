const W=16,H=12;
const MAPS=[
{name:'Crossroads',spawn:[[2.5,2.5,0],[13.5,9.5,Math.PI]],rows:['################','#..............#','#.####.#####.#.#','#.#..#.#...#.#.#','#.#..#.#.#.#...#','#....#...#.....#','#.######.#.###.#','#........#.....#','#.######.#####.#','#..............#','#..............#','################']},
{name:'Rooms',spawn:[[2.5,9.5,-Math.PI/2],[13.5,2.5,Math.PI/2]],rows:['################','#......#.......#','#.####.#.#####.#','#.#....#.....#.#','#.#.########.#.#','#.#............#','#.####.#####.###','#......#.......#','#.####.#.#####.#','#......#.......#','#..............#','################']},
{name:'Dead Ends',spawn:[[2.5,2.5,0],[13.5,9.5,Math.PI]],rows:['################','#..............#','#.#####.#####..#','#.#...#.#...#..#','#.#.#.#.#.#.####','#...#...#.#....#','###.#####.####.#','#...#.......#..#','#.#.#######.#..#','#.#...........##','#..............#','################']},
{name:'Labyrinth',spawn:[[2.5,9.5,-Math.PI/2],[13.5,2.5,Math.PI/2]],rows:['################','#.....#........#','#.###.#.######.#','#.#...#....#...#','#.#.####.#.#.###','#.#......#.#...#','#.######.#.###.#','#......#.#.....#','#.####.#.#####.#','#....#..........#','#...............#','################']},
{name:'Fortress',spawn:[[2.5,2.5,0],[13.5,9.5,Math.PI]],rows:['################','#....#.........#','#.##.#.#######.#','#.#..#.#.......#','#.#.##.#.#####.#','#...#..#.....#.#','###.#.####.#.#.#','#...#......#...#','#.########.###.#','#..............#','#..............#','################']}
];
function makeMap(def){return def.rows.map(r=>r.split('').map(c=>c==='#'?1:0))}
let selectedMap=null,map=[];
const status=document.querySelector('#status'),hp=document.querySelector('#hostPanel'),jp=document.querySelector('#joinPanel');
hostTab.onclick=()=>{hp.hidden=false;jp.hidden=true};joinTab.onclick=()=>{hp.hidden=true;jp.hidden=false};
let peer=null,conn=null,host=false,id=null,players={},uid=Math.random().toString(36).slice(2),lastAtk=0,lastNet=0;
function code(){return Math.random().toString(36).slice(2,6).toUpperCase()}
function showGame(){document.querySelector('#menu').hidden=true;game.hidden=false;hud.hidden=false;resize();if(!running){running=true;requestAnimationFrame(loop)}}
function setupConnection(c){conn=c;c.onopen=()=>{status.textContent=host?'Waiting for a player...':'Connected!';if(!host)conn.send(JSON.stringify({t:'hello',id:uid}))};c.ondata=e=>msg(JSON.parse(e.data));c.onclose=()=>{status.textContent='Connection closed.'}}
function newPeer(party){return new Promise((resolve,reject)=>{peer=new Peer(party,{debug:0});peer.on('open',()=>resolve());peer.on('error',reject)})}
async function makeHost(){
 host=true;const party=code();document.querySelector('#partyCode').textContent=party;document.querySelector('#hostWait').textContent='Share this code with the other player. Waiting for them to join...';hostBtn.disabled=true;
 selectedMap=MAPS[Math.floor(Math.random()*MAPS.length)];map=makeMap(selectedMap);id='host';players={host:{id:'host',x:selectedMap.spawn[0][0],y:selectedMap.spawn[0][1],a:selectedMap.spawn[0][2],alive:true,k:0}};
 try{await newPeer(party);peer.on('connection',c=>{if(conn)return;setupConnection(c)})}catch(e){status.textContent='Could not create party: '+e.type}}
hostBtn.onclick=makeHost;
async function makeJoin(){
 const party=partyInput.value.trim().toUpperCase();if(!/^[A-Z0-9]{4}$/.test(party)){status.textContent='Enter a 4-letter party code.';return}joinBtn.disabled=true;
 try{await newPeer(party);setupConnection(peer.connect(party))}catch(e){joinBtn.disabled=false;status.textContent='Could not join party. Check the code.'}}
joinBtn.onclick=makeJoin;
function msg(m){
 if(host){
  if(m.t==='hello'&&!players[m.id]){let s=selectedMap.spawn[1];players[m.id]={id:m.id,x:s[0],y:s[1],a:s[2],alive:true,k:0};conn.send(JSON.stringify({t:'state',map,players,id:m.id,mapName:selectedMap.name}))}
  if(m.t==='input'){let p=players[m.id];if(p){p.x=m.x;p.y=m.y;p.a=m.a;if(m.attack&&performance.now()-lastAtk>350){lastAtk=performance.now();stab(m.id)}}}
 }else{
  if(m.t==='state'){map=m.map;players=m.players;id=m.id;me.x=players[id].x;me.y=players[id].y;me.a=players[id].a;me.alive=true;document.querySelector('#mapName').textContent=m.mapName||'Arena';showGame()}
  if(m.t==='snap'){players=m.players;if(players[id]){me.x=players[id].x;me.y=players[id].y;me.a=players[id].a;me.alive=players[id].alive}}
  if(m.t==='hit')flash=m.victim===id?'STABBED!':'HIT!'
 }
}
function send(o){if(conn?.open)conn.send(JSON.stringify(o))}
function broadcast(o){send(o)}
function stab(att){let a=players[att];if(!a?.alive)return;for(let k in players){let b=players[k];if(k===att||!b.alive)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>.95)continue;let aim=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-a.a),Math.cos(Math.atan2(dy,dx)-a.a)));if(aim>.72)continue;let victimToAttacker=Math.atan2(a.y-b.y,a.x-b.x);if(Math.cos(victimToAttacker-b.a)<=0){b.alive=false;a.k++;broadcast({t:'hit',victim:k})}}}
let game=document.querySelector('#game'),g=game.getContext('2d'),me={x:2.5,y:2.5,a:0,alive:true},keys={},running=false,flash='';
onkeydown=e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault()};onkeyup=e=>keys[e.code]=false;
document.onclick=()=>{if(!game.hidden)game.requestPointerLock?.()};document.onmousemove=e=>{if(document.pointerLockElement===game)me.a+=e.movementX*.0025};
function resize(){game.width=Math.min(innerWidth,1280);game.height=Math.min(innerHeight,720)}onresize=resize;
function wall(x,y){return x<0||y<0||x>=W||y>=H||map[Math.floor(y)]?.[Math.floor(x)]===1}
function move(dx,dy){if(!wall(me.x+dx,me.y)&&!wall(me.x+dx,me.y+.15)&&!wall(me.x+dx,me.y-.15))me.x+=dx;if(!wall(me.x,me.y+dy)&&!wall(me.x+.15,me.y+dy)&&!wall(me.x-.15,me.y+dy))me.y+=dy}
function ray(a){let sx=Math.cos(a),sy=Math.sin(a),x=me.x,y=me.y,d=0;while(d<30){x+=sx*.025;y+=sy*.025;d+=.025;if(wall(x,y))break}return d}
function render(){let w=game.width,h=game.height;g.fillStyle='#171923';g.fillRect(0,0,w,h/2);g.fillStyle='#29251f';g.fillRect(0,h/2,w,h/2);let f=Math.PI/3,n=Math.ceil(w/3);for(let i=0;i<n;i++){let a=me.a-f/2+f*(i+.5)/n,d=ray(a)*Math.cos(a-me.a),hh=Math.min(h*2,h/Math.max(.01,d));g.fillStyle='#808a99';g.fillRect(i*w/n,h/2-hh/2,w/n+1,hh)}let seen=[];for(let k in players){let p=players[k];if(!p.alive||(!host&&k===id))continue;let dx=p.x-me.x,dy=p.y-me.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)-me.a;a=Math.atan2(Math.sin(a),Math.cos(a));if(Math.abs(a)<f*.65&&ray(me.a+a)>d-.25){let x=w/2+Math.tan(a)/Math.tan(f/2)*w/2,s=Math.min(h*1.5,h/(d*.9));seen.push({x,s,d})}}seen.sort((a,b)=>b.d-a.d);for(let q of seen){g.fillStyle='#ddd';g.fillRect(q.x-q.s*.12,h/2-q.s*.75,q.s*.24,q.s*.7);g.fillStyle='#b9c1cf';g.beginPath();g.arc(q.x,h/2-q.s*.88,q.s*.16,0,7);g.fill()}g.strokeStyle='#fff';g.beginPath();g.moveTo(w/2-8,h/2);g.lineTo(w/2+8,h/2);g.moveTo(w/2,h/2-8);g.lineTo(w/2,h/2+8);g.stroke();if(flash){g.fillStyle='#fff';g.font='bold 32px system-ui';g.textAlign='center';g.fillText(flash,w/2,h*.25)}}
let last=0;function loop(t){let dt=Math.min(.04,(t-last||16)/1000);last=t;if(me.alive){let s=2.7*dt;if(keys.KeyW)move(Math.cos(me.a)*s,Math.sin(me.a)*s);if(keys.KeyS)move(-Math.cos(me.a)*s,-Math.sin(me.a)*s);if(keys.KeyA)move(Math.cos(me.a-Math.PI/2)*s,Math.sin(me.a-Math.PI/2)*s);if(keys.KeyD)move(Math.cos(me.a+Math.PI/2)*s,Math.sin(me.a+Math.PI/2)*s)}if(host){players.host.x=me.x;players.host.y=me.y;players.host.a=me.a;if(keys.Space&&t-lastAtk>350){lastAtk=t;stab('host')}}if(t-lastNet>50){lastNet=t;if(host)broadcast({t:'snap',players});else send({t:'input',id,x:me.x,y:me.y,a:me.a,attack:keys.Space})}render();playersEl.textContent='Players: '+Object.keys(players).length;state.textContent=me.alive?'Alive — flank them':'ELIMINATED';requestAnimationFrame(loop)}
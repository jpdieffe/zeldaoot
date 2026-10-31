import {parseCode} from './rooms.js';
import {AdventureNetwork} from './network.js';
import {Rendezvous} from './rendezvous.js';
const rendezvous=new Rendezvous();let joinGeneration=0,joinStatus='Connecting to your friend';
const params=new URLSearchParams(location.search),role=params.get('role')==='join'?'join':'host',code=parseCode(params.get('room')||'');
if(!code){location.replace('./');throw Error('A room code is required');}
const $=s=>document.querySelector(s),players=new Map();let resetting=false,pendingReset=null,previousLoaded=false,engineReady=false;
document.body.insertAdjacentHTML('beforeend',`<div id="together-ui"><nav class="session-bar"><a href="./">← Leave</a><strong>ROOM <span id="room-code"></span></strong><span id="connection-status">Preparing Hyrule…</span><button id="invite">Invite ↗</button><button id="meet">Meet up</button><button id="sound">Enable sound</button><button id="expand">Expand</button><button id="help">?</button></nav><div id="party-health"></div><div id="play-notice" role="status"></div><div id="team-reset" hidden><strong>Our courage. Our second chance.</strong><p>Both heroes are returning to the entrance.</p></div><dialog id="help-dialog"><h2>Your companion in Hyrule.</h2><p>Explore as Green Link and Blue Link. Enter the same area to see each other. Meet up brings you to your friend. Items and quest flags are shared; health stays separate. If either hero dies, both restart at that area’s entrance.</p><p>Fight supported Deku Tree enemies and Gohma together: the host controls the fight and both heroes can deal damage. Stay in the same room. Other enemy types and bosses still run separately.</p><p><b>Phone:</b> move with the left stick. A acts/rolls, B uses your sword, Z targets, R shields, and the yellow C buttons use equipped items. Start opens your inventory. Rotate sideways for the best view.</p><p><b>Keyboard:</b> WASD moves · X acts · C attacks · Z targets · Space opens inventory · arrow keys use C items. Escape opens engine settings. Gamepads are supported.</p><p>Keep both game tabs visible. Save through the game’s inventory menu. The host’s save stays in their browser. Connection options in the lobby accept your TURN relay if your network needs one.</p><button id="close-help">Back to the adventure</button></dialog></div>`);
$('#room-code').textContent=code;$('#overlay h1').textContent='Ocarina of Time Together';$('#overlay .subtitle').textContent='Preparing a kingdom for two.';$('#otr-picker').hidden=true;
window.together={role,code,state:null,players:[],errors:[],network:null};
const notice=text=>$('#play-notice').textContent=text;
function renderHealth(){
 together.players=[...players].map(([id,state])=>({id,...state}));
 const hud=$('#party-health');hud.replaceChildren();
 for(const [id,state] of [...players].sort((a,b)=>a[0]-b[0])){
  if(!state?.loaded)continue;
  const row=document.createElement('div');row.className='health player-'+id;
  const label=document.createElement('b');label.textContent=(id===1?'Green Link':'Blue Link')+(id===network.id?' · you':'');
  const meter=document.createElement('span');meter.className='hearts';const current=Math.max(0,state.health)/16,max=state.maxHealth/16;
  meter.setAttribute('aria-label',`${current} of ${max} hearts`);
  for(let i=0;i<Math.min(max,20);i++){const heart=document.createElement('i');heart.textContent='♥';heart.style.opacity=Math.max(.2,Math.min(1,current-i));meter.append(heart);}
  row.append(label,meter);hud.append(row);
 }
 $('#connection-status').textContent=role==='join'?joinStatus:network.connected?(players.get(2)?.loaded&&performance.now()-network.lastPlayer<3000?'Two heroes connected':'Your friend is joining...'):'Waiting for your friend';
}
const network=new AdventureNetwork({role,code,onNotice:notice,onState:(id,state)=>{if(state)players.set(id,state);else players.delete(id);renderHealth();},onReset:reset=>{
 resetting=true;release();$('#team-reset').hidden=false;
 pendingReset={...reset,applyAfter:performance.now()+900};
}});
together.network=network;network.installSocketBridge();network.start();
window._anchorConfig={room:'zeldaoot-'+code,name:role==='host'?'Green Link':'Blue Link',color:role==='host'?'68D77F':'68B1FF',team:'together'};
window.ZeldaNative={onDeath:(serial,entrance)=>network.death(serial,entrance)};
Module.locateFile=path=>'./engine/'+path;
Module.onAbort=reason=>{showError('The game stopped loading. Reload, or try a browser with WebGL 2 support.');notice('Engine error: '+String(reason).slice(0,140));};
const printErr=Module.printErr;Module.printErr=text=>{together.errors.push(String(text));printErr(text);};
Module.preRun=[()=>{
 // Keep each role's saves separate from other projects on this GitHub origin.
 if(typeof IDBFS!=='undefined'){const getDB=IDBFS.getDB;IDBFS.getDB=function(name,callback){return getDB.call(this,'zeldaoot-together-v1-'+role+name,callback);};}
}];
Module.onRuntimeInitialized=async()=>{
 engineReady=true;
 try{
  showProgress();setStatus('Loading the adventure…');
  if(!await installSohO2r())throw Error('The game engine assets could not be loaded.');
  if(params.has('extract')){
   const response=await fetch('./roms/oot.z64');if(!response.ok)throw Error('ROM missing');
   extractRomInBrowser(await response.arrayBuffer(),'oot.z64');return;
  }
  let archive=await getCachedFile('oot.o2r');
  if(!archive){
   const manifest=await fetch('./game-manifest.json').then(r=>r.json());
   const chunks=[];let downloaded=0;
   for(const part of manifest.archive.parts){const response=await fetch('./'+part);if(!response.ok)throw Error('Game asset download failed');const bytes=new Uint8Array(await response.arrayBuffer());chunks.push(bytes);downloaded+=bytes.length;setProgress(10+Math.round(downloaded/manifest.archive.bytes*80));}
   const bytes=new Uint8Array(downloaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}archive=bytes.buffer;
   await cacheFile('oot.o2r',archive).catch(()=>notice('Browser storage is unavailable; keep this tab open to play.'));
  }
  writeOtrToFS('oot.o2r',archive);finalizeOtrLoad();
 }catch(error){showError(error.message);notice(error.message+' Reload to retry.');}
};
// Short taps remain latched until the native input loop actually reads them.
const originalPressed=TouchGamepad.isButtonPressed.bind(TouchGamepad),pendingButtons=new Set();
document.addEventListener('touchstart',event=>{const id=event.target.closest('.touch-btn,.touch-cbtn')?.id;if(id&&id!=='tb-esc')pendingButtons.add(id);},{capture:true,passive:true});
TouchGamepad.isButtonPressed=id=>{
 if(resetting||$('#help-dialog').open)return false;
 const pressed=originalPressed(id)||pendingButtons.has(id);pendingButtons.delete(id);return pressed;
};
function release(){pendingButtons.clear();TouchGamepad._buttons={};TouchGamepad._stickX=0;TouchGamepad._stickY=0;TouchGamepad._stickTouchId=null;$('#touch-stick-knob').style.transform='translate(0,0)';document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));}
const stickX=TouchGamepad.getStickX.bind(TouchGamepad),stickY=TouchGamepad.getStickY.bind(TouchGamepad);
TouchGamepad.getStickX=()=>resetting||$('#help-dialog').open?0:stickX();TouchGamepad.getStickY=()=>resetting||$('#help-dialog').open?0:stickY();
const labels={'tb-a':'A · Act','tb-b':'B · Sword','tb-z':'Z · Target','tb-r':'R · Shield','tb-start':'Inventory','tb-esc':'Settings'};
for(const [id,label] of Object.entries(labels)){const button=document.getElementById(id);if(button){button.textContent=label;button.setAttribute('role','button');button.setAttribute('aria-label',label);}}
$('#invite').onclick=async()=>{const url=new URL('./',location.href);url.hash='room='+code;try{if(navigator.share&&matchMedia('(pointer:coarse)').matches)await navigator.share({title:'Ocarina of Time Together',url:url.href});else{await navigator.clipboard.writeText(url.href);notice('Invite copied. Send it to your friend.');}}catch(error){if(error.name!=='AbortError')notice('Your friend can join room '+code+'.');}};
$('#meet').onclick=()=>{if(!network.connected){notice('Invite a friend before meeting up.');return;}notice(Module._together_meet?.()?'Traveling to your friend…':'Meet up is unavailable in this area or while your friend is loading.');};
$('#sound').onclick=()=>{resumeAudio();const context=Module.SDL2?.audioContext||window.SDL2?.audioContext;if(context)context.resume().then(()=>$('#sound').textContent='Sound on');else notice('Sound will be ready after loading.');};
$('#expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else notice('Rotate sideways, or use Add to Home Screen on iPhone.');}catch{notice('Rotate sideways for a wider view.');}};
$('#help').onclick=()=>{release();$('#help-dialog').showModal();};$('#close-help').onclick=()=>$('#help-dialog').close();
window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{release();if(document.hidden){Module._web_save_to_idb?.();notice('Return to the game to keep exploring together.');}});
window.addEventListener('pagehide',()=>{release();Module._web_save_to_idb?.();network.close();});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
setInterval(()=>{
 if(!engineReady||!Module._together_state)return;
 if(pendingReset&&performance.now()>=pendingReset.applyAfter){Module._together_restart(pendingReset.entrance,pendingReset.epoch);pendingReset=null;}
 try{const state=JSON.parse(Module.ccall('together_state','string',[],[]));together.state=state;network.status(state);
  if(state.loaded){if(!previousLoaded)$('#overlay').classList.add('hidden');if(resetting&&state.epoch===network.epoch&&!state.dead&&state.health===state.maxHealth){resetting=false;$('#team-reset').hidden=true;}}
  if(role==='join'){if(joinGeneration!==network.generation){joinGeneration=network.generation;rendezvous.reset();}joinStatus=rendezvous.update({now:performance.now(),connected:network.connected,ready:network.snapshotReceived,local:state,host:players.get(1),freshPlayer:performance.now()-network.lastPlayer<2000&&network.lastPlayer>0,meet:()=>Module._together_meet?.()});together.joinedHost=rendezvous.done;}
  previousLoaded=state.loaded;
 }catch(error){if(!together.errors.includes(error.message))together.errors.push(error.message);}
},100);
const engine=document.createElement('script');engine.src='./engine/soh.js';engine.onerror=()=>showError('The game engine failed to download. Reload to retry.');document.body.append(engine);

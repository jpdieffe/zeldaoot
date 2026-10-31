import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
import {localSignaling} from './local-signaling.mjs';
const server=createServer(4212),signal=localSignaling();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
const pages=[],logs=[],errors=[];
const state=p=>p.evaluate(()=>window.together?.state);
const debug=(p,c,v=0)=>p.evaluate(([c,v])=>Module._together_debug(c,v),[c,v]);
const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:60000});
await mkdir('test-results',{recursive:true});
try{
 for(const role of ['host','join']){
  const p=await browser.newPage(role==='join'?{...devices['iPhone 13'],viewport:{width:844,height:390},deviceScaleFactor:1}:{viewport:{width:960,height:640}});pages.push(p);
  p.on('pageerror',e=>errors.push(role+' '+e.message));p.on('console',m=>{if(/Enemy|error|abort|Exception/i.test(m.text()))logs.push(role+' '+m.text());});
  await signal(p);await p.goto(`http://127.0.0.1:4212/play.html?role=${role}&room=BABA&debug`);
  await p.waitForFunction(()=>window.together?.state?.loaded,null,{timeout:120000});console.log(role,'BOOTED');
 }
 const[host,guest]=pages;
 for(const p of pages)await wait(p,()=>together.state.peers.some(p=>p.visible));
 await guest.waitForTimeout(3500);
 for(const p of pages)await debug(p,3,0);
 for(const p of pages)await wait(p,()=>together.state.scene===0&&together.state.combat.enemies.some(e=>e.id===85));
 for(const p of pages)await p.evaluate(()=>{window.combatTestHeal=setInterval(()=>Module._together_debug(1,48),250);});
 await debug(guest,5);await debug(guest,13,85);
 const enemy=(await state(guest)).combat.enemies.filter(e=>e.id===85).sort((a,b)=>BigInt(a.key)<BigInt(b.key)?-1:1)[0];
 const key=enemy.key;
 await wait(host,key=>{
  const e=together.state.combat.enemies.find(e=>e.key===key),g=together.players.find(p=>p.id===2);
  return e&&g&&Math.hypot(e.target.x-g.x,e.target.z-g.z)<10&&Math.hypot(g.x-together.state.x,g.z-together.state.z)>100;
 },key);
 console.log('ENEMY TARGETS GUEST WHILE HOST STAYS AWAY');
 let damaged=false;
 for(let i=0;i<12&&!damaged;i++){
  await debug(guest,13,85);
  await guest.keyboard.down('KeyZ');await guest.locator('#tb-b').tap();
  await guest.waitForTimeout(830);await guest.keyboard.up('KeyZ');
  const s=await state(host),e=s.combat.enemies.find(e=>e.key===key);
  damaged=s.combat.requestsApplied>0&&(!e||e.hp<enemy.hp||e.dying);
  console.log('SWORD',i,'host HP',e?.hp,'requests',s.combat.requestsApplied);
 }
 assert.ok(damaged,'real guest sword input must damage the authoritative enemy');
 await host.screenshot({path:'test-results/guest-sword-host.png'});await guest.screenshot({path:'test-results/guest-sword-guest.png'});
 console.log('REAL GUEST TOUCH-SWORD INPUT DAMAGES HOST ENEMY');
 for(const p of pages)await debug(p,3,0x40f);
 for(const p of pages)await wait(p,()=>together.state.scene===17&&together.state.combat.enemies.some(e=>e.id===40));
 for(const p of pages)await debug(p,10);
 await wait(guest,()=>together.state.combat.enemies.some(e=>e.id===40&&e.suppressed));
 await debug(host,15);
 await wait(host,()=>together.state.combat.enemies.some(e=>e.id===43));
 const larva=(await state(host)).combat.enemies.find(e=>e.id===43);
 assert.ok(BigInt(larva.key)>=2n**63n,'spawn has a host-issued 64-bit dynamic identity');
 await wait(guest,key=>together.state.combat.enemies.some(e=>e.id===43&&e.key===key&&e.suppressed),larva.key);
 console.log('DYNAMIC GOHMA CHILD REPLICATED WITH EXACT ID',larva.key);
 // Model a backgrounded host/network stall without closing the WebRTC room.
 await guest.evaluate(()=>{
  const n=together.network;window.restoreCombatDelivery=n.deliver.bind(n);
  n.deliver=p=>{if(p.type!=='ENEMY_STATE')window.restoreCombatDelivery(p);};
 });
 let tick=(await state(guest)).ticks;await wait(guest,t=>together.state.ticks>=t,tick+40);
 const frozen=(await state(guest)).combat.enemies.find(e=>e.id===40);
 tick=(await state(guest)).ticks;await wait(guest,t=>together.state.ticks>=t,tick+40);
 const later=(await state(guest)).combat.enemies.find(e=>e.id===40);
 assert.ok(later.suppressed,'guest keeps host authority when snapshots stall');
 assert.ok(Math.hypot(later.pos.x-frozen.pos.x,later.pos.z-frozen.pos.z)<0.01,'guest must not simulate a divergent fight');
 await guest.evaluate(()=>{together.network.deliver=window.restoreCombatDelivery;});
 console.log('STALLED HOST DOES NOT START A SECOND ENEMY SIMULATION');
 await guest.reload();await guest.waitForFunction(()=>window.together?.state?.loaded&&together.state.scene===17&&together.state.peers.some(p=>p.visible),null,{timeout:120000});
 await wait(guest,()=>together.state.combat.enemies.some(e=>e.id===40&&e.suppressed));
 console.log('SHARED COMBAT RESUMES AFTER GUEST RELOAD');
 assert.deepEqual(errors,[]);
}catch(error){
 for(const[i,p]of pages.entries()){const s=await state(p);if(s?.combat)for(const e of s.combat.enemies){delete e.jt;delete e.cs;}console.error('STATE',i,JSON.stringify(s));await p.screenshot({path:`test-results/enemies-failure-${i}.png`});}
 throw error;
}finally{await writeFile('test-results/enemies.log',logs.join('\n'));await browser.close();server.close();}

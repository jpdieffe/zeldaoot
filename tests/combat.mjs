import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
import {localSignaling} from './local-signaling.mjs';
const server=createServer(4211),signaling=localSignaling();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
const pages=[],logs=[],errors=[];
const state=p=>p.evaluate(()=>window.together?.state);
const debug=(p,c,v=0)=>p.evaluate(([c,v])=>Module._together_debug(c,v),[c,v]);
const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:60000});
const boss=p=>p.evaluate(()=>together.state.combat.enemies.find(e=>e.id===40));
const ticks=async(p,n)=>{const start=(await state(p)).ticks;await wait(p,t=>together.state.ticks>=t,start+n);};
await mkdir('test-results',{recursive:true});
try{
 for(const role of ['host','join']){
  const page=await browser.newPage({viewport:{width:960,height:640}});pages.push(page);
  page.on('pageerror',e=>{errors.push(role+' '+e.message);logs.push(role+' PAGE ERROR '+e.message);});
  page.on('console',m=>{if(/Enemy|Gohma|error|abort|Exception/i.test(m.text()))logs.push(role+' '+m.text());});
  await signaling(page);await page.goto(`http://127.0.0.1:4211/play.html?role=${role}&room=FATE&debug`);
  await page.waitForFunction(()=>window.together?.state?.loaded,null,{timeout:120000});
  console.log(role,'BOOTED');
 }
 const[host,guest]=pages;
 for(const p of pages)await wait(p,()=>together.state.peers.some(p=>p.visible));
 await guest.waitForTimeout(3500);
 for(const p of pages)await debug(p,3,0);
 for(const p of pages)await wait(p,()=>together.state.scene===0&&together.state.combat.enemies.length>0);
 await wait(guest,()=>together.state.combat.enemies.some(e=>e.suppressed));
 console.log('DEKU TREE HOST AUTHORITY',await host.evaluate(()=>together.state.combat.enemies.map(({id,key,hp,room})=>({id,key,hp,room}))));
 assert.equal((await state(host)).combat.authority,1);assert.equal((await state(guest)).combat.authority,1);
 for(const p of pages)await debug(p,3,0x40f);
 for(const p of pages)await wait(p,()=>together.state.scene===17&&together.state.combat.enemies.some(e=>e.id===40));
 // Skip the presentation cutscene in this repeatable collision-protocol test.
 // These commands do not change health or force stun/damage outcomes.
 for(const p of pages)await debug(p,10);
 // Combat contact remains live. Keep test players alive while the test waits
 // for native vulnerability windows; player damage/team death have separate tests.
 for(const p of pages)await p.evaluate(()=>{window.combatTestHeal=setInterval(()=>Module._together_debug(1,48),250);});
 await wait(guest,()=>together.state.combat.enemies.some(e=>e.id===40&&e.suppressed));
 const initial=(await boss(host)).hp;assert.ok(initial>0);
 console.log('GOHMA MIRRORED',initial,'HP, guest colliders:',(await boss(guest)).colliders);
 await debug(host,12,150);await debug(guest,11,0x100);await ticks(host,75);
 assert.equal((await boss(host)).hp,initial,'closed-eye guest sword hit remains rejected beyond the old damage-debt timer');
 console.log('CLOSED EYE REJECTION PASS');
 await debug(host,10);await debug(guest,11,0x10000100);await ticks(host,15);
 assert.equal((await boss(host)).hp,initial,'body hit cannot be promoted to eye hit');
 console.log('BODY HIT REJECTION PASS');
 // Alternate real native stun/sword validation across the two players.
 for(const attacker of [guest,host,guest,guest,guest,guest,guest,guest,guest,guest]){
  if((await boss(host)).dying)break;
  const hp=(await boss(host)).hp;
  let damaged=false;
  for(let attempt=0;attempt<5&&!damaged;attempt++){
   await debug(host,10);await ticks(host,2);await debug(attacker,11,4);
   try{
    await host.waitForFunction(()=>{const e=together.state.combat.enemies.find(e=>e.id===40);return e?.extras.vis===4&&e.inv===0&&e.closed===0;},null,{timeout:2500});
    await debug(attacker,11,0x100);
    await host.waitForFunction(before=>{const e=together.state.combat.enemies.find(e=>e.id===40);return e&&(e.hp<before||e.dying);},hp,{timeout:2500});
    damaged=true;
   }catch{console.log('Retrying native vulnerability window',attempt+1);}
  }
  assert.ok(damaged,'a valid stun followed by sword damage must affect host health');
  const current=await boss(host);
  await wait(guest,hp=>{const e=together.state.combat.enemies.find(e=>e.id===40);return e&&(e.hp===hp||e.dying);},current.hp);
  console.log(attacker===guest?'GUEST DAMAGE':'HOST DAMAGE',hp,'->',current.hp,'dying',current.dying);
 }
 for(const p of pages)await wait(p,()=>together.state.combat.enemies.some(e=>e.id===40&&e.dying));
 await host.screenshot({path:'test-results/gohma-host-defeat.png'});await guest.screenshot({path:'test-results/gohma-guest-defeat.png'});
 console.log('SHARED GOHMA DEFEAT PASS');
 for(const p of pages)await wait(p,()=>together.state.combat.hearts===1&&together.state.combat.warps===1&&together.state.combat.clear);
 console.log('BOTH PLAYERS RECEIVE HEART, WARP, AND ROOM CLEAR');
 assert.deepEqual(errors,[]);
}catch(e){
 for(const[i,p]of pages.entries()){const s=await state(p);if(s?.combat)for(const e of s.combat.enemies){delete e.jt;delete e.cs;}console.error('STATE',i,JSON.stringify(s));await p.screenshot({path:`test-results/combat-failure-${i}.png`});}
 throw e;
}finally{await writeFile('test-results/combat.log',logs.join('\n'));await browser.close();server.close();}

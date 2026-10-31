import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {createServer} from '../scripts/serve.mjs';import {localSignaling} from './local-signaling.mjs';
const base=process.env.TEST_URL||'http://127.0.0.1:4209/',server=process.env.TEST_URL?null:createServer(4209),signaling=localSignaling();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
const pages=[],logs=[],errors=[];await mkdir('test-results',{recursive:true});
const state=p=>p.evaluate(()=>together.state);
const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:60000});
const debug=(p,command,value=0)=>p.evaluate(([c,v])=>Module._together_debug(c,v),[command,value]);
try{
 const code=process.env.ROOM||'ZLDA';
 for(const role of ['host','join']){
  const page=await browser.newPage({viewport:{width:960,height:640}});pages.push(page);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/error|abort|Exception|connect/i.test(m.text()))logs.push(role+' '+m.text());});
  if(!process.env.PUBLIC_SIGNALING)await signaling(page);
  if(process.env.JOIN_RECOVERY&&role==='join')await page.route('**/play.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('meet:()=>Module._together_meet?.()', 'meet:()=>{window.meetAttempts=(window.meetAttempts||0)+1;return window.meetAttempts<=2?0:Module._together_meet?.();}')});});
  await page.goto(`${base}play.html?role=${role}&room=${code}&debug`);
  await page.waitForFunction(()=>window.together?.state?.loaded,null,{timeout:120000});console.log(role,'BOOT',await state(page));
  if(process.env.JOIN_RECOVERY&&role==='host'){await debug(page,3,0);await wait(page,()=>together.state.loaded&&together.state.scene===0);}
 }
 const[host,guest]=pages;
 for(const page of pages)await wait(page,()=>together.state.peers.some(p=>p.visible));
 if(process.env.JOIN_RECOVERY){await wait(guest,()=>together.joinedHost&&together.state.scene===0);assert.ok(await guest.evaluate(()=>window.meetAttempts>=3));console.log('FAILED INITIAL MEETUP RECOVERED');}
 console.log('TWO VISIBLE LINKS PASS');
 await debug(guest,1,16);await wait(guest,()=>together.state.health===16);assert.equal((await state(host)).health,48);console.log('SEPARATE HEALTH PASS');
 await debug(guest,4);for(const page of pages)await wait(page,()=>!!(together.state.equipment&1));console.log('SHARED INVENTORY PASS');
 await guest.waitForTimeout(3500);
 const idle=await state(guest);await guest.waitForTimeout(1000);const settled=await state(guest);assert.ok(Math.hypot(idle.x-settled.x,idle.z-settled.z)<2,'Link is idle before the input test');
 const before=await state(guest);await guest.keyboard.down('KeyW');await guest.waitForTimeout(900);await guest.keyboard.up('KeyW');await guest.waitForTimeout(200);const after=await state(guest);
 assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>10,'native movement works');
 await host.screenshot({path:'test-results/two-links.png'});
 for(const page of pages)await debug(page,3,0xEE);
 for(const page of pages)await wait(page,()=>together.state.loaded&&together.state.scene===85&&together.state.peers.some(p=>p.visible));
 for(const [i,page]of pages.entries()){
  const epoch=await host.evaluate(()=>together.network.epoch);await debug(page,2);
  for(const p of pages)await wait(p,e=>together.network.epoch===e+1,epoch);
  for(const p of pages)await wait(p,e=>together.state.loaded&&together.state.epoch===e+1&&!together.state.dead&&together.state.health===together.state.maxHealth,epoch);
  for(const p of pages)assert.ok((await state(p)).equipment&1,'inventory retained after shared death');
  console.log('TEAM DEATH PASS',i,await state(page));await host.waitForTimeout(3200);
 }
 await debug(guest,3,0);await wait(guest,()=>together.state.loaded&&together.state.scene===0);await guest.waitForTimeout(1000);const epoch=await host.evaluate(()=>together.network.epoch);await debug(guest,2);
 for(const p of pages)await wait(p,e=>together.state.loaded&&together.state.epoch===e+1&&together.state.scene===0&&together.state.health===together.state.maxHealth,epoch);
 console.log('CROSS-SCENE TEAM RESET PASS');
 if(process.env.JOIN_RECOVERY){await guest.evaluate(()=>together.network.connection.close());await wait(guest,()=>together.network.generation>0);await wait(guest,()=>together.network.connected&&together.joinedHost);console.log('LIVE TRANSPORT REJOIN PASS');}
 await guest.reload();await guest.waitForFunction(()=>window.together?.state?.loaded&&together.state.peers.some(p=>p.visible),null,{timeout:120000});console.log('GUEST REJOIN PASS');
 assert.deepEqual(errors,[]);console.log('BROWSER CO-OP CHECKS PASSED');
}catch(error){for(const[i,page]of pages.entries()){console.error('FAILED',i,await page.evaluate(()=>({state:window.together?.state,errors:window.together?.errors,notice:document.querySelector('#play-notice')?.textContent,states:window.together?.network?.relay?[...together.network.relay.clients]:null})));await page.screenshot({path:`test-results/failure-${i}.png`});}throw error;}
finally{await writeFile('test-results/browser.log',logs.join('\n'));console.log('Log tail',logs.slice(-12));await browser.close();server?.close();}

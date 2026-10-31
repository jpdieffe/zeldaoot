// Android host / iPhone guest layouts in Chromium. This does not certify iOS Safari.
import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../scripts/serve.mjs';
import {newCode} from '../site/rooms.js';
const base=process.env.TEST_URL||'http://127.0.0.1:4212/';
const server=process.env.TEST_URL?null:createServer(4212);
let browser;const pages=[],errors=[];
const wait=(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:90000});
const warp=(p,entrance)=>p.evaluate(e=>Module._together_debug(3,e),entrance);
async function visible(scene){
 for(const p of pages)await wait(p,s=>together.state?.loaded&&together.state.scene===s&&together.state.peers.some(p=>p.visible)&&performance.now()-together.network.lastPlayer<2000,scene);
}
try{
 await mkdir('test-results',{recursive:true});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 const code=process.env.ROOM||newCode();
 for(const [device,role]of [['Pixel 7','host'],['iPhone 13','join']]){
  const p=await browser.newPage({...devices[device],viewport:{width:844,height:390},deviceScaleFactor:1});pages.push(p);
  p.on('pageerror',e=>errors.push(`${role}: ${e.message}`));
  await p.goto(`${base}play.html?role=${role}&room=${code}&debug`);
  await wait(p,()=>window.together?.state?.loaded);
 }
 const [host,guest]=pages;
 await visible(52);await wait(guest,()=>together.joinedHost);
 console.log('PASS: Android host and iPhone guest layouts join in Link\'s house using public signaling.');
 // Move the host through the native scene loader to the actual house exit.
 await warp(host,0x211);await wait(host,()=>together.state.scene===85);
 assert.equal(await guest.evaluate(()=>together.state.scene),52,'successful initial join does not force subsequent exploration');
 await guest.locator('#meet').tap();await visible(85);
 const positions=await Promise.all(pages.map(p=>p.evaluate(()=>together.state)));
 assert.ok(Math.hypot(positions[0].x-positions[1].x,positions[0].y-positions[1].y,positions[0].z-positions[1].z)<180);
 for(const [i,p]of pages.entries())await p.screenshot({path:`test-results/opening-forest-${i}.png`});
 console.log('PASS: touch Meet up brings guest from house to host outside; both native actors and fresh player traffic confirmed.');
 await guest.reload();await wait(guest,()=>window.together?.joinedHost&&together.state.scene===85);await visible(85);
 console.log('PASS: guest reload joins host outside instead of remaining in a separate saved location.');
 for(const p of pages)await warp(p,0xBB);await visible(52);
 console.log('PASS: both players remain visible after returning to Link\'s house.');
 assert.deepEqual(errors,[]);
}catch(error){
 for(const [i,p]of pages.entries()){console.error(i,await p.evaluate(()=>({state:window.together?.state,status:document.querySelector('#connection-status')?.textContent,notice:document.querySelector('#play-notice')?.textContent})));await p.screenshot({path:`test-results/opening-failure-${i}.png`});}
 throw error;
}finally{await browser?.close();server?.close();}

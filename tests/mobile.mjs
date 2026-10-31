import {chromium,devices} from '@playwright/test';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';import {createServer} from '../scripts/serve.mjs';import {localSignaling} from './local-signaling.mjs';
const server=createServer(4210),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']}),signaling=localSignaling(),pages=[],errors=[];
await mkdir('test-results',{recursive:true});
try{
 for(const[device,role]of [['Pixel 7','host'],['iPhone 13','join']]){
  const page=await browser.newPage({...devices[device],viewport:{width:844,height:390},deviceScaleFactor:1});pages.push(page);page.on('pageerror',e=>errors.push(e.message));await signaling(page);
  await page.goto(`http://127.0.0.1:4210/play.html?role=${role}&room=PHNE&debug`);await page.waitForFunction(()=>window.together?.state?.loaded,null,{timeout:120000});console.log(device,'booted');
 }
 for(const p of pages)await p.waitForFunction(()=>together.state.scene===52&&together.state.peers.some(p=>p.visible));
 await pages[0].waitForTimeout(3500);
 for(const[i,page]of pages.entries()){
  await page.waitForTimeout(1500);const before=await page.evaluate(()=>together.state);
  const cdp=await page.context().newCDPSession(page),r=await page.locator('#touch-stick-base').boundingBox(),x=r.x+r.width/2,y=r.y+r.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(i?-45:45),y,id:1}]});await page.waitForTimeout(1200);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const after=await page.evaluate(()=>together.state);console.log('TOUCH',i,{before:[before.x,before.z],after:[after.x,after.z]});assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>10,'touch stick moves Link');
  for(const id of ['tb-a','tb-b','tb-z','tb-r','tb-start','tb-esc'])assert.equal(await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}),true,id+' is reachable');
  await page.locator('#sound').tap();await page.waitForFunction(()=>document.querySelector('#sound').textContent==='Sound on');await page.screenshot({path:`test-results/mobile-${i}.png`});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#help').tap();await page.locator('#close-help').tap();await page.screenshot({path:`test-results/portrait-${i}.png`});await page.setViewportSize({width:844,height:390});
 }
 assert.deepEqual(errors,[]);console.log('ANDROID / IPHONE VIEWPORTS, TOUCH MOVEMENT, AUDIO AND CONTROLS PASS (Chromium emulation)');
}catch(error){for(const[i,p]of pages.entries())await p.screenshot({path:`test-results/mobile-failure-${i}.png`});throw error;}
finally{await browser.close();server.close();}

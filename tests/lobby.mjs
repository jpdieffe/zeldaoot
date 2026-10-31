import {chromium,devices} from '@playwright/test';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';import {createServer} from '../scripts/serve.mjs';
const server=createServer(4211),browser=await chromium.launch({channel:'chrome',headless:true});await mkdir('test-results',{recursive:true});
try{
 for(const[device,options]of [['desktop',{viewport:{width:1440,height:1000}}],['iphone',devices['iPhone 13']]]){
  const page=await browser.newPage(options);await page.goto('http://127.0.0.1:4211/#room=HYRL');assert.equal(await page.locator('#room-code').inputValue(),'HYRL');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/lobby-${device}.png`,fullPage:true});
  await page.locator('#room-code').fill('bad');await page.locator('#join-form button').click();assert.match(await page.locator('#status').textContent(),/four-character/);
  await page.route('**/play.html?*',route=>route.fulfill({status:200,contentType:'text/html',body:'<p>Navigation verified</p>'}));await page.locator('#room-code').fill('https://jpdieffe.github.io/zeldaoot/#room=HYRL');await page.locator('#join-form button').click();await page.waitForURL(/role=join&room=HYRL/);await page.close();
 }
 console.log('LOBBY DESKTOP / IPHONE LAYOUTS, INVITES AND JOIN VALIDATION PASS');
}finally{await browser.close();server.close();}

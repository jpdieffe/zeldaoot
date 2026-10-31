import {chromium} from '@playwright/test';import {mkdir,writeFile,appendFile} from 'node:fs/promises';import {createServer} from '../scripts/serve.mjs';import {localSignaling} from './local-signaling.mjs';
import {createWriteStream} from 'node:fs';import path from 'node:path';
const server=createServer(4207),browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
await mkdir('test-results',{recursive:true});
const output=createWriteStream('test-results/extract.log');let warnings=0;
try{
 const page=await browser.newPage({viewport:{width:960,height:640}});await localSignaling()(page);
 for(const file of ['soh.js','soh.data'])await page.route('**/engine/'+file,route=>route.fulfill({path:path.resolve('.build/compiled',file),contentType:file.endsWith('.js')?'text/javascript':'application/octet-stream'}));
 page.on('pageerror',e=>console.error('PAGE',e.message));page.on('console',m=>{output.write(m.text()+'\n');if(m.type()==='error'&&++warnings<=5)console.log(m.text().slice(0,350));});
 await page.goto('http://127.0.0.1:4207/play.html?role=host&room=ZLDA&extract');
 await page.waitForFunction(()=>{try{return otrFilesReady&&FS.stat('/oot.o2r').size>0;}catch{return false;}},null,{timeout:240000});
 const size=await page.evaluate(()=>{window.extracted=FS.readFile('/oot.o2r');return window.extracted.length;});
 await writeFile('.build/oot.o2r',new Uint8Array());
 for(let offset=0;offset<size;offset+=524288){const data=await page.evaluate(offset=>{const bytes=window.extracted.subarray(offset,offset+524288);let out='';for(let i=0;i<bytes.length;i++)out+=String.fromCharCode(bytes[i]);return btoa(out);},offset);await appendFile('.build/oot.o2r',Buffer.from(data,'base64'));}
 console.log('EXTRACTED ARCHIVE',size);await page.screenshot({path:'test-results/extraction.png'});
}catch(error){for(const p of browser.contexts().flatMap(c=>c.pages())){console.error(await p.locator('#error-msg').textContent());await p.screenshot({path:'test-results/extract-failure.png'});}throw error;}
finally{output.end();await browser.close();server.close();}

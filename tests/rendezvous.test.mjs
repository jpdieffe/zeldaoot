import test from 'node:test';
import assert from 'node:assert/strict';
import {Rendezvous} from '../site/rendezvous.js';
test('failed or merely queued meetups retry until fresh motion and arrival, then leave exploration alone',()=>{
 const r=new Rendezvous();let attempts=0;
 const host={loaded:true,scene:0,age:1,x:0,y:0,z:0};
 const local={...host,scene:52,peers:[{id:1,visible:false}]};
 const args={connected:true,ready:true,host,local,freshPlayer:true,meet:()=>++attempts>1};
 r.update({...args,now:0});r.update({...args,now:4000});r.update({...args,now:8000});assert.equal(attempts,3);assert.equal(r.done,false);
 Object.assign(local,host,{peers:[{id:1,visible:true}]});
 r.update({...args,now:9000,freshPlayer:false});assert.equal(r.done,false);
 r.update({...args,now:10000});r.update({...args,now:11000});assert.equal(r.done,true);
 local.scene=52;r.update({...args,now:20000});assert.equal(attempts,3);
 r.update({...args,now:21000,connected:false});assert.equal(r.done,false);
 r.update({...args,now:22000});assert.equal(attempts,4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {AdventureNetwork} from '../site/network.js';
test('connection errors without close events clear native presence and retry once',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const states=[],network=new AdventureNetwork({role:'join',code:'TEST',onNotice(){},onState:(...args)=>states.push(args)});
 let closed=0;network.socket={remoteClose(){closed++;},open(){}};
 const connection=new EventEmitter();Object.assign(connection,{open:true,close(){},send(){}});
 network.attach(connection);connection.emit('open');network.pending.push({type:'PLAYER_UPDATE'});
 network.nativeReady=true;network.snapshotReceived=true;
 connection.emit('error',new Error('ICE failed'));
 assert.equal(network.connected,false);assert.equal(network.connection,null);assert.equal(network.snapshotReceived,false);
 assert.deepEqual(network.pending,[]);assert.deepEqual(states,[[1,null]]);assert.equal(closed,1);assert.equal(network.generation,1);
 connection.emit('close');assert.equal(network.generation,1);network.close();
});
test('guest retries a missing native save bootstrap and stops after snapshot delivery',()=>{
 const network=new AdventureNetwork({role:'join',code:'TEST',onNotice(){},onState(){}}),sent=[];
 network.connection={open:true,send:p=>sent.push(p)};network.connected=true;network.nativeReady=true;network.socket={readyState:1};network.lastBootstrap=-3000;
 network.status({loaded:true});assert.equal(sent.filter(p=>p.kind==='anchor').length,1);
 network.status({loaded:true});assert.equal(sent.filter(p=>p.kind==='anchor').length,1);
 network.lastBootstrap=-3000;network.status({loaded:true});assert.equal(sent.filter(p=>p.kind==='anchor').length,2);
 network.snapshotReceived=true;network.lastBootstrap=-3000;network.status({loaded:true});assert.equal(sent.filter(p=>p.kind==='anchor').length,2);
});

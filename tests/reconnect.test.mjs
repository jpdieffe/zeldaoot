import test from 'node:test';
import assert from 'node:assert/strict';
import {AdventureNetwork} from '../site/network.js';
test('a death during disconnection is submitted after joining the current team epoch',()=>{
 const packets=[],resets=[];
 const network=new AdventureNetwork({role:'join',code:'TEST',onNotice(){},onState(){},onReset:r=>resets.push(r)});
 network.death(1,238);
 network.connection={open:true,send:p=>packets.push(p)};
 network.receive({kind:'welcome',epoch:3});
 assert.deepEqual(packets,[{kind:'death',id:2,serial:1,entrance:238,epoch:3}]);
 network.receive({kind:'reset',epoch:4,entrance:238,victim:2});
 network.receive({kind:'welcome',epoch:4});
 assert.equal(packets.length,1);
 assert.equal(resets.length,1);
});
test('combat packets from before a shared death cannot affect the restarted fight',()=>{
 const delivered=[],sent=[];
 const network=new AdventureNetwork({role:'join',code:'TEST',onNotice(){},onState(){},onReset(){}});
 network.socket={readyState:1,deliver:p=>delivered.push(p)};
 network.connection={open:true,send:p=>sent.push(p)};
 network.receive({kind:'reset',epoch:1,entrance:0,victim:2});
 const packet={type:'ENEMY_DIED',key:'2621440'};
 network.receive({kind:'anchor',combatEpoch:0,packet});assert.equal(delivered.length,0);
 network.receive({kind:'anchor',combatEpoch:1,packet});assert.equal(delivered.length,1);
 network.send({kind:'anchor',packet});assert.equal(sent[0].combatEpoch,1);
});

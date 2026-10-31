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

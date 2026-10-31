import test from 'node:test';import assert from 'node:assert/strict';import {AnchorRelay,TeamRules} from '../site/relay.js';
function fixture(){const packets=[];const relay=new AnchorRelay((id,p)=>packets.push([id,p]));relay.connect(1);relay.connect(2);packets.length=0;return{packets,relay};}
test('room settings preserve separate players and disable friendly damage',()=>{const{relay,packets}=fixture();relay.receive(2,{type:'HANDSHAKE',clientState:{name:'spoof',clientId:1,isSaveLoaded:true}});assert.equal(relay.clients.get(2).name,'Blue Link');assert.equal(packets.find(p=>p[1].type==='UPDATE_ROOM_STATE')[1].state.pvpMode,0);assert.equal(packets.at(-1)[1].state.find(c=>c.self).clientId,2);});
test('native player updates preserve animation data and authenticate the sender',()=>{const{relay,packets}=fixture();relay.receive(2,{type:'PLAYER_UPDATE',clientId:1,targetClientId:1,jointTable:[1,2,3]});assert.deepEqual(packets,[[1,{type:'PLAYER_UPDATE',clientId:2,targetClientId:1,jointTable:[1,2,3]}]]);});
test('guest requests wait for host save and guest snapshots cannot overwrite the host',()=>{const{relay,packets}=fixture();relay.receive(2,{type:'REQUEST_TEAM_STATE'});assert.equal(packets.length,0);relay.receive(1,{type:'UPDATE_CLIENT_STATE',state:{isSaveLoaded:true}});assert.equal(packets.at(-1)[0],1);assert.equal(packets.at(-1)[1].type,'REQUEST_TEAM_STATE');packets.length=0;relay.receive(2,{type:'UPDATE_TEAM_STATE',state:{health:0}});assert.equal(packets.length,0);relay.receive(1,{type:'UPDATE_TEAM_STATE',state:{inventory:{items:[1,2]}}});assert.equal(packets[0][0],2);});
test('quest and inventory updates reach teammate; PVP and unknown packets do not',()=>{const{relay,packets}=fixture();relay.receive(2,{type:'GIVE_ITEM',getItemId:5});assert.equal(packets[0][0],1);packets.length=0;relay.receive(2,{type:'DAMAGE_PLAYER',targetClientId:1,damage:255});relay.receive(2,{type:'EXEC',code:'bad'});assert.equal(packets.length,0);relay.disconnect(2);assert.equal(relay.connect(2),true);});
test('simultaneous deaths produce one reset and subsequent deaths are allowed',()=>{const resets=[];const rules=new TeamRules(p=>resets.push(p));assert.equal(rules.death({id:2,epoch:0,entrance:238}),true);assert.equal(rules.death({id:1,epoch:0,entrance:187}),false);assert.equal(resets.length,1);assert.equal(rules.death({id:1,epoch:1,entrance:0}),true);assert.equal(resets[1].entrance,0);assert.equal(rules.death({id:2,epoch:2,entrance:-1}),false);});

function combat(){const f=fixture();for(const id of [1,2])f.relay.update(id,{sceneNum:17,isSaveLoaded:true});return f;}
test('only scene authority may send combat snapshots, and dynamic identities survive JSON exactly',()=>{
 const{relay,packets}=combat(),key='9223373136366403585';
 const packet={type:'ENEMY_STATE',sceneNum:17,targetClientId:2,enemies:[{key,hp:10}]};
 relay.receive(2,{...packet,targetClientId:1,clientId:1});assert.equal(packets.length,0);
 relay.receive(1,JSON.parse(JSON.stringify(packet)));assert.equal(packets[0][1].enemies[0].key,key);
 for(const bad of [Number(key),'18446744073709551616','-1','1e12'])relay.receive(1,{...packet,enemies:[{key:bad}]});
 assert.equal(packets.length,1);
 relay.receive(1,{...packet,sceneNum:0});assert.equal(packets.length,1);
});
test('guest hit requests retain exact collider and effect; cannot impersonate authority',()=>{
 const{relay,packets}=combat(),p={type:'ENEMY_HIT_REQUEST',sceneNum:17,targetClientId:1,clientId:1,key:'2621440',collider:0,element:12,effect:1,dmgFlags:4};
 relay.receive(2,p);assert.equal(packets.length,1);assert.equal(packets[0][1].clientId,2);assert.equal(packets[0][1].element,12);assert.equal(packets[0][1].effect,1);
 for(const bad of [{collider:-1},{element:128},{targetClientId:2},{sceneNum:0}])relay.receive(2,{...p,...bad});
 relay.receive(2,{...p,type:'ENEMY_DIED'});relay.receive(2,{...p,type:'ENEMY_SPAWN'});assert.equal(packets.length,1);
 relay.receive(1,{type:'ENEMY_DIED',sceneNum:17,targetClientId:2,key:p.key});assert.equal(packets.length,2);
});
test('combat routing stops across scenes and resumes after reconnection',()=>{
 const{relay,packets}=combat(),p={type:'ENEMY_ROSTER',request:true,sceneNum:17,targetClientId:1,roomNum:0};
 relay.update(2,{sceneNum:0});relay.receive(2,p);assert.equal(packets.length,0);
 relay.disconnect(2);relay.connect(2);packets.length=0;relay.receive(2,p);assert.equal(packets.length,0);
 relay.update(2,{sceneNum:17,isSaveLoaded:true});relay.receive(2,p);assert.equal(packets.length,1);
});

// The original Anchor protocol runs over private WebRTC rooms here.
// The host owns membership and progression snapshots; native game packets
// still control Link animation, items, quest flags and level transitions.
const TEAM_PACKETS=new Set(['GIVE_ITEM','SET_FLAG','UNSET_FLAG','SET_CHECK_STATUS','UPDATE_BEANS_COUNT','UPDATE_DUNGEON_ITEMS','ENTRANCE_DISCOVERED','GAME_COMPLETE']);
const TARGETED=new Set(['PLAYER_UPDATE','PLAYER_SFX','OCARINA_SFX','REQUEST_TELEPORT','TELEPORT_TO']);
const COMBAT=new Set(['ENEMY_STATE','ENEMY_SPAWN','ENEMY_DESPAWN','ENEMY_DIED','ENEMY_HIT','ENEMY_HIT_REQUEST','ENEMY_ROSTER']);
const validKey=k=>typeof k==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(k)&&BigInt(k)<=18446744073709551615n;
const defaults=id=>({clientId:id,name:id===1?'Green Link':'Blue Link',color:id===1?{r:104,g:215,b:127}:{r:104,g:177,b:255},clientVersion:'together-v1',teamId:'together',online:true,self:false,seed:0,isSaveLoaded:false,isGameComplete:false,sceneNum:-1,entranceIndex:0});
export class AnchorRelay {
 constructor(send){this.send=send;this.clients=new Map();this.waitingForHost=false;}
 connect(id){if(![1,2].includes(id)||this.clients.has(id))return false;this.clients.set(id,defaults(id));this.broadcastClients();return true;}
 disconnect(id){this.clients.delete(id);if(id===2)this.waitingForHost=false;this.broadcastClients();}
 flushHostWaiter(){if(this.waitingForHost&&this.clients.get(1)?.isSaveLoaded&&this.clients.has(2)){this.waitingForHost=false;this.send(1,{type:'REQUEST_TEAM_STATE',clientId:2,targetTeamId:'together'});}}
 broadcastClients(){for(const id of this.clients.keys())this.send(id,{type:'ALL_CLIENT_STATE',state:[...this.clients.values()].map(c=>({...c,self:c.clientId===id}))});}
 room(){return{ownerClientId:1,pvpMode:0,showLocationsMode:1,teleportMode:1,syncItemsAndFlags:1};}
 update(id,state){const current=this.clients.get(id),base=defaults(id);if(!current||!state)return;for(const key of ['clientVersion','seed','isSaveLoaded','isGameComplete','sceneNum','entranceIndex'])if(state[key]!==undefined)current[key]=state[key];Object.assign(current,{name:base.name,color:base.color,teamId:'together',online:true,clientId:id});}
 receive(id,input){
  if(!this.clients.has(id)||!input||typeof input.type!=='string')return;
  const packet={...input,clientId:id},other=id===1?2:1;
  if(packet.type==='HANDSHAKE'){
   this.update(id,packet.clientState);this.send(id,{type:'UPDATE_ROOM_STATE',state:this.room()});this.broadcastClients();this.flushHostWaiter();return;
  }
  if(packet.type==='UPDATE_CLIENT_STATE'){
   this.update(id,packet.state);if(this.clients.has(other))this.send(other,{type:packet.type,clientId:id,state:this.clients.get(id)});
   this.flushHostWaiter();return;
  }
  if(packet.type==='UPDATE_ROOM_STATE'){this.send(id,{type:packet.type,state:this.room()});return;}
  if(packet.type==='REQUEST_TEAM_STATE'){
   if(id!==2)return;
   if(this.clients.get(1)?.isSaveLoaded)this.send(1,{...packet,targetTeamId:'together'});else this.waitingForHost=true;return;
  }
  if(packet.type==='UPDATE_TEAM_STATE'){
   if(id===1&&packet.state&&this.clients.has(2))this.send(2,{...packet,targetTeamId:'together',queue:[]});return;
  }
  if(COMBAT.has(packet.type)){
   const sender=this.clients.get(id),recipient=this.clients.get(other);
   if(!sender.isSaveLoaded||!recipient?.isSaveLoaded||packet.targetClientId!==other||!Number.isInteger(packet.sceneNum)||packet.sceneNum!==sender.sceneNum||packet.sceneNum!==recipient.sceneNum)return;
   const authority=Math.min(id,other),request=packet.type==='ENEMY_HIT_REQUEST'||(packet.type==='ENEMY_ROSTER'&&packet.request===true);
   if(request?other!==authority:id!==authority)return;
   if(packet.key!==undefined&&!validKey(packet.key)||packet.parentKey!==undefined&&!validKey(packet.parentKey))return;
   if(packet.type==='ENEMY_STATE'&&(!Array.isArray(packet.enemies)||packet.enemies.length>256||packet.enemies.some(e=>!validKey(e.key))))return;
   if(packet.type==='ENEMY_ROSTER'&&!request&&(!Array.isArray(packet.entries)||packet.entries.length>256||packet.entries.some(e=>!validKey(e.key))))return;
   if(packet.type==='ENEMY_HIT_REQUEST'&&(!Number.isInteger(packet.collider)||packet.collider<0||packet.collider>=12||!Number.isInteger(packet.element)||packet.element<0||packet.element>=128))return;
   this.send(other,packet);return;
  }
  if(TARGETED.has(packet.type)){
   if(packet.targetClientId===other&&this.clients.has(other))this.send(other,packet);return;
  }
  if(TEAM_PACKETS.has(packet.type)&&this.clients.has(other))this.send(other,{...packet,targetTeamId:'together'});
 }
}
export class TeamRules {
 constructor(emit){this.epoch=0;this.emit=emit;}
 death(request){
  if(!request||request.epoch!==this.epoch||![1,2].includes(request.id)||!Number.isInteger(request.entrance)||request.entrance<0||request.entrance>0x613)return false;
  this.epoch++;
  this.emit({kind:'reset',epoch:this.epoch,entrance:request.entrance,victim:request.id});
  return true;
 }
}

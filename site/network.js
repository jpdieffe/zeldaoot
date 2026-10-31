import {AnchorRelay,TeamRules} from './relay.js';
export class AdventureNetwork {
 constructor({role,code,onNotice,onState,onReset}){
  Object.assign(this,{role,code,onNotice,onState,onReset});this.id=role==='host'?1:2;this.epoch=0;this.socket=null;this.pending=[];this.connection=null;this.closed=false;this.connected=false;this.generation=0;this.nativeReady=false;this.snapshotReceived=false;this.lastPlayer=0;this.lastBootstrap=0;
  this.hostId='zeldaoot-together-v2-'+code;
  this.relay=role==='host'?new AnchorRelay((id,packet)=>id===1?this.deliver(packet):this.send({kind:'anchor',packet})):null;
  this.rules=role==='host'?new TeamRules(reset=>{this.applyReset(reset);this.send(reset);}):null;
 }
 start(){
  let settings={};try{settings=JSON.parse(sessionStorage.getItem('zeldaoot-network')||'{}');}catch{}
  const iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'}];
  if(settings.turn)iceServers.push({urls:settings.turn,username:settings.username,credential:settings.credential});
  this.peer=new Peer(this.role==='host'?this.hostId:undefined,{config:{iceServers}});
  this.peer.on('open',()=>{
   if(this.role==='host')this.onNotice('Room ready. Invite your friend.');else this.join();
  });
  this.peer.on('connection',connection=>{
   if(this.role!=='host'||this.connection){connection.on('open',()=>{connection.send({kind:'full'});setTimeout(()=>connection.close(),250);});return;}
   this.attach(connection);
  });
  this.peer.on('disconnected',()=>{if(!this.closed&&!this.peer.destroyed)this.peer.reconnect();});
  this.peer.on('error',error=>{
   this.onNotice(error.type==='unavailable-id'?'That room code is occupied. Leave and create a new adventure.':error.type==='peer-unavailable'?'Room not found. Keep the host game open, then retry.':`Connection issue: ${error.message}. Check your network or connection options.`);
   if(error.type==='peer-unavailable'){const connection=this.connection;this.disconnect?.();connection?.close();}
   if(this.role==='join'&&!this.closed)this.scheduleJoin();
  });
 }
 join(){if(this.closed||this.connection)return;this.attach(this.peer.connect(this.hostId,{reliable:true,serialization:'json'}));}
 scheduleJoin(){if(this.retry||this.closed)return;this.retry=setTimeout(()=>{this.retry=null;this.join();},4000);}
 attach(connection){
  this.connection=connection;
  const timeout=setTimeout(()=>{if(this.connection===connection&&!this.connected){lost();connection.close();}},30000);
  const lost=()=>{
   if(this.connection!==connection)return;clearTimeout(timeout);this.connection=null;this.connected=false;this.generation++;this.pending=[];this.nativeReady=false;this.snapshotReceived=false;this.lastPlayer=0;this.lastBootstrap=0;
   if(this.role==='host'){this.relay.disconnect(2);this.onState(2,null);this.onNotice('Your friend left. They can rejoin this code.');}
   else{this.onState(1,null);this.socket?.remoteClose();if(!this.closed){this.onNotice('Host disconnected. Reconnecting...');this.scheduleJoin();}}
  };
  const opened=()=>{
   if(this.connection!==connection||this.connected)return;clearTimeout(timeout);this.connected=true;this.onNotice('Room connected. Keep both game tabs visible.');
   if(this.role==='host'){this.send({kind:'welcome',epoch:this.epoch});this.relay.connect(2);}else this.socket?.open();
  };
  this.disconnect=lost;
  connection.on('open',opened);if(connection.open)queueMicrotask(opened);
  connection.on('data',message=>{if(this.connection===connection)this.receive(message);});
  connection.on('close',lost);
  connection.on('error',()=>{lost();connection.close();});
 }
 send(message){if(message.kind==='anchor'&&message.packet?.type?.startsWith('ENEMY_'))message={...message,combatEpoch:this.epoch};if(this.connection?.open)this.connection.send(message);}
 receive(message){
  if(!message||typeof message.kind!=='string')return;
  if(message.kind==='full'){this.onNotice('This adventure already has two players. Create another room.');this.close();return;}
  if(message.kind==='welcome'&&this.role==='join'){this.epoch=message.epoch;if(this.pendingDeath)this.send({...this.pendingDeath,epoch:this.epoch});return;}
  if(message.kind==='anchor'){
   if(message.packet?.type?.startsWith('ENEMY_')&&message.combatEpoch!==this.epoch)return;
   if(this.role==='host')this.relay.receive(2,message.packet);else this.deliver(message.packet);
  }
  if(message.kind==='state')this.onState(this.id===1?2:1,message.state);
  if(message.kind==='death'&&this.role==='host')this.rules.death({...message,id:2});
  if(message.kind==='reset'&&this.role==='join')this.applyReset(message);
 }
 applyReset(reset){if(reset.epoch<=this.epoch)return;this.pendingDeath=null;this.epoch=reset.epoch;this.onReset(reset);}
 death(serial,entrance){const request={kind:'death',id:this.id,serial,entrance,epoch:this.epoch};if(this.role==='host')this.rules.death(request);else{this.pendingDeath=request;this.send(request);}}
 status(state){
  this.nativeLoaded=state.loaded;
  if(this.role==='join'&&this.connected&&this.nativeReady&&this.socket?.readyState===1&&state.loaded&&!this.snapshotReceived&&performance.now()-this.lastBootstrap>2000){this.lastBootstrap=performance.now();this.send({kind:'anchor',packet:{type:'REQUEST_TEAM_STATE',targetTeamId:'together'}});}
  this.onState(this.id,state);const{combat,...publicState}=state;this.send({kind:'state',state:publicState});}
 nativeSend(raw){let packet;try{packet=JSON.parse(raw);}catch{return;}if(packet.type==='HANDSHAKE')this.nativeReady=true;if(this.role==='host')this.relay.receive(1,packet);else this.send({kind:'anchor',packet});}
 deliver(packet){if(this.socket?.readyState===1)this.socket.deliver(packet);else{if(this.pending.length>256)this.pending.shift();this.pending.push(packet);}}
 bind(socket){this.socket=socket;this.nativeReady=false;if(this.role==='join')this.snapshotReceived=false;if(this.role==='host'){queueMicrotask(()=>{if(this.socket!==socket||this.closed)return;this.relay.connect(1);socket.open();});}else if(this.connected)queueMicrotask(()=>{if(this.socket===socket&&!this.closed&&this.connected)socket.open();});}
 close(){this.closed=true;clearTimeout(this.retry);const connection=this.connection;this.disconnect?.();connection?.close();this.peer?.destroy();this.socket?.remoteClose();}
 installSocketBridge(){
  const network=this,NativeWebSocket=window.WebSocket;
  class AnchorSocket extends EventTarget {
   constructor(url){super();this.url=url;this.readyState=0;this.bufferedAmount=0;this.binaryType='arraybuffer';this.protocol='';this.extensions='';network.bind(this);}
   emit(type,event){this.dispatchEvent(event);this['on'+type]?.(event);}
   open(){if(this.readyState!==0)return;this.readyState=1;this.emit('open',new Event('open'));for(const packet of network.pending.splice(0))this.deliver(packet);}
   deliver(packet){if(this.readyState!==1||network.socket!==this)return;if(packet.type==='UPDATE_TEAM_STATE'&&network.nativeLoaded)network.snapshotReceived=true;if(packet.type==='PLAYER_UPDATE')network.lastPlayer=performance.now();this.emit('message',new MessageEvent('message',{data:JSON.stringify(packet)}));}
   send(data){if(this.readyState===1&&network.socket===this)network.nativeSend(data);}
   close(){this.remoteClose();}
   remoteClose(){if(this.readyState===3)return;this.readyState=3;this.emit('close',new CloseEvent('close',{code:1000,wasClean:true}));}
  }
  function Socket(url,protocols){return String(url).includes('soh-anchor.zalo.partykit.dev')?new AnchorSocket(String(url)):new NativeWebSocket(url,protocols);}
  Object.assign(Socket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3});Socket.prototype=NativeWebSocket.prototype;window.WebSocket=Socket;
 }
}

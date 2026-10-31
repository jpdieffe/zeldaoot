// A queued teleport is not an arrival. Retry until native player traffic and
// both positions confirm the guest reached the host, then allow free exploration.
export class Rendezvous {
 constructor(){this.reset();}
 reset(){this.done=false;this.nextAttempt=0;this.arrivedAt=null;}
 update({now,connected,ready,local,host,freshPlayer,meet}){
  if(!connected){this.reset();return 'Connecting to your friend';}
  if(this.done)return 'Two heroes connected';
  if(!ready||!local?.loaded||!host?.loaded)return 'Synchronizing the adventure…';
  const near=freshPlayer&&local.scene===host.scene&&local.age===host.age&&local.peers?.some(p=>p.id===1&&p.visible)&&Math.hypot(local.x-host.x,local.y-host.y,local.z-host.z)<180;
  if(near){this.arrivedAt??=now;if(now-this.arrivedAt>=1000){this.done=true;return 'Two heroes connected';}}
  else this.arrivedAt=null;
  if(!near&&now>=this.nextAttempt){this.nextAttempt=now+4000;meet();}
  return local.age!==host.age?'Meetup needs both Links to be the same age.':'Joining your friend’s location… Keep the host in a normal room.';
 }
}

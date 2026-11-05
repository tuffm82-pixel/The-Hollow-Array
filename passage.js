export function createPassage(){
 return {phase:'waiting',timer:0,x:0,z:0,yaw:0,end:0,heard:-1,attention:0,lastKnown:null,decoy:0,used:false,stride:0,seenHiding:false,visible:false};
}

export function callSpeaker(state){
 if(!['warning','patrol'].includes(state.phase)||state.used)return false;
 state.used=true;
 state.decoy=9;
 return true;
}

export function advancePassage(config,state,dt,player){
 const inside=Math.abs(player.x)<2.9&&player.z>config.minZ&&player.z<config.maxZ;
 if(state.phase==='waiting'&&inside){
  const near=config.maxZ-1.2,far=config.minZ+1.2;
  state.z=Math.abs(player.z-near)>Math.abs(player.z-far)?near:far;
  state.end=state.z===near?far:near;
  state.yaw=state.end>state.z?Math.PI:0;
  state.phase='warning';
  state.timer=1.7;
  return 'warning';
 }
 if(state.phase==='waiting'||state.phase==='quiet')return null;
 state.timer=Math.max(0,state.timer-dt);
 if(state.timer>0)return null;
 if(state.phase==='warning'){
  state.phase='patrol';state.timer=30;
  return 'patrol';
 }
 if(state.phase==='patrol'){
  retreatPassage(state);
  return 'retreat';
 }
 state.phase='quiet';
 return 'quiet';
}

export function retreatPassage(state){
 state.phase='retreat';state.timer=3.6;state.decoy=0;state.visible=false;
}

export function passageTarget(config,state,sense,dt){
 if(state.phase==='retreat')return{x:0,z:Math.abs(config.minZ-state.z)<Math.abs(config.maxZ-state.z)?config.minZ:config.maxZ};
 state.attention=Math.max(0,state.attention-dt);
 state.decoy=Math.max(0,state.decoy-dt);
 if(state.decoy>0&&!(sense.visible&&sense.distance<2.6))return config.speaker;
 if(sense.visible||sense.heard){
  state.attention=sense.visible?4:3;
  state.lastKnown=sense.target;
 }
 if(state.attention>0&&state.lastKnown)return state.lastKnown;
 if(Math.abs(state.z-state.end)<.65)state.end=state.end<=(config.minZ+config.maxZ)/2?config.maxZ-1.2:config.minZ+1.2;
 return{x:0,z:state.end};
}

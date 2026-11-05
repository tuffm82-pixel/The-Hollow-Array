export const TOOL_ORDER=['arc','sonar','cryo'];
export const ARC_AIM_ANGLE=.24;
export const toolReach=tool=>tool==='cryo'?10:tool==='arc'?24:18;
export function createArenaState(){return{armed:0,cooldown:0};}
export function armArena(state){
 if(state.armed>0||state.cooldown>0)return false;
 state.armed=18;
 return true;
}
export function updateArena(arena,state,target,dt){
 state.cooldown=Math.max(0,state.cooldown-dt);
 target.arenaWindow=Math.max(0,target.arenaWindow-dt);
 if(state.armed<=0)return null;
 const x=target.x-arena.hazard.x,z=target.z-arena.hazard.z;
 const inside=arena.kind==='beam'?Math.abs(x)<1.65&&Math.abs(z)<arena.radius:Math.hypot(x,z)<arena.radius;
 if(inside&&target.hp>0){
  state.armed=0;state.cooldown=11;
  target.arenaBroken=true;target.arenaWindow=8;target.frozen=Math.max(target.frozen,4.5);
  return 'triggered';
 }
 state.armed=Math.max(0,state.armed-dt);
 return state.armed===0?'expired':null;
}
export function createToolState(inventory=[]){return{inventory:[...inventory],selected:'arc',held:false,charge:0,cooldown:0,cooldowns:{arc:0,sonar:0,cryo:0},effect:0};}
export function selectTool(state,id){if(!state.inventory.includes(id))return false;state.selected=id;state.held=false;state.charge=0;state.cooldown=state.cooldowns[id]||0;return true;}
export function updateTools(state,dt){dt=Math.max(0,Math.min(.1,dt));for(const tool of TOOL_ORDER)state.cooldowns[tool]=Math.max(0,state.cooldowns[tool]-dt);state.cooldown=state.cooldowns[state.selected]||0;state.effect=Math.max(0,state.effect-dt);if(state.held&&state.selected==='arc'&&!state.cooldown)state.charge=Math.min(1.5,state.charge+dt);}
export function isVulnerable(target){
 if(target.arenaBroken===false)return false;
 return target.arenaWindow>0||(target.type==='graft'?target.cycle>2.3&&target.cycle<4.9:target.type==='widow'?target.frozen>0:target.revealed>0);
}
export function fireTool(state,target,{visible=false,distance=Infinity,aimError=Infinity}={}){
 const tool=state.selected;state.held=false;state.charge=0;
 if(!state.inventory.includes(tool))return{ok:false,message:'Find this tool first.'};
 if(state.cooldowns[tool]>0)return{ok:false,message:'The tool is cooling. Keep moving.'};
 state.cooldown=state.cooldowns[tool]=tool==='arc'?.72:tool==='sonar'?6:7;state.effect=.35;
 if(!target||target.hp<=0||!visible||distance>toolReach(tool)||aimError>(tool==='arc'?ARC_AIM_ANGLE:.65))return{ok:false,used:true,message:'Aim at the creature’s body from a clear sightline.'};
 if(tool==='sonar'){target.revealed=4.5;return{ok:true,used:true,event:'reveal',message:target.type==='cantor'?'Resonance hit. Switch to ARC when the chest is exposed.':'The resonance pulse outlines the creature.'};}
 if(tool==='cryo'){target.frozen=5;return{ok:true,used:true,event:'freeze',message:target.type==='widow'?'The amber core is open. Switch to ARC and strike.':'The cold burst slows its next attack.'};}
 if(!isVulnerable(target))return{ok:false,used:true,event:'armour',message:target.arenaBroken===false?'Its armour is sealed. Use the marked room device first.':target.type==='graft'?'Wait for its lunge to end or reset the breaker.':target.type==='widow'?'Freeze it with CRYO or use the coolant tiles again.':'Use ECHO or draw it through the floodlight again.'};
 target.hp=Math.max(0,target.hp-1);target.frozen=Math.max(target.frozen,.65);return{ok:true,used:true,event:target.hp?'hit':'defeat',message:target.hp?'Direct hit. Reposition and prepare the next shot.':'Creature defeated.'};
}

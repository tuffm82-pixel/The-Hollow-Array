export const TOOL_ORDER=['arc','sonar','cryo'];
export function createToolState(inventory=[]){return{inventory:[...inventory],selected:'arc',held:false,charge:0,cooldown:0,cooldowns:{arc:0,sonar:0,cryo:0},effect:0};}
export function selectTool(state,id){if(!state.inventory.includes(id))return false;state.selected=id;state.held=false;state.charge=0;state.cooldown=state.cooldowns[id]||0;return true;}
export function updateTools(state,dt){dt=Math.max(0,Math.min(.1,dt));for(const tool of TOOL_ORDER)state.cooldowns[tool]=Math.max(0,state.cooldowns[tool]-dt);state.cooldown=state.cooldowns[state.selected]||0;state.effect=Math.max(0,state.effect-dt);if(state.held&&state.selected==='arc'&&!state.cooldown)state.charge=Math.min(1.5,state.charge+dt);}
export function isVulnerable(target){return target.type==='graft'?target.cycle>2.3&&target.cycle<4.9:target.type==='widow'?target.frozen>0:target.revealed>0;}
export function fireTool(state,target,{visible=false,distance=Infinity,aimError=Infinity}={}){
 const tool=state.selected,charge=state.charge;state.held=false;state.charge=0;
 if(!state.inventory.includes(tool))return{ok:false,message:'Find this tool first.'};
 if(state.cooldowns[tool]>0)return{ok:false,message:'The tool is cooling. Keep moving.'};
 if(tool==='arc'&&charge<.75)return{ok:false,message:'Hold FIRE until the charge ring is full, then release.'};
 state.cooldown=state.cooldowns[tool]=tool==='arc'?1.6:tool==='sonar'?6:7;state.effect=.35;
 if(!target||target.hp<=0||!visible||distance>(tool==='cryo'?10:18)||aimError>(tool==='arc'?.16:.65))return{ok:false,used:true,message:'Missed. Aim at the creature through a clear sightline.'};
 if(tool==='sonar'){target.revealed=4.5;return{ok:true,used:true,event:'reveal',message:target.type==='cantor'?'The chest is exposed. Switch to ARC, charge and strike.':'The resonance pulse outlines the creature.'};}
 if(tool==='cryo'){target.frozen=5;return{ok:true,used:true,event:'freeze',message:target.type==='widow'?'The amber core is open. Switch to ARC and strike.':'The cold burst slows its next attack.'};}
 if(!isVulnerable(target))return{ok:false,used:true,event:'armour',message:target.type==='graft'?'Wait for its lunge to end. Strike while it recovers.':target.type==='widow'?'Freeze its amber abdomen with CRYO first.':'Reveal its chest with ECHO first.'};
 target.hp=Math.max(0,target.hp-1);target.frozen=Math.max(target.frozen,.65);return{ok:true,used:true,event:target.hp?'hit':'defeat',message:target.hp?'Direct hit. Reposition and prepare the next shot.':'Creature defeated.'};
}

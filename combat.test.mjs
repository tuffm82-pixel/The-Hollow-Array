import test from 'node:test';import assert from 'node:assert/strict';import{createToolState,fireTool,updateTools,selectTool,createArenaState,armArena,updateArena}from'./combat.js';
import {ARENAS} from './layout.js';
const target=type=>({type,hp:3,cycle:3,frozen:0,revealed:0});const aim={visible:true,distance:6,aimError:.02};
function charge(s){s.held=true;for(let i=0;i<11;i++)updateTools(s,.1);}
test('Arc fires on a tap with body aim but cannot shoot through cover',()=>{
 const s=createToolState(['arc']),t=target('graft');
 assert(!fireTool(s,t,{...aim,visible:false}).ok);assert.equal(t.hp,3);
 for(let i=0;i<10;i++)updateTools(s,.1);
 assert(fireTool(s,t,{...aim,aimError:.21}).ok);assert.equal(t.hp,2);
});
test('different monsters require their own tool weakness',()=>{for(const [type,tool]of[['widow','cryo'],['cantor','sonar']]){const s=createToolState(['arc',tool]),t=target(type);charge(s);assert.equal(fireTool(s,t,aim).event,'armour');for(let i=0;i<20;i++)updateTools(s,.1);selectTool(s,tool);assert(fireTool(s,t,aim).ok);selectTool(s,'arc');charge(s);assert.equal(fireTool(s,t,aim).event,'hit');}});
test('Graft Runner is protected during its windup and shots must be aimed',()=>{const s=createToolState(['arc']),t=target('graft');t.cycle=1;charge(s);assert.equal(fireTool(s,t,aim).event,'armour');for(let i=0;i<20;i++)updateTools(s,.1);t.cycle=3;charge(s);assert(!fireTool(s,t,{...aim,aimError:.5}).ok);assert.equal(t.hp,3);});
test('each monster can be defeated without bypassing cooldowns or exposure timers',()=>{
 for(const [type,tool]of[['widow','cryo'],['cantor','sonar']]){
  const s=createToolState(['arc',tool]),t=target(type);
  const step=seconds=>{for(let time=0;time<seconds;time+=.05){updateTools(s,.05);t.frozen=Math.max(0,t.frozen-.05);t.revealed=Math.max(0,t.revealed-.05);}};
  for(let hit=0;hit<3;hit++){
   selectTool(s,tool);assert(fireTool(s,t,aim).ok);assert(s.cooldowns[tool]>0);
   selectTool(s,'arc');assert.equal(s.cooldown,0);s.held=true;step(1);assert.equal(fireTool(s,t,aim).event,hit===2?'defeat':'hit');
   selectTool(s,tool);assert(!fireTool(s,t,aim).ok);step(8);
  }
  assert.equal(t.hp,0);
 }
});
test('switching tools cannot bypass a weapon cooldown',()=>{const s=createToolState(['arc','cryo']),t=target('graft');charge(s);assert(fireTool(s,t,aim).ok);selectTool(s,'cryo');selectTool(s,'arc');assert(s.cooldown>0);s.charge=1;assert(!fireTool(s,t,aim).ok);assert.equal(t.hp,2);});
test('each encounter requires the creature to enter an armed room hazard before Arc can hurt it',()=>{
 for(const [type,arena] of Object.entries(ARENAS)){
  const s=createToolState(['arc']),device=createArenaState();
  const actor={...target(type),x:arena.hazard.x+8,z:arena.hazard.z,arenaBroken:false,arenaWindow:0,frozen:5,revealed:5};
  assert.equal(fireTool(s,actor,aim).event,'armour');
  assert(armArena(device));assert.equal(updateArena(arena,device,actor,.1),null);
  actor.x=arena.hazard.x;
  assert.equal(updateArena(arena,device,actor,.1),'triggered');
  assert.equal(actor.arenaBroken,true);assert(!armArena(device));
  for(let shot=0;shot<3;shot++){
   for(let i=0;i<8;i++){updateTools(s,.1);updateArena(arena,device,actor,.1);}
   assert.equal(fireTool(s,actor,aim).event,shot===2?'defeat':'hit');
  }
 }
});

import test from'node:test';import assert from'node:assert/strict';import{createCampaign}from'./campaign.js';import{STAGES}from'./layout.js';
import {checkpointSpawn} from './layout.js';
import {canSeeBetween,isWalkable} from './world.js';
test('chapter one requires the tools and three distinct creature victories before its cliffhanger',()=>{const g=createCampaign();assert(!g.interact('exit').ok);for(const stage of STAGES){if(stage.combat)assert(!g.interact(stage.id).ok);if(stage.id==='exit'){assert(!g.interact('exit').ok);for(let i=0;i<121;i++)g.update(.25);}assert(g.interact(stage.id,{combatWon:!!stage.combat}).ok);}assert.equal(g.state.phase,'won');assert.match(g.state.message,/CHAPTER TWO/);assert.deepEqual(g.state.defeated,['graft','widow','cantor']);});
test('checkpoints restore earned tools and defeated enemies without skipping the active fight',()=>{const g=createCampaign(11);assert.deepEqual(g.state.inventory,['arc','sonar','cryo']);assert.deepEqual(g.state.defeated,['graft','widow']);assert.equal(g.state.objective.combat,'cantor');assert(!g.interact('cantor').ok);});
test('terminal states freeze progression and pressure',()=>{const g=createCampaign();g.die('caught');const s=g.snapshot();g.update(.25);assert(!g.interact('desk').ok);assert.deepEqual(g.snapshot(),s);});

test('the fireplace and shelter cupboards provide solid cover',()=>{
 assert.equal(isWalkable(6.5,-5.4),false);
 assert.equal(canSeeBetween({x:5.3,z:-5.4},{x:7.4,z:-5.4}),false);
 assert.equal(canSeeBetween({x:5.3,z:-3},{x:7.4,z:-3}),true);
 assert.equal(canSeeBetween({x:-1.8,z:-15},{x:-1.8,z:-17}),false);
 assert.equal(canSeeBetween({x:-1.8,y:2.8,z:-15},{x:-1.8,y:2.8,z:-17}),true);
});

test('every chapter checkpoint spawns on walkable ground',()=>{
 for(const [chapter,stage] of STAGES.entries()){
  const {x,z}=checkpointSpawn(chapter);
  assert(isWalkable(x,z),stage.title);
 }
});

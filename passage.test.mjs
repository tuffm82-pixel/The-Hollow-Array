import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSAGES,SERVICE_DOORS} from './layout.js';
import {canSeeBetween,isWalkable} from './world.js';
import {advancePassage,callSpeaker,createPassage,passageTarget,retreatPassage} from './passage.js';

test('corridor danger announces itself from the far end and gives way to a quiet interval',()=>{
 const config=PASSAGES.records,state=createPassage();
 assert.equal(advancePassage(config,state,1,{x:-7,z:-21}),null);
 assert.equal(advancePassage(config,state,.1,{x:0,z:-13}),'warning');
 assert(state.z<-25);
 assert.equal(advancePassage(config,state,1.7,{x:0,z:-13}),'patrol');
 assert.equal(advancePassage(config,state,30,{x:0,z:-13}),'retreat');
 assert.equal(advancePassage(config,state,3.6,{x:0,z:-13}),'quiet');
 assert.equal(advancePassage(config,state,12,{x:0,z:-13}),null);
});

test('the PA redirects the patrol once, while a close sighting can still override it',()=>{
 const config=PASSAGES.archive,state=createPassage();
 advancePassage(config,state,0,{x:0,z:-43});
 advancePassage(config,state,1.7,{x:0,z:-43});
 assert(callSpeaker(state));
 assert.equal(callSpeaker(state),false);
 assert.deepEqual(passageTarget(config,state,{visible:false,heard:false},1),config.speaker);
 const target={x:1,z:-25};
 assert.deepEqual(passageTarget(config,state,{visible:true,distance:2,target},1),target);
 retreatPassage(state);
 assert.equal(state.decoy,0);
 assert.equal(state.phase,'retreat');
});

test('both service doors are physically traversable and adjacent walls still block sight',()=>{
 for(const [room,z] of Object.entries(SERVICE_DOORS)){
  const x=room==='records'?-3:3;
  assert(isWalkable(x,z));
  assert(canSeeBetween({x:x-1,z},{x:x+1,z}));
  assert(!canSeeBetween({x:x-1,z:z-1.3},{x:x+1,z:z-1.3}));
 }
});

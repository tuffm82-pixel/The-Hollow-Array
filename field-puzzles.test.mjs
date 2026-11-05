import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELD_PUZZLES} from './layout.js';
import {aimDevice,pulseDevice} from './field-puzzles.js';

test('calibration distinguishes all three tools and counts a rig once',()=>{
 const puzzle=FIELD_PUZZLES.workshop,state=new Set();
 assert.equal(pulseDevice(puzzle,state,'test-echo','arc').status,'wrong-tool');
 assert.equal(state.size,0);
 assert.equal(pulseDevice(puzzle,state,'coolant','cryo').status,'powered');
 assert.equal(pulseDevice(puzzle,state,'coolant','cryo').status,'latched');
 assert.equal(pulseDevice(puzzle,state,'load','arc').complete,false);
 assert.equal(pulseDevice(puzzle,state,'test-echo','sonar').complete,true);
});

test('dome relays power in order and device aim respects range and walls',()=>{
 const puzzle=FIELD_PUZZLES.relay,state=new Set();
 assert.equal(pulseDevice(puzzle,state,'relay-3','sonar').status,'wrong-order');
 const device=puzzle.devices[0],origin={x:device.x,y:device.y,z:device.z+3};
 assert.equal(aimDevice(puzzle,origin,0,0,()=>true,state),device);
 assert.equal(aimDevice(puzzle,origin,0,0,()=>false,state),null);
 assert.equal(aimDevice(puzzle,{...origin,z:origin.z+30},0,0,()=>true,state),null);
 for(const [index,target] of puzzle.devices.entries()){
  const result=pulseDevice(puzzle,state,target.id,'sonar');
  assert.equal(result.status,'powered');
  assert.equal(result.complete,index===2);
 }
});

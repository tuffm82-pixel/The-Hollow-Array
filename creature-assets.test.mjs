import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Box3,LoopOnce,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

for(const [id,height,triangles]of [['runner',1.606,12564],['stalker',2.016,12016],['horror',1.998,6219]]){
 test(`${id} keeps its original proportions and animated geometry on export`,async()=>{
  const bytes=await readFile(new URL(`./assets/creatures/${id}.glb`,import.meta.url));
  const {scene,animations}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const meshes=[];scene.traverse(n=>{if(n.isMesh)meshes.push(n);});
  assert(meshes.length<=5&&meshes.every(m=>m.isSkinnedMesh));
  assert.equal(meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),triangles);
  const bounds=()=>new Box3().setFromObject(scene,true),rest=bounds();
  assert(Math.abs(rest.max.y-rest.min.y-height)<.015,`bind pose height: ${rest.max.y-rest.min.y}`);
  assert(Math.abs(rest.min.y)<.015);
  const mixer=new AnimationMixer(scene),foot=scene.getObjectByName('footL');
  function sample(name,time){const clip=animations.find(c=>c.name===name);assert(clip,`missing ${name}`);mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();action.time=time;mixer.update(0);scene.updateMatrixWorld(true);return bounds();}
  const poses=[];for(const clip of ['idle','walk','run','attack','stagger','death']){const animation=animations.find(c=>c.name===clip);assert(animation);for(const p of [0,.27,.53,1]){const b=sample(clip,animation.duration*p),size=b.getSize(new Vector3());assert(size.toArray().every(v=>Number.isFinite(v)&&v<height*1.6),`${clip} at ${p}: ${size.toArray()}`);if(clip==='run')poses.push(foot.getWorldPosition(new Vector3()));}}
  assert(poses[0].distanceTo(poses[1])>.1,'running must move the foot');
  assert(poses[0].distanceTo(poses.at(-1))<.001,'running loop must close');
  const final=sample('death',animations.find(c=>c.name==='death').duration);assert(final.max.y-final.min.y<height*.7,'death should leave a fallen pose');assert(final.min.y>=-.01&&final.min.y<.04,'the corpse should rest on the floor');
 });
}

import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createMonster as createFallback} from './creatures.js';

export const CREATURE_ASSETS={
 runner:new URL('./assets/creatures/runner.glb',import.meta.url).href,
 stalker:new URL('./assets/creatures/stalker.glb',import.meta.url).href,
 horror:new URL('./assets/creatures/horror.glb',import.meta.url).href,
};
const cache=new Map(),loader=new GLTFLoader();
function weather(gltf,id){
 const tint=new THREE.Color({runner:0x566052,stalker:0x5d4740,horror:0x535767}[id]);
 gltf.scene.traverse(mesh=>{if(!mesh.isMesh)return;const material=mesh.material;if(material.emissive?.getHex())return;const position=mesh.geometry.attributes.position,colors=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i),grain=Math.sin(23*x+18*y-31*z)*Math.cos(47*x+12*y+25*z),marble=Math.sin(12*y+Math.sin(8*x-4*z)*2+3*z),stain=.80+.11*marble+.08*grain;colors.set([stain,stain*(.97+.03*marble),stain*(.95+.04*grain)],i*3);}
  mesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));material.vertexColors=true;material.color.lerp(tint,.45);material.roughness=Math.max(.52,material.roughness);material.needsUpdate=true;
 });return gltf;
}
export function loadCreature(id){if(!cache.has(id))cache.set(id,loader.loadAsync(CREATURE_ASSETS[id]).then(gltf=>weather(gltf,id)).catch(error=>{cache.delete(id);throw error;}));return cache.get(id);}
export function animatedCreature(gltf){
 const group=clone(gltf.scene),mixer=new THREE.AnimationMixer(group),actions=new Map(gltf.animations.map(c=>[c.name,mixer.clipAction(c)]));let current=null;
 group.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;n.frustumCulled=false;}});
 function play(name,{immediate=false,once=false}={}){const action=actions.get(name);if(!action)return;if(current===action&&!immediate)return;const old=current;action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;action.play();if(old&&old!==action){if(immediate)old.stop();else{old.fadeOut(.16);action.fadeIn(.16);}}current=action;}
 play('idle');
 return{group,mixer,actions,play,update(dt){mixer.update(Math.min(dt,.1));},sample(name,time){mixer.stopAllAction();current=null;play(name,{immediate:true,once:true});current.time=Math.max(0,Math.min(current.getClip().duration,time));mixer.update(0);group.updateMatrixWorld(true);},dispose(){mixer.stopAllAction();mixer.uncacheRoot(group);}};
}
// Stable synchronous gameplay contract; a procedural fallback remains available
// until the real GLB is ready, and also when a network load fails.
export function createMonster(type){
 const id={graft:'runner',widow:'stalker',cantor:'horror'}[type],fallback=createFallback(type),group=new THREE.Group();group.add(fallback.group);let loaded=null,dead=false,staggered=false,disposed=false;
 const height={graft:1.6,widow:2.6,cantor:3.2}[type],weakHeight={graft:.9,widow:1.6,cantor:2}[type];
 const weak=new THREE.Mesh(new THREE.SphereGeometry(type==='cantor'?.14:.10,12,8),new THREE.MeshStandardMaterial({color:0xffb46a,emissive:type==='cantor'?0x34859b:0xc45912,emissiveIntensity:.9,roughness:.4}));weak.position.set(0,weakHeight,-.21);weak.name='exposed sensory node';weak.userData.weakpoint=true;group.add(weak);
 const ready=loadCreature(id).then(gltf=>{if(disposed)return;loaded=animatedCreature(gltf);const box=new THREE.Box3().setFromObject(loaded.group),scale=height/(box.max.y-box.min.y);loaded.group.scale.setScalar(scale);loaded.group.position.y=-box.min.y*scale;loaded.group.rotation.y=Math.PI;group.add(loaded.group);group.remove(fallback.group);fallback.dispose();group.userData.assetReady=true;}).catch(error=>{group.userData.assetError=String(error);});
 return{group,ready,update(dt,time,{speed=0,attack=0,stun=0,death=0,vulnerable=false}={}){
  weak.visible=death<=0;weak.material.emissiveIntensity=vulnerable?2.5:.35;
  if(!loaded){fallback.update(dt,time,{speed,attack,stun,death,vulnerable});return;}
  if(death>0){loaded.sample('death',Math.min(1,death)*2.1);dead=true;return;}
  if(dead){dead=false;loaded.play('idle',{immediate:true});}
  if(stun>0){if(!staggered){loaded.play('stagger',{once:true});staggered=true;}}else{staggered=false;if(attack>0){loaded.sample('attack',attack*1.25);return;}loaded.play(speed>1.4?'run':speed>.1?'walk':'idle');}
  loaded.update(dt);
 },dispose(){disposed=true;loaded?.dispose();if(!loaded)fallback.dispose();weak.geometry.dispose();weak.material.dispose();}};
}

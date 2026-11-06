import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const CREW = [
 {name:'Mara', jacket:0x427b76, trousers:0x303942, skin:0xa86f55, hair:0x231b1c, patch:0xdad6bb, role:'medic', height:.97},
 {name:'Ivo', jacket:0xa7823d, trousers:0x343b3c, skin:0xca9b77, hair:0x52392e, patch:0xe0b758, role:'engineer', height:1.06},
 {name:'Noor', jacket:0x514d69, trousers:0x303344, skin:0x8f543e, hair:0x18171b, patch:0x89c9c7, role:'radio', height:1.01},
];
const CASUALTIES = [
 {name:'Shelter guard', jacket:0x535b41, trousers:0x35372f, skin:0x947f70, hair:0x302c28, patch:0x929271, role:'guard', height:1.06},
 {name:'Intake technician', jacket:0x687275, trousers:0x424449, skin:0xb18d78, hair:0x393034, patch:0x898678, role:'engineer', height:.95},
 {name:'Shelter attendant', jacket:0x877d63, trousers:0x4a453c, skin:0x705e56, hair:0x252125, patch:0x898471, role:'guard', height:1},
];

const IDLE = {hip:.94, lean:0, roll:0, chest:-.028, head:0,
 thighL:.035, thighR:-.055, kneeL:-.075, kneeR:-.045,
 armL:-.05, armR:-.095, elbowL:.24, elbowR:.29, spreadL:-.085, spreadR:.10};
const INJURED = {...IDLE,hip:.54,lean:.10,roll:.09,chest:-.17,head:.16,
 thighL:1.10,thighR:1.37,kneeL:-1.57,kneeR:-1.85,
 armL:.72,armR:.28,elbowL:1.1,elbowR:.82,spreadL:.25,spreadR:-.29};
const BRACE = {...INJURED,hip:.59,lean:-.08,chest:-.29,head:.20,
 armL:.46,armR:.91,elbowL:.68,elbowR:.34};
const RISE = {...IDLE,hip:.72,lean:-.12,chest:-.31,head:.22,roll:-.085,
 thighL:.48,thighR:.68,kneeL:-.82,kneeR:-1.04,
 armL:.57,armR:.30,elbowL:.52,elbowR:.62};
const SETTLE = {...IDLE,hip:.91,lean:-.045,roll:.055,thighL:.20,thighR:-.12,
 kneeL:-.33,kneeR:-.09,armL:-.17,armR:.28};
const FALLEN = {...IDLE,hip:.23,lean:1.54,roll:.10,chest:-.08,head:.16,
 thighL:.12,thighR:.42,kneeL:-.14,kneeR:-.61,
 armL:.28,armR:-.03,elbowL:.18,elbowR:.38,spreadL:-.48,spreadR:.52};
const FALLS = [
 {...FALLEN,lean:1.57,roll:.02,thighL:.07,thighR:.37,kneeR:-.47,spreadL:-.92,armR:.35},
 {...FALLEN,lean:1.51,roll:-1.06,chest:-.10,thighL:.53,thighR:.66,kneeL:-.64,kneeR:-.80,armL:.81,elbowL:1.18,spreadR:.15},
 {...FALLEN,lean:-1.52,roll:-.04,chest:.04,head:-.13,thighL:-.10,thighR:.02,kneeL:-.08,kneeR:-.12,armL:.13,armR:1.40,elbowR:1.12,spreadL:-.42,spreadR:.31},
];

function makeMaterials(palette) {
 const mat=(color,roughness=.82,more={})=>new THREE.MeshStandardMaterial({color,roughness,...more});
 const jacket=new THREE.Color(palette.jacket);
 return {
  jacket:mat(jacket), seam:mat(jacket.clone().multiplyScalar(.73)),
  pants:mat(palette.trousers), skin:mat(palette.skin,.87),
  cheek:mat(new THREE.Color(palette.skin).multiplyScalar(.77)),
  hair:mat(palette.hair,.94), boot:mat(0x1c2226,.70), steel:mat(0x8f9ca0,.43,{metalness:.43}),
  patch:mat(palette.patch,.69), thread:mat(0x2c3838,.91),
  ivory:mat(0xb9ab92,.83), lens:mat(0x364e51,.29,{metalness:.28}),
  status:mat(0x7be3bf,.46,{emissive:0x307352,emissiveIntensity:.52}),
 };
}

function addShape(parent,geometry,material,position,scale=[1,1,1],rotation=[0,0,0]){
 const mesh=new THREE.Mesh(geometry,material);
 mesh.position.set(...position);mesh.scale.set(...scale);mesh.rotation.set(...rotation);
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 return mesh;
}

const ellipsoid=(parent,mat,xyz,size)=>addShape(parent,new THREE.SphereGeometry(1,12,8),mat,xyz,size);
const panel=(parent,mat,xyz,size,rotation)=>addShape(parent,new THREE.BoxGeometry(...size),mat,xyz,undefined,rotation);
const capsule=(parent,mat,xyz,radius,length,scale,rotation)=>addShape(parent,new THREE.CapsuleGeometry(radius,length,3,10),mat,xyz,scale,rotation);
function pivot(parent,x=0,y=0,z=0){
 const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);return group;
}

function makeRig(palette,alive){
 const mat=makeMaterials(palette),root=new THREE.Group();
 root.name=palette.name;
 root.userData.friendly=alive;
 const hips=pivot(root),chest=pivot(hips,0,.07,0),head=pivot(chest,0,.49,0);
 const arms=[],elbows=[],thighs=[],knees=[],eyes=[];

 ellipsoid(hips,mat.pants,[0,.014,.006],[.209,.145,.130]);
 capsule(chest,mat.jacket,[0,.218,0],.205,.127,[1,.99,.63]);
 ellipsoid(chest,mat.jacket,[0,.322,.007],[.247,.149,.124]);
 ellipsoid(chest,mat.seam,[0,.415,0],[.109,.047,.094]);
 panel(chest,mat.seam,[0,.158,-.130],[.018,.272,.014]);
 panel(chest,mat.steel,[0,.255,-.140],[.028,.058,.012]);
 for(const side of [-1,1]){
  panel(chest,mat.seam,[side*.110,.208,-.113],[.119,.124,.030],[0,side*-.22,0]);
  panel(chest,mat.patch,[side*.119,.267,-.132],[.088,.018,.012],[0,side*-.22,0]);
 }
 ellipsoid(hips,mat.boot,[0,.063,.003],[.204,.039,.131]);
 panel(hips,mat.steel,[0,.067,-.132],[.062,.048,.026]);
 panel(hips,mat.seam,[.158,.040,.083],[.093,.132,.089],[.07,.24,-.13]);

 ellipsoid(head,mat.skin,[0,.048,.005],[.066,.103,.068]);
 ellipsoid(head,mat.skin,[0,.125,0],[.097,.131,.091]);
 ellipsoid(head,mat.skin,[0,.064,-.032],[.071,.069,.067]);
 ellipsoid(head,mat.cheek,[0,.104,-.089],[.023,.035,.030]);
 ellipsoid(head,mat.cheek,[0,.056,-.089],[.040,.008,.012]);
 for(const side of [-1,1]){
  ellipsoid(head,mat.skin,[side*.097,.115,.001],[.018,.032,.019]);
  ellipsoid(head,mat.hair,[side*.042,.137,-.084],[.024,.007,.012]);
  if(alive){
   const eye=pivot(head,side*.040,.126,-.089);eyes.push(eye);
   ellipsoid(eye,mat.ivory,[0,0,0],[.017,.008,.009]);
   ellipsoid(eye,mat.thread,[0,0,-.008],[.006,.007,.004]);
  }
 }
 ellipsoid(head,mat.hair,[0,.185,.033],[.103,.077,.088]);
 if(palette.role==='engineer'){
  ellipsoid(head,mat.patch,[0,.209,.012],[.117,.060,.102]);
  ellipsoid(head,mat.seam,[0,.191,-.063],[.125,.014,.072]);
 }else if(palette.role==='guard'){
  ellipsoid(head,mat.seam,[0,.193,.019],[.115,.081,.110]);
  panel(head,mat.boot,[0,.172,-.076],[.158,.024,.044]);
 }else{
  const side=palette.role==='medic'?1:-1;
  ellipsoid(head,mat.hair,[side*.071,.145,.046],[.039,.097,.060]);
  ellipsoid(head,mat.hair,[side*.027,.123,.087],[.055,.102,.054]);
 }

 for(const [index,side] of [-1,1].entries()){
  const arm=pivot(chest,side*.22,.344,0);arms[index]=arm;
  ellipsoid(arm,mat.jacket,[side*.020,-.026,0],[.092,.106,.086]);
  capsule(arm,mat.jacket,[0,-.149,0],.067,.174,[1,.97,.96]);
  panel(arm,mat.patch,[side*.060,-.090,-.034],[.029,.069,.071],[0,side*.34,0]);
  const elbow=pivot(arm,0,-.291,0);elbows[index]=elbow;
  capsule(elbow,mat.jacket,[0,-.103,0],.055,.135,[1,1,.94]);
  ellipsoid(elbow,mat.seam,[0,-.213,0],[.052,.037,.051]);
  ellipsoid(elbow,mat.skin,[0,-.262,-.012],[.043,.067,.034]);
  ellipsoid(elbow,mat.skin,[-side*.032,-.246,-.022],[.018,.039,.019]);

  const thigh=pivot(hips,side*.108,-.027,0);thighs[index]=thigh;
  capsule(thigh,mat.pants,[0,-.199,.006],.090,.220,[1,1,.94]);
  const knee=pivot(thigh,0,-.402,.003);knees[index]=knee;
  ellipsoid(knee,mat.pants,[0,-.019,0],[.074,.089,.072]);
  ellipsoid(knee,mat.seam,[0,-.019,-.058],[.059,.062,.031]);
  capsule(knee,mat.pants,[0,-.172,.009],.068,.215,[1,1,.90]);
  capsule(knee,mat.boot,[0,-.329,-.008],.063,.068,[1,1,1.08]);
  ellipsoid(knee,mat.boot,[0,-.376,-.059],[.073,.056,.139]);
  ellipsoid(knee,mat.seam,[0,-.408,-.065],[.076,.022,.142]);
 }
 if(alive){
  const unit=panel(chest,mat.boot,[-.145,.323,-.104],[.068,.122,.034],[0,.21,-.08]);
  unit.name='Field radio';
  panel(chest,mat.status,[-.145,.334,-.126],[.032,.015,.005]);
  capsule(chest,mat.boot,[-.149,.425,-.098],.006,.114,[1,1,1],[0,0,-.12]);
  if(palette.role==='medic'){
   // Hard shell trauma bag and diagonal webbing.
   capsule(chest,mat.seam,[.13,.18,.14],.096,.18,[1,1,.72],[0,0,.13]);
   panel(chest,mat.patch,[.13,.19,.211],[.105,.061,.014]);
   panel(chest,mat.boot,[.045,.26,-.146],[.035,.35,.017],[0,0,-.52]);
   ellipsoid(head,mat.hair,[.051,.112,.116],[.052,.065,.050]);
   panel(chest,mat.patch,[.123,.321,-.119],[.081,.067,.013]);
   panel(chest,mat.seam,[.123,.321,-.129],[.043,.012,.004]);
   panel(chest,mat.seam,[.123,.321,-.130],[.012,.045,.004]);
  }else if(palette.role==='engineer'){
   // Bench goggles stowed on the cap and insulated tools on the belt.
   panel(head,mat.boot,[0,.174,-.097],[.167,.036,.021]);
   for(const side of [-1,1]){
    ellipsoid(head,mat.steel,[side*.042,.184,-.111],[.039,.026,.017]);
    ellipsoid(head,mat.lens,[side*.042,.184,-.125],[.031,.019,.009]);
   }
   capsule(hips,mat.boot,[-.18,.08,-.058],.027,.14,[1,1,1],[0,0,-.20]);
   capsule(hips,mat.steel,[-.164,.168,-.058],.013,.10);
   panel(chest,mat.ivory,[0,.192,-.146],[.285,.027,.015]);
  }else{
   // Noor's field headset, boom microphone and communications pack.
   for(const side of [-1,1]){
    ellipsoid(head,mat.boot,[side*.105,.119,.014],[.024,.049,.039]);
    ellipsoid(head,mat.seam,[side*.123,.119,.014],[.014,.036,.030]);
   }
   capsule(head,mat.steel,[.096,.091,-.055],.005,.10,[1,1,1],[Math.PI/2,0,-.10]);
   ellipsoid(head,mat.boot,[.094,.09,-.116],[.013,.011,.018]);
   panel(chest,mat.boot,[0,.229,.153],[.26,.28,.11]);
   capsule(chest,mat.steel,[.12,.435,.175],.008,.24,[1,1,1],[0,0,-.09]);
   ellipsoid(chest,mat.seam,[0,.414,-.025],[.111,.044,.110]);
  }
 }

 hips.scale.setScalar(palette.height);
 const rig={root,hips,chest,head,arms,elbows,thighs,knees,eyes,mat,scale:palette.height,alive};
 return rig;
}

function applyPose(rig,pose,time=0,look=0,reducedMotion=false){
 const breath=rig.alive&&!reducedMotion&&Math.abs(pose.lean)<1?.013*Math.sin(time*2.15):0;
 rig.hips.position.y=pose.hip*rig.scale;
 rig.hips.rotation.set(pose.lean,0,pose.roll,'XYZ');
 rig.chest.rotation.x=pose.chest+breath;
 rig.chest.scale.set(1+breath*.35,1+breath*.25,1+breath);
 rig.head.rotation.set(pose.head+breath*.48,look,-pose.roll*.14);
 const blink = (time + rig.scale*11) % 4.7;
 const lid = Math.abs(pose.lean)>1 ? .12 : blink<.16 ? .12+.88*Math.abs(blink-.08)/.08 : 1;
 for(const eye of rig.eyes)eye.scale.y=lid;
 rig.thighs[0].rotation.x=pose.thighL;rig.thighs[1].rotation.x=pose.thighR;
 rig.knees[0].rotation.x=pose.kneeL;rig.knees[1].rotation.x=pose.kneeR;
 rig.arms[0].rotation.set(pose.armL,0,pose.spreadL);
 rig.arms[1].rotation.set(pose.armR,0,pose.spreadR);
 rig.elbows[0].rotation.x=pose.elbowL;rig.elbows[1].rotation.x=pose.elbowR;
}

function batchRig(rig){
 const joints=[rig.hips,rig.chest,rig.head,...rig.arms,...rig.elbows,...rig.thighs,...rig.knees];
 for(const joint of joints){
  const batches=new Map();
  for(const mesh of joint.children){
   if(!mesh.isMesh)continue;
   if(!batches.has(mesh.material))batches.set(mesh.material,[]);
   batches.get(mesh.material).push(mesh);
  }
  for(const [material,meshes] of batches){
   if(meshes.length<2)continue;
   const parts=meshes.map(mesh=>{
    mesh.updateMatrix();
    return mesh.geometry.applyMatrix4(mesh.matrix);
   });
   const geometry=mergeGeometries(parts);
   joint.remove(...meshes);
   for(const part of parts)part.dispose();
   addShape(joint,geometry,material,[0,0,0]);
  }
 }
}

function batchStillBody(rig){
 rig.root.updateMatrixWorld(true);
 const all=new Map();
 rig.root.traverse(object=>{
  if(!object.isMesh)return;
  const geometry=object.geometry;
  geometry.applyMatrix4(object.matrixWorld);
  if(!all.has(object.material))all.set(object.material,[]);
  all.get(object.material).push(geometry);
 });
 rig.root.clear();
 for(const [material,parts] of all){
  const geometry=mergeGeometries(parts);
  for(const part of parts)part.dispose();
  addShape(rig.root,geometry,material,[0,0,0]);
 }
 rig.root.updateMatrixWorld(true);
 const low=new THREE.Box3().setFromObject(rig.root).min.y;
 for(const mesh of rig.root.children)mesh.position.y=.021-low;
}

function floorPose(rig,pose){
 applyPose(rig,pose,0,0,true);
 const height=new THREE.Box3().setFromObject(rig.root,true).min.y;
 return {...pose,hip:pose.hip+(rig.root.position.y+.012-height)/rig.scale};
}

const smooth=value=>value*value*(3-2*value);
function blend(left,right,amount){
 const pose={};
 for(const key of Object.keys(IDLE))pose[key]=THREE.MathUtils.lerp(left[key],right[key],amount);
 return pose;
}
function sample(keys,time){
 for(let i=1;i<keys.length;i++){
  const [until,goal]=keys[i];
  if(time<=until){
   const [from,initial]=keys[i-1];
   return blend(initial,goal,smooth(THREE.MathUtils.clamp((time-from)/(until-from),0,1)));
  }
 }
 return keys.at(-1)[1];
}

function clip(action,current){
 if(action==='injured')return [[0,current],[.36,INJURED]];
 if(action==='idle')return [[0,current],[.26,IDLE]];
 if(action==='rescued')return [[0,current],[.24,BRACE],[.70,RISE],[1.08,SETTLE],[1.43,IDLE]];
 if(action==='fallen'){
  const stagger={...current,hip:Math.max(.48,current.hip-.11),lean:current.lean+.24,roll:-.17,armL:.65,armR:.58,head:-.15};
  const impact={...FALLEN,hip:.27,lean:1.62,spreadL:-.65,spreadR:.71};
  return [[0,current],[.16,stagger],[.52,impact],[.77,FALLEN]];
 }
 const reach={...current,armR:1.48,elbowR:.29,spreadR:.17,head:-.08,chest:current.chest-.10};
 const anticipate={...current,armR:.22,elbowR:.85,chest:current.chest+.07};
 return [[0,current],[.16,anticipate],[.43,reach],[.78,reach],[1.17,current]];
}

/**
 * Lightweight articulated actors. Place each returned group at its world floor height.
 * Actor forward is -Z. Set a new pose only when the gameplay state changes.
 */
export function createBunkerActors(scene){
 const actors=CREW.map(palette=>{
  const rig=makeRig(palette,true);
  batchRig(rig);
  const standing=floorPose(rig,IDLE);
  applyPose(rig,standing);
  scene.add(rig.root);
  return {rig,action:'idle',pose:standing,keys:null,elapsed:0,look:0};
 });
 const stills=CASUALTIES.map((palette,index)=>{
  const rig=makeRig(palette,false);
  applyPose(rig,FALLS[index],0,0,true);
  batchStillBody(rig);
  scene.add(rig.root);
  return rig;
 });

 function pose(index,action){
  const actor=actors[index];
  if(!actor||actor.action===action||!['idle','injured','rescued','fallen','signal'].includes(action))return;
  actor.action=action;
  actor.elapsed=0;
  actor.keys=clip(action,actor.pose).map(([at,key],index)=>[at,index===0?key:floorPose(actor.rig,key)]);
  applyPose(actor.rig,actor.pose,0,actor.look,true);
 }

 function update(dt,time,{player,reducedMotion=false}={}){
  for(const [index,actor] of actors.entries()){
   if(actor.keys){
    const end=actor.keys.at(-1)[0];
    actor.elapsed=reducedMotion?end:Math.min(end,actor.elapsed+Math.max(0,Math.min(dt,.1)));
    actor.pose=sample(actor.keys,actor.elapsed);
    if(actor.elapsed>=end)actor.keys=null;
   }
   const {rig}=actor;
   if(!rig.root.visible)continue;
   let desired=0;
   if(player&&Number.isFinite(player.x)&&Number.isFinite(player.z)&&actor.action!=='fallen'){
    const dx=player.x-rig.root.position.x,dz=player.z-rig.root.position.z;
    if(Math.hypot(dx,dz)<7){
     const offset=Math.atan2(-dx,-dz)-rig.root.rotation.y;
     desired=THREE.MathUtils.clamp(Math.atan2(Math.sin(offset),Math.cos(offset)),-.48,.48);
    }
   }
   actor.look=THREE.MathUtils.lerp(actor.look,desired,1-Math.exp(-Math.max(0,dt)*7));
   applyPose(rig,actor.pose,time+index*.47,actor.look,reducedMotion);
  }
 }

 function dispose(){
  for(const rig of [...actors.map(actor=>actor.rig),...stills]){
   scene.remove(rig.root);
   rig.root.traverse(object=>{if(object.isMesh)object.geometry.dispose();});
   for(const material of Object.values(rig.mat))material.dispose();
  }
 }

 return {allies:actors.map(actor=>actor.rig.root),bodies:stills.map(rig=>rig.root),pose,update,dispose};
}

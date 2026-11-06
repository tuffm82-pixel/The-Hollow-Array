import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeWeatheredMaterial} from './atmosphere.js';

export const BUNKER_LEVELS=Object.freeze([
 {id:0,name:'Intake and Command',description:'Emergency triage, surface airlock and command bay',near:'EMERGENCY TRIAGE',far:'COMMAND / RATIONS'},
 {id:1,name:'Power and Water',description:'Generator hall and water filtration',near:'GENERATOR HALL',far:'WATER / FILTRATION'},
 {id:2,name:'Isolation and Deep Relay',description:'Containment ward, deep relay and evacuation',near:'ISOLATION WARD',far:'DEEP RELAY'},
]);
const WIDTH=22,DEPTH=26,ROOF=5.85,BULKHEAD=-2.4,PORTAL=4.5;
const barriers=[
 {x:-7.75,z:BULKHEAD,halfX:3.25,halfZ:.21},
 {x:7.75,z:BULKHEAD,halfX:3.25,halfZ:.21},
];
const deckObstacles=[
 [...[-9.8,9.8].flatMap(x=>[2.2,5,7.7].map(z=>({x,z,halfX:.74,halfZ:.84}))),{x:-7.8,z:12.43,halfX:2.64,halfZ:.68},{x:-8.53,z:7.5,halfX:.17,halfZ:.26},{x:9.6,z:-7.9,halfX:1.03,halfZ:3.25},{x:-9.4,z:-7.1,halfX:1.24,halfZ:3.75},{x:6,z:-7.14,halfX:.84,halfZ:.35}],
 [{x:8.75,z:5,halfX:1.34,halfZ:3.2},{x:-8.75,z:4.8,halfX:1.34,halfZ:3.2},{x:8.85,z:-7.6,halfX:1.23,halfZ:3.0},{x:-8.85,z:-7.6,halfX:1.23,halfZ:3.0},{x:6,z:-7.14,halfX:.84,halfZ:.35}],
 [{x:8.95,z:5.4,halfX:1.16,halfZ:3.02},{x:-8.95,z:5.4,halfX:1.16,halfZ:3.02},{x:-8.9,z:-7.4,halfX:1.46,halfZ:3.3},{x:8.9,z:-7.4,halfX:1.46,halfZ:3.3},{x:5,z:-8.14,halfX:.84,halfZ:.35},{x:1.4,z:-11.12,halfX:.65,halfZ:.34}],
];
const collisionByDeck=deckObstacles.map(boxes=>[...barriers,...boxes]);
const sightObstacles=[
 deckObstacles[0].filter(box=>box.z<0||box.z>11),
 deckObstacles[1].filter(box=>Math.abs(box.x)>8),
 deckObstacles[2].filter(box=>Math.abs(box.x)>8),
].map(boxes=>[...barriers,...boxes]);

export function walkableBunker(floor,x,z,r=.28){
 if(!BUNKER_LEVELS[floor]||![x,z,r].every(Number.isFinite)||r<0)return false;
 if(Math.abs(x)>WIDTH/2-r||Math.abs(z)>DEPTH/2-r)return false;
 return !collisionByDeck[floor].some(box=>
  Math.abs(x-box.x)<box.halfX+r&&Math.abs(z-box.z)<box.halfZ+r
 );
}

export function bunkerSight(floor,from,to){
 if(!BUNKER_LEVELS[floor])return false;
 for(const box of sightObstacles[floor]){
  let enter=0,exit=1;
  for(const [axis,half] of [['x','halfX'],['z','halfZ']]){
   const origin=from[axis],step=to[axis]-origin;
   const low=box[axis]-box[half],high=box[axis]+box[half];
   if(Math.abs(step)<1e-8){
    if(origin<low||origin>high){enter=2;break;}
   }else{
    const a=(low-origin)/step,b=(high-origin)/step;
    enter=Math.max(enter,Math.min(a,b));
    exit=Math.min(exit,Math.max(a,b));
   }
  }
  if(enter<=exit&&exit>0&&enter<1)return false;
 }
 return true;
}

const palette=[
 {base:0x8c999b,trim:0x366e6b,lit:0x9de0d6,warm:0xe7a16f,dark:0x193638},
 {base:0x8e8981,trim:0x866531,lit:0xf3bf78,warm:0xff8d60,dark:0x3b301f},
 {base:0x78848f,trim:0x455e82,lit:0xa5c6fd,warm:0xdf8880,dark:0x233043},
];
const paletteHex=color=>'#'+color.toString(16).padStart(6,'0');

function placard(title,detail,color){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=144;
 const g=canvas.getContext('2d');
 g.fillStyle='#10171c';g.fillRect(0,0,512,144);
 g.fillStyle=color;g.fillRect(0,0,12,144);
 g.strokeStyle='#526265';g.lineWidth=3;g.strokeRect(14,4,493,136);
 g.fillStyle='#f0ebe0';g.font='bold 33px monospace';g.fillText(title,31,60,455);
 g.fillStyle='#a9babb';g.font='20px monospace';g.fillText(detail,32,103,451);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}

function makeDeck(scene,floor,materials){
 const group=new THREE.Group();group.name='Bunker deck '+floor;
 group.position.y=-floor*7;scene.add(group);
 const parts=new Map(),textures=[];
 const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(),unit=new THREE.Vector3(1,1,1);
 function add(name,geometry,x,y,z,rx=0,ry=0,rz=0){
  position.set(x,y,z);rotation.setFromEuler(new THREE.Euler(rx,ry,rz));matrix.compose(position,rotation,unit);
  geometry.applyMatrix4(matrix);
  if(!parts.has(name))parts.set(name,[]);
  parts.get(name).push(geometry);
 }
 function box(name,x,y,z,w,h,d,rx=0,ry=0,rz=0){
  const geometry=new THREE.BoxGeometry(w,h,d);
  if(materials[name].map){
   const uv=geometry.attributes.uv;
   for(let i=0;i<uv.count;i++){
    const face=Math.floor(i/4),u=(face<2?d:w)/2,v=(face===2||face===3?d:h)/2;
    uv.setXY(i,uv.getX(i)*Math.max(.1,u),uv.getY(i)*Math.max(.1,v));
   }
  }
  add(name,geometry,x,y,z,rx,ry,rz);
 }
 const cylinder=(name,x,y,z,r,h,rx=0,ry=0,rz=0)=>add(name,new THREE.CylinderGeometry(r,r,h,12),x,y,z,rx,ry,rz);
 function sign(title,detail,x,y,z,ry,width=3){
  const texture=placard(title,detail,paletteHex(palette[floor].lit));textures.push(texture);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width*.28125),new THREE.MeshBasicMaterial({map:texture}));
  mesh.position.set(x,y,z);mesh.rotation.y=ry;group.add(mesh);
 }
 const shell=[
  [-11.12,ROOF/2,0,.25,ROOF,26.6],
  [11.12,ROOF/2,0,.25,ROOF,26.6],
  [0,ROOF/2,-13.13,22.5,ROOF,.26],
  [0,ROOF/2,13.13,22.5,ROOF,.26],
 ];
 box('concrete',0,-.15,0,22.5,.3,26.6);
 box('concrete',0,ROOF+.12,0,22.5,.24,26.6);
 for(const values of shell)box('concrete',...values);
 for(const barrier of barriers)box('concrete',barrier.x,ROOF/2,barrier.z,barrier.halfX*2,ROOF,.42);
 box('concrete',0,4.83,BULKHEAD,9,2.04,.42);
 for(const x of [-4.55,4.55]){
  box('steel',x,1.89,BULKHEAD,.18,3.78,.65);
  box('glow',x,2.92,BULKHEAD+.34,.11,1.25,.03);
  box('glow',x,2.92,BULKHEAD-.34,.11,1.25,.03);
 }
 box('steel',0,3.82,BULKHEAD,9.25,.16,.62);
 sign(BUNKER_LEVELS[floor].far,'LEVEL B'+(floor+1)+' / NORTH BAY',0,4.25,BULKHEAD+.23,0,3.8);
 sign(BUNKER_LEVELS[floor].near,'LEVEL B'+(floor+1)+' / SOUTH BAY',0,4.25,BULKHEAD-.23,Math.PI,3.8);

 // Wall guards and overhead services outline the width of the room.
 for(const side of [-1,1]){
  box('trim',side*10.94,1.06,0,.09,.32,25.9);
  box('dark',side*10.92,.21,0,.12,.35,25.9);
  for(const z of [-11,-7,-3,1,5,9,12]){
   box('steel',side*10.85,2.76,z,.28,5.5,.28);
   box('trim',side*10.68,1.16,z,.1,1.48,.32);
  }
  for(const x of [6.8,8.8]){
   cylinder(x===6.8?'trim':'steel',side*x,5.27,0,x===6.8?.12:.22,25.8,Math.PI/2);
   for(const z of [-11,-7,-3,1,5,9,12])cylinder('dark',side*x,5.27,z,x===6.8?.15:.25,.17,Math.PI/2);
  }
 }
 for(const z of [-11,-6,-.5,5,10.5]){
  box('steel',0,5.65,z,21.75,.22,.29);
  for(const x of [-3.2,3.2]){
   box('dark',x,5.38,z,2.14,.16,.42);
   box('glow',x,5.27,z,1.88,.026,.17);
  }
 }
 for(const x of [-3.7,3.7])box('stripe',x,.006,0,.067,.012,25.5);
 for(const z of [-10,-6,0,4,8])for(const x of [-3.92,3.92])box('stripe',x,.009,z,.48,.015,.057,0,x>0?-.6:.6);
 for(const z of [-11.7,11.7])for(let j=0;j<21;j++)box('dark',0,.008,z+j*.012-0.12,3.85,.014,.009);

 function elevator(x,z,front,up){
  const side=front?1:-1;
  box('steel',x,1.63,z,3.35,3.26,.46);
  box('dark',x,1.48,z+side*.255,2.65,2.96,.062);
  for(const half of [-1,1]){
   box('trim',x+half*.65,1.47,z+side*.293,1.28,2.9,.08);
   box('steel',x+half*1.3,1.52,z+side*.365,.13,3.04,.16);
  }
  box('warm',x+1.49,1.18,z+side*.324,.18,.29,.067);
  sign(up?'LIFT / ASCEND':'LIFT / DESCEND','LEVEL B'+(up?floor:floor+2),x,3.59,z+side*.28,front?0:Math.PI,2.28);
  for(let i=0;i<6;i++)box('stripe',x-1.38+i*.55,.01,z+side*.74,.29,.016,.55,0,-.54);
 }
 function station(x,z,title,detail,width=1.68){
  box('steel',x,.52,z,width,1.04,.7);
  box('dark',x,1.15,z,width-.07,.19,.72,-.29);
  box('glow',x-.26,1.26,z-.06,width*.48,.021,.29,-.29);
  for(const dx of [.28,.44,.60])box('warm',x+dx,1.244,z+.11,.08,.035,.09,-.29);
  box('steel',x,1.48,z-.27,.12,.56,.12);
  sign(title,detail,x,1.92,z-.20,0,2.15);
  box('stripe',x,.009,z+.45,width+.18,.018,.06);
 }
 if(floor===0)station(6,-7.14,'AUX POWER','START STANDBY BUS');
 if(floor===1)station(6,-7.14,'FILTRATION','PUMP ISOLATION BANK');
 if(floor===2){
  station(5,-8.14,'DEEP RELAY','SET EVACUATION LINK');
  station(1.4,-11.12,'POD CONTROL','VERIFY RELEASE',1.28);
 }
 if(floor<2)elevator(0,-12.65,true,false);
 if(floor>0)elevator(-8,12.65,false,true);
 if(floor===0){
  // Illuminated wall stations make the civilian triage bay distinct from engineering.
  for(const side of [-1,1]){
   const x=side*7.26;
   box('steel',x,2.54,BULKHEAD+.235,2.34,2.32,.095);
   box('trim',x,2.54,BULKHEAD+.289,2.12,2.1,.03);
   box('glow',x,2.54,BULKHEAD+.317,.34,1.27,.025);
   for(const dx of [-.39,.39])box('glow',x+dx,2.54,BULKHEAD+.317,.44,.34,.025);
   sign(side<0?'SURFACE LOCK':'MEDICAL TRIAGE',side<0?'SOUTH / NO RE-ENTRY':'INTAKE / SECTION 17',x,1.13,BULKHEAD+.28,0,2.4);
  }
  // The seal is part of the wall. There is no opening or walkable exterior.
  box('steel',-7.8,2.25,12.53,5.28,4.5,.59);
  box('dark',-7.8,2.05,12.17,4.58,4.02,.16);
  for(const x of [-9.48,-8.36,-7.24,-6.12])box('trim',x,2.04,12.04,1.04,3.91,.1);
  for(const y of [.62,3.28])box('steel',-7.8,y,11.89,4.4,.16,.20);
  cylinder('steel',-7.8,1.91,11.8,.44,.14,Math.PI/2);
  cylinder('warm',-7.8,1.91,11.72,.235,.022,Math.PI/2);
  sign('SURFACE SEALED','RADIATION LOCKOUT / DO NOT OPEN',-7.8,4.89,12.19,Math.PI,4.18);
  box('steel',-8.53,.62,7.5,.34,1.24,.52);
  box('warm',-8.33,1.12,7.5,.03,.16,.19);
  // Low contrast drag marks carry the eye from the sealed airlock to intake.
  for(let i=0;i<35;i++){
   const t=i/34,drift=Math.sin(i*2.39)*.26;
   box(i%4===0?'stainEdge':'stain',-7.65+t*7.5+drift,.003,11.14-t*6.17+drift,.10+(i%4)*.08,.005,.19+(i%5)*.067,0,.66+Math.sin(i*2)*.5);
  }
  for(const side of [-1,1])for(const z of [2.2,5.0,7.7]){
   const x=side*9.8;
   box('steel',x,.36,z,1.45,.11,1.65);
   box('fabric',x,.53,z,1.38,.23,1.61);
   box('cloth',x,.665,z+.48,1.19,.11,.47);
   for(const leg of [-.63,.63])box('dark',x,.15,z+leg,1.31,.3,.085);
  }
  for(let i=0;i<3;i++){
   const z=-4.8-i*2.8;
   box('steel',9.6,.48,z,2.04,.96,2.15);
   box('dark',9.45,1.14,z,1.34,.36,1.55,0,0,.18);
   for(const dz of [-.54,.03,.54])box('glow',9.04,1.18,z+dz,.035,.14,.35,0,0,.18);
   box('dark',-9.42,1.45,z,2.22,2.9,2.15);
   for(const y of [.54,1.24,1.94,2.62])box('steel',-9.31,y,z,2.44,.075,2.05);
   for(const y of [.77,1.46,2.12])for(const dz of [-.62,0,.62])box('trim',-8.85,y,z+dz,.83,.39,.52);
  }
  sign('TRIAGE 01','REPORT INJURIES TO THE WATCH',10.97,2.76,6.3,-Math.PI/2,3.6);
  sign('COMMAND BAY','CIVIL DEFENCE / SHELTER 17',10.98,2.98,-7.65,-Math.PI/2,3.8);
 }else if(floor===1){
  // The return manifold sits visibly above the walkway and feeds the filter bank.
  for(const side of [-1,1]){
   const x=side*7.29;
   cylinder('trim',x,2.85,BULKHEAD+.53,.28,4.9);
   for(const y of [.84,2.38,4.35])cylinder('dark',x,y,BULKHEAD+.53,.32,.17);
   cylinder('steel',x,3.03,BULKHEAD+.81,.58,.31,Math.PI/2);
   cylinder('warm',x,3.03,BULKHEAD+.988,.39,.068,Math.PI/2);
   sign(side<0?'RETURN':'SUPPLY','COOLANT MANIFOLD',x,1.47,BULKHEAD+.87,0,2.25);
  }
  cylinder('trim',0,4.97,BULKHEAD+.54,.28,14.58,0,0,Math.PI/2);
  for(const x of [-7.2,-5,-2.5,0,2.5,5,7.2])cylinder('dark',x,4.97,BULKHEAD+.54,.34,.17,0,0,Math.PI/2);
  for(const side of [-1,1]){
   const x=side*8.76;
   box('concrete',x,.18,4.85,2.64,.36,5.95);
   box('trim',x,1.06,4.85,2.32,1.57,5.56);
   cylinder('steel',x,1.96,4.85,.7,4.96,Math.PI/2);
   for(let z=2.3;z<7.8;z+=.56)box('dark',x,1.27,z,2.43,.64,.13);
   for(const dx of [-.54,0,.54])cylinder('warm',x+dx,2.04,7.7,.074,.09,Math.PI/2);
   for(const z of [-5.2,-8,-10.4]){
    cylinder('steel',x,1.44,z,1.02,2.87);
    cylinder('trim',x,2.82,z,.88,.22);
    cylinder('dark',x,3.3,z,.11,.8);
    box('stripe',x-side*.99,1.4,z,.045,.18,.86);
    cylinder('warm',x-side*.96,1.91,z,.15,.11,0,0,Math.PI/2);
   }
   cylinder('trim',x,3.74,-7.7,.16,7.05,Math.PI/2);
  }
  sign('PRIMARY GENERATION','CAUTION / LIVE ROTATING EQUIPMENT',10.97,3.12,5.1,-Math.PI/2,3.85);
  sign('FILTRATION BANK','WATER QUALITY CONTROL',10.97,3.5,-7.58,-Math.PI/2,3.7);
 }else{
  // Full-height bracing and paired observation panes frame the quarantine threshold.
  for(const side of [-1,1]){
   const x=side*7.55;
   box('steel',x,2.93,BULKHEAD+.235,4.58,5.62,.13);
   box('dark',x,2.59,BULKHEAD+.316,4.23,4.84,.08);
   box('glass',x,3.07,BULKHEAD+.378,3.2,1.68,.034);
   for(const dx of [-1.42,0,1.42])box('steel',x+dx,3.07,BULKHEAD+.421,.1,1.7,.05);
   for(const dx of [-1.73,1.73])box('trim',x+dx,2.87,BULKHEAD+.43,.28,5.08,.14);
   for(const dz of [-.95,.95])box('trim',x,3.07+dz,BULKHEAD+.42,3.65,.11,.14);
   sign('QUARANTINE','NO SURFACE EVACUATION',x,1.55,BULKHEAD+.39,0,2.45);
  }
  for(const side of [-1,1]){
   const x=side*8.96;
   for(const z of [2.93,5.6,8.25]){
    box('steel',x,.12,z,1.88,.24,1.9);
    box('trim',x,.49,z,1.81,.65,1.82);
    box('dark',x,1.68,z,1.58,1.73,1.57);
    box('glass',x-side*.81,1.72,z,.045,1.39,1.16);
    box('steel',x,2.71,z,1.84,.31,1.84);
    box('warm',x-side*.935,2.7,z,.046,.072,.57);
   }
   for(const z of [-10.15,-7.44,-4.73]){
    box('dark',side*8.9,1.58,z,2.69,3.16,1.87);
    for(let y=.32;y<2.8;y+=.28){
     box('steel',side*7.54,y,z,.08,.15,1.64);
     for(const dz of [-.59,-.26,.07,.4])box(y<1.1?'warm':'glow',side*7.485,y,z+dz,.03,.041,.081);
    }
   }
  }
  sign('ISOLATION WARD','KEEP ALL CHAMBERS SEALED',10.97,3.62,6.3,-Math.PI/2,4.15);
  box('steel',0,1.96,-12.59,4.86,3.92,.55);
  box('trim',0,1.64,-12.25,3.62,3.27,.25);
  for(const x of [-1.71,1.71])box('glow',x,1.64,-12.09,.087,3.1,.04);
  sign('EVACUATION POD','SUBSURFACE TRANSIT / SHELTER 18',0,4.38,-12.17,0,3.5);
 }
 for(const [name,geometries] of parts){
  const merged=mergeGeometries(geometries,false);
  geometries.forEach(geometry=>geometry.dispose());
  group.add(new THREE.Mesh(merged,materials[name]));
 }
 return {group,textures};
}

export function createBunkerWorld(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.AgXToneMapping;
 renderer.toneMappingExposure=1.27;
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x0a1016);
 scene.fog=new THREE.FogExp2(0x111e24,.032);
 const camera=new THREE.PerspectiveCamera(70,1,.055,65);
 camera.position.set(0,1.68,9);scene.add(camera);
 const hemisphere=new THREE.HemisphereLight(0xa6baca,0x273138,1.15);
 scene.add(hemisphere);
 const fill=new THREE.PointLight(0xd2e3eb,1.6,7,2);camera.add(fill);
 const torch=new THREE.SpotLight(0xe1e9ed,25,27,Math.PI/5,.7,2);
 torch.position.set(.12,-.18,.01);torch.target.position.set(0,-.10,-16);camera.add(torch,torch.target);
 const points=Array.from({length:4},()=>new THREE.PointLight(0xffffff,26,19,2));
 scene.add(...points);
 const allMaterials=new Set();
 const decks=BUNKER_LEVELS.map((level,floor)=>{
  const colors=palette[floor];
  const standard=(color,roughness=.82,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const luminous=(color,intensity=.72)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity});
  const concrete=makeWeatheredMaterial('concrete');concrete.color.setHex(colors.base);
  const steel=makeWeatheredMaterial('metal');steel.color.setHex(0x829396);steel.metalness=.45;
  const materials={concrete,steel,trim:standard(colors.trim,.63,.26),dark:standard(colors.dark,.88,.13),
   stripe:standard(0xb99a56),fabric:standard(0x485a59,.96),cloth:standard(0xa2b0a4,.93),
   glow:luminous(colors.lit),warm:luminous(colors.warm),glass:luminous(0x335765,.42),
   stain:standard(0x251a17,.93),stainEdge:standard(0x33231f,.95)};
  Object.values(materials).forEach(material=>allMaterials.add(material));
  return makeDeck(scene,floor,materials);
 });
 let active=-1;
 function resize(){
  const w=canvas.clientWidth||window.innerWidth,h=canvas.clientHeight||window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.45));
  renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();
 }
 function update(dt,time,player={},state={}){
  const floor=BUNKER_LEVELS[player.floor]?player.floor:0,colors=palette[floor],base=-floor*7;
  if(active!==floor){
   active=floor;
   decks.forEach(({group},index)=>{group.visible=index===floor;});
   for(const [index,light] of points.entries()){
    light.position.set(index%2===0?-4.4:4.4,base+4.36,index<2?5.3:-7.6);
    light.color.setHex(index===0?colors.warm:colors.lit);
   }
   scene.fog.color.setHex(colors.dark);
  }
  const damage=Math.max(0,Math.min(1,Number(state.blackout)||0));
  hemisphere.intensity=1.15-damage*.46;
  torch.intensity=player.hidden?3:25;
  for(const [index,light] of points.entries()){
   const hum=1+.045*Math.sin((time||0)*4.5+index*2);
   light.intensity=31*hum*(1-damage*.76);
  }
 }
 function dispose(){
  const geometries=new Set(),materials=new Set(allMaterials);
  for(const {group,textures} of decks){
   textures.forEach(texture=>texture.dispose());
   group.traverse(node=>{if(node.isMesh){geometries.add(node.geometry);materials.add(node.material);}});
  }
  geometries.forEach(geometry=>geometry.dispose());
  materials.forEach(material=>material.dispose());
  renderer.dispose();
 }
 resize();update(0,0);
 return {renderer,scene,camera,resize,update,dispose,render:()=>renderer.render(scene,camera),hasLineOfSight:bunkerSight};
}

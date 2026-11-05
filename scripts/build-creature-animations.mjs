// CC0 catalogue sources -> skinned, self-contained GLBs. No DCC installation.
// Run: node scripts/build-creature-animations.mjs [--fetch]
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const sources=[
 {id:'stalker',asset:32708,slug:'fps-survival-forest-outpost-creature-stalker-ec567238'},
 {id:'runner',asset:32707,slug:'fps-survival-forest-outpost-creature-infected-runner-d6e26047'},
 {id:'horror',asset:12009,slug:'undead-horde-and-infected-variants-multi-limbed-horror-7fdc819a'},
];
const out='assets/creatures',cache='test-results/catalogue-sources';
await mkdir(out,{recursive:true});await mkdir(cache,{recursive:true});
const manifest=[];
for(const source of sources){
 const path=`${cache}/${source.id}.glb`;
 if(process.argv.includes('--fetch')){const r=await fetch(`https://cdn.3dassets.dev/assets/${source.asset}/v1/model.glb`);if(!r.ok)throw Error(`${source.id}: HTTP ${r.status}`);await writeFile(path,Buffer.from(await r.arrayBuffer()));}
 const bytes=await readFile(path),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const root=gltf.scene;root.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(root),height=box.max.y,centerX=(box.min.x+box.max.x)/2;
 const bones=[],joints={},world={},parentMap={},segments=[];
 function bone(name,pos,parent){const b=new T.Bone();b.name=name;b.position.fromArray(pos);if(parent){joints[parent].add(b);b.position.sub(world[parent]);}joints[name]=b;world[name]=new T.Vector3(...pos);parentMap[name]=parent;bones.push(b);return b;}
 // Absolute rest pivots are derived from source nodes where available.
 const wp=name=>{const n=root.getObjectByName(name);return n?.getWorldPosition(new T.Vector3()).toArray();};
 const h=height,body=wp('body')||[centerX,h*.51,-.06];
 bone('root',[0,0,0]);bone('hips',body,'root');
 bone('spine',[body[0],body[1]+h*.17,body[2]+h*.06],'hips');
 bone('head',wp('head')||[centerX,h*.86,.02],'spine');
 for(const [side,sign]of [['L',-1],['R',1]]){
  const shoulder=wp(`arm-${side.toLowerCase()}`)||[centerX+sign*h*.12,h*.77,0];
  const elbow=wp(`fore-${side.toLowerCase()}`)||[centerX+sign*h*.18,h*.59,.24];
  const hand=wp(`gear-claw-${side.toLowerCase()}`)||[centerX+sign*h*.20,h*.44,.38];
  bone(`upperArm${side}`,shoulder,'spine');bone(`foreArm${side}`,elbow,`upperArm${side}`);bone(`hand${side}`,hand,`foreArm${side}`);
  bone(`thigh${side}`,[centerX+sign*h*.075,h*.49,body[2]],'hips');
  bone(`shin${side}`,[centerX+sign*h*.085,h*.255,body[2]+h*.035],`thigh${side}`);
  bone(`foot${side}`,[centerX+sign*h*.085,h*.045,body[2]+h*.025],`shin${side}`);
  segments.push([`thigh${side}`,`shin${side}`],[`shin${side}`,`foot${side}`],[`upperArm${side}`,`foreArm${side}`],[`foreArm${side}`,`hand${side}`]);
  if(source.id==='horror'){
   bone(`extraArm${side}`,[centerX+sign*h*.10,h*.59,-.02],'spine');
   bone(`extraFore${side}`,[centerX+sign*h*.16,h*.45,-.28],`extraArm${side}`);
   bone(`extraHand${side}`,[centerX+sign*h*.20,h*.32,-.52],`extraFore${side}`);
   segments.push([`extraArm${side}`,`extraFore${side}`],[`extraFore${side}`,`extraHand${side}`]);
  }
 }
 const rest=new Map(bones.map(b=>[b.name,b.position.clone()]));
 const skeleton=new T.Skeleton(bones);joints.root.updateMatrixWorld(true);skeleton.calculateInverses();
 const containers=new Map(),materials=[];
 function rigidAssignment(mesh){let n=mesh;while(n){const name=n.name;
  if(name==='head'||name.startsWith('gear-skull')||name.startsWith('gear-eyes')||name==='gear-hair')return'head';
  for(const s of ['l','r']){const side=s.toUpperCase();if(name===`fore-${s}`||name===`gear-cuff-${s}`||name===`gear-claw-${s}`)return`foreArm${side}`;if(name===`arm-${s}`)return`upperArm${side}`;}
  if(name==='body')return'spine';n=n.parent;}return null;}
 const p=new T.Vector3(),closest=new T.Vector3(),line=new T.Line3();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
  const original=geo.getAttribute('position'),norm=geo.getAttribute('normal');
  // Flatten source interleaved/quantized streams to portable float attributes.
  const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:original.count*3},(_,i)=>original.getComponent(Math.floor(i/3),i%3)),3));
  if(norm)clean.setAttribute('normal',new T.Float32BufferAttribute(Array.from({length:norm.count*3},(_,i)=>norm.getComponent(Math.floor(i/3),i%3)),3));else clean.computeVertexNormals();
  // Transform only after decoding normalized Int16 attributes. Writing world
  // positions back to the quantized source would wrap coordinates outside ±1.
  clean.applyMatrix4(mesh.matrixWorld);const pos=clean.getAttribute('position');
  const indices=[],weights=[],fixed=source.id==='horror'?null:rigidAssignment(mesh);
  for(let i=0;i<pos.count;i++){
   p.fromBufferAttribute(pos,i);let assignments;
   if(fixed)assignments=[[fixed,1]];
   else if(p.y>h*.79&&Math.abs(p.x-centerX)<h*.12)assignments=[['head',1]];
   else if(p.y<h*.52&&Math.abs(p.x-centerX)<h*.21){
    const side=p.x<centerX?'L':'R',knee=h*.255,ankle=h*.08;
    if(p.y<ankle)assignments=[[`foot${side}`,1]];
    else if(Math.abs(p.y-knee)<h*.055){const t=T.MathUtils.clamp((p.y-knee+h*.055)/(h*.11),0,1);assignments=[[`thigh${side}`,t],[`shin${side}`,1-t]];}
    else assignments=[[p.y>knee?`thigh${side}`:`shin${side}`,1]];
   }else{
    const candidates=segments.filter(([name])=>!name.startsWith('thigh')&&!name.startsWith('shin')).map(([a,b])=>{line.set(world[a],world[b]);line.closestPointToPoint(p,true,closest);return[a,p.distanceToSquared(closest)];});
    const torsoDistance=Math.abs(p.x-centerX);
    candidates.sort((a,b)=>a[1]-b[1]);
    assignments=torsoDistance<h*.10&&Math.abs(p.z-body[2])<h*.18?[['spine',1]]:[[candidates[0][0],1]];
   }
   for(let j=0;j<4;j++){indices.push(assignments[j]?bones.findIndex(b=>b.name===assignments[j][0]):0);weights.push(assignments[j]?.[1]||0);}
  }
  clean.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));clean.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;let m=materials.indexOf(material);if(m<0){m=materials.length;materials.push(material);}
  if(!containers.has(m))containers.set(m,[]);containers.get(m).push(clean);geo.dispose();
 });
 const scene=new T.Group();scene.name=`${source.id}_animated`;scene.add(joints.root);
 for(const [m,geos]of containers){const combined=mergeGeometries(geos,false),geometry=mergeVertices(combined,1e-5);combined.dispose();geos.forEach(g=>g.dispose());const mesh=new T.SkinnedMesh(geometry,materials[m]);mesh.name=`${source.id}_surface_${m}`;scene.add(mesh);mesh.bind(skeleton);mesh.frustumCulled=false;}
 // Pose blocking at 24 fps. Contact/down/passing/up, opposing shoulders,
 // knee recovery and head overlap are baked into standard glTF channels.
 function pose(action,t,duration){
  const rot={},move={};const set=(n,x=0,y=0,z=0)=>rot[n]=[x,y,z];
  const run=action==='run',walk=action==='walk',phase=t/(run?.64:1.12)*Math.PI*2;
  set('hips');set('spine');set('head');
  const personality=source.id==='runner'?1.14:source.id==='horror'?.76:1;
  if(run||walk){
   const amount=(run?.72:.38)*personality;
   set('hips',run?.13:.03,Math.sin(phase)*.07,Math.sin(phase)*.035);
   set('spine',run?.12:.03,-Math.sin(phase)*.12,0);set('head',-(run?.12:.03),Math.sin(phase-.45)*.035,0);
   move.hips=[0,(run?.045:.018)*(1-Math.cos(phase*2)),0];
   for(const [s,offset]of [['L',0],['R',Math.PI]]){const p=phase+offset,v=Math.sin(p);
    set(`thigh${s}`,v*amount,0,0);set(`shin${s}`,-Math.max(0,-Math.cos(p))*(run?1.18:.55),0,0);
    set(`foot${s}`,-v*amount*.35+Math.max(0,-Math.cos(p))*.3,0,0);
    set(`upperArm${s}`,-v*amount*.48-.12,0,(s==='L'?-1:1)*.08);set(`foreArm${s}`,-.22-Math.max(0,v)*.24);
    if(source.id==='horror'){set(`extraArm${s}`,Math.sin(p+.8)*.33,0,(s==='L'?-1:1)*.1);set(`extraFore${s}`,-.2-Math.max(0,v)*.3);}
   }
  }else if(action==='attack'){
   const u=t/duration,anticipation=Math.sin(Math.min(u/.3,1)*Math.PI/2),strike=T.MathUtils.smoothstep(u,.29,.48),recover=T.MathUtils.smoothstep(u,.57,1),a=anticipation*(1-strike),hit=strike*(1-recover);
   set('hips',-.13*a+.38*hit);set('spine',-.12*a+.30*hit,.17*a-.2*hit);set('head',.16*a-.18*hit);
   move.hips=[0,-.09*hit,.14*hit];
   for(const [s,sign]of [['L',-1],['R',1]]){set(`upperArm${s}`,-.65*a+.72*hit,sign*(.34*a-.2*hit),sign*.12);set(`foreArm${s}`,-.55*a+.23*hit);set(`thigh${s}`,-.12*hit);set(`shin${s}`,-.16*hit);if(source.id==='horror'){set(`extraArm${s}`,-.5*a+.65*hit,sign*.1);set(`extraFore${s}`,-.35*a);}}
  }else if(action==='stagger'){
   const envelope=Math.sin(Math.PI*t/duration),wobble=Math.sin(t*25)*(1-t/duration);set('hips',-.24*envelope,0,.07*wobble);set('spine',-.18*envelope,0,-.11*wobble);set('head',.2*envelope,.1*wobble);move.hips=[0,-.08*envelope,-.08*envelope];
  }else if(action==='death'){
   const u=t/duration,drop=T.MathUtils.smoothstep(u,.12,.85),curl=T.MathUtils.smoothstep(u,.03,.55);
   // The Cantor's extra arms spread forward and back, so its fall rolls
   // sideways. The other two collapse back from their leading foot.
   set('root',(source.id==='horror'?-.10:-1.48)*drop,0,(source.id==='horror'?1.48:.12)*drop);move.root=[0,0,0];move.hips=[0,-h*.08*drop,0];
   set('spine',.22*curl);set('head',-.28*curl);
   for(const [s,sign]of [['L',-1],['R',1]]){set(`thigh${s}`,.20*curl,0,sign*.14*curl);set(`shin${s}`,-.38*curl);set(`upperArm${s}`,.32*curl,0,sign*.22*curl);set(`foreArm${s}`,-.25*curl);if(source.id==='horror'){set(`extraArm${s}`,.35*curl,0,sign*.2*curl);set(`extraFore${s}`,-.4*curl);}}
  }else{
   const breathe=Math.sin(t/3.6*Math.PI*2);set('spine',breathe*.018);set('head',breathe*-.025,Math.sin(t/3.6*Math.PI*2)*.04);move.hips=[0,breathe*.008,0];
   for(const s of ['L','R']){set(`upperArm${s}`,breathe*.025);set(`foreArm${s}`,-.06+breathe*.025);}
  }
  return{rot,move};
 }
 const specs={idle:3.6,walk:1.12,run:.64,attack:1.25,stagger:.65,death:2.1},clips=[];
 for(const [name,duration]of Object.entries(specs)){
  const frames=Math.ceil(duration*24),times=Array.from({length:frames+1},(_,i)=>i/frames*duration),tracks=[],poses=times.map(t=>pose(name,t,duration));
  // Bake ground contact from the deformed mesh. A run has a short flight
  // phase; all other clips keep the lowest visible point above the floor.
  const foot=new T.Vector3(),euler=new T.Euler(),boundMeshes=scene.children.filter(n=>n.isSkinnedMesh);
  for(const [frame,p]of poses.entries()){
   for(const b of bones){b.quaternion.setFromEuler(euler.set(...(p.rot[b.name]||[0,0,0])));b.position.copy(rest.get(b.name)).add(foot.fromArray(p.move[b.name]||[0,0,0]));}
   scene.updateMatrixWorld(true);let minY=Infinity;
   for(const m of boundMeshes)for(let i=0;i<m.geometry.attributes.position.count;i++)minY=Math.min(minY,m.getVertexPosition(i,foot).y);
   const flight=name==='run'?Math.max(0,Math.sin(frame/frames*Math.PI*4)*.034):0;
   p.move.root=[0,flight-minY+.003,0];
  }
  for(const b of bones){const rotations=[],positions=[];let moved=false;for(const p of poses){const e=p.rot[b.name]||[0,0,0],q=new T.Quaternion().setFromEuler(new T.Euler(...e));rotations.push(...q.toArray());const d=p.move[b.name]||[0,0,0];moved||=d.some(v=>v!==0);positions.push(rest.get(b.name).x+d[0],rest.get(b.name).y+d[1],rest.get(b.name).z+d[2]);}tracks.push(new T.QuaternionKeyframeTrack(`${b.name}.quaternion`,times,rotations));if(moved)tracks.push(new T.VectorKeyframeTrack(`${b.name}.position`,times,positions));}
  clips.push(new T.AnimationClip(name,duration,tracks));
 }
 for(const b of bones){b.quaternion.identity();b.position.copy(rest.get(b.name));}scene.updateMatrixWorld(true);
 scene.userData={source:`https://3dassets.dev/assets/${source.slug}`,license:'CC0-1.0',animationAuthor:'The Hollow Array project',animationFPS:24,inPlace:true};
 const data=await new GLTFExporter().parseAsync(scene,{binary:true,animations:clips,onlyVisible:false});await writeFile(`${out}/${source.id}.glb`,Buffer.from(data));
 const entry={id:source.id,source:scene.userData.source,sourceGLB:`https://cdn.3dassets.dev/assets/${source.asset}/v1/model.glb`,license:'CC0-1.0',sourceSHA256:createHash('sha256').update(bytes).digest('hex'),bytes:data.byteLength,triangles:[...containers.values()].flat().reduce((n,g)=>n+(g.getAttribute('position')?.count||0)/3,0),bones:bones.length,materials:materials.length,clips:specs};manifest.push(entry);console.log(JSON.stringify(entry));
}
await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');

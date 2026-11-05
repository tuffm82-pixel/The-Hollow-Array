import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const MONSTER_TYPES=Object.freeze({
 graft:Object.freeze({name:'Graft Hound',height:1.4,weakpointHeight:.9,weakness:'Arc Spool',description:'A blind, low-slung specimen that follows impacts and footfalls.'}),
 widow:Object.freeze({name:'Lumen Widow',height:2.6,weakpointHeight:1.6,weakness:'Cryo Lantern, then Arc Spool',description:'A six-legged conservatory organism. Cold exposes its amber heart.'}),
 cantor:Object.freeze({name:'The Null Cantor',height:3.2,weakpointHeight:2,weakness:'Resonance Fork, then Arc Spool',description:'A faceless weather observer whose chest opens only during resonance.'}),
});

// Authored surface geometry, in metres. Smooth ring surfaces span each limb
// section; articulated parts overlap at narrow joints rather than joint balls.
export function createMonster(requested='graft'){
 const type=MONSTER_TYPES[requested]?requested:'graft',info=MONSTER_TYPES[type];
 const group=new THREE.Group();group.name=info.name;group.userData.type=type;
 const stance=new THREE.Group();group.add(stance);
 const geometryPool=new Set(),materialPool=new Set(),rig=[],maps=surfaceMaps(type);
 const palette=type==='graft'?{skin:0x79756a,bone:0xb5ad92,rust:0x715143}:type==='widow'?{skin:0x66674d,bone:0xc6b996,rust:0x504a32}:{skin:0x747d78,bone:0xc2c5af,rust:0x484b4d};
 const materials={
  hide:new THREE.MeshPhysicalMaterial({color:palette.skin,map:maps.color,bumpMap:maps.bump,bumpScale:.018,roughnessMap:maps.rough,roughness:.83,metalness:.015,clearcoat:.19,clearcoatRoughness:.45}),
  tendon:new THREE.MeshStandardMaterial({color:type==='widow'?0x424d32:0x504c43,map:maps.color,bumpMap:maps.bump,bumpScale:.012,roughness:.62}),
  bone:new THREE.MeshStandardMaterial({color:palette.bone,bumpMap:maps.bump,bumpScale:.009,roughness:.63}),
  metal:new THREE.MeshStandardMaterial({color:palette.rust,map:maps.color,bumpMap:maps.bump,bumpScale:.014,roughness:.58,metalness:.73}),
  dark:new THREE.MeshStandardMaterial({color:0x040605,roughness:.98}),
  membrane:new THREE.MeshPhysicalMaterial({color:type==='widow'?0x98a079:0x5a6359,map:maps.color,roughness:.7,side:THREE.DoubleSide,transparent:true,opacity:.76}),
  weak:new THREE.MeshStandardMaterial({color:type==='widow'?0xffb46a:type==='cantor'?0x85d2ec:0xcb8457,emissive:type==='widow'?0xe96813:type==='cantor'?0x268ba9:0x702e0c,emissiveIntensity:.65,roughness:.29,metalness:.2}),
  eye:new THREE.MeshStandardMaterial({color:0xd4c8a4,emissive:0x393020,emissiveIntensity:.2,roughness:.16}),
 };
 Object.values(materials).forEach(m=>materialPool.add(m));
 function part(parent,name,position=[0,0,0]){const node=new THREE.Group();node.name=name;node.position.set(...position);parent.add(node);const pending=new Map();return{node,
  add(geometry,material='hide',position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));geometry.applyMatrix4(matrix);if(!pending.has(material))pending.set(material,[]);pending.get(material).push(geometry);},
  done(){for(const [name,geometries]of pending){const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometryPool.add(geometry);const mesh=new THREE.Mesh(geometry,materials[name]);mesh.castShadow=mesh.receiveShadow=true;node.add(mesh);}pending.clear();return node;}};}
 function loft(p,points,radii,material='hide',segments=14,steps=24,twist=0){p.add(tube(points,radii,segments,steps,twist),material);}
 function ellipsoid(p,pos,scale,material='bone',width=14,height=9){p.add(new THREE.SphereGeometry(1,width,height),material,pos,scale);}
 function cable(p,points,radius,material='tendon',steps=22){loft(p,points,points.map((_,i)=>[radius*(1-i/points.length*.45),radius*(1-i/points.length*.45)]),material,7,steps);}
 function spikes(p,start,end,count,radius=.015,length=.09){for(let i=0;i<count;i++){const t=count===1?.5:i/(count-1),pos=start.map((v,a)=>v+(end[a]-v)*t);p.add(new THREE.ConeGeometry(radius,length*(.73+(i%3)*.17),7),'bone',pos,[1,1,1],[Math.PI,0,(i%2?1:-1)*.15]);}}
 function weakpoint(parent,pos,scale){const geometry=new THREE.SphereGeometry(1,18,12);geometryPool.add(geometry);const mesh=new THREE.Mesh(geometry,materials.weak);mesh.position.set(...pos);mesh.scale.set(...scale);mesh.name='exposed sensory node';mesh.userData.weakpoint=true;parent.add(mesh);return mesh;}
 let torso,head,jaw,weak,tail;
 if(type==='graft'){
  const body=part(stance,'contracted rib cage',[0,.83,.2]);
  loft(body,[[0,.03,.91],[0,.10,.56],[-.025,.09,.12],[.025,.12,-.29],[0,.05,-.62]],[[.12,.12],[.28,.29],[.32,.34],[.25,.29],[.14,.16]],'hide',20,38,.7);
  for(let i=0;i<8;i++){const z=.64-i*.135,w=.25+Math.sin(i/7*Math.PI)*.075;cable(body,[[-w,-.07,z],[-w*.94,.18,z-.025],[0,.34,z-.05],[w*.88,.17,z-.025],[w,-.09,z]],.014,'tendon',22);}
  for(const side of [-1,1]){cable(body,[[side*.09,.2,.65],[side*.26,.18,.2],[side*.22,-.1,-.34]],.025);for(let i=0;i<5;i++)ellipsoid(body,[side*.29,.08-i*.01,.53-i*.17],[.018,.024,.028],'bone',8,5);}
  body.add(new THREE.BoxGeometry(.24,.08,.30),'metal',[0,.34,.08],[1,1,1],[0,0,.12]);
  cable(body,[[.29,.15,.28],[.34,.19,.10],[.31,.17,-.15]],.024,'metal',17);
  torso=body.done();weak=weakpoint(torso,[.31,.16,-.15],[.065,.085,.095]);
  const skull=part(torso,'elongated split skull',[0,.12,-.70]);
  loft(skull,[[0,.04,.12],[0,.11,-.10],[0,.02,-.36],[.018,-.02,-.69]],[[.19,.18],[.21,.23],[.14,.13],[.12,.045]],'hide',18,28,.4);
  loft(skull,[[0,.08,-.08],[0,.02,-.34],[0,.015,-.66]],[[.165,.12],[.12,.085],[.10,.026]],'bone',16,21);
  ellipsoid(skull,[0,-.075,-.43],[.13,.12,.28],'dark');
  for(const side of [-1,1]){ellipsoid(skull,[side*.15,.10,-.16],[.045,.047,.053],'dark');ellipsoid(skull,[side*.155,.106,-.19],[.014,.007,.008],'eye',10,6);spikes(skull,[side*.11,-.055,-.22],[side*.095,-.075,-.65],8,.011,.085);cable(skull,[[side*.15,.16,-.10],[side*.18,.14,-.28],[side*.13,.055,-.54]],.017,'tendon',20);}
  head=skull.done();const lower=part(head,'lower jaw',[0,-.09,-.1]);
  loft(lower,[[-.12,0,-.04],[-.13,-.10,-.28],[0,-.12,-.60],[.13,-.10,-.28],[.12,0,-.04]],[[.04,.04],[.035,.036],[.055,.025],[.035,.036],[.04,.04]],'hide',10,32);
  for(const side of [-1,1])for(let i=0;i<7;i++)lower.add(new THREE.ConeGeometry(.010,.07+(i%2)*.018,6),'bone',[side*(.11-i*.006),-.06,-.15-i*.063]);jaw=lower.done();
  for(const z of [-.32,.66])for(const side of [-1,1]){
   const front=z<0,upper=part(torso,`${front?'front':'rear'} ${side} shoulder`,[side*.23,-.03,z]);
   loft(upper,[[0,.08,0],[side*.10,-.16,front?-.07:.06],[side*.14,-.43,front?.07:-.16]],[[.11,.12],[.075,.08],[.045,.05]],'hide',14,24,.6);cable(upper,[[side*.07,.02,.03],[side*.13,-.21,.07],[side*.14,-.42,front?.10:-.13]],.014);upper.done();
   const shin=part(upper.node,'lean lower leg',[side*.14,-.43,front?.07:-.16]);
   loft(shin,[[0,0,0],[-side*.02,-.22,front?-.10:.12],[-side*.025,-.33,-.12]],[[.05,.055],[.027,.034],[.052,.075]],'hide',12,20);
   for(let f=0;f<3;f++)loft(shin,[[(f-1)*.032,-.30,-.12],[(f-1)*.037,-.33,-.20],[(f-1)*.04,-.32,-.25]],[[.018,.016],[.010,.009],[.001,.001]],'bone',7,10);
   shin.done();rig.push({upper:upper.node,lower:shin.node,side,front});
  }
  const appendage=part(torso,'vertebral tail',[0,.04,.86]);loft(appendage,[[0,0,0],[.10,-.04,.3],[.19,-.10,.62],[.11,-.23,.94]],[[.10,.11],[.075,.07],[.035,.035],[.002,.002]],'hide',12,26,.5);for(let i=0;i<6;i++)ellipsoid(appendage,[.09+i*.017,-.02-i*.022,.16+i*.11],[.025,.026,.04],'bone',8,5);tail=appendage.done();
 }else if(type==='widow'){
  const body=part(stance,'suspended thorax',[0,1.57,.18]);
  loft(body,[[0,.03,.57],[0,.06,.30],[0,.13,-.05],[0,.27,-.36],[0,.56,-.48]],[[.22,.22],[.36,.38],[.24,.30],[.15,.21],[.09,.12]],'hide',22,38,.7);
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;cable(body,[[Math.cos(a)*.20,.01,.53],[Math.cos(a)*.37,Math.sin(a)*.28,.24],[Math.cos(a)*.17,.23,-.19],[Math.cos(a)*.06,.51,-.43]],.022,'tendon',24);}
  for(const side of [-1,1])for(let i=0;i<4;i++)loft(body,[[side*.15,.10,.28-i*.15],[side*.38,.18+i*.045,.25-i*.15],[side*.43,.28+i*.045,.30-i*.15]],[[.04,.05],[.024,.03],[.001,.001]],'bone',9,16);
  torso=body.done();weak=weakpoint(torso,[0,.03,-.28],[.14,.12,.09]);
  const hood=part(torso,'folded petal carapace',[0,.47,-.42]);
  for(const side of [-1,1])loft(hood,[[0,.36,.10],[side*.18,.28,-.04],[side*.27,.04,-.15],[side*.21,-.26,-.20],[side*.08,-.35,-.25]],[[.04,.05],[.07,.06],[.06,.05],[.025,.03],[.002,.002]],'bone',12,27);
  ellipsoid(hood,[0,-.06,-.11],[.135,.24,.055],'dark');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;loft(hood,[[Math.cos(a)*.10,-.07+Math.sin(a)*.17,-.15],[Math.cos(a)*.065,-.07+Math.sin(a)*.10,-.22],[Math.cos(a)*.025,-.07+Math.sin(a)*.04,-.23]],[[.013,.017],[.008,.012],[.001,.001]],'bone',6,10);}
  for(const side of [-1,1]){ellipsoid(hood,[side*.10,.12,-.16],[.028,.009,.008],'eye',10,6);const membrane=new THREE.PlaneGeometry(.30,.52,3,5);const p=membrane.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getY(i)*7)*.07);membrane.computeVertexNormals();hood.add(membrane,'membrane',[side*.14,.03,.035],[1,1,1],[0,side*.5,side*.12]);}
  head=hood.done();jaw=new THREE.Group();head.add(jaw);
  for(let n=0;n<3;n++)for(const side of [-1,1]){
   const z=.42-n*.35,upper=part(torso,`mantis coxa ${n} ${side}`,[side*.19,.01,z]);
   loft(upper,[[0,0,0],[side*.38,.28,.08],[side*.71,.16,n===0?.20:-.12]],[[.085,.08],[.075,.06],[.035,.035]],'hide',12,24,.8);cable(upper,[[side*.03,.02,.02],[side*.38,.32,.08],[side*.71,.18,n===0?.20:-.12]],.017,'bone');upper.done();
   const lower=part(upper.node,'pointed tibia',[side*.71,.16,n===0?.20:-.12]);
   loft(lower,[[0,0,0],[side*.16,-.62,.05],[-side*.02,-1.25,n===2?-.18:.14],[-side*.15,-1.69,.16]],[[.05,.05],[.038,.033],[.024,.023],[.002,.002]],'hide',12,30,.4);
   for(let t=0;t<5;t++)loft(lower,[[side*.07,-.17-t*.23,.07],[side*.17,-.25-t*.23,.10],[side*.20,-.32-t*.23,.07]],[[.014,.015],[.01,.01],[.001,.001]],'bone',6,8);lower.done();rig.push({upper:upper.node,lower:lower.node,side,front:n});
  }
  const lure=part(head,'forked stamen');for(const side of [-1,1])cable(lure,[[side*.08,.29,.03],[side*.18,.49,.05],[side*.23,.55,-.03]],.009,'tendon',17);lure.done();
 }else{
  const body=part(stance,'starved torso',[0,1.72,.05]);
  loft(body,[[0,-.40,.04],[0,-.21,.03],[0,.03,.02],[0,.35,.03],[0,.57,.01],[0,.72,-.04]],[[.16,.12],[.14,.12],[.18,.13],[.27,.14],[.24,.13],[.07,.08]],'hide',22,38,.6);
  for(const side of [-1,1]){for(let i=0;i<7;i++){const y=-.02+i*.065,w=.18+i*.012;cable(body,[[side*.035,y,-.14],[side*w*.8,y+.018,-.13],[side*w,y-.035,-.03]],.013,'bone',14);}cable(body,[[side*.08,-.32,-.1],[side*.14,.11,-.15],[side*.20,.43,-.13],[side*.06,.68,-.05]],.017);}
  ellipsoid(body,[0,.30,-.125],[.105,.19,.026],'dark');
  // A torn instrument harness anchors the creature to the observatory setting.
  for(const side of [-1,1])loft(body,[[side*.18,.57,.04],[side*.22,.25,.02],[side*.17,-.13,-.01],[side*.12,-.34,-.10]],[[.028,.017],[.025,.014],[.027,.014],[.02,.012]],'metal',8,22);
  body.add(new THREE.BoxGeometry(.12,.07,.04),'metal',[.10,.02,-.14],[1,1,1],[0,0,.22]);torso=body.done();weak=weakpoint(torso,[0,.28,-.17],[.07,.105,.025]);
  const skull=part(torso,'sealed listening head',[0,.81,-.04]);
  loft(skull,[[0,-.12,0],[0,.06,.02],[0,.28,.03],[.02,.49,.07],[.025,.58,.10]],[[.07,.07],[.12,.11],[.16,.12],[.12,.10],[.002,.002]],'hide',20,32,.6);
  ellipsoid(skull,[0,.23,-.083],[.027,.22,.025],'dark');
  for(const side of [-1,1]){cable(skull,[[side*.055,.48,-.02],[side*.065,.26,-.10],[side*.047,.06,-.08]],.014,'bone',22);for(let i=0;i<7;i++)loft(skull,[[side*.023,.075+i*.041,-.10],[side*.005,.081+i*.041,-.12]],[[.007,.009],[.001,.001]],'bone',6,6);}
  head=skull.done();jaw=new THREE.Group();head.add(jaw);
  for(const side of [-1,1]){
   const upper=part(torso,'hanging upper arm',[side*.24,.50,0]);
   loft(upper,[[0,0,0],[side*.10,-.26,.01],[side*.12,-.62,.02]],[[.095,.085],[.065,.06],[.037,.038]],'hide',14,24,.4);cable(upper,[[side*.03,.02,-.07],[side*.11,-.30,-.04],[side*.12,-.61,-.015]],.014);upper.done();
   const lower=part(upper.node,'elongated forearm',[side*.12,-.62,.02]);
   loft(lower,[[0,0,0],[side*.025,-.35,-.03],[-side*.015,-.72,-.05],[-side*.02,-.87,-.07]],[[.04,.045],[.045,.035],[.028,.023],[.055,.022]],'hide',12,28);
   for(let f=0;f<4;f++){const x=(f-1.5)*.031;loft(lower,[[x,-.84,-.07],[x+side*.015,-1.04,-.1],[x+side*.025,-1.13,-.19]],[[.012,.013],[.009,.009],[.001,.001]],'hide',7,13);}lower.done();rig.push({upper:upper.node,lower:lower.node,side,arm:true});
   const thigh=part(torso,'drawn thigh',[side*.12,-.34,.02]);
   loft(thigh,[[0,0,0],[side*.025,-.32,.01],[side*.025,-.65,-.045]],[[.10,.10],[.07,.065],[.04,.045]],'hide',14,24,.4);thigh.done();
   const shin=part(thigh.node,'extended shank',[side*.025,-.65,-.045]);
   loft(shin,[[0,0,0],[-side*.01,-.32,.035],[-side*.025,-.65,.07],[-side*.025,-.70,-.07]],[[.043,.049],[.036,.036],[.028,.027],[.075,.10]],'hide',12,24);for(let f=0;f<3;f++)loft(shin,[[(f-1)*.04,-.69,-.1],[(f-1)*.043,-.70,-.22]],[[.014,.016],[.001,.001]],'bone',6,7);shin.done();rig.push({upper:thigh.node,lower:shin.node,side,arm:false});
  }
 }
 let gait=0;
 const bases={torsoY:torso.position.y,head:head.rotation.clone()};
 function update(dt,time,{speed=0,attack=0,stun=0,death=0,vulnerable=false}={}){
  dt=Number.isFinite(dt)?THREE.MathUtils.clamp(dt,0,.1):0;time=Number.isFinite(time)?time:0;
  const a=THREE.MathUtils.clamp(Number(attack)||0,0,1),s=THREE.MathUtils.clamp(Number(stun)||0,0,1),d=THREE.MathUtils.clamp(Number(death)||0,0,1),stride=Math.min(4,Math.abs(Number(speed)||0));
  gait+=dt*(stride>.1?3+stride*1.7:.55);
  const reach=Math.sin(THREE.MathUtils.clamp((a-.12)/.65,0,1)*Math.PI),collapse=d*d;
  stance.rotation.z=(type==='widow'?-.9:.85)*collapse;stance.position.y=(type==='graft'?.04:type==='cantor'?.075:-.035)-collapse*(type==='graft'?.45:1.1);stance.scale.y=1-collapse*.20;
  torso.position.y=bases.torsoY+Math.sin(gait*2)*.019*Math.min(stride,1)+Math.sin(time*1.2)*.008-reach*.08;
  torso.rotation.set(type==='graft'?-reach*.16:-reach*.22,Math.sin(time*.37)*.025,s*Math.sin(time*49)*.035);
  head.rotation.set(bases.head.x+Math.sin(time*.74)*.035-reach*.20,Math.sin(time*.28)*.12+s*Math.sin(time*37)*.06,Math.sin(time*.61)*.03);
  jaw.rotation.x=type==='graft'?.07+reach*.72+s*.14:reach*.12;
  for(const limb of rig){const phase=gait+(limb.side===1?Math.PI:0)+(Number(limb.front)||0)*1.2,wave=Math.sin(phase)*Math.min(1,stride);
   if(type==='widow'){limb.upper.rotation.set(wave*.15,-wave*.12,limb.side*(reach*.16+Math.max(0,wave)*.10));limb.lower.rotation.x=Math.max(0,-wave)*.24+reach*.10;}
   else if(type==='graft'){limb.upper.rotation.x=wave*.45-reach*(limb.front?.35:-.10);limb.lower.rotation.x=Math.max(0,-wave)*.48;}
   else{limb.upper.rotation.x=wave*(limb.arm?-.15:.32)-reach*(limb.arm?.95:.12);limb.upper.rotation.z=limb.side*(limb.arm?reach*.12:.02);limb.lower.rotation.x=limb.arm?-.08-reach*.25:Math.max(0,-wave)*.38;}
  }
  if(tail){tail.rotation.y=Math.sin(time*1.7)*.18;tail.rotation.x=reach*.2;}
  materials.weak.emissiveIntensity=(vulnerable?2.3:.45)+Math.sin(time*3.2)*.10;weak.visible=d<.98;
  for(const material of materialPool){if(material===materials.membrane)material.opacity=.76*(1-Math.max(0,(d-.72)/.28));else{material.transparent=d>.72;material.opacity=1-Math.max(0,(d-.72)/.28);material.depthWrite=d<.9;}}
 }
 update(0,0);
 return{group,update,dispose(){geometryPool.forEach(g=>g.dispose());materialPool.forEach(m=>m.dispose());Object.values(maps).forEach(t=>t.dispose());}};
}

function tube(points,radii,segments,steps,twist=0){
 const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.25),frames=path.computeFrenetFrames(steps,false),positions=[],uvs=[],indices=[];
 for(let j=0;j<=steps;j++){const t=j/steps,p=path.getPointAt(t),q=t*(radii.length-1),lo=Math.floor(q),hi=Math.min(radii.length-1,lo+1),f=q-lo,rx=THREE.MathUtils.lerp(radii[lo][0],radii[hi][0],f),ry=THREE.MathUtils.lerp(radii[lo][1],radii[hi][1],f);
  for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2+twist*t,fold=1+Math.sin(a*5+t*23)*.028+Math.cos(a*3-t*13)*.019;const v=p.clone().addScaledVector(frames.normals[j],Math.cos(a)*rx*fold).addScaledVector(frames.binormals[j],Math.sin(a)*ry*fold);positions.push(v.x,v.y,v.z);uvs.push(i/segments,t);}
 }
 for(let j=0;j<steps;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function surfaceMaps(type){
 const size=256,color=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);let seed=type==='graft'?719:type==='widow'?319:991;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=(seed>>>24)/255,u=x/size,v=y/size,vein=Math.pow(Math.max(0,Math.cos(u*58+Math.sin(v*29)*1.8)),20),grain=Math.sin(v*245+Math.sin(u*13)*3),broad=Math.sin(u*19+v*6)*Math.cos(v*24),tone=.78+broad*.065+(n-.5)*.12-vein*.11;const i=(y*size+x)*4;
  color.set([Math.round(255*tone),Math.round(255*tone*(1-vein*.09)),Math.round(255*tone*(1-vein*.12)),255],i);const h=Math.round(128+(n-.5)*61+grain*6-vein*29);height.set([h,h,h,255],i);const r=Math.round(190+(n-.5)*35+vein*16);rough.set([r,r,r,255],i);
 }
 function texture(bytes,srgb=false){const t=new THREE.DataTexture(bytes,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t;}
 return{color:texture(color,true),bump:texture(height),rough:texture(rough)};
}

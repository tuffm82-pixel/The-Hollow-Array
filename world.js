import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ZONES,STATIONS,HIDE_SPOTS} from './layout.js';
import {createAtmosphere,makeWeatheredMaterial} from './atmosphere.js';

const bounds={minX:-46,maxX:48,minZ:-84,maxZ:9};
export const SOLID_PROPS=Object.freeze([
 {x:4,z:4,halfX:1.7,halfZ:.65},{x:-5.6,z:3,halfX:.9,halfZ:1.65},{x:-5.6,z:-3.8,halfX:.9,halfZ:1.65},
 {x:6.5,z:-5.4,halfX:.7,halfZ:1.75,height:3.2},
 {x:-41,z:-5.5,halfX:1.8,halfZ:1.5},{x:-44,z:5.8,halfX:.7,halfZ:1.4},
 ...[39,44].flatMap(x=>[-5.6,5.6].map(z=>({x,z,halfX:1.2,halfZ:.7}))),
 ...[-17.6,-12,-6.4].flatMap(x=>[-26.5,-15.5].map(z=>({x,z,halfX:1.5,halfZ:.5}))),
 ...[7,16.5].map(x=>({x,z:-38.9,halfX:2,halfZ:.65})),
 ...[-20,-11].flatMap(x=>[-53.6,-44.4].map(z=>({x,z,halfX:2.7,halfZ:.7}))),
 {x:5,z:-75.5,halfX:1.75,halfZ:1.75},
 ...HIDE_SPOTS.map(p=>({x:p.x,z:p.z,halfX:Math.abs(p.x)>8?.3:.4,halfZ:Math.abs(p.x)>8?.4:.3,height:2.4})),
 ...STATIONS.filter(s=>!['hound','widow','cantor'].includes(s.id)).map(s=>({x:s.position.x,z:s.position.z-.8,halfX:.55,halfZ:.27})),
]);
const height=z=>z.minZ<=-66?3.6:z.minX===-8&&z.maxX===8?5.2:3.9;
const near=(a,b)=>Math.abs(a-b)<.01;
function portals(zone,side){
 const {minX:a,maxX:b,minZ:c,maxZ:d}=zone;
 if(a===-8&&b===8){if(side==='n')return[[-3,3]];if(side==='w'||side==='e')return[[-3,3]];}
 if(a===-3&&b===3){if(side==='s')return[[-3,3]];if(side==='n')return[[-2.5,2.5]];if(side==='w')return[[-22.5,-19.5],[-50.5,-47.5]];if(side==='e')return[[-35.5,-32.5]];}
 if(c===-3&&d===3&&(a===-34||a===8)){if(side==='w'||side==='e')return[[-3,3]];}
 if(a===-46&&side==='e'||a===34&&side==='w')return[[-3,3]];
 if(b===-3&&c===-28&&side==='e')return[[-22.5,-19.5]];
 if(a===3&&c===-41&&side==='w')return[[-35.5,-32.5]];
 if(b===-3&&c===-56&&side==='e')return[[-50.5,-47.5]];
 if(c===-84&&side==='s')return[[-2.5,2.5]];
 return[];
}
function buildWalls(){
 const all=[];
 for(const zone of ZONES){
  const h=height(zone),wood=zone.minX===-8&&zone.maxX===8,green=zone.minZ===-56;
  for(const side of ['n','s','w','e']){
   const horizontal=side==='n'||side==='s',start=horizontal?zone.minX:zone.minZ,end=horizontal?zone.maxX:zone.maxZ;
   const fixed=side==='n'?zone.minZ:side==='s'?zone.maxZ:side==='w'?zone.minX:zone.maxX;
   const openings=portals(zone,side).sort((a,b)=>a[0]-b[0]);
   let current=start;
   function segment(lo,hi,doorHeader=false){if(hi-lo<.005)return;const y=doorHeader?3.42:h/2,sy=doorHeader?Math.max(.1,h-2.95):h;
    all.push({x:horizontal?(lo+hi)/2:fixed,z:horizontal?fixed:(lo+hi)/2,y:doorHeader?2.95+sy/2:y,w:horizontal?hi-lo:.22,d:horizontal?.22:hi-lo,h:sy,material:wood?'wood':green?'metal':'concrete',zone:zone.id,side,window:false});}
   for(const [lo,hi] of openings){segment(current,Math.max(start,lo));segment(Math.max(start,lo),Math.min(end,hi),true);current=Math.max(current,hi);}segment(current,end);
  }
 }
 return Object.freeze(all);
}
export const OPAQUE_WALLS=buildWalls();
const SIGHT_BLOCKERS=[...OPAQUE_WALLS,...SOLID_PROPS.filter(prop=>prop.height).map(prop=>({
 x:prop.x,y:prop.height/2,z:prop.z,w:prop.halfX*2,h:prop.height,d:prop.halfZ*2
}))];
function hitSegment(a,b,box){let low=0,high=1;for(const [axis,size]of [['x','w'],['y','h'],['z','d']]){const q=a[axis],delta=b[axis]-q,min=box[axis]-box[size]/2,max=box[axis]+box[size]/2;if(Math.abs(delta)<1e-9){if(q<min||q>max)return false;continue;}let u=(min-q)/delta,v=(max-q)/delta;if(u>v)[u,v]=[v,u];low=Math.max(low,u);high=Math.min(high,v);if(low>high)return false;}return high>1e-5&&low<1-1e-5;}
export function canSeeBetween(a,b){const p={x:a?.x,y:a?.y??1.65,z:a?.z},q={x:b?.x,y:b?.y??1.65,z:b?.z};if(![...Object.values(p),...Object.values(q)].every(Number.isFinite))return false;return !SIGHT_BLOCKERS.some(w=>hitSegment(p,q,w));}
export function isWalkable(x,z,r=.28){
 if(!Number.isFinite(x)||!Number.isFinite(z)||r<0)return false;
 const inside=(px,pz)=>ZONES.some(q=>px>=q.minX&&px<=q.maxX&&pz>=q.minZ&&pz<=q.maxZ);
 if(!inside(x,z))return false;
 for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!inside(x+Math.cos(a)*r,z+Math.sin(a)*r))return false;}
 if(OPAQUE_WALLS.some(w=>w.y-w.h/2<2&&x>w.x-w.w/2-r&&x<w.x+w.w/2+r&&z>w.z-w.d/2-r&&z<w.z+w.d/2+r))return false;
 return !SOLID_PROPS.some(p=>Math.abs(x-p.x)<p.halfX+r&&Math.abs(z-p.z)<p.halfZ+r);
}

function textTexture(title,sub='',color='#d9c199'){
 const c=document.createElement('canvas');c.width=768;c.height=256;const x=c.getContext('2d');x.fillStyle='#172126';x.fillRect(0,0,768,256);x.strokeStyle='#6a7270';x.lineWidth=5;x.strokeRect(9,9,750,238);x.fillStyle=color;x.font='bold 42px monospace';x.fillText(title.toUpperCase().slice(0,29),32,103);x.font='21px monospace';x.fillStyle='#99b0ae';x.fillText(sub.toUpperCase().slice(0,48),34,162);x.fillStyle='#0003';for(let y=0;y<256;y+=4)x.fillRect(0,y,768,1);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function createWorld(canvas,{quality='high'}={}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#050a10');scene.fog=new THREE.FogExp2('#0b141a',.022);
 const camera=new THREE.PerspectiveCamera(69,1,.06,170);camera.position.set(0,1.7,5);scene.add(camera);
 const materials={concrete:makeWeatheredMaterial('concrete'),wood:makeWeatheredMaterial('wood'),metal:makeWeatheredMaterial('metal'),stone:makeWeatheredMaterial('stone'),tile:makeWeatheredMaterial('tile')};
 Object.assign(materials,{dark:new THREE.MeshStandardMaterial({color:'#0b1318',roughness:.82}),rust:new THREE.MeshStandardMaterial({color:'#6f4c35',roughness:.91,metalness:.25}),fabric:new THREE.MeshStandardMaterial({color:'#4b554d',roughness:.97}),leaf:new THREE.MeshStandardMaterial({color:'#344637',roughness:.93,side:THREE.DoubleSide}),paper:new THREE.MeshStandardMaterial({color:'#aaa28a',roughness:1}),glass:new THREE.MeshStandardMaterial({color:'#16353e',emissive:'#0b2335',emissiveIntensity:.35,metalness:.45,roughness:.2,transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide}),amber:new THREE.MeshStandardMaterial({color:'#edc78e',emissive:'#ed9d55',emissiveIntensity:2}),cyan:new THREE.MeshStandardMaterial({color:'#9dcace',emissive:'#75aebf',emissiveIntensity:2}),red:new THREE.MeshStandardMaterial({color:'#a54d3d',emissive:'#8c2c22',emissiveIntensity:.7}),black:new THREE.MeshStandardMaterial({color:'#020607',roughness:.58})});
 materials.wet=new THREE.MeshStandardMaterial({color:'#142222',roughness:.19,metalness:.25,transparent:true,opacity:.5,depthWrite:false});
 const batches=new Map(),dynamic=[],textures=[];
 function append(name,g,pos,rot=[0,0,0]){const m=new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(1,1,1));g.applyMatrix4(m);if(!batches.has(name))batches.set(name,[]);batches.get(name).push(g);}
 const box=(name,x,y,z,w,h,d,rot=[0,0,0])=>{const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const face=Math.floor(i/4),sx=(face<2?d:w)/2,sy=(face===2||face===3?d:h)/2;uv.setXY(i,uv.getX(i)*Math.max(.1,sx),uv.getY(i)*Math.max(.1,sy));}append(name,g,[x,y,z],rot);};
 const cylinder=(name,x,y,z,top,bottom,h,rot=[0,0,0],n=14)=>append(name,new THREE.CylinderGeometry(top,bottom,h,n),[x,y,z],rot);
 const sphere=(name,x,y,z,rx,ry,rz)=>{const g=new THREE.SphereGeometry(1,12,8);g.scale(rx,ry,rz);append(name,g,[x,y,z]);};
 function tube(name,points,r=.035){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));append(name,new THREE.TubeGeometry(curve,Math.max(8,points.length*5),r,6,false),[0,0,0]);}
 function leaf(x,y,z,angle,length){const p=[],uv=[],tri=[];for(let j=0;j<=5;j++){const t=j/5,width=Math.sin(t*Math.PI)*.13;for(const side of [-1,1]){p.push(x+Math.cos(angle)*t*length-Math.sin(angle)*width*side,y+Math.sin(t*Math.PI)*.12-t*t*.26,z+Math.sin(angle)*t*length+Math.cos(angle)*width*side);uv.push(t,side>0?1:0);}if(j<5){const a=j*2;tri.push(a,a+1,a+2,a+1,a+3,a+2);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(tri);g.computeVertexNormals();append('leaf',g,[0,0,0]);}
 function sign(title,sub,x,y,z,ry=0,w=2.4,h=.8){const texture=textTexture(title,sub);textures.push(texture);const m=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);mesh.rotation.y=ry;scene.add(mesh);return mesh;}
 // A shared contact-shadow texture anchors heavy furniture even on Battery saver.
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=64;
 const contact=contactCanvas.getContext('2d'),fade=contact.createRadialGradient(32,32,12,32,32,31);
 fade.addColorStop(0,'rgba(0,0,0,0.55)');fade.addColorStop(.55,'rgba(0,0,0,0.30)');fade.addColorStop(1,'rgba(0,0,0,0)');
 contact.fillStyle=fade;contact.fillRect(0,0,64,64);
 const contactMap=new THREE.CanvasTexture(contactCanvas);textures.push(contactMap);
 materials.contact=new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false});
 for(const prop of SOLID_PROPS){
  const geometry=new THREE.PlaneGeometry(prop.halfX*2+.72,prop.halfZ*2+.72);
  append('contact',geometry,[prop.x,.006,prop.z],[-Math.PI/2,0,0]);
 }
 // Frost forms at the edges, leaving the window centres readable. One small
 // locally generated map is shared by every pane and the conservatory roof.
 {const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#49616a';x.fillRect(0,0,256,256);let seed=83017;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);for(let i=0;i<900;i++){const px=rand()*256,py=rand()*256,edge=Math.min(px,py,256-px,256-py),a=Math.max(.025,.28-edge/240);x.strokeStyle=`rgba(186,207,211,${a})`;x.lineWidth=.4+rand();x.beginPath();x.moveTo(px,py);x.lineTo(px+rand()*9-4,py+4+rand()*16);x.stroke();}for(let i=0;i<18;i++){x.fillStyle=`rgba(16,36,41,${.08+rand()*.08})`;x.fillRect(rand()*256,0,.5+rand()*2,100+rand()*156);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);materials.glass.map=t;materials.glass.roughness=.45;}
 for(const zone of ZONES){const cx=(zone.minX+zone.maxX)/2,cz=(zone.minZ+zone.maxZ)/2,w=zone.maxX-zone.minX,d=zone.maxZ-zone.minZ,wood=zone.id==='lodge';box(wood?'wood':zone.id==='conservatory'?'stone':'tile',cx,-.12,cz,w,.24,d);if(zone.id!=='dome'&&zone.id!=='conservatory')box('dark',cx,height(zone)+.08,cz,w,.16,d);
  const border='metal';for(const x of [zone.minX+.25,zone.maxX-.25])box(border,x,.055,cz,.08,.08,d-.3);
 }
 for(const [wallIndex,wall] of OPAQUE_WALLS.entries()){
  const duplicate=OPAQUE_WALLS.some((other,index)=>index!==wallIndex&&other.material===wall.material&&near(other.y,wall.y)&&near(other.h,wall.h)&&other.w>=wall.w&&other.d>=wall.d&&Math.abs(other.x-wall.x)+wall.w/2<=other.w/2+.001&&Math.abs(other.z-wall.z)+wall.d/2<=other.d/2+.001&&(other.w>wall.w+.001||other.d>wall.d+.001||index<wallIndex));if(duplicate)continue;
  const horizontal=wall.d<wall.w,exterior=(horizontal&&(wall.z===8||wall.z===9||wall.z===-84||wall.z===-9))||(!horizontal&&(wall.x===-46||wall.x===48||wall.x===-26||wall.x===22||wall.x===-15||wall.x===15));
  if(exterior&&wall.h>3&&((horizontal?wall.w:wall.d)>4)){
   // Opaque collision glass blocks creatures, while the rendered opening frames
   // the storm and mountains instead of placing a black rectangle over them.
   const long=horizontal?wall.w:wall.d;box(wall.material,wall.x,.48,wall.z,wall.w,.96,wall.d);box(wall.material,wall.x,wall.h-.43,wall.z,wall.w,.86,wall.d);
   for(let p=-long/2;p<=long/2+.01;p+=2){const x=wall.x+(horizontal?p:0),z=wall.z+(horizontal?0:p);box('metal',x,wall.h/2,z,horizontal?.09:wall.w,wall.h-1.6,horizontal?wall.d:.09);}
   box('glass',wall.x,wall.h/2-.05,wall.z,horizontal?wall.w:.025,wall.h-1.7,horizontal?.025:wall.d);
  }else box(wall.material,wall.x,wall.y,wall.z,wall.w,wall.h,wall.d);
 }
 // Door reveals are thick, worn, human-scale structures rather than glowing portals.
 const doorFrames=[[-3,-21,Math.PI/2], [3,-34,Math.PI/2],[-3,-49,Math.PI/2],[0,-66,0],[-8,0,Math.PI/2],[8,0,Math.PI/2],[-34,0,Math.PI/2],[34,0,Math.PI/2],[0,-8,0]];
 for(const [x,z,ry]of doorFrames){const wide=z===-66?5:ry?3:6;for(const side of [-1,1]){const dx=Math.cos(ry)*side*(wide/2-.05),dz=Math.sin(ry)*side*(wide/2-.05);box('metal',x+dx,1.5,z+dz,.18,3,.18);}box('metal',x,3,z,wide,.18,.26,[0,ry,0]);}
 // Lodge: damp reception, fireplace, abandoned furniture and weather station charts.
 box('wood',4,.5,4,3.4,1,1.3);box('black',4,1.05,4,3.55,.10,1.45);box('metal',4.7,1.28,4,.7,.38,.22,[.12,0,0]);box('black',4.7,1.31,3.87,.54,.24,.018);
 for(const z of [3,-3.8]){box('fabric',-5.6,.42,z,1.8,.5,3.3);box('wood',-6.38,.9,z,.22,1.2,3.5);for(const dz of [-1.55,1.55])box('wood',-5.6,.68,z+dz,1.8,.7,.18);for(let i=0;i<3;i++)box('fabric',-5.55,.72,z-.95+i*.9,1.45,.16,.8,[0,.02*i,0]);}
 box('stone',6.5,1.6,-5.4,1.4,3.2,3.5);box('black',5.76,.85,-5.4,.05,1.3,2.2);for(let i=0;i<4;i++)cylinder('wood',5.8,.25+i*.09,-5.85+i*.3,.07,.08,1.1,[Math.PI/2,0,.2]);
 sign('Mount Orison','Meteorological array / last shift 1968',0,3.7,7.85,Math.PI,4.5,1.15);sign('Staff only','Records  /  Calibration  /  Telescope',0,3.35,-7.86,0,4,.8);sign('Engineering','West service wing',-7.85,3.4,0,Math.PI/2,3,.7);sign('Medical','East dormitory wing',7.85,3.4,0,-Math.PI/2,3,.7);
 for(const z of [-6,-2,2,6])box('wood',0,4.95,z,15.8,.30,.24);for(const x of [-6,0,6])box('wood',x,5.04,0,.24,.24,15.8);
 // Long hall rhythm: mismatched ceiling panels, cable trays and paired drain channels.
 for(let z=-11;z>-65;z-=4){for(const side of [-1,1])box('metal',side*2.86,1.95,z,.14,3.9,.12);box('metal',0,3.8,z,5.8,.14,.12);box('dark',0,3.65,z,1.1,.12,2.3);box('cyan',0,3.55,z,.8,.035,.12);for(const x of [-2.45,2.45])box('black',x,.015,z,.18,.025,3.8);}
 for(const x of [-2.5,-2.24]){cylinder('metal',x,3.38,-36,.10,.10,54,[Math.PI/2,0,0]);for(let z=-12;z>-64;z-=3)box('rust',x,3.38,z,.27,.27,.065);}
 tube('black',[[-2.8,3.3,-9],[-2.7,3.25,-22],[-2.45,2.9,-32],[-2.75,3.2,-45],[-2.7,3.3,-65]],.045);
 for(const [x,ry,name,z]of [[-2.85,Math.PI/2,'Records',-16],[2.85,-Math.PI/2,'Calibration',-29],[-2.85,Math.PI/2,'Conservatory',-44]])sign(name,'Keep doors closed after sundown',x,2.2,z,ry,2.5,.75);
 // Generator plant: continuous ducts, heavy engine and cooling fan grille.
 box('metal',-41,.7,-5.5,3.6,1.4,3);box('dark',-41,.18,-5.5,4,.3,3.4);cylinder('rust',-41,1.7,-5.5,1.05,1.05,2.8,[0,0,Math.PI/2],24);cylinder('black',-39.5,1.7,-5.5,.82,.82,.15,[0,0,Math.PI/2],24);for(let i=0;i<8;i++)box('metal',-39.38,1.7+Math.sin(i*Math.PI/4)*.58,-5.5+Math.cos(i*Math.PI/4)*.58,.05,.12,.8,[i*Math.PI/4,0,0]);
 for(const x of [-43,-40])tube('rust',[[x,1.7,-6],[x,2.7,-6],[x,3.2,-4],[x,3.2,7]],.12);
 box('metal',-44,1.1,5.8,1.4,2.2,2.8);for(let i=0;i<5;i++){box('dark',-43.25,.5+i*.32,5.8,.02,.22,2.3);box('amber',-43.22,.5+i*.32,5.1,.025,.035,.08);}sign('Do not reset','Without isolating the load',-45.83,2.7,0,Math.PI/2,2.7,.8);
 // Infirmary: real bed frames, rumpled blankets and operating light, central aisle clear.
 for(const x of [39,44])for(const z of [-5.6,5.6]){box('metal',x,.37,z,2.4,.12,1.4);for(const dx of [-1,1])for(const dz of [-.5,.5])cylinder('metal',x+dx,.2,z+dz,.035,.035,.4);box('fabric',x,.55,z,2.25,.25,1.2);box('paper',x-.72,.77,z,.55,.19,1.02,[0,.02,.04]);box('fabric',x+.35,.72,z,1.3,.10,1.18,[.025,0,.025]);}
 cylinder('metal',46.3,1.35,1.3,.035,.035,2.7);tube('metal',[[46.3,2.65,1.3],[45.8,2.9,1.3],[45.4,2.8,1.3]],.035);sphere('paper',45.3,2.7,1.3,.35,.12,.35);sign('The quiet ward','Do not wake the other beds',41,3.2,-8.83,0,4,.85);
 // Records: archives against perimeter, open drawers and displaced papers.
 for(const x of [-17.6,-12,-6.4])for(const z of [-26.5,-15.5]){box('metal',x,1.45,z,3,2.9,1);for(let y=.35;y<2.7;y+=.46){box('dark',x,y,z-(z<-20?-.52:.52),2.7,.3,.03);for(let j=0;j<4;j++)box('wood',x-1+j*.65,y+.08,z, .46,.26,.8);}box('paper',x,3,z,1.2,.08,.75,[0,.1,0]);}
 sign('Personnel records','They stopped sending names',-19.84,2.7,-21,Math.PI/2,3.8,.9);
 // Calibration workshop.
 for(const x of [7,16.5]){box('metal',x,.48,-38.9,4,.96,1.3);box('wood',x,1.02,-38.9,4.12,.12,1.42);for(let n=0;n<5;n++){cylinder('metal',x-1.5+n*.65,1.18,-38.9,.09,.12,.25);box('black',x-1.5+n*.65,1.4,-40.7,.06,.4,.04,[0,0,(n-2)*.2]);}}
 sign('Calibration','Return tools before the bell',12.5,2.7,-40.84,0,4.1,.9);
 // Conservatory: heavy planters and suspended growth leave an accessible battle aisle.
 for(const x of [-20,-11])for(const z of [-53.6,-44.4]){box('stone',x,.4,z,5.4,.8,1.4);box('dark',x,.83,z,5,.08,1.05);for(let n=0;n<8;n++){const px=x-2.25+n*.6;const stem=[[px,.85,z],[px+.14,1.4,z-.08],[px-.13,2.1,z+.15],[px+.2,2.65,z+.05]];tube('rust',stem,.032);for(let j=0;j<4;j++)leaf(px+Math.sin(j)*.08,1.15+j*.39,z,n*.9+j*2.2,.65+(n%3)*.13);}}
 for(let x=-24;x<-3;x+=3)tube('metal',[[x,0,-55.8],[x,3.8,-55.8],[x,4.4,-49],[x,3.8,-42.2],[x,0,-42.2]],.05);
 const roofZ=[-56,-52.5,-49,-45.5,-42],roofY=[3.8,4.25,4.45,4.25,3.8];for(let i=0;i<4;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-26,roofY[i],roofZ[i],-3,roofY[i],roofZ[i],-3,roofY[i+1],roofZ[i+1],-26,roofY[i+1],roofZ[i+1]],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();append('glass',g,[0,0,0]);}
 for(let i=0;i<10;i++){const x=-24+i*2.1; tube('black',[[x,3.9,-47],[x+.3,3.0,-47.2],[x-.2,2.4+(i%3)*.17,-47.1]],.025);}
 sign('Growth laboratory','No natural light has been recorded',-25.83,2.6,-49,Math.PI/2,4,.9);
 // Telescope chamber: offset pedestal keeps central gameplay route unobstructed.
 cylinder('stone',5,.3,-75.5,2.2,2.2,.6,[0,0,0],32);cylinder('metal',5,1.3,-75.5,1.1,1.5,2.1,[0,0,0],24);box('metal',5,2.7,-75.5,2.5,1.2,1.1,[0,0,.18]);cylinder('metal',5,3.8,-75.5,.8,.9,6,[.55,0,.25],32);cylinder('black',5.65,6.3,-74,.7,.7,.08,[.55,0,.25],32);
 for(let i=0;i<18;i++){const a=i/18*Math.PI*2,curve=[];for(let j=0;j<=12;j++){const t=j/12*Math.PI/2;curve.push([Math.cos(a)*Math.cos(t)*14,3.6+Math.sin(t)*7.5,-75+Math.sin(a)*Math.cos(t)*8]);}tube('metal',curve,.07);}
 const roof=new THREE.Mesh(new THREE.SphereGeometry(1,32,14,.13,Math.PI*2-.26,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#17252d',side:THREE.BackSide,roughness:.88,metalness:.38}));roof.position.set(0,3.6,-75);roof.scale.set(14,7.5,8);scene.add(roof);
 // An open observing slit admits the cold night, framed by the dome ribs.
 box('black',0,9.6,-75,2.8,.15,14);box('glass',0,9.48,-75,2.5,.03,13.6);sign('The hollow array','Never turn it toward the mountain',0,3.4,-83.83,0,5.8,1.1);
 // Shelter cupboards use the same locations as gameplay.
 for(const p of HIDE_SPOTS){const x=p.x??p.position?.x,z=p.z??p.position?.z;if(!Number.isFinite(x)||!Number.isFinite(z))continue;const ry=Math.abs(x)>8?Math.PI/2:0;box('wood',x,1.2,z,.8,2.4,.6,[0,ry,0]);box('metal',x+.22,1.1,z+.32,.04,.25,.025);sign('Shelter','Keep still',x,1.7,z+.325,0,.62,.25);}
 // Interactive stations: a readable lamp and tool tray marks each exact objective.
 const stationKeys=new Set();for(const station of STATIONS){const p=station.position??station;if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||['hound','widow','cantor'].includes(station.id))continue;const key=`${p.x},${p.z}`;if(stationKeys.has(key))continue;stationKeys.add(key);box('metal',p.x,.48,p.z-.8,1.1,.96,.54);box('black',p.x,.99,p.z-.8,1.16,.08,.58);box('cyan',p.x,.995,p.z-.60,.62,.02,.13);const g=new THREE.Group();g.position.set(p.x,0,p.z-.8);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),materials.amber.clone());lamp.position.set(.37,1.08,.12);g.add(lamp);scene.add(g);dynamic.push({id:station.id,lamp});}
 // Papers, abandoned charts and cables are visual clues without invisible colliders.
 for(let i=0;i<35;i++){const x=Math.sin(i*13.3)*2,z=-6-i*1.55;if(z<-65)break;box('paper',x,.025,z,.25+(i%3)*.05,.012,.36,[0,i*.63,0]);}
 // Service detail is material-batched with the architecture. Everything added
 // here is overhead or inside an existing solid prop footprint.
 for(const zone of ZONES){
  if(zone.minZ<=-66||zone.minZ===-56||zone.maxX-zone.minX<10)continue;
  const y=height(zone),cx=(zone.minX+zone.maxX)/2,cz=(zone.minZ+zone.maxZ)/2;
  for(let z=zone.minZ+2;z<zone.maxZ-1;z+=4){box('metal',cx,y-.12,z,zone.maxX-zone.minX-.4,.12,.12);for(const x of [cx-2,cx+2]){box('dark',x,y-.22,z,1.85,.15,.42);box(zone.id==='lodge'?'amber':'cyan',x,y-.31,z,1.54,.025,.11);for(const dx of [-.68,.68])box('metal',x+dx,y-.31,z,.035,.06,.40);}}
  for(const side of [-1,1]){const x=side<0?zone.minX+.32:zone.maxX-.32;box('metal',x,.18,cz,.08,.12,zone.maxZ-zone.minZ-.4);}
 }
 // Workshop: suspended ductwork, bench lathe, vice, gauges and a clock stopped
 // just before the recorded loss of the expedition.
 box('metal',12.5,3.35,-37.9,17,.42,.52);for(let x=5;x<22;x+=1.45){box('dark',x,3.35,-37.9,.035,.49,.59);box('metal',x,3.63,-37.9,.035,.22,.035);}
 for(const x of [6.1,15.8]){
  box('metal',x,1.13,-38.9,1.1,.16,.7);box('dark',x-.42,1.42,-38.9,.22,.50,.58);cylinder('metal',x,1.47,-38.9,.17,.17,.65,[0,0,Math.PI/2],16);cylinder('black',x+.38,1.47,-38.9,.20,.20,.08,[0,0,Math.PI/2],16);box('rust',x+.4,1.23,-38.55,.18,.26,.24);
  box('metal',x+.92,1.2,-38.9,.28,.26,.42);box('black',x+.92,1.36,-38.9,.36,.065,.48);cylinder('metal',x+.92,1.24,-38.57,.025,.025,.50,[Math.PI/2,0,0],8);
  box('dark',x,2,-40.72,2.6,1.0,.08);for(let j=0;j<8;j++){const px=x-1.05+j*.3;cylinder('rust',px,1.98,-40.64,.012,.012,.42,[0,0,(j%3-1)*.09],6);box('metal',px,2.2,-40.64,.09,.06,.035);}
 }
 for(const [x,z]of [[-43.45,5.2],[-43.45,6.1]]){cylinder('paper',x,1.87,z,.17,.17,.045,[0,0,Math.PI/2],18);cylinder('dark',x+.03,1.87,z,.145,.145,.015,[0,0,Math.PI/2],18);box('amber',x+.045,1.88,z,.02,.13,.014,[.35,0,0]);}
 // Close-up wall hardware, door plates and bolts break the perfect box edges.
 for(const [x,z,ry]of doorFrames){const side=Math.abs(x)>3?1:-1,px=x+Math.cos(ry)*1.25,pz=z+Math.sin(ry)*1.25;box('metal',px,1.28,pz,.12,.23,.07,[0,ry,0]);box('red',px,1.28,pz+.045,.045,.08,.02,[0,ry,0]);for(const y of [.3,2.6]){for(const s of [-1,1]){const dx=Math.cos(ry)*s*(z===-66?2.42:ry?1.42:2.92),dz=Math.sin(ry)*s*(z===-66?2.42:ry?1.42:2.92);sphere('rust',x+dx,y,z+dz,.025,.025,.025);}}}
 // The infirmary's beds have rails, drip stands and crumpled privacy curtains.
 for(const x of [39,44])for(const z of [-5.6,5.6]){
  for(const dz of [-.64,.64]){cylinder('metal',x,.86,z+dz,.022,.022,2.15,[0,0,Math.PI/2],8);for(const dx of [-.8,.8])cylinder('metal',x+dx,.67,z+dz,.018,.018,.38,[0,0,0],6);}
  const px=x+1.1,pz=z+(z>0?-.8:.8);cylinder('metal',px,1.25,pz,.018,.018,2.5,[0,0,0],8);box('paper',px,2.14,pz,.18,.29,.07);tube('black',[[px,2,pz],[px+.04,1.6,pz],[px-.24,.85,pz]],.009);
  for(let n=0;n<5;n++)box('fabric',x-1.25,.74+n*.015,z-.35+n*.17,.18,.09,.14,[0,n*.15,.2]);
 }
 // Floor damp and wall run-off remain subtle; there are no added collision
 // volumes and the clear middle of every encounter room remains unchanged.
 for(const [x,z,rx,rz]of [[-1,-13,.45,1.1],[2,-38,.5,.8],[-24,-49,.5,1.4],[20,-36,.7,1.3],[46,-6,.4,.8],[-43,3,.5,.8]]){const g=new THREE.CircleGeometry(1,18);g.scale(rx,rz,1);append('wet',g,[x,.016,z],[-Math.PI/2,0,.3]);}
 for(const [x,z,ry]of [[2.86,-26,-Math.PI/2],[-2.86,-57,Math.PI/2],[21.84,-34,-Math.PI/2],[-45.84,4,Math.PI/2]])for(let i=0;i<7;i++){box('rust',x+Math.cos(ry)*i*.11,2.5-i*.07,z+Math.sin(ry)*i*.11,.025,.65+(i%3)*.19,.012,[0,ry,0]);}
 for(const [name,geoms]of batches){const geometry=mergeGeometries(geoms,false);geoms.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,materials[name]);mesh.castShadow=['concrete','wood','metal','stone'].includes(name);mesh.receiveShadow=true;scene.add(mesh);}batches.clear();
 const sky=new THREE.HemisphereLight('#9fb4c8','#171a17',.55);scene.add(sky);const ambient=new THREE.AmbientLight('#60808b',.14);scene.add(ambient);
 const sources=[{x:0,y:4.5,z:0,color:'#dda971',power:34},{x:-40,y:3.25,z:2,color:'#dfaf76',power:37},{x:41,y:3.4,z:0,color:'#98bfce',power:32},{x:0,y:3.1,z:-17,color:'#a2c2ca',power:22},{x:-14,y:3.1,z:-21,color:'#d4b387',power:25},{x:13,y:3.2,z:-34,color:'#dbb58c',power:31},{x:0,y:3.1,z:-41,color:'#96b9c2',power:21},{x:-16,y:3.5,z:-49,color:'#91a6af',power:29},{x:0,y:7,z:-75,color:'#8caecc',power:48}];
 const lightPool=Array.from({length:6},()=>{const l=new THREE.PointLight('#aabfc7',0,18,2);scene.add(l);return l;});
 const torch=new THREE.SpotLight('#e4e3ce',32,25,Math.PI/5.2,.62,2);torch.position.set(.16,-.13,.03);torch.target.position.set(0,-.1,-14);camera.add(torch,torch.target);torch.shadow.mapSize.set(1024,1024);torch.shadow.camera.near=.1;torch.shadow.camera.far=26;torch.shadow.bias=-.0002;torch.shadow.normalBias=.025;
 const beamCanvas=document.createElement('canvas');beamCanvas.width=beamCanvas.height=128;
 const beam=beamCanvas.getContext('2d'),profile=beam.createRadialGradient(64,64,0,64,64,63);
 for(const [position,color] of [[0,'#fff9e7'],[.19,'#fff3d9'],[.31,'#e7dcc5'],[.43,'#a5a396'],[.52,'#92948e'],[.66,'#797e7d'],[.84,'#525b5d'],[1,'#000']])profile.addColorStop(position,color);
 beam.fillStyle=profile;beam.fillRect(0,0,128,128);
 const beamMap=new THREE.CanvasTexture(beamCanvas);beamMap.colorSpace=THREE.SRGBColorSpace;
 torch.map=beamMap;textures.push(beamMap);
 const fill=new THREE.PointLight('#9bb6c7',1.7,4,2);camera.add(fill);
 const atmo=createAtmosphere(scene,{bounds});
 function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 function setQuality(q){quality=q;renderer.setPixelRatio(Math.min(devicePixelRatio||1,q==='low'?1:1.5));renderer.shadowMap.enabled=q!=='low';torch.castShadow=q!=='low';resize();}
 function update(dt,time,player={},state={}){
  const pos=camera.position,blackout=THREE.MathUtils.clamp(Number(state.blackout)||0,0,1),threat=THREE.MathUtils.clamp(Number(state.threat)||0,0,1);const nearest=[...sources].sort((a,b)=>(a.x-pos.x)**2+(a.z-pos.z)**2-((b.x-pos.x)**2+(b.z-pos.z)**2));
  lightPool.forEach((l,i)=>{const s=nearest[i];l.position.set(s.x,s.y,s.z);l.color.set(s.color);const flutter=.97+Math.sin(time*8.4+s.z)*Math.sin(time*1.1+s.x)*.03;l.intensity=s.power*flutter*(1-blackout*.96);});
  sky.intensity=.55*(1-blackout*.55);ambient.intensity=.14*(1-blackout*.5);const on=state.flashlight!==false&&!player.hidden;torch.intensity=on?44*(1-threat*.1):0;fill.intensity=on?1.7:.15;if(Number.isFinite(state.brightness))renderer.toneMappingExposure=THREE.MathUtils.clamp(state.brightness,.65,1.8);
  for(const item of dynamic){const completed=state.completed?.includes?.(item.id);item.lamp.material.color.set(completed?'#6aa88c':'#d7ac75');item.lamp.material.emissive.set(completed?'#1b694f':'#b4753c');item.lamp.material.emissiveIntensity=completed?1.1:1.5+Math.sin(time*2.5)*.3;}
  atmo.update?.(dt,time,player,state);
 }
 function dispose(){atmo.dispose?.();const geoms=new Set(),mats=new Set(),maps=new Set(textures);scene.traverse(o=>{if(o.geometry)geoms.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});for(const m of mats)for(const value of Object.values(m))if(value?.isTexture)maps.add(value);maps.forEach(t=>t.dispose());geoms.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer.dispose();}
 setQuality(quality);
 return{scene,camera,renderer,render:()=>renderer.render(scene,camera),update,resize,setQuality,dispose,interactables:STATIONS.map(s=>({...s,position:{...s.position}})),hasLineOfSight:canSeeBetween};
}

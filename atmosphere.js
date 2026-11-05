import * as THREE from 'three';

// All surface maps are generated locally. They contain no downloaded imagery.
const textureSets=new Map();
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function noise(x,y,seed=0){const h=(a,b)=>{let n=Math.imul(a,374761393)^Math.imul(b,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix,iy),h(ix+1,iy),sx),THREE.MathUtils.lerp(h(ix,iy+1),h(ix+1,iy+1),sx),sy);}
function surface(kind){
 if(textureSets.has(kind))return textureSets.get(kind);
 const size=256,color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4),height=new Float32Array(size*size),rand=random(1327+kind.length*97);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,i=y*size+x,fine=rand(),broad=noise(u*6,v*6,91),wear=noise(u*18,v*18,371),grain=noise(u*90,v*90,95);
  let rgb=[.34,.37,.36],h=.5,r=.88;
  if(kind==='wood'){
   const line=Math.sin((u*37+noise(u*8,v*2,17)*1.7)*Math.PI*2),fiber=Math.sin((u*170+Math.sin(v*6)*.2)*Math.PI*2),board=Math.min(u%.25,.25-u%.25),seam=board<.006;
   const knot=Math.sin(Math.hypot((u-.31)*2,(v-.59)*.5)*127)*Math.exp(-(((u-.31)/.1)**2+((v-.59)/.18)**2));
   const t=.76+line*.055+fiber*.025+(broad-.5)*.17+knot*.045;
   rgb=[.27*t,.20*t,.145*t];h=seam?.23:.48+line*.055+fiber*.025+knot*.035;r=.77+wear*.16;
   if(seam)rgb=rgb.map(n=>n*.28);
  }else if(kind==='metal'){
   const stain=clamp((broad-.63)*3),scratches=Math.pow(Math.max(0,Math.sin(u*845+noise(u*18,v*2,44)*2)),24)*.035;
   const seam=Math.min(u%.5,.5-u%.5)<.007||Math.min(v%.5,.5-v%.5)<.007;
   const rivet=Math.hypot((u%.5)-.045,(v%.5)-.045)<.014;
   rgb=[.28+wear*.055+stain*.065,.32+wear*.05-stain*.08,.33+wear*.045-stain*.12];
   h=.5+(fine-.5)*.025+scratches+(rivet?.09:0)-(seam?.06:0);r=.46+wear*.17+stain*.27;
   if(seam)rgb=rgb.map(n=>n*.55);
  }else if(kind==='stone'){
   const row=Math.floor(v*4),offset=(row%2)*.125,px=((u+offset)%1)*4,py=(v*4)%1,seam=Math.min(px%1,1-px%1)<.018||Math.min(py,1-py)<.025;
   const block=noise(Math.floor(px)*2+.1,row*2+.1,8),t=.22+block*.11+(wear-.5)*.045;
   rgb=[t*.94,t,t*.98];h=seam?.3:.5+(grain-.5)*.09+(wear-.5)*.1;r=.88+grain*.08;if(seam)rgb=[.115,.13,.13];
  }else if(kind==='tile'){
   const seam=Math.min(u%.25,.25-u%.25)<.005||Math.min(v%.25,.25-v%.25)<.005,t=.53+wear*.08-(broad>.6?(broad-.6)*.4:0),scuff=noise(u*55,v*8,613)>.72;
   rgb=[t*.73,t*.80,t*.76];h=seam?.35:.55+(grain-.5)*.01;r=seam?.96:.60+wear*.14;if(seam)rgb=[.15,.17,.155];if(scuff)rgb=rgb.map(n=>n*.9);
  }else{
   const pit=fine<.055,stain=Math.max(0,broad-.59)*.15,t=.34+(grain-.5)*.07-stain+(wear-.5)*.035;
   rgb=[t*.95,t,t*.98];h=pit?.38:.5+(fine-.5)*.06+(grain-.5)*.055;r=.88+wear*.08;if(pit)rgb=rgb.map(n=>n*.8);
  }
  height[i]=h;const p=i*4;color.set([...rgb.map(c=>Math.round(clamp(c)*255)),255],p);const rr=Math.round(clamp(r)*255);rough.set([rr,rr,rr,255],p);
 }
 const get=(x,y)=>height[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(get(x-1,y)-get(x+1,y))*2,dy=(get(x,y-1)-get(x,y+1))*2,len=Math.hypot(dx,dy,1);normal.set([Math.round((dx/len*.5+.5)*255),Math.round((dy/len*.5+.5)*255),Math.round((1/len*.5+.5)*255),255],(y*size+x)*4);}
 const texture=(data,srgb=false)=>{const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;t.needsUpdate=true;return t;};
 const result={map:texture(color,true),normalMap:texture(normal),roughnessMap:texture(rough)};textureSets.set(kind,result);return result;
}
export function makeWeatheredMaterial(kind='concrete'){
 if(!['wood','metal','stone','tile','concrete'].includes(kind))kind='concrete';
 return new THREE.MeshStandardMaterial({...surface(kind),color:0xffffff,metalness:kind==='metal'?.72:kind==='tile'?.08:0,roughness:1,normalScale:new THREE.Vector2(kind==='wood'?.32:.42,kind==='wood'?.32:.42)});
}

export function createAtmosphere(scene,{bounds={minX:-46,maxX:48,minZ:-84,maxZ:9}}={}){
 const group=new THREE.Group();group.name='weather-and-environment';scene.add(group);const rand=random(80491),geometries=new Set(),materials=new Set(),textures=new Set(),tmp=new THREE.Object3D();
 const ownGeo=g=>(geometries.add(g),g),ownMat=m=>(materials.add(m),m),add=(g,m)=>{const mesh=new THREE.Mesh(ownGeo(g),ownMat(m));group.add(mesh);return mesh;};
 const skyData=new Uint8Array(256*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<256;x++){const cloud=noise(x/25,y/10,121)*.58+noise(x/9,y/7,9)*.25,alt=1-y/128,t=(.34+alt*.42)*(1-cloud*.64),p=(y*256+x)*4;skyData.set([Math.round(8*t),Math.round(18*t),Math.round(30*t),255],p);}
 const skyTexture=new THREE.DataTexture(skyData,256,128);skyTexture.colorSpace=THREE.SRGBColorSpace;skyTexture.needsUpdate=true;skyTexture.magFilter=THREE.LinearFilter;textures.add(skyTexture);
 const sky=add(new THREE.SphereGeometry(210,24,12),new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,fog:false}));sky.position.set(0,10,-35);
 // The ridgeline wraps the site, leaving the interior architecture in silhouette.
 const ridge=[],indices=[];const segments=128;
 for(let i=0;i<=segments;i++){const angle=i/segments*Math.PI*2,r=100+Math.sin(angle*5)*18,x=Math.cos(angle)*r,z=-35+Math.sin(angle)*r,peak=8+noise(i*.13,0,472)*32;ridge.push(x,-9,z,x,peak,z);if(i<segments){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const ridgeGeo=new THREE.BufferGeometry();ridgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(ridge,3));ridgeGeo.setIndex(indices);ridgeGeo.computeVertexNormals();add(ridgeGeo,new THREE.MeshBasicMaterial({color:'#080f16',side:THREE.DoubleSide,fog:false}));
 const outdoors=(x,z)=>!((x>-10&&x<10&&z>-10&&z<10)||(x>-5&&x<5&&z>-69&&z<10)||(x>-49&&x<51&&z>-12&&z<12)||(x>-23&&x<0&&z>-31&&z<-11)||(x>0&&x<25&&z>-44&&z<-24)||(x>-29&&x<0&&z>-59&&z<-39)||(x>-18&&x<18&&z>-87&&z<-63));
 // A low, snow-covered ground plane gives the window views real depth instead
 // of empty black space. Raised drifts are confined to exterior clearances.
 const groundGeo=new THREE.PlaneGeometry(180,180,36,36);groundGeo.rotateX(-Math.PI/2);groundGeo.translate(0,-.28,-35);const gp=groundGeo.attributes.position,gc=[];for(let i=0;i<gp.count;i++){const x=gp.getX(i),z=gp.getZ(i),n=noise(x*.09,z*.09,534),outside=outdoors(x,z);gp.setY(i,outside?-.26+n*.16:-.28);const c=.36+n*.15;gc.push(c*.84,c*.93,c);}groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(gc,3));groundGeo.computeVertexNormals();add(groundGeo,new THREE.MeshStandardMaterial({color:'#c9d3d6',vertexColors:true,roughness:1}));
 const trees=[];for(let attempts=0;trees.length<100&&attempts<2000;attempts++){const x=(rand()-.5)*154,z=-38+(rand()-.5)*145;if(outdoors(x,z))trees.push({x,z,scale:.6+rand()*.9});}
 const trunk=new THREE.InstancedMesh(ownGeo(new THREE.CylinderGeometry(.13,.23,5,5)),ownMat(new THREE.MeshStandardMaterial({color:'#1c211f',roughness:1})),trees.length),canopy=new THREE.InstancedMesh(ownGeo(new THREE.ConeGeometry(1.8,5.5,7)),ownMat(new THREE.MeshStandardMaterial({color:'#101e1e',roughness:1})),trees.length*3);group.add(trunk,canopy);
 trees.forEach((tree,i)=>{tmp.position.set(tree.x,2.5*tree.scale-1,tree.z);tmp.rotation.set(0,rand()*6,0);tmp.scale.setScalar(tree.scale);tmp.updateMatrix();trunk.setMatrixAt(i,tmp.matrix);for(let j=0;j<3;j++){tmp.position.y=(4.3+j*1.7)*tree.scale-1;tmp.scale.setScalar(tree.scale*(1-j*.18));tmp.updateMatrix();canopy.setMatrixAt(i*3+j,tmp.matrix);}});
 const snowPositions=new Float32Array(700*3),snowRates=new Float32Array(700);for(let i=0;i<700;i++){let x,z;do{x=(rand()-.5)*135;z=-36+(rand()-.5)*132;}while(!outdoors(x,z));snowPositions.set([x,rand()*28,z],i*3);snowRates[i]=.7+rand()*1.5;}
 const snowGeo=ownGeo(new THREE.BufferGeometry());snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));const snow=new THREE.Points(snowGeo,ownMat(new THREE.PointsMaterial({color:'#9db0be',size:.035,transparent:true,opacity:.33,depthWrite:false})));group.add(snow);
 const dustPositions=new Float32Array(190*3);for(let i=0;i<190;i++){const lodge=i<55;dustPositions.set([lodge?(rand()-.5)*13:(rand()-.5)*5,.2+rand()*2.8,lodge?(rand()-.5)*12:-8-rand()*56],i*3);}const dustGeo=ownGeo(new THREE.BufferGeometry());dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeo,ownMat(new THREE.PointsMaterial({color:'#829799',size:.012,transparent:true,opacity:.18,depthWrite:false})));group.add(dust);
 function scatter(count,geometry,material,positions,scale){const mesh=new THREE.InstancedMesh(ownGeo(geometry),ownMat(material),count);group.add(mesh);for(let i=0;i<count;i++){const p=positions(i);tmp.position.set(p.x,.013+rand()*.004,p.z);tmp.rotation.set(-Math.PI/2,0,rand()*Math.PI*2);tmp.scale.set(scale[0]*(.65+rand()*.7),scale[1]*(.65+rand()*.7),1);tmp.updateMatrix();mesh.setMatrixAt(i,tmp.matrix);mesh.setColorAt(i,new THREE.Color().setScalar(.58+rand()*.35));}return mesh;}
 const paperPositions=[[-6.7,-5.8],[6.3,5.5],[-17,-26],[-18,-15.8],[19,-39],[5,-28.5],[36.8,-7],[46,7.4],[-43.4,7],[-35.7,-7.8]];
 scatter(48,new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:'#aaa997',roughness:1,side:THREE.DoubleSide}),i=>{const p=paperPositions[i%paperPositions.length];return{x:p[0]+(rand()-.5)*1.1,z:p[1]+(rand()-.5)*1.1};},[.23,.32]);
 const leafGeo=new THREE.CircleGeometry(1,5);scatter(78,leafGeo,new THREE.MeshStandardMaterial({color:'#554530',roughness:1,side:THREE.DoubleSide}),()=>({x:-24+rand()*19,z:rand()<.5?-54.5+rand():-43.5+rand()}),[.09,.22]);
 scatter(34,new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:'#384341',roughness:.74,metalness:.5,side:THREE.DoubleSide}),i=>({x:i%2?-2.4+rand()*.3:2.2+rand()*.3,z:-10-rand()*52}),[.07,.14]);
 const shadow=add(new THREE.SphereGeometry(1,10,6),new THREE.MeshBasicMaterial({color:'#010607',transparent:true,opacity:0,depthWrite:false}));shadow.scale.set(.4,3.1,1.3);shadow.position.set(-29,2,-50);
 const lightning=new THREE.HemisphereLight('#a2bdd1','#1b2527',0);group.add(lightning);
 let disposed=false;
 function update(dt,time,player={},state={}){
  if(disposed)return;dt=clamp(Number(dt)||0,0,.1);time=Number.isFinite(time)?time:0;
  sky.rotation.y=Math.sin(time*.002)*.025;
  const pos=snowGeo.attributes.position;for(let i=0;i<700;i++){let y=pos.getY(i)-dt*snowRates[i],x=pos.getX(i)+dt*.29;if(y<-.8)y=27;if(x>68)x=-68;if(!outdoors(x,pos.getZ(i)))x=x<0?-65:65;pos.setXY(i,x,y);}pos.needsUpdate=true;
  dust.position.y=Math.sin(time*.13)*.025;dust.rotation.y=Math.sin(time*.017)*.002;
  const flashPhase=(time+9)%43;lightning.intensity=flashPhase<.7?Math.sin(flashPhase/.7*Math.PI)*.18:0;
  const visit=(time+15)%79,fade=visit<5?Math.sin(visit/5*Math.PI):0;shadow.material.opacity=fade*.38;shadow.position.z=-53+visit*.8;shadow.position.y=2+Math.sin(time)*.03;
  const blackout=clamp(Number(state.blackout)||0);dust.material.opacity=.18*(1-blackout*.7);snow.material.opacity=.30+clamp(Number(state.threat)||0)*.04;
 }
 function dispose(){if(disposed)return;disposed=true;scene.remove(group);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 update(0,0);
 return{update,dispose,group,stats:{drawCalls:11,triangles:10230,particleCount:890}};
}

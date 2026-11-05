import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// View models are intentionally small and share materials across all three tools.
export function createEquipment(camera){
 const root=new T.Group();root.name='Expedition field equipment';camera.add(root);
 const steel=new T.MeshStandardMaterial({color:0x546469,metalness:.8,roughness:.4}),dark=new T.MeshStandardMaterial({color:0x1a2327,metalness:.5,roughness:.7}),copper=new T.MeshStandardMaterial({color:0x945d37,metalness:.8,roughness:.4}),glove=new T.MeshStandardMaterial({color:0x343c36,roughness:.95}),yellow=new T.MeshStandardMaterial({color:0x9e894a,metalness:.3,roughness:.65});
 const glow=new T.MeshStandardMaterial({color:0x80c6dd,emissive:0x3291b0,emissiveIntensity:1.2,roughness:.25});
 const seal=new T.MeshStandardMaterial({color:0x121719,roughness:.85});
 const glass=new T.MeshStandardMaterial({color:0x9bc5d5,metalness:.1,roughness:.22,transparent:true,opacity:.24,depthWrite:false});
 const tools={},pool=[];
 function mesh(parent,geometry,material,p=[0,0,0],r=[0,0,0]){const m=new T.Mesh(geometry,material);m.position.set(...p);m.rotation.set(...r);parent.add(m);pool.push(geometry);return m;}
 const box=(parent,size,mat,p,r)=>mesh(parent,new T.BoxGeometry(...size),mat,p,r);
 const cylinder=(parent,radius,length,mat,p,r)=>mesh(parent,new T.CylinderGeometry(radius,radius,length,10),mat,p,r);
 function roundedGrip(parent,radius,length,position,rotation){
  return mesh(parent,new T.CapsuleGeometry(radius,length,3,10),glove,position,rotation);
 }
 for(const id of ['arc','sonar','cryo']){
  const group=new T.Group();group.name=id;group.position.set(.29,-.29,-.57);group.rotation.set(-.05,-.11,.08);root.add(group);tools[id]=group;
  cylinder(group,.035,.23,dark,[0,-.07,.055],[Math.PI/2,0,0]);
  const palm=roundedGrip(group,.039,.062,[0,-.082,.112],[Math.PI/2,0,0]);
  palm.geometry.scale(1,.93,.73);
  for(let i=0;i<4;i++)roundedGrip(group,.010,.052-i*.005,[-.028+i*.019,-.057,.07],[Math.PI/2,0,0]);
  roundedGrip(group,.014,.045,[.038,-.07,.11],[.3,0,-.5]);
  roundedGrip(group,.042,.19,[.018,-.16,.25],[-.9,0,-.1]);
  cylinder(group,.044,.024,seal,[.014,-.111,.192],[-.9,0,-.1]);
  if(id==='arc'){
   box(group,[.135,.11,.25],dark,[0,.015,-.045]);box(group,[.139,.018,.22],steel,[0,.075,-.045]);
   cylinder(group,.038,.16,copper,[0,.035,-.22],[Math.PI/2,0,0]);
   for(let i=0;i<7;i++){const coil=mesh(group,new T.TorusGeometry(.043,.005,5,14),copper,[0,.035,-.16-i*.016]);coil.rotation.y=0;}
   for(const side of [-1,1]){box(group,[.012,.035,.17],steel,[side*.053,.03,-.20]);box(group,[.012,.020,.035],glow,[side*.053,.03,-.29]);}
   box(group,[.05,.006,.045],glow,[0,.087,-.04]);box(group,[.04,.02,.035],yellow,[0,.08,.07]);
  }else if(id==='sonar'){
   box(group,[.095,.10,.14],steel,[0,.025,-.02]);cylinder(group,.019,.13,copper,[0,.09,-.08]);
   for(const side of [-1,1]){box(group,[.015,.19,.018],steel,[side*.044,.195,-.08]);box(group,[.016,.025,.02],glow,[side*.044,.27,-.08]);}
   box(group,[.035,.006,.05],glow,[0,.08,.01]);
  }else{
   cylinder(group,.042,.16,glow,[0,.11,-.04]);
   cylinder(group,.055,.17,glass,[0,.11,-.04]);
   for(const side of [-1,1]){
    box(group,[.015,.20,.022],steel,[side*.061,.11,-.04]);
    box(group,[.022,.20,.015],dark,[0,.11,-.04+side*.057]);
   }
   cylinder(group,.068,.025,steel,[0,.015,-.04]);cylinder(group,.068,.025,steel,[0,.205,-.04]);
   cylinder(group,.028,.08,copper,[0,.24,-.04]);box(group,[.06,.014,.04],yellow,[0,.29,-.04]);
  }
  const batches=new Map();for(const part of [...group.children]){part.updateMatrix();part.geometry.applyMatrix4(part.matrix);if(!batches.has(part.material))batches.set(part.material,[]);batches.get(part.material).push(part.geometry);group.remove(part);}
  for(const [material,geometries]of batches){const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());pool.push(geometry);group.add(new T.Mesh(geometry,material));}
 }
 return{
  update(dt,time,{visible=true,selected='arc',charge=0,effect=0,moving=false,running=false,reducedMotion=false}={}){
   root.visible=visible;if(!visible)return;
   for(const [id,group] of Object.entries(tools))group.visible=id===selected;
   const sway=reducedMotion?0:moving?(running?.009:.005):.0015;
   const kick=reducedMotion?0:Math.max(0,effect-.2)*.2;
   const screenOffset=Math.min(.29,.25*camera.aspect)-.29;
   const stride=time*(running?10:7);
   root.position.set(screenOffset+Math.sin(stride)*sway,Math.abs(Math.cos(stride))*sway,Math.min(.025,charge*.025)+kick);
   root.rotation.z=Math.sin(time*3)*sway;
   glow.emissiveIntensity=(selected==='arc'?1.2+Math.min(1,charge)*2.8:1.7)+effect*3;
  },
  dispose(){camera.remove(root);pool.forEach(g=>g.dispose());[steel,dark,copper,glove,yellow,glow,seal,glass].forEach(m=>m.dispose());}
 };
}

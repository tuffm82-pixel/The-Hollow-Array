import * as THREE from 'three';
export function createFinale(renderer,{reducedMotion=false}={}){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#020406');scene.fog=new THREE.FogExp2('#05090b',.022);const camera=new THREE.PerspectiveCamera(65,1,.05,80),materials=[],geometries=[];let time=0;
 const material=(color,metalness=.7,roughness=.55)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});materials.push(m);return m;},steel=material('#354147'),brass=material('#6f5b37'),black=material('#020405',.2,.95);
 function mesh(g,m,x,y,z){geometries.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);scene.add(o);return o;}
 for(const x of[-2.7,2.7])for(const z of[-2.5,2.5])mesh(new THREE.BoxGeometry(.14,35,.14),steel,x,-8,z);
 for(let y=3;y>-24;y-=3){for(const x of[-3,3])mesh(new THREE.BoxGeometry(.2,.1,8),steel,x,y,-1);const lamp=new THREE.PointLight('#b58e59',5,6,2);lamp.position.set(2.8,y,-2);scene.add(lamp);}
 const lens=mesh(new THREE.CylinderGeometry(4,3.1,5,48,1,true),brass,0,-8,-16);lens.rotation.x=Math.PI/2;
 mesh(new THREE.CircleGeometry(3.8,64),black,0,-8,-13.4);
 for(let i=0;i<5;i++)mesh(new THREE.TorusGeometry(3.85-i*.16,.07,8,64),steel,0,-8,-13.3+i*.08);
 const eyeMaterial=new THREE.MeshBasicMaterial({color:'#b79457',transparent:true,opacity:0});materials.push(eyeMaterial);const eye=mesh(new THREE.SphereGeometry(1.15,40,24),eyeMaterial,0,-8,-13);eye.scale.set(1.7,.65,.14);
 const slit=mesh(new THREE.BoxGeometry(.22,1.2,.12),black,0,-8,-12.8);slit.visible=false;
 const flood=new THREE.PointLight('#8da5b1',9,24,2);flood.position.set(0,-6,-5);scene.add(flood);scene.add(new THREE.AmbientLight('#495b65',.3));
 return{get time(){return time;},get done(){return time>=9;},start(){time=0;},skip(){time=9;},update(dt){time+=dt;camera.position.set(reducedMotion?0:Math.sin(time*.7)*.025,1.7-Math.min(time,7)*1.14,1);camera.rotation.set(-Math.min(.08,time*.012),0,0);camera.aspect=(renderer.domElement.clientWidth||1)/(renderer.domElement.clientHeight||1);camera.updateProjectionMatrix();eyeMaterial.opacity=THREE.MathUtils.smoothstep(time,5.2,7.2);slit.visible=time>5.2;eye.scale.y=time>8?.15:.65;},render(){renderer.render(scene,camera);},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

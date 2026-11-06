import './bunker.css';
import * as THREE from 'three';
import {createBunkerWorld,BUNKER_LEVELS,walkableBunker} from './bunker-world.js';
import {createBunkerActors} from './bunker-actors.js';
import {BUNKER_BODIES,BUNKER_ALLIES,BUNKER_OBJECTIVES,BUNKER_THREATS,BUNKER_OPENING,createBunkerStory,getBunkerObjective,advanceBunkerStory,bunkerSummary,bunkerCheckpoint} from './bunker-story.js';
import {createMonster} from './catalogue-creatures.js';
import {createEquipment} from './equipment.js';
import {createAudio} from './audio.js';
import {createVoice} from './voice.js';

const $=id=>document.getElementById(id);
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const ground=floor=>floor*-7;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const audio=createAudio(),voice=createVoice();
const keys=new Set(),stick={id:null,x:0,z:0},look={id:null,x:0,y:0,travel:0};
const player={floor:0,x:0,z:9,yaw:0,pitch:0,health:3};
const saveKey='last-shelter-checkpoint-v1';
const prefsKey='last-shelter-settings-v1';
function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* private browsing */}}
const settings=read(prefsKey,{sound:true,motion:matchMedia('(prefers-reduced-motion: reduce)').matches});
let world,people,equipment,marker;
let story=createBunkerStory(),mode='home',time=0,frameTime=performance.now();
let lastStep=0,cooldown=0,flash=0,hurt=0,subtitle=0,sprint=false,lift=null,death=null;
let threat=null,deathScene=null;
const creatures=new Map();

function screen(next){
 mode=next;
 for(const id of ['home','hud','paused','decision','ending'])$(id).hidden=id!==next;
 document.body.classList.toggle('modal',['home','paused','decision','ending'].includes(next));
}
function resetInput(){
 keys.clear();stick.id=look.id=null;stick.x=stick.z=0;sprint=false;$('knob').style.transform='';
 $('run').setAttribute('aria-pressed','false');
}
function say(speaker,line,spoken=true){
 if(!line)return;
 $('speaker').textContent=speaker==='mimic'?'UNKNOWN FREQUENCY':speaker==='radio'||!speaker?'SHELTER 17 RADIO':speaker;
 $('line').textContent=line;$('dialogue').hidden=false;subtitle=time+Math.max(6,Math.min(16,line.length*.073));
 if(spoken)voice.speak(line,{speaker:speaker==='mimic'?'mimic':'radio',interrupt:true});
}
function save(){
 if(story.phase==='won')return;
 write(saveKey,{story:bunkerCheckpoint(story),player:{floor:player.floor,x:player.x,z:player.z,yaw:player.yaw}});
 $('continue').hidden=false;
}
function positionCamera(){
 world.camera.position.set(player.x,ground(player.floor)+1.66,player.z);
 world.camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
}
function setFloor(floor,{x=0,z=9,yaw=0}={}){
 player.floor=floor;player.x=x;player.z=z;player.yaw=yaw;player.pitch=0;
 positionCamera();
}
function current(){return getBunkerObjective(story);}
function start(saved=null){
 story=createBunkerStory(saved?.story);
 const objective=current(),floor=objective?.floor??0;
 const p=saved?.player;
 const valid=p?.floor===floor&&walkableBunker(floor,p.x,p.z);
 setFloor(floor,valid?p:{});
 time=cooldown=flash=hurt=0;lastStep=0;player.health=3;death=deathScene=lift=null;
 $('lift-fade').style.opacity='0';document.body.classList.remove('hit');
 for(const actor of creatures.values())actor.view.group.visible=false;
 threat=null;syncThreat();resetInput();syncPeople(true);
 audio.start();audio.resume();audio.setMuted(!settings.sound);voice.setEnabled(settings.sound);voice.resume();voice.unlock();
 screen('hud');
 if(!saved)say('BUNKER SYSTEM',BUNKER_OPENING);
 else say('BUNKER SYSTEM','Checkpoint restored. Follow the objective at the top of your screen.',false);
 frameTime=performance.now();save();paintHUD();
}
function showHome(){
 resetInput();voice.stop();audio.setThreat(0);audio.suspend();death=deathScene=lift=null;
 $('lift-fade').style.opacity='0';$('continue').hidden=!read(saveKey);
 document.body.classList.remove('hit','aimed');screen('home');
}
function pause(){
 if(mode!=='hud'||death||lift)return;
 resetInput();voice.pause();audio.suspend();screen('paused');
}
function resume(){
 if(mode!=='paused')return;
 frameTime=performance.now();voice.resume();audio.resume();screen('hud');
}
function arrival(nextFloor){
 resetInput();
 lift={floor:nextFloor,elapsed:0,placed:false};
 $('lift-fade').style.opacity='1';
 audio.cue('door-close');
}
function syncPeople(reset=false){
 const active=current();
 for(const [i,person] of BUNKER_ALLIES.entries()){
  const ally=people.allies[i];if(!ally)continue;
  ally.visible=person.floor===player.floor;
  ally.position.set(person.x,ground(person.floor),person.z);
  const outcome=story.survivors[person.id];
  if(outcome==='lost')people.pose(i,'fallen');
  else if(outcome==='sheltered'){if(reset)people.pose(i,'idle');}
  else if(person.id==='ivo'||outcome==='at-risk')people.pose(i,'injured');
  else if(active?.id===person.id&&distance(player,person)<7)people.pose(i,'signal');
  else if(reset)people.pose(i,'idle');
  if(outcome!=='lost'&&ally.visible&&distance(player,person)<7){
   const heading=Math.atan2(person.x-player.x,person.z-player.z);
   const delta=Math.atan2(Math.sin(heading-ally.rotation.y),Math.cos(heading-ally.rotation.y));
   ally.rotation.y+=delta*.12;
  }
 }
 for(const [i,body] of BUNKER_BODIES.entries()){
  const mesh=people.bodies[i];if(!mesh)continue;
  mesh.visible=player.floor===body.floor;
  mesh.position.set(body.x,ground(body.floor),body.z);
 }
}
function syncThreat(){
 const task=current();
 const spec=BUNKER_THREATS.find(item=>item.id===task?.id);
 if(!spec){threat=null;return;}
 let actor=creatures.get(spec.id);
 if(!actor){
  const view=createMonster(spec.creature);
  actor={view};world.scene.add(view.group);creatures.set(spec.id,actor);
 }
 Object.assign(actor,spec,{hp:spec.health,windup:0,rest:.6,stagger:0,impact:false,dead:0,yaw:Math.PI,lastSeen:null});
 actor.view.group.position.set(spec.x,ground(spec.floor),spec.z);
 actor.view.group.visible=player.floor===spec.floor;
 threat=actor;
}
function finish(won,reason){
 voice.stop();audio.setThreat(0);resetInput();document.body.classList.remove('hit','aimed');
 $('end-label').textContent=won?'MISSION COMPLETE':'SIGNAL LOST';
 $('end-title').textContent=won?'The surface can wait.':'You didn’t make it.';
 $('end-copy').textContent=reason||bunkerSummary(story);
 $('retry').hidden=won;
 $('end-allies').replaceChildren();
 const outcomes={sheltered:'safe inside the bunker',lost:'lost', 'at-risk':'status unknown'};
 for(const person of BUNKER_ALLIES){
  const item=document.createElement('li');
  item.textContent=`${person.name} · ${outcomes[story.survivors[person.id]]||'not yet reached'}`;
  $('end-allies').append(item);
 }
 screen('ending');
}
function applyAction(objective,choice){
 const result=advanceBunkerStory(story,{id:objective.id,choice});
 if(!result.ok){say(result.speaker,result.message,false);return false;}
 for(const effect of Array.isArray(result.effects)?result.effects:[result.effects]){
  if(!effect?.ally)continue;
  const index=BUNKER_ALLIES.findIndex(person=>person.id===effect.ally);
  if(index>=0&&effect.pose)people.pose(index,effect.pose==='recovering'?'rescued':effect.pose);
 }
 if(story.phase==='won'){finish(true,result.message);voice.speak(result.message,{speaker:result.speaker,interrupt:true});return true;}
 screen('hud');say(BUNKER_ALLIES.find(person=>person.id===objective.id)?.name||result.speaker||objective.speaker,result.message||objective.line);
 const nextFloor=objective.nextFloor;
 if(Number.isInteger(nextFloor))arrival(nextFloor);
 else save();
 syncThreat();paintHUD();
 return true;
}
function openDecision(task){
 resetInput();screen('decision');
 const speaker=BUNKER_ALLIES.find(person=>person.id===task.id)?.name||'SHELTER 17';
 $('decision-speaker').textContent=speaker;
 $('decision-title').textContent=task.title;
 $('decision-detail').textContent=task.line||task.detail;
 $('decision-options').replaceChildren();
 say(speaker,task.line);
 for(const choice of task.choices){
  const button=document.createElement('button');
  button.dataset.choice=choice.id;button.textContent=choice.label;
  if(choice.detail){const detail=document.createElement('small');detail.textContent=choice.detail;button.append(detail);}
  button.onclick=()=>applyAction(task,choice.id);
  $('decision-options').append(button);
 }
 $('decision-options').querySelector('button')?.focus();
}
const returnLift={x:-8,z:9},nextLift={x:0,z:-10};
function use(){
 if(mode!=='hud'||lift||death)return;
 const task=current();
 if(task?.floor===player.floor&&distance(player,task)<2.45&&task.kind!=='threat'){
  if(task.kind==='choice')openDecision(task);
  else{audio.cue('interact');applyAction(task);}
  return;
 }
 if(player.floor>0&&distance(player,returnLift)<2.45){arrival(player.floor-1);return;}
 if(task&&player.floor<task.floor&&distance(player,nextLift)<2.45){arrival(player.floor+1);return;}
 if(player.floor===0&&distance(player,{x:-7.8,z:7.5})<2.5){
  say('BUNKER SYSTEM','Surface radiation is lethal. The blast door must stay closed.');return;
 }
 say('BUNKER SYSTEM','Follow the arrow to the current objective, then press USE.',false);
}
function lineClear(actor){
 if(world.hasLineOfSight)return world.hasLineOfSight(player.floor,player,actor);
 const steps=Math.ceil(distance(player,actor)*4);
 for(let i=1;i<steps;i++){
  const t=i/steps;
  if(!walkableBunker(player.floor,THREE.MathUtils.lerp(player.x,actor.x,t),THREE.MathUtils.lerp(player.z,actor.z,t),.08))return false;
 }
 return true;
}
function targetInSight(actor){
 if(!actor||actor.hp<=0||actor.floor!==player.floor)return false;
 const dx=actor.x-player.x,dz=actor.z-player.z,d=Math.hypot(dx,dz);
 if(d<.1||d>17||!lineClear(actor))return false;
 const alignment=(-Math.sin(player.yaw)*dx-Math.cos(player.yaw)*dz)/d;
 return alignment>.966&&player.pitch>-.44&&player.pitch<.65;
}
function fire(){
 if(mode!=='hud'||lift||death||cooldown>0||player.floor===0)return;
 cooldown=.48;flash=.34;audio.cue('arc');
 if(!targetInSight(threat)){say('COMBAT','Aim at the creature’s body until the reticle turns green.',false);return;}
 const actor=threat;
 actor.hp--;actor.stagger=.28;
 if(actor.hp>0)return;
 deathScene=actor;actor.dead=0;
 audio.cue('scare');applyAction(current());
}
function hitPlayer(actor){
 if(hurt>0)return;
 player.health--;hurt=1.15;document.body.classList.add('hit');audio.cue('grab');
 if(player.health<=0){
  resetInput();death={time:0,actor};audio.cue('death');
 }else say('COMBAT','Back up while it raises its arms, then fire.',false);
}
function updateThreat(dt){
 const a=threat;
 if(!a||a.floor!==player.floor){audio.setThreat(0);return;}
 const gap=distance(a,player);
 audio.setThreat(gap<12?clamp(1-gap/15,.18,.85):.07);
 a.rest=Math.max(0,a.rest-dt);a.stagger=Math.max(0,a.stagger-dt);
 const sees=gap<13&&lineClear(a);
 if(sees)a.lastSeen={x:player.x,z:player.z};
 const target=a.lastSeen;
 const dx=(target?.x??a.x)-a.x,dz=(target?.z??a.z)-a.z,range=Math.hypot(dx,dz);
 if(range>.1)a.yaw=Math.atan2(-dx,-dz);
 if(!sees&&range<.55)a.lastSeen=null;
 let speed=0,attack=0;
 if(a.windup>0){
  a.windup+=dt;attack=clamp(a.windup/.98,0,1);
  if(a.windup>=.47&&!a.impact){a.impact=true;if(gap<2.05&&lineClear(a))hitPlayer(a);}
  if(a.windup>=.98){a.windup=0;a.rest=.67;}
 }else if(gap<1.65&&a.rest===0&&a.stagger===0&&sees){
  a.windup=.001;a.impact=false;audio.cue('grab');
 }else if(target&&range>(sees?1.25:.55)&&a.rest===0&&a.stagger===0){
  const travel=dt*a.speed;
  const x=a.x+dx/range*travel,z=a.z+dz/range*travel;
  if(walkableBunker(a.floor,x,a.z,.46)){a.x=x;speed=a.speed;}
  if(walkableBunker(a.floor,a.x,z,.46)){a.z=z;speed=a.speed;}
 }
 a.view.group.position.set(a.x,ground(a.floor),a.z);a.view.group.rotation.y=a.yaw;
 a.view.update(dt,time,{speed,attack,stun:a.stagger,vulnerable:targetInSight(a)});
}
function move(dt){
 let x=stick.x+Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
 let z=stick.z+Number(keys.has('KeyS'))-Number(keys.has('KeyW'));
 const magnitude=Math.hypot(x,z);
 if(magnitude>1){x/=magnitude;z/=magnitude;}
 const running=sprint||keys.has('ShiftLeft')||keys.has('ShiftRight');
 const speed=(running?5.4:3.45)*dt;
 const dx=(Math.cos(player.yaw)*x+Math.sin(player.yaw)*z)*speed;
 const dz=(-Math.sin(player.yaw)*x+Math.cos(player.yaw)*z)*speed;
 const oldX=player.x,oldZ=player.z;
 if(walkableBunker(player.floor,player.x+dx,player.z))player.x+=dx;
 if(walkableBunker(player.floor,player.x,player.z+dz))player.z+=dz;
 const traveled=Math.hypot(player.x-oldX,player.z-oldZ);
 if(traveled>0&&time>lastStep){audio.footstep({surface:'stone',weight:running?1.2:1,volume:.55});lastStep=time+(running?.29:.46);}
 player.yaw+=dt*1.7*(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')));
 player.pitch=clamp(player.pitch+dt*(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'))),-1.08,1.08);
 positionCamera();
 if(traveled>0&&!settings.motion)world.camera.position.y+=Math.sin(time*(running?16:11))*.023;
 return {moving:traveled>0,running};
}
function changeText(el,value){if(el.textContent!==value)el.textContent=value;}
function paintHUD(){
 const task=current();
 if(!task)return;
 const floor=BUNKER_LEVELS[player.floor];
 changeText($('floor'),`B${player.floor+1} · ${(floor?.name||'SHELTER 17').toUpperCase()} · ${story.step+1}/${BUNKER_OBJECTIVES.length}`);
 const target=task.floor===player.floor?task:task.floor>player.floor?nextLift:returnLift;
 const gap=distance(player,target);
 changeText($('goal'),task.floor===player.floor?task.title:`Take the lift to B${task.floor+1}`);
 changeText($('detail'),task.floor===player.floor?task.detail:`Your current objective is on B${task.floor+1}.`);
 const bearing=Math.atan2(target.x-player.x,-(target.z-player.z))+player.yaw;
 $('arrow').style.transform=`rotate(${bearing}rad)`;
 changeText($('distance'),`${Math.ceil(gap)} m`);
 changeText($('health'),`HEALTH ${'●'.repeat(player.health)}${'○'.repeat(3-player.health)}`);
 const safe=Object.values(story.survivors).filter(outcome=>outcome==='sheltered').length;
 changeText($('allies'),`ALLIES SAFE ${safe}/${BUNKER_ALLIES.length}`);
 const ready=gap<2.45&&task.kind!=='threat';
 const back=player.floor>0&&distance(player,returnLift)<2.45;
 $('use').classList.toggle('ready',ready||back);
 changeText($('prompt'),ready?`USE · ${task.floor===player.floor?(task.label||task.title):'Lift'}`:back?'USE · Return lift':'');
 $('fire').hidden=player.floor===0;
 $('fire').disabled=cooldown>0;
 document.body.classList.toggle('aimed',targetInSight(threat));
 marker.position.set(target.x,ground(player.floor)+.025,target.z);marker.visible=task.floor!==player.floor||task.kind!=='threat';
}
let hudTime=0;
function tick(now){
 requestAnimationFrame(tick);
 const dt=clamp((now-frameTime)/1000,0,.05);frameTime=now;
 let movement={moving:false,running:false};
 if(mode==='hud'){
  time+=dt;cooldown=Math.max(0,cooldown-dt);flash=Math.max(0,flash-dt);hurt=Math.max(0,hurt-dt);
  if(hurt===0)document.body.classList.remove('hit');
  if(lift){
   lift.elapsed+=dt;
   if(lift.elapsed>=.42&&!lift.placed){setFloor(lift.floor);lift.placed=true;syncPeople();save();}
   if(lift.elapsed>=.74){lift=null;$('lift-fade').style.opacity='0';}
  }else if(death){
   death.time+=dt;
   const fall=clamp(death.time/1.35,0,1);
   world.camera.position.y=ground(player.floor)+1.66-1.24*fall;
   if(!settings.motion)world.camera.rotation.z=.65*fall;
   $('lift-fade').style.opacity=String(clamp((fall-.65)*2.5,0,1));
   if(death.time>1.65)finish(false,'Return to your last checkpoint and keep your distance.');
  }else{
   movement=move(dt);updateThreat(dt);
   if(subtitle<=time)$('dialogue').hidden=true;
  }
  for(const actor of creatures.values())if(actor!==deathScene)actor.view.group.visible=actor===threat&&actor.floor===player.floor;
  if(deathScene){
   deathScene.dead+=dt;
   deathScene.view.group.visible=deathScene.floor===player.floor;
   deathScene.view.update(dt,time,{death:clamp(deathScene.dead/1.7,.001,1)});
  }
  syncPeople();
  if(now-hudTime>75){paintHUD();hudTime=now;}
 }
 people.update(dt,time,{player:world.camera.position,reducedMotion:settings.motion});
 equipment.update(dt,time,{visible:mode==='hud'&&player.floor>0&&!lift&&!death,selected:'arc',effect:flash,...movement,reducedMotion:settings.motion});
 world.update(dt,time,player,{floor:player.floor,stage:current()?.id,flashlight:true,danger:!!threat});
 world.render();
}

function bind(){
 document.body.classList.toggle('touch',navigator.maxTouchPoints>0);
 $('observatory').hidden=location.protocol==='file:';
 $('sound').checked=settings.sound;$('motion').checked=settings.motion;
 $('sound').onchange=()=>{settings.sound=$('sound').checked;write(prefsKey,settings);};
 $('motion').onchange=()=>{settings.motion=$('motion').checked;write(prefsKey,settings);};
 $('start').onclick=()=>start();$('continue').onclick=()=>start(read(saveKey));
 $('retry').onclick=()=>start(read(saveKey));$('pause').onclick=pause;$('resume').onclick=resume;
 $('quit').onclick=$('end-home').onclick=showHome;
 $('decision-back').onclick=()=>{voice.stop();screen('hud');};
 $('use').onclick=use;$('fire').onclick=fire;
 $('run').onclick=()=>{sprint=!sprint;$('run').setAttribute('aria-pressed',String(sprint));};
 const pad=$('stick');
 function slide(event){
  const rect=pad.getBoundingClientRect(),radius=rect.width*.33;
  const x=(event.clientX-rect.left-rect.width/2)/radius,z=(event.clientY-rect.top-rect.height/2)/radius;
  const length=Math.max(1,Math.hypot(x,z));stick.x=x/length;stick.z=z/length;
  $('knob').style.transform=`translate(${stick.x*radius}px,${stick.z*radius}px)`;
 }
 pad.onpointerdown=e=>{if(stick.id!==null||mode!=='hud')return;stick.id=e.pointerId;pad.setPointerCapture(e.pointerId);slide(e);e.preventDefault();};
 pad.onpointermove=e=>{if(e.pointerId===stick.id)slide(e);};
 pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=e=>{if(e.pointerId===stick.id){stick.id=null;stick.x=stick.z=0;$('knob').style.transform='';}};
 const zone=$('look');
 zone.onpointerdown=e=>{if(look.id!==null||mode!=='hud'||e.button!==0)return;Object.assign(look,{id:e.pointerId,x:e.clientX,y:e.clientY,travel:0});zone.setPointerCapture(e.pointerId);e.preventDefault();};
 zone.onpointermove=e=>{if(e.pointerId!==look.id)return;const dx=e.clientX-look.x,dy=e.clientY-look.y;look.x=e.clientX;look.y=e.clientY;look.travel+=Math.hypot(dx,dy);player.yaw-=dx*.004;player.pitch=clamp(player.pitch-dy*.0037,-1.08,1.08);};
 zone.onpointerup=e=>{if(e.pointerId===look.id){look.id=null;if(e.pointerType==='mouse'&&look.travel<7)fire();}};
 zone.onpointercancel=zone.onlostpointercapture=e=>{if(e.pointerId===look.id)look.id=null;};
 addEventListener('keydown',e=>{
  if(e.code==='Escape'&&!e.repeat){if(mode==='paused')resume();else if(mode==='decision')$('decision-back').click();else pause();return;}
  if(mode!=='hud')return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='KeyE'||e.code==='Space')use();if(e.code==='KeyF')fire();
 });
 addEventListener('keyup',e=>keys.delete(e.code));
 addEventListener('blur',()=>{resetInput();pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();pause();}});
 addEventListener('resize',()=>world.resize());
}

try{
 world=createBunkerWorld($('scene'));people=createBunkerActors(world.scene);equipment=createEquipment(world.camera);
 marker=new THREE.Mesh(new THREE.RingGeometry(.49,.57,30),new THREE.MeshBasicMaterial({color:0xe8c780,transparent:true,opacity:.7,depthWrite:false}));
 marker.rotation.x=-Math.PI/2;world.scene.add(marker);marker.visible=false;
 setFloor(0);syncPeople(true);bind();showHome();world.resize();
 document.body.dataset.ready='true';requestAnimationFrame(tick);
 if(import.meta.env.DEV)window.__bunkerQA={
  state:()=>({mode,player:{...player},story:bunkerCheckpoint(story),objective:current()?.id,threat:threat&&{x:threat.x,z:threat.z,hp:threat.hp}}),
  place(x,z,yaw=0){player.x=x;player.z=z;player.yaw=yaw;positionCamera();paintHUD();},
 };
}catch(error){console.error(error);$('home').hidden=true;$('fatal').hidden=false;}

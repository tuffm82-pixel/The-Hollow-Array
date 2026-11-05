import './style.css';
import './expanded.css';
import './chapter.css';
import * as THREE from 'three';
import {createWorld,isWalkable} from './world.js';
import {createMonster} from './catalogue-creatures.js';
import {createAudio} from './audio.js';
import {createCampaign} from './campaign.js';
import {nextWaypoint} from './navigation.js';
import {STAGES,STATIONS,LOCKERS,CREATURES,ARENAS,ZONES,checkpointSpawn} from './layout.js';
import {perceive} from './perception.js';
import {createTasks} from './tasks.js';
import {createVoice} from './voice.js';
import {createToolState,updateTools,fireTool,isVulnerable,selectTool as chooseTool,ARC_AIM_ANGLE,toolReach,createArenaState,armArena,updateArena} from './combat.js';
import {createFinale} from './finale.js';
import {createEquipment} from './equipment.js';

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const storage={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const prefs={sound:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,sensitivity:1,brightness:1.1,quality:'high',...storage.get('hollow-settings',{})};
const audio=createAudio();
const voice=createVoice();
const tasks=createTasks({onComplete:(id,choice)=>completeStation(id,{choice}),onNoise:()=>{player.noiseTime=gameTime;player.noisyTask=true;audio.cue('alarm');}});
let world,monster,actors=[],tools=createToolState(),campaign=createCampaign(),mode='home',settingsReturn='home',gameTime=0,subtitleUntil=0,grace=0,stepTime=0,scareCooldown=0,endingTime=0;
let attack=null,hands=null,equipment=null,lastTransmission='',nextScare=35,finale=null,finaleCompleted=false,finaleVoice=false;
let lastFrame=performance.now(),lastUi=0,runToggle=false,stamina=1,exhausted=false,fireInput=null,nearest=null;
let arenaState=createArenaState();
const player={x:0,z:4,yaw:0,pitch:0,moving:false,running:false,hidden:false,noiseTime:-1,noisyTask:false};
let enemy={x:0,z:-39,alert:0,lastKnown:{x:0,z:0},seenHiding:false,speed:0};
const lockers=LOCKERS;
const patrol=[{x:0,z:-91},{x:0,z:-47},{x:0,z:-12},{x:0,z:-70},{x:0,z:-32}];
const keys=new Set(),stick={x:0,y:0,id:null},look={id:null,x:0,y:0,travel:0};
document.body.classList.toggle('touch',navigator.maxTouchPoints>0);
function showScreen(name){for(const id of ['home','hud','pause-screen','settings','ending'])$(id).hidden=id!==name;}
function say(message,duration=8,spoken=true){$('subtitle').querySelector('p').textContent=message;subtitleUntil=gameTime+duration;$('subtitle').style.opacity=1;if(spoken){lastTransmission=message;voice.speak(message,{speaker:/^(MIMIC|STATION RADIO|THE NULL CANTOR)/.test(message)?'mimic':'radio'});}}
function cancelFire(){fireInput=null;tools.held=false;tools.charge=0;}
function resetInput(){keys.clear();stick.x=stick.y=0;stick.id=null;look.id=null;runToggle=false;cancelFire();$('joystick-knob').style.transform='';$('sprint').setAttribute('aria-pressed','false');}
function save(){storage.set('hollow-checkpoint',{version:1,chapter:campaign.state.checkpoint});$('continue-game').hidden=false;}
function applyPreferences(){audio.setMuted(!prefs.sound);voice.setEnabled(prefs.sound);if(world){world.setQuality?.(prefs.quality);}storage.set('hollow-settings',prefs);}
function home(){mode='home';resetInput();tasks.close();voice.stop();player.hidden=false;attack=null;if(hands)hands.visible=false;$('death-shade').style.opacity=0;document.body.classList.remove('hidden-player','hit');showScreen('home');audio.setThreat(0);$('continue-game').hidden=!storage.get('hollow-checkpoint',null);for(const a of actors)a.view.group.visible=false;$('cliffhanger').hidden=true;}
function begin(checkpoint=0){
 campaign=createCampaign(checkpoint);gameTime=0;grace=15;scareCooldown=15;stamina=1;exhausted=false;stepTime=0;endingTime=0;attack=null;nextScare=35;finaleCompleted=false;finaleVoice=false;tasks.close();if(hands)hands.visible=false;$('death-shade').style.opacity=0;
 arenaState=createArenaState();
 Object.assign(player,checkpointSpawn(campaign.state.chapter),{pitch:0,hidden:false,moving:false,running:false,noiseTime:-1,noisyTask:false,health:3,hurtUntil:0});
 tools=createToolState(campaign.state.inventory);
 for(const a of actors){const data=CREATURES[a.type];Object.assign(a,{x:data.spawn.x,z:data.spawn.z,hp:campaign.state.defeated.includes(a.type)?0:data.health,cycle:0,frozen:0,revealed:0,arenaBroken:false,arenaWindow:0,echo:false,deathTime:campaign.state.defeated.includes(a.type)?3:0,alert:0,visual:false,seenHiding:false,speed:0,stride:0,lastNoise:-1,lastKnown:{...data.home}});a.view.group.position.set(a.x,0,a.z);a.view.group.rotation.y=0;a.view.group.visible=false;}
 if(campaign.state.objective.id==='exit')startLiftPursuit();
 enemy=actors[0];monster=enemy.view;
 resetInput();document.body.classList.remove('hidden-player','hit');mode='playing';showScreen('hud');audio.start();audio.setMuted(!prefs.sound);voice.setEnabled(prefs.sound);voice.resume();voice.unlock();audio.resume();say(campaign.state.message,12);save();updateHUD();
}
function pause(){if(mode!=='playing')return;mode='paused';resetInput();tasks.key('Space',false);tasks.setVisible(false);showScreen('pause-screen');audio.suspend();voice.pause();}
function resume(){if(mode!=='paused')return;mode='playing';showScreen('hud');tasks.setVisible(true);audio.resume();voice.resume();lastFrame=performance.now();}
function settings(){settingsReturn=mode;mode='settings';resetInput();showScreen('settings');audio.suspend();voice.pause();}
function finish(){if(mode==='ending')return;if(campaign.state.phase==='won'&&!finaleCompleted){mode='cinematic';resetInput();tasks.close();showScreen('');voice.stop();finale.start();$('skip-film').hidden=false;return;}$('skip-film').hidden=true;mode='ending';resetInput();tasks.close();const won=campaign.state.phase==='won';$('end-label').textContent=won?'CHAPTER ONE COMPLETE':'EXPEDITION SIGNAL LOST';$('end-title').textContent=won?'The Undersky is waiting.':'It found you.';$('end-copy').textContent=campaign.state.message;$('retry').hidden=won;showScreen('ending');audio.setThreat(0);if(won){$('cliffhanger').hidden=false;audio.cue('scare');voice.speak(campaign.state.message,{interrupt:true});}}
function caught(reason,creature=true){if(campaign.state.phase!=='playing')return;campaign.die(reason);startDeath(creature);}
function startDeath(creature){endingTime=3.4;const dx=monster.group.position.x-player.x,dz=monster.group.position.z-player.z;attack={time:0,creature,origin:world.camera.position.clone(),yaw:creature?Math.atan2(-dx,-dz):world.camera.rotation.y,enemyOrigin:monster.group.position.clone(),grab:false,drag:false};tasks.close();voice.stop();document.body.classList.add('hit');audio.cue('death');resetInput();tools.held=false;}
function updateDeath(dt){
 if(!attack)return;attack.time+=dt;const p=clamp(attack.time/3.4,0,1),fall=clamp((p-.3)/.7,0,1),yaw=attack.yaw;
 if(attack.creature){monster.group.visible=true;const facing=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),target=attack.origin.clone().addScaledVector(facing,.85);target.y=0;monster.group.position.lerpVectors(attack.enemyOrigin,target,clamp(p/.2,0,1));monster.group.rotation.y=yaw+Math.PI;monster.update(dt,gameTime,{attack:p,stun:0});}
 world.camera.position.copy(attack.origin);world.camera.position.y=attack.origin.y-(attack.origin.y-.32)*fall*fall;
 const shake=prefs.reducedMotion?0:Math.sin(attack.time*37)*(1-p)*.017;
 world.camera.rotation.set((attack.creature?.35:-.3)*Math.sin(p*Math.PI)+fall*.35,yaw+shake,prefs.reducedMotion?0:fall*.8,'YXZ');
 if(hands){hands.visible=attack.creature&&p>.08&&p<.88;hands.position.y=-.1-fall*.45;hands.rotation.x=-Math.sin(p*Math.PI)*.5;}
 if(attack.creature&&p>.2&&!attack.grab){audio.cue('grab');attack.grab=true;}if(attack.creature&&p>.6&&!attack.drag){audio.cue('drag');attack.drag=true;}$('death-shade').style.opacity=String(clamp((p-.68)/.32,0,1));
 if(p>=1)finish();
}
function use(){
 if(mode!=='playing'||campaign.state.phase!=='playing')return;
 if(tasks.active)return;
 if(player.hidden){hide();return;}
 if(!nearest){say('Move closer to a marked station, then tap USE.',4,false);return;}
 const stage=STAGES[campaign.state.chapter];
 if(stage.id==='exit'&&nearest.id==='exit'&&campaign.state.extractionRemaining<=0){
  tasks.open({id:'exit',puzzle:'decision'});resetInput();return;
 }
 if(stage.combat&&nearest.id===stage.id){
  const a=actors.find(actor=>actor.type===stage.combat);
  const arena=ARENAS[stage.combat];
  if(armArena(arenaState)){
   grace=0;a.alert=18;a.lastKnown={x:player.x,z:player.z};a.cycle=0;
   audio.cue('alarm');
   say(arena.kind==='lure'?'The buzzer is drawing it onto the grate. Keep your weapon trained on the grate.':arena.kind==='spray'?'Coolant flowing. Let it see you, then circle a planter and cross the marked tiles.':'Floodlight on. Draw the Cantor into the beam, then get behind the telescope.',9,false);
  }else say(arenaState.armed?'Already active. Watch the marked area.':'The equipment is resetting.',3,false);
  updateHUD();return;
 }
 if(nearest.id===stage.id&&stage.puzzle){tasks.open({...stage,index:campaign.state.chapter});resetInput();return;}
 completeStation(nearest.id);
}
function startLiftPursuit(){
 const echo=actors.find(a=>a.type==='cantor');
 Object.assign(echo,{echo:true,x:-8,z:-72,hp:1,deathTime:0,cycle:0,frozen:0,revealed:0,arenaBroken:false,arenaWindow:0,alert:18,lastKnown:{x:player.x,z:player.z}});
 echo.view.group.position.set(echo.x,0,echo.z);
 grace=1.6;
}
function completeStation(id,{combatWon=false,choice}={}){
 const result=campaign.interact(id,{combatWon,choice});if(result.ok)voice.stop();say(result.message,15,result.ok);if(result.cue)audio.cue(result.cue);
 if(!result.ok)return;
 arenaState=createArenaState();
 save();
 tools.inventory=[...campaign.state.inventory];if(!tools.inventory.includes(tools.selected))tools.selected=tools.inventory[0]||'arc';
 if(STAGES[campaign.state.chapter]?.combat)grace=5;
 if(result.event==='power-online'){grace=10;audio.cue('scare');}
 if(result.event==='black-box'){scareCooldown=0;}
 if(result.event==='extraction-started')startLiftPursuit();
 if(campaign.state.phase==='won')finish();updateHUD();
}
function hide(){
 if(mode!=='playing'||campaign.state.phase!=='playing')return;
 if(player.hidden){player.hidden=false;for(const a of actors)a.seenHiding=false;document.body.classList.remove('hidden-player');say('You step out. Walk quietly.',3,false);}
 else if(lockers.some(p=>dist(p,player)<2.3)){tasks.close();cancelFire();player.hidden=true;for(const a of actors)a.seenHiding=a.hp>0&&a.visual&&dist(a,player)<8&&lineOfSight(a,player);runToggle=false;document.body.classList.add('hidden-player');say(actors.some(a=>a.seenHiding)?'It saw you get in. This locker will not save you.':'Stay still. Let the footsteps pass.',5,false);}
 else say('Find a tall locker beside the main passage to hide.',4,false);
 $('hide').setAttribute('aria-pressed',String(player.hidden));
}
function walkable(x,z){return isWalkable(x,z,.28);}
function lineOfSight(a,b){return world.hasLineOfSight(a,b);}
function updateEnemy(dt){
 let nearestActor=null,nearestDistance=Infinity,threat=.03;
 for(const a of actors){
  const intro=STAGES.findIndex(s=>s.combat===a.type);a.view.group.visible=campaign.state.chapter>=intro;if(!a.view.group.visible)continue;
  if(a.echo&&tasks.id==='exit'){a.visual=false;continue;}
  if(a.hp<=0){a.deathTime+=dt;a.view.update(dt,gameTime,{death:clamp(a.deathTime/2.5,0,1)});continue;}
  a.frozen=Math.max(0,a.frozen-dt);a.revealed=Math.max(0,a.revealed-dt);
  const arena=ARENAS[a.type],current=STAGES[campaign.state.chapter]?.combat===a.type;
  if(current){
   const event=updateArena(arena,arenaState,a,dt);
   if(event==='triggered'){audio.cue(arena.kind==='spray'?'cryo':'arc');say('Armour open. Aim at the body and tap FIRE.',5,false);}
   if(event==='expired')say('The equipment timed out. Reset it at the marked panel.',4,false);
  }
  const distance=dist(a,player),eye={x:a.x,y:CREATURES[a.type].weakHeight+.45,z:a.z};
  const clear=lineOfSight(eye,{...player,y:world.camera.position.y});
  const sense=perceive(a,player,{yaw:a.view.group.rotation.y,clear,noiseFresh:a.lastNoise!==player.noiseTime});a.visual=sense.visible;a.lastNoise=player.noiseTime;
  if(distance<nearestDistance){nearestActor=a;nearestDistance=distance;}
  if(grace>0){a.view.group.position.set(a.x,0,a.z);a.view.update(dt,gameTime);continue;}
  if(sense.visible){a.alert=7;a.lastKnown=sense.target;}else if(sense.heard){a.alert=4;a.lastKnown=sense.target;}else a.alert=Math.max(0,a.alert-dt);
  const previous=a.cycle;if(a.alert>0)a.cycle=(a.cycle+dt)%6.5;else a.cycle=0;
  if(previous<1.3&&a.cycle>=1.3)a.lungeTarget={...a.lastKnown};
  const lured=current&&arena.kind==='lure'&&arenaState.armed>0;
  const rush=!lured&&a.cycle>=1.3&&a.cycle<2.3,recovery=a.cycle>=2.3&&a.cycle<4.9;
  const destination=lured?arena.hazard:a.alert>0?(rush?a.lungeTarget||a.lastKnown:a.lastKnown):CREATURES[a.type].home;
  const room=ZONES.find(zone=>zone.id===arena.zone);
  const target={x:clamp(destination.x,room.minX+.65,room.maxX-.65),z:clamp(destination.z,room.minZ+.65,room.maxZ-.65)};
  const next=nextWaypoint(a,target),dx=next.x-a.x,dz=next.z-a.z,d=Math.hypot(dx,dz);
  const oldX=a.x,oldZ=a.z;
  a.speed=d>.08?(lured?3:a.alert>0?(rush?CREATURES[a.type].speed*1.75:recovery?.75:1.35):.8):0;
  if(a.frozen>0)a.speed*=a.arenaWindow>3.5?0:.12;
  if(d>.08){const step=Math.min(d,a.speed*dt),nx=a.x+dx/d*step,nz=a.z+dz/d*step;if(walkable(nx,a.z))a.x=nx;if(walkable(a.x,nz))a.z=nz;const angle=Math.atan2(-dx,-dz),diff=Math.atan2(Math.sin(angle-a.view.group.rotation.y),Math.cos(angle-a.view.group.rotation.y));a.view.group.rotation.y+=diff*Math.min(1,dt*5);}
  const travel=Math.hypot(a.x-oldX,a.z-oldZ);
  a.speed=dt>0?travel/dt:0;
  a.stride+=travel;
  if(a.stride>= (rush?1.05:.62)){
   a.stride=0;
   if(distance<16){
    const pan=((a.x-player.x)*Math.cos(player.yaw)-(a.z-player.z)*Math.sin(player.yaw))/Math.max(1,distance);
    audio.footstep({surface:'stone',weight:1.5,volume:(1-distance/16)**2*(clear?.8:.38),pan,muffled:!clear});
   }
  }
  a.view.group.position.set(a.x,0,a.z);a.view.update(dt,gameTime,{speed:a.speed,attack:rush?clamp((a.cycle-1.3),.001,.999):0,stun:a.frozen>0?1:0,vulnerable:isVulnerable(a)});
  if(distance<(a.type==='cantor'?1.45:1.2)&&rush&&a.frozen<=0&&clear&&(!player.hidden||a.seenHiding)&&gameTime>player.hurtUntil){player.health--;player.hurtUntil=gameTime+2;audio.cue('grab');if(player.health<=0){enemy=a;monster=a.view;caught(`${CREATURES[a.type].name} takes hold of your expedition suit.`);return 1;}say('Hit. Break its sight behind cover during the wind-up.',4,false);}
  threat=Math.max(threat,a.visual?clamp(1-distance/24,.1,1):a.alert>0?.2:.04);
 }
 if(nearestActor){enemy=nearestActor;monster=nearestActor.view;}return threat;
}
function selectTool(id){if(mode!=='playing'||tasks.active||id===tools.selected||!tools.inventory.includes(id))return;cancelFire();chooseTool(tools,id);audio.cue('interact');updateHUD();}
function beginFire(input){
 if(fireInput!==null||mode!=='playing'||campaign.state.phase!=='playing'||tasks.active||player.hidden||!tools.inventory.includes(tools.selected))return false;
 fireInput=input;tools.held=true;return true;
}
function endFire(input,shouldFire){
 if(fireInput!==input)return;
 if(shouldFire){fireInput=null;releaseTool();}else cancelFire();
}
function findAimTarget(){
 let target=null,best=Infinity,options={};
 const origin=world.camera.position;
 for(const a of actors){
  if(a.hp<=0||!a.view.group.visible)continue;
  const horizontal=Math.hypot(a.x-origin.x,a.z-origin.z),height=CREATURES[a.type].height;
  const bodyY=clamp(origin.y+Math.tan(player.pitch)*horizontal,height*.32,height*.78);
  const weak={x:a.x,y:bodyY,z:a.z};
  if(!lineOfSight(origin,weak))continue;
  const dx=weak.x-origin.x,dz=weak.z-origin.z,dy=weak.y-origin.y,distance=Math.hypot(dx,dy,dz);
  if(distance>toolReach(tools.selected))continue;
  const cp=Math.cos(player.pitch),dot=distance>0?(dx*(-Math.sin(player.yaw)*cp)+dy*Math.sin(player.pitch)+dz*(-Math.cos(player.yaw)*cp))/distance:1;
  const aimError=Math.acos(clamp(dot,-1,1));
  if(aimError<best){best=aimError;target=a;options={visible:true,distance,aimError};}
 }
 return{target,options};
}
function releaseTool(){
 if(mode!=='playing'||campaign.state.phase!=='playing'||tasks.active||player.hidden){cancelFire();return;}
 const {target,options}=findAimTarget();
 const result=fireTool(tools,target,options);
 say(target?.echo&&result.event==='armour'?'The copy shrugs off the shot. Slow it with CRYO or break sight behind the telescope.':result.message,5,false);
 if(result.used){audio.cue(tools.selected);player.noiseTime=gameTime;player.noisyTask=true;if(target&&options.visible){target.alert=7;target.lastKnown={x:player.x,z:player.z};}}
 if(result.event==='defeat'){target.deathTime=0;const stage=STAGES[campaign.state.chapter];if(stage.combat===target.type)completeStation(stage.id,{combatWon:true});}updateHUD();
}
function move(dt){
 let x=stick.x+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),y=stick.y+(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);
 const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
 if(exhausted&&stamina>=.23)exhausted=false;
 const sprinting=!exhausted&&(runToggle||keys.has('ShiftLeft')||keys.has('ShiftRight'));
 const speed=sprinting?4.1:2.45,oldX=player.x,oldZ=player.z;
 if(len>.1&&!player.hidden){
  const dx=(Math.cos(player.yaw)*x+Math.sin(player.yaw)*y)*speed*dt;
  const dz=(-Math.sin(player.yaw)*x+Math.cos(player.yaw)*y)*speed*dt;
  if(walkable(player.x+dx,player.z))player.x+=dx;
  if(walkable(player.x,player.z+dz))player.z+=dz;
 }
 const travel=Math.hypot(player.x-oldX,player.z-oldZ);
 player.moving=travel>.0001;player.running=player.moving&&sprinting;
 stamina=clamp(stamina+(player.running?-.14:.12)*dt,0,1);
 if(stamina===0){exhausted=true;runToggle=false;}
 if(player.moving){
  stepTime-=travel;
  if(stepTime<=0){
   const surface=Math.abs(player.x)<8&&Math.abs(player.z)<8?'wood':player.z<-42&&player.z>-56&&player.x<-3?'stone':'tile';
   audio.footstep({surface,weight:player.running?1.2:1,volume:player.running?1:.67});
   player.noiseTime=gameTime;player.noisyTask=false;stepTime=player.running?1.28:1.15;
  }
 }
 if(keys.has('ArrowLeft'))player.yaw+=dt*1.65;if(keys.has('ArrowRight'))player.yaw-=dt*1.65;
 if(keys.has('ArrowUp'))player.pitch=clamp(player.pitch+dt,-1.2,1.2);if(keys.has('ArrowDown'))player.pitch=clamp(player.pitch-dt,-1.2,1.2);
 const bob=prefs.reducedMotion?0:player.moving?Math.sin(gameTime*(player.running?13:9))*.025:Math.sin(gameTime*1.5)*.004;
 world.camera.position.set(player.x,(player.hidden?1.18:1.68)+bob,player.z);world.camera.rotation.set(player.pitch,player.yaw,prefs.reducedMotion?0:player.running?Math.sin(gameTime*6)*.009:0,'YXZ');
}
function updateHUD(){
 const state=campaign.state,objective=world.interactables.find(p=>p.id===state.objective.id);
 $('chapter').textContent=`${String(state.chapter+1).padStart(2,'0')} / ${STAGES.length} OPERATIONS`;$('objective').textContent=state.objective.title.replace(/^\d+ \/ /,'');$('objective-detail').textContent=state.objective.description;
 const arena=ARENAS[state.objective.combat],current=arena?actors.find(a=>a.type===state.objective.combat):null;
 const aiming=mode==='playing'&&current&&tools.inventory.includes(tools.selected)?findAimTarget():null;
 const aimed=aiming?.target===current&&aiming.options.aimError<=(tools.selected==='arc'?ARC_AIM_ANGLE:.65);
 const open=current&&isVulnerable(current);
 document.body.classList.toggle('shot-lined-up',Boolean(aimed&&open&&tools.selected==='arc'&&!tools.cooldown));
 if(arena){
  if(open)$('objective-detail').textContent='Armour open. Aim at the body and tap FIRE.';
  else if(arenaState.armed>0)$('objective-detail').textContent=arena.kind==='lure'?'Keep your distance. Watch the live grate.':'Let it follow you across the marked area, then step out of its path.';
  else if(arenaState.cooldown>0)$('objective-detail').textContent='The room device is resetting. Move behind cover.';
 }
 const sec=Math.ceil(state.remaining);$('timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
 if(objective){
  const marker=arena&&arenaState.armed?arena.hazard:objective.position;
  const target=nextWaypoint(player,marker),angle=Math.atan2(target.x-player.x,-(target.z-player.z))+player.yaw;
  $('direction').style.transform=`rotate(${angle}rad)`;
  $('distance').textContent=`${arena&&arenaState.armed?'Marked hazard':objective.label} · ${Math.ceil(dist(player,marker))} M`;
 }
 nearest=world.interactables.find(p=>p.id===state.objective.id&&dist(p.position,player)<2.5)||world.interactables.find(p=>dist(p.position,player)<2.5)||null;
 $('interact').classList.toggle('near',!!nearest);$('context-hint').textContent=player.hidden?'HIDDEN · TAP HIDE TO LEAVE':nearest?`USE · ${nearest.label}`:'';
 $('sprint').setAttribute('aria-pressed',String(player.running));$('sprint').textContent=stamina<.15?'TIRED':'RUN';$('hide').setAttribute('aria-pressed',String(player.hidden));
 const ready=!tools.cooldown&&tools.inventory.includes(tools.selected);
 $('tool-charge').style.width=ready?'100%':'0%';
 $('fire-label').textContent=ready?'FIRE':tools.cooldown?'RESET':'FIRE';
 for(const b of document.querySelectorAll('#tool-bar button')){b.disabled=!tools.inventory.includes(b.dataset.tool);b.classList.toggle('selected',b.dataset.tool===tools.selected);}
 $('creature-status').textContent=current&&dist(current,player)<24?`${CREATURES[current.type].name} · ${current.hp}/${CREATURES[current.type].health} · ${open?'EXPOSED':current.arenaBroken?'ARMOURED':'SEALED'}`:'';
 $('health').textContent=`HEALTH ${'●'.repeat(player.health||0)}${'○'.repeat(3-(player.health||0))}`;
 $('danger-text').textContent=state.extractionRemaining>0?`LIFT ${Math.ceil(state.extractionRemaining)} S`:enemy.visual?'IT SEES YOU':enemy.alert>0?'SEARCHING':'STORM RESERVE';$('threat-fill').style.width=`${Math.round(state.threat*100)}%`;
}
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(!world)return;
 if(mode==='home'){for(const a of actors)a.view.group.visible=false;world.camera.position.set(1.3,1.68,6);world.camera.rotation.set(-.025,Math.sin(now*.00008)*.13,0,'YXZ');monster.group.visible=false;world.update(dt,now/1000,player,{brightness:prefs.brightness,flashlight:true});}
 if(mode==='cinematic'){finale.update(dt);if(finale.time>5.5&&!finaleVoice){finaleVoice=true;audio.cue('scare');voice.speak(campaign.state.choice==='cut'?'Keep the light on.':'Where did you leave your gloves?',{speaker:campaign.state.choice==='cut'?'radio':'mimic',interrupt:true});}finale.render();if(finale.done){finaleCompleted=true;finish();}return;}
 if(mode==='playing'){
  gameTime+=dt;updateTools(tools,dt);grace=Math.max(0,grace-dt);scareCooldown-=dt;
  if(campaign.state.phase==='playing'){
   move(dt);if(tasks.active){const station=STATIONS.find(p=>p.id===tasks.id);if(!station||dist(station.position,player)>3)tasks.close();else tasks.update(dt);}
   const event=tasks.id==='exit'?null:campaign.update(dt,player);if(event){say(event.message,12);if(event.cue&&event.event!=='death')audio.cue(event.cue);}
   if(campaign.state.phase==='playing'){const proximity=updateEnemy(dt);audio.setThreat(Math.max(proximity,campaign.state.threat*.5));document.documentElement.style.setProperty('--danger',proximity.toFixed(2));}
   else if(campaign.state.phase==='dead'&&!attack)startDeath(false);
   if(gameTime>nextScare&&campaign.state.chapter>=2){audio.cue('whisper');nextScare=gameTime+45+campaign.state.chapter*7;}
  }
  else if(campaign.state.phase==='dead')updateDeath(dt);
  $('subtitle').style.opacity=gameTime<subtitleUntil?1:0;
  world.update(dt,gameTime,player,{...campaign.state,arenaType:campaign.state.objective.combat,arenaArmed:arenaState.armed,arenaCooldown:arenaState.cooldown,brightness:prefs.brightness,flashlight:!player.hidden});
  if(now-lastUi>100){updateHUD();lastUi=now;}
 }
 equipment??=createEquipment(world.camera);equipment.update(dt,gameTime,{visible:mode==='playing'&&campaign.state.phase==='playing'&&campaign.state.inventory.includes(tools.selected)&&!player.hidden,selected:tools.selected,charge:tools.charge,effect:tools.effect,moving:player.moving,running:player.running,reducedMotion:prefs.reducedMotion});
 world.render();
}
function bind(){
 $('new-game').onclick=()=>begin(0);$('continue-game').onclick=()=>{const saved=storage.get('hollow-checkpoint',{});begin(saved.version===1?saved.chapter:0);};$('pause').onclick=pause;$('resume').onclick=resume;$('quit').onclick=home;$('end-home').onclick=home;$('retry').onclick=()=>begin(campaign.state.checkpoint);$('home-settings').onclick=settings;$('pause-settings').onclick=settings;
 $('close-settings').onclick=()=>{mode=settingsReturn;showScreen(mode==='home'?'home':'pause-screen');applyPreferences();};$('interact').onclick=use;$('hide').onclick=hide;$('sprint').onclick=()=>{runToggle=!runToggle;};
 for(const [id,key] of [['sound','sound'],['reduced-motion','reducedMotion'],['sensitivity','sensitivity'],['brightness','brightness'],['quality','quality']]){const el=$(id);if(el.type==='checkbox')el.checked=prefs[key];else el.value=prefs[key];el.oninput=()=>{prefs[key]=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;applyPreferences();};}
 const joystick=$('joystick');function stickMove(e){const rect=joystick.getBoundingClientRect(),radius=rect.width*.36;let x=(e.clientX-rect.left-rect.width/2)/radius,y=(e.clientY-rect.top-rect.height/2)/radius;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}stick.x=x;stick.y=y;$('joystick-knob').style.transform=`translate(${x*radius}px,${y*radius}px)`;}
 joystick.onpointerdown=e=>{if(mode!=='playing'||stick.id!==null)return;stick.id=e.pointerId;joystick.setPointerCapture(e.pointerId);stickMove(e);e.preventDefault();};joystick.onpointermove=e=>{if(e.pointerId===stick.id)stickMove(e);};function releaseStick(e){if(e.pointerId!==stick.id)return;stick.id=null;stick.x=stick.y=0;$('joystick-knob').style.transform='';}joystick.onpointerup=releaseStick;joystick.onpointercancel=releaseStick;joystick.onlostpointercapture=releaseStick;
 const zone=$('look-zone');
 zone.onpointerdown=e=>{if(mode!=='playing'||look.id!==null||e.button!==0)return;look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;look.travel=0;zone.setPointerCapture(e.pointerId);e.preventDefault();};
 zone.onpointermove=e=>{
  if(e.pointerId!==look.id||mode!=='playing')return;
  const dx=e.clientX-look.x,dy=e.clientY-look.y;look.travel+=Math.hypot(dx,dy);
  player.yaw-=dx*.004*prefs.sensitivity;player.pitch=clamp(player.pitch-dy*.0035*prefs.sensitivity,-1.2,1.2);
  look.x=e.clientX;look.y=e.clientY;
 };
 zone.onpointerup=e=>{
  if(e.pointerId!==look.id)return;
  look.id=null;
  if(e.pointerType==='mouse'&&look.travel<7&&beginFire('aim-click'))endFire('aim-click',true);
 };
 zone.onpointercancel=zone.onlostpointercapture=e=>{if(e.pointerId===look.id)look.id=null;};
 addEventListener('keydown',e=>{if(e.code==='Escape'){if(mode==='playing')pause();else if(mode==='paused')resume();return;}if(mode!=='playing')return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(tasks.key(e.code,true))return;keys.add(e.code);if(!e.repeat){if(e.code==='KeyE'||e.code==='Space')use();if(e.code==='KeyH')hide();}});addEventListener('keyup',e=>{keys.delete(e.code);tasks.key(e.code,false);});addEventListener('blur',()=>{resetInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();pause();audio.suspend();voice.pause();}});addEventListener('resize',()=>world?.resize());$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('fatal').hidden=false;});
}
const shade=document.createElement('div');shade.id='death-shade';document.body.append(shade);
const combatHud=document.createElement('div');combatHud.id='combat-hud';combatHud.innerHTML='<div id="health">HEALTH ●●●</div><div id="creature-status"></div><div id="tool-bar"><button data-tool="arc">ARC</button><button data-tool="sonar">ECHO</button><button data-tool="cryo">CRYO</button></div><button id="fire" aria-label="Use selected tool"><span id="fire-label">FIRE</span><span class="charge-track"><i id="tool-charge"></i></span></button>';$('hud').append(combatHud);
for(const b of combatHud.querySelectorAll('[data-tool]'))b.onclick=()=>selectTool(b.dataset.tool);
const fireButton=$('fire');
fireButton.onpointerdown=e=>{if(e.button!==0||!beginFire(e.pointerId))return;fireButton.setPointerCapture(e.pointerId);e.preventDefault();};
fireButton.onpointerup=e=>endFire(e.pointerId,true);
fireButton.onpointercancel=fireButton.onlostpointercapture=e=>endFire(e.pointerId,false);
addEventListener('keydown',e=>{if(mode!=='playing'||tasks.active)return;if(e.code==='KeyF'&&!e.repeat&&beginFire('keyboard'))e.preventDefault();if(e.code==='Digit1')selectTool('arc');if(e.code==='Digit2')selectTool('sonar');if(e.code==='Digit3')selectTool('cryo');});
addEventListener('keyup',e=>{if(e.code==='KeyF')endFire('keyboard',true);});
const cliff=document.createElement('div');cliff.id='cliffhanger';cliff.hidden=true;cliff.textContent='CHAPTER TWO — THE UNDERSKY · TO BE CONTINUED';$('ending').append(cliff);
const skip=document.createElement('button');skip.id='skip-film';skip.className='secondary';skip.textContent='SKIP DESCENT';skip.hidden=true;skip.onclick=()=>finale?.skip();document.body.append(skip);
const replay=document.createElement('button');replay.id='radio-replay';replay.textContent='↻ REPLAY RADIO';replay.onclick=()=>{voice.unlock();voice.speak(lastTransmission||campaign.state.message,{interrupt:true});subtitleUntil=gameTime+12;};$('hud').append(replay);
// This driver is eliminated from production bundles; it exercises real UI flows
// without walking the entire station between independent browser checks.
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa'))window.__hollowQA={
 begin,place(x,z,yaw=0,pitch=0){Object.assign(player,{x,z,yaw,pitch});resetInput();updateHUD();},
 pose(type,x,z,cycle=3){const a=actors.find(a=>a.type===type);Object.assign(a,{x,z,cycle,alert:8,frozen:0,revealed:0,lastKnown:{x:player.x,z:player.z}});a.view.group.position.set(x,0,z);a.view.group.rotation.y=Math.atan2(-(player.x-x),-(player.z-z));grace=0;},
 enemy(x,z,yaw=0){Object.assign(enemy,{x,z,alert:0,lastNoise:player.noiseTime,lastKnown:{x,z},seenHiding:false});monster.group.position.set(x,0,z);monster.group.rotation.y=yaw;grace=0;},
 attack(){monster.group.position.set(player.x-Math.sin(player.yaw),0,player.z-Math.cos(player.yaw));caught('The creature takes hold of your expedition suit.');}
};
function makeHands(){const group=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:'#394c50',roughness:.7});for(const side of [-1,1]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.25,4,8),mat);arm.position.set(side*.24,-.22,-.43);arm.rotation.set(-.9,0,side*-.35);const palm=new THREE.Mesh(new THREE.BoxGeometry(.10,.14,.055),mat);palm.position.set(side*.2,-.06,-.56);palm.rotation.x=-.5;group.add(arm,palm);}group.visible=false;world.camera.add(group);return group;}
try{world=createWorld($('scene'),{quality:prefs.quality});actors=Object.keys(CREATURES).map(type=>{const view=createMonster(type);world.scene.add(view.group);view.group.visible=false;return{type,view,...CREATURES[type].spawn,hp:CREATURES[type].health,cycle:0,frozen:0,revealed:0,deathTime:0};});enemy=actors[0];monster=enemy.view;hands=makeHands();finale=createFinale(world.renderer,{reducedMotion:prefs.reducedMotion});bind();applyPreferences();home();world.resize();requestAnimationFrame(frame);document.body.dataset.ready='true';if(import.meta.env.DEV)window.__hollowInspect=()=>({mode,player:{...player},enemy:{...enemy},campaign:campaign.snapshot(),tools:{...tools},monsters:actors.map(a=>({type:a.type,x:a.x,z:a.z,hp:a.hp,cycle:a.cycle,frozen:a.frozen,revealed:a.revealed,arenaBroken:a.arenaBroken,arenaWindow:a.arenaWindow,visible:a.view.group.visible})),task:tasks.state?{...tasks.state}:null,attack:attack?{time:attack.time,creature:attack.creature}:null,camera:{y:world.camera.position.y,roll:world.camera.rotation.z},drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles});}catch(error){console.error(error);$('fatal').hidden=false;}




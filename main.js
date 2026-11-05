import './style.css';
import './expanded.css';
import './chapter.css';
import * as THREE from 'three';
import {createWorld,isWalkable} from './world.js';
import {createMonster} from './catalogue-creatures.js';
import {createAudio} from './audio.js';
import {createCampaign} from './campaign.js';
import {nextWaypoint} from './navigation.js';
import {STAGES,STATIONS,LOCKERS,CREATURES,checkpointSpawn} from './layout.js';
import {perceive} from './perception.js';
import {createTasks} from './tasks.js';
import {createVoice} from './voice.js';
import {createToolState,updateTools,fireTool,isVulnerable,selectTool as chooseTool} from './combat.js';
import {createFinale} from './finale.js';
import {createEquipment} from './equipment.js';

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const storage={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const prefs={sound:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,sensitivity:1,brightness:1.1,quality:'high',...storage.get('hollow-settings',{})};
const audio=createAudio();
const voice=createVoice();
const tasks=createTasks({onComplete:id=>completeStation(id),onNoise:()=>{player.noiseTime=gameTime;player.noisyTask=true;audio.cue('alarm');}});
let world,monster,actors=[],tools=createToolState(),campaign=createCampaign(),mode='home',settingsReturn='home',gameTime=0,subtitleUntil=0,grace=0,stepTime=0,scareCooldown=0,endingTime=0;
let attack=null,hands=null,equipment=null,lastTransmission='',nextScare=35,finale=null,finaleCompleted=false,finaleVoice=false;
let lastFrame=performance.now(),lastUi=0,runToggle=false,stamina=1,nearest=null;
const player={x:0,z:4,yaw:0,pitch:0,moving:false,running:false,hidden:false,noiseTime:-1,noisyTask:false};
let enemy={x:0,z:-39,alert:0,lastKnown:{x:0,z:0},seenHiding:false,speed:0};
const lockers=LOCKERS;
const patrol=[{x:0,z:-91},{x:0,z:-47},{x:0,z:-12},{x:0,z:-70},{x:0,z:-32}];
const keys=new Set(),stick={x:0,y:0,id:null},look={id:null,x:0,y:0};
document.body.classList.toggle('touch',navigator.maxTouchPoints>0);
function showScreen(name){for(const id of ['home','hud','pause-screen','settings','ending'])$(id).hidden=id!==name;}
function say(message,duration=8,spoken=true){$('subtitle').querySelector('p').textContent=message;subtitleUntil=gameTime+duration;$('subtitle').style.opacity=1;if(spoken){lastTransmission=message;voice.speak(message,{speaker:/MIMIC|STATION RADIO/.test(message)?'mimic':'radio'});}}
function resetInput(){keys.clear();stick.x=stick.y=0;stick.id=null;look.id=null;runToggle=false;tools.held=false;tools.charge=0;pointerFiring=false;$('joystick-knob').style.transform='';$('sprint').setAttribute('aria-pressed','false');}
function save(){storage.set('hollow-checkpoint',{version:1,chapter:campaign.state.checkpoint});$('continue-game').hidden=false;}
function applyPreferences(){audio.setMuted(!prefs.sound);voice.setEnabled(prefs.sound);if(world){world.setQuality?.(prefs.quality);}storage.set('hollow-settings',prefs);}
function home(){mode='home';resetInput();tasks.close();voice.stop();player.hidden=false;attack=null;if(hands)hands.visible=false;$('death-shade').style.opacity=0;document.body.classList.remove('hidden-player','hit');showScreen('home');audio.setThreat(0);$('continue-game').hidden=!storage.get('hollow-checkpoint',null);for(const a of actors)a.view.group.visible=false;$('cliffhanger').hidden=true;}
function begin(checkpoint=0){
 campaign=createCampaign(checkpoint);gameTime=0;grace=15;scareCooldown=15;stamina=1;endingTime=0;attack=null;nextScare=35;finaleCompleted=false;finaleVoice=false;tasks.close();if(hands)hands.visible=false;$('death-shade').style.opacity=0;
 Object.assign(player,checkpointSpawn(campaign.state.chapter),{pitch:0,hidden:false,moving:false,running:false,noiseTime:-1,noisyTask:false,health:3,hurtUntil:0});
 tools=createToolState(campaign.state.inventory);tools.selected=campaign.state.inventory.at(-1)||'arc';
 for(const a of actors){const data=CREATURES[a.type];Object.assign(a,{x:data.spawn.x,z:data.spawn.z,hp:campaign.state.defeated.includes(a.type)?0:data.health,cycle:0,frozen:0,revealed:0,deathTime:campaign.state.defeated.includes(a.type)?3:0,alert:0,visual:false,seenHiding:false,speed:0,lastNoise:-1,lastKnown:{...data.home}});a.view.group.position.set(a.x,0,a.z);a.view.group.rotation.y=0;a.view.group.visible=false;}
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
 if(p>.2&&!attack.grab){audio.cue('grab');attack.grab=true;}if(p>.6&&!attack.drag){audio.cue('drag');attack.drag=true;}$('death-shade').style.opacity=String(clamp((p-.68)/.32,0,1));
 if(p>=1)finish();
}
function use(){
 if(mode!=='playing'||campaign.state.phase!=='playing')return;
 if(tasks.active)return;
 if(player.hidden){hide();return;}
 if(!nearest){say('Move closer to a marked station, then tap USE.',4,false);return;}
 const stage=STAGES[campaign.state.chapter];
 if(nearest.id===stage.id&&stage.puzzle){tasks.open({...stage,index:campaign.state.chapter});resetInput();return;}
 completeStation(nearest.id);
}
function completeStation(id,{combatWon=false}={}){
 const result=campaign.interact(id,{combatWon});if(result.ok)voice.stop();say(result.message,15,result.ok);if(result.cue)audio.cue(result.cue);
 if(!result.ok)return;
 save();
 tools.inventory=[...campaign.state.inventory];if(!tools.inventory.includes(tools.selected))tools.selected=tools.inventory[0]||'arc';
 if(STAGES[campaign.state.chapter]?.combat)grace=5;
 if(result.event==='power-online'){grace=10;audio.cue('scare');}
 if(result.event==='black-box'){scareCooldown=0;}
 if(result.event==='extraction-started'){say(result.message,15);}
 if(campaign.state.phase==='won')finish();updateHUD();
}
function hide(){
 if(mode!=='playing'||campaign.state.phase!=='playing')return;
 if(player.hidden){player.hidden=false;for(const a of actors)a.seenHiding=false;document.body.classList.remove('hidden-player');say('You step out. Walk quietly.',3,false);}
 else if(lockers.some(p=>dist(p,player)<2.3)){tasks.close();player.hidden=true;for(const a of actors)a.seenHiding=a.hp>0&&a.visual&&dist(a,player)<8&&lineOfSight(a,player);runToggle=false;document.body.classList.add('hidden-player');say(actors.some(a=>a.seenHiding)?'It saw you get in. This locker will not save you.':'Stay still. Let the footsteps pass.',5,false);}
 else say('Find a tall locker beside the main passage to hide.',4,false);
 $('hide').setAttribute('aria-pressed',String(player.hidden));
}
function walkable(x,z){return isWalkable(x,z,.28);}
function lineOfSight(a,b){return world.hasLineOfSight(a,b);}
function updateEnemy(dt){
 let nearestActor=null,nearestDistance=Infinity,threat=.03;
 for(const a of actors){
  const intro=STAGES.findIndex(s=>s.combat===a.type);a.view.group.visible=campaign.state.chapter>=intro;if(!a.view.group.visible)continue;
  if(a.hp<=0){a.deathTime+=dt;a.view.update(dt,gameTime,{death:clamp(a.deathTime/2.5,0,1)});continue;}
  a.frozen=Math.max(0,a.frozen-dt);a.revealed=Math.max(0,a.revealed-dt);
  const distance=dist(a,player),clear=lineOfSight(a,player),sense=perceive(a,player,{yaw:a.view.group.rotation.y,clear,noiseFresh:a.lastNoise!==player.noiseTime});a.visual=sense.visible;a.lastNoise=player.noiseTime;
  if(distance<nearestDistance){nearestActor=a;nearestDistance=distance;}
  if(grace>0){a.view.group.position.set(a.x,0,a.z);a.view.update(dt,gameTime);continue;}
  if(sense.visible){a.alert=7;a.lastKnown=sense.target;}else if(sense.heard){a.alert=4;a.lastKnown=sense.target;}else a.alert=Math.max(0,a.alert-dt);
  const previous=a.cycle;if(a.alert>0)a.cycle=(a.cycle+dt)%6.5;else a.cycle=0;
  if(previous<1.3&&a.cycle>=1.3)a.lungeTarget={...a.lastKnown};
  const rush=a.cycle>=1.3&&a.cycle<2.3,recovery=a.cycle>=2.3&&a.cycle<4.9;
  let target=a.alert>0?(rush?a.lungeTarget||a.lastKnown:a.lastKnown):CREATURES[a.type].home;
  const next=nextWaypoint(a,target),dx=next.x-a.x,dz=next.z-a.z,d=Math.hypot(dx,dz);
  a.speed=d>.08?(a.alert>0?(rush?CREATURES[a.type].speed*1.75:recovery?.35:.7):.8):0;if(a.frozen>0)a.speed*=.12;
  if(d>.08){const step=Math.min(d,a.speed*dt),nx=a.x+dx/d*step,nz=a.z+dz/d*step;if(walkable(nx,a.z))a.x=nx;if(walkable(a.x,nz))a.z=nz;const angle=Math.atan2(-dx,-dz),diff=Math.atan2(Math.sin(angle-a.view.group.rotation.y),Math.cos(angle-a.view.group.rotation.y));a.view.group.rotation.y+=diff*Math.min(1,dt*5);}
  a.view.group.position.set(a.x,0,a.z);a.view.update(dt,gameTime,{speed:a.speed,attack:rush?clamp((a.cycle-1.3),.001,.999):0,stun:a.frozen>0?1:0,vulnerable:isVulnerable(a)});
  if(distance<1.05&&rush&&a.frozen<=0&&clear&&(!player.hidden||a.seenHiding)&&gameTime>player.hurtUntil){player.health--;player.hurtUntil=gameTime+2;audio.cue('grab');if(player.health<=0){enemy=a;monster=a.view;caught(`${CREATURES[a.type].name} takes hold of your expedition suit.`);return 1;}say('Hit. Dodge sideways during the wind-up, then counterattack.',4,false);}
  threat=Math.max(threat,a.visual?clamp(1-distance/24,.1,1):a.alert>0?.2:.04);
 }
 if(nearestActor){enemy=nearestActor;monster=nearestActor.view;}return threat;
}
function selectTool(id){if(mode!=='playing'||!tools.inventory.includes(id))return;chooseTool(tools,id);audio.cue('interact');updateHUD();}
function releaseTool(){
 if(mode!=='playing'||campaign.state.phase!=='playing')return;
 let target=null,best=Infinity,options={};
 for(const a of actors){if(a.hp<=0||!a.view.group.visible)continue;const dx=a.x-player.x,dz=a.z-player.z,dy=CREATURES[a.type].weakHeight-world.camera.position.y,distance=Math.hypot(dx,dy,dz),cp=Math.cos(player.pitch),dot=(dx*(-Math.sin(player.yaw)*cp)+dy*Math.sin(player.pitch)+dz*(-Math.cos(player.yaw)*cp))/distance,aimError=Math.acos(clamp(dot,-1,1));if(aimError<best){best=aimError;target=a;options={visible:lineOfSight(player,a),distance,aimError};}}
 const result=fireTool(tools,target,options);say(result.message,5,false);if(result.used){audio.cue(result.ok?'interact':'alarm');player.noiseTime=gameTime;player.noisyTask=true;if(target&&options.visible){target.alert=7;target.lastKnown={x:player.x,z:player.z};}}
 if(result.event==='defeat'){target.deathTime=0;const stage=STAGES[campaign.state.chapter];if(stage.combat===target.type)completeStation(stage.id,{combatWon:true});}updateHUD();
}
function move(dt){
 let x=stick.x+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),y=stick.y+(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);
 const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}player.moving=Math.hypot(x,y)>.1&&!player.hidden;
 player.running=player.moving&&(runToggle||keys.has('ShiftLeft')||keys.has('ShiftRight'))&&stamina>.02;
 stamina=clamp(stamina+(player.running?-.14:.12)*dt,0,1);if(stamina===0)runToggle=false;
 const speed=player.running?4.1:2.45;
 if(player.moving){const dx=(Math.cos(player.yaw)*x+Math.sin(player.yaw)*y)*speed*dt,dz=(-Math.sin(player.yaw)*x+Math.cos(player.yaw)*y)*speed*dt;if(walkable(player.x+dx,player.z))player.x+=dx;if(walkable(player.x,player.z+dz))player.z+=dz;stepTime-=dt;if(stepTime<=0){audio.cue('step');player.noiseTime=gameTime;player.noisyTask=false;stepTime=player.running?.33:.54;}}
 if(keys.has('ArrowLeft'))player.yaw+=dt*1.65;if(keys.has('ArrowRight'))player.yaw-=dt*1.65;
 if(keys.has('ArrowUp'))player.pitch=clamp(player.pitch+dt,-1.2,1.2);if(keys.has('ArrowDown'))player.pitch=clamp(player.pitch-dt,-1.2,1.2);
 const bob=prefs.reducedMotion?0:player.moving?Math.sin(gameTime*(player.running?13:9))*.025:Math.sin(gameTime*1.5)*.004;
 world.camera.position.set(player.x,(player.hidden?1.18:1.68)+bob,player.z);world.camera.rotation.set(player.pitch,player.yaw,prefs.reducedMotion?0:player.running?Math.sin(gameTime*6)*.009:0,'YXZ');
}
function updateHUD(){
 const state=campaign.state,objective=world.interactables.find(p=>p.id===state.objective.id);
 $('chapter').textContent=`${String(state.chapter+1).padStart(2,'0')} / ${STAGES.length} OPERATIONS`;$('objective').textContent=state.objective.title.replace(/^\d+ \/ /,'');$('objective-detail').textContent=state.objective.description;
 const sec=Math.ceil(state.remaining);$('timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
 if(objective){const target=nextWaypoint(player,objective.position),angle=Math.atan2(target.x-player.x,-(target.z-player.z))+player.yaw;$('direction').style.transform=`rotate(${angle}rad)`;$('distance').textContent=`${objective.label} · ${Math.ceil(dist(player,objective.position))} M`;}
 nearest=world.interactables.find(p=>p.id===state.objective.id&&dist(p.position,player)<2.5)||world.interactables.find(p=>dist(p.position,player)<2.5)||null;
 $('interact').classList.toggle('near',!!nearest);$('context-hint').textContent=player.hidden?'HIDDEN · TAP HIDE TO LEAVE':nearest?`USE · ${nearest.label}`:'';
 $('sprint').setAttribute('aria-pressed',String(player.running));$('sprint').textContent=stamina<.15?'TIRED':'RUN';$('hide').setAttribute('aria-pressed',String(player.hidden));
 $('tool-charge').style.width=`${Math.round(Math.min(1,tools.charge/.75)*100)}%`;for(const b of document.querySelectorAll('#tool-bar button')){b.disabled=!tools.inventory.includes(b.dataset.tool);b.classList.toggle('selected',b.dataset.tool===tools.selected);}const current=actors.find(a=>a.hp>0&&a.view.group.visible&&dist(a,player)<22);$('creature-status').textContent=current?`${CREATURES[current.type].name} · ${current.hp}/${CREATURES[current.type].health} · ${isVulnerable(current)?'EXPOSED':current.cycle<1.3?'WIND-UP':'ARMOURED'}`:'';$('health').textContent=`HEALTH ${'●'.repeat(player.health||0)}${'○'.repeat(3-(player.health||0))}`;
 $('danger-text').textContent=state.extractionRemaining>0?`LIFT ${Math.ceil(state.extractionRemaining)} S`:enemy.visual?'IT SEES YOU':enemy.alert>0?'SEARCHING':'STORM RESERVE';$('threat-fill').style.width=`${Math.round(state.threat*100)}%`;
}
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(!world)return;
 if(mode==='home'){for(const a of actors)a.view.group.visible=false;world.camera.position.set(1.3,1.68,6);world.camera.rotation.set(-.025,Math.sin(now*.00008)*.13,0,'YXZ');monster.group.visible=false;world.update(dt,now/1000,player,{brightness:prefs.brightness,flashlight:true});}
 if(mode==='cinematic'){finale.update(dt);if(finale.time>5.5&&!finaleVoice){finaleVoice=true;audio.cue('scare');voice.speak('You brought it back.',{speaker:'mimic',interrupt:true});}finale.render();if(finale.done){finaleCompleted=true;finish();}return;}
 if(mode==='playing'){
  gameTime+=dt;updateTools(tools,dt);grace=Math.max(0,grace-dt);scareCooldown-=dt;
  if(campaign.state.phase==='playing'){
   move(dt);if(tasks.active){const station=STATIONS.find(p=>p.id===tasks.id);if(!station||dist(station.position,player)>3)tasks.close();else tasks.update(dt);}
   const event=campaign.update(dt,player);if(event){say(event.message,12);if(event.cue)audio.cue(event.cue);}
   if(campaign.state.phase==='playing'){const proximity=updateEnemy(dt);audio.setThreat(Math.max(proximity,campaign.state.threat*.5));document.documentElement.style.setProperty('--danger',proximity.toFixed(2));}
   else if(campaign.state.phase==='dead'&&!attack)startDeath(false);
   if(gameTime>nextScare&&campaign.state.chapter>=2){audio.cue('whisper');nextScare=gameTime+45+campaign.state.chapter*7;}
  }
  else if(campaign.state.phase==='dead')updateDeath(dt);
  $('subtitle').style.opacity=gameTime<subtitleUntil?1:0;
  world.update(dt,gameTime,player,{...campaign.state,brightness:prefs.brightness,flashlight:!player.hidden});
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
 const zone=$('look-zone');zone.onpointerdown=e=>{if(mode!=='playing'||look.id!==null)return;look.id=e.pointerId;look.x=e.clientX;look.y=e.clientY;zone.setPointerCapture(e.pointerId);e.preventDefault();};zone.onpointermove=e=>{if(e.pointerId!==look.id||mode!=='playing')return;player.yaw-=(e.clientX-look.x)*.004*prefs.sensitivity;player.pitch=clamp(player.pitch-(e.clientY-look.y)*.0035*prefs.sensitivity,-1.2,1.2);look.x=e.clientX;look.y=e.clientY;};function releaseLook(e){if(e.pointerId===look.id)look.id=null;}zone.onpointerup=releaseLook;zone.onpointercancel=releaseLook;zone.onlostpointercapture=releaseLook;
 addEventListener('keydown',e=>{if(e.code==='Escape'){if(mode==='playing')pause();else if(mode==='paused')resume();return;}if(mode!=='playing')return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(tasks.key(e.code,true))return;keys.add(e.code);if(!e.repeat){if(e.code==='KeyE'||e.code==='Space')use();if(e.code==='KeyH')hide();}});addEventListener('keyup',e=>{keys.delete(e.code);tasks.key(e.code,false);});addEventListener('blur',()=>{resetInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();pause();audio.suspend();voice.pause();}});addEventListener('resize',()=>world?.resize());$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('fatal').hidden=false;});
}
const shade=document.createElement('div');shade.id='death-shade';document.body.append(shade);
const combatHud=document.createElement('div');combatHud.id='combat-hud';combatHud.innerHTML='<div id="health">HEALTH ●●●</div><div id="creature-status"></div><div id="tool-bar"><button data-tool="arc">ARC</button><button data-tool="sonar">ECHO</button><button data-tool="cryo">CRYO</button></div><button id="fire" aria-label="Use selected tool">HOLD / FIRE<span class="charge-track"><i id="tool-charge"></i></span></button>';$('hud').append(combatHud);
for(const b of combatHud.querySelectorAll('[data-tool]'))b.onclick=()=>selectTool(b.dataset.tool);
let pointerFiring=false;const fireButton=$('fire');fireButton.onpointerdown=e=>{if(mode!=='playing'||!tools.inventory.includes(tools.selected)||tasks.active)return;pointerFiring=true;tools.held=true;fireButton.setPointerCapture(e.pointerId);e.preventDefault();};fireButton.onpointerup=()=>{if(pointerFiring){pointerFiring=false;releaseTool();}};fireButton.onpointercancel=()=>{pointerFiring=false;tools.held=false;tools.charge=0;};fireButton.onlostpointercapture=()=>{if(pointerFiring){pointerFiring=false;tools.held=false;tools.charge=0;}};
addEventListener('keydown',e=>{if(mode!=='playing'||tasks.active)return;if(e.code==='KeyF'&&!e.repeat){tools.held=true;e.preventDefault();}if(e.code==='Digit1')selectTool('arc');if(e.code==='Digit2')selectTool('sonar');if(e.code==='Digit3')selectTool('cryo');});addEventListener('keyup',e=>{if(e.code==='KeyF'&&mode==='playing')releaseTool();});
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
try{world=createWorld($('scene'),{quality:prefs.quality});actors=Object.keys(CREATURES).map(type=>{const view=createMonster(type);world.scene.add(view.group);view.group.visible=false;return{type,view,...CREATURES[type].spawn,hp:CREATURES[type].health,cycle:0,frozen:0,revealed:0,deathTime:0};});enemy=actors[0];monster=enemy.view;hands=makeHands();finale=createFinale(world.renderer,{reducedMotion:prefs.reducedMotion});bind();applyPreferences();home();world.resize();requestAnimationFrame(frame);document.body.dataset.ready='true';if(import.meta.env.DEV)window.__hollowInspect=()=>({mode,player:{...player},enemy:{...enemy},campaign:campaign.snapshot(),tools:{...tools},monsters:actors.map(a=>({type:a.type,x:a.x,z:a.z,hp:a.hp,cycle:a.cycle,frozen:a.frozen,revealed:a.revealed,visible:a.view.group.visible})),task:tasks.state?{...tasks.state}:null,attack:attack?{time:attack.time,creature:attack.creature}:null,camera:{y:world.camera.position.y,roll:world.camera.rotation.z},drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles});}catch(error){console.error(error);$('fatal').hidden=false;}




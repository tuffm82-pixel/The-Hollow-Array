import {ZONES,TAPES} from './layout.js';
import {TOOL_LABELS} from './field-puzzles.js';

const labels={lodge:'LODGE',north:'MAIN HALL',west:'WEST',east:'EAST',generator:'ENGINEERING',infirmary:'INFIRMARY',records:'RECORDS',workshop:'WORKSHOP',conservatory:'GARDEN',dome:'DOME'};
const svgNS='http://www.w3.org/2000/svg';

function svgPart(map,tag,attributes,text){
 const part=document.createElementNS(svgNS,tag);
 for(const [key,value] of Object.entries(attributes))part.setAttribute(key,value);
 if(text)part.textContent=text;
 map.append(part);
}

export function createJournal({onClose,onReplay}){
 const screen=document.createElement('section');
 screen.id='journal-screen';
 screen.className='screen overlay';
 screen.hidden=true;
 screen.setAttribute('role','dialog');
 screen.setAttribute('aria-modal','true');
 screen.setAttribute('aria-labelledby','journal-title');
 screen.innerHTML='<div class="journal-card"><header><div><p class="eyebrow">HALCYON RIDGE / FIELD RECORD</p><h2 id="journal-title">Field journal</h2></div><button class="secondary" id="journal-close">BACK</button></header><div class="journal-grid"><div id="journal-map"></div><div><h3 id="journal-objective"></h3><p id="journal-inventory"></p><p id="journal-clue"></p><h3 id="journal-count"></h3><div id="journal-tapes"></div></div></div></div>';
 document.body.append(screen);
 const close=screen.querySelector('#journal-close');
 close.onclick=onClose;

 function show({objective,inventory,finds,player,chapter}){
  screen.querySelector('#journal-objective').textContent=objective;
  screen.querySelector('#journal-inventory').textContent=inventory.length?'Tools · '+inventory.map(id=>TOOL_LABELS[id]).join(' / '):'Tools · none collected';
  screen.querySelector('#journal-clue').textContent=chapter>=5?'Infirmary notes · Records cabinet code 6318.':'';
  const recovered=TAPES.filter(tape=>finds.has(tape.id));
  screen.querySelector('#journal-count').textContent=`Recordings ${recovered.length} / ${TAPES.length}`;
  const list=screen.querySelector('#journal-tapes');
  list.replaceChildren();
  if(!recovered.length)list.textContent='Find tape machines and use them to add their recordings.';
  for(const tape of recovered){
   const note=document.createElement('details');
   const title=document.createElement('summary');
   title.textContent=tape.label.replace('Tape: ','');
   const transcript=document.createElement('p');
   transcript.textContent=tape.message;
   const replay=document.createElement('button');
   replay.className='secondary';replay.textContent='PLAY TAPE';
   replay.onclick=()=>onReplay(tape.message);
   note.append(title,transcript,replay);list.append(note);
  }
  const map=document.createElementNS(svgNS,'svg');
  map.setAttribute('viewBox','-50 -89 101 101');
  map.setAttribute('role','img');map.setAttribute('aria-label','Station floor plan with your position marked in amber');
  for(const zone of ZONES){
   const {id,minX,maxX,minZ,maxZ}=zone;
   svgPart(map,'rect',{x:minX,y:minZ,width:maxX-minX,height:maxZ-minZ,class:'map-room'});
   if(id==='north')continue;
   svgPart(map,'text',{x:(minX+maxX)/2,y:(minZ+maxZ)/2+.75,class:'map-label'},labels[id]);
  }
  svgPart(map,'circle',{cx:player.x,cy:player.z,r:1.32,class:'map-you'});
  screen.querySelector('#journal-map').replaceChildren(map);
  close.focus();
 }
 return {show};
}

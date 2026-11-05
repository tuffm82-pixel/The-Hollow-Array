export const MAP_BOUNDS=Object.freeze({minX:-48,maxX:50,minZ:-86,maxZ:10});
export const ZONES=Object.freeze([
 {id:'lodge',minX:-8,maxX:8,minZ:-8,maxZ:8},
 {id:'north',minX:-3,maxX:3,minZ:-66,maxZ:-8},
 {id:'west',minX:-34,maxX:-8,minZ:-3,maxZ:3},
 {id:'east',minX:8,maxX:34,minZ:-3,maxZ:3},
 {id:'generator',minX:-46,maxX:-34,minZ:-9,maxZ:9},
 {id:'infirmary',minX:34,maxX:48,minZ:-9,maxZ:9},
 {id:'records',minX:-20,maxX:-3,minZ:-28,maxZ:-14},
 {id:'workshop',minX:3,maxX:22,minZ:-41,maxZ:-27},
 {id:'conservatory',minX:-26,maxX:-3,minZ:-56,maxZ:-42},
 {id:'dome',minX:-15,maxX:15,minZ:-84,maxZ:-66},
]);
export const HIDE_SPOTS=Object.freeze([{x:-6,z:5},{x:-30,z:1.5},{x:29,z:-1.5},{x:-1.8,z:-16},{x:1.8,z:-29},{x:-1.8,z:-43},{x:1.8,z:-59},{x:11,z:-69}]);
export const LOCKERS=HIDE_SPOTS;
export const SERVICE_DOORS=Object.freeze({records:-25.4,workshop:-37.4});
export const PASSAGES=Object.freeze({
 records:{minZ:-28,maxZ:-11,position:{x:1.55,z:-13},speaker:{x:0,z:-27},label:'Hall PA test switch'},
 archive:{minZ:-47,maxZ:-22,position:{x:1.55,z:-42},speaker:{x:0,z:-46},label:'Service PA test switch'},
});
export const TAPES=Object.freeze([
 {id:'tape-lodge',position:{x:5.3,z:-2.3},label:'Tape: The night shift',message:'MARA, NIGHT SHIFT · If my voice tells you to run, listen first. The thing only found us after Owen ran down the hall. Walking and the shelter cupboards kept the rest of us out of sight.'},
 {id:'tape-records',position:{x:-9,z:-24.2},label:'Tape: The PA test',message:'OWEN, PA TEST · The speakers still draw it. Hit the test switch once, then take the other records door. I cut a service entrance at the south end of the shelves.'},
 {id:'tape-infirmary',position:{x:39,z:3.6},label:'Tape: Proof of life',message:'MARA, PRIVATE TAPE · If you hear me ask you to answer the intercom, walk away from it. I can open the lift by hand. I never needed your voice.'},
]);
export const ARENAS=Object.freeze({
 graft:{zone:'generator',station:'hound',panel:{x:-36.5,z:-4.8},hazard:{x:-39,z:-2},radius:1.8,kind:'lure',label:'Load-test breaker',instruction:'Use the breaker. The Runner follows the sound to the live grate. Shoot when its chest opens.'},
 widow:{zone:'conservatory',station:'widow',panel:{x:-8,z:-47.3},hazard:{x:-12,z:-49},radius:2.6,kind:'spray',label:'Coolant valve',instruction:'Open the coolant valve, then draw the Stalker across the marked tiles. Circle the planters to stay out of its reach.'},
 cantor:{zone:'dome',station:'cantor',panel:{x:-4,z:-74},hazard:{x:0,z:-77},radius:3,kind:'beam',label:'Dish floodlight',instruction:'Turn on the dish floodlight and lure the Cantor onto its bright strip. Use the telescope pedestal as cover.'},
});
export const STATIONS=Object.freeze([
 {id:'desk',position:{x:4,z:3},label:'Expedition equipment case'},
 {id:'generator',position:{x:-41,z:0},label:'Emergency generator'},
 {id:'hound',position:ARENAS.graft.panel,label:ARENAS.graft.label},
 {id:'records',position:{x:-15,z:-21},label:'Resonance instrument'},
 {id:'infirmary',position:{x:42,z:0},label:'Cryo lantern and field notes'},
 {id:'workshop',position:{x:15,z:-34},label:'Field-tool calibration bench'},
 {id:'widow',position:ARENAS.widow.panel,label:ARENAS.widow.label},
 {id:'sample',position:{x:-20,z:-49},label:'Conservatory relay prism'},
 {id:'archive',position:{x:-15,z:-21},label:'Sealed observation records'},
 {id:'relay',position:{x:15,z:-34},label:'Telescope power relay'},
 {id:'signal',position:{x:0,z:-73},label:'Telescope resonance receiver'},
 {id:'cantor',position:ARENAS.cantor.panel,label:ARENAS.cantor.label},
 {id:'rail',position:{x:8,z:-70},label:'Lift drive service panel'},
 {id:'lift',position:{x:8,z:-80},label:'Lift pressure console'},
 {id:'exit',position:{x:0,z:-79},label:'Enter the lower observatory'},
]);
export const STAGES=Object.freeze([
 {id:'desk',title:'01 / The last expedition',description:'Open the equipment case in the lodge. Take the Arc Spool.',reward:'arc'},
 {id:'generator',title:'02 / Power beneath the snow',description:'Follow the west passage. Match three generator circuit banks.',puzzle:'circuits'},
 {id:'hound',title:'03 / The thing that answers',description:ARENAS.graft.instruction,combat:'graft'},
 {id:'records',title:'04 / Something in the passage',description:'Reach Records. Walk to stay quiet, or use the PA test switch to draw it away. Records has two doors.',reward:'sonar'},
 {id:'infirmary',title:'05 / Cold enough to stop a heart',description:'Search the east infirmary. Collect the Cryo Lantern and read the field notes.',reward:'cryo'},
 {id:'workshop',title:'06 / Steady hands',description:'Calibrate the tools at the workshop pressure bench.',puzzle:'pressure'},
 {id:'widow',title:'07 / The garden remembers',description:ARENAS.widow.instruction,combat:'widow'},
 {id:'sample',title:'08 / What the roots were hiding',description:'Recover the relay prism from the empty containment cradle.'},
 {id:'archive',title:'09 / Footsteps on the stairs',description:'Get back to Records through the service door. Use the PA or a cupboard to lose the patrol. Cabinet code: 6318.',puzzle:'code'},
 {id:'relay',title:'10 / Open the dome',description:'Retune the workshop relay and restore telescope power.',puzzle:'frequency'},
 {id:'signal',title:'11 / Do not repeat the voice',description:'Calibrate the telescope receiver by repeating its light sequences.',puzzle:'sequence'},
 {id:'cantor',title:'12 / It knows your voice',description:ARENAS.cantor.instruction,combat:'cantor'},
 {id:'rail',title:'13 / The knock at the gate',description:'Use the drive panel beside the dome entrance to release the lift.',puzzle:'circuits'},
 {id:'lift',title:'14 / Two quick, one slow',description:'Balance the lift pressure at the console behind the telescope.',puzzle:'pressure'},
 {id:'exit',title:'15 / One last voice',description:'Use the telescope for cover until the gate opens. Reach the lift and decide what to do with the intercom.'},
]);
export const CREATURES=Object.freeze({
 graft:{name:'Graft Runner',spawn:{x:-39,z:3.7},home:{x:-40,z:0},health:3,height:2.45,weakHeight:1.38,speed:2.5},
 widow:{name:'Lumen Stalker',spawn:{x:-20,z:-52},home:{x:-17,z:-49},health:3,height:3.32,weakHeight:2.05,speed:2.1},
 cantor:{name:'The Null Cantor',spawn:{x:0,z:-81},home:{x:0,z:-79},health:4,height:4.35,weakHeight:2.72,speed:2.25},
});
export function checkpointSpawn(chapter){
 if(!Number.isInteger(chapter)||chapter<=0)return{x:0,z:5,yaw:0};
 if(chapter===1)return{x:2,z:3,yaw:0};
 const combat=STAGES[chapter]?.combat;if(combat==='graft')return{x:-33,z:0,yaw:Math.PI/2};if(combat==='widow')return{x:-5,z:-49,yaw:Math.PI/2};if(combat==='cantor')return{x:0,z:-67,yaw:0};
 const previous=STAGES[chapter-1];
 const p=previous?.combat?CREATURES[previous.combat].home:STATIONS[Math.min(chapter-1,STATIONS.length-1)].position;
 return{x:p.x>30?p.x-1.3:p.x< -30?p.x+1.3:p.x,z:p.z+1.2,yaw:0};
}

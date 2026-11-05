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
export const STATIONS=Object.freeze([
 {id:'desk',position:{x:4,z:3},label:'Expedition equipment case'},
 {id:'generator',position:{x:-41,z:0},label:'Emergency generator'},
 {id:'hound',position:{x:-39,z:0},label:'Graft Runner encounter'},
 {id:'records',position:{x:-15,z:-21},label:'Resonance instrument'},
 {id:'infirmary',position:{x:42,z:0},label:'Cryo lantern and field notes'},
 {id:'workshop',position:{x:15,z:-34},label:'Field-tool calibration bench'},
 {id:'widow',position:{x:-17,z:-49},label:'Lumen Stalker encounter'},
 {id:'sample',position:{x:-20,z:-49},label:'Conservatory relay prism'},
 {id:'archive',position:{x:-15,z:-21},label:'Sealed observation records'},
 {id:'relay',position:{x:15,z:-34},label:'Telescope power relay'},
 {id:'signal',position:{x:0,z:-73},label:'Telescope resonance receiver'},
 {id:'cantor',position:{x:0,z:-76},label:'The Null Cantor encounter'},
 {id:'rail',position:{x:-41,z:0},label:'Funicular emergency drive'},
 {id:'lift',position:{x:0,z:-79},label:'Lower observatory lift'},
 {id:'exit',position:{x:0,z:-79},label:'Enter the lower observatory'},
]);
export const STAGES=Object.freeze([
 {id:'desk',title:'01 / The last expedition',description:'Open the equipment case in the lodge. Take the Arc Spool.',reward:'arc'},
 {id:'generator',title:'02 / Power beneath the snow',description:'Follow the west passage. Match three generator circuit banks.',puzzle:'circuits'},
 {id:'hound',title:'03 / Graft Runner',description:'Defeat Graft Runner: hold FIRE to charge the Arc Spool, aim at its copper node, then release during its recovery.',combat:'graft'},
 {id:'records',title:'04 / An instrument that listens',description:'Find the Resonance Fork in the observation records room.',reward:'sonar'},
 {id:'infirmary',title:'05 / Cold enough to stop a heart',description:'Search the east infirmary. Collect the Cryo Lantern and read the field notes.',reward:'cryo'},
 {id:'workshop',title:'06 / Steady hands',description:'Calibrate the tools at the workshop pressure bench.',puzzle:'pressure'},
 {id:'widow',title:'07 / Lumen Stalker',description:'Freeze Lumen Stalker with the Cryo Lantern. Switch to the Arc Spool and strike its exposed amber chest.',combat:'widow'},
 {id:'sample',title:'08 / What the roots were hiding',description:'Recover the relay prism from the empty containment cradle.'},
 {id:'archive',title:'09 / The mountain is hollow',description:'Unseal the records cabinet. Infirmary note: 6318.',puzzle:'code'},
 {id:'relay',title:'10 / Open the dome',description:'Retune the workshop relay and restore telescope power.',puzzle:'frequency'},
 {id:'signal',title:'11 / Do not repeat the voice',description:'Calibrate the telescope receiver by repeating its light sequences.',puzzle:'sequence'},
 {id:'cantor',title:'12 / The Null Cantor',description:'Use the Resonance Fork to reveal the Cantor’s chest. Switch to the Arc Spool, charge, aim, and release before it closes.',combat:'cantor'},
 {id:'rail',title:'13 / A route below',description:'Return to Engineering and release the funicular’s emergency drive.',puzzle:'circuits'},
 {id:'lift',title:'14 / The observatory under the observatory',description:'Balance the descent lift’s pressure. Wait for its thirty-second preparation cycle.',puzzle:'pressure'},
 {id:'exit',title:'15 / Chapter one: Downward',description:'Enter the descent lift once its boarding light is green.'},
]);
export const CREATURES=Object.freeze({
 graft:{name:'Graft Runner',spawn:{x:-39,z:3.7},home:{x:-40,z:0},health:3,weakHeight:.9,speed:2.5},
 widow:{name:'Lumen Stalker',spawn:{x:-20,z:-52},home:{x:-17,z:-49},health:3,weakHeight:1.6,speed:1.9},
 cantor:{name:'The Null Cantor',spawn:{x:0,z:-80},home:{x:0,z:-75},health:4,weakHeight:2,speed:2.1},
});
export function checkpointSpawn(chapter){
 if(!Number.isInteger(chapter)||chapter<=0)return{x:0,z:5,yaw:0};
 if(chapter===1)return{x:2,z:3,yaw:0};
 const combat=STAGES[chapter]?.combat;if(combat==='graft')return{x:-33,z:0,yaw:Math.PI/2};if(combat==='widow')return{x:-5,z:-49,yaw:Math.PI/2};if(combat==='cantor')return{x:0,z:-67,yaw:0};
 const p=STATIONS[Math.min(chapter-1,STATIONS.length-1)].position;
 return{x:p.x>30?p.x-1.3:p.x< -30?p.x+1.3:p.x,z:p.z+1.2,yaw:0};
}

export const TOOL_LABELS={arc:'ARC',sonar:'ECHO',cryo:'CRYO'};

export function pulseDevice(puzzle,latched,id,tool){
 const device=puzzle.devices.find(candidate=>candidate.id===id);
 if(!device)return {status:'missing'};
 if(latched.has(id))return {status:'latched',device};
 if(device.tool!==tool)return {status:'wrong-tool',device};
 if(puzzle.order&&puzzle.devices[latched.size]!==device)return {status:'wrong-order',device,next:puzzle.devices[latched.size]};
 latched.add(id);
 return {status:'powered',device,complete:latched.size===puzzle.devices.length};
}

export function aimDevice(puzzle,origin,yaw,pitch,clear,latched){
 const dx=-Math.sin(yaw)*Math.cos(pitch),dy=Math.sin(pitch),dz=-Math.cos(yaw)*Math.cos(pitch);
 let selected=null,best=-Infinity;
 for(const device of puzzle.devices){
  const x=device.x-origin.x,y=device.y-origin.y,z=device.z-origin.z,distance=Math.hypot(x,y,z);
  if(distance<.12||distance>13||!clear(origin,device))continue;
  const alignment=(x*dx+y*dy+z*dz)/distance;
  if(alignment<.982)continue;
  const priority=alignment-(latched.has(device.id)?.018:0);
  if(priority>best){best=priority;selected=device;}
 }
 return selected;
}

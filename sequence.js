export function createMemoryTask(index=0){
 const patterns=[[0,2,1],[3,1,0,2],[2,0,3,1,2]].map(p=>p.map(x=>(x+index)%4));
 const s={type:'sequence',round:0,phase:'show',clock:0,entered:0,lit:-1,done:false,mistake:false};
 s.update=dt=>{s.mistake=false;if(s.done||s.phase==='input')return;s.clock+=Math.max(0,Math.min(.1,dt));const pattern=patterns[s.round];if(s.clock>=pattern.length*.85+.4){s.phase='input';s.lit=-1;}else{const i=Math.floor(s.clock/.85);s.lit=i<pattern.length&&s.clock%.85<.55?pattern[i]:-1;}};
 s.act=value=>{if(s.done)return;if(value==='replay'){s.phase='show';s.clock=0;s.entered=0;return;}if(s.phase!=='input')return;const pattern=patterns[s.round];if(Number(value)!==pattern[s.entered]){s.mistake=true;s.phase='show';s.clock=-.6;s.entered=0;return;}s.entered++;if(s.entered===pattern.length){s.round++;s.entered=0;s.clock=-.3;s.phase='show';if(s.round===patterns.length){s.done=true;s.lit=-1;}}};return s;
}

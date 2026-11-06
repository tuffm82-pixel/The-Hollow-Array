export const BUNKER_OPENING = 'Shelter 17 emergency broadcast. A nuclear strike cut our power. The surface is sealed against fallout. Check the three people by the airlock, then find Mara in triage.';

export const BUNKER_BODIES = [
  {id:'body-1', floor:0, x:-2.6, z:6.6, name:'Intake guard'},
  {id:'body-2', floor:0, x:0, z:4.8, name:'Shelter resident'},
  {id:'body-3', floor:0, x:2.6, z:6.1, name:'Containment technician'},
];

export const BUNKER_ALLIES = [
  {id:'mara', floor:0, x:6, z:4, name:'Mara Vale', role:'Triage medic'},
  {id:'ivo', floor:1, x:-6, z:3, name:'Ivo Chen', role:'Maintenance engineer'},
  {id:'noor', floor:2, x:6, z:4, name:'Noor Reyes', role:'Radio operator'},
];

export const BUNKER_THREATS = [
  {id:'crawler', floor:1, x:0, z:-6, creature:'graft', health:3, speed:2.9, name:'The Ashback'},
  {id:'warden', floor:2, x:-5, z:-6, creature:'cantor', health:4, speed:3.25, name:'The Hollow Warden'},
];

function objective(id, floor, x, z, title, detail, label, line, options = {}) {
  return {id, floor, x, z, title, detail, label, line, kind:'interact', speaker:'radio', ...options};
}

export const BUNKER_OBJECTIVES = [
  objective('body-1', 0, -2.6, 6.6, 'Check the intake guard', 'Emergency Triage · first body by the arrival bay', 'Check for a pulse',
    'No pulse. The guard’s dose badge is off the scale. The inner airlock held, but he was still outside it when the strike hit.'),
  objective('body-2', 0, 0, 4.8, 'Check the second body', 'Emergency Triage · between the triage bays', 'Check for breathing',
    'No breathing. A trail leads here from the lift, away from the surface airlock. Something attacked this resident from inside the shelter.'),
  objective('body-3', 0, 2.6, 6.1, 'Check the containment technician', 'Emergency Triage · beside the east bay', 'Check the technician',
    'They’re gone. The pager reads: isolation locks released on power failure. It mentions an acoustic research wing beneath the shelter.'),
  objective('blast-door', 0, -7.8, 7.5, 'Read the surface radiation monitor', 'Intake · west airlock console', 'Read the monitor',
    'The monitor shows lethal fallout. The surface hatch stays sealed. An underground pod can reach Shelter 18 once power, air and communications are restored.'),
  objective('mara', 0, 6, 4, 'Help Mara in the triage bay', 'Emergency Triage · find the medic beside the east wall', 'Speak to Mara',
    'I’m Mara, the intake medic. The alarm is coming from the lift. When you restore power, the damaged intake locks will cycle. Please get me behind the manual shutter first.', {
      kind:'choice',
      choices:[
        {id:'shelter', label:'Move Mara behind the inner shutter', detail:'Mara reaches shelter before the intake doors reopen.'},
        {id:'leave', label:'Leave Mara at the intake controls', detail:'Mara will be exposed when you restore power.'},
      ],
    }),
  objective('power', 0, 6, -6, 'Restore power to the bunker lift', 'Command and Rations · emergency breaker on the east side', 'Throw the breaker',
    'The lift has power. The air filters on Level B2 still need a restart.'),
  objective('lift-1', 0, 0, -10, 'Take the lift to Level B2', 'Command and Rations · north lift', 'Descend to B2',
    'Level B2. The filtration hall is on this floor.', {kind:'lift', nextFloor:1}),
  objective('ivo', 1, -6, 3, 'Find the voice in the power hall', 'Power Hall · Ivo is pinned at the west panel', 'Speak to Ivo',
    'My leg is caught. Lift this panel and I can get to the auxiliary switch. It feeds the shutters downstairs.', {
      kind:'choice',
      choices:[
        {id:'rescue', label:'Lift the panel and pull Ivo free', detail:'Ivo can restore backup power to the ward shutters.'},
        {id:'seal', label:'Seal the damaged bay with Ivo inside', detail:'Ivo will die inside the damaged bay. Backup power stays offline.'},
      ],
    }),
  objective('crawler', 1, 0, -6, 'Stop the Ashback', 'Filtration and Water Works · fight from cover and keep the doorway clear', 'Stop the Ashback',
    'The Ashback is down. Its restraint tag reads Acoustic Isolation. Restart the filters before the people upstairs run out of clean air.', {kind:'threat'}),
  objective('filtration', 1, 6, -6, 'Restart air filtration', 'Filtration and Water Works · east pump console', 'Start the filters',
    'Clean air is flowing again. The last working radio is down in the isolation ward.'),
  objective('lift-2', 1, 0, -10, 'Take the lift to Level B3', 'Filtration and Water Works · north lift', 'Descend to B3',
    'Level B3. Noor, can you hear me?', {kind:'lift', nextFloor:2}),
  objective('noor', 2, 6, 4, 'Reach Noor at the radio station', 'Isolation Ward · east radio station', 'Speak to Noor',
    'The booth is shielded, but I need to stay at this antenna to reach the next shelter live.', {kind:'choice', choices:[
      {id:'shield', label:'Move Noor into the shielded booth', detail:'Noor survives. She saves the distress call for the relay.'},
      {id:'broadcast', label:'Have Noor transmit the call live', detail:'Noor will be exposed at the antenna.'},
    ]}),
  objective('warden', 2, -5, -6, 'Stop the Hollow Warden', 'Deep Relay · get behind cover when it rushes you', 'Stop the Hollow Warden',
    'The Warden is down. The deep relay controls the transfer pod. Noor’s log says the research subjects could imitate voices before the blast.', {kind:'threat'}),
  objective('relay', 2, 5, -7, 'Open the underground transfer route', 'Deep Relay · east transfer console', 'Open the transfer route',
    'Transfer route unlocked. The pod goes through the rock to the next shelter. The surface hatch stays sealed.'),
  objective('escape', 2, 0, -10, 'Board the underground transfer pod', 'Escape Pod · north platform', 'Board the pod',
    'Shelter 18 copies. You can let go of the door now. I’m already inside.', {speaker:'mimic'}),
];

function freshState() {
  return {
    step:0, floor:0, phase:'playing', decisions:{},
    survivors:{mara:'unresolved', ivo:'unresolved', noor:'unresolved'},
    flags:{backup:false, broadcast:false, filtration:false, transfer:false},
  };
}

export function getBunkerObjective(state) {
  if (state.phase !== 'playing') return null;
  const current = BUNKER_OBJECTIVES[state.step];
  if (current?.id !== 'noor') return current ?? null;

  const [shield, broadcast] = current.choices;
  return {...current, choices:[shield, {...broadcast, detail:state.flags.backup
    ? 'Ivo restored backup power. The shutter will protect Noor while she calls the next shelter.'
    : 'Backup power is offline. The Warden will reach Noor before the shutter can close.'}]};
}

export function advanceBunkerStory(state, {id, choice} = {}) {
  const current = getBunkerObjective(state);
  if (!current || current.id !== id) return {ok:false, message:'Follow the current objective first.'};
  if (current.choices && !current.choices.some(option => option.id === choice)) {
    return {ok:false, message:'Choose how to help your ally.'};
  }

  let message = current.line;
  let effects;
  function setAlly(ally, outcome, pose) {
    state.survivors[ally] = outcome;
    effects = {ally, outcome, pose};
  }

  if (current.choices) state.decisions[id] = choice;
  switch (id) {
    case 'mara':
      if (choice === 'shelter') {
        setAlly('mara', 'sheltered', 'recovering');
        message = 'I’m behind the shutter. Get to the breaker in Command. I’ll keep the radio open.';
      } else {
        setAlly('mara', 'at-risk', 'idle');
        message = 'I’ll hold the intake as long as I can. Go to the breaker in Command.';
      }
      break;
    case 'power':
      if (state.survivors.mara === 'at-risk') {
        setAlly('mara', 'lost', 'fallen');
        message = 'The lift has power. The intake alarm is screaming. Mara’s radio has gone silent.';
      }
      break;
    case 'ivo':
      if (choice === 'rescue') {
        state.flags.backup = true;
        setAlly('ivo', 'sheltered', 'recovering');
        message = 'My leg’s free. I can reach the auxiliary switch from here. Noor will have her shutters back.';
      } else {
        setAlly('ivo', 'lost', 'fallen');
        message = 'The bay is sealed. Ivo’s voice cuts out. The backup power indicator stays dark.';
      }
      break;
    case 'filtration':
      state.flags.filtration = true;
      break;
    case 'noor':
      state.flags.broadcast = choice === 'broadcast';
      if (choice === 'shield') {
        setAlly('noor', 'sheltered', 'recovering');
        message = 'I’m safe in the booth. I saved the call to the relay. Get it through after you clear the hall.';
      } else if (state.flags.backup) {
        setAlly('noor', 'sheltered', 'recovering');
        message = 'Shelter 18 heard us. Ivo, your shutter’s closing. I’m safe.';
      } else {
        setAlly('noor', 'at-risk', 'idle');
        message = 'Shelter 18 heard us. The shutter won’t close. Something’s coming through the ward.';
      }
      break;
    case 'warden':
      if (state.survivors.noor === 'at-risk') {
        setAlly('noor', 'lost', 'fallen');
        message = 'The Warden is down. Noor’s distress call got through, but she’s gone.';
      }
      break;
    case 'relay':
      state.flags.transfer = true;
      if (!state.flags.broadcast) message = 'Noor’s call has been forwarded to Shelter 18. Transfer route open. Board the pod.';
      break;
    case 'escape':
      state.phase = 'won';
      break;
  }

  if (current.kind === 'lift') {
    state.floor = current.nextFloor;
    effects = {nextFloor:current.nextFloor};
  }
  state.step += 1;
  return {ok:true, message, speaker:current.speaker, effects};
}

export function bunkerCheckpoint(state) {
  return {version:1, step:state.step, decisions:{...state.decisions}};
}

export function createBunkerStory(saved) {
  const state = freshState();
  if (saved?.version !== 1 || !Number.isInteger(saved.step) || saved.step < 0 || saved.step > BUNKER_OBJECTIVES.length) return state;

  for (const current of BUNKER_OBJECTIVES.slice(0, saved.step)) {
    const result = advanceBunkerStory(state, {id:current.id, choice:saved.decisions?.[current.id]});
    if (!result.ok) break;
  }
  return state;
}

export function bunkerSummary(state) {
  const sheltered = BUNKER_ALLIES.filter(ally => state.survivors[ally.id] === 'sheltered');
  const lost = BUNKER_ALLIES.filter(ally => state.survivors[ally.id] === 'lost');
  const names = allies => allies.map(ally => ally.name).join(', ');
  const rescued = sheltered.length ? `Reached shelter: ${names(sheltered)}.` : 'No allies made it to shelter.';
  const casualties = lost.length ? `Lost in the bunker: ${names(lost)}.` : '';
  const contact = state.flags.broadcast ? 'Shelter 18 answered Noor’s live call.' : 'The relay forwarded Noor’s distress call to Shelter 18.';
  return [rescued, casualties, contact].filter(Boolean).join(' ');
}

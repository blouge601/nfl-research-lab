
// Step 7: matchup intelligence layer.
// Converts opponent tendencies, defensive structure, pace, pressure, coverage,
// game environment and role context into transparent adjustments.
// Inputs are intentionally normalized so production adapters can map nflverse/NGS data.

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const safe=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;

export function normalizeDefense(raw={}) {
  return {
    team:raw.team||raw.defteam,
    plays:safe(raw.plays),
    epaPerPlay:safe(raw.epa_per_play??raw.def_epa_per_play),
    passEpa:safe(raw.pass_epa??raw.def_pass_epa),
    rushEpa:safe(raw.rush_epa??raw.def_rush_epa),
    successRate:safe(raw.success_rate??raw.def_success_rate),
    explosiveRate:safe(raw.explosive_rate??raw.def_explosive_rate),
    pressureRate:safe(raw.pressure_rate??raw.pressure_pct),
    sackRate:safe(raw.sack_rate),
    manRate:safe(raw.man_rate),
    zoneRate:safe(raw.zone_rate),
    cover0:safe(raw.cover0),
    cover1:safe(raw.cover1),
    cover2:safe(raw.cover2),
    cover3:safe(raw.cover3),
    cover4:safe(raw.cover4),
    cover6:safe(raw.cover6),
    blitzRate:safe(raw.blitz_rate),
    pace:safe(raw.seconds_per_play),
    rushYardsAllowed:safe(raw.rush_yards_allowed),
    passYardsAllowed:safe(raw.pass_yards_allowed),
    fantasyPointsAllowed:safe(raw.fantasy_points_allowed)
  };
}

export function normalizeOffense(raw={}) {
  return {
    team:raw.team||raw.posteam,
    plays:safe(raw.plays),
    epaPerPlay:safe(raw.epa_per_play??raw.off_epa_per_play),
    passRate:safe(raw.pass_rate),
    pace:safe(raw.seconds_per_play),
    successRate:safe(raw.success_rate),
    explosiveRate:safe(raw.explosive_rate),
    neutralPassRate:safe(raw.neutral_pass_rate),
    shotgunRate:safe(raw.shotgun_rate),
    noHuddleRate:safe(raw.no_huddle_rate),
    redZonePlays:safe(raw.red_zone_plays)
  };
}

export function coverageMatchup(def={}, player={}) {
  const d=normalizeDefense(def);
  const pos=String(player.position||player.position_group||'').toUpperCase();
  // Transparent position/coverage heuristics. These are small modifiers, not
  // claims that coverage type alone determines an outcome.
  let factor=1, notes=[];
  if(['WR','TE'].includes(pos)) {
    if(d.zoneRate>.62){factor*=1.015;notes.push('zone-heavy defense')}
    if(d.manRate>.55){factor*=.985;notes.push('man-heavy defense')}
    if(d.cover1+d.cover0>d.cover3+d.cover4){factor*=1.01;notes.push('more single-high/man structure')}
  }
  if(pos==='RB') {
    if(d.blitzRate>.28){factor*=1.01;notes.push('elevated blitz environment')}
    if(d.rushEpa>.05){factor*=.97;notes.push('strong run defense by EPA')}
  }
  return {factor:clamp(factor,.93,1.07),notes};
}

export function pressureMatchup(def={}, player={}, market='') {
  const d=normalizeDefense(def);
  let factor=1,notes=[];
  if(['passing_yards','passing_attempts','receptions','targets','receiving_yards'].includes(market)) {
    if(d.pressureRate>.28){factor*=.97;notes.push('high pressure defense')}
    if(d.pressureRate<.20&&d.plays>100){factor*=1.025;notes.push('low pressure defense')}
  }
  return {factor:clamp(factor,.94,1.06),notes};
}

export function paceGameEnvironment(off={},opp={},market='') {
  const a=normalizeOffense(off), d=normalizeDefense(opp);
  let factor=1,notes=[];
  const paceA=safe(a.pace),paceD=safe(d.pace);
  if(paceA&&paceD) {
    // seconds/play lower = faster. Convert the midpoint into a modest volume modifier.
    const avg=(paceA+paceD)/2;
    if(avg<25.5){factor*=1.035;notes.push('fast combined pace')}
    else if(avg>30){factor*=.965;notes.push('slow combined pace')}
  }
  if(a.passRate>.64 && ['passing_yards','passing_attempts','receptions','targets','receiving_yards'].includes(market)){
    factor*=1.02;notes.push('pass-heavy offense')
  }
  if(a.passRate<.52 && ['rushing_yards','rushing_attempts'].includes(market)){
    factor*=1.02;notes.push('run-heavy offense')
  }
  return {factor:clamp(factor,.93,1.08),notes};
}

export function gameScript({spread=0,total=43,teamPassRate=.58,opponentPassRate=.58,market=''}) {
  const s=safe(spread),t=safe(total,43);
  let factor=1,notes=[];
  const pass=['passing_yards','passing_attempts','receptions','targets','receiving_yards'].includes(market);
  const rush=['rushing_yards','rushing_attempts'].includes(market);
  if(pass && s<-.5){factor*=1.02;notes.push('favorite/pass-volume script')}
  if(pass && s>7){factor*=1.025;notes.push('potential catch-up pass script')}
  if(rush && s<-3){factor*=1.025;notes.push('favorite/clock-killing rush script')}
  if(rush && s>7){factor*=.965;notes.push('underdog negative-script risk')}
  if(t>50){factor*=1.02;notes.push('high game total')}
  if(t<39){factor*=.975;notes.push('low game total')}
  return {factor:clamp(factor,.92,1.08),notes};
}

export function weatherFactor({wind=0,precip=false,temp=65,roof=''}={},market='') {
  let factor=1,notes=[];
  const outdoor=!['dome','closed'].includes(String(roof).toLowerCase());
  if(outdoor && wind>=18 && ['passing_yards','receiving_yards','receptions','targets'].includes(market)){
    factor*=.95;notes.push(`${wind} mph wind`)
  }
  if(outdoor && precip && ['passing_yards','receiving_yards'].includes(market)){factor*=.975;notes.push('precipitation')}
  if(outdoor && temp<25 && ['passing_yards','receiving_yards'].includes(market)){factor*=.985;notes.push('cold weather')}
  return {factor:clamp(factor,.90,1.02),notes};
}

export function matchupScore(parts=[]) {
  const valid=parts.filter(x=>x&&Number.isFinite(x.factor));
  if(!valid.length)return {factor:1,score:50,notes:[]};
  const factor=clamp(valid.reduce((p,x)=>p*x.factor,1),.82,1.18);
  const score=clamp(50+(factor-1)*500,0,100);
  return {factor,score,notes:valid.flatMap(x=>x.notes||[])};
}

export function buildMatchupProfile({defense={},offense={},weather={},spread=0,total=43,player={},market=''}) {
  const pieces=[
    coverageMatchup(defense,player),
    pressureMatchup(defense,player,market),
    paceGameEnvironment(offense,defense,market),
    gameScript({spread,total,teamPassRate:offense.passRate,market}),
    weatherFactor(weather,market)
  ];
  return {...matchupScore(pieces),components:pieces.map((p,i)=>({i,factor:p.factor,notes:p.notes}))};
}

export function applyMatchup(base,profile={}) {
  if(!Number.isFinite(Number(base)))return {projection:null,delta:null};
  return {projection:Number(base)*(profile.factor||1),delta:Number(base)*((profile.factor||1)-1)};
}

export function defensiveRankings(rows=[]) {
  return rows.map(r=>{
    const d=normalizeDefense(r);
    const pressure=clamp(50+(d.pressureRate-.23)*220,0,100);
    const run=clamp(50-d.rushEpa*180,0,100);
    const pass=clamp(50-d.passEpa*180,0,100);
    return {...d,pressureScore:pressure,runScore:run,passScore:pass};
  }).sort((a,b)=>(b.passScore+b.runScore)-(a.passScore+a.runScore));
}

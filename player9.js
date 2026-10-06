// Step 9: player-level matchup intelligence.
// Joins player usage/route observations to Step 8 defense features, offensive-line
// availability and pass-rush context. Missing fields remain missing; no forced edge.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
const key=x=>String(x??'').trim().toUpperCase();
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const rate=(a,b)=>b?a/b:null;

export const PLAYER_DEFAULTS={
 routeRate:.72,targetRate:.14,catchRate:.65,pressureRate:.23,passRushRate:.25,
 olPressureAllowed:.23,playerShare:.15
};

function playerRow(r={}){
  const pos=key(r.position_group??r.receiver_position??r.position);
  return {
    playerId:String(r.player_id??r.playerId??r.gsis_id??r.gsisId??''), player:String(r.player??r.player_name??r.name??''),
    team:key(r.team??r.posteam), opponent:key(r.opponent??r.defteam), position:pos,
    gameId:String(r.game_id??r.gameId??''), week:num(r.week), season:num(r.season),
    route:String(r.route??'').trim().toUpperCase(), coverage:key(r.defense_coverage_type??r.coverage_type??r.coverage),
    targets:num(r.targets), receptions:num(r.receptions), receivingYards:num(r.receiving_yards??r.rec_yards??r.yards_gained),
    airYards:num(r.air_yards), routes:num(r.routes??r.route_participation), snaps:num(r.snaps??r.offensive_snaps),
    rushAttempts:num(r.rush_attempts), rushYards:num(r.rushing_yards??r.rush_yards),
    pressures:num(r.pressures??r.pressure_events), passBlockSnaps:num(r.pass_block_snaps), sacksAllowed:num(r.sacks_allowed),
    olSlot:key(r.ol_slot??r.position_slot), olRank:num(r.ol_rank??r.rank),
    actual:num(r.actual), modelProbability:r.modelProbability===''?null:num(r.modelProbability,NaN)
  };
}

function weighted(rows,fn,halfLife=4){
  if(!rows.length)return null; const latest=Math.max(...rows.map(r=>r.week).filter(x=>x>0),0); let sw=0,s=0;
  for(const r of rows){const age=Math.max(0,latest-r.week),w=Math.pow(.5,age/halfLife),v=fn(r);if(Number.isFinite(v)){sw+=w;s+=w*v;}}
  return sw?s/sw:null;
}
function shrink(v,n,league,prior=30){if(v==null)return league;const w=n/(n+prior);return league+(v-league)*w;}
function confidence(n){return clamp(20+Math.log10(Math.max(1,n))*28,20,95);}

export function buildPlayerProfiles(rows=[]){
  const rr=rows.map(playerRow).filter(r=>r.playerId||r.player);
  const groups=new Map();
  for(const r of rr){const k=r.playerId||`${r.player}|${r.team}`;const g=groups.get(k)||{playerId:r.playerId,player:r.player,team:r.team,position:r.position,rows:[]};g.rows.push(r);groups.set(k,g)}
  return [...groups.values()].map(g=>{const x=g.rows;const routes=x.filter(r=>r.routes>0||r.route);const pass=x.filter(r=>r.targets>0||r.route);const n=x.length;
    return {...g,sample:n,games:new Set(x.map(r=>r.gameId).filter(Boolean)).size,
      routeRate:shrink(weighted(routes,r=>r.routes&&r.snaps?r.routes/r.snaps:null),routes.length,PLAYER_DEFAULTS.routeRate,20),
      targetRate:shrink(weighted(pass,r=>r.targets&&r.routes?r.targets/r.routes:null),pass.length,PLAYER_DEFAULTS.targetRate,25),
      catchRate:shrink(weighted(pass,r=>r.targets?r.receptions/r.targets:null),pass.length,PLAYER_DEFAULTS.catchRate,25),
      yardsPerTarget:weighted(pass,r=>r.targets?r.receivingYards/r.targets:null),
      airYardsPerTarget:weighted(pass,r=>r.targets?r.airYards/r.targets:null),
      pressureRate:weighted(pass,r=>r.passBlockSnaps?r.pressures/r.passBlockSnaps:null),
      latestWeek:Math.max(...x.map(r=>r.week),0),confidence:confidence(n),rows:x
    };
  });
}

export function routeCoveragePlayerSplits(rows=[]){
  const rr=rows.map(playerRow).filter(r=>r.playerId&&r.route&&r.coverage);
  const m=new Map();
  for(const r of rr){const cov=/COVER_0|COVER_1|COVER_1_RAID/.test(r.coverage)?'MAN':'ZONE';const k=`${r.playerId}|${r.route}|${cov}`;const g=m.get(k)||{playerId:r.playerId,player:r.player,team:r.team,position:r.position,route:r.route,coverage:cov,n:0,targets:0,receptions:0,yards:0};g.n++;g.targets+=r.targets;g.receptions+=r.receptions;g.yards+=r.receivingYards;m.set(k,g)}
  return [...m.values()].map(g=>({...g,catchRate:rate(g.receptions,g.targets),yardsPerTarget:rate(g.yards,g.targets),confidence:confidence(g.n)}));
}

export function offensiveLineContext({olRows=[],team='',week=0}={}){
  const rows=olRows.map(playerRow).filter(r=>r.team===key(team)&&(!week||r.week===week)&&r.olSlot);
  if(!rows.length)return {team:key(team),available:false,confidence:0,notes:['No offensive-line depth/availability data']};
  const starters=rows.filter(r=>r.olRank===1);const depthLoss=Math.max(0,5-starters.length);
  return {team:key(team),available:true,starterCount:starters.length,depthLoss,pressureRisk:clamp(1+depthLoss*.025,.95,1.12),confidence:confidence(rows.length),starters:starters.map(r=>({slot:r.olSlot,player:r.player,playerId:r.playerId}))};
}

export function passRushContext({defense={},ol={},position='QB'}={}){
  const pressure=num(defense.pressureRate,.23),blitz=num(defense.blitzRate,.25),olRisk=num(ol.pressureRisk,1);
  const factor=clamp(1+(pressure-.23)*.35+(blitz-.25)*.12+(olRisk-1)*.25,.88,1.12);
  return {factor,pressureRate:pressure,blitzRate:blitz,notes:[pressure>.28?'high pressure environment':pressure<.20?'low pressure environment':'',olRisk>1.04?'OL availability risk':''].filter(Boolean)};
}

export function playerMatchup({player={},defense={},positionAllowed={},coverageSplits=[],olContext={},market=''}={}){
  const pos=key(player.position||player.position_group), p=player;
  let factor=1,notes=[];
  if(['WR','TE'].includes(pos)){
    if(positionAllowed.explosiveRate!=null) factor*=clamp(1+(num(positionAllowed.explosiveRate)-.10)*.12,.96,1.04);
    if(positionAllowed.yardsPerPlay!=null) factor*=clamp(1+(num(positionAllowed.yardsPerPlay)-6)*.008,.96,1.04);
  }
  if(pos==='RB'&&positionAllowed.yardsPerPlay!=null) factor*=clamp(1+(num(positionAllowed.yardsPerPlay)-4.2)*.01,.95,1.05);
  const split=coverageSplits.filter(x=>x.playerId===p.playerId);
  if(split.length){const weightedY=mean(split.map(x=>x.yardsPerTarget).filter(Number.isFinite));if(Number.isFinite(weightedY)) {factor*=clamp(1+(weightedY-7)*.008,.97,1.03);notes.push('player route/coverage history')}}
  const pr=passRushContext({defense,ol:olContext,position:pos});
  if(['QB','WR','TE'].includes(pos)&&['passing_yards','passing_attempts','receiving_yards','receptions','targets'].includes(market)) factor*=pr.factor;
  if(['QB','WR','TE'].includes(pos)&&pr.notes.length)notes.push(...pr.notes);
  if(positionAllowed.sample)notes.push(`${positionAllowed.sample} opponent ${pos} plays`);
  return {factor:clamp(factor,.84,1.16),notes,components:{positionAllowance:positionAllowed,routeCoverageSample:split.length,passRush:pr,ol:olContext}};
}

export function injuryDepthScenario({player={},injuries=[],depth=[]}={}){
  const id=String(player.playerId??player.id??'');const name=String(player.player??player.name??'').toLowerCase();
  const injury=(injuries||[]).find(x=>String(x.playerId??x.player_id??'')===id || String(x.player??x.player_name??'').toLowerCase()===name);
  const depthRow=(depth||[]).find(x=>String(x.playerId??x.player_id??'')===id || String(x.player??x.player_name??'').toLowerCase()===name);
  let factor=1,notes=[];
  if(injury){const st=String(injury.status??injury.designation??'').toUpperCase();if(/OUT|IR|DOUBTFUL/.test(st)){factor*=.97;notes.push(`availability: ${st}`)}else if(/QUESTIONABLE|LIMITED/.test(st)){factor*=.985;notes.push(`availability: ${st}`)}}
  if(depthRow){const rank=num(depthRow.rank??depthRow.depthRank,0);if(rank===1)notes.push('primary depth-chart role');if(rank>1){factor*=.98;notes.push(`depth rank ${rank}`)}}
  return {factor,notes};
}

export function buildPlayerMatchupBoard({players=[],warehouse={},olRows=[],injuries=[],depth=[],marketRows=[]}={}){
  const profiles=buildPlayerProfiles(players);const splits=routeCoveragePlayerSplits(players);const pos=(warehouse.positionAllowed||[]);const defs=new Map((warehouse.defenses||[]).map(x=>[key(x.team),x]));
  return profiles.map(p=>{const d=defs.get(key(p.opponent))||{};const pa=pos.find(x=>key(x.team)===key(p.opponent)&&key(x.position)===key(p.position))||{};const ol=offensiveLineContext({olRows,team:p.team,week:p.latestWeek});const sc=injuryDepthScenario({player:p,injuries,depth});const m=playerMatchup({player:p,defense:d,positionAllowed:pa,coverageSplits:splits,olContext:ol,market:marketRows.find(x=>String(x.playerId)===String(p.playerId))?.market||''});return {...p,matchupFactor:clamp(m.factor*sc.factor,.82,1.18),matchupScore:clamp(50+(m.factor*sc.factor-1)*420,0,100),notes:[...m.notes,...sc.notes],components:m.components,scenario:sc,ol};});
}

export function backtestMatchupFeature(rows=[]){
  const rr=rows.map(r=>({...r,p:num(r.modelProjection??r.projection,NaN),actual:num(r.actual,NaN),base:num(r.baseProjection??r.baseline,NaN)})).filter(r=>Number.isFinite(r.p)&&Number.isFinite(r.actual));
  if(!rr.length)return {n:0,hitRate:null,mae:null,improvement:null,byFeature:[]};
  const hit=rr.filter(r=>r.side?(r.side==='OVER'?r.actual>r.line:r.actual<r.line):Math.abs(r.actual-r.p)<Math.abs(r.actual-r.base)).length;
  const mae=mean(rr.map(r=>Math.abs(r.actual-r.p)));const base=rr.filter(r=>Number.isFinite(r.base));const baseMae=mean(base.map(r=>Math.abs(r.actual-r.base)));
  return {n:rr.length,hitRate:hit/rr.length,mae,baseMae,improvement:baseMae!=null?baseMae-mae:null,byFeature:['positionAllowance','routeCoverage','passRush','olAvailability'].map(f=>({feature:f,n:rr.filter(r=>r.features?.includes?.(f)).length}))};
}

export function parsePlayerText(text=''){
  const s=String(text||'').trim();if(!s)return[];try{const j=JSON.parse(s);return Array.isArray(j)?j:(j.rows||j.data||j.players||[])}catch{}
  const lines=s.split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const h=lines[0].split(',').map(x=>x.trim());return lines.slice(1).map(line=>{const v=line.split(',');return Object.fromEntries(h.map((k,i)=>[k,v[i]??'']))});
}

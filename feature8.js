// Step 8: matchup feature warehouse.
// Aggregates normalized PBP / participation rows into auditable team and
// position-level features. No feature is forced when its sample is too small.

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const n=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const rate=(a,b)=>b? a/b:null;
const key=(x)=>String(x??'').trim().toUpperCase();
const bool=(x)=>/^(1|true|yes|y)$/i.test(String(x??''));
const has=(o,...ks)=>ks.find(k=>o?.[k]!==undefined&&o?.[k]!==null&&o?.[k]!=='');

export const LEAGUE_DEFAULTS={
 epaPerPlay:0,passEpa:0,rushEpa:0,successRate:.43,explosiveRate:.10,
 pressureRate:.23,blitzRate:.25,manRate:.35,zoneRate:.65,secondsPerPlay:28.2,
 earlyDownPassRate:.57,redZonePassRate:.56
};

function normPlay(r={}){
 const desc=String(r.desc??r.play_description??'');
 const pass=bool(r.pass_attempt??r.pass_attempt_flag)||n(r.pass_attempt,0)===1||/ pass (complete|incomplete|intercepted)/i.test(desc);
 const rush=bool(r.rush_attempt??r.rush_attempt_flag)||n(r.rush_attempt,0)===1||/ rushed for /i.test(desc);
 const posteam=key(r.posteam??r.offense_team??r.team);
 const defteam=key(r.defteam??r.defense_team??r.opponent);
 const yards=n(r.yards_gained??r.yards,0), epa=n(r.epa,0);
 const success=r.success!==undefined&&r.success!==''?bool(r.success):epa>0;
 const explosive=r.explosive!==undefined&&r.explosive!==''?bool(r.explosive):(pass?yards>=20:rush?yards>=10:false);
 const third=n(r.down)===3;
 const early=n(r.down)===1||n(r.down)===2;
 const rz=r.yardline_100!==undefined?n(r.yardline_100):n(r.yards_to_goal,99);
 const redzone=rz<=20;
 const twoMin=n(r.qtr)>=4&&n(r.game_seconds_remaining)<=120;
 const neutral=Math.abs(n(r.score_differential))<=8&&n(r.qtr)<=3;
 const pressure=bool(r.was_pressure)||n(r.was_pressure)===1;
 const blitz=n(r.number_of_pass_rushers)>4||bool(r.blitz);
 const man=['COVER_0','COVER_1','COVER_1_RAID'].includes(key(r.defense_coverage_type??r.coverage_type??r.coverage));
 const zone=['COVER_2','COVER_2_MAN','COVER_3','COVER_4','COVER_6','COVER_9'].includes(key(r.defense_coverage_type??r.coverage_type??r.coverage));
 return {season:n(r.season),week:n(r.week),gameId:String(r.game_id??r.gameId??''),posteam,defteam,pass,rush,yards,epa,success,explosive,early,third,redzone,twoMin,neutral,pressure,blitz,man,zone,seconds:n(r.play_time_seconds??r.seconds_remaining_play??0),passRoute:key(r.route??''),receiverPosition:key(r.receiver_position??r.position_group??''),receiverId:String(r.receiver_player_id??r.receiver_id??r.player_id??'')};
}

function weighted(rows,fn,halfLife=4){
 if(!rows.length)return null;
 const weeks=rows.map(x=>n(x.week)).filter(x=>x>0), latest=weeks.length?Math.max(...weeks):0;
 let sw=0,s=0;for(const r of rows){const age=Math.max(0,latest-n(r.week));const w=Math.pow(.5,age/halfLife);const v=fn(r);if(Number.isFinite(v)){sw+=w;s+=w*v}}
 return sw?s/sw:null;
}

function shrink(value,sample,league,prior=40){
 if(value==null)return league;
 const w=sample/(sample+prior);
 return league+(value-league)*w;
}

function teamAgg(team, rows){
 const pass=rows.filter(r=>r.pass), rush=rows.filter(r=>r.rush), all=rows;
 const passN=pass.length,rushN=rush.length,plays=all.length;
 const rz=all.filter(r=>r.redzone), early=all.filter(r=>r.early), neutral=all.filter(r=>r.neutral);
 const coverage=all.filter(r=>r.pass&&(r.man||r.zone));
 const pressures=pass.filter(r=>r.pressure), blitz=pass.filter(r=>r.blitz);
 const feature=(raw,league)=>shrink(raw,plays,league);
 return {
  team,plays,passPlays:passN,rushPlays:rushN,
  epaPerPlay:feature(weighted(all,r=>r.epa),LEAGUE_DEFAULTS.epaPerPlay),
  passEpa:shrink(weighted(pass,r=>r.epa),passN,LEAGUE_DEFAULTS.passEpa,30),
  rushEpa:shrink(weighted(rush,r=>r.epa),rushN,LEAGUE_DEFAULTS.rushEpa,30),
  successRate:shrink(weighted(all,r=>r.success?1:0),plays,LEAGUE_DEFAULTS.successRate),
  explosiveRate:shrink(weighted(all,r=>r.explosive?1:0),plays,LEAGUE_DEFAULTS.explosiveRate),
  pressureRate:shrink(weighted(pressures,r=>1,passN),passN,LEAGUE_DEFAULTS.pressureRate,50),
  blitzRate:shrink(weighted(blitz,r=>1,passN),passN,LEAGUE_DEFAULTS.blitzRate,50),
  manRate:coverage.length?weighted(coverage,r=>r.man?1:0):LEAGUE_DEFAULTS.manRate,
  zoneRate:coverage.length?weighted(coverage,r=>r.zone?1:0):LEAGUE_DEFAULTS.zoneRate,
  secondsPerPlay:weighted(all,r=>r.seconds||null)||LEAGUE_DEFAULTS.secondsPerPlay,
  earlyDownPassRate:rate(early.filter(r=>r.pass).length,early.length),
  neutralPassRate:rate(neutral.filter(r=>r.pass).length,neutral.length),
  redZonePassRate:rate(rz.filter(r=>r.pass).length,rz.length),
  redZonePlays:rz.length,
  thirdDownPassRate:rate(all.filter(r=>r.third&&r.pass).length,all.filter(r=>r.third).length),
  explosivePassRate:rate(pass.filter(r=>r.explosive).length,passN),
  explosiveRushRate:rate(rush.filter(r=>r.explosive).length,rushN),
  sampleConfidence:clamp(25+Math.log10(Math.max(1,plays))*28,25,95),
  latestWeek:Math.max(0,...rows.map(r=>n(r.week))),
  source:'Step 8 PBP feature warehouse'
 };
}

function positionAllowed(defteam, rows){
 const out=[];
 const groups=['QB','RB','WR','TE'];
 for(const pos of groups){
  const rr=rows.filter(r=>r.defteam===defteam&&r.receiverPosition===pos);
  if(!rr.length)continue;
  const pass=rr.filter(r=>r.pass);
  out.push({team:defteam,position:pos,sample:rr.length,passPlays:pass.length,
    epaAllowed:mean(rr.map(r=>r.epa)),yardsPerPlay:mean(rr.map(r=>r.yards)),
    explosiveRate:rate(rr.filter(r=>r.explosive).length,rr.length),
    successRate:rate(rr.filter(r=>r.success).length,rr.length),
    pressureRate:pass.length?rate(pass.filter(r=>r.pressure).length,pass.length):null,
    routeCount:rr.filter(r=>r.passRoute).length,
    confidence:clamp(20+Math.log10(rr.length)*30,20,95)});
 }
 return out;
}

function coverageRoutes(rows){
 const groups=new Map();
 for(const r of rows.filter(x=>x.pass&&x.passRoute)){
  const cov=r.man?'MAN':r.zone?'ZONE':'UNKNOWN', route=r.passRoute;
  const k=`${r.defteam}|${route}|${cov}`;const g=groups.get(k)||{team:r.defteam,route,coverage:cov,n:0,epa:0,yards:0,explosive:0};
  g.n++;g.epa+=r.epa;g.yards+=r.yards;g.explosive+=r.explosive?1:0;groups.set(k,g);
 }
 return [...groups.values()].map(g=>({...g,epaPerPlay:g.epa/g.n,yardsPerPlay:g.yards/g.n,explosiveRate:g.explosive/g.n,confidence:clamp(20+Math.log10(g.n)*30,20,95)}));
}

function situations(rows){
 const defs=new Map();
 for(const r of rows){const g=defs.get(r.defteam)||{team:r.defteam,neutral:[],early:[],redzone:[],twoMin:[]};if(r.neutral)g.neutral.push(r);if(r.early)g.early.push(r);if(r.redzone)g.redzone.push(r);if(r.twoMin)g.twoMin.push(r);defs.set(r.defteam,g)}
 return [...defs.values()].map(g=>({team:g.team,
  neutralPassRate:rate(g.neutral.filter(r=>r.pass).length,g.neutral.length),
  earlyDownPassRate:rate(g.early.filter(r=>r.pass).length,g.early.length),
  redZonePassRate:rate(g.redzone.filter(r=>r.pass).length,g.redzone.length),
  twoMinutePassRate:rate(g.twoMin.filter(r=>r.pass).length,g.twoMin.length),
  samples:{neutral:g.neutral.length,early:g.early.length,redzone:g.redzone.length,twoMin:g.twoMin.length}
 }));
}

export function buildFeatureWarehouse({plays=[],participation=[]}={}){
 const rows=(plays||[]).map(normPlay).filter(r=>r.posteam||r.defteam);
 // Participation is optional. If supplied, merge its coverage/route fields by game/player/week.
 const part=(participation||[]).map(normPlay);
 const merged=rows.map(r=>{const p=part.find(x=>x.gameId===r.gameId&&x.receiverId&&x.receiverId===r.receiverId&&x.week===r.week);return p?{...r,passRoute:p.passRoute||r.passRoute,receiverPosition:p.receiverPosition||r.receiverPosition,man:r.man||p.man,zone:r.zone||p.zone,pressure:r.pressure||p.pressure,blitz:r.blitz||p.blitz}:r});
 const teams=[...new Set(merged.flatMap(r=>[r.posteam,r.defteam]).filter(Boolean))];
 const defenses=teams.map(t=>teamAgg(t,merged.filter(r=>r.defteam===t)));
 const offenses=teams.map(t=>{const a=teamAgg(t,merged.filter(r=>r.posteam===t));return {...a,team:t,offensive:true}});
 const positions=teams.flatMap(t=>positionAllowed(t,merged));
 const routes=coverageRoutes(merged), situational=situations(merged);
 return {version:'8.0',createdAt:new Date().toISOString(),rows:merged.length,defenses,offenses,positionAllowed:positions,coverageRoutes:routes,situational,
  leagueDefaults:LEAGUE_DEFAULTS,provenance:{playRows:plays.length,participationRows:participation.length,recencyHalfLifeWeeks:4,shrinkagePriorPlays:40},
  dataQuality:{games:new Set(merged.map(r=>r.gameId).filter(Boolean)).size,weeks:new Set(merged.map(r=>r.week).filter(Boolean)).size,rows:merged.length,coverageRows:routes.length,positionRows:positions.length}};
}

export function positionMatchupScore({defense={},position='',market=''}={}){
 const d=defense||{};const pos=key(position);let factor=1,notes=[];
 if(['QB','WR','TE'].includes(pos)&&n(d.passEpa)>0){factor*=clamp(1+n(d.passEpa)*.25,.93,1.07);notes.push('pass EPA allowed context')}
 if(pos==='RB'&&n(d.rushEpa)>0){factor*=clamp(1+n(d.rushEpa)*.25,.93,1.07);notes.push('rush EPA allowed context')}
 if(n(d.explosiveRate)>0){factor*=clamp(1+(n(d.explosiveRate)-.10)*.12,.97,1.03);notes.push('explosive-play environment')}
 return {factor:clamp(factor,.90,1.10),notes};
}

export function warehouseToMatchup(warehouse={}){
 return {defenses:(warehouse.defenses||[]).map(d=>({...d,passYardsAllowed:d.passYardsAllowed??null,rushYardsAllowed:d.rushYardsAllowed??null,pace:d.secondsPerPlay,blitzRate:d.blitzRate,pressureRate:d.pressureRate})),offenses:warehouse.offenses||[],positionAllowed:warehouse.positionAllowed||[],coverageRoutes:warehouse.coverageRoutes||[],situational:warehouse.situational||[]};
}

export function parseFeatureText(text=''){
 const s=String(text||'').trim();if(!s)return [];
 try{const j=JSON.parse(s);return Array.isArray(j)?j:(j.rows||j.data||[])}catch{}
 const lines=s.split(/\r?\n/).filter(Boolean);if(lines.length<2)return [];
 const parseLine=line=>{const out=[];let c='',q=false;for(let i=0;i<line.length;i++){const ch=line[i],nx=line[i+1];if(ch==='"'&&q&&nx==='"'){c+='"';i++;continue}if(ch==='"'){q=!q;continue}if(ch===','&&!q){out.push(c);c='';continue}c+=ch}out.push(c);return out};
 const h=parseLine(lines[0]);return lines.slice(1).map(line=>Object.fromEntries(h.map((x,i)=>[x,parseLine(line)[i]??''])));
}

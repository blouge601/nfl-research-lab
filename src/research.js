
import {fetchSeasonGames,fetchSeasonStats,fetchPlayers,fetchInjuries,fetchDepthCharts,fetchRosters} from './data.js';
const n=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const key=x=>String(x??'').trim().toUpperCase();

export function buildPlayerRows(stats=[]){
 const m=new Map();
 for(const s of stats){const id=s.playerId||s.player;if(!id)continue;if(!m.has(id))m.set(id,[]);m.get(id).push(s)}
 return [...m].map(([id,r])=>{
  const sum=k=>r.reduce((a,x)=>a+n(x[k]),0), games=new Set(r.map(x=>x.week).filter(Boolean)).size||r.length||1;
  const p=r[r.length-1]||{};
  const targets=sum('targets'),carries=sum('carries'),rec=sum('receptions'),ry=sum('recYds'),rsh=sum('rushYds'),py=sum('passYds'),sn=sum('snaps'),routes=sum('routes');
  return {playerId:id,player:p.player||'Unknown',team:p.team||'',position:p.position||'',games,targets,carries,receptions:rec,recYds:ry,rushYds:rsh,passYds:py,snaps:sn,routes,
   tds:sum('passTD')+sum('rushTD')+sum('recTD'),targetsG:targets/games,carriesG:carries/games,receptionsG:rec/games,recYdsG:ry/games,rushYdsG:rsh/games,passYdsG:py/games,
   snapsG:sn/games,routesG:routes/games,tdsG:(sum('passTD')+sum('rushTD')+sum('recTD'))/games,lastWeek:Math.max(...r.map(x=>x.week||0))}
 })
}
export function buildBoard(stats=[]){return buildPlayerRows(stats).sort((a,b)=>(b.targets+b.carries)-(a.targets+a.carries))}
export function playerTier(p){const u=p.targetsG+p.carriesG;return u>=22?'ELITE':u>=16?'STAR':u>=10?'STARTER':u>=5?'ROLE':'DEPTH'}
export function recentRows(stats=[],playerId,weeks=4){
 const max=Math.max(...stats.map(x=>x.week||0),0);return stats.filter(x=>(x.playerId===playerId)&&(max-(x.week||0)<weeks))
}
export function summarizePlayer(p,stats){
 const rr=recentRows(stats,p.playerId,4),games=rr.length||1;
 return {...p,recentGames:rr.length,recentTargetsG:rr.reduce((s,x)=>s+n(x.targets),0)/games,recentCarriesG:rr.reduce((s,x)=>s+n(x.carries),0)/games,
  recentRecYdsG:rr.reduce((s,x)=>s+n(x.recYds),0)/games,recentRushYdsG:rr.reduce((s,x)=>s+n(x.rushYds),0)/games}
}
export function buildMatchups(board,games,injuries,depth){
 const byTeam=new Map(board.map(x=>[key(x.team),x]));
 const latest=new Map();
 for(const g of games){if(!g.home||!g.away)continue;latest.set(g.home,{opponent:g.away,home:true,game:g});latest.set(g.away,{opponent:g.home,home:false,game:g})}
 return board.map(p=>{
  const x=latest.get(key(p.team));const d=(depth||[]).filter(z=>z.playerId===p.playerId).sort((a,b)=>(a.rank||99)-(b.rank||99))[0];
  const inj=(injuries||[]).filter(z=>z.playerId===p.playerId).sort((a,b)=>(b.week||0)-(a.week||0))[0];
  const opp=key(x?.opponent);const position=p.position||'';
  let factor=1,notes=[];
  if(['WR','TE'].includes(position))factor*=1.02;
  if(position==='RB')factor*=1.00;
  if(position==='QB')factor*=1.00;
  if(d?.rank===1)notes.push('top depth-chart slot'); if(d?.rank>1)notes.push(`depth rank ${d.rank}`);
  const status=String(inj?.gameStatus||'').toUpperCase(); if(/OUT|IR|DOUBTFUL/.test(status)){factor*=.97;notes.push(`availability: ${status}`)}
  if(/QUESTIONABLE|LIMITED/.test(status)){factor*=.985;notes.push(`availability: ${status}`)}
  return {...p,opponent:opp,nextGame:x?.game||null,matchupFactor:factor,matchupScore:clamp(50+(factor-1)*500,0,100),notes}
 })
}
function pct(x){return `${(x*100).toFixed(1)}%`}
export function buildEdges(board){
 return board.flatMap(p=>{
  const usage=p.targetsG+p.carriesG;
  if(usage<5)return[];
  const baseline=(p.position==='RB'?p.rushYdsG:p.recYdsG)||0;
  const recent=(p.recentRecYdsG??baseline);
  const edge=baseline?((recent-baseline)/Math.max(1,baseline)):0;
  return [{...p,tier:playerTier(p),signal:edge,signalLabel:edge>=.08?'UP':edge<=-.08?'DOWN':'NEUTRAL',
    confidence:clamp(40+p.games*6+(usage>=12?15:0),0,95),explanation:edge>=.08?'Recent production is above season baseline.':edge<=-.08?'Recent production is below season baseline.':'Recent production is near season baseline.'}]
 })
}
export async function loadResearch(season=2026){
 const [games,players,stats,injuries,depth,rosters]=await Promise.all([
  fetchSeasonGames(season),fetchPlayers(),fetchSeasonStats(season),fetchInjuries(season),fetchDepthCharts(season),fetchRosters(season)
 ]);
 const statsData=stats.data||[], board=buildBoard(statsData);
 const identity=[...(players.data||[]),...(rosters.data||[])];
 const byId=new Map(identity.filter(x=>x.id).map(x=>[x.id,x]));
 for(const p of board){const i=byId.get(p.playerId);if(i){p.player=i.name||p.player;p.team=p.team||i.team;p.position=p.position||i.position}}
 const enriched=board.map(p=>summarizePlayer(p,statsData));
 return {season,seasonUsed:statsData.length?season:null,games,players,stats,playerStats:stats,injuries,depth,rosters,board:enriched,
   matchups:buildMatchups(enriched,games.data||[],injuries.data||[],depth.data||[]),edges:buildEdges(enriched),
   meta:{counts:{players:players.data.length,stats:statsData.length,games:games.data.length,injuries:injuries.data.length,depth:depth.data.length,rosters:rosters.data.length},
    sources:{players,stats,games,injuries,depth,rosters}}}
}

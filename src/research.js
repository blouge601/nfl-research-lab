import {fetchSeasonGames,fetchSeasonStats,fetchPlayers,fetchInjuries} from './data.js';

const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function buildPlayerRows(stats=[]){
 const map=new Map();
 for(const s of stats){const id=s.playerId||s.player;if(!map.has(id))map.set(id,[]);map.get(id).push(s)}
 return [...map].map(([id,r])=>{
   const games=r.length||1, sum=k=>r.reduce((a,x)=>a+Number(x[k]||0),0);
   const targets=sum('targets'), carries=sum('carries'), rec=sum('receptions');
   const recYds=sum('recYds'), rushYds=sum('rushYds'), passYds=sum('passYds');
   const snaps=sum('snaps'), routes=sum('routes');
   const tds=sum('passTD')+sum('rushTD')+sum('recTD');
   const p=r[r.length-1]||{};
   return {playerId:id,player:p.player||'Unknown',team:p.team||'',position:p.position||'',games,
    targets,carries,receptions:rec,recYds,rushYds,passYds,tds,
    targetsG:targets/games,carriesG:carries/games,receptionsG:rec/games,
    recYdsG:recYds/games,rushYdsG:rushYds/games,passYdsG:passYds/games,
    snaps,snapsG:snaps/games,routes,routesG:routes/games};
 })
}

const trend=(a)=>{if(a.length<3)return 'INSUFFICIENT';const m=Math.floor(a.length/2),x=avg(a.slice(0,m)),y=avg(a.slice(m));return y>x+Math.max(.5,Math.abs(x)*.08)?'UP':y<x-Math.max(.5,Math.abs(x)*.08)?'DOWN':'FLAT'};

export function researchPlayer(id,stats=[],games=[],injuries=[]){
 const rows=stats.filter(x=>x.playerId===id); if(!rows.length)return null;
 const p=buildPlayerRows(rows)[0], recent=rows.slice(-5);
 const role=clamp(p.targetsG + p.carriesG*.65,0,25);
 const targetTrend=trend(recent.map(x=>+x.targets||0));
 const rushTrend=trend(recent.map(x=>+x.rushYds||0));
 const recTrend=trend(recent.map(x=>+x.recYds||0));
 const injury=injuries.find(x=>x.playerId===id || (x.player===p.player&&x.team===p.team));
 const signals=[];
 if(p.targetsG>=6)signals.push(['USAGE','High target volume',p.targetsG.toFixed(1)+' tgt/g']);
 if(p.carriesG>=10)signals.push(['USAGE','Meaningful rushing workload',p.carriesG.toFixed(1)+' car/g']);
 if(targetTrend==='UP')signals.push(['TREND','Target volume rising','Recent > early']);
 if(targetTrend==='DOWN')signals.push(['TREND','Target volume falling','Recent < early']);
 if(rushTrend==='UP')signals.push(['TREND','Rushing production rising','Recent > early']);
 if(recTrend==='UP')signals.push(['TREND','Receiving production rising','Recent > early']);
 if(injury && /out|doubtful|inactive/i.test(injury.gameStatus||''))signals.push(['AVAILABILITY','Availability concern',injury.gameStatus]);
 const confidence=clamp(35+rows.length*8+(rows.length>=5?15:0),0,95);
 return {p,recent,role,targetTrend,rushTrend,recTrend,confidence,signals,injury,
   opponents:games.filter(g=>g.home===p.team||g.away===p.team).slice(-5).map(g=>g.home===p.team?g.away:g.home)}
}

export function buildBoard(stats,games,injuries){
 return buildPlayerRows(stats).map(p=>{const r=researchPlayer(p.playerId,stats,games,injuries);return {...p,role:r?.role||0,confidence:r?.confidence||0,signals:r?.signals.length||0,targetTrend:r?.targetTrend||'INSUFFICIENT'}})
 .sort((a,b)=>(b.role+b.signals*2)-(a.role+a.signals*2));
}
export async function loadResearch(season){
 const [games,players,stats,injuries]=await Promise.all([fetchSeasonGames(season),fetchPlayers(season),fetchSeasonStats(season),fetchInjuries(season)]);
 return {season, games, players, stats, playerStats:stats, injuries, depth:{data:[],source:'nflverse rosters/depth charts',live:false,error:'Configure depth-chart endpoint for browser ingestion'}, board:buildBoard(stats.data||[],games.data||[],injuries.data||[])};
}

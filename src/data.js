
const CACHE_KEY='nfl-lab-final-cache-v1';
const BASE=new URL('./data/nfl/',document.baseURI).href.replace(/\/$/,'');
const GH='https://github.com/nflverse/nflverse-data/releases/download';
const SOURCES={
 schedules:{label:'Schedules',tag:'schedules'},
 players:{label:'Players',tag:'players'},
 stats:{label:'Player stats',tag:'stats_player'},
 injuries:{label:'Injuries',tag:'injuries'},
 depth:{label:'Depth charts',tag:'depth_charts'},
 rosters:{label:'Rosters',tag:'rosters'}
};
const num=(x,d=0)=>{const n=Number(x);return Number.isFinite(n)?n:d};
const text=(x,d='')=>x==null?d:String(x);
const first=(o,keys,d='')=>{for(const k of keys)if(o?.[k]!==''&&o?.[k]!=null)return o[k];return d};

export function normalizePlayer(p={}){return{
 id:text(first(p,['gsis_id','player_id','id','football_player_id'])),
 name:text(first(p,['display_name','full_name','player_display_name','player_name','name']),'Unknown Player'),
 position:text(first(p,['position','position_group','pos'])),
 team:text(first(p,['team','recent_team','team_abbr','team_abbreviation'])),
 jersey:text(first(p,['jersey_number','jersey'])),
 status:text(first(p,['status','roster_status']),'active')
}}
export function normalizeGame(g={}){return{
 id:text(first(g,['game_id','id'])),season:num(first(g,['season','season_year'])),
 week:num(first(g,['week','week_num'])),date:text(first(g,['gameday','game_date','date','gamedate'])),
 home:text(first(g,['home_team','home','home_team_abbr'])),away:text(first(g,['away_team','away','away_team_abbr'])),
 homeScore:g.home_score===''||g.home_score==null?null:num(g.home_score),
 awayScore:g.away_score===''||g.away_score==null?null:num(g.away_score),
 type:text(first(g,['game_type','season_type']),'REG'),status:text(first(g,['result','status']),'')
}}
export function normalizeStat(s={}){return{
 season:num(first(s,['season','season_year'])),week:num(first(s,['week','week_num'])),
 playerId:text(first(s,['player_id','gsis_id','id','fantasy_player_id'])),
 player:text(first(s,['player_display_name','player_name','name']),'Unknown Player'),
 team:text(first(s,['recent_team','team','posteam'])),position:text(first(s,['position','position_group'])),
 passYds:num(first(s,['passing_yards','pass_yds'])),rushYds:num(first(s,['rushing_yards','rush_yds'])),
 recYds:num(first(s,['receiving_yards','rec_yds'])),targets:num(first(s,['targets','target'])),
 receptions:num(first(s,['receptions','rec'])),carries:num(first(s,['carries','rushing_attempts','rush_att'])),
 passTD:num(first(s,['passing_tds','pass_td'])),rushTD:num(first(s,['rushing_tds','rush_td'])),
 recTD:num(first(s,['receiving_tds','rec_td'])),snaps:num(first(s,['offense_snaps','offensive_snaps','snaps'])),
 routes:num(first(s,['routes','route_runs'])),fantasy:num(first(s,['fantasy_points','fantasy_points_ppr']))
}}
export function normalizeInjury(i={}){return{
 season:num(first(i,['season','season_year'])),week:num(first(i,['week','week_num'])),
 playerId:text(first(i,['gsis_id','player_id','id'])),player:text(first(i,['full_name','player_name','name'])),
 team:text(first(i,['team','recent_team'])),position:text(first(i,['position','position_group'])),
 reportDate:text(first(i,['report_date','date'])),practice:text(first(i,['practice_status','practice'])),
 gameStatus:text(first(i,['game_status','status','designation'])),injury:text(first(i,['injury','injury_type','report_primary']))
}}
/* 2025+ nflverse depth charts use dt/team/player_name/pos_* fields. */
export function normalizeDepth(d={}){return{
 season:num(first(d,['season','year'])),date:text(first(d,['dt','date','effective_date'])),
 team:text(first(d,['team','club_code','depth_team','team_abbr','team_abbreviation'])),
 playerId:text(first(d,['gsis_id','player_id','id'])),
 player:text(first(d,['player_name','full_name','football_name','name']),'Unknown Player'),
 position:text(first(d,['pos_abb','pos_name','position','position_group','depth_position','pos'])),
 group:text(first(d,['pos_grp','pos_grp_id','position_group'])),
 slot:text(first(d,['pos_slot','depth_position','position'])),
 rank:num(first(d,['pos_rank','rank','depth','depth_order','depth_rank'])),
 week:num(first(d,['week','week_num']))
}}
function parseCSV(s=''){
 let rows=[],row=[],cell='',q=false;
 for(let i=0;i<s.length;i++){const c=s[i],n=s[i+1];
  if(c==='"'&&q&&n==='"'){cell+='"';i++;continue}
  if(c==='"'){q=!q;continue}
  if(c===','&&!q){row.push(cell);cell='';continue}
  if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);cell='';if(row.some(x=>x!==''))rows.push(row);row=[];continue}
  cell+=c
 }
 if(cell!==''||row.length){row.push(cell);if(row.some(x=>x!==''))rows.push(row)}
 const h=(rows.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,''));
 return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])))
}
async function fetchText(url,timeout=60000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}
}
function cacheRead(k){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')[k]||null}catch{return null}}
function cacheWrite(k,v){try{const b=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');b[k]={updatedAt:new Date().toISOString(),data:v};localStorage.setItem(CACHE_KEY,JSON.stringify(b))}catch{}}
async function loadCSV({key,local,remote,mapper,required=true}){
 let err=null;
 try{const raw=parseCSV(await fetchText(`${BASE}/${local}`));const data=raw.map(mapper).filter(x=>x&&(x.playerId||x.player||x.id||x.gameId||x.team||x.home||x.away));if(!data.length)throw Error('zero normalized rows');cacheWrite(key,data);return{data,live:true,stale:false,source:'GitHub Pages local data',updatedAt:new Date().toISOString(),error:null,required,url:`${BASE}/${local}`}}catch(e){err=e}
 try{const raw=parseCSV(await fetchText(`${GH}/${remote}`));const data=raw.map(mapper).filter(x=>x&&(x.playerId||x.player||x.id||x.gameId||x.team||x.home||x.away));if(!data.length)throw Error('zero normalized rows');cacheWrite(key,data);return{data,live:true,stale:false,source:`nflverse ${remote}`,updatedAt:new Date().toISOString(),error:null,required,url:`${GH}/${remote}`}}catch(e){err=e}
 const c=cacheRead(key);if(c?.data?.length)return{data:c.data,live:false,stale:true,source:'Browser cache',updatedAt:c.updatedAt,error:err?.message||'live unavailable',required};
 return{data:[],live:false,stale:false,source:'Unavailable',updatedAt:null,error:err?.message||'no data',required}
}
export async function fetchSeasonGames(season=2026){return loadCSV({key:`games-${season}`,local:'games.csv',remote:'schedules/games.csv',mapper:normalizeGame})}
export async function fetchPlayers(){return loadCSV({key:'players',local:'players.csv',remote:'players/players.csv',mapper:normalizePlayer})}
export async function fetchSeasonStats(season=2026){
 return loadCSV({key:`stats-${season}`,local:`${season}/stats_player_week_${season}.csv`,remote:`stats_player/stats_player_week_${season}.csv`,mapper:normalizeStat})
}
export async function fetchInjuries(season=2026){return loadCSV({key:`injuries-${season}`,local:`${season}/injuries_${season}.csv`,remote:`injuries/injuries_${season}.csv`,mapper:normalizeInjury})}
export async function fetchDepthCharts(season=2026){return loadCSV({key:`depth-${season}`,local:`${season}/depth_charts_${season}.csv`,remote:`depth_charts/depth_charts_${season}.csv`,mapper:normalizeDepth})}
export async function fetchRosters(season=2026){return loadCSV({key:`rosters-${season}`,local:`${season}/roster_${season}.csv`,remote:`rosters/roster_${season}.csv`,mapper:normalizePlayer})}
export function clearDataCache(){try{localStorage.removeItem(CACHE_KEY)}catch{}}

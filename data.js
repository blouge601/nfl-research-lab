/*
 * NFL Research Lab — Step 11 data-loading layer
 *
 * Primary source: nflverse public release assets.
 * Strategy: live CSV -> previous-season CSV (stats only) -> localStorage cache -> empty.
 * No synthetic performance data is generated. A fallback is always labeled stale.
 */

const CACHE = 'nfl-lab-data-v3';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

export const SOURCES = {
  players: {name:'nflverse players', url:'https://github.com/nflverse/nflverse-data/releases/tag/players', kind:'players'},
  schedules: {name:'nflverse schedules', url:'https://github.com/nflverse/nflverse-data/releases/tag/schedules', kind:'schedules'},
  stats: {name:'nflverse player stats', url:'https://github.com/nflverse/nflverse-data/releases/tag/stats_player', kind:'stats'},
  injuries: {name:'nflverse injuries', url:'https://github.com/nflverse/nflverse-data/releases/tag/injuries', kind:'injuries'},
  depth: {name:'nflverse depth charts', url:'https://github.com/nflverse/nflverse-data/releases/tag/depth_charts', kind:'depth'},
  rosters: {name:'nflverse rosters', url:'https://github.com/nflverse/nflverse-data/releases/tag/rosters', kind:'rosters'},
  participation: {name:'nflverse participation / FTN', url:'https://github.com/nflverse/nflverse-data/releases/tag/participation', kind:'participation'}
};

const TEAM_CODES = new Set(['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']);

const num = (v, d=0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const text = (v, d='') => v == null ? d : String(v);
const first = (o, keys, d='') => {
  for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k];
  return d;
};

export const normalizePlayer = (p={}) => ({
  id:text(first(p,['gsis_id','player_id','id','football_player_id'])),
  name:text(first(p,['display_name','full_name','player_name','name']),'Unknown Player'),
  firstName:text(first(p,['first_name','firstName'])),
  lastName:text(first(p,['last_name','lastName'])),
  position:text(first(p,['position','position_group','pos'])),
  team:text(first(p,['team','recent_team','team_abbr','team_abbreviation'])),
  jersey:text(first(p,['jersey_number','jersey'])),
  status:text(first(p,['status','roster_status']),'active'),
  source:SOURCES.players.name
});

export const normalizeGame = (g={}) => ({
  id:text(first(g,['game_id','id'])),
  season:num(first(g,['season','season_year'])),
  week:num(first(g,['week','week_num'])),
  date:text(first(g,['gameday','game_date','date','gamedate'])),
  home:text(first(g,['home_team','home','home_team_abbr'])),
  away:text(first(g,['away_team','away','away_team_abbr'])),
  homeScore:g.home_score===''||g.home_score==null?null:num(g.home_score),
  awayScore:g.away_score===''||g.away_score==null?null:num(g.away_score),
  status:text(first(g,['game_type','season_type']),'REG'),
  source:SOURCES.schedules.name
});

export const normalizeStat = (s={}) => ({
  season:num(first(s,['season','season_year'])),
  week:num(first(s,['week','week_num'])),
  playerId:text(first(s,['player_id','gsis_id','id','fantasy_player_id'])),
  player:text(first(s,['player_display_name','player_name','name']),'Unknown Player'),
  team:text(first(s,['recent_team','team','posteam'])),
  position:text(first(s,['position','position_group'])),
  passYds:num(first(s,['passing_yards','pass_yds'])),
  rushYds:num(first(s,['rushing_yards','rush_yds'])),
  recYds:num(first(s,['receiving_yards','rec_yds'])),
  targets:num(first(s,['targets','target'])),
  receptions:num(first(s,['receptions','rec'])),
  carries:num(first(s,['carries','rushing_attempts','rush_att'])),
  passTD:num(first(s,['passing_tds','pass_td','passing_touchdowns'])),
  rushTD:num(first(s,['rushing_tds','rush_td','rushing_touchdowns'])),
  recTD:num(first(s,['receiving_tds','rec_td','receiving_touchdowns'])),
  snaps:num(first(s,['offense_snaps','offensive_snaps','snaps'])),
  routes:num(first(s,['routes','route_runs'])),
  fantasy:num(first(s,['fantasy_points','fantasy_points_ppr'])),
  source:SOURCES.stats.name
});

export const normalizeInjury = (i={}) => ({
  season:num(first(i,['season','season_year'])),
  week:num(first(i,['week','week_num'])),
  playerId:text(first(i,['gsis_id','player_id','id'])),
  player:text(first(i,['full_name','player_name','name']),'Unknown Player'),
  team:text(first(i,['team','recent_team'])),
  position:text(first(i,['position','position_group'])),
  reportDate:text(first(i,['report_date','date'])),
  practice:text(first(i,['practice_status','practice'])),
  gameStatus:text(first(i,['game_status','status'])),
  injury:text(first(i,['injury','injury_type','report_primary'])),
  source:SOURCES.injuries.name
});

export const normalizeDepth10 = (d={}) => ({
  team:text(first(d,['team','team_abbr','team_abbreviation'])),
  position:text(first(d,['position','position_group','pos'])),
  playerId:text(first(d,['gsis_id','player_id','id'])),
  player:text(first(d,['player_name','full_name','name']),'Unknown Player'),
  rank:num(first(d,['rank','depth','depth_order','depth_rank'])),
  date:text(first(d,['date','effective_date'])),
  week:num(first(d,['week','week_num'])),
  source:SOURCES.depth.name
});

export const normalizeDepth = normalizeDepth10;

export const normalizeParticipation10 = (r={}) => ({...r,
  gameId:text(first(r,['game_id','gameId'])),
  playerId:text(first(r,['player_id','receiver_player_id','gs_id'])),
  team:text(first(r,['posteam','offense_team','team'])),
  opponent:text(first(r,['defteam','defense_team','opponent'])),
  route:text(first(r,['route'])),
  coverage:text(first(r,['defense_coverage_type','coverage_type','coverage'])),
  pressure:text(first(r,['was_pressure','pressure'])),
  blitz:text(first(r,['number_of_pass_rushers','blitz'])),
  source:SOURCES.participation.name
});

function parseCSV(t){
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<t.length;i++){
    const c=t[i], n=t[i+1];
    if(c==='"' && quoted && n==='"'){cell+='"';i++;continue;}
    if(c==='"'){quoted=!quoted;continue;}
    if(c===',' && !quoted){row.push(cell);cell='';continue;}
    if((c==='\n'||c==='\r') && !quoted){
      if(c==='\r'&&n==='\n')i++;
      row.push(cell);cell='';
      if(row.some(x=>x!=='')) rows.push(row);
      row=[];continue;
    }
    cell+=c;
  }
  if(cell!==''||row.length){row.push(cell);if(row.some(x=>x!==''))rows.push(row);}
  const head=(rows.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,''));
  return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])));
}

async function fetchText(url, timeout=25000){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const r=await fetch(url,{cache:'no-store',signal:ctl.signal});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(timer); }
}

async function csv(url){return parseCSV(await fetchText(url));}

function cacheRead(key){
  try{
    const box=JSON.parse(localStorage.getItem(CACHE)||'{}')[key];
    return box||null;
  }catch{return null;}
}
function cacheWrite(key,data,meta={}){
  try{
    const box=JSON.parse(localStorage.getItem(CACHE)||'{}');
    box[key]={data,updatedAt:new Date().toISOString(),...meta};
    localStorage.setItem(CACHE,JSON.stringify(box));
  }catch{}
}

function result(data,meta={}){
  return {data:Array.isArray(data)?data:[],live:!!meta.live,stale:!!meta.stale,source:meta.source||'unknown',updatedAt:meta.updatedAt||new Date().toISOString(),error:meta.error||null,url:meta.url||null,seasonUsed:meta.seasonUsed||null,fallback:!!meta.fallback};
}

async function loadCSVWithCache({key,url,mapper,source,seasonUsed=null,fallbackUrl=null,fallbackSeason=null}){
  try{
    const raw=await csv(url);
    const data=raw.map(mapper).filter(Boolean);
    if(!data.length) throw new Error('Source returned zero normalized rows');
    const meta={source,live:true,updatedAt:new Date().toISOString(),url,seasonUsed};
    cacheWrite(key,data,meta);
    return result(data,meta);
  }catch(primaryError){
    if(fallbackUrl){
      try{
        const raw=await csv(fallbackUrl);
        const data=raw.map(mapper).filter(Boolean);
        if(data.length){
          const meta={source,live:true,stale:true,fallback:true,updatedAt:new Date().toISOString(),url:fallbackUrl,seasonUsed:fallbackSeason,error:`Primary ${primaryError.message}`};
          cacheWrite(key,data,meta);
          return result(data,meta);
        }
      }catch{}
    }
    const cached=cacheRead(key);
    if(cached?.data?.length){
      const age=Date.now()-new Date(cached.updatedAt||0).getTime();
      return result(cached.data,{...cached,live:false,stale:true,fallback:true,error:`Live source unavailable: ${primaryError.message}${age>CACHE_TTL_MS?' · cache older than 12h':''}`});
    }
    return result([],{source,live:false,error:primaryError.message,seasonUsed});
  }
}

export async function fetchSeasonGames(season=2026){
  return loadCSVWithCache({key:`games-${season}`,url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',mapper:normalizeGame,source:SOURCES.schedules.name,seasonUsed:season});
}

export async function fetchSeasonStats(season=2026){
  return loadCSVWithCache({
    key:`stats-${season}`,
    url:`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`,
    mapper:normalizeStat,
    source:SOURCES.stats.name,
    seasonUsed:season,
    fallbackUrl:`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season-1}.csv`,
    fallbackSeason:season-1
  });
}

export async function fetchPlayers(){
  return loadCSVWithCache({key:'players',url:'https://github.com/nflverse/nflverse-data/releases/download/players/players.csv',mapper:normalizePlayer,source:SOURCES.players.name});
}

export async function fetchInjuries(season=2026){
  return loadCSVWithCache({key:`injuries-${season}`,url:`https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_${season}.csv`,mapper:normalizeInjury,source:SOURCES.injuries.name,seasonUsed:season});
}

export async function fetchDepthCharts(season=2026){
  return loadCSVWithCache({key:`depth-${season}`,url:`https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_${season}.csv`,mapper:normalizeDepth10,source:SOURCES.depth.name,seasonUsed:season});
}

export async function fetchRosters(season=2026){
  return loadCSVWithCache({key:`rosters-${season}`,url:`https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_${season}.csv`,mapper:normalizePlayer,source:SOURCES.rosters.name,seasonUsed:season});
}

export async function fetchUrlRecords(url,mapper=x=>x,source='external'){
  try{return result((await csv(url)).map(mapper),{source,live:true,url});}
  catch(e){return result([],{source,live:false,error:e.message,url});}
}

export async function fetchParticipation(url=''){
  if(!url)return result([],{source:SOURCES.participation.name,live:false,error:'No browser-safe participation URL configured'});
  return fetchUrlRecords(url,normalizeParticipation10,SOURCES.participation.name);
}

export function sourceState(r){
  if(!r) return {label:'Not loaded',cls:'warn'};
  if(r.live&&!r.stale) return {label:'Live / refreshed',cls:'ok'};
  if(r.stale) return {label:r.fallback?'Fallback / stale':'Cached / stale',cls:'warn'};
  if(r.error) return {label:'Unavailable',cls:'bad'};
  return {label:'Ready',cls:'info'};
}

export function dataHealth(bundle={}){
  const rows=Object.entries(bundle).map(([key,r])=>({key,rows:r?.data?.length||0,source:r?.source||'—',state:sourceState(r).label,updatedAt:r?.updatedAt||null,seasonUsed:r?.seasonUsed||null,error:r?.error||null}));
  return {rows,healthy:rows.filter(x=>x.rows>0).length,empty:rows.filter(x=>x.rows===0).length};
}

export function clearDataCache(){try{localStorage.removeItem(CACHE)}catch{}}

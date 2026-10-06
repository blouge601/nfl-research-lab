const CACHE='nfl-lab-step2-cache-v1';
const SOURCES={
  players:{name:'nflverse players',url:'https://github.com/nflverse/nflverse-players',kind:'players'},
  rosters:{name:'nflverse rosters/depth charts',url:'https://github.com/nflverse/nflverse-rosters',kind:'rosters'},
  data:{name:'nflverse data releases',url:'https://github.com/nflverse/nflverse-data',kind:'structured'},
  nfl:{name:'NFL.com',url:'https://www.nfl.com/',kind:'official'},
  participation:{name:'nflverse participation / FTN',url:'https://github.com/nflverse/nflverse-data',kind:'participation'},
  ngs:{name:'nflverse Next Gen Stats',url:'https://github.com/nflverse/ngs-data',kind:'ngs'}
};

// Adapter layer. Vendor-specific parsing stays here; the UI consumes normalized records.
export const normalizePlayer=(p={})=>({
 id:String(p.gsis_id??p.player_id??p.id??''),
 name:p.display_name??p.full_name??p.player_name??'Unknown Player',
 firstName:p.first_name??'',
 lastName:p.last_name??'',
 position:p.position??'',
 team:p.team??p.recent_team??'',
 jersey:p.jersey_number??p.jersey??'',
 status:p.status??'active',
 source:SOURCES.players.name
});
export const normalizeGame=(g={})=>({
 id:String(g.game_id??g.id??''),
 season:Number(g.season??0),
 week:Number(g.week??0),
 date:g.gameday??g.game_date??g.date??'',
 home:g.home_team??g.home??'',
 away:g.away_team??g.away??'',
 homeScore:g.home_score??null,
 awayScore:g.away_score??null,
 status:g.game_type??'REG',
 source:SOURCES.data.name
});
export const normalizeStat=(s={})=>({
 playerId:String(s.player_id??s.gsis_id??s.id??''),
 player: s.player_display_name??s.player_name??s.name??'Unknown Player',
 team:s.recent_team??s.team??'',
 position:s.position??'',
 passYds:Number(s.passing_yards??s.pass_yds??0),
 rushYds:Number(s.rushing_yards??s.rush_yds??0),
 recYds:Number(s.receiving_yards??s.rec_yds??0),
 targets:Number(s.targets??0),
 receptions:Number(s.receptions??0),
 carries:Number(s.carries??s.rushing_attempts??0),
 passTD:Number(s.passing_tds??s.pass_td??0),
 rushTD:Number(s.rushing_tds??s.rush_td??0),
 recTD:Number(s.receiving_tds??s.rec_td??0),
 source:SOURCES.data.name
});
export const normalizeInjury=(i={})=>({
 playerId:String(i.gsis_id??i.player_id??i.id??''),
 player:i.full_name??i.player_name??i.name??'Unknown Player',
 team:i.team??i.recent_team??'',
 position:i.position??'',
 reportDate:i.report_date??i.date??'',
 practice:i.practice_status??i.practice??'',
 gameStatus:i.game_status??i.status??'',
 injury:i.injury??i.injury_type??'',
 source:SOURCES.rosters.name
});
export const normalizeDepth=(d={})=>({
 team:d.team??'',
 position:d.position??'',
 player:d.player_name??d.full_name??d.name??'Unknown Player',
 depth:Number(d.depth??d.depth_order??0),
 source:SOURCES.rosters.name
});


export const normalizeDepth10=(d={})=>({
 team:d.team??d.team_abbr??'', position:d.position??d.position_group??'',
 playerId:String(d.gsis_id??d.player_id??d.id??''), player:d.player_name??d.full_name??d.name??'Unknown Player',
 rank:Number(d.rank??d.depth??d.depth_order??0), date:d.date??d.effective_date??'', week:Number(d.week??0), source:SOURCES.rosters.name
});
export const normalizeParticipation10=(r={})=>({...r,
 gameId:String(r.game_id??r.gameId??''), playerId:String(r.player_id??r.receiver_player_id??r.gs_id??''),
 team:r.posteam??r.offense_team??r.team??'', opponent:r.defteam??r.defense_team??r.opponent??'',
 route:r.route??'', coverage:r.defense_coverage_type??r.coverage_type??r.coverage??'',
 pressure:r.was_pressure??r.pressure??'', blitz:r.number_of_pass_rushers??r.blitz??'',
 source:SOURCES.participation.name
});
async function csv(url){
 const r=await fetch(url,{cache:'no-store'});
 if(!r.ok) throw new Error(`HTTP ${r.status}`);
 const t=await r.text();
 return parseCSV(t);
}
function parseCSV(t){
 const rows=[]; let row=[], cell='', q=false;
 for(let i=0;i<t.length;i++){const c=t[i],n=t[i+1]; if(c==='"'&&q&&n==='"'){cell+='"';i++;continue} if(c==='"'){q=!q;continue} if(c===','&&!q){row.push(cell);cell='';continue} if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);cell='';if(row.some(x=>x!==''))rows.push(row);row=[];continue} cell+=c}
 if(cell||row.length){row.push(cell);rows.push(row)}
 const head=rows.shift()?.map(x=>x.trim())??[];
 return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])));
}
function save(key,data,source){try{localStorage.setItem(CACHE,JSON.stringify({...JSON.parse(localStorage.getItem(CACHE)||'{}'),[key]:{data,source,updatedAt:new Date().toISOString()}}))}catch{}}
function load(key){try{return JSON.parse(localStorage.getItem(CACHE)||'{}')[key]??null}catch{return null}}

export async function fetchSeasonGames(season=2026){
 const url=`https://github.com/nflverse/nflverse-data/releases/download/schedules/schedules.csv`;
 try{const raw=await csv(url); const out=raw.filter(x=>Number(x.season)===Number(season)).map(normalizeGame); save('games',out,SOURCES.data.name); return {data:out,source:SOURCES.data.name,live:true}}
 catch(e){const c=load('games'); return c?{...c,live:false,stale:true,error:e.message}:{data:[],source:SOURCES.data.name,live:false,error:e.message}}
}
export async function fetchSeasonStats(season=2026){
 const url=`https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats.csv`;
 try{const raw=await csv(url); const out=raw.filter(x=>Number(x.season)===Number(season)).map(normalizeStat); save('stats',out,SOURCES.data.name); return {data:out,source:SOURCES.data.name,live:true}}
 catch(e){const c=load('stats'); return c?{...c,live:false,stale:true,error:e.message}:{data:[],source:SOURCES.data.name,live:false,error:e.message}}
}
export async function fetchPlayers(season=2026){
 const url=`https://github.com/nflverse/nflverse-data/releases/download/players/players.csv`;
 try{const raw=await csv(url); const out=raw.map(normalizePlayer); save('players',out,SOURCES.players.name); return {data:out,source:SOURCES.players.name,live:true}}
 catch(e){const c=load('players'); return c?{...c,live:false,stale:true,error:e.message}:{data:[],source:SOURCES.players.name,live:false,error:e.message}}
}
export async function fetchInjuries(season=2026){
 const url=`https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries.csv`;
 try{const raw=await csv(url); const out=raw.filter(x=>Number(x.season)===Number(season)).map(normalizeInjury); save('injuries',out,SOURCES.rosters.name); return {data:out,source:SOURCES.rosters.name,live:true}}
 catch(e){const c=load('injuries'); return c?{...c,live:false,stale:true,error:e.message}:{data:[],source:SOURCES.rosters.name,live:false,error:e.message}}
}

export async function fetchUrlRecords(url,mapper=x=>x,source='external'){
 try{const raw=await csv(url);const out=raw.map(mapper);return {data:out,source,live:true,updatedAt:new Date().toISOString(),url}}
 catch(e){return {data:[],source,live:false,error:e.message,url}}
}
export async function fetchDepthCharts(season=2026,url=''){
 if(!url)return {data:[],source:SOURCES.rosters.name,live:false,error:'No depth-chart URL configured'};
 return fetchUrlRecords(url,normalizeDepth10,SOURCES.rosters.name);
}
export async function fetchParticipation(url=''){
 if(!url)return {data:[],source:SOURCES.participation.name,live:false,error:'No participation URL configured'};
 return fetchUrlRecords(url,normalizeParticipation10,SOURCES.participation.name);
}

export function sourceState(result){
 if(!result) return {label:'Not loaded',cls:'warn'};
 if(result.live) return {label:'Live / refreshed',cls:'ok'};
 if(result.stale) return {label:'Cached / stale',cls:'warn'};
 if(result.error) return {label:'Unavailable',cls:'bad'};
 return {label:'Ready',cls:'info'};
}


import {loadResearch,clearDataCache,playerTier} from './research.js';
const $=s=>document.querySelector(s), esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
const fmt=x=>Number.isFinite(Number(x))?Number(x).toFixed(1):'—';
const pct=x=>Number.isFinite(Number(x))?`${(Number(x)*100).toFixed(1)}%`:'—';
const state={season:2026,tab:'dashboard',q:'',pos:'ALL',tier:'ALL',minUsage:5,minEdge:2,market:[],data:null,selected:null,loading:false};

function implied(odds){const o=num(odds);return o>0?100/(o+100):o<0?(-o)/(-o+100):null}
function fairOdds(p){return p<=.5?100*(1-p)/p:-100*p/(1-p)}
function marketEdges(){
 const b=state.data?.board||[];
 return state.market.map(m=>{
  const p=b.find(x=>String(x.player).toLowerCase()===String(m.player).toLowerCase()||String(x.playerId)===String(m.playerId));
  if(!p)return {...m,found:false};
  const line=num(m.line,0), proj=num(m.projection,NaN), odds=num(m.odds,0), ip=implied(odds);
  let model=Number.isFinite(proj)?(m.market?.includes('yards')?(proj>line?Math.min(.95,.5+(proj-line)/Math.max(10,proj)*.7):Math.max(.05,.5-(line-proj)/Math.max(10,proj)*.7)):.5):.5;
  const edge=(model-(ip??.5))*100, ev=ip==null?null:(model*(odds>0?odds/100:100/Math.abs(odds))-(1-model));
  return {...m,found:true,playerId:p.playerId,team:p.team,position:p.position,modelProb:model,implied:ip,edge,ev,tier:playerTier(p),decision:edge>=state.minEdge?'EDGE':edge<=-state.minEdge?'FADE':'WATCH'};
 })
}
function shell(){
 document.querySelector('#app').innerHTML=`<div class="app">
 <header><div><div class="eyebrow">NFL RESEARCH LAB</div><h1>Research & Modeling Console</h1><p>Live NFL data · usage · matchups · edges · validation-ready workflow</p></div><button id="refresh">Refresh data</button></header>
 <nav>${[['dashboard','Dashboard'],['board','Research Board'],['matchups','Player Matchups'],['edges','Edge Lab'],['games','Games'],['data','Data Health']].map(([k,v])=>`<button class="${state.tab===k?'active':''}" data-tab="${k}">${v}</button>`).join('')}</nav>
 <main id="view"></main>
 <footer>Built for research. No synthetic NFL performance data is generated. Missing inputs remain missing.</footer>
 </div>`;
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
 $('#refresh').onclick=load;
}
function card(label,value,sub=''){return `<div class="card stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>`}
function sourceBadge(r){if(!r)return `<b class="bad">MISSING</b>`;const s=r.live&&!r.stale?'LIVE':r.stale?'STALE':'ERROR';return `<b class="${s==='LIVE'?'good':s==='STALE'?'warn':'bad'}">${s}</b>`}
function toolbar(){return `<div class="toolbar"><input id="search" placeholder="Search player…" value="${esc(state.q)}"><select id="pos"><option>ALL</option>${['QB','RB','WR','TE','OL','DEF'].map(x=>`<option ${state.pos===x?'selected':''}>${x}</option>`).join('')}</select><select id="tier"><option>ALL</option>${['ELITE','STAR','STARTER','ROLE','DEPTH'].map(x=>`<option ${state.tier===x?'selected':''}>${x}</option>`).join('')}</select><label>Min usage <input id="usage" type="number" min="0" value="${state.minUsage}"></label></div>`}
function filtered(){
 return (state.data?.board||[]).filter(p=>(!state.q||String(p.player).toLowerCase().includes(state.q.toLowerCase()))&&
  (state.pos==='ALL'||p.position===state.pos)&&(state.tier==='ALL'||playerTier(p)===state.tier)&&(p.targetsG+p.carriesG>=state.minUsage))
}
function wireFilters(){['search','pos','tier','usage'].forEach(id=>$('#'+id)?.addEventListener('input',e=>{if(id==='search')state.q=e.target.value;if(id==='pos')state.pos=e.target.value;if(id==='tier')state.tier=e.target.value;if(id==='usage')state.minUsage=num(e.target.value,0);render()}))}
function table(rows,kind='board'){
 if(!rows.length)return `<div class="empty"><h3>No qualifying rows</h3><p>Nothing matches the current filters. The app will not force an edge or conclusion.</p></div>`;
 return `<div class="tablewrap"><table><thead><tr>${kind==='board'?'<th>Player</th><th>Team</th><th>Pos</th><th>Tier</th><th>Games</th><th>Targets/G</th><th>Carries/G</th><th>Rec Yds/G</th><th>Rush Yds/G</th>':'<th>Player</th><th>Team</th><th>Pos</th><th>Opponent</th><th>Matchup</th><th>Usage</th><th>Notes</th>'}</tr></thead><tbody>${
 rows.map(p=>kind==='board'?`<tr class="click" data-player="${esc(p.playerId)}"><td><b>${esc(p.player)}</b></td><td>${esc(p.team)}</td><td>${esc(p.position)}</td><td><span class="pill">${playerTier(p)}</span></td><td>${p.games}</td><td>${fmt(p.targetsG)}</td><td>${fmt(p.carriesG)}</td><td>${fmt(p.recYdsG)}</td><td>${fmt(p.rushYdsG)}</td></tr>`:
 `<tr><td><b>${esc(p.player)}</b></td><td>${esc(p.team)}</td><td>${esc(p.position)}</td><td>${esc(p.opponent||'—')}</td><td><span class="score">${fmt(p.matchupScore)}</span></td><td>${fmt(p.targetsG+p.carriesG)}</td><td>${esc((p.notes||[]).join(' · ')||'No special flags')}</td></tr>`).join('')}</tbody></table></div>`
}
function dashboard(){
 const d=state.data,c=d.meta.counts,b=d.board||[], top=[...b].sort((a,z)=>(z.targetsG+z.carriesG)-(a.targetsG+a.carriesG)).slice(0,12);
 return `<section class="hero"><div><div class="eyebrow">SEASON ${d.seasonUsed||state.season}</div><h2>Research Dashboard</h2><p>One place to inspect player usage, availability, matchup context and model signals.</p></div><div class="heroBadge">DATA ${b.length?'READY':'INCOMPLETE'}</div></section>
 <div class="grid6">${card('Players',c.players,'identity pool')}${card('Stat rows',c.stats,'weekly player rows')}${card('Games',c.games,'schedule rows')}${card('Injuries',c.injuries,'availability rows')}${card('Depth',c.depth,'depth-chart rows')}${card('Rosters',c.rosters,'roster rows')}</div>
 <section class="panel"><div class="panelhead"><div><div class="eyebrow">FULL PLAYER POOL</div><h3>Usage leaders</h3></div><button onclick="window.setTab('board')">Open Research Board</button></div>${table(top)}</section>
 <section class="panel"><div class="panelhead"><div><div class="eyebrow">RESEARCH RULE</div><h3>No forced conclusions</h3></div></div><p class="muted">Edges only appear when the available inputs support them. Missing market, injury, depth or matchup inputs are explicitly labeled instead of being invented.</p></section>`
}
function board(){const rows=filtered();return `<section class="panel"><div class="panelhead"><div><div class="eyebrow">STEP 5–6</div><h2>Research Board</h2><p class="muted">Entire normalized player pool, including role players and less-obvious usage.</p></div></div>${toolbar()}${table(rows)}</section>`}
function matchups(){const rows=(state.data?.matchups||[]).filter(p=>(p.targetsG+p.carriesG)>=state.minUsage).sort((a,b)=>b.matchupScore-a.matchupScore);return `<section class="panel"><div class="panelhead"><div><div class="eyebrow">STEP 7–9</div><h2>Player Matchups</h2><p class="muted">Usage × opponent × depth × availability context.</p></div></div>${toolbar()}${table(rows.slice(0,100),'matchup')}</section>`}
function edges(){const e=marketEdges().filter(x=>x.found&&Math.abs(x.edge)>=state.minEdge).sort((a,b)=>Math.abs(b.edge)-Math.abs(a.edge));return `<section class="panel"><div class="panelhead"><div><div class="eyebrow">STEP 4–6</div><h2>Edge Lab</h2><p class="muted">Import a market CSV/JSON to compare market probability with a research projection.</p></div><label class="file">Import market<input id="marketFile" type="file" accept=".csv,.json"></label></div><div class="toolbar"><label>Min edge % <input id="minEdge" type="number" value="${state.minEdge}"></label></div>${e.length?`<div class="tablewrap"><table><thead><tr><th>Player</th><th>Market</th><th>Line</th><th>Odds</th><th>Model</th><th>Implied</th><th>Edge</th><th>EV</th><th>Decision</th></tr></thead><tbody>${e.map(x=>`<tr><td><b>${esc(x.player)}</b></td><td>${esc(x.market)}</td><td>${esc(x.line)}</td><td>${esc(x.odds)}</td><td>${pct(x.modelProb)}</td><td>${pct(x.implied)}</td><td class="${x.edge>=state.minEdge?'goodtxt':'badtxt'}">${fmt(x.edge)}%</td><td>${x.ev==null?'—':fmt(x.ev*100)+'%'}</td><td><span class="pill">${x.decision}</span></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><h3>No market edges loaded</h3><p>Import a market file. Expected fields: <code>player,market,line,odds,projection</code>.</p></div>`}</section>`}
function games(){const g=[...(state.data?.games.data||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));return `<section class="panel"><div class="panelhead"><div><div class="eyebrow">SCHEDULE</div><h2>Games</h2></div></div><div class="tablewrap"><table><thead><tr><th>Date</th><th>Week</th><th>Away</th><th>Score</th><th>Home</th><th>Type</th></tr></thead><tbody>${g.slice(0,100).map(x=>`<tr><td>${esc(x.date)}</td><td>${x.week}</td><td>${esc(x.away)}</td><td>${x.awayScore??'—'} – ${x.homeScore??'—'}</td><td>${esc(x.home)}</td><td>${esc(x.type)}</td></tr>`).join('')}</tbody></table></div></section>`}
function health(){const s=state.data.meta.sources;return `<section class="panel"><div class="panelhead"><div><div class="eyebrow">STEP 10–11</div><h2>Data Health</h2><p class="muted">Live/local files are preferred; browser cache is a fallback.</p></div><button id="clearCache">Clear cache</button></div><div class="health">${Object.entries(s).map(([k,r])=>`<div class="healthrow"><div><b>${esc(k)}</b><small>${esc(r.source||'')}</small></div><div>${sourceBadge(r)} <span>${r.data?.length||0} rows</span></div><small>${esc(r.error||r.updatedAt||'')}</small></div>`).join('')}</div></section>`}
function playerModal(){
 if(!state.selected)return '';
 const p=state.data.board.find(x=>x.playerId===state.selected);if(!p)return '';
 return `<div class="modal" id="modal"><div class="modalbox"><button class="x" id="close">×</button><div class="eyebrow">${playerTier(p)} · ${esc(p.position)}</div><h2>${esc(p.player)}</h2><p>${esc(p.team)} · ${p.games} games</p><div class="grid4">${card('Targets/G',fmt(p.targetsG))}${card('Carries/G',fmt(p.carriesG))}${card('Rec Yds/G',fmt(p.recYdsG))}${card('Rush Yds/G',fmt(p.rushYdsG))}</div><h3>Recent form</h3><p>Targets/G ${fmt(p.recentTargetsG)} · Carries/G ${fmt(p.recentCarriesG)} · Rec Yds/G ${fmt(p.recentRecYdsG)} · Rush Yds/G ${fmt(p.recentRushYdsG)}</p><p class="muted">This is a research profile, not a guaranteed prediction.</p></div></div>`
}
function render(){
 shell();
 let html=state.tab==='dashboard'?dashboard():state.tab==='board'?board():state.tab==='matchups'?matchups():state.tab==='edges'?edges():state.tab==='games'?games():health();
 $('#view').innerHTML=html+playerModal();
 wireFilters();
 document.querySelectorAll('.click').forEach(x=>x.onclick=()=>{state.selected=x.dataset.player;render()});
 $('#close')?.addEventListener('click',()=>{state.selected=null;render()});
 $('#clearCache')?.addEventListener('click',()=>{clearDataCache();load()});
 $('#minEdge')?.addEventListener('input',e=>{state.minEdge=num(e.target.value,2);render()});
 $('#marketFile')?.addEventListener('change',handleMarket);
}
window.setTab=t=>{state.tab=t;render()};
async function handleMarket(e){const f=e.target.files?.[0];if(!f)return;const txt=await f.text();try{if(f.name.toLowerCase().endsWith('.json'))state.market=JSON.parse(txt);else{const lines=txt.trim().split(/\r?\n/),h=lines.shift().split(',').map(x=>x.trim());state.market=lines.map(l=>{const v=l.split(',');return Object.fromEntries(h.map((k,i)=>[k,v[i]??'']))})}render()}catch{alert('Could not parse that market file.')}}
async function load(){state.loading=true;render();try{state.data=await loadResearch(state.season);state.loading=false;render()}catch(e){state.loading=false;document.querySelector('#view').innerHTML=`<section class="panel error"><h2>Data load failed</h2><p>${esc(e.message)}</p><button onclick="location.reload()">Retry</button></section>`}}
document.addEventListener('click',e=>{if(e.target.matches('[data-tab]')){state.tab=e.target.dataset.tab;render()}});
if(location.protocol==='file:'){document.querySelector('#app').innerHTML='<div class="panel error"><h2>Use GitHub Pages or a local web server</h2><p>Browser security blocks the data files when this app is opened directly from a file.</p></div>'}else load();

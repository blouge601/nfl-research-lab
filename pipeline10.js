// Step 10: productionization, source health, snapshot governance and feature ablation.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const rmse=(rows,k)=>{const r=rows.filter(x=>Number.isFinite(num(x[k],NaN))&&Number.isFinite(num(x.actual,NaN)));return r.length?Math.sqrt(mean(r.map(x=>(num(x[k])-num(x.actual))**2))):null};
const mae=(rows,k)=>{const r=rows.filter(x=>Number.isFinite(num(x[k],NaN))&&Number.isFinite(num(x.actual,NaN)));return r.length?mean(r.map(x=>Math.abs(num(x[k])-num(x.actual)))):null};

export const SOURCE_REGISTRY={
 schedules:{label:'Schedules',cadence:'near-live / frequent',required:true},
 playerStats:{label:'Player stats',cadence:'daily / in-season',required:true},
 injuries:{label:'Injuries',cadence:'daily / in-season',required:true},
 depth:{label:'Depth charts',cadence:'daily',required:true},
 pbp:{label:'Play-by-play',cadence:'multiple daily / in-season',required:false},
 participation:{label:'Participation',cadence:'seasonal / licensed',required:false},
 ngs:{label:'Next Gen Stats',cadence:'daily / in-season',required:false}
};

export function sourceHealth(results={},now=Date.now(),maxAgeHours={schedules:2,playerStats:30,injuries:30,depth:30,pbp:8,participation:24*365,ngs:30}){
 return Object.entries(SOURCE_REGISTRY).map(([key,meta])=>{
  const r=results[key]||{}; const updated=r.updatedAt?new Date(r.updatedAt).getTime():0; const ageH=updated?Math.max(0,(now-updated)/36e5):null;
  const fresh=r.live&&ageH!=null&&ageH<=num(maxAgeHours[key],24); const stale=r.stale||(!fresh&&updated>0); const state=fresh?'FRESH':stale?'STALE':r.error?'ERROR':'MISSING';
  return {key,...meta,state,ageHours:ageH,rows:Array.isArray(r.data)?r.data.length:0,error:r.error||null,source:r.source||null};
 });
}

export function freshnessGate(health,opts={}){
 const required=(health||[]).filter(x=>x.required); const staleRequired=required.filter(x=>x.state!=='FRESH');
 const allow=staleRequired.length===0 || opts.allowStale===true;
 return {allow,staleRequired:staleRequired.map(x=>x.key),reason:allow?'Required sources pass freshness gate':'Required source freshness gate failed'};
}

export function snapshotManifest({season,results={},warehouse=null,playerBoard=[],createdAt=new Date().toISOString()}={}){
 const health=sourceHealth(results,Date.now());
 return {version:'10.0',season,createdAt,health,
  counts:{players:results.players?.data?.length||0,stats:results.playerStats?.data?.length||results.stats?.data?.length||0,injuries:results.injuries?.data?.length||0,depth:results.depth?.data?.length||0,pbp:results.pbp?.data?.length||0,participation:results.participation?.data?.length||0,warehouseRows:warehouse?.rows||0,playerProfiles:playerBoard?.length||0},
  warehouseVersion:warehouse?.version||null};
}

export function featureAblation(rows=[]){
 const groups=['baseProjection','positionProjection','routeCoverageProjection','passRushProjection','olProjection','scenarioProjection','fullProjection'];
 const out=groups.map(k=>({feature:k,n:0,mae:null,rmse:null,improvementVsBase:null}));
 const valid=rows.filter(r=>Number.isFinite(num(r.actual,NaN)));
 for(const o of out){const rr=valid.filter(r=>Number.isFinite(num(r[o.feature],NaN)));o.n=rr.length;o.mae=mae(rr,o.feature);o.rmse=rmse(rr,o.feature);}
 const base=out.find(x=>x.feature==='baseProjection');
 for(const o of out) if(base?.mae!=null&&o.mae!=null)o.improvementVsBase=base.mae-o.mae;
 return out;
}

export function rollingBacktest(rows=[],window=4){
 const ordered=[...rows].filter(r=>r.week!=null).sort((a,b)=>num(a.week)-num(b.week));
 const weeks=[...new Set(ordered.map(r=>num(r.week)))];
 return weeks.map((w,i)=>{const train=ordered.filter(r=>num(r.week)<w), test=ordered.filter(r=>num(r.week)===w); if(i<1)return null; const a=mae(test,'fullProjection'),b=mae(test,'baseProjection'); return {week:w,n:test.length,trainN:train.length,mae:a,baseMae:b,improvement:b!=null&&a!=null?b-a:null}}).filter(Boolean).slice(-window);
}

export function buildOperationsReport({results={},warehouse=null,playerBoard=[],backtestRows=[]}={}){
 const health=sourceHealth(results),gate=freshnessGate(health),ablation=featureAblation(backtestRows),rolling=rollingBacktest(backtestRows);
 return {createdAt:new Date().toISOString(),gate,health,ablation,rolling,snapshot:snapshotManifest({season:results.season,results,warehouse,playerBoard})};
}

export function parseOpsText(text=''){
 const s=String(text||'').trim(); if(!s)return [];
 try{const j=JSON.parse(s);return Array.isArray(j)?j:(j.rows||j.data||[])}catch{}
 const lines=s.split(/\r?\n/).filter(Boolean); if(lines.length<2)return [];
 const h=lines[0].split(',').map(x=>x.trim());
 return lines.slice(1).map(line=>{const v=line.split(',');return Object.fromEntries(h.map((k,i)=>[k,v[i]??'']))});
}

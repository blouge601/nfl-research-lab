
// Step 5: full-board edge discovery, tiers, hidden edges, injury beneficiaries,
// market freshness, and historical validation. This is a research ranking layer,
// not a guarantee of future outcomes.

import {evaluateProp, americanToProb, noVig} from './edge.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const med=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!b.length)return 0;const m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};

export function playerTier(p={}) {
  const usage=Number(p.usageScore??p.role??0);
  const games=Number(p.games??0);
  const pos=String(p.position||'').toUpperCase();
  if (usage>=16 || (['QB','RB','WR','TE'].includes(pos)&&usage>=11)) return 'ELITE';
  if (usage>=10 || (['QB','RB','WR','TE'].includes(pos)&&usage>=7)) return 'STAR';
  if (usage>=6 || games>=6) return 'STARTER';
  if (usage>=3 || games>=3) return 'ROLE';
  return 'DEPTH';
}

function parseDate(x){const d=new Date(x);return Number.isFinite(d.getTime())?d:null}
export function freshness(updatedAt, now=new Date()) {
  const d=parseDate(updatedAt);
  if(!d)return {hours:null,label:'Unknown',score:0};
  const hours=Math.max(0,(now-d)/36e5);
  const score=hours<=1?1:hours<=4?.9:hours<=12?.75:hours<=24?.55:hours<=48?.3:0;
  return {hours,score,label:hours<=1?'LIVE':hours<=4?'FRESH':hours<=12?'RECENT':hours<=24?'AGING':hours<=48?'STALE':'OLD'};
}

function lineKey(p){return `${p.playerId}|${p.market}|${Number(p.line)}`}

export function projectUsage(research, recentGames=5) {
  if(!research?.recent?.length)return {projected:0,confidence:0,source:'none'};
  const r=research.recent.slice(-recentGames);
  const opportunities=r.map(x=>
    Number(x.targets||0)+Number(x.carries||0)*.65+
    (Number(x.passAttempts||0)>0?Number(x.passAttempts||0)*.18:0)
  );
  const snapVals=r.map(x=>Number(x.snaps||0)).filter(x=>x>0);
  const projected=avg(opportunities);
  const snap=avg(snapVals);
  return {
    projected,
    projectedSnaps:snap||null,
    confidence:clamp(35+r.length*9+(snapVals.length?12:0),35,95),
    source:snapVals.length?'stats + snaps':'recent opportunity'
  };
}

export function attachPlayerContext(board=[], researchMap=new Map()) {
  return board.map(p=>{
    const r=researchMap.get(p.playerId);
    const usageScore=clamp(Number(p.targetsG||0)+Number(p.carriesG||0)*.65,0,25);
    const u=projectUsage(r);
    const tier=playerTier({...p,usageScore});
    return {...p,usageScore,tier,projectedUsage:u.projected,projectedSnaps:u.projectedSnaps,
      usageConfidence:u.confidence};
  });
}

function beneficiaryCandidates(player, board, researchMap, injuries=[]) {
  const out=injuries.filter(i=>i.team===player.team && /out|doubtful|inactive/i.test(i.gameStatus||''));
  if(!out.length)return [];
  const injuredIds=new Set(out.map(i=>i.playerId).filter(Boolean));
  return board.filter(p=>p.team===player.team&&p.playerId!==player.playerId&&!injuredIds.has(p.playerId))
    .map(p=>{
      const r=researchMap.get(p.playerId);
      const base=(Number(p.targetsG||0)+Number(p.carriesG||0)*.65);
      const posBoost=p.position===player.position?1.15:1;
      return {...p,beneficiaryScore:base*posBoost,beneficiaryOf:out.map(i=>i.player||i.playerId).join(', ')};
    }).sort((a,b)=>b.beneficiaryScore-a.beneficiaryScore).slice(0,8);
}

export function discoverBoard(props=[], researchById=new Map(), playerBoard=[], injuries=[]) {
  const enriched=[];
  const candidates=props||[];
  for(const p of candidates){
    const r=researchById.get(p.playerId);
    const e=evaluateProp(p,r);
    const ctx=playerBoard.find(x=>x.playerId===p.playerId)||{};
    const fresh=freshness(p.updatedAt);
    const tier=ctx.tier||playerTier(ctx);
    const beneficiary=beneficiaryCandidates(ctx,playerBoard,researchById,injuries);
    const reasonParts=[];
    if(e.status==='EDGE')reasonParts.push(`${e.bestSide} has ${e.edge.toFixed(1)}pp price edge`);
    if(ctx.usageScore>=6)reasonParts.push(`${ctx.usageScore.toFixed(1)} usage score`);
    if(ctx.targetTrend==='UP')reasonParts.push('target trend up');
    if(beneficiary.length)reasonParts.push('team opportunity may be changing');
    if(fresh.score<.55)reasonParts.push('market is aging');
    const quality=clamp((e.edge||0)*.55+(e.confidence||0)*.18+fresh.score*12+(ctx.usageConfidence||0)*.08,0,100);
    enriched.push({...e,tier,usageScore:ctx.usageScore||0,projectedUsage:ctx.projectedUsage||0,
      projectedSnaps:ctx.projectedSnaps,usageConfidence:ctx.usageConfidence||0,
      freshness:fresh,beneficiarySignals:beneficiary,quality,why:reasonParts.join(' • ')||e.reason});
  }
  return enriched.sort((a,b)=>b.quality-a.quality);
}

export function hiddenEdges(board=[]) {
  // A hidden edge is not defined by fame. It is a qualified edge from a
  // ROLE/DEPTH/STARTER player or a lower-usage player with strong price separation.
  return board.filter(x=>x.status==='EDGE' &&
    (['ROLE','DEPTH'].includes(x.tier) || x.usageScore<6 || x.beneficiarySignals?.length))
    .sort((a,b)=>b.quality-a.quality);
}

export function tierRankings(board=[]) {
  const tiers=['ELITE','STAR','STARTER','ROLE','DEPTH'];
  return tiers.map(t=>({
    tier:t,
    edges:board.filter(x=>x.tier===t&&x.status==='EDGE').sort((a,b)=>b.quality-a.quality),
    count:board.filter(x=>x.tier===t).length
  }));
}

export function bestByPlayer(board=[]) {
  const m=new Map();
  for(const x of board){
    if(!x.playerId)continue;
    const prev=m.get(x.playerId);
    if(!prev||x.quality>prev.quality)m.set(x.playerId,x);
  }
  return [...m.values()].sort((a,b)=>b.quality-a.quality);
}

export function validateHistorical(rows=[]) {
  // Expected import fields:
  // playerId, market, line, side, overOdds, underOdds, actual, settledAt
  const settled=rows.filter(r=>Number.isFinite(Number(r.actual)));
  if(!settled.length)return {n:0,hitRate:null,avgReturn:null,brier:null,byTier:[]};
  let wins=0, pnl=0, brier=0;
  const groups=new Map();
  for(const r of settled){
    const side=String(r.side||'OVER').toUpperCase();
    const line=Number(r.line), actual=Number(r.actual);
    const win=side==='OVER'?actual>line:actual<line;
    if(win)wins++;
    const odds=Number(side==='OVER'?r.overOdds:r.underOdds);
    const dec=Number.isFinite(odds)?(odds>0?1+odds/100:1+100/-odds):1.9091;
    pnl+=win?(dec-1):-1;
    const p=Number(r.modelProbability);
    if(Number.isFinite(p))brier+=(win?1-p:p)*(win?1-p:p);
    const tier=r.tier||'UNKNOWN';
    const g=groups.get(tier)||{tier,n:0,wins:0,pnl:0};
    g.n++;g.wins+=win?1:0;g.pnl+=win?(dec-1):-1;groups.set(tier,g);
  }
  return {n:settled.length,hitRate:wins/settled.length,avgReturn:pnl/settled.length,
    brier:Number.isFinite(brier)?brier/settled.length:null,
    byTier:[...groups.values()].map(g=>({...g,hitRate:g.wins/g.n,avgReturn:g.pnl/g.n}))};
}

export function parseHistoricalText(text){
  const t=text.trim();if(!t)return [];
  if(t.startsWith('['))return JSON.parse(t);
  const rows=t.split(/\r?\n/).filter(Boolean), headers=rows.shift().split(',').map(x=>x.trim());
  return rows.map(line=>{const cells=line.split(','),o={};headers.forEach((h,i)=>o[h]=cells[i]??'');return o});
}

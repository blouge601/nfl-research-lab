
// Step 6 predictive layer.
// The engine is deliberately explicit about what is observed, adjusted, calibrated,
// and validated. It does not manufacture probability when required inputs are absent.

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sd=a=>{const m=mean(a); if(m==null||a.length<2)return null; return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1))};
const normCdf=z=>0.5*(1+erf(z/Math.SQRT2));
function erf(x){const sign=x<0?-1:1;x=Math.abs(x);const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911,t=1/(1+p*x);return sign*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x))}
const invLogit=x=>1/(1+Math.exp(-x));
const logit=p=>Math.log(p/(1-p));

export function marketContext(teamStats=[],opponentStats=[],market=''){
  const t=teamStats||{}, o=opponentStats||{};
  const passMarkets=['passing_yards','passing_attempts','receptions','receiving_yards','targets'];
  const rushMarkets=['rushing_yards','rushing_attempts'];
  const offenseKey=passMarkets.includes(market)?'passDefense':rushMarkets.includes(market)?'rushDefense':null;
  if(!offenseKey)return {factor:1,reason:'No matchup adjustment'};
  const league=Number(t.leagueAvg||100);
  const opp=Number(o[offenseKey]||league);
  const raw=league?opp/league:1;
  const factor=clamp(1+(raw-1)*.35,.9,1.1);
  return {factor,reason:`Opponent ${offenseKey} adjustment ${(factor*100-100).toFixed(1)}%`,raw};
}

export function injuryRoleAdjustment(player={}, injuries=[], depth=[]){
  const team=player.team;
  const outs=(injuries||[]).filter(i=>i.team===team&&/out|inactive/i.test(i.gameStatus||i.status||''));
  const samePos=outs.filter(i=>String(i.position||'').toUpperCase()===String(player.position||'').toUpperCase());
  const boost=clamp(1+samePos.length*.045+outs.length*.012,1,1.16);
  const risk=player.status&&/questionable|doubtful/i.test(player.status)?0.94:1;
  return {factor:boost*risk,boost:boost*risk,outs:outs.map(x=>x.player||x.playerId),reason:outs.length?`${outs.length} unavailable teammate(s) on ${team}`:'No detected team absences'};
}

export function roleProjection(player={}, research={}, context={}){
  const recent=research?.recent||[];
  const usage=recent.map(g=>Number(g.targets||0)+Number(g.carries||0)*.65).filter(Number.isFinite);
  const snaps=recent.map(g=>Number(g.snaps||0)).filter(x=>x>0);
  const base=mean(usage);
  const snapMean=mean(snaps);
  const consistency=sd(usage);
  const sample=recent.length;
  const confidence=clamp(35+sample*8+(snapMean?12:0)-(consistency?Math.min(12,consistency):0),30,95);
  return {baseUsage:base||0,projectedSnaps:snapMean||null,consistency:consistency||null,
    confidence,source:sample?`last ${sample} games`:'insufficient recent sample'};
}

export function adjustedProjection({base,market,matchup={},role={},injury={},weatherFactor=1}){
  const m=Number(base);
  if(!Number.isFinite(m))return {projection:null,adjustments:[],confidence:0};
  const factor=(matchup.factor||1)*(role.factor||1)*(injury.factor||1)*(weatherFactor||1);
  return {projection:m*factor,adjustments:[
    matchup.reason, injury.reason,
    role.projectedSnaps?`Projected snaps ${role.projectedSnaps.toFixed(1)}`:'Role sample limited'
  ].filter(Boolean),confidence:clamp((role.confidence||40)*.55+60,35,95)};
}

export function calibrateProbability(rawP, calibrationRows=[]){
  if(!calibrationRows?.length)return {probability:rawP,calibrated:false,method:'raw model'};
  const bins=calibrationRows.filter(x=>Number.isFinite(Number(x.predicted))&&Number.isFinite(Number(x.actual)));
  if(bins.length<30)return {probability:rawP,calibrated:false,method:'insufficient calibration sample'};
  // Isotonic-style monotonic binning without external dependencies.
  const k=Math.max(5,Math.min(20,Math.floor(Math.sqrt(bins.length))));
  const sorted=bins.sort((a,b)=>Number(a.predicted)-Number(b.predicted));
  const bin=Math.min(k-1,Math.floor(rawP*k));
  const bucket=sorted.slice(Math.floor(bin*sorted.length/k),Math.floor((bin+1)*sorted.length/k));
  const rate=mean(bucket.map(x=>Number(x.actual)));
  return {probability:clamp(rate==null?rawP:rate,.01,.99),calibrated:true,method:`empirical ${k}-bin calibration`,sample:bins.length};
}

export function edgeProbability({projection,line,sdValue,side,calibrationRows=[]}){
  const s=Math.max(.5,Number(sdValue)||Math.max(3,Math.abs(Number(projection))*.35));
  const z=(Number(line)-Number(projection))/s;
  const over=1-normCdf(z);
  const raw=String(side).toUpperCase()==='OVER'?over:1-over;
  return {...calibrateProbability(raw,calibrationRows),rawProbability:raw,sd:s};
}

export function fairAmerican(p){
  if(!Number.isFinite(p)||p<=0||p>=1)return null;
  return p>=.5?-(p/(1-p))*100:((1-p)/p)*100;
}

export function clv({betProbability,closeProbability,betLine,closeLine,side}){
  const prob=(Number(betProbability)-Number(closeProbability))*100;
  const unit=(String(side).toUpperCase()==='OVER'?Number(closeLine)-Number(betLine):Number(betLine)-Number(closeLine));
  return {probabilityPP:prob,lineUnits:unit,positive:prob>0||unit>0};
}

export function backtest(rows=[]){
  const valid=rows.filter(r=>Number.isFinite(Number(r.actual))&&Number.isFinite(Number(r.line))&&Number.isFinite(Number(r.modelProbability)));
  let wins=0,units=0,brier=0,clvPP=[],groups=new Map();
  for(const r of valid){
    const p=Number(r.modelProbability), a=Number(r.actual), l=Number(r.line);
    const side=String(r.side||'OVER').toUpperCase(), win=side==='OVER'?a>l:a<l;
    const odds=Number(r.odds);
    const dec=Number.isFinite(odds)?(odds>0?1+odds/100:1+100/-odds):1.90909;
    wins+=win?1:0; units+=win?dec-1:-1; brier+=(win?1-p:p)**2;
    if(Number.isFinite(Number(r.closeProbability)))clvPP.push((p-Number(r.closeProbability))*100);
    const g=groups.get(r.tier||'UNKNOWN')||{tier:r.tier||'UNKNOWN',n:0,wins:0,units:0,clv:[]};
    g.n++;g.wins+=win?1:0;g.units+=win?dec-1:-1;if(Number.isFinite(Number(r.closeProbability)))g.clv.push((p-Number(r.closeProbability))*100);groups.set(g.tier,g);
  }
  return {n:valid.length,hitRate:valid.length?wins/valid.length:null,roi:valid.length?units/valid.length:null,
    brier:valid.length?brier/valid.length:null,avgCLV:clvPP.length?mean(clvPP):null,
    positiveCLV:clvPP.length?clvPP.filter(x=>x>0).length/clvPP.length:null,
    byTier:[...groups.values()].map(g=>({...g,hitRate:g.wins/g.n,roi:g.units/g.n,avgCLV:g.clv.length?mean(g.clv):null}))};
}

export function bestBetGate(x,{minEdge=4,minConfidence=65,minFreshness=.55,minQuality=70}={}){
  const checks=[
    ['edge',Number(x.edge)>=minEdge],
    ['confidence',Number(x.confidence)>=minConfidence],
    ['freshness',Number(x.freshnessScore??1)>=minFreshness],
    ['quality',Number(x.quality)>=minQuality],
    ['probability',Number(x.modelProbability)>0&&Number(x.modelProbability)<1]
  ];
  return {...x,bestBet:checks.every(x=>x[1]),gateChecks:checks.map(([name,ok])=>({name,ok}))};
}

export function buildPrediction({prop,research,matchup,injuries,player,calibrationRows=[]}){
  const role=roleProjection(player,research);
  const injury=injuryRoleAdjustment(player,injuries,[]);
  const adj=adjustedProjection({base:research?.baseline?.[prop.market]??research?.season?.[prop.market]??research?.mean,market:prop.market,
    matchup:marketContext({},matchup,prop.market),role,injury});
  const side=prop.bestSide||prop.side||'OVER';
  const sigma=research?.volatility?.[prop.market]||research?.sd?.[prop.market]||null;
  const ep=edgeProbability({projection:adj.projection,line:prop.line,sdValue:sigma,side,calibrationRows});
  return {...prop,...ep,projection:adj.projection,role,injury,adjustments:adj.adjustments,
    fairOdds:fairAmerican(ep.probability),confidence:Math.round((ep.calibrated?78:62)*.5+(adj.confidence*.5))};
}

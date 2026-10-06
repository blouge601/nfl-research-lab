// Step 4: normalized market + probability/EV engine.
// No sportsbook credential belongs in this browser-side module.

export function americanToProb(odds){
  const n=Number(odds);
  if(!Number.isFinite(n)||n===0)return null;
  return n>0?100/(n+100):(-n)/(-n+100);
}
export function americanToDecimal(odds){
  const n=Number(odds);
  if(!Number.isFinite(n))return null;
  return n>0?1+n/100:1+100/(-n);
}
export function noVig(overOdds,underOdds){
  const o=americanToProb(overOdds),u=americanToProb(underOdds);
  if(o==null||u==null||o+u<=0)return {over:null,under:null};
  return {over:o/(o+u),under:u/(o+u)};
}
export function normalizeProp(p={}){
 return {
  id:String(p.id??`${p.playerId}-${p.market}-${p.line}-${p.book??'market'}`),
  gameId:String(p.gameId??p.game_id??''),
  playerId:String(p.playerId??p.player_id??''),
  player:p.player??p.player_name??'',
  team:p.team??'',
  opponent:p.opponent??'',
  market:String(p.market??p.prop_type??'').toLowerCase(),
  line:Number(p.line??p.line_value),
  overOdds:Number(p.overOdds??p.over_odds??p.over),
  underOdds:Number(p.underOdds??p.under_odds??p.under),
  book:p.book??p.vendor??'Market',
  updatedAt:p.updatedAt??p.updated_at??new Date().toISOString()
 }
}
const MARKET_MAP={
 passing_yards:'passYdsG',passing_attempts:'passAttemptsG',rushing_yards:'rushYdsG',
 rushing_attempts:'carriesG',receiving_yards:'recYdsG',receptions:'receptionsG',targets:'targetsG'
};
function sdFor(market,baseline){
 const base=Math.max(Number(baseline)||0,1);
 if(/yards/.test(market)) return Math.max(base*.62,8);
 if(/attempts/.test(market)) return Math.max(base*.34,2.5);
 if(/receptions|targets/.test(market)) return Math.max(base*.55,1.2);
 return Math.max(base*.60,1);
}
function normalCdf(z){return .5*(1+erf(z/Math.SQRT2))}
function erf(x){
 const s=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);
 const y=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-a*a));
 return s*y;
}
export function evaluateProp(prop,research){
 const key=MARKET_MAP[prop.market];
 if(!key||!research?.p)return {...prop,status:'UNSUPPORTED',reason:'No supported model for this market.'};
 const baseline=Number(research.p[key]);
 if(!Number.isFinite(baseline))return {...prop,status:'INSUFFICIENT',reason:'Baseline unavailable.'};
 const sd=sdFor(prop.market,baseline);
 const z=(prop.line-baseline)/sd;
 const modelOver=1-normalCdf(z);
 const vig=noVig(prop.overOdds,prop.underOdds);
 const edgeOver=(modelOver-vig.over)*100;
 const edgeUnder=((1-modelOver)-vig.under)*100;
 const evOver=americanToDecimal(prop.overOdds)!=null?modelOver*americanToDecimal(prop.overOdds)-1:null;
 const evUnder=americanToDecimal(prop.underOdds)!=null?(1-modelOver)*americanToDecimal(prop.underOdds)-1:null;
 const side=edgeOver>=edgeUnder?'OVER':'UNDER';
 const edge=Math.max(edgeOver,edgeUnder),ev=side==='OVER'?evOver:evUnder;
 const confidence=Math.round(Math.min(95,Math.max(35,(research.confidence||35)+Math.min(15,Math.abs(edge)*1.2))));
 const minEdge=3;
 let status='PASS',reason='Edge below threshold.';
 if(edge>=minEdge&&confidence>=50){status='EDGE';reason=`${side} clears ${minEdge} percentage-point threshold.`}
 else if(edge>=1.5){status='WATCH';reason='Small signal; wait for a better price or stronger model support.'}
 return {...prop,baseline,sd,modelOver,marketOver:vig.over,marketUnder:vig.under,edgeOver,edgeUnder,evOver,evUnder,bestSide:side,edge,ev,confidence,status,reason}
}
export function edgeBoard(props,researchById){
 return (props||[]).map(p=>evaluateProp(p,researchById.get(p.playerId))).sort((a,b)=>(b.edge||-999)-(a.edge||-999));
}
export function parseMarketText(text){
 const t=text.trim(); if(!t)return [];
 if(t.startsWith('['))return JSON.parse(t).map(normalizeProp);
 const lines=t.split(/\r?\n/).filter(Boolean), headers=lines.shift().split(',').map(x=>x.trim());
 return lines.map(line=>{const cells=line.split(',');const o={};headers.forEach((h,i)=>o[h]=cells[i]);return normalizeProp(o)});
}

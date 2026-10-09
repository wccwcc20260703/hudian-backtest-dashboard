// Subperiod returns carry the selected backtest's positions; they are not fresh accounts.
export function attribution(result,benchmark,dates){
 const relative=result.nav.map((v,i)=>v/benchmark.nav[i]-1);
 let longest=0,streak=0;
 for(const v of relative){streak=v<0?streak+1:0;longest=Math.max(longest,streak);}
 const segment=(from,to)=>{
  const ids=dates.map((d,i)=>d>=from&&d<=to?i:-1).filter(i=>i>=0);
  if(!ids.length)return null;
  const first=ids[0],last=ids.at(-1),initial=first?result.nav[first-1]:result.capital;
  return result.nav[last]/initial-1;
 };
 return {relative,leadFraction:relative.filter(v=>v>0).length/relative.length,longestBehind:longest,
 preJuly:segment('0000-01-01','2026-06-30'),postJuly:segment('2026-07-01','9999-12-31')};
}

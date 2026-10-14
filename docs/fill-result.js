// All weights use this fill's price for both sides, with posted fees in cash.
export function fillResult(e){
 const b=e.before,a=e.after,p=e.price,q=e.quantity;
 if(!b||!a||![b.shares,b.cash,a.shares,a.cash,p,q].every(Number.isFinite)||p<=0||q<=0||!['buy','sell'].includes(e.side))return null;
 if(a.shares-b.shares!==(e.side==='buy'?q:-q))return null;
 const eb=b.cash+b.shares*p,ea=a.cash+a.shares*p;
 const beforeWeight=eb>0?b.shares*p/eb:null,afterWeight=ea>0?a.shares*p/ea:null;
 return {basis:'fill-price-after-fees-v1',markPrice:p,beforeShares:b.shares,afterShares:a.shares,shareChangePct:b.shares>0?q/b.shares*100:null,beforeWeightPct:beforeWeight===null?null:beforeWeight*100,afterWeightPct:afterWeight===null?null:afterWeight*100,changePoints:beforeWeight===null||afterWeight===null?null:(afterWeight-beforeWeight)*100};
}
export function fillResultText(e){
 const r=e.positionResult??fillResult(e),verb=e.side==='buy'?'加仓':'减仓';
 if(!r)return `${verb} ${e.quantity.toLocaleString('zh-CN')} 股；仓位结果待核验`;
 const pct=v=>v===null?'不可计算':v.toFixed(2)+'%';
 return `${verb} ${e.quantity.toLocaleString('zh-CN')} 股${r.shareChangePct===null?'（从空仓建立持仓）':`（占成交前持股 ${pct(r.shareChangePct)}）`}；仓位 ${pct(r.beforeWeightPct)} → ${pct(r.afterWeightPct)}${r.changePoints===null?'':`（${r.changePoints>=0?'上升':'下降'} ${Math.abs(r.changePoints).toFixed(2)} 个百分点）`}；成交后持股 ${r.afterShares.toLocaleString('zh-CN')} 股`;
}

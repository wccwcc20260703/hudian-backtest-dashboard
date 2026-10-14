// Read-only views of the published, evidence-checked desktop account.
export function executionPosition(v,day){
 if(!v?.accountEstablished||v.date!==day||!v.account||v.rejectedEvidence)return null;
 return {valuationDate:v.date,publishedAt:v.publishedAt,modelLabel:'桌面连续账户 · 默认 D',acceptedAccount:{...v.account,status:'verified'},limitations:['股数、现金与成交截至已发布版本；市值按当前报价估算，非真实交易。']};
}
export function executionFills(v,day){
 return v?.accountEstablished&&v.date===day?(v.fills??[]).filter(e=>e.fill_time?.startsWith(day+'T')&&['buy','sell'].includes(e.side)&&Number.isInteger(e.quantity)&&e.quantity>0&&Number.isFinite(e.price)&&e.price>0):[];
}

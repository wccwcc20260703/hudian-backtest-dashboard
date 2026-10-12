// Market evidence is a separate timeline; it never extends engine input arrays.
export function evidenceSessions(data,archive,live){
 const entries=new Map(Object.entries(archive?.sessions??{}).filter(([date,v])=>date>data.dates.at(-1)&&v.market?.quote?.date===date));
 if(live?.quote?.date>data.dates.at(-1)&&live.quote.time>='09:30:00')entries.set(live.quote.date,{market:live,live:true});
 return [...entries].sort(([a],[b])=>a.localeCompare(b));
}
export function replayDates(data,start,end,archive,live){
 return [...data.dates.slice(start,end),...(end===data.dates.length?evidenceSessions(data,archive,live).map(([d])=>d):[])];
}
export function freshnessText(data,start,end,archive){
 const pending=Object.keys(archive?.sessions??{}).filter(d=>d>data.dates.at(-1)).sort();
 return `本图与下表实际计算：${data.dates[start]} → ${data.dates[end-1]} · ${end-start} 个交易日。完整回测数据截至 ${data.dates.at(-1)}。${pending.length?pending.join('、')+' 已保留行情与逐日回看，待验收后才能计入收益和风险。':'后续交易日通过行情与账户核验后继续追加。'}`;
}

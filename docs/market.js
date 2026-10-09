// ECharts 6 injects the category dimension into candlestick callback values.
// Use the library's encode map instead of treating value[0] as the opening price.
export function candleValues(params){
 const values=params.value??params.data;
 const dims=params.encode?.y??(values.length===5?[1,2,3,4]:[0,1,2,3]);
 return dims.slice(0,4).map(i=>values[i]);
}
export function parseQuote(text){
 const match=text.match(/v_sz002463="([^"]+)"/);if(!match)throw Error('报价格式不完整');
 const v=match[1].split('~'),stamp=v[30];
 if(v[2]!=='002463'||!/^\d{14}$/.test(stamp))throw Error('股票代码或报价时间不匹配');
 const quote={date:`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}`,time:`${stamp.slice(8,10)}:${stamp.slice(10,12)}:${stamp.slice(12,14)}`,price:Number(v[3]),previous:Number(v[4]),open:Number(v[5]),high:Number(v[33]),low:Number(v[34]),volume:Number(v[36])*100,amount:Number(v[37])*10000,source:'腾讯行情'};
 if(!['price','previous','open','high','low'].every(k=>Number.isFinite(quote[k])&&quote[k]>0)||quote.low>Math.min(quote.price,quote.open)||quote.high<Math.max(quote.price,quote.open))throw Error('报价价格校验失败');
 return quote;
}
export function parseMinutes(json){
 const raw=json?.data?.sz002463?.data;if(!raw||!/^\d{8}$/.test(raw.date)||!Array.isArray(raw.data))throw Error('分时数据格式不完整');
 const points=raw.data.map(line=>{const v=line.split(' ');if(!/^\d{4}$/.test(v[0])||!(Number(v[1])>0))throw Error('分时价格校验失败');return {time:v[0].slice(0,2)+':'+v[0].slice(2),price:Number(v[1]),volume:Number(v[2])*100};});
 return {date:`${raw.date.slice(0,4)}-${raw.date.slice(4,6)}-${raw.date.slice(6,8)}`,points};
}

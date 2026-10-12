import {financeBacktest} from './finance-engine.js?v=e756fad09daa';
export const START_CAPITAL=1000000;
export function createPositionStart(data,gates,{date,weight=0,holding='old'},quote,{now=Date.now(),cached=false}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('请选择有效起始日期');
 if(date<data.dates[0])throw Error(`可用历史从 ${data.dates[0]} 开始`);
 if(!Number.isFinite(weight)||weight<0||weight>1||!['old','new'].includes(holding))throw Error('起始仓位须为0%至100%');
 const settings={date,weight,holding},createdAt=new Date(now).toISOString(),start=data.dates.findIndex(d=>d>=date);
 let account,actualStart,anchorPrice,historyEnd=null,orders=0;
 if(start>=0){
  const result=financeBacktest(data,gates,start,data.dates.length,{capital:START_CAPITAL,initialWeight:weight,initialHolding:holding});
  account=result.daily.at(-1);actualStart=data.dates[start];historyEnd=data.dates.at(-1);anchorPrice=data.bars[start][0][0];orders=result.trades.length;
 }else{
  const stamp=Date.parse(`${quote?.date}T${quote?.time}+08:00`),today=new Date(now+8*3600000).toISOString().slice(0,10);
  if(!quote||quote.date!==date||date!==today||cached||!Number.isFinite(stamp)||now-stamp>60000||stamp>now+5000||!Number.isFinite(quote.price)||quote.price<=0){
   return {settings,createdAt,pending:true,message:'所选日期暂无可核验起算行情，尚未建立账户。请在该交易日有新鲜报价时点击起算，或选择已有历史日期。'};
  }
  anchorPrice=quote.price;actualStart=`${date} ${quote.time}`;
  const shares=Math.floor(START_CAPITAL*weight/anchorPrice/100)*100;
  account={shares,cash:START_CAPITAL-shares*anchorPrice,available:holding==='old'?shares:0};
 }
 return {settings,createdAt,actualStart,anchorPrice,historyEnd,orders,account,pending:false};
}
export function startSnapshot(selection,quote){
 if(!selection||selection.pending||!quote)return null;
 const historical=!!selection.historyEnd,sourceSession=selection.historyEnd??selection.settings.date;
 if(quote.date<sourceSession||(!historical&&`${quote.date} ${quote.time}`<selection.actualStart))return null;
 // A scenario is never promoted to an accepted execution account. Keep the selected-day T+1 state.
 const account={...selection.account,sourceSession,todayInterestPosted:false,carryInterest:0,
  assumptions:[historical?`默认D从 ${selection.actualStart} 重算至 ${selection.historyEnd}，共 ${selection.orders} 笔历史模拟成交。此后缺口未重放，按该日结余作条件估值。`:`起算报价 ${selection.actualStart}，每股 ${selection.anchorPrice} 元。持仓是所选初始状态，未生成成交；当日后续自动执行尚未验收。`,
  '起始净资产100万元；初始持股按整手设定，不计起始建仓费用。可卖数量保留账户证据时点，跨日未自动解锁。']};
 return {valuationDate:quote.date,publishedAt:selection.createdAt,modelLabel:'自选起点 · 默认 D',acceptedAccount:null,conditionalAccount:account,
  limitations:['这是独立起点情景，不覆盖原连续模型；缺口期公司行动、利息及买卖未入账。行情更新只改变估值，不推生成交。']};
}

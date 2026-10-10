import {opportunitySignals} from './opportunities.js?v=6bc2afa727e7';
import {barTime} from './engine.js?v=a18b9052067f';
import {tradePosition} from './positions.js?v=0bef8d272a6e';
export const barEnd=j=>j===23?'11:30':j===47?'15:00':barTime(j+1);
export const dayChange=(data,d)=>data.close[d]/data.reference[d]-1;
export function historicalObservations(data,d,context,bars=data.bars[d]){
 const date=data.dates[d];let amount=0,volume=0;
 const points=bars.map((b,j)=>{volume+=b[4];amount+=b[5];return {time:barTime(j),price:b[3],volume,amount};});
 const market={quote:{date,time:'15:10:00',open:data.daily[d][0],price:data.close[d],previous:data.reference[d]},minutes:{date,points}};
 return opportunitySignals({context,market,cached:true,now:Date.parse(date+'T15:10:00+08:00'),intervalMinutes:5});
}
export function historyLines(data,d,observation){
 const b=data.bars[d],prices=new Map([['09:30',b[0][0]],['13:00',b[24][0]]]),monthly=new Map(),vwap=new Map();
 let amount=0,volume=0;
 b.forEach((v,j)=>{const time=barEnd(j);prices.set(time,v[3]);amount+=v[5];volume+=v[4];vwap.set(time,volume>0?amount/volume:null);const level=observation.levels.find(x=>x[0]===barTime(j));if(level)monthly.set(time,level[1]);});
 const times=[...prices.keys()].sort();return {times,price:times.map(t=>prices.get(t)),monthly:times.map(t=>monthly.get(t)??null),vwap:times.map(t=>vwap.get(t)??null)};
}
const percent=v=>(v*100).toFixed(2)+'%';
const gateLabels={all_full:'所有满仓信号',trend:'趋势支持',edge_morning:'反转有效且早盘转强',deep_rsi20:'RSI低于20',edge:'反转环境有效',strong_edge:'高反转收益门槛'};
export function tradeReason(data,result,t){
 const d=t[0],model=result.model,base=model==='L'?result.config.base:model,pos=tradePosition(data,t),rsi=data.rsi[d],growth=data.growth[d],original=base==='B'?null:data.signals[base][d];
 if(model==='B')return result.benchmark?.version==='continuous-v2'?'持有基准v2：继续使用尚未用完的初始本金建仓，受成交量、费用和涨停约束；分红不再投入，与S/R观察点无关。':'旧版持有基准首次建仓；按区间起点计划分批执行，与S/R观察点无关。';
 let why;
 if(model==='L'&&t[15])why=t[10]===0?'融资维持担保比例触及模型清仓线，尝试卖出可卖老仓':'模型风险约束触发降仓（原超仓回调或设置的回撤约束），目标降至100%';
 else{
  if(!(growth>0))why=`业绩门槛未通过：已披露合并净利润同比${growth===null?'缺失':percent(growth)}，基础目标0%`;
  else if(base==='D'||data.state[d]===1)why=`${base==='H'?'H处于反转模式；':''}业绩门槛通过，前日RSI(2)=${rsi.toFixed(2)}，${rsi<35?'低于35，基础目标100%':rsi>60?'高于60，基础目标0%':'处于35–60，基础目标50%'}`;
  else why=data.state[d]===2?'H处于趋势参与模式：前收高于MA60且MA120上行，基础目标100%':'H处于防御模式：反转环境及趋势参与条件未形成可持仓目标，基础目标0%';
  if(model==='L'&&t[10]>1)why+=`；融资条件“${gateLabels[result.config.gate]??result.config.gate}”满足，目标提高至${percent(t[10])}`;
  else if(model==='L'&&original[1]===1)why+='；本笔未提高到融资目标';
 }
 why+=`。操作前${percent(pos.before)}，按目标${percent(t[10])}${t[2]>0?'补仓':'减仓'}，成交后${percent(pos.after)}。`;
 if(original&&t[1]>original[0]&&!(model==='L'&&t[15]))why+='原计划的后续执行窗口，非新增独立买卖信号。';
 return why+' S/R为独立观察，不是这笔模型订单的触发原因。';
}

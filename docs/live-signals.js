// Scheduled target checks only: never turn a quote or a signal into a filled order.
export function signalFreshness(market,cached=false,now=Date.now()){
 if(cached)return '当前为缓存快照，暂停计划调仓提示；行情仍可查看。';
 if(market.minutesCached)return '分时暂未更新，保留最近有效曲线；暂停计划调仓提示。';
 const today=new Date(now+8*3600000).toISOString().slice(0,10),q=market.quote;
 if(q.date!==today)return '行情不是北京时间今日数据，暂停计划调仓提示。';
 const stamp=Date.parse(`${q.date}T${q.time}+08:00`);
 const start=Date.parse(`${today}T09:30:00+08:00`),lunch=Date.parse(`${today}T11:30:00+08:00`),afternoon=Date.parse(`${today}T13:00:00+08:00`),close=Date.parse(`${today}T15:00:00+08:00`);
 // Lunch and post-close silence are expected; require data through the last open session.
 const expected=now>=close?close:now>=lunch&&now<afternoon?lunch:now;
 if(!Number.isFinite(stamp)||stamp>now+60000||expected-stamp>5*60000)return '报价源时间滞后超过 5 分钟或时间无效，暂停计划调仓提示。';
 const last=market.minutes?.points.at(-1)?.time;
 const minute=last?Date.parse(`${today}T${last}:00+08:00`):NaN;
 if(now>=start&&(!Number.isFinite(minute)||minute>now+60000||expected-minute>5*60000))return '分时数据滞后或缺失，暂停计划调仓提示。';
 return null;
}
function scheduledSignal({context,market,model,config,previousTarget,portfolio}){
 const empty=message=>({message,signals:[]});
 if(!context||context.date!==market.quote.date)return empty('指标尚未更新到该交易日，暂停生成信号；行情仍可查看。');
 if(model==='B')return empty('全仓持有基准不产生每日调仓信号。');
 const points=market.minutes?.date===context.date?market.minutes.points:[];
 if(!points.length)return empty('等待当日分时数据，暂不生成信号。');
 const base=model==='L'?config.base:model;
 let target=context.target[base];
 const scheduled=target<previousTarget?'09:45':'10:00';
 if(points.at(-1).time<scheduled)return empty(`等待 ${scheduled} 完成数据，基础目标 ${(target*100).toFixed(0)}%。`);
 const at=points.find(p=>p.time===scheduled);
 if(!at)return empty(`缺少 ${scheduled} 分时点，暂停信号；不以较晚价格补造该时点。`);
 let gate=false,gateMissing=false;
 if(model==='L'&&target===1){
  const gates={all_full:true,deep_rsi20:context.rsi<20,trend:context.trend,
   edge:context.mode===1,strong_edge:context.mode===1&&context.strongEdge};
  if(config.gate==='edge_morning'){
   const p=points.find(p=>p.time==='10:00');
   gateMissing=!p||!(p.amount>0&&p.volume>0);
   gate=!gateMissing&&context.mode===1&&p.price>p.amount/p.volume&&p.price>market.quote.open;
  }else gate=!!gates[config.gate];
  if(gate)target=config.level;
 }
 if(!Number.isFinite(at.price)||at.price<=0)return empty('计划时点价格无效，暂不显示买卖点。');
 const equity=portfolio.cash+portfolio.shares*at.price;
 if(!(equity>0))return empty('模型账户净资产非正，暂停普通目标信号。');
 const before=portfolio.shares*at.price/equity;
 const tolerance=target===1?.004:.035;
 const passiveDrift=model==='L'&&(config.driftPolicy??'buy_cap_only')==='buy_cap_only'&&target>1&&before>target;
 const side=passiveDrift||Math.abs(target-before)<=tolerance?0:(target>before?1:-1);
 const signal={time:scheduled,price:at.price,before,target,side,gate,gateMissing,passiveDrift};
 return {signals:[signal],message:gateMissing?'融资条件数据不完整，仅显示基础目标；融资信号暂停。':(passiveDrift?'持仓比例被动高于目标，按新规则不因此减仓；额度不足时不追加融资。':side===0?'计划检查：模型仓位已接近目标，无加减仓提示。':'已生成计划调仓提示；目标仓位不等于成交后仓位。')};
}

// An outage stops new live advice, but does not erase completed, reproducible checks.
// Replay is computed with the selected settings, never represented as an alert sent then.
export function liveSignal(options){
 const {market,cached=false,now=Date.now()}=options;
 const freshness=signalFreshness(market,cached,now)||(now>=Date.parse(`${market.quote.date}T15:00:00+08:00`)?'今日已收盘，以下仅展示计划点回看。':null);
 if(!freshness)return scheduledSignal(options);
 const empty={message:freshness,signals:[],replaySignals:[]};
 const today=new Date(now+8*3600000).toISOString().slice(0,10),q=market.quote;
 const stamp=Date.parse(`${q.date}T${q.time}+08:00`);
 if(q.date!==today||!Number.isFinite(stamp)||stamp>now+60000)return empty;
 const points=(market.minutes?.points??[]).filter(p=>{
  const time=Date.parse(`${q.date}T${p.time}:00+08:00`);
  return Number.isFinite(time)&&time<=now&&time<=stamp;
 });
 const result=scheduledSignal({...options,market:{...market,minutes:{...market.minutes,points}}});
 if(!result.signals.length)return {...empty,message:`${freshness} ${result.message}`};
 return {...empty,replaySignals:result.signals,
  message:`分时截至 ${points.at(-1).time}；显示已完成时点的策略回看，按当前设置重算，非当前买卖提示。${result.signals[0].side===0?(result.signals[0].passiveDrift?'该时点为被动超仓，按规则持有，不因比例升高减仓。':'该时点接近目标仓位，无买卖操作。'):'图中买卖点为计划参考点，不代表已经成交。'}`};
}

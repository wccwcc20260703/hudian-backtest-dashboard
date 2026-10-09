// Scheduled target checks only: never turn a quote or a signal into a filled order.
export function liveSignal({context,market,model,config,previousTarget,portfolio}){
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
 const equity=portfolio.cash+portfolio.shares*at.price;
 if(!(equity>0))return empty('模型账户净资产非正，暂停普通目标信号。');
 const before=portfolio.shares*at.price/equity;
 const tolerance=target===1?.004:.035;
 const side=Math.abs(target-before)<=tolerance?0:(target>before?1:-1);
 const signal={time:scheduled,price:at.price,before,target,side,gate,gateMissing};
 return {signals:[signal],message:gateMissing?'融资条件数据不完整，仅显示基础目标；融资信号暂停。':(side===0?'计划检查：模型仓位已接近目标，无加减仓提示。':'已生成计划调仓提示；目标仓位不等于成交后仓位。')};
}

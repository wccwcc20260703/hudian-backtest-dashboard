// Frozen observation-only rule. No account, financial context or order inputs.
export const TURN_RULE='local-turn-3x3-0.3pct-v1';
export function intradayTurns({market,now=Date.now(),cached=false}){
 const q=market?.quote,m=market?.minutes,empty=message=>({ruleVersion:TURN_RULE,signals:[],points:[],message,ready:false});
 if(!q||m?.date!==q.date)return empty('等待当日分钟数据；独立于模拟账户');
 const stamp=Date.parse(`${q.date}T${q.time}+08:00`),cutoff=Math.min(now,stamp);
 if(!Number.isFinite(stamp)||stamp>now+5000)return empty('源时钟异常，暂停高低点观察');
 const points=[];let previous=-Infinity;
 for(const p of m.points??[]){
  if(!/^\d{2}:\d{2}$/.test(p.time)||!((p.time>='09:30'&&p.time<'11:30')||(p.time>='13:00'&&p.time<'15:00')))continue;
  const sec=Date.parse(`${q.date}T${p.time}:00+08:00`);
  if(!Number.isFinite(p.price)||p.price<=0||sec<=previous||sec+60000>cutoff)continue;
  points.push({...p,sec});previous=sec;
 }
 if(!points.length)return empty('等待当日完整分钟；09:32核验运行，最早09:37确认局部点');
 const today=new Date(now+8*3600000).toISOString().slice(0,10),replay=cached||today!==q.date||now-stamp>90000||q.time>='15:00:00';
 const signals=[];
 for(let i=3;i+3<points.length;i++){
  const a=points.slice(i-3,i+4),p=points[i],end=points[i+3];
  if(a.some((x,j)=>j&&x.sec-a[j-1].sec!==60000))continue;
  const other=a.filter((_,j)=>j!==3),low=other.every(x=>x.price>p.price)&&end.price/p.price-1>=.003,high=other.every(x=>x.price<p.price)&&1-end.price/p.price>=.003;
  if(!low&&!high)continue;
  const confirmedAt=new Date(end.sec+60000+8*3600000).toISOString().slice(11,16);
  signals.push({id:`${q.date}:${TURN_RULE}:${low?'low':'high'}:${p.time}`,kind:low?'low':'high',title:low?'局部低点确认':'局部高点确认',pivotTime:p.time,pivotPrice:p.price,time:end.time,confirmedAt,price:end.price,replay,ruleVersion:TURN_RULE,reason:`候选点前后各3根连续完整分钟，${low?'回升':'回落'}至少0.3%；仅在${confirmedAt}确认，不提前标作已知。`,invalidation:'局部形态观察，不保证后续反转；创新低/高可使该观察失效，不生成订单。'});
 }
 return {ruleVersion:TURN_RULE,signals,points,replay,ready:true,message:`${replay?'高低点回放':'日内高低点观察'} · ${signals.length} 个已确认局部点；与模拟账户独立，不触发成交`,scope:'分钟价格局部形态，不等于逐笔极值或全天最高最低'};
}

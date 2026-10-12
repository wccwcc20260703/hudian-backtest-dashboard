// Frozen observation-only rule. No account, financial context or order inputs.
export const TURN_RULE='swing-turn-1pct-3min-10min-v2';
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
 const signals=[];let high=null,low=null,segmentStart=0,expect=null,lastConfirmation=-Infinity;
 for(let i=0;i<points.length;i++){
  const end=points[i];
  if(i===0||end.sec-points[i-1].sec!==60000){high=low={...end,index:i};segmentStart=i;continue;}
  if(end.price>=high.price)high={...end,index:i};
  if(end.price<=low.price)low={...end,index:i};
  // Seven contiguous points to warm up; a new extreme must survive three full minutes.
  if(i-segmentStart<6||end.sec+60000-lastConfirmation<10*60000)continue;
  const highReady=expect!=='low'&&i-high.index>=3&&1-end.price/high.price>=.01;
  const lowReady=expect!=='high'&&i-low.index>=3&&end.price/low.price-1>=.01;
  if(!highReady&&!lowReady)continue;
  const isLow=lowReady&&(!highReady||low.index>high.index),p=isLow?low:high,kind=isLow?'low':'high';
  const confirmedAt=new Date(end.sec+60000+8*3600000).toISOString().slice(11,16);
  signals.push({id:`${q.date}:${TURN_RULE}:${kind}:${p.time}`,kind,title:isLow?'波段低点确认':'波段高点确认',pivotTime:p.time,pivotPrice:p.price,time:end.time,confirmedAt,price:end.price,replay,ruleVersion:TURN_RULE,reason:`候选点后至少3根完整分钟，${isLow?'回升':'回落'}至少1%；高低交替、确认间隔至少10分钟。直到${confirmedAt}才确认。`,invalidation:'仅为已确认波段形态，后续仍可能创新低/高；不是全天极值预测，也不生成订单。'});
  expect=isLow?'high':'low';lastConfirmation=end.sec+60000;
  const tail=points.slice(p.index+1,i+1).map((x,j)=>({...x,index:p.index+1+j}));
  high=tail.reduce((a,x)=>x.price>=a.price?x:a,tail[0]);low=tail.reduce((a,x)=>x.price<=a.price?x:a,tail[0]);
 }
 return {ruleVersion:TURN_RULE,signals,points,replay,ready:true,message:`${replay?'高低点回放':'日内高低点观察'} · ${signals.length} 个已确认波段点；与模拟账户独立，不触发成交`,scope:'分钟价格波段形态，不等于逐笔极值或全天最高最低'};
}

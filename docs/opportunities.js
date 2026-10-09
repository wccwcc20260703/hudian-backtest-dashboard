import {strengthAt} from './signal-strength.js?v=01d4074be540';
import {signalFreshness} from './live-signals.js?v=c76ec1fd76c8';
// Observation rules have no account input. Signals are emitted at confirmation time,
// never moved backwards to an earlier low/high after later prices become available.
export function opportunitySignals({context,market,cached=false,now=Date.now(),intervalMinutes=1}){
 if(![1,5].includes(intervalMinutes))throw Error('观察点仅支持1或5分钟');
 const step=intervalMinutes*60000;
 const empty=message=>({signals:[],message,levels:[]});
 if(!context||context.date!==market.quote.date||context.asOf>=context.date)return empty('月线指标未更新到该交易日，暂停机会观察。');
 if(!(context.prior9Sum>0)||context.completedMonths?.length!==10)return empty('月末收盘资料不完整，暂停机会观察。');
 if(market.minutes?.date!==context.date)return empty('当日分钟资料缺失，暂不生成观察点。');
 const stamp=Date.parse(`${context.date}T${market.quote.time}+08:00`),cutoff=Math.min(now,stamp);
 if(!Number.isFinite(cutoff)||stamp>now+60000)return empty('报价时间无效，暂停机会观察。');
 const points=[];let last='';
 for(const p of market.minutes.points){
  if(!/^\d\d:\d\d$/.test(p.time)||!((p.time>='09:30'&&p.time<='11:30')||(p.time>='13:00'&&p.time<='15:00')))continue;
  const sec=Date.parse(`${context.date}T${p.time}:00+08:00`);
  if(sec+step>cutoff||p.time<=last||!(p.price>0))continue;
  last=p.time;points.push({...p,sec,level:(context.prior9Sum+p.price)/10,vwap:p.volume>0&&p.amount>0?p.amount/p.volume:null});
 }
 if(!points.length)return empty('等待已完成且时间有效的分钟价格。');
 const replay=!!signalFreshness(market,cached,now)||new Date(now+8*3600000).toISOString().slice(11,16)>='15:00';
 const signals=[];let touched=-1,supportConfirmed=false,broken=false,lastVWAP=-Infinity,vwapLong=false;
 const continuous=(a,z)=>a>=0&&points.slice(a+1,z+1).every((p,j)=>p.sec-points[a+j].sec===step);
 const add=(p,side,kind,title,reason,invalidation)=>{const parent=kind==='vwap-invalidated'?signals.findLast(s=>s.kind==='vwap-reclaim'):null;const signal={id:kind+'-'+p.time,time:p.time,confirmedAt:new Date(p.sec+step+8*3600000).toISOString().slice(11,16),price:p.price,open:market.quote.open,side,kind,title,reason,invalidation,level:p.level,replay,ruleVersion:context.ruleVersion,parentId:parent?.id??null};signal.strength=strengthAt(signal,points.filter(x=>x.sec<=p.sec),intervalMinutes);if(intervalMinutes!==1){for(const key of ['reason','invalidation'])signal[key]=signal[key].replaceAll('3分钟',`3根${intervalMinutes}分钟`).replaceAll('2个已完成分钟',`2根已完成${intervalMinutes}分钟`).replaceAll('3个已完成分钟',`3根已完成${intervalMinutes}分钟`).replaceAll('本分钟',`本根${intervalMinutes}分钟`).replaceAll('前2分钟',`前2根${intervalMinutes}分钟`).replaceAll('连续分钟',`连续${intervalMinutes}分钟K线`);signal.reason+=' 历史5分钟近似规则，不是原1分钟信号逐笔还原。';}signals.push(signal);};
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(touched<0&&Math.abs(p.price/p.level-1)<=.005){touched=i;add(p,0,'support-touch','月线支撑观察',`价格进入动态10个月均线±0.5%区域；该时点均线${p.level.toFixed(2)}元。触及本身不是买入确认。`,'继续下破时支撑可能失败；等待连续分钟重新站上均线。');}
  if(touched>=0&&!supportConfirmed&&!broken&&i>=touched+2&&p.sec-points[touched].sec<=30*60000&&continuous(i-2,i)&&points.slice(i-2,i+1).every(v=>v.price>=v.level)&&p.price>points[i-1].price&&p.price>points[i-2].price){supportConfirmed=true;add(p,1,'support-reclaim','支撑回升 · 买入观察','触及月线区域后，连续3个已完成分钟站上动态10个月均线，且本分钟价格高于前2分钟。此刻才确认，不倒标最低点。','若连续2个已完成分钟低于动态均线1%，本支撑预案失效。');}
  if(touched>=0&&!broken&&i>touched&&continuous(i-1,i)&&points.slice(i-1,i+1).every(v=>v.price<v.level*.99)){broken=true;add(p,-1,'support-failure','支撑失效 · 减仓观察','触及支撑后，连续2个已完成分钟低于动态10个月均线1%；原支撑预案失效。','后续重新站稳需要重新评估；不代表任何账户已经卖出。');}
  if(vwapLong&&i>=1&&continuous(i-1,i)&&points.slice(i-1,i+1).every(v=>v.vwap>0&&v.price<v.vwap*.999)){vwapLong=false;lastVWAP=p.sec;add(p,-1,'vwap-invalidated','原买入观察失效 · 风险提示','同一VWAP规则的失效检查：先前收复后，连续2个已完成分钟重新低于均价0.1%。撤销原买入观察，并非另一套策略要求反向交易；不隐藏失败，也不等30分钟冷却。','后续买入观察需重新确认；当日新买股票不能T+0卖出，风险提示只能用于取消未执行买入或评估可卖老仓。');}
  if(i>=5&&continuous(i-5,i)&&p.sec-lastVWAP>=30*60000){
   const before=points.slice(i-5,i-2),after=points.slice(i-2,i+1),all=[...before,...after];
   if(all.every(v=>v.vwap>0&&Math.abs(v.price/v.vwap-1)<.15)){
    const down=before.every(v=>v.price>v.vwap)&&after.every(v=>v.price<v.vwap*.999);
    const up=before.every(v=>v.price<v.vwap)&&after.every(v=>v.price>v.vwap*1.001);
    if(down||up){lastVWAP=p.sec;vwapLong=up;add(p,up?1:-1,up?'vwap-reclaim':'vwap-failure',up?'均价收复 · 买入观察':'均价失守 · 减仓观察',`此前3分钟位于日内成交均价${up?'下':'上'}方，随后连续3分钟${up?'站上':'跌破'}均价0.1%；本分钟均价${p.vwap.toFixed(2)}元。`,`重新${up?'跌回':'站回'}成交均价时需重新评估。量额缺失、分钟断档时不生成此信号。`);}
   }
  }
 }
 return {signals,points,replay,levels:points.map(p=>[p.time,p.level]),message:`${replay?'当日观察回放':'机会观察'}：与模型仓位、资金和可卖数量无关；规则为固定研究条件，尚未证明能识别最优买卖点。`};
}

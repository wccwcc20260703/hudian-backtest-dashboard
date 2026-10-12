// Display-only marking of a published simulation snapshot. Never creates fills.
export function positionView(snapshot,market,{cached=false,now=Date.now()}={}){
 const q=market?.quote,unavailable=message=>({status:'unavailable',message,metrics:null});
 if(!snapshot)return unavailable('正在读取模拟账户资料…');
 if(!q||snapshot.valuationDate!==q.date)return unavailable('账户资料与报价交易日不一致，当前仓位估值待更新。独立机会观察继续运行。');
 const accepted=snapshot.acceptedAccount?.status==='verified'?snapshot.acceptedAccount:null;
 const account=accepted??snapshot.conditionalAccount;
 if(!account)return unavailable('当日模拟账户尚未验收；暂无可展示的条件持仓。');
 if(!Number.isInteger(account.shares)||account.shares<0||!Number.isInteger(account.available)||account.available<0||account.available>account.shares||!Number.isFinite(account.cash)||!Number.isFinite(q.price)||!(q.price>0))return unavailable('账户字段不完整，仓位数值待核对。独立机会观察继续运行。');
 const stamp=Date.parse(`${q.date}T${q.time}+08:00`),today=new Date(now+8*3600000).toISOString().slice(0,10);
 const stale=cached||today!==q.date||!Number.isFinite(stamp)||stamp>now+5000||now-stamp>300000;
 const marketValue=account.shares*q.price,equity=marketValue+account.cash;
 return {status:accepted?'verified':'conditional',stale,modelLabel:snapshot.modelLabel,
  message:accepted?'已验收账户快照 · 随行情估值':'条件持仓估值 · 待验收',
  acceptedMessage:accepted?`账户快照截至 ${account.asOf??account.sourceSession}；股数按该快照展示。`:'已验收实时仓位：待验收（暂无当日连续账户）',
  sourceSession:account.sourceSession,publishedAt:snapshot.publishedAt,quoteTime:`${q.date} ${q.time}`,
  assumptions:account.assumptions??[],limitations:snapshot.limitations??[],todayInterestPosted:account.todayInterestPosted===true,
  metrics:{shares:account.shares,available:account.available,marketValue,equity,weight:equity>0?marketValue/equity:null,cash:Math.max(0,account.cash),debt:Math.max(0,-account.cash),netCash:account.cash,carryInterest:account.carryInterest??0}};
}
export function startPositionFeed({onUpdate,fetcher=fetch,interval=5000}){
 let busy=false,stopped=false;
 async function refresh(){
  if(busy||stopped||document.hidden)return;busy=true;
  try{const response=await fetcher(`./live-position.json?v=${Math.floor(Date.now()/interval)}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('HTTP '+response.status);onUpdate(await response.json(),null);}
  catch{onUpdate(null,'账户快照连接暂不可用，保留上次资料及其时间。');}
  finally{busy=false;}
 }
 const timer=setInterval(refresh,interval),visible=()=>{if(!document.hidden)refresh();};
 document.addEventListener('visibilitychange',visible);void refresh();
 return {refresh,stop(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);}};
}

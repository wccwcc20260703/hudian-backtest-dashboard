import {parseQuote,parseMinutes} from './market.js';
const quoteURL='https://qt.gtimg.cn/q=sz002463',minuteURL='https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sz002463';
export function startLive({onUpdate,onStatus}){
 let busy=false,latest=null,stopped=false;
 async function refresh(){
  if(busy||stopped||document.hidden)return;busy=true;onStatus('正在刷新腾讯行情…');
  try{
   const [qr,mr]=await Promise.allSettled([fetch(quoteURL,{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Error('报价请求失败');return parseQuote(new TextDecoder('gb18030').decode(await r.arrayBuffer()));}),fetch(minuteURL,{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Error('分时请求失败');return parseMinutes(await r.json());})]);
   if(qr.status!=='fulfilled')throw qr.reason;
   const quote=qr.value,minutes=mr.status==='fulfilled'&&mr.value.date===quote.date?mr.value:null;
   latest={quote,minutes,fetchedAt:new Date().toISOString()};onUpdate(latest,false);
   onStatus(minutes?'已连接 · 每 30 秒刷新 · 行情可能有延迟':'报价已连接 · 分时暂不可用 · 每 30 秒重试');
  }catch(e){
   if(!latest){try{const response=await fetch('./latest-quote.json',{cache:'no-store'});if(!response.ok)throw Error('无缓存');latest=await response.json();onUpdate(latest,true);}catch{}}
   onStatus(latest?'实时连接失败 · 当前为最近快照，请以源时间为准':'行情暂不可用 · 30 秒后重试');
  }finally{busy=false;}
 }
 const timer=setInterval(refresh,30000);const visible=()=>{if(!document.hidden)refresh();};document.addEventListener('visibilitychange',visible);refresh();
 return {refresh,stop(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);}};
}

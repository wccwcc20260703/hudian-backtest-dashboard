import {parseQuote,parseMinutes} from './market.js';
const quoteURL='https://qt.gtimg.cn/q=sz002463',minuteURL='https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sz002463';
const cacheKey='hudian-intraday-v1',minuteInterval=30000;
function validMinutes(value){
 return /^\d{4}-\d{2}-\d{2}$/.test(value?.date)&&Array.isArray(value.points)&&value.points.length>0&&value.points.every((p,i)=>
  /^(09|10|11|13|14|15):[0-5]\d$/.test(p.time)&&Number.isFinite(p.price)&&p.price>0&&(!i||p.time>value.points[i-1].time));
}
export function startLive({onUpdate,onStatus}){
 let quoteBusy=false,minuteBusy=false,latest=null,quoteCached=true,stopped=false,lastStatus=null,lastMinuteAttempt=-Infinity;
 const minuteDays=new Map();
 const status=message=>{if(message!==lastStatus){lastStatus=message;onStatus(message);}};
 function retain(minutes,cached){
  if(!validMinutes(minutes))return false;
  const old=minuteDays.get(minutes.date);
  if(old&&old.minutes.points.at(-1).time>minutes.points.at(-1).time)return false;
  if(old&&!old.cached&&cached)return false;
  minuteDays.set(minutes.date,{minutes,cached});return true;
 }
 function publish(){
  if(stopped||!latest)return;
  const saved=minuteDays.get(latest.quote.date);
  onUpdate({...latest,minutes:saved?.minutes??null,minutesCached:saved?.cached??true},quoteCached);
 }
 async function loadSnapshot(){
  try{retain(JSON.parse(localStorage.getItem(cacheKey)),true);}catch{}
  publish();
  try{
   const response=await fetch('./latest-quote.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('无缓存');
   const snapshot=await response.json();retain(snapshot.minutes,true);
   if(!latest&&snapshot.quote?.date&&snapshot.quote.price>0){latest=snapshot;quoteCached=true;}
   publish();
  }catch{}
 }
 async function refreshQuote(){
  if(quoteBusy||stopped||document.hidden)return;quoteBusy=true;
  if(lastStatus===null)status('正在连接腾讯行情…');
  try{
   const response=await fetch(quoteURL,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('报价请求失败');
   const quote=parseQuote(new TextDecoder('gb18030').decode(await response.arrayBuffer()));
   latest={quote,fetchedAt:new Date().toISOString()};quoteCached=false;publish();
   status('报价已连接 · 每 1 秒刷新');
  }catch{
   quoteCached=true;publish();status('报价连接暂不可用 · 请以源时间为准');
  }finally{quoteBusy=false;}
 }
 async function refreshMinutes(force=false){
  if(minuteBusy||stopped||document.hidden||(!force&&Date.now()-lastMinuteAttempt<minuteInterval))return;
  minuteBusy=true;lastMinuteAttempt=Date.now();
  try{
   const response=await fetch(minuteURL,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('分时请求失败');
   const minutes=parseMinutes(await response.json());
   if(latest&&minutes.date!==latest.quote.date)throw Error('分时交易日不匹配');
   if(!retain(minutes,false))throw Error('分时为空或返回了较早数据');
   try{localStorage.setItem(cacheKey,JSON.stringify(minutes));}catch{}
  }catch{
   // A failed request must never erase the last valid curve for this trading day.
   for(const saved of minuteDays.values())saved.cached=true;
  }finally{minuteBusy=false;publish();}
 }
 const tick=()=>Promise.allSettled([refreshQuote(),refreshMinutes()]);
 const timer=setInterval(tick,1000),visible=()=>{if(!document.hidden)tick();};
 document.addEventListener('visibilitychange',visible);loadSnapshot();tick();
 return {refresh:()=>Promise.allSettled([refreshQuote(),refreshMinutes(true)]),stop(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);}};
}

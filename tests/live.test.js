import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startLive} from '../docs/live.js';
import {signalFreshness} from '../docs/live-signals.js';
const rawQuote=fs.readFileSync('tests/fixtures/quote.txt','utf8');
const snapshot=JSON.parse(fs.readFileSync('docs/latest-quote.json'));
// Fixed early snapshot for recovery scenarios; production snapshot may be newer.
snapshot.minutes.points=snapshot.minutes.points.filter(p=>p.time<='13:39');
const updates=[],memory=new Map();let tick,timerInterval,minuteMode='fail',quoteMode='ok',releaseMinute;
let quoteDate='20261009',minuteDate='20261009';
let minuteRequests=0,quoteRequests=0;
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
let clock=Date.now();const originalNow=Date.now;Date.now=()=>clock;
globalThis.setInterval=(fn,interval)=>{tick=fn;timerInterval=interval;return 1;};globalThis.clearInterval=()=>{};
const networkMinutes=()=>({data:{sz002463:{data:{date:minuteDate,data:minuteMode==='empty'?[]:['0930 113.14 100 1131400','1450 112.60 200 2257400']}}}});
globalThis.fetch=async url=>{
 if(url.includes('qt.gtimg')){
  quoteRequests++;if(quoteMode==='fail')throw Error('quote offline');
  const bytes=new TextEncoder().encode(rawQuote.replaceAll('20261009',quoteDate));
  return {ok:true,arrayBuffer:async()=>bytes.buffer};
 }
 if(url.includes('minute/query')){
  minuteRequests++;
  if(minuteMode==='slow')await new Promise(resolve=>{releaseMinute=resolve;});
  if(minuteMode==='fail')throw Error('HTTP 501');
  return {ok:true,json:async()=>networkMinutes()};
 }
 return {ok:true,json:async()=>snapshot};
};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const controller=startLive({onUpdate:(market,cached)=>updates.push({market,cached}),onStatus(){}});
await flush();
let last=()=>updates.at(-1);
assert.equal(last().market.minutes.points.length,snapshot.minutes.points.length,'first load restores same-day snapshot even when quote succeeds');
assert.equal(last().market.minutesCached,true);assert.equal(last().cached,false);
assert.match(signalFreshness(last().market,false),/暂停/);
const initialRequests=minuteRequests;await tick();
assert.equal(timerInterval,5000,'quote timer uses five-second cadence');
assert.equal(minuteRequests,initialRequests,'minute requests are throttled within five seconds');
clock+=4999;await tick();assert.equal(minuteRequests,initialRequests);
clock+=1;await tick();assert.equal(minuteRequests,initialRequests+1,'minute refresh is eligible at five seconds');
minuteMode='ok';await controller.refresh();
assert.equal(last().market.minutes.points.at(-1).time,'14:50');
assert.equal(last().market.minutesCached,false);assert.equal(memory.size,1);
for(const mode of ['fail','empty']){
 minuteMode=mode;await controller.refresh();
 assert.equal(last().market.minutes.points.at(-1).time,'14:50',`${mode} must not erase curve`);
 assert.equal(last().market.minutesCached,true);
}
minuteMode='ok';minuteDate='20261008';await controller.refresh();
assert.equal(last().market.minutes.date,'2026-10-09','wrong-day source cannot replace current curve');
quoteDate='20261012';minuteMode='fail';await controller.refresh();
assert.equal(last().market.minutes,null,'never present previous trading day as today');
quoteDate='20261009';minuteDate='20261009';minuteMode='slow';
const pending=controller.refresh();await flush();
const before=quoteRequests;await tick();
assert.equal(quoteRequests,before+1,'slow minute request must not block next quote tick');
releaseMinute();await pending;
quoteMode='fail';minuteMode='ok';await controller.refresh();assert.equal(last().cached,true);
controller.stop();quoteMode='ok';minuteMode='fail';
const reloaded=startLive({onUpdate:(market,cached)=>updates.push({market,cached}),onStatus(){}});await flush();
assert.equal(last().market.minutes.points.at(-1).time,'14:50','reload preserves newer local curve over older server snapshot');
assert.equal(last().market.minutesCached,true);reloaded.stop();
Date.now=originalNow;
console.log('PASS: five-second quote/minute cadence, outage/empty response/reload recovery, trading-day isolation, stale signal pause, independent quotes.');

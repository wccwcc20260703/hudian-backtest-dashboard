import assert from 'node:assert/strict';
import {intradayTurns} from '../docs/intraday-turns.js';
const at=t=>Date.parse('2026-10-13T'+t+'+08:00');
const marketFor=prices=>({quote:{date:'2026-10-13',time:`09:${30+prices.length}:00`},minutes:{date:'2026-10-13',points:prices.map((price,i)=>({time:`09:${30+i}`,price}))}});
const market=marketFor([103,102,101,100,100.4,100.7,101.1]);
const result=m=>intradayTurns({market:m,now:at(m.quote.time)});
const r=result(market);assert.equal(r.signals.length,1);assert.equal(r.signals[0].kind,'low');assert.equal(r.signals[0].pivotTime,'09:33');assert.equal(r.signals[0].confirmedAt,'09:37');
const early=structuredClone(market);early.quote.time='09:36:59';assert.equal(result(early).signals.length,0,'unfinished minute cannot trigger');
assert.equal(result(marketFor([100.3,100.2,100.1,100,100.1,100.2,100.4])).signals.length,0,'0.3% noise suppressed');
assert.deepEqual(result({...market,account:null,executionReady:false}),r,'account independent');
const high=marketFor([100,101,102,104,103.8,103.5,102.9]);assert.equal(result(high).signals[0].kind,'high');
const gap=structuredClone(market);gap.minutes.points.splice(4,1);assert.equal(result(gap).signals.length,0,'no gap bridging');
const path=[103,102,101,100,100.4,100.7,101.1,104,103,102,101,100,99,98,99,100,101,102,103,104,103,102,101,100];
const full=result(marketFor(path));for(let i=1;i<full.signals.length;i++){assert.notEqual(full.signals[i].kind,full.signals[i-1].kind);assert(at(full.signals[i].confirmedAt+':00')-at(full.signals[i-1].confirmedAt+':00')>=600000);}
for(let i=7;i<=path.length;i++){const prefix=result(marketFor(path.slice(0,i)));assert.deepEqual(prefix.signals,full.signals.slice(0,prefix.signals.length),'future data cannot move published points');}
const lunch=structuredClone(market);lunch.minutes.points.forEach((p,i)=>p.time=i<4?`11:${26+i}`:`13:0${i-4}`);lunch.quote.time='13:03:00';assert.equal(result(lunch).signals.length,0);
assert.equal(intradayTurns({market,now:at('09:37:00'),cached:true}).replay,true);
console.log('swing turns: noise filtering, causal/prefix consistency, alternating, cooldown, gaps, lunch, account independence passed');

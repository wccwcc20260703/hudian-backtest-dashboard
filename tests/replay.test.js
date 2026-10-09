import assert from 'node:assert/strict';import fs from 'node:fs';
import {historicalObservations,historyLines,barEnd,tradeReason,dayChange} from '../docs/replay.js';
import {backtest,barTime} from '../docs/engine.js';import {financeBacktest} from '../docs/finance-engine.js';
const read=p=>JSON.parse(fs.readFileSync(p)),data=read('docs/data.json'),contexts=read('docs/replay-context.json').contexts,gates=read('docs/finance-gates.json');
let signals=0,prefixes=0;for(let d=0;d<data.dates.length;d++){
 const context=contexts[data.dates[d]];assert.ok(context.asOf<context.date);assert.equal(context.completedMonths.length,10);assert.ok(context.completedMonths.every(m=>m.date<context.date.slice(0,7)+'-01'));
 const full=historicalObservations(data,d,context);signals+=full.signals.length;
 for(let k=1;k<=48;k++){const partial=historicalObservations(data,d,context,data.bars[d].slice(0,k));assert.deepEqual(partial.signals,full.signals.filter(s=>s.time<=barTime(k-1)));prefixes++;}
 const line=historyLines(data,d,full);assert.equal(line.price[line.times.indexOf('09:35')],data.bars[d][0][3]);assert.equal(line.price[line.times.indexOf('11:30')],data.bars[d][23][3]);assert.equal(line.price[line.times.indexOf('13:00')],data.bars[d][24][0]);assert.equal(line.price.at(-1),data.bars[d][47][3]);
 full.signals.forEach(s=>{assert.ok(s.confirmedAt>s.time);assert.ok(line.times.includes(s.confirmedAt));});
 assert.ok(Math.abs(dayChange(data,d)-(data.close[d]/data.reference[d]-1))<1e-12);
}
assert.equal(barEnd(23),'11:30');assert.equal(barEnd(47),'15:00');
for(const model of ['D','H','L','B']){const r=model==='L'?financeBacktest(data,gates,0,data.dates.length):backtest(data,model,0,data.dates.length);for(const t of r.trades){const why=tradeReason(data,r,t);assert.ok(why.length>20&&!/undefined|NaN/.test(why));if(model==='L'&&t[10]>1)assert.ok(why.includes('融资条件'));if(model==='B')assert.ok(why.includes('基准'));}}
console.log(`PASS historical replay: ${data.dates.length} contexts, ${signals} observations, ${prefixes} causal prefix checks; month timing, chart timestamps, changes and trade reasons verified.`);

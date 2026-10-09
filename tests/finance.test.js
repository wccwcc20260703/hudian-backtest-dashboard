import assert from 'node:assert/strict';import fs from 'node:fs';import {financeBacktest} from '../docs/finance-engine.js';
const d=JSON.parse(fs.readFileSync('docs/data.json')),g=JSON.parse(fs.readFileSync('docs/finance-gates.json')),fixtures=JSON.parse(fs.readFileSync('tests/finance-fixtures.json'));let count=0;
function near(a,b,label){if(b===null){assert.equal(a,b);return;}assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);count++;}
for(const f of fixtures){const r=financeBacktest(d,g,f.start,f.end,{...f,driftPolicy:'rebalance'});assert.equal(r.trades.length,f.trades.length);for(const k of Object.keys(f.metrics))near(r.metrics[k],f.metrics[k],k);r.nav.forEach((v,i)=>near(v,f.nav[i],'NAV'));r.debt.forEach((v,i)=>near(v,f.debt[i],'debt'));r.dailyInterest.forEach((v,i)=>near(v,f.interest[i],'interest'));r.trades.forEach((t,i)=>t.forEach((v,j)=>near(v,f.trades[i][j],'trade')));}
console.log(`PASS: ${fixtures.length} financing backtests / ${count} values match Python within 0.000001.`);
// Stress case: a margin breach after a same-day financed buy cannot bypass T+1.
const bars=Array.from({length:2},(_,d)=>Array.from({length:48},(_,j)=>{const p=d===0&&j<7?10:9.05;return [p,p,p,p,1e8,p*1e8];}));
const synthetic={dates:['2026-01-02','2026-01-05'],bars,close:[9.05,9.05],dividend:[0,0],bonus:[0,0],reference:[10,9.05],stamp:[.0005,.0005],transfer:[.00001,.00001],signals:{D:[[6,1],[6,0]]}};
const stress=financeBacktest(synthetic,{D:{all_full:[1,0]}},0,2,{base:'D',gate:'all_full',level:1.5,capital:1e6,credit:5e5,maintenance:2.9});
assert.ok(stress.metrics.t1_blocks>0);assert.ok(stress.metrics.risk_orders>0);assert.ok(!stress.trades.some(t=>t[0]===0&&t[2]<0));assert.ok(stress.trades.some(t=>t[0]===1&&t[2]<0));assert.ok(stress.dailyInterest[1]>stress.debt[0]*.06/365*2);assert.ok(stress.daily[1].shares===0);console.log('PASS: T+1 blocks same-day forced sale; next session deleverages; weekend interest included.');
// Financing purchases are capped by current net equity at the market price,
// including execution slippage and fees, rather than initial capital or gross assets.
for(const f of fixtures){
 const r=financeBacktest(d,g,f.start,f.end,{...f,driftPolicy:'rebalance'});
 for(const t of r.trades.filter(t=>t[2]>0&&t[14]>0)){
  const netEquity=t[6]+t[7]*d.bars[t[0]][t[1]][0];
  assert.ok(t[14]<=.5*netEquity+1e-6,'Borrowing must be <= 50% of current net equity after fees.');
 }
}
const growthData={dates:['2026-01-05','2026-01-06','2026-01-07'],
 bars:[10,10.8,10].map(p=>Array.from({length:48},()=>[p,p,p,p,1e8,p*1e8])),
 close:[10,10.8,10],dividend:[0,0,0],bonus:[0,0,0],reference:[10,10,10.8],
 stamp:[.0005,.0005,.0005],transfer:[.00001,.00001,.00001],signals:{D:[[6,1],[6,1],[6,1]]}};
const dynamic=financeBacktest(growthData,{D:{all_full:[1,1,1]}},0,3,{gate:'all_full',credit:null,level:1.5,driftPolicy:'rebalance'});
assert.equal(dynamic.config.creditMode,'equity50');
assert.ok(dynamic.debt[1]>500000,'Budget must grow when net assets grow.');
assert.ok(dynamic.debt[2]<dynamic.debt[1],'Budget must shrink as net assets decline.');
console.log('PASS: every financing buy obeys the 50% current-net-equity limit; budget grows and shrinks with equity.');

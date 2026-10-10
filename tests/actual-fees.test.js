import fs from 'node:fs';import assert from 'node:assert/strict';
import {backtest} from '../docs/engine.js';import {financeBacktest} from '../docs/finance-engine.js';import {orderEstimate} from '../docs/live-presentation.js';
const d=JSON.parse(fs.readFileSync('docs/data.json')),g=JSON.parse(fs.readFileSync('docs/finance-gates.json'));
const expected=JSON.parse(fs.readFileSync('tests/actual-fee-fixtures.json'));let count=0;let parity=0;
for(const model of ['D','H','B','L']){
 const r=model==='L'?financeBacktest(d,g,0,d.dates.length):backtest(d,model,0,d.dates.length,{benchmarkMode:'legacy'});
 assert.equal(r.commission,.0001);
 assert.equal(r.trades.length,expected[model].trades.length);r.nav.forEach((v,i)=>{assert.ok(Math.abs(v-expected[model].nav[i])<1e-6);parity++;});r.trades.forEach((t,i)=>t.forEach((v,j)=>{assert.ok(Math.abs(v-expected[model].trades[i][j])<1e-6);parity++;}));
 for(const t of r.trades){const gross=t[3]*t[4],fee=Math.max(5,gross*.0001)+gross*(d.transfer[t[0]]+(t[2]<0?d.stamp[t[0]]:0));assert.ok(Math.abs(fee-t[5])<1e-8);assert.ok(t[8]>=0);if(model==='L'&&t[2]>0)assert.ok(-t[6]<=(t[6]+t[7]*d.bars[t[0]][t[1]][0])*.5+1e-6);count++;}
}
for(const amount of [10000,50000,100000]){
 const p=100,q=amount/p,e=orderEstimate({price:p,target:0,side:-1,portfolio:{cash:0,shares:q,available:q},slip:0});
 assert.equal(e.fee,Math.max(5,amount*.0001)+amount*.00051);
}
console.log(`PASS actual rates: ${count} fills, ${parity} Python parity values, minimum fee, tax, T+1 and 50% net-equity buy cap.`);
const {backtest:etfBacktest}=await import('../docs/star50/engine.js');const {financeBacktest:etfFinance}=await import('../docs/star50/finance-engine.js');
const ed=JSON.parse(fs.readFileSync('docs/star50/data.json'));let etfFills=0;
for(const model of ['D','H','V','B','L']){const r=model==='L'?etfFinance(ed,ed.gates,0,ed.dates.length,{base:'H',gate:'trend'}):etfBacktest(ed,model,0,ed.dates.length);assert.equal(r.commission,.00006);for(const t of r.trades){assert.ok(Math.abs(t[5]-Math.max(5,t[3]*t[4]*.00006))<1e-8);etfFills++;}}
console.log(`PASS ETF actual commission: ${etfFills} fills at 0.00006, minimum5, no stamp or transfer.`);

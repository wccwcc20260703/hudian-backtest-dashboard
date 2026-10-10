import assert from 'node:assert/strict';import fs from 'node:fs';
import {backtest} from '../docs/engine.js';
const data=(days=2)=>({dates:Array.from({length:days},(_,i)=>`2026-01-${String(i+5).padStart(2,'0')}`),bars:Array.from({length:days},()=>Array.from({length:48},()=>[10,10,10,10,10000,100000])),close:Array(days).fill(10),dividend:Array(days).fill(0),bonus:Array(days).fill(0),reference:Array(days).fill(10),transfer:Array(days).fill(0),stamp:Array(days).fill(.0005)});
let tests=0;
// Only 100 shares/bar: build continues after the legacy 5-bar window and overnight.
let d=data(3),r=backtest(d,'B',0,3,{capital:100000,slip:0,commission:0,minCommission:0});
assert.equal(r.trades.length,100);assert.equal(r.daily[0].shares,4600);assert.equal(r.daily[1].shares,9200);assert.equal(r.daily[2].shares,10000);assert.equal(r.daily[2].cash,0);assert.equal(r.benchmark.completion.day,2);tests++;
assert.equal(backtest(d,'B',0,3,{capital:100000,slip:0,commission:0,minCommission:0,benchmarkMode:'legacy'}).daily.at(-1).shares,500);tests++;
// A first-day limit up blocks purchases but must not cancel tomorrow's initial-capital instruction.
d=data();d.reference[0]=9;d.bars[1].forEach(b=>b[4]=1e8);r=backtest(d,'B',0,2,{capital:10000,slip:0,commission:0,minCommission:0});assert.equal(r.daily[0].shares,0);assert.equal(r.daily[1].shares,1000);tests++;
// Zero-volume temporary blocks are retried; insufficient cash stops, then dividends stay cash.
d=data();d.bars[0][0][4]=0;d.bars[0][1][4]=1e8;d.dividend[1]=1;r=backtest(d,'B',0,2,{capital:10000,slip:0,commission:0,minCommission:0});assert.equal(r.trades[0][1],2);assert.equal(r.trades.length,1);assert.equal(r.daily[1].cash,1000);assert.equal(r.daily[1].shares,1000);tests++;
// Dividend during incomplete build cannot silently fund additional initial purchases.
d=data(3);d.dividend[1]=1;r=backtest(d,'B',0,3,{capital:100000,slip:0,commission:0,minCommission:0});assert.equal(r.daily[2].shares,10000);assert.equal(r.daily[2].cash,4600);tests++;
// Real minimum fee / affordability exact board lot, without borrowing.
d=data();d.bars.forEach(day=>day.forEach(b=>b[4]=1e8));r=backtest(d,'B',0,2,{capital:10005,slip:0,commission:.0001,minCommission:5});assert.equal(r.trades[0][3],1000);assert.equal(r.daily[0].cash,0);tests++;
const ideal=backtest(d,'B',0,2,{capital:10005,benchmarkMode:'ideal'});assert.equal(ideal.trades.length,0);assert.equal(ideal.daily[0].shares,1000.5);assert.equal(ideal.benchmark.ideal,true);tests++;
const history=JSON.parse(fs.readFileSync('docs/data.json'));
for(const capital of [1e4,1e6,1e7,1e8])for(const start of [0,200,500]){
 const z=history.dates.length,x=backtest(history,'B',start,z,{capital});let cash=capital,shares=0,total=0;
 for(let day=start;day<z;day++){cash+=shares*history.dividend[day];shares=Math.round(shares*(1+history.bonus[day]));for(const t of x.trades.filter(t=>t[0]===day)){assert.equal(t[2],1);assert.ok(t[3]<=Math.trunc(history.bars[day][t[1]-1][4]*.01/100)*100);assert.equal(t[3]%100,0);const gross=t[3]*t[4],fee=Math.max(5,gross*.0001)+gross*history.transfer[day];cash-=gross+fee;total+=gross+fee;shares+=t[3];assert.ok(cash>=-1e-6);assert.ok(total<=capital+1e-6);}assert.ok(Math.abs(cash+shares*history.close[day]-x.nav[day-start])<1e-5);}
 tests++;
}
console.log(`PASS benchmark v2: ${tests} synthetic/history cases; independent ledger, retry, limits, zero-volume, fees, dividend isolation and ideal reference.`);

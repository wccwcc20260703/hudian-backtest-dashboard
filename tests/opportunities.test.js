import assert from 'node:assert/strict';import fs from 'node:fs';
import {financeBacktest} from '../docs/finance-engine.js';
import {opportunitySignals} from '../docs/opportunities.js';import {parseMinutes} from '../docs/market.js';
const read=p=>JSON.parse(fs.readFileSync(p)),d=read('docs/data.json'),g=read('docs/finance-gates.json');let n=0;
for(const f of read('tests/drift-fixtures.json')){const r=financeBacktest(d,g,f.start,f.end,{...f,commission:.00025});assert.equal(r.trades.length,f.trades.length);for(const k of Object.keys(f.metrics))if(f.metrics[k]===null)assert.equal(r.metrics[k],null);else assert.ok(Math.abs(r.metrics[k]-f.metrics[k])<1e-6,k);for(let i=0;i<r.nav.length;i++){assert.ok(Math.abs(r.nav[i]-f.nav[i])<1e-6);assert.ok(Math.abs(r.debt[i]-f.debt[i])<1e-6);}r.trades.forEach((t,i)=>{t.forEach((v,j)=>assert.ok(Math.abs(v-f.trades[i][j])<1e-6));if(t[2]>0)assert.ok(t[14]<=.5*(t[6]+t[7]*d.bars[t[0]][t[1]][0])+1e-6);n++;});}
const cx=read('docs/opportunity-context.json'),snapshot=read('docs/latest-quote.json');const market={...snapshot,minutes:parseMinutes(read('tests/fixtures/opportunity-minutes.json'))},now=Date.parse('2026-10-09T17:30:00+08:00');const opts={context:cx,market,now},full=opportunitySignals(opts);
assert.ok(full.signals.some(s=>s.kind==='support-reclaim'));
assert.ok(full.signals.some(s=>s.kind==='vwap-invalidated'));
for(let i=1;i<=market.minutes.points.length;i++){
 const points=market.minutes.points.slice(0,i);const small=opportunitySignals({...opts,market:{...market,minutes:{...market.minutes,points}}});assert.deepEqual(small.signals,full.signals.filter(s=>s.time<=points.at(-1).time));
}
assert.deepEqual(opportunitySignals({...opts,portfolio:{cash:0,shares:10000}}).signals,opportunitySignals({...opts,portfolio:{cash:1e6,shares:0}}).signals);
assert.equal(opportunitySignals({...opts,context:{...cx,date:'2026-10-12'}}).signals.length,0);
assert.equal(opportunitySignals({...opts,market:{...market,minutes:{date:'2026-10-08',points:market.minutes.points}}}).signals.length,0);
const early=opportunitySignals({...opts,now:Date.parse('2026-10-09T10:34:30+08:00'),market:{...market,quote:{...market.quote,time:'10:34:30'}}});assert.ok(!early.signals.some(s=>s.time>='10:34'));
const noAmounts=opportunitySignals({...opts,market:{...market,minutes:{...market.minutes,points:market.minutes.points.map(p=>({...p,amount:null}))}}});assert.ok(!noAmounts.signals.some(s=>s.kind.startsWith('vwap')));
const gap=opportunitySignals({...opts,market:{...market,minutes:{...market.minutes,points:market.minutes.points.filter(p=>p.time!=='10:33')}}});assert.ok(!gap.signals.some(s=>s.time==='10:34'));
console.log(`PASS: 3 independent new-policy Python fixtures / ${n} fills; buy debt cap preserved; ${market.minutes.points.length} prefix checks; account independence, incomplete minutes, missing volume and gaps checked.`);

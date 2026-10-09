import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {backtest} from '../docs/engine.js';
const data=JSON.parse(readFileSync(new URL('../docs/data.json',import.meta.url)));
const fixtures=JSON.parse(readFileSync(new URL('./python-fixtures.json',import.meta.url)));
let values=0;
function near(a,b,label){assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);values++;}
for(const f of fixtures){const r=backtest(data,f.model,f.start,f.end,f);assert.equal(r.trades.length,f.trades.length);r.nav.forEach((v,i)=>near(v,f.nav[i],'NAV'));r.exposure.forEach((v,i)=>near(v,f.exposure[i],'exposure'));for(const k of Object.keys(r.metrics))near(r.metrics[k],f.metrics[k],k);r.trades.forEach((t,i)=>t.forEach((v,j)=>near(v,f.trades[i][j],'trade')));}
assert.throws(()=>backtest(data,'D',2,1));
console.log(`PASS: ${fixtures.length} independent Python backtests, ${values.toLocaleString()} values agree within 0.000001.`);

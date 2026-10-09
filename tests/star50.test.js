import assert from 'node:assert/strict';
import fs from 'node:fs';
import {backtest} from '../docs/star50/engine.js';
import {financeBacktest} from '../docs/star50/finance-engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../docs/star50/data.json',import.meta.url)));
const cases=JSON.parse(fs.readFileSync(new URL('./star50/fixtures.json',import.meta.url)));
let orders=0;
for(const f of cases){
 const r=f.model==='L'?financeBacktest(data,data.gates,f.start,f.end,{base:'H',gate:'trend',slip:f.slip}):backtest(data,f.model,f.start,f.end,{slip:f.slip});
 assert.equal(r.nav.length,f.nav.length);r.nav.forEach((v,i)=>assert.ok(Math.abs(v-f.nav[i])<.02,`${f.model} nav ${i}: ${v} ${f.nav[i]}`));
 assert.equal(r.trades.length,f.trades.length,`${f.model} trades`);
 r.trades.forEach((t,i)=>{for(let j=0;j<14;j++)assert.ok(Math.abs(t[j]-f.trades[i][j])<.02,`${f.model} order ${i},${j}`);assert.ok(t[3]>0);assert.ok(t[2]>0||t[3]<=t[9]);assert.ok(t[3]<=t[11]);if(f.model==='L'&&t[2]>0){const eq=t[6]+t[7]*data.bars[t[0]][t[1]][0];assert.ok(Math.max(0,-t[6])<=eq*.5+.01);}orders++;});
 assert.ok(Math.abs(r.metrics.mdd5-f.mdd5)<1e-8);
}
console.log(`STAR50: ${cases.length} Python/JS parity cases; ${orders} orders verified (T+1, volume and financing cap).`);
// The risk event may only use completed bars before its scheduled execution.
for(let d=0;d<data.dates.length;d++){const j=data.riskBars[d];if(j<0)continue;assert.ok(j>=4&&j<=12);let amount=0,volume=0;const above=[],below=[];for(let k=0;k<j;k++){const b=data.bars[d][k];amount+=b[5];volume+=b[4];above.push(b[3]>amount/volume*1.001);below.push(b[3]<amount/volume*.999);}assert.ok(below[j-2]&&below[j-1]);assert.ok(above.slice(0,j-3).some((v,k)=>v&&above[k+1]));}

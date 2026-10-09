import assert from 'node:assert/strict';import fs from 'node:fs';import * as echarts from 'echarts';import {candleValues,parseQuote,parseMinutes} from '../docs/market.js';
const d=JSON.parse(fs.readFileSync('docs/data.json')),chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:800,height:500});
for(const rows of [d.daily.slice(-3),d.bars.at(-1).slice(0,3)]){
 const candles=rows.map(v=>[v[0],v[3],v[2],v[1]]);chart.setOption({xAxis:{type:'category',data:['a','b','c']},yAxis:{scale:true},series:[{type:'candlestick',data:candles}]},true);
 rows.forEach((row,i)=>{const p=chart.getModel().getSeriesByIndex(0).getDataParams(i);assert.equal(p.value.length,5);assert.deepEqual(candleValues(p),[row[0],row[3],row[2],row[1]]);});
}chart.dispose();
const q=parseQuote(fs.readFileSync('tests/fixtures/quote.txt','utf8')),m=parseMinutes(JSON.parse(fs.readFileSync('tests/fixtures/minutes.json')));assert.equal(q.date,'2026-10-09');assert.equal(q.open,113.14);assert.equal(q.previous,115.88);assert.equal(m.date,q.date);assert.ok(m.points.length>0);assert.throws(()=>parseQuote('bad'));assert.throws(()=>parseQuote(fs.readFileSync('tests/fixtures/quote.txt','utf8').replace('~002463~','~000001~')));assert.throws(()=>parseMinutes({}));console.log('PASS: daily and 5-minute candlestick callback prices; quote identity, date and OHLC parsing.');

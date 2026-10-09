import {attribution} from '../docs/attribution.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {backtest} from '../docs/engine.js';
import {financeBacktest} from '../docs/finance-engine.js';
import {tradePosition} from '../docs/positions.js';
import {liveSignal,signalFreshness} from '../docs/live-signals.js';
import {parseMinutes} from '../docs/market.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const d=read('docs/data.json'),g=read('docs/finance-gates.json');
const sel=read('docs/default-selection.json');
assert.equal(sel.selectionMode,'user_requested');assert.equal(sel.selected,'D_all_full_1.5');
const selected=sel.candidates.find(x=>x.name===sel.selected);
const defaults=financeBacktest(d,g,0,d.dates.length,{base:'D',gate:'all_full',level:1.5,credit:null});
assert.ok(Math.abs(defaults.metrics.return_-selected.return_)<1e-8);
assert.ok(Math.abs(defaults.metrics.mdd5-selected.mdd5)<1e-8);
let n=0,leveraged=0;
for(const r of [backtest(d,'D',0,d.dates.length),backtest(d,'H',0,d.dates.length),defaults])for(const t of r.trades){
 const p=tradePosition(d,t),mark=d.bars[t[0]][t[1]][0];
 assert.equal(p.sharesAfter-p.sharesBefore,t[2]*t[3]);
 assert.ok(Math.abs(p.equityAfter-p.equityBefore+t[5]+t[2]*t[3]*(t[4]-mark))<1e-7);
 assert.ok(t[2]>0?p.after>p.before:p.after<p.before);
 assert.ok(Number.isFinite(p.before)&&Number.isFinite(p.after));
 if(p.after>1)leveraged++;n++;
}
assert.ok(leveraged>0);
const context={date:'2026-10-09',target:{D:1,H:1},mode:1,rsi:15,trend:true,strongEdge:true};
const points=[{time:'09:45',price:100,volume:100,amount:10000},{time:'09:59',price:101,volume:200,amount:20100},{time:'10:00',price:103,volume:300,amount:30400},{time:'10:01',price:104,volume:400,amount:40800}];
const opts={context,now:Date.parse('2026-10-09T10:01:00+08:00'),model:'L',config:{base:'D',gate:'edge_morning',level:1.5},previousTarget:0,portfolio:{cash:1000000,shares:0}};
const market=pts=>({quote:{date:context.date,time:pts.at(-1).time+':00',open:100},minutes:{date:context.date,points:pts}});
assert.equal(liveSignal({...opts,market:market(points.slice(0,2))}).signals.length,0);
const at10=liveSignal({...opts,market:market(points.slice(0,3))});
assert.equal(at10.signals[0].target,1.5);assert.equal(at10.signals[0].side,1);
assert.deepEqual(at10,liveSignal({...opts,market:market(points)}));
assert.equal(liveSignal({...opts,context:{...context,date:'2026-10-08'},market:market(points)}).signals.length,0);
assert.equal(liveSignal({...opts,market:market(points.filter(p=>p.time!=='10:00'))}).signals.length,0);
const missingAmount=liveSignal({...opts,market:market(points.map(p=>({...p,amount:null})))});
assert.equal(missingAmount.signals[0].target,1);assert.equal(missingAmount.signals[0].gateMissing,true);
const sell=liveSignal({...opts,now:Date.parse('2026-10-09T09:45:00+08:00'),context:{...context,target:{D:0}},previousTarget:1,market:market(points.slice(0,1)),portfolio:{cash:0,shares:10000}});
assert.equal(sell.signals[0].side,-1);assert.equal(sell.signals[0].time,'09:45');
assert.equal(liveSignal({...opts,model:'B',market:market(points)}).signals.length,0);
assert.equal(liveSignal({...opts,cached:true,market:market(points)}).signals.length,0);
assert.equal(liveSignal({...opts,now:opts.now+6*60000,market:market(points)}).signals.length,0);
assert.equal(liveSignal({...opts,now:opts.now+86400000,market:market(points)}).signals.length,0);
assert.equal(signalFreshness(market([{time:'11:30'}]),false,Date.parse('2026-10-09T12:30:00+08:00')),null);
assert.equal(signalFreshness(market([{time:'15:00'}]),false,Date.parse('2026-10-09T17:30:00+08:00')),null);
assert.notEqual(signalFreshness(market([{time:'13:10'}]),false,Date.parse('2026-10-09T13:08:00+08:00')),null);
console.log('PASS: cached, stale, previous-date and future quotes suppress signals; lunch/close handled in Shanghai time.');
const realMinutes=parseMinutes(read('tests/fixtures/minutes.json'));
const raw=read('tests/fixtures/minutes.json').data.sz002463.data.data[0].split(' ');
assert.equal(realMinutes.points[0].amount,Number(raw[3]));
// Real ECharts callback preserves per-fill metadata on scatter items.
const echarts=await import('echarts');const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:600,height:400});
const t=defaults.trades.find(t=>tradePosition(d,t).after>1);
chart.setOption({xAxis:{type:'category',data:[d.dates[t[0]]]},yAxis:{},series:[{type:'scatter',data:[{value:[d.dates[t[0]],t[4],t[3]],trade:t}]}]});
assert.deepEqual(chart.getModel().getSeriesByIndex(0).getDataParams(0).data.trade,t);chart.dispose();
console.log(`PASS: ${n} cash/financed fills reconcile before/after exposure; user-selected default matches backtest; live timing, missing data, no lookahead, and per-fill chart metadata.`);

const bm=backtest(d,'B',0,d.dates.length),attr=attribution(defaults,bm,d.dates);
assert.ok(Math.abs((1+attr.preJuly)*(1+attr.postJuly)-defaults.nav.at(-1)/defaults.capital)<1e-10);
assert.ok(Math.abs(attr.preJuly-7.23813059)<.000001);
assert.equal(attr.longestBehind,235);
assert.equal(attribution({nav:[110,120],capital:100},{nav:[100,130]},['2026-07-01','2026-07-02']).preJuly,null);
assert.equal(attribution({nav:[90,100,101],capital:100},{nav:[100,110,100]},['2026-01-01','2026-01-02','2026-01-03']).longestBehind,2);
console.log('PASS: continuous-account subperiod compounding and cumulative underperformance statistics.');

// Retained minute data can reproduce completed checks without reviving live alerts.
const replayOpts={...opts,now:Date.parse('2026-10-09T14:51:00+08:00'),market:{...market(points),minutesCached:true}};
const replayBuy=liveSignal(replayOpts);
assert.equal(replayBuy.signals.length,0);
assert.equal(replayBuy.replaySignals[0].side,1);
assert.equal(replayBuy.replaySignals[0].price,103);
assert.match(replayBuy.message,/回看/);
assert.equal(liveSignal({...replayOpts,cached:true}).replaySignals[0].side,1);
const replaySell=liveSignal({...replayOpts,context:{...context,target:{D:0}},previousTarget:1,portfolio:{cash:0,shares:10000}});
assert.equal(replaySell.replaySignals[0].side,-1);
assert.equal(replaySell.replaySignals[0].time,'09:45');
for(const invalid of [
 {...replayOpts,market:{...replayOpts.market,minutes:{date:context.date,points:points.filter(p=>p.time!=='10:00')}}},
 {...replayOpts,market:{...replayOpts.market,minutes:{date:'2026-10-08',points}}},
 {...replayOpts,now:Date.parse('2026-10-09T09:59:00+08:00')},
 {...replayOpts,now:Date.parse('2026-10-10T14:51:00+08:00')},
 {...replayOpts,context:{...context,date:'2026-10-08'}}
])assert.equal(liveSignal(invalid).replaySignals.length,0);
const snapshot=read('docs/latest-quote.json');
const todayDefault=liveSignal({context:read('docs/live-context.json'),market:{...snapshot,minutesCached:true},cached:true,
 now:Date.parse('2026-10-09T14:51:00+08:00'),model:'L',config:defaults.config,
 previousTarget:d.signals.D.at(-1)[1],portfolio:defaults.daily.at(-1)});
assert.equal(todayDefault.signals.length,0);assert.equal(todayDefault.replaySignals.length,1);
assert.equal(todayDefault.replaySignals[0].time,'10:00');assert.equal(todayDefault.replaySignals[0].side,-1);
assert.equal(todayDefault.replaySignals[0].target,1.5);
assert.ok(todayDefault.replaySignals[0].before>1.535);
assert.equal(todayDefault.replaySignals[0].price,110.01);
console.log('PASS: completed buy/sell checks remain visible as replay during outages; no missing/future/wrong-day points; user-selected financing default rebalances to150% in replay.');

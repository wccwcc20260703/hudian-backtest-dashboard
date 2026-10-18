import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';
import {executionFills} from '../docs/execution-view.js';
import {fillResultText} from '../docs/fill-result.js';
import {evidenceSessions,replayDates} from '../docs/session-archive.js';
const source=fs.readFileSync(new URL('../docs/app.js',import.meta.url),'utf8'),data=JSON.parse(fs.readFileSync(new URL('../docs/data.json',import.meta.url))),archive=JSON.parse(fs.readFileSync(new URL('../docs/session-archive.json',import.meta.url)));
const nodes={},$=id=>nodes[id]??={value:'',textContent:'',hidden:false,checked:true,setAttribute(){}};
const ctx={$,executionFills,fillResultText,data,sessionArchive:archive,liveMarket:archive.sessions['2026-10-12'].market,start:0,end:data.dates.length,day:data.dates.length-1,archiveDay:null,liveDaySelected:false,daySelectionTouched:false,evidenceSessions,replayDates,fmt:(v,n=2)=>Number(v).toFixed(n),pct:v=>(v*100).toFixed(2)+'%',htmlIfChanged:(id,v)=>$(id).innerHTML=v,stableChart:(id,o)=>ctx.chart=o,historicalTradeHead:'head',tooltip:{},axis:{axisLabel:{}},results:{L:{trades:[]}},active:'L',renderDay(){if(ctx.archiveDay)vm.runInContext('renderArchivedDay()',ctx);else ctx.selected=ctx.liveDaySelected?ctx.liveMarket.quote.date:ctx.data.dates[ctx.day];}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function liveDayAvailable(){'),source.indexOf('function renderDay(){'))+source.slice(source.indexOf('function availableReplayDates(){'),source.indexOf("$('apply-zoom').onclick="))+source.slice(source.indexOf('function renderArchivedDay(){'),source.indexOf('function renderLiveDay(){')),ctx);
vm.runInContext("selectReplayDate('2026-10-12')",ctx);$('prev').onclick();assert.equal(ctx.archiveDay,'2026-10-09');assert.match($('day-title').textContent,/2026-10-09/);assert.ok(ctx.chart.series[0].data.length>100);assert.match($('trades').innerHTML,/尚未验收/);assert.equal($('next').disabled,false);
$('prev').onclick();assert.equal(ctx.selected,'2026-10-08');$('next').onclick();assert.equal(ctx.archiveDay,'2026-10-09');$('next').onclick();assert.equal(ctx.selected,'2026-10-12');
ctx.liveMarket={quote:{date:'2026-10-13',time:'09:31:00'}};vm.runInContext("selectReplayDate('2026-10-12')",ctx);assert.equal(ctx.archiveDay,'2026-10-12');assert.match($('day-summary').innerHTML,/109.62/);$('prev').onclick();assert.equal(ctx.archiveDay,'2026-10-09');
console.log('PASS DOM handlers: Oct12→Oct9→Oct8 and forward; archived prices/status; next trading day retains both sessions.');

ctx.liveMarket={quote:{date:'2026-10-16',time:'15:00:00'}};
for(const date of ['2026-10-13','2026-10-14','2026-10-15']){
 vm.runInContext(`selectReplayDate('${date}')`,ctx);assert.equal(ctx.archiveDay,date);assert.ok(ctx.chart.series[0].data.length>=240);
 if(date==='2026-10-14'){assert.equal(ctx.chart.series.filter(s=>s.type==='scatter').length,5);assert.match($('trades').innerHTML,/15,700|15700/);}
 if(date==='2026-10-15')assert.match($('day-live-status').textContent,/缺口/);
}
console.log('PASS Oct13/14/15 restored charts, five original fill markers, gap-day explanation.');

import {strengthExplanation} from './signal-strength.js?v=66213aa0a05f';
import {orderEstimate,hoverStableUpdater,actionableSignals} from './live-presentation.js?v=3020e3cedf7a';
import {opportunitySignals} from './opportunities.js?v=6cc9856b28c9';
import {startBriefings} from './briefings.js?v=6f9223565966';
import {backtest,barTime} from './engine.js?v=45e8fd5cb157';
import {candleValues} from './market.js?v=3a58d356331d';
import {startLive} from './live.js?v=39237cf4051d';
import {financeBacktest} from './finance-engine.js?v=a2a5c9e08634';
import {tradePosition} from './positions.js?v=0bef8d272a6e';
import {attribution} from './attribution.js?v=fb459d2c3f0d';
import {liveSignal} from './live-signals.js?v=c76ec1fd76c8';
import {baseHelp,gateHelp} from './strategy-help.js?v=9eb43595ba2a';
const $=id=>document.getElementById(id), names={D:'D · 反转 + 业绩门槛',H:'H · 三状态自适应',B:'全仓持有基准',L:'L · 条件融资'},colors={D:'#078685',H:'#9070cc',B:'#9da9ba',L:'#cf933d'},modeNames=['防御空仓','反转交易','趋势参与'];
const fmt=(v,n=2)=>Number(v).toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n}),pct=v=>(v>0?'+':'')+fmt(v*100)+'%',money=v=>fmt(v,2),pctAxis=v=>fmt(v,0)+'%';
let data,financeGates,results={},active='L',view='equity',start=0,end=727,day=0,zoom=[0,100];
const historicalTradeHead=$('trade-columns').innerHTML;
let liveDaySelected=false,daySelectionTouched=false,liveReplayPresentation=null;
let liveMarket=null,liveController=null,liveContext=null,liveResults={},liveCached=false;
const chartUpdates={};
function stableChart(id,option,key){chartUpdates[id]??=hoverStableUpdater(charts[id]);chartUpdates[id](option,key);}
const htmlCache=new Map();
function htmlIfChanged(id,html){if(htmlCache.get(id)!==html){$(id).innerHTML=html;htmlCache.set(id,html);}}
const charts={}, axis={axisLine:{lineStyle:{color:'#e4eaf1'}},axisTick:{show:false},axisLabel:{color:'#93a0b2',fontSize:10},splitLine:{lineStyle:{color:'#eef2f7',type:'dashed'}}};
const tooltip={trigger:'axis',backgroundColor:'#fff',borderColor:'#e2e9f1',textStyle:{color:'#294059',fontSize:12},extraCssText:'box-shadow:0 5px 20px #18334b18;border-radius:7px',confine:true};
function showError(msg){$('error').textContent=msg;$('error').hidden=!msg;}
function indexAt(date){return data.dates.findIndex(x=>x>=date);}
function run(){
 showError('');if(!$('form').reportValidity()||!Array.from($('finance-settings').querySelectorAll('input')).every(i=>i.reportValidity()))return;
 const a=indexAt($('start').value),last=data.dates.findLastIndex(x=>x<=$('end').value),z=last+1;
 if(a<0||z<=a||$('start').value>$('end').value){showError('所选区间没有交易日，请调整开始和结束日期。');return;}
 const options={capital:Number($('capital').value),slip:Number($('slip').value)};
 start=a;end=z;for(const key of ['D','H','B'])results[key]=backtest(data,key,a,z,options);
 results.L=financeBacktest(data,financeGates,a,z,{...options,base:$('finance-base').value,gate:$('finance-gate').value,driftPolicy:$('finance-drift').value,level:Number($('finance-level').value),rate:Number($('finance-rate').value)/100,credit:$('finance-credit-mode').value==='equity50'?null:Number($('finance-credit').value)});
 day=Math.max(start,Math.min(day,end-1));zoom=[0,100];$('finance-pending').hidden=true;
 $('range-note').textContent=`已回测 ${data.dates[start]} → ${data.dates[end-1]} · ${end-start} 个交易日`;
 $('day').min=data.dates[start];$('day').max=data.dates[end-1];
 renderMetrics();renderPerformance();renderPrice();renderDay();
 // Live hints always inherit the full historical model account, independent of range selection.
 for(const k of ['D','H','B'])liveResults[k]=start===0&&end===data.dates.length?results[k]:backtest(data,k,0,data.dates.length,options);
 liveResults.L=start===0&&end===data.dates.length?results.L:financeBacktest(data,financeGates,0,data.dates.length,{...options,...results.L.config});
 if(liveMarket)renderLive(liveMarket,liveCached);
}
function renderAttribution(){
 const dates=data.dates.slice(start,end),a=attribution(results[active],results.B,dates);
 const fc=results.L.config,gateNames={trend:'趋势支持',edge_morning:'反转＋早盘转强',deep_rsi20:'RSI低于20',edge:'反转有效',strong_edge:'高反转收益门槛',all_full:'所有满仓信号'};
 const label=k=>k==='L'?`${names[k]} · ${fc.base} / ${gateNames[fc.gate]} / ${fmt(fc.level*100,0)}%`:names[k];
 $('attribution-summary').textContent=active==='B'?'持有基准是比较基线。':`${label(active)} · 区间累计收益 ${pct(results[active].metrics.return_)}：从所选起点累计领先持有的交易日占 ${fmt(a.leadFraction*100,1)}%，最长连续落后 ${a.longestBehind} 个交易日。`;
 $('attribution-body').innerHTML=['D','H','L','B'].map(k=>{const p=attribution(results[k],results.B,dates);return `<tr><td>${label(k)}</td><td><strong>${pct(results[k].metrics.return_)}</strong></td><td>${p.preJuly===null?'区间未覆盖':pct(p.preJuly)}</td><td>${p.postJuly===null?'区间未覆盖':pct(p.postJuly)}</td><td>${k==='B'?'基线':fmt(p.leadFraction*100,1)+'%'}</td><td>${k==='B'?'—':p.longestBehind+' 天'}</td></tr>`;}).join('');
}
function renderMetrics(){
 renderAttribution();
 const r=results[active],b=results.B,m=r.metrics,rel=m.return_-b.metrics.return_;
 $('metrics').innerHTML=[['区间累计收益',pct(m.return_),`期末权益 ¥ ${fmt(r.nav.at(-1),0)}`,m.return_>=0?'positive':'negative'],['相对持有基准',(rel>0?'+':'')+fmt(rel*100)+' pp','收益率差 · 百分点',rel>=0?'positive':'negative'],['最大回撤 · 5 分钟',fmt(m.mdd5*100)+'%',`日线收盘回撤 ${fmt(m.mdd*100)}%`,''],['平均持仓比例',fmt(m.exposure*100)+'%',`${m.orders} 笔成交 · 费用 ¥ ${fmt(m.fees,0)}${active==='L'?' · 利息 ¥ '+fmt(m.interest,0):''}`,'']].map(([l,v,d,c])=>`<div class="metric"><div class="label">${l}</div><div class="value ${c}">${v}</div><div class="detail">${d}</div></div>`).join('');
 $('finance-stats').textContent=`已计算 ${results.L.config.base} / ${fmt(results.L.config.level*100,0)}% / 年息 ${fmt(results.L.config.rate*100,1)}% / ${results.L.config.creditMode==='equity50'?'融资上限为当前净资产的 50%':'固定额度 ¥ '+fmt(results.L.config.credit,0)}：利息 ¥ ${fmt(results.L.metrics.interest,0)} · 最低维持担保比例 ${results.L.metrics.min_maintenance?fmt(results.L.metrics.min_maintenance*100,1)+'%':'无借款'} · ${results.L.config.driftPolicy==='buy_cap_only'?'允许被动超仓':'原回调规则'} · 实际仓位峰值 ${fmt(results.L.metrics.max_exposure*100,1)}% · 使用融资 ${results.L.metrics.borrow_days} 天 · 期末欠款 ¥ ${fmt(results.L.metrics.ending_debt,0)}`;
 $('comparison-body').innerHTML=['D','H','L','B'].map(k=>{const m=results[k].metrics;return `<tr class="${k===active?'selected-row':''}"><td><span class="strategy-dot" style="background:${colors[k]}"></span>${names[k]}</td><td class="${m.return_>=0?'positive':'negative'}">${pct(m.return_)}</td><td>${k==='B'?'—':fmt((m.return_-b.metrics.return_)*100)+' pp'}</td><td>${fmt(m.mdd5*100)}%</td><td>${fmt(m.exposure*100,1)}%</td><td>${m.orders}</td><td>¥ ${fmt(m.fees,0)}${k==='L'?'<br><small>融资利息 ¥ '+fmt(m.interest,0)+'</small>':''}</td></tr>`}).join('');
}
function renderPerformance(){
 const dd=view==='drawdown',relative=view==='relative',dates=dd?['区间起点',...data.dates.slice(start,end).flatMap(d=>Array.from({length:48},(_,j)=>d+' '+(j===47?'15:00':barTime(j+1===24?24:j+1))))]:['区间起点',...data.dates.slice(start,end)];
 // The final morning bar is marked 11:30, not 13:00.
 if(dd)for(let d=0;d<end-start;d++)dates[1+d*48+23]=data.dates[start+d]+' 11:30';
 charts.performance.setOption({animation:false,grid:{left:68,right:35,top:48,bottom:45},legend:{top:12,right:25,icon:'roundRect',itemWidth:16,itemHeight:3,textStyle:{fontSize:11,color:'#718199'}},tooltip:{...tooltip,valueFormatter:v=>fmt(v)+'%'},xAxis:{...axis,type:'category',data:dates,boundaryGap:false,axisLabel:{...axis.axisLabel,formatter:v=>v.slice(0,10),hideOverlap:true}},yAxis:{...axis,type:'value',axisLabel:{...axis.axisLabel,formatter:pctAxis}},series:['D','H','L','B'].map(k=>({name:names[k],type:'line',showSymbol:false,sampling:dd?'min':'lttb',lineStyle:{width:k===active?2.5:1.7,type:k==='B'?'dashed':'solid'},itemStyle:{color:colors[k]},data:dd?[0,...results[k].drawdown]:[0,...results[k].nav.map((v,i)=>relative?(v/results.B.nav[i]-1)*100:(v/results[k].capital-1)*100)]}))},true);
}
function positionText(t){const p=tradePosition(data,t);return `${fmt(p.before*100,2)}% → ${fmt(p.after*100,2)}%`;}
function fillDetail(t){return `${barTime(t[1])} ${t[2]>0?'买入':'卖出'} ${fmt(t[3],0)} 股 @ ¥ ${fmt(t[4])}<br>实际仓位 ${positionText(t)}<br>历史模拟成交，未附独立信号强度评分`;}
function tradeScatter(trades,side,intraday=false){
 // Keep each fill as its own point, even on the daily chart.
 const points=trades.filter(t=>t[2]===side).map(t=>({value:[intraday?barTime(t[1]):data.dates[t[0]],t[4],t[3]],trade:t}));
 return {name:side>0?'买入成交':'卖出成交',type:'scatter',symbol:'triangle',symbolRotate:side>0?0:180,symbolSize:intraday?15:9,z:10,
 itemStyle:{color:side>0?'#e25562':'#168d75',borderColor:'#fff',borderWidth:1,opacity:1},data:points,
 tooltip:{trigger:'item',formatter:p=>`${data.dates[p.data.trade[0]]}<br>${fillDetail(p.data.trade)}`}};
}
function stateAreas(){let runs=[],a=start;for(let i=start+1;i<=end;i++)if(i===end||data.state[i]!==data.state[a]){runs.push([{xAxis:data.dates[a],itemStyle:{color:['#9faebe14','#9671d511','#58ab8015'][data.state[a]]}},{xAxis:data.dates[i-1]}]);a=i;}return runs;}
function candleTooltip(params){return params.map(p=>{if(p.seriesType==='candlestick'){const v=candleValues(p);return `${p.axisValue}<br>开 ${fmt(v[0])}　收 ${fmt(v[1])}<br>低 ${fmt(v[2])}　高 ${fmt(v[3])}`;}if(p.seriesType==='scatter'&&p.data.trade)return `${p.marker}${fillDetail(p.data.trade)}`;return '';}).filter(Boolean).join('<br>');}
function renderPrice(){
 const r=results[active],ds=data.dates.slice(start,end), candles=data.daily.slice(start,end).map(v=>[v[0],v[3],v[2],v[1]]);
 const quote=liveMarket?.quote, includeLive=quote&&end===data.dates.length&&quote.date>data.dates.at(-1)&&$('show-live').checked;
 if(includeLive){ds.push(quote.date);candles.push([quote.open,quote.price,quote.low,quote.high]);}
 $('live-candle-note').textContent=includeLive?`已附加 ${quote.date} 盘中 K 线（未纳入回测） · 不复权价格`: '历史日线为不复权价格 · 买卖标记为含滑点的模拟成交价';
 stableChart('price',{animation:false,grid:{left:68,right:35,top:28,bottom:62},tooltip:{...tooltip,formatter:candleTooltip},xAxis:{...axis,type:'category',data:ds,axisPointer:{type:'shadow'},axisLabel:{...axis.axisLabel,hideOverlap:true}},yAxis:{...axis,scale:true,name:'元',nameTextStyle:{color:'#9ca7b5'},axisLabel:{...axis.axisLabel,formatter:v=>fmt(v,1)}},dataZoom:[{type:'inside',start:zoom[0],end:zoom[1]},{type:'slider',start:zoom[0],end:zoom[1],bottom:13,height:22,borderColor:'#edf1f6',fillerColor:'#13898812',handleStyle:{color:'#799aab'},textStyle:{color:'#8b9bad',fontSize:10}}],series:[{name:'日线',type:'candlestick',data:candles,itemStyle:{color:'#df6570',color0:'#4a9a8c',borderColor:'#df6570',borderColor0:'#4a9a8c'},markArea:{silent:true,data:stateAreas()},markPoint:includeLive?{symbol:'pin',symbolSize:36,itemStyle:{color:'#d89b48'},label:{formatter:'盘中',fontSize:10},data:[{coord:[quote.date,quote.high]}]}:undefined},tradeScatter(r.trades,1),tradeScatter(r.trades,-1)]},JSON.stringify([active,start,end,zoom,ds,candles,r.trades]));
}
function liveDayAvailable(){return !!(liveMarket?.quote?.date>data.dates.at(-1)&&liveMarket.quote.time>='09:30:00');}
function renderDay(){
 if(liveDaySelected&&liveDayAvailable())return renderLiveDay();
 for(const id of ['day-summary','trades','daily-trades'])htmlCache.delete(id);
 $('intraday').setAttribute('aria-label','所选交易日5分钟K线与模拟成交点');htmlIfChanged('trade-columns',historicalTradeHead);
 $('export').disabled=false;$('trade-heading-label').textContent='当日成交记录 ';$('replay-footnote').hidden=false;$('day-live-status').hidden=true;
 const r=results[active],ds=data.dates[day],local=day-start,trades=r.trades.filter(t=>t[0]===day),close=r.daily[local];
 $('day').value=ds;$('day-title').textContent=ds;$('prev').disabled=day===start;$('next').disabled=day===end-1&&!(end===data.dates.length&&liveDayAvailable());
 $('next-trade').disabled=!r.trades.some(t=>t[0]>day);
 const signal=active==='B'?null:(active==='L'?r.targets[local]:data.signals[active][day]);
 $('day-summary').innerHTML=`<span>H 事前状态<b>${modeNames[data.state[day]]}</b></span><span>前日 RSI(2)<b>${fmt(data.rsi[day],1)}</b></span><span>已披露合并净利润同比<b>${data.growth[day]===null?'缺失':pct(data.growth[day])}</b></span><span>选中策略目标<b>${signal?fmt(signal[1]*100,0)+'% · '+barTime(signal[0]):'首次建仓后持有'}</b></span><span>收盘仓位<b>${fmt(r.exposure[local]*100,1)}%</b></span><span>收盘权益<b>¥ ${fmt(r.nav[local],0)}</b></span>${active==='L'?'<span>收盘融资欠款<b>¥ '+fmt(r.debt[local],0)+'</b></span><span>当天计提利息<b>¥ '+fmt(r.dailyInterest[local])+'</b></span>':''}`;
 stableChart('intraday',{animation:false,grid:{left:68,right:35,top:28,bottom:38},tooltip:{...tooltip,formatter:candleTooltip},xAxis:{...axis,type:'category',data:Array.from({length:48},(_,j)=>barTime(j)),axisLabel:{...axis.axisLabel,interval:5}},yAxis:{...axis,scale:true,name:'元',nameTextStyle:{color:'#9ca7b5'},axisLabel:{...axis.axisLabel,formatter:v=>fmt(v)}},series:[{name:'5 分钟',type:'candlestick',data:data.bars[day].map(v=>[v[0],v[3],v[2],v[1]]),itemStyle:{color:'#df6570',color0:'#4a9a8c',borderColor:'#df6570',borderColor0:'#4a9a8c'},markLine:{silent:true,symbol:'none',lineStyle:{color:'#b3bdc9',type:'dashed',width:1},label:{show:false},data:[{yAxis:data.reference[day]}]}},tradeScatter(trades,1,true),tradeScatter(trades,-1,true)]},JSON.stringify(['history',active,ds,trades]));
 $('daily-trade-date').textContent=ds;
 $('daily-trades').innerHTML=trades.length?trades.map(t=>`<tr><td>${barTime(t[1])}</td><td class="${t[2]>0?'buy':'sell'}">${t[2]>0?'买入':'卖出'}</td><td>¥ ${fmt(t[4])}</td><td>${fmt(t[3],0)}</td><td>${fmt(tradePosition(data,t).before*100)}%</td><td>${fmt(tradePosition(data,t).after*100)}%</td></tr>`).join(''):'<tr><td colspan="6" class="empty">当日无成交</td></tr>';
 $('trade-count').textContent=`${trades.length} 笔`;
 $('trades').innerHTML=trades.length?trades.map(t=>`<tr><td>${barTime(t[1])}</td><td class="${t[2]>0?'buy':'sell'}">${t[2]>0?'▲ 买入':'▼ 卖出'}</td><td>¥ ${fmt(t[4])}</td><td>${fmt(t[3],0)}</td><td>¥ ${money(t[5])}</td><td>${fmt(t[12],0)} → ${fmt(t[7],0)}</td><td>${fmt(tradePosition(data,t).before*100)}%</td><td>${fmt(tradePosition(data,t).after*100)}%</td><td>¥ ${money(t[6])}</td></tr>`).join(''):`<tr><td colspan="9" class="empty">该策略当日无成交 · 收盘持有 ${fmt(close.shares,0)} 股，现金 ¥ ${money(close.cash)}</td></tr>`;
}
function renderStrategyHelp(){
 $('base-help').textContent=baseHelp[$('finance-base').value];
 $('gate-help').textContent=gateHelp[$('finance-gate').value];
 $('finance-pending').hidden=!data;
}
for(const id of ['finance-base','finance-drift','finance-gate','finance-level','finance-rate','finance-credit','finance-credit-mode'])$(id).addEventListener('change',renderStrategyHelp);
$('compare-prejuly').onclick=()=>{
 $('finance-base').value='D';$('finance-gate').value='all_full';$('finance-drift').value='buy_cap_only';$('finance-level').value='1.5';
 $('finance-rate').value='6';$('finance-credit-mode').value='equity50';$('finance-credit').disabled=true;
 renderStrategyHelp();$('finance-run').click();document.querySelector('[data-view="relative"]').click();
};
$('restore-default').onclick=()=>{
 $('finance-base').value='D';$('finance-gate').value='all_full';$('finance-drift').value='buy_cap_only';$('finance-level').value='1.5';
 $('finance-rate').value='6';$('finance-credit-mode').value='equity50';$('finance-credit').disabled=true;
 renderStrategyHelp();$('finance-run').click();
};
$('all-strategy-help').innerHTML=Object.entries(baseHelp).map(([k,v])=>`<p><strong>${names[k]}</strong>：${v}</p>`).join('')+Object.entries(gateHelp).map(([k,v])=>`<p><strong>${$('finance-gate').querySelector(`[value="${k}"]`).textContent}</strong>：${v}</p>`).join('');
$('finance-credit-mode').onchange=()=>{$('finance-credit').disabled=$('finance-credit-mode').value==='equity50';};
$('finance-run').onclick=()=>{if(!Array.from($('finance-settings').querySelectorAll('input')).every(i=>i.reportValidity()))return;run();document.querySelector('[data-model="L"]').click();};
$('form').addEventListener('submit',e=>{e.preventDefault();run();});
for(const b of document.querySelectorAll('[data-model]'))b.onclick=()=>{if(!data)return;active=b.dataset.model;document.querySelectorAll('[data-model]').forEach(x=>x.classList.toggle('active',x===b));renderMetrics();renderPerformance();renderPrice();renderDay();if(liveMarket)renderLive(liveMarket,liveCached);};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{if(!data)return;view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));renderPerformance();};
for(const b of document.querySelectorAll('[data-months]'))b.onclick=()=>{if(!data)return;const dt=new Date(data.dates.at(-1)+'T12:00:00Z');dt.setUTCMonth(dt.getUTCMonth()-Number(b.dataset.months));$('start').value=b.dataset.months==='0'?data.dates[0]:dt.toISOString().slice(0,10);$('end').value=data.dates.at(-1);document.querySelectorAll('[data-months]').forEach(x=>x.classList.toggle('selected',x===b));run();};
for(const id of ['start','end'])$(id).onchange=()=>document.querySelectorAll('[data-months]').forEach(x=>x.classList.remove('selected'));
$('prev').onclick=()=>{daySelectionTouched=true;if(liveDaySelected){liveDaySelected=false;day=end-1;renderDay();}else if(day>start){day--;renderDay();}};$('next').onclick=()=>{daySelectionTouched=true;if(day<end-1){day++;renderDay();}else if(end===data.dates.length&&liveDayAvailable()){liveDaySelected=true;renderDay();}};
$('today-replay').onclick=()=>{daySelectionTouched=true;if(liveDayAvailable()){liveDaySelected=true;renderDay();}};
$('next-trade').onclick=()=>{const next=results[active].trades.find(t=>t[0]>day);if(next){daySelectionTouched=true;liveDaySelected=false;day=next[0];renderDay();}};
$('day').onchange=()=>{daySelectionTouched=true;if(liveDayAvailable()&&$('day').value===liveMarket.quote.date){liveDaySelected=true;renderDay();return;}const i=indexAt($('day').value);if(i>=start&&i<end){liveDaySelected=false;day=i;renderDay();}else $('day').value=data.dates[day];};
$('apply-zoom').onclick=()=>{const ds=charts.price.getOption().xAxis[0].data,n=ds.length-1,visible=ds.slice(Math.ceil(n*zoom[0]/100),Math.floor(n*zoom[1]/100)+1).filter(d=>d<=data.dates.at(-1));if(!visible.length){showError('当前只包含盘中行情，尚不能用于完整交易日回测。');return;}$('start').value=visible[0];$('end').value=visible.at(-1);run();};
$('export').onclick=()=>{const r=results[active],rows=[['日期','时间','方向','数量','成交价','交易费用','成交后净现金（负数为欠款）','成交后持股','当日可卖','目标仓位','成交前持股','成交前仓位百分比','成交后仓位百分比','仓位估值价格'],...r.trades.map(t=>[data.dates[t[0]],barTime(t[1]),t[2]>0?'买入':'卖出',t[3],t[4],t[5].toFixed(4),t[6].toFixed(4),t[7],t[8],t[10],t[12],(tradePosition(data,t).before*100).toFixed(6),(tradePosition(data,t).after*100).toFixed(6),tradePosition(data,t).mark])];const blob=new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`沪电股份_${active}_${data.dates[start]}_${data.dates[end-1]}_成交.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function renderLive(market,cached){
 liveMarket=market;liveCached=cached;const q=market.quote,minute=market.minutes,change=q.price/q.previous-1;
 $('live-date').textContent=q.date;
 $('live-values').innerHTML=[['最新价',`¥ ${fmt(q.price)}`,change>=0?'buy':'sell'],['涨跌幅',pct(change),change>=0?'buy':'sell'],['今日开盘',`¥ ${fmt(q.open)}`,''],['最高 / 最低',`${fmt(q.high)} / ${fmt(q.low)}`,''],['昨日收盘',`¥ ${fmt(q.previous)}`,'']].map(([label,value,color])=>`<div><span>${label}</span><b class="${color}">${value}</b></div>`).join('');
 $('quote-time').textContent=`${cached?'缓存快照 · ':''}腾讯源时间 ${q.date} ${q.time}（北京时间）${minute?.points.length?' · 分时截至 '+minute.points.at(-1).time+(market.minutesCached?'（保留最近有效曲线，等待更新）':''):''}`;
 $('live-source-date').textContent=`历史回测截至 ${data.dates.at(-1)} · 最新报价 ${q.date}`;
 if(!charts.live)charts.live=echarts.init($('live-chart'));
 const points=minute?.points??[];
 const times=[...Array.from({length:121},(_,i)=>{const m=570+i;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}),...Array.from({length:121},(_,i)=>{const m=780+i;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');})];
 const prices=new Map(points.map(p=>[p.time,p.price]));
 const liveResult=liveResults[active],base=active==='L'?results.L.config.base:active;
 const state=liveSignal({context:liveContext,market,cached,model:active,config:results.L.config,
 previousTarget:data.signals[base]?.at(-1)?.[1]??1,portfolio:liveResult.daily.at(-1)});
 const replay=!!state.replaySignals?.length,displaySignals=replay?state.replaySignals:state.signals;
 const sizing=signal=>orderEstimate({...signal,portfolio:liveResult.daily.at(-1),model:active,config:results.L.config,slip:liveResult.slip,transfer:data.transfer.at(-1),stamp:data.stamp.at(-1),previous:q.previous});
 const estimateText=v=>{const e=sizing(v);return e.valid?`模型计划${v.side>0?'买入':'卖出'}差额 ${fmt(e.required,0)} 股；资金/可卖约束后的数量上限 ${fmt(e.qty,0)} 股${e.reason?'（'+e.reason+'）':''}；若按参考价及费用完成，仓位约 ${fmt(e.before*100)}% → ${fmt(e.after*100)}%。量能未核验，非成交。`:'持仓资料不足，无法试算数量。';};
 const trialQuantity=v=>{const p=liveResult.daily.at(-1),eq=p.cash+p.shares*v.price,budget=v.strength?.level===2?.2:.1;const cashOnly=orderEstimate({price:v.price,target:1,side:1,portfolio:p,model:'D',slip:liveResult.slip,transfer:data.transfer.at(-1),stamp:data.stamp.at(-1),previous:q.previous});const trial=orderEstimate({price:v.price,target:1,side:1,portfolio:{cash:Math.min(Math.max(0,p.cash),Math.max(0,eq*budget)),shares:0},model:'D',slip:liveResult.slip,transfer:data.transfer.at(-1),stamp:data.stamp.at(-1),previous:q.previous});return Math.max(0,Math.min(cashOnly.qty??0,trial.qty??0));};
 const opportunitySizing=v=>{if(!v.side)return '仅观察支撑区域，不设买卖数量。';const e=sizing({price:v.price,side:v.side,target:v.side>0?(active==='L'?results.L.config.level:1):0});return e.valid?`${v.side>0?'轻仓预算示例 '+fmt(trialQuantity(v),0)+' 股（现金试仓，非委托）。':''}按模型上日持仓独立试算：${v.side>0?'买入空间':'可卖数量上限'} ${fmt(e.qty,0)} 股${v.side<0?'（不是建议全部卖出）':''}。${e.reason?e.reason+'。':''}未逐笔扣减其他观察点，不是你的实际账户；观察信号不指定目标仓位。`:'持仓资料不足，数量无法试算。';};
 $('live-signal-title').textContent=`${names[active]} · ${actionableSignals(displaySignals).length?(replay?'当日计划点回看':'计划调仓提示'):(replay?'账户状态回看':'账户状态')}${cached?'（缓存行情）':''}`;
 $('live-signal-status').textContent=state.message;
 $('live-signal-context').textContent=`指标截至 ${liveContext?.asOf??'未载入'}，仅适用于 ${liveContext?.date??'待更新'}；模型账户承接 ${data.dates[0]} 起的完整历史模拟持仓，使用当前本金、滑点与已计算融资设置。按当前设置重算，不是当时推送的记录。`;
 htmlIfChanged('live-signals',displaySignals.map(v=>`<div class="signal-card"><strong class="${v.side>0?'buy':v.side<0?'sell':''}">${v.time}${replay?' · 回看':''} · ${v.side>0?'▲ 买入 / 加仓提示':v.side<0?'▼ 卖出 / 减仓提示':'账户状态：持仓不变，无买卖'}</strong><span>参考价 ¥ ${fmt(v.price)}（非成交价）</span><span>${v.passiveDrift?`模型仓位 ${fmt(v.before*100)}% · 持有不调整；${fmt(v.target*100,0)}% 仅为买入上限`:`模型起始仓位 ${fmt(v.before*100)}% → 目标 ${fmt(v.target*100,0)}%`}</span><span>${active==='L'?(v.gate?'融资条件已触发':v.gateMissing?'融资条件缺数据':'融资条件未触发'):'现金策略'} · 成交后仓位：尚无成交记录</span><span>${v.side?estimateText(v):'账户状态：无需下单；图中不设买卖标记。'}</span></div>`).join(''));
 const opportunity=opportunitySignals({context:opportunityContext,market,cached});
 $('opportunity-status').textContent=opportunity.message;
 $('opportunity-level').textContent=opportunityContext?.date===q.date?`10个月均线（包含当月实时价）=（前9个已完成月份收盘价合计 + 当前价）÷10；前复权价格尺度。当前约 ¥ ${fmt((opportunityContext.prior9Sum+q.price)/10)}；仅用已结束10个月的均线为 ¥ ${fmt(opportunityContext.closedMA10)}。`:'';
 htmlIfChanged('opportunity-signals',opportunity.signals.map(v=>`<details class="signal-card opportunity-card"><summary><strong class="${v.side>0?'buy':v.side<0?'sell':''}">${v.time} · ${v.title} · ${v.strength.label}${v.replay?'（回放）':''}</strong></summary><span>分钟点 ${v.time}，完成后最早 ${v.confirmedAt} 可确认 · 参考价 ¥ ${fmt(v.price)}</span><span>${v.strength.label} · ${v.strength.budget}；依据：${v.strength.evidence.join('、')||'仅触及'}。非胜率评分。</span><span>${v.reason}</span><span>失效条件：${v.invalidation}</span><span>${opportunitySizing(v)}</span></details>`).join('')||(opportunity.points?.length?'<p class="footnote">当前完整数据中尚无条件触发，不补造买卖点。</p>':''));
 const invalidationNote=v=>{const later=opportunity.signals.find(x=>x.parentId===v.id);return later?`截至当前资料：该观察已在 ${later.time} 失效（分钟完成后确认），不是仍有效的买入提示。`:v.parentId?'关联原买点：'+v.parentId.split('-').at(-1)+'；这是撤销原观察，不是T+0交易指令。':'';};
 const oppSeries=opportunity.signals.map(v=>({id:'opportunity-'+v.kind+'-'+v.time,name:'独立机会观察',type:'scatter',symbol:v.side===0?'circle':'triangle',symbolRotate:v.side<0?180:0,symbolSize:v.strength.level===2?17:13,z:12,itemStyle:{color:'#fff',borderColor:v.side>0?'#d65361':v.side<0?'#158d77':'#bd8a36',borderWidth:2},label:{show:false},data:[[v.time,v.price]],tooltip:{trigger:'item',formatter:`${v.time} ${v.title}${v.replay?'（回放）':''}<br>${v.strength.label} · ${v.strength.budget}<br>${invalidationNote(v)}<br>依据：${v.strength.evidence.join('、')||'仅触及'}；不是概率<br>该分钟完成后最早 ${v.confirmedAt} 可确认<br>确认时参考价 ¥ ${fmt(v.price)}<br>${v.reason}<br>失效：${v.invalidation}<br>${opportunitySizing(v)}<br>与模型仓位无关；不是已成交记录`}}));
 $('strength-explanation').textContent=strengthExplanation;
 const monthlyLine={id:'monthly',name:'动态10个月均线',type:'line',showSymbol:false,lineStyle:{type:'dashed',width:1,color:'#b28a48'},data:times.map(t=>opportunity.levels.find(x=>x[0]===t)?.[1]??null)};
 const signalSeries=actionableSignals(displaySignals).map(v=>({id:'plan-'+v.time,name:replay?'当日计划点回看':'计划调仓提示',type:'scatter',symbol:'triangle',symbolRotate:v.side<0?180:0,symbolSize:18,z:10,itemStyle:{color:v.side>0?'#e25562':'#168d75'},label:{show:false},data:[[v.time,v.price]],tooltip:{trigger:'item',formatter:`${v.time} ${replay?'计划点回看（非当前提示）':'策略提示'}<br>参考价 ¥ ${fmt(v.price)}<br>模型仓位 ${fmt(v.before*100)}% → 目标 ${fmt(v.target*100,0)}%<br>原模型规则执行 · 无独立强度评级；目标150%不代表强信号。<br>${estimateText(v)}<br>依据上日模型持仓独立试算，未生成成交；成交量、今日公司行动及借款利息尚待完整数据核对。`}}));
 const option={animation:false,grid:{left:68,right:35,top:20,bottom:30},tooltip:{...tooltip,hideDelay:150,extraCssText:tooltip.extraCssText+';max-width:460px;white-space:normal;line-height:1.7',valueFormatter:v=>v==null?'未发生':`¥ ${fmt(v)}`},xAxis:{...axis,type:'category',data:times,boundaryGap:false,axisLabel:{...axis.axisLabel,interval:(i,v)=>v.endsWith(':00')||v.endsWith(':30'),hideOverlap:true}},yAxis:{...axis,scale:true,axisLabel:{...axis.axisLabel,formatter:v=>fmt(v)}},series:[{id:'minutes',name:'分钟最新价',type:'line',showSymbol:false,connectNulls:false,itemStyle:{color:'#147f9d'},lineStyle:{width:1.7},areaStyle:{color:'#1a92b310'},data:times.map(t=>prices.get(t)??null),markLine:{silent:true,symbol:'none',label:{formatter:'昨收',position:'insideEndTop'},lineStyle:{type:'dashed',color:'#acb7c5',width:1},data:[{yAxis:q.previous}]}},monthlyLine,...signalSeries,...oppSeries]};
 stableChart('live',option,JSON.stringify([q.date,q.previous,points,opportunity.levels,oppSeries,signalSeries]));
 liveReplayPresentation={option,key:JSON.stringify([q.date,q.previous,points,opportunity.levels,oppSeries,signalSeries]),opportunity,displaySignals,estimateText,sizing,opportunitySizing,trialQuantity};
 if(liveDayAvailable()){$('today-replay').hidden=false;$('today-replay').textContent='最新行情 · '+q.date;$('day').max=q.date;if(!daySelectionTouched)liveDaySelected=true;}
 if(liveDaySelected)renderDay();else if(day===end-1&&end===data.dates.length)$('next').disabled=!liveDayAvailable();
 $('live-empty').hidden=points.length>0;
 renderPrice();
}
function renderLiveDay(){
 if(!liveReplayPresentation)return;
 const q=liveMarket.quote,v=liveReplayPresentation,signals=v.opportunity.signals,plans=actionableSignals(v.displaySignals),last=liveMarket.minutes?.points.at(-1)?.time??'缺失';
 $('intraday').setAttribute('aria-label','最新交易日分时曲线、独立观察和模型计划');htmlIfChanged('trade-columns','<tr><th>分钟点</th><th>观察 / 计划与强度</th><th>参考价格</th><th>数量试算（非成交）</th><th colspan="5">依据与风险说明</th></tr>');
 $('day').value=q.date;$('day-title').textContent=q.date+' · 最新行情';$('prev').disabled=false;$('next').disabled=true;$('next-trade').disabled=true;$('export').disabled=true;
 $('replay-footnote').hidden=true;$('day-live-status').hidden=false;
 $('day-live-status').textContent=`报价截至 ${q.date} ${q.time}，分钟源截至 ${last}${liveMarket.minutesCached?'（保留缓存）':''}。此页为分时曲线与观察/计划，不是已核验5分钟成交复盘；报价每秒、分时每30秒更新。已完成回测仍至 ${data.dates.at(-1)}。`;
 htmlIfChanged('day-summary',`<span>最新价<b>¥ ${fmt(q.price)}</b></span><span>今日开盘<b>¥ ${fmt(q.open)}</b></span><span>最高 / 最低<b>${fmt(q.high)} / ${fmt(q.low)}</b></span><span>日涨跌<b>${pct(q.price/q.previous-1)}</b></span><span>观察信号<b>${signals.length} 个</b></span><span>模型计划<b>${plans.length} 个 · 未生成成交</b></span>`);
 stableChart('intraday',v.option,'live-'+v.key);
 $('trade-heading-label').textContent='当日观察与计划 ';$('trade-count').textContent=`${signals.length} 个观察 / ${plans.length} 个计划 · 非成交记录`;
 const rows=[...signals.map(x=>({time:x.time,label:x.title+' · '+x.strength.label,price:x.price,qty:x.side?(x.side>0?'现金试仓示例 '+fmt(v.trialQuantity(x),0):'可卖上限 '+fmt(v.sizing({price:x.price,side:x.side,target:0}).qty??0,0))+' 股':'不新增',side:x.side,detail:x.reason+' '+x.strength.budget})),...plans.map(x=>({time:x.time,label:'模型计划'+(x.side>0?'买入':'卖出')+' · 强度未评级',price:x.price,qty:'计划上限 '+fmt(v.sizing(x).qty??0,0)+' 股',side:x.side,detail:v.estimateText(x)}))].sort((a,b)=>a.time.localeCompare(b.time));
 htmlIfChanged('trades',rows.map(x=>`<tr><td>${x.time}</td><td class="${x.side>0?'buy':x.side<0?'sell':''}">${x.label}</td><td>参考 ¥ ${fmt(x.price)}</td><td>${x.qty}（非成交）</td><td colspan="5" class="observation-detail"><details><summary>查看依据与风险</summary><p>${x.detail} · 尚无成交后仓位</p></details></td></tr>`).join('')||'<tr><td colspan="9" class="empty">等待完整分钟数据；不补造成交。</td></tr>');
 $('daily-trade-date').textContent=q.date+' · 实时观察';htmlIfChanged('daily-trades','<tr><td colspan="6" class="empty">今日行情已接入下方逐日复盘，观察与模型计划实时更新；尚未追加已核验模拟成交。</td></tr>');
}
let opportunityContext=null;
async function init(){try{
 const response=await fetch('./data.json');if(!response.ok)throw Error(`行情文件加载失败 (${response.status})`);data=await response.json();
 try{const c=await fetch('./live-context.json');if(c.ok)liveContext=await c.json();}catch{}
 try{const c=await fetch('./opportunity-context.json');if(c.ok)opportunityContext=await c.json();}catch{}
 const gateResponse=await fetch('./finance-gates.json');if(!gateResponse.ok)throw Error('融资条件数据加载失败');financeGates=await gateResponse.json();
 for(const id of ['performance','price','intraday'])charts[id]=echarts.init($(id),null,{renderer:'canvas'});
 charts.price.on('click',p=>{if(p.componentType!=='series')return;const date=p.seriesType==='candlestick'?p.name:p.value[0];const i=data.dates.indexOf(date);if(i>=start&&i<end){daySelectionTouched=true;liveDaySelected=false;day=i;renderDay();}else if(date===liveMarket?.quote.date){daySelectionTouched=true;liveDaySelected=true;renderDay();$('day-summary').scrollIntoView({behavior:'smooth',block:'start'});}});
 charts.price.on('datazoom',()=>{const o=charts.price.getOption().dataZoom[0];zoom=[o.start,o.end];});
 for(const id of ['start','end']){$(id).min=data.dates[0];$(id).max=data.dates.at(-1);}
 $('start').value=data.dates[0];$('end').value=data.dates.at(-1);$('run').disabled=false;$('run').textContent='重新回测 ↗';
 day=data.dates.length-1;renderStrategyHelp();run();
 liveController=startLive({onUpdate:renderLive,onStatus:text=>$('live-status').textContent=text});
 $('refresh-live').onclick=()=>liveController.refresh();
 $('show-live').onchange=()=>renderPrice();
 window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
 }catch(e){showError('看板未能载入：'+e.message+'。请刷新页面重试。');$('run').textContent='载入失败';$('range-note').textContent='行情数据尚未就绪';}}
startBriefings();
init();

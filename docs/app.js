import {startValuation} from './valuation.js?v=1';
const valuationPanel=startValuation();
import {explanationText,explanationHTML,explanationDetails} from './fill-explanation-view.js?v=1';
import {fillResultText} from './fill-result.js?v=27d3a8c7509e';
import {executionPosition,executionFills} from './execution-view.js?v=a1eaa4fe72d8';
import {monitoringPolicy} from './monitoring-policy.js?v=5b472db5ba98';
import {intradayTurns} from './intraday-turns.js?v=c437681f6bc1';
import {evidenceSessions,replayDates,freshnessText} from './session-archive.js?v=092746e2843e';
import {createPositionStart,startSnapshot} from './position-start.js?v=1367215c2c19';
import {positionView,startPositionFeed} from './live-position.js?v=73377a974da5';
import {historicalObservations,historyLines,tradeReason,dayChange} from './replay.js?v=d4ed060bcbec';
import {strengthExplanation} from './signal-strength.js?v=01d4074be540';
import {orderEstimate,hoverStableUpdater,actionableSignals} from './live-presentation.js?v=71e80230a188';
import {opportunitySignals} from './opportunities.js?v=0033d51afbce';
import {startBriefings} from './briefings.js?v=6f9223565966';
import {backtest,barTime} from './engine.js?v=a18b9052067f';
import {candleValues} from './market.js?v=3a58d356331d';
import {startLive} from './live.js?v=4a77ebe65a1d';
import {financeBacktest} from './finance-engine.js?v=e756fad09daa';
import {tradePosition} from './positions.js?v=0bef8d272a6e';
import {attribution} from './attribution.js?v=fb459d2c3f0d';
import {liveSignal} from './live-signals.js?v=1b90a32c6ba1';
import {baseHelp,gateHelp} from './strategy-help.js?v=9eb43595ba2a';
const $=id=>document.getElementById(id), names={D:'D · 反转 + 业绩门槛',H:'H · 三状态自适应',B:'持有基准 · 持续建仓',L:'L · 条件融资'},colors={D:'#078685',H:'#9070cc',B:'#9da9ba',L:'#cf933d'},modeNames=['防御空仓','反转交易','趋势参与'];
const fmt=(v,n=2)=>Number(v).toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n}),pct=v=>(v>0?'+':'')+fmt(v*100)+'%',money=v=>fmt(v,2),pctAxis=v=>fmt(v,0)+'%';
let data,financeGates,results={},active='L',view='equity',start=0,end=727,day=0,zoom=[0,100];
const historicalTradeHead=$('trade-columns').innerHTML;
let liveDaySelected=false,daySelectionTouched=false,liveReplayPresentation=null;
let sessionArchive={sessions:{}},archiveDay=null;
let liveMarket=null,liveController=null,liveContext=null,liveResults={},liveCached=false;
let executionSnapshot=null;
const snapshotForDate=date=>executionSnapshot?.date===date?executionSnapshot:sessionArchive.sessions[date]?.execution;
let positionSnapshot=null,positionFeed=null,positionFeedError=null,positionSelection=null;
const positionStorageKey='hudian-position-start-v1';
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
 results.ideal=backtest(data,'B',a,z,{...options,benchmarkMode:'ideal'});
 start=a;end=z;for(const key of ['D','H','B'])results[key]=backtest(data,key,a,z,options);
 results.L=financeBacktest(data,financeGates,a,z,{...options,base:$('finance-base').value,gate:$('finance-gate').value,driftPolicy:$('finance-drift').value,level:Number($('finance-level').value),rate:Number($('finance-rate').value)/100,credit:$('finance-credit-mode').value==='equity50'?null:Number($('finance-credit').value)});
 day=Math.max(start,Math.min(day,end-1));zoom=[0,100];$('finance-pending').hidden=true;
 $('range-note').textContent=`已回测 ${data.dates[start]} → ${data.dates[end-1]} · ${end-start} 个交易日`;
 $('day').min=data.dates[start];$('day').max=availableReplayDates().at(-1);if(end!==data.dates.length){archiveDay=null;liveDaySelected=false;}
 renderMetrics();renderPerformance();renderPrice();renderDay();
 // Live hints always inherit the full historical model account, independent of range selection.
 for(const k of ['D','H','B'])liveResults[k]=start===0&&end===data.dates.length?results[k]:backtest(data,k,0,data.dates.length,options);
 liveResults.L=start===0&&end===data.dates.length?results.L:financeBacktest(data,financeGates,0,data.dates.length,{...options,...results.L.config});

 const dc={...options,base:'D',gate:'all_full',driftPolicy:'buy_cap_only',level:1.5,rate:.06,credit:null};
 const fullDefault=financeBacktest(data,financeGates,0,data.dates.length,dc),fb=liveResults.B;
 const fullA=attribution(fullDefault,fb,data.dates),cut=data.dates.findIndex(d=>d>='2026-07-01');
 $('default-cost-result').textContent=`${data.dates[0]} 至 ${data.dates.at(-1)}，默认组合按当前本金与滑点、佣金万1计算：收益 ${pct(fullDefault.metrics.return_)}，最大回撤 ${fmt(-fullDefault.metrics.mdd5*100)}%，最长累计落后 ${fullA.longestBehind} 个交易日。历史研究归档保留旧费率。`;
 if(cut>0){const pre=financeBacktest(data,financeGates,0,cut,dc),pb=backtest(data,'B',0,cut,options),pa=attribution(pre,pb,data.dates.slice(0,cut));
 $('default-prejuly-result').textContent=`${data.dates[0]} 至 ${data.dates[cut-1]}，当前默认组合：收益 ${pct(pre.metrics.return_)}，最大回撤 ${fmt(-pre.metrics.mdd5*100)}%，累计领先持有 ${fmt(pa.leadFraction*100,1)}%；同期持有 ${pct(pb.metrics.return_)} / 回撤 ${fmt(-pb.metrics.mdd5*100)}%。佣金万1；这不是独立验证。`;}
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
 const bm=b.benchmark,cp=bm.completion;
 $('benchmark-note').textContent=`基准v2：持续使用初始本金建仓，受同样费用、滑点、整手、上一根成交量1%和涨停约束；首日仓位 ${fmt(bm.firstDayExposure*100)}%，${cp?'建仓结束 '+cp.date+' '+barTime(cp.bar):'区间结束仍未完成建仓'}，剩余初始预算 ¥ ${fmt(bm.initialBudgetRemaining,0)}。分红留现金，不再投入。理想全仓参考（同起点09:35、可买零股、无费用及容量限制、税前分红留现金）：收益 ${pct(results.ideal.metrics.return_)} / 5分钟回撤 ${fmt(-results.ideal.metrics.mdd5*100)}%；仅作参考，不是模拟成交或主对照。`;

 $('metrics').innerHTML=[['区间累计收益',pct(m.return_),`期末权益 ¥ ${fmt(r.nav.at(-1),0)}`,m.return_>=0?'positive':'negative'],['相对持有基准',(rel>0?'+':'')+fmt(rel*100)+' pp','收益率差 · 百分点',rel>=0?'positive':'negative'],['最大回撤 · 5 分钟',fmt(m.mdd5*100)+'%',`日线收盘回撤 ${fmt(m.mdd*100)}%`,''],['平均持仓比例',fmt(m.exposure*100)+'%',`${m.orders} 笔成交 · 费用 ¥ ${fmt(m.fees,0)}${active==='L'?' · 利息 ¥ '+fmt(m.interest,0):''}`,'']].map(([l,v,d,c])=>`<div class="metric"><div class="label">${l}</div><div class="value ${c}">${v}</div><div class="detail">${d}</div></div>`).join('');
 $('finance-stats').textContent=`已计算 ${results.L.config.base} / ${fmt(results.L.config.level*100,0)}% / 年息 ${fmt(results.L.config.rate*100,1)}% / ${results.L.config.creditMode==='equity50'?'融资上限为当前净资产的 50%':'固定额度 ¥ '+fmt(results.L.config.credit,0)}：利息 ¥ ${fmt(results.L.metrics.interest,0)} · 最低维持担保比例 ${results.L.metrics.min_maintenance?fmt(results.L.metrics.min_maintenance*100,1)+'%':'无借款'} · ${results.L.config.driftPolicy==='buy_cap_only'?'允许被动超仓':'原回调规则'} · 实际仓位峰值 ${fmt(results.L.metrics.max_exposure*100,1)}% · 使用融资 ${results.L.metrics.borrow_days} 天 · 期末欠款 ¥ ${fmt(results.L.metrics.ending_debt,0)}`;
 $('comparison-body').innerHTML=['D','H','L','B'].map(k=>{const m=results[k].metrics;return `<tr class="${k===active?'selected-row':''}"><td><span class="strategy-dot" style="background:${colors[k]}"></span>${names[k]}</td><td class="${m.return_>=0?'positive':'negative'}">${pct(m.return_)}</td><td>${k==='B'?'—':fmt((m.return_-b.metrics.return_)*100)+' pp'}</td><td>${fmt(m.mdd5*100)}%</td><td>${fmt(m.exposure*100,1)}%</td><td>${m.orders}</td><td>¥ ${fmt(m.fees,0)}${k==='L'?'<br><small>融资利息 ¥ '+fmt(m.interest,0)+'</small>':''}</td></tr>`}).join('');
}
function renderPerformance(){
 $('performance-freshness').textContent=freshnessText(data,start,end,sessionArchive);
 const dd=view==='drawdown',relative=view==='relative',dates=dd?['区间起点',...data.dates.slice(start,end).flatMap(d=>Array.from({length:48},(_,j)=>d+' '+(j===47?'15:00':barTime(j+1===24?24:j+1))))]:['区间起点',...data.dates.slice(start,end)];
 // The final morning bar is marked 11:30, not 13:00.
 if(dd)for(let d=0;d<end-start;d++)dates[1+d*48+23]=data.dates[start+d]+' 11:30';
 charts.performance.setOption({animation:false,grid:{left:68,right:35,top:48,bottom:45},legend:{top:12,right:25,icon:'roundRect',itemWidth:16,itemHeight:3,textStyle:{fontSize:11,color:'#718199'}},tooltip:{...tooltip,valueFormatter:v=>fmt(v)+'%'},xAxis:{...axis,type:'category',data:dates,boundaryGap:false,axisLabel:{...axis.axisLabel,formatter:v=>v.slice(0,10),hideOverlap:true,showMaxLabel:true}},yAxis:{...axis,type:'value',axisLabel:{...axis.axisLabel,formatter:pctAxis}},series:['D','H','L','B'].map(k=>({name:names[k],type:'line',showSymbol:false,sampling:dd?'min':'lttb',lineStyle:{width:k===active?2.5:1.7,type:k==='B'?'dashed':'solid'},itemStyle:{color:colors[k]},data:dd?[0,...results[k].drawdown]:[0,...results[k].nav.map((v,i)=>relative?(v/results.B.nav[i]-1)*100:(v/results[k].capital-1)*100)]}))},true);
}
function positionText(t){const p=tradePosition(data,t);return `${fmt(p.before*100,2)}% → ${fmt(p.after*100,2)}%`;}
function fillDetail(t){return `${barTime(t[1])} ${t[2]>0?'买入':'卖出'} ${fmt(t[3],0)} 股 @ ¥ ${fmt(t[4])}<br>实际仓位 ${positionText(t)}<br>${tradeReason(data,results[active],t)}<br>历史模拟成交；S/R强弱不是本订单评分`;}
function tradeScatter(trades,side,intraday=false){
 // Keep each fill as its own point, even on the daily chart.
 const points=trades.filter(t=>t[2]===side).map(t=>({value:[intraday?barTime(t[1]):data.dates[t[0]],t[4],t[3]],trade:t}));
 return {name:side>0?'买入成交':'卖出成交',type:'scatter',symbol:'triangle',symbolRotate:side>0?0:180,symbolSize:intraday?15:9,z:10,
 itemStyle:{color:side>0?'#e25562':'#168d75',borderColor:'#fff',borderWidth:1,opacity:1},data:points,
 tooltip:{trigger:'item',formatter:p=>`${data.dates[p.data.trade[0]]}<br>${fillDetail(p.data.trade)}`}};
}
function stateAreas(){if(!$('show-h-mode').checked)return [];let runs=[],a=start;for(let i=start+1;i<=end;i++)if(i===end||data.state[i]!==data.state[a]){runs.push([{xAxis:data.dates[a],itemStyle:{color:['#9faebe14','#9671d511','#58ab8015'][data.state[a]]}},{xAxis:data.dates[i-1]}]);a=i;}return runs;}
function candleTooltip(params){return params.map(p=>{if(p.seriesType==='candlestick'){const v=candleValues(p);const d=data.dates.indexOf(p.axisValue),q=liveMarket?.quote?.date===p.axisValue?liveMarket.quote:sessionArchive.sessions[p.axisValue]?.market.quote,change=d>=0?dayChange(data,d):q&&p.axisValue===q.date?q.price/q.previous-1:null;return `${p.axisValue}${change===null?'':' · 日涨跌 '+pct(change)}<br>开 ${fmt(v[0])}　收 ${fmt(v[1])}<br>低 ${fmt(v[2])}　高 ${fmt(v[3])}`;}if(p.seriesType==='scatter'&&p.data.trade)return `${p.marker}${fillDetail(p.data.trade)}`;return '';}).filter(Boolean).join('<br>');}
function renderPrice(){
 $('regime-caption').hidden=!$('show-h-mode').checked;
 const r=results[active],ds=data.dates.slice(start,end), candles=data.daily.slice(start,end).map(v=>[v[0],v[3],v[2],v[1]]);
 const quote=liveMarket?.quote, extras=end===data.dates.length&&$('show-live').checked?evidenceSessions(data,sessionArchive,liveMarket):[],includeLive=extras.some(([,v])=>v.live);
 for(const [date,v] of extras){const q=v.market.quote;ds.push(date);candles.push([q.open,q.price,q.low,q.high]);}
 $('live-candle-note').textContent=extras.length?`行情留存：${extras.map(([d])=>d).join('、')}（未纳入回测，可点击回看） · 完整回测截至 ${data.dates.at(-1)}`:'历史日线为不复权价格 · 买卖标记为含滑点的模拟成交价';
 stableChart('price',{animation:false,grid:{left:68,right:35,top:28,bottom:62},tooltip:{...tooltip,formatter:candleTooltip},xAxis:{...axis,type:'category',data:ds,axisPointer:{type:'shadow'},axisLabel:{...axis.axisLabel,hideOverlap:true}},yAxis:{...axis,scale:true,name:'元',nameTextStyle:{color:'#9ca7b5'},axisLabel:{...axis.axisLabel,formatter:v=>fmt(v,1)}},dataZoom:[{type:'inside',start:zoom[0],end:zoom[1]},{type:'slider',start:zoom[0],end:zoom[1],bottom:13,height:22,borderColor:'#edf1f6',fillerColor:'#13898812',handleStyle:{color:'#799aab'},textStyle:{color:'#8b9bad',fontSize:10}}],series:[{name:'日线',type:'candlestick',data:candles,itemStyle:{color:'#df6570',color0:'#4a9a8c',borderColor:'#df6570',borderColor0:'#4a9a8c'},markArea:{silent:true,data:stateAreas()},markPoint:includeLive?{symbol:'pin',symbolSize:36,itemStyle:{color:'#d89b48'},label:{formatter:'盘中',fontSize:10},data:[{coord:[quote.date,quote.high]}]}:undefined},tradeScatter(r.trades,1),tradeScatter(r.trades,-1)]},JSON.stringify([active,start,end,zoom,ds,candles,r.trades,$('show-h-mode').checked]));
}
function liveDayAvailable(){return !!(liveMarket?.quote?.date>data.dates.at(-1)&&liveMarket.quote.time>='09:30:00');}
function renderDay(){
 if(archiveDay&&sessionArchive.sessions[archiveDay])return renderArchivedDay();
 if(liveDaySelected&&liveDayAvailable())return renderLiveDay();
 for(const id of ['day-summary','trades','daily-trades'])htmlCache.delete(id);
 $('history-observations').hidden=false;$('intraday').setAttribute('aria-label','历史5分钟分时线与模拟成交；S/R在独立表格');htmlIfChanged('trade-columns',historicalTradeHead);
 $('export').disabled=false;$('trade-heading-label').textContent='当日成交记录 ';$('replay-footnote').hidden=false;$('day-live-status').hidden=true;
 const r=results[active],ds=data.dates[day],local=day-start,trades=r.trades.filter(t=>t[0]===day),close=r.daily[local];
 $('day').value=ds;$('day-title').textContent=ds;$('prev').disabled=day===start;$('next').disabled=day===end-1&&evidenceSessions(data,sessionArchive,liveMarket).length===0;
 $('next-trade').disabled=!r.trades.some(t=>t[0]>day);
 const observation=historicalObservations(data,day,replayContexts[ds]),path=historyLines(data,day,observation);
 const signal=active==='B'?null:(active==='L'?r.targets[local]:data.signals[active][day]);
 $('day-summary').innerHTML=`<span>当日涨跌幅<b class="${dayChange(data,day)>=0?'buy':'sell'}">${pct(dayChange(data,day))}</b></span><span>开 / 收<b>${fmt(data.daily[day][0])} / ${fmt(data.close[day])}</b></span><span>H 事前状态<b>${modeNames[data.state[day]]}</b></span><span>前日 RSI(2)<b>${fmt(data.rsi[day],1)}</b></span><span>已披露合并净利润同比<b>${data.growth[day]===null?'缺失':pct(data.growth[day])}</b></span><span>选中策略目标<b>${signal?fmt(signal[1]*100,0)+'% · '+barTime(signal[0]):'首次建仓后持有'}</b></span><span>收盘仓位<b>${fmt(r.exposure[local]*100,1)}%</b></span><span>收盘权益<b>¥ ${fmt(r.nav[local],0)}</b></span>${active==='L'?'<span>收盘融资欠款<b>¥ '+fmt(r.debt[local],0)+'</b></span><span>当天计提利息<b>¥ '+fmt(r.dailyInterest[local])+'</b></span>':''}`;
 const observationSeries=observation.signals.map(v=>({name:v.strength.label.split(' · ')[0]+'观察',type:'scatter',symbol:v.side===0?'circle':'triangle',symbolRotate:v.side<0?180:0,symbolSize:v.strength.level===2?17:13,z:12,itemStyle:{color:'#fff',borderColor:v.side>0?'#d65361':v.side<0?'#158d77':'#bd8a36',borderWidth:2},data:[[v.confirmedAt,v.price]],tooltip:{trigger:'item',formatter:`${v.confirmedAt} 确认 · ${v.strength.label}<br>${v.title}<br>参考 ¥ ${fmt(v.price)} · 日涨跌 ${pct(v.price/data.reference[day]-1)}<br>${v.reason}<br>强弱依据：${v.strength.evidence.join('、')}<br>失效：${v.invalidation}<br>独立观察，未自动纳入成交；5分钟近似，不是1分钟还原`}}));
 const values=[...path.price,...path.vwap,data.reference[day],...trades.map(t=>t[4])].filter(Number.isFinite),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.06,.02),ymin=Math.floor((lo-pad)*100)/100,ymax=Math.ceil((hi+pad)*100)/100;
 stableChart('intraday',{animation:false,grid:{left:68,right:72,top:42,bottom:38},legend:{top:5,data:['5分钟价格线','动态10个月均线','日内成交均价'],textStyle:{color:'#8b9bad',fontSize:11}},tooltip:{...tooltip,formatter:ps=>`${ps[0]?.axisValue??''}<br>`+ps.filter(p=>p.seriesName!=='涨跌刻度').map(p=>p.data?.trade?fillDetail(p.data.trade):Array.isArray(p.value)?'':p.value===null?'':`${p.marker}${p.seriesName} ¥ ${fmt(p.value)}${p.seriesName==='5分钟价格线'?' · 涨跌 '+pct(p.value/data.reference[day]-1):''}`).filter(Boolean).join('<br>')},xAxis:{...axis,type:'category',data:path.times,boundaryGap:false,axisLabel:{...axis.axisLabel,interval:(_,t)=>['09:30','10:00','10:30','11:00','11:30','13:00','13:30','14:00','14:30','15:00'].includes(t),hideOverlap:true}},yAxis:[{...axis,min:ymin,max:ymax,scale:true,name:'元',axisLabel:{...axis.axisLabel,formatter:v=>fmt(v)}},{...axis,min:ymin,max:ymax,scale:true,name:'较昨收',axisLabel:{...axis.axisLabel,formatter:v=>pct(v/data.reference[day]-1)},splitLine:{show:false}}],series:[{name:'5分钟价格线',type:'line',showSymbol:false,data:path.price,itemStyle:{color:'#148eab'},lineStyle:{color:'#148eab',width:2},areaStyle:{color:'#148eab',opacity:.04},markLine:{silent:true,symbol:'none',lineStyle:{color:'#aab8c9',type:'dashed',width:1},label:{show:true,formatter:'昨收',position:'insideEndTop'},data:[{yAxis:data.reference[day]}]}},{name:'动态10个月均线',type:'line',showSymbol:false,data:path.monthly,itemStyle:{color:'#c39340'},lineStyle:{color:'#c39340',width:1,type:'dashed'}},{name:'日内成交均价',type:'line',showSymbol:false,data:path.vwap,itemStyle:{color:'#a0aabc'},lineStyle:{color:'#a0aabc',width:1,type:'dotted'}},{name:'涨跌刻度',type:'line',yAxisIndex:1,data:path.price,showSymbol:false,silent:true,lineStyle:{opacity:0},tooltip:{show:false}},tradeScatter(trades,1,true),tradeScatter(trades,-1,true)]},JSON.stringify(['history-line',active,ds,trades,observation.signals]));
 $('history-observation-count').textContent=`${observation.signals.length} 个 · 5分钟近似重建`;
 $('history-observation-rows').innerHTML=observation.signals.map(v=>`<tr><td>${v.confirmedAt}<br><small>${v.time}起5分钟完成</small></td><td class="${v.side>0?'buy':v.side<0?'sell':''}">${v.strength.label}<br>${v.title}</td><td>¥ ${fmt(v.price)}<br>${pct(v.price/data.reference[day]-1)}</td><td class="observation-detail"><details><summary>查看依据与风险</summary><p>${v.reason}</p><p>强弱依据：${v.strength.evidence.join('、')}。</p><p>失效条件：${v.invalidation} 独立于持仓，非成交指令；不会自动改写当前模型收益。</p></details></td></tr>`).join('')||`<tr><td colspan="4" class="empty">${observation.message?.includes('暂停')?observation.message:'当日5分钟资料未触发S/R条件，不补造信号。'}</td></tr>`;
 $('daily-trade-date').textContent=ds+' · 日涨跌 '+pct(dayChange(data,day));
 $('daily-trades').innerHTML=trades.length?trades.map(t=>`<tr><td>${barTime(t[1])}</td><td class="${t[2]>0?'buy':'sell'}">${t[2]>0?'买入':'卖出'}</td><td>¥ ${fmt(t[4])}</td><td>${fmt(t[3],0)}</td><td>${fmt(tradePosition(data,t).before*100)}%</td><td>${fmt(tradePosition(data,t).after*100)}%</td></tr>`).join(''):'<tr><td colspan="6" class="empty">当日无成交</td></tr>';
 $('trade-count').textContent=`${trades.length} 笔`;
 $('trades').innerHTML=trades.length?trades.map(t=>`<tr><td>${barTime(t[1])}</td><td class="${t[2]>0?'buy':'sell'}">${t[2]>0?'▲ 买入':'▼ 卖出'}</td><td>¥ ${fmt(t[4])}</td><td>${fmt(t[3],0)}</td><td>¥ ${money(t[5])}</td><td>${fmt(t[12],0)} → ${fmt(t[7],0)}</td><td>${fmt(tradePosition(data,t).before*100)}%</td><td>${fmt(tradePosition(data,t).after*100)}%</td><td>¥ ${money(t[6])}</td><td class="observation-detail"><details><summary>查看成交原因</summary><p>${tradeReason(data,r,t)}</p></details></td></tr>`).join(''):`<tr><td colspan="10" class="empty">该策略当日无成交 · 收盘持有 ${fmt(close.shares,0)} 股，现金 ¥ ${money(close.cash)}</td></tr>`;
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
function availableReplayDates(){return replayDates(data,start,end,sessionArchive,liveMarket);}
function selectedReplayDate(){return archiveDay??(liveDaySelected?liveMarket?.quote.date:data.dates[day]);}
function selectReplayDate(date){
 daySelectionTouched=true;archiveDay=null;liveDaySelected=false;
 if(liveDayAvailable()&&date===liveMarket.quote.date)liveDaySelected=true;
 else if(date>data.dates.at(-1)&&sessionArchive.sessions[date])archiveDay=date;
 else {const i=data.dates.indexOf(date);if(i<start||i>=end)return;day=i;}
 renderDay();
}
for(const [id,step] of [['prev',-1],['next',1]])$(id).onclick=()=>{const dates=availableReplayDates(),i=dates.indexOf(selectedReplayDate());if(dates[i+step])selectReplayDate(dates[i+step]);};
$('today-replay').onclick=()=>{const date=availableReplayDates().at(-1);if(date)selectReplayDate(date);};
$('next-trade').onclick=()=>{const next=results[active].trades.find(t=>data.dates[t[0]]>selectedReplayDate());if(next)selectReplayDate(data.dates[next[0]]);};
$('day').onchange=()=>{const date=$('day').value;if(availableReplayDates().includes(date))selectReplayDate(date);else $('day').value=selectedReplayDate();};
$('apply-zoom').onclick=()=>{const ds=charts.price.getOption().xAxis[0].data,n=ds.length-1,visible=ds.slice(Math.ceil(n*zoom[0]/100),Math.floor(n*zoom[1]/100)+1).filter(d=>d<=data.dates.at(-1));if(!visible.length){showError('当前只包含盘中行情，尚不能用于完整交易日回测。');return;}$('start').value=visible[0];$('end').value=visible.at(-1);run();};
$('export').onclick=()=>{const r=results[active],rows=[['日期','时间','方向','数量','成交价','交易费用','成交后净现金（负数为欠款）','成交后持股','当日可卖','目标仓位','成交前持股','成交前仓位百分比','成交后仓位百分比','仓位估值价格','成交原因'],...r.trades.map(t=>[data.dates[t[0]],barTime(t[1]),t[2]>0?'买入':'卖出',t[3],t[4],t[5].toFixed(4),t[6].toFixed(4),t[7],t[8],t[10],t[12],(tradePosition(data,t).before*100).toFixed(6),(tradePosition(data,t).after*100).toFixed(6),tradePosition(data,t).mark,tradeReason(data,r,t)])];const blob=new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`沪电股份_${active}_${data.dates[start]}_${data.dates[end-1]}_成交.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function renderPosition(){
 const state=positionView(positionSelection?startSnapshot(positionSelection,liveMarket?.quote):(executionPosition(executionSnapshot,liveMarket?.quote?.date)??positionSnapshot),liveMarket,{cached:liveCached});
 if(positionSelection){
  state.modelLabel='自选起点 · 默认 D';
  state.message=positionSelection.pending?'等待起算行情':state.metrics?'自选起点情景 · 条件估值':'等待起算时点之后的有效报价';
  state.acceptedMessage='独立模拟账户，起始净资产100万元；当日自动执行尚未验收。';
  $('position-selection').textContent=`已选择 ${positionSelection.settings.date} · 起始持股 ${fmt(positionSelection.settings.weight*100,0)}% · ${positionSelection.settings.holding==='old'?'可卖老仓':'当日新仓'}。`+(positionSelection.pending?positionSelection.message:`实际起算：${positionSelection.actualStart}。`);
 }else $('position-selection').textContent='当前显示原连续模型；选择条件并点击按钮后切换，设置仅保存在此浏览器。';
 $('position-state').textContent=state.message;
 $('position-state').className='position-state '+state.status;
 $('position-accepted').textContent=state.acceptedMessage??'';
 $('position-model').textContent=state.modelLabel??'默认 D · 条件融资';
 const m=state.metrics;
 htmlIfChanged('position-values',m?[
  ['持股数量',fmt(m.shares,0)+' 股'],['可卖老仓'+(state.status==='conditional'?'（条件值）':''),fmt(m.available,0)+' 股'],
  ['仓位比例',m.weight===null?'净资产非正':fmt(m.weight*100)+'%'],['持仓市值','¥ '+money(m.marketValue)],
  [state.todayInterestPosted?'净资产':'净资产（今日息前）','¥ '+money(m.equity)],['可用现金','¥ '+money(m.cash)],['融资欠款','¥ '+money(m.debt)],[positionSelection?'缺口期利息':'周末估算利息',positionSelection?'未入账':'¥ '+money(m.carryInterest)]
 ].map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join(''):'<p class="footnote">持股、可卖数量、仓位比例、现金及欠款等待有效账户资料。</p>');
 $('position-time').textContent=m?`持仓来源：${state.sourceSession} · 账户资料时间：${new Date(state.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})} · ${state.stale?'最近报价估值（非实时）':'估值报价'}：${state.quoteTime}（北京时间）。` : '';
 $('position-notes').textContent=[positionFeedError,...(state.assumptions??[]),...(state.limitations??[])].filter(Boolean).join(' ');
}
function renderLive(market,cached){
 valuationPanel.quote(market.quote,cached);
 liveMarket=market;liveCached=cached;renderPosition();void refreshOpportunityContext();const q=market.quote,minute=market.minutes,change=q.price/q.previous-1;
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
 const opportunitySizing=v=>'独立价格观察：不使用账户、资金、仓位或可卖数量，不生成订单。';
 $('live-signal-title').textContent=`${names[active]} · ${actionableSignals(displaySignals).length?(replay?'当日计划点回看':'计划调仓提示'):(replay?'账户状态回看':'账户状态')}${cached?'（缓存行情）':''}`;
 $('live-signal-status').textContent=state.message;
 $('live-signal-context').textContent=`指标截至 ${liveContext?.asOf??'未载入'}，仅适用于 ${liveContext?.date??'待更新'}；模型账户承接 ${data.dates[0]} 起的完整历史模拟持仓，使用当前本金、滑点与已计算融资设置。按当前设置重算，不是当时推送的记录。`;
 htmlIfChanged('live-signals',(monitoringPolicy.fillsOnly?[]:displaySignals).map(v=>`<div class="signal-card"><strong class="${v.side>0?'buy':v.side<0?'sell':''}">${v.time}${replay?' · 回看':''} · ${v.side>0?'▲ 买入 / 加仓提示':v.side<0?'▼ 卖出 / 减仓提示':'账户状态：持仓不变，无买卖'}</strong><span>参考价 ¥ ${fmt(v.price)}（非成交价）</span><span>${v.passiveDrift?`模型仓位 ${fmt(v.before*100)}% · 持有不调整；${fmt(v.target*100,0)}% 仅为买入上限`:`模型起始仓位 ${fmt(v.before*100)}% → 目标 ${fmt(v.target*100,0)}%`}</span><span>${active==='L'?(v.gate?'融资条件已触发':v.gateMissing?'融资条件缺数据':'融资条件未触发'):'现金策略'} · 成交后仓位：尚无成交记录</span><span>${v.side?estimateText(v):'账户状态：无需下单；图中不设买卖标记。'}</span></div>`).join(''));
 const opportunity=monitoringPolicy.fillsOnly?{signals:[],points:[],message:'S/R观察已暂停，仅提示已核验模拟成交'}:opportunitySignals({context:opportunityContext,market,cached});
 $('opportunity-status').textContent=opportunity.message;
 $('opportunity-level').textContent=opportunityContext?.date===q.date?`10个月均线（包含当月实时价）=（前9个已完成月份收盘价合计 + 当前价）÷10；前复权价格尺度。当前约 ¥ ${fmt((opportunityContext.prior9Sum+q.price)/10)}；仅用已结束10个月的均线为 ¥ ${fmt(opportunityContext.closedMA10)}。`:'';
 htmlIfChanged('opportunity-signals',opportunity.signals.map(v=>`<details class="signal-card opportunity-card"><summary><strong class="${v.side>0?'buy':v.side<0?'sell':''}">${v.time} · ${v.title} · ${v.strength.label}${v.replay?'（回放）':''}</strong></summary><span>分钟点 ${v.time}，完成后最早 ${v.confirmedAt} 可确认 · 参考价 ¥ ${fmt(v.price)}</span><span>${v.strength.label} · 依据：${v.strength.evidence.join('、')||'仅触及'}。非胜率评分。</span><span>${v.reason}</span><span>失效条件：${v.invalidation}</span><span>${opportunitySizing(v)}</span></details>`).join('')||(opportunity.points?.length?'<p class="footnote">当前完整数据中尚无条件触发，不补造买卖点。</p>':''));
 $('strength-explanation').textContent='S0为触及观察，S1/S2为规则确认等级，R为转弱或失效风险；不是胜率，不给出账户数量，也不自动生成模拟成交。';
 const signalSeries=(monitoringPolicy.fillsOnly?[]:actionableSignals(displaySignals)).map(v=>({id:'plan-'+v.time,name:replay?'当日计划点回看':'计划调仓提示',type:'scatter',symbol:'triangle',symbolRotate:v.side<0?180:0,symbolSize:18,z:10,itemStyle:{color:v.side>0?'#e25562':'#168d75'},label:{show:false},data:[[v.time,v.price]],tooltip:{trigger:'item',formatter:`${v.time} ${replay?'计划点回看（非当前提示）':'策略提示'}<br>参考价 ¥ ${fmt(v.price)}<br>模型仓位 ${fmt(v.before*100)}% → 目标 ${fmt(v.target*100,0)}%<br>原模型规则执行 · 无独立强度评级；目标150%不代表强信号。<br>${estimateText(v)}<br>依据上日模型持仓独立试算，未生成成交；成交量、今日公司行动及借款利息尚待完整数据核对。`}}));
 const fillSeries=executionFills(snapshotForDate(q.date),q.date).map(e=>({id:e.event_id,name:'已核验模拟成交',type:'scatter',symbol:'triangle',symbolRotate:e.side==='sell'?180:0,symbolSize:19,z:20,itemStyle:{color:e.side==='buy'?'#e25562':'#168d75'},label:{show:true,formatter:e.side==='buy'?'买':'卖',position:e.side==='buy'?'bottom':'top'},data:[[e.fill_time.slice(11,16),e.price]],tooltip:{trigger:'item',formatter:()=>`${e.fill_time.slice(11,19)} · 已核验模拟${e.side==='buy'?'买入':'卖出'}<br>${fillResultText(e)}<br>${explanationHTML(e)}<br>模拟成交价 ¥ ${fmt(e.price)}<br>费用 ¥ ${fmt(e.fee??0)}<br>网页截至已发布版本；非真实交易`}}));
 signalSeries.push(...fillSeries);
 const option={animation:false,grid:{left:68,right:35,top:20,bottom:30},tooltip:{...tooltip,hideDelay:150,extraCssText:tooltip.extraCssText+';max-width:460px;white-space:normal;line-height:1.7',valueFormatter:v=>v==null?'未发生':`¥ ${fmt(v)}`},xAxis:{...axis,type:'category',data:times,boundaryGap:false,axisLabel:{...axis.axisLabel,interval:(i,v)=>v.endsWith(':00')||v.endsWith(':30'),hideOverlap:true}},yAxis:{...axis,scale:true,axisLabel:{...axis.axisLabel,formatter:v=>fmt(v)}},series:[{id:'minutes',name:'分钟最新价',type:'line',showSymbol:false,connectNulls:false,itemStyle:{color:'#147f9d'},lineStyle:{width:1.7},areaStyle:{color:'#1a92b310'},data:times.map(t=>prices.get(t)??null),markLine:{silent:true,symbol:'none',label:{formatter:'昨收',position:'insideEndTop'},lineStyle:{type:'dashed',color:'#acb7c5',width:1},data:[{yAxis:q.previous}]}},...signalSeries]};
 stableChart('live',option,JSON.stringify([q.date,q.previous,points,signalSeries]));
 const turns=monitoringPolicy.turningPointsPaused?{signals:[],message:'日内高低点已暂停；仅提示已核验模拟成交'}:intradayTurns({market,cached});
 if(!charts.turns)charts.turns=echarts.init($('turning-chart'));
 const markers=turns.signals.map(v=>({id:v.id,name:v.title,type:'scatter',symbol:'diamond',symbolSize:13,itemStyle:{color:v.kind==='low'?'#287cc1':'#a875ca'},label:{show:true,formatter:v.kind==='low'?'低':'高',position:v.kind==='low'?'bottom':'top'},data:[[v.confirmedAt,v.price]],tooltip:{trigger:'item',formatter:`${v.title} · ${v.replay?'回放':'观察'}<br>候选 ${v.pivotTime} / ¥ ${fmt(v.pivotPrice)}<br>确认 ${v.confirmedAt} / 当时参考 ¥ ${fmt(v.price)}<br>${v.reason}<br>${v.invalidation}`}}));
 const turnOption={...option,series:[option.series[0],...markers]};
 stableChart('turns',turnOption,JSON.stringify([q.date,points,turns.signals]));
 $('turning-status').textContent=turns.message;
 htmlIfChanged('turning-points',turns.signals.map(v=>`<details class="signal-card"><summary>${v.confirmedAt} · ${v.title}${v.replay?'（回放）':''} · ¥ ${fmt(v.price)}</summary><span>候选位置 ${v.pivotTime} / ¥ ${fmt(v.pivotPrice)}；直到 ${v.confirmedAt} 才满足确认条件。</span><span>${v.reason} ${v.invalidation}</span></details>`).join('')||(monitoringPolicy.turningPointsPaused?'<p class="footnote">已按用户要求暂停，历史证据保留。</p>':'<p class="footnote">尚无满足固定条件的局部点，或连续分钟不足；不等于没有做T机会。</p>'));

 liveReplayPresentation={option,key:JSON.stringify([q.date,q.previous,points,signalSeries]),opportunity,displaySignals,estimateText,sizing,opportunitySizing};
 if(liveDayAvailable()){$('today-replay').hidden=false;$('today-replay').textContent='最新行情 · '+q.date;$('day').max=q.date;if(!daySelectionTouched){archiveDay=null;liveDaySelected=true;}}
 if(liveDaySelected)renderDay();else if(!archiveDay&&day===end-1&&end===data.dates.length)$('next').disabled=!liveDayAvailable();
 $('live-empty').hidden=points.length>0;
 renderPrice();
}
function renderArchivedDay(){
 const entry=sessionArchive.sessions[archiveDay],m=entry.market,q=m.quote,points=m.minutes.points,dates=availableReplayDates(),i=dates.indexOf(archiveDay),fills=executionFills(entry.execution,archiveDay);
 const fillSeries=fills.map(e=>({name:'模拟'+(e.side==='buy'?'买入':'卖出'),type:'scatter',symbol:'triangle',symbolRotate:e.side==='sell'?180:0,symbolSize:17,z:20,itemStyle:{color:e.side==='buy'?'#e25562':'#168d75'},label:{show:true,formatter:e.side==='buy'?'买':'卖',position:'top'},data:[[e.fill_time.slice(11,16),e.price]],tooltip:{formatter:()=>`${e.fill_time.slice(11,19)} · ${fillResultText(e)}<br>${explanationHTML(e)}<br>模拟价 ¥ ${fmt(e.price)}<br>${explanationHTML(e)}<br>非真实交易`}}));
 $('history-observations').hidden=true;$('export').disabled=true;$('replay-footnote').hidden=true;$('day-live-status').hidden=false;
 $('day').value=archiveDay;$('day').max=dates.at(-1);$('day-title').textContent=archiveDay+' · 行情留存';$('prev').disabled=i<=0;$('next').disabled=i===dates.length-1;$('next-trade').disabled=true;
 $('day-live-status').textContent=`${entry.reason} 报价源时钟 ${q.date} ${q.time}，分钟截至 ${points.at(-1)?.time??'缺失'}；留存行情不会随最新交易日切换而消失。`;
 $('intraday').setAttribute('aria-label','留存交易日分钟价格与累计成交均价，未验收模拟成交');
 htmlIfChanged('day-summary',`<span>收盘快照<b>¥ ${fmt(q.price)}</b></span><span>开 / 高 / 低<b>${fmt(q.open)} / ${fmt(q.high)} / ${fmt(q.low)}</b></span><span>日涨跌<b>${pct(q.price/q.previous-1)}</b></span><span>模拟成交<b>${entry.execution?.accountEstablished?fills.length+' 笔':'账户缺失'}</b></span><span>当日报告<b><a href="${entry.report}">盘后复盘 ↗</a></b></span>`);
 stableChart('intraday',{animation:false,grid:{left:68,right:35,top:42,bottom:38},legend:{top:5},tooltip:{...tooltip,valueFormatter:v=>v==null?'缺失':'¥ '+fmt(v)},xAxis:{...axis,type:'category',data:points.map(p=>p.time),boundaryGap:false,axisLabel:{...axis.axisLabel,showMaxLabel:true}},yAxis:{...axis,scale:true,name:'元'},series:[{name:'分钟价格（留存）',type:'line',showSymbol:false,data:points.map(p=>p.price),lineStyle:{color:'#148eab',width:2}},{name:'累计成交均价',type:'line',showSymbol:false,data:points.map(p=>p.volume>0&&p.amount>0?p.amount/p.volume:null),lineStyle:{color:'#9aaabb',type:'dotted'}},...fillSeries]},'archive-'+archiveDay+'-'+entry.sourceSHA256);
 $('trade-heading-label').textContent='成交验收状态 ';$('trade-count').textContent='行情留存 · 不补造成交';htmlIfChanged('trade-columns',historicalTradeHead);
 htmlIfChanged('trades','<tr><td colspan="10" class="empty">该日账户与模拟成交尚未验收。不能把无已核验记录解释成策略无需操作；买卖、持仓及收益留空。</td></tr>');
 $('daily-trade-date').textContent=archiveDay+' · 行情留存';htmlIfChanged('daily-trades',`<tr><td colspan="6" class="empty">${entry.reason} <a href="${entry.report}">查看当日复盘</a></td></tr>`);
 if(entry.execution?.accountEstablished){
  $('trade-heading-label').textContent='历史已核验模拟成交 ';$('trade-count').textContent=`${fills.length} 笔 · 原始成交凭据`;
  htmlIfChanged('trade-columns','<tr><th>成交时间</th><th>方向</th><th>模拟价</th><th>数量（股）</th><th colspan="5">成交结果</th></tr>');
  htmlIfChanged('trades',fills.map(e=>`<tr><td>${e.fill_time.slice(11,19)}</td><td>${e.side==='buy'?'模拟买入':'模拟卖出'}</td><td>¥ ${fmt(e.price)}</td><td>${fmt(e.quantity,0)}</td><td colspan="5">${fillResultText(e)}${explanationDetails(e)}</td></tr>`).join('')||'<tr><td colspan="9">账户已建立，无已核验模拟成交；不据此推定完整执行覆盖。</td></tr>');
  htmlIfChanged('daily-trades',fills.map(e=>`<tr><td>${e.fill_time.slice(11,19)}</td><td>${e.side==='buy'?'模拟买入':'模拟卖出'}</td><td>¥ ${fmt(e.price)}</td><td>${fmt(e.quantity,0)}</td><td>${e.positionResult?.beforeWeightPct?.toFixed(2)??'—'}%</td><td>${e.positionResult?.afterWeightPct?.toFixed(2)??'—'}%${explanationDetails(e)}</td></tr>`).join('')||'<tr><td colspan="6">当日无已核验模拟成交。</td></tr>');
 }

}

function renderLiveDay(){
 $('history-observations').hidden=true;
 if(!liveReplayPresentation)return;
 const q=liveMarket.quote,v=liveReplayPresentation,signals=v.opportunity.signals,plans=actionableSignals(v.displaySignals),last=liveMarket.minutes?.points.at(-1)?.time??'缺失';
 $('intraday').setAttribute('aria-label','最新交易日模拟账户策略计划，非已成交');htmlIfChanged('trade-columns','<tr><th>分钟点</th><th>模型计划（非成交）</th><th>参考价格</th><th>数量试算（非成交）</th><th colspan="5">依据与风险说明</th></tr>');
 $('day').value=q.date;$('day-title').textContent=q.date+' · 最新行情';$('prev').disabled=false;$('next').disabled=true;$('next-trade').disabled=true;$('export').disabled=true;
 $('replay-footnote').hidden=true;$('day-live-status').hidden=false;
 $('day-live-status').textContent=`报价截至 ${q.date} ${q.time}，分钟源截至 ${last}${liveMarket.minutesCached?'（保留缓存）':''}。此页为分时曲线与观察/计划，不是已核验5分钟成交复盘；报价与分时每5秒请求更新。已完成回测仍至 ${data.dates.at(-1)}。`;
 htmlIfChanged('day-summary',`<span>最新价<b>¥ ${fmt(q.price)}</b></span><span>今日开盘<b>¥ ${fmt(q.open)}</b></span><span>最高 / 最低<b>${fmt(q.high)} / ${fmt(q.low)}</b></span><span>日涨跌<b>${pct(q.price/q.previous-1)}</b></span><span>观察信号<b>${signals.length} 个</b></span><span>模型计划<b>${plans.length} 个 · 未生成成交</b></span>`);
 stableChart('intraday',v.option,'live-'+v.key);
 $('trade-heading-label').textContent='模拟账户 · 策略计划 ';$('trade-count').textContent=`${plans.length} 个计划 · 非成交记录；独立高低点见上方单独图表`;
 const rows=plans.map(x=>({time:x.time,label:'模型计划'+(x.side>0?'买入':'卖出')+' · 非成交',price:x.price,qty:'计划上限 '+fmt(v.sizing(x).qty??0,0)+' 股',side:x.side,detail:v.estimateText(x)})).sort((a,b)=>a.time.localeCompare(b.time));
 htmlIfChanged('trades',rows.map(x=>`<tr><td>${x.time}</td><td class="${x.side>0?'buy':x.side<0?'sell':''}">${x.label}</td><td>参考 ¥ ${fmt(x.price)}</td><td>${x.qty}（非成交）</td><td colspan="5" class="observation-detail"><details><summary>查看依据与风险</summary><p>${x.detail} · 尚无成交后仓位</p></details></td></tr>`).join('')||'<tr><td colspan="9" class="empty">等待完整分钟数据；不补造成交。</td></tr>');
 if(monitoringPolicy.fillsOnly){
 const fills=executionFills(snapshotForDate(q.date),q.date);
 $('trade-heading-label').textContent='桌面连续账户 · 已核验模拟成交 ';$('trade-count').textContent=`${fills.length} 笔 · 截至网页已发布版本`;
 $('day-live-status').textContent=`报价截至 ${q.date} ${q.time}；成交截至 ${executionSnapshot?.publishedAt??'待发布'}。非真实交易。`;
 $('intraday').setAttribute('aria-label','当日分时与已发布模拟成交');
 htmlIfChanged('trade-columns','<tr><th>成交时间</th><th>方向</th><th>模拟成交价</th><th>数量（股）</th><th colspan="5">状态</th></tr>');
 htmlIfChanged('trades',fills.map(e=>`<tr><td>${e.fill_time.slice(11,19)}</td><td>${e.side==='buy'?'模拟买入':'模拟卖出'}</td><td>¥ ${fmt(e.price)}</td><td>${fmt(e.quantity,0)}</td><td colspan="5">${fillResultText(e)} · 非真实交易${explanationDetails(e)}</td></tr>`).join('')||'<tr><td colspan="9">截至已发布版本无当日已核验模拟成交。</td></tr>');
 htmlIfChanged('day-summary',`<span>最新价<b>¥ ${fmt(q.price)}</b></span><span>模拟成交<b>${fills.length} 笔</b></span><span>账户来源<b>桌面连续账户</b></span>`);
 }
 $('daily-trade-date').textContent=q.date+' · 已发布模拟成交';htmlIfChanged('daily-trades',executionFills(snapshotForDate(q.date),q.date).map(e=>`<tr><td>${e.fill_time.slice(11,19)}</td><td>${e.side==='buy'?'模拟买入':'模拟卖出'}</td><td>¥ ${fmt(e.price)}</td><td>${fmt(e.quantity,0)}</td><td>${e.positionResult?.beforeWeightPct?.toFixed(2)??"—"}%</td><td>${e.positionResult?.afterWeightPct?.toFixed(2)??"—"}%${explanationDetails(e)}</td></tr>`).join('')||'<tr><td colspan="6">截至已发布资料，无当日已核验模拟成交。</td></tr>');
}
async function refreshExecutionSnapshot(){
 try{const r=await fetch(`./execution-snapshot.json?v=${Math.floor(Date.now()/60000)}`,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('摘要未发布');const v=await r.json();executionSnapshot=v;
 $('execution-snapshot-status').textContent=`${v.date} · ${v.message} · 资料时间 ${new Date(v.publishedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（非当前运行保证）`;
 $('execution-snapshot-fills').style.whiteSpace='pre-line';
 $('execution-snapshot-fills').textContent=(v.fills??[]).map(x=>`${x.fill_time.slice(11,19)} · ${fillResultText(x)} · 模拟价 ¥ ${fmt(x.price)}\n${explanationText(x)}`).join('\n\n')||'截至资料时间，无已核验模拟成交记录。';
 if(liveMarket&&data&&results.L)renderLive(liveMarket,liveCached);
 }catch(e){$('execution-snapshot-status').textContent='模拟账户发布摘要暂不可读；请以 App 实际状态为准。';}
}
void refreshExecutionSnapshot();setInterval(refreshExecutionSnapshot,60000);
let opportunityContext=null,replayContexts={};
let opportunityContextRequestedAt=0,opportunityContextLoading=false;
async function refreshSessionArchive(){
 try{
  const response=await fetch('./session-archive.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return;const next=await response.json();
  if(next.schemaVersion!==1||!next.sessions||JSON.stringify(next)===JSON.stringify(sessionArchive))return;
  sessionArchive=next;
  if(results[active]){renderPerformance();renderPrice();$('day').max=availableReplayDates().at(-1);if(archiveDay)renderDay();}
 }catch{}
}
async function refreshOpportunityContext(){
 const now=Date.now();
 if(opportunityContextLoading||now-opportunityContextRequestedAt<60000)return;
 opportunityContextLoading=true;opportunityContextRequestedAt=now;
 if(data)void refreshSessionArchive();
 try{
  const response=await fetch(`./opportunity-context.json?v=${Math.floor(now/60000)}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return;
  const next=await response.json();
  if(JSON.stringify(next)!==JSON.stringify(opportunityContext)){
   opportunityContext=next;
   if(liveMarket)renderLive(liveMarket,liveCached);
  }
 }catch{}finally{opportunityContextLoading=false;}
}
function initPositionStart(){
 const date=$('position-start-date'),weight=$('position-start-weight'),holding=$('position-start-holding');
 date.min=data.dates[0];date.value=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 function controls(){const custom=weight.value==='custom';$('position-custom-weight').disabled=!custom;$('position-custom-label').hidden=!custom;$('position-custom-weight').required=custom;$('position-holding-label').hidden=weight.value==='0';}
 weight.onchange=controls;controls();
 try{const saved=JSON.parse(localStorage.getItem(positionStorageKey));if(saved?.settings&&saved.createdAt&&(saved.pending||(Number.isInteger(saved.account?.shares)&&Number.isFinite(saved.account?.cash)))){positionSelection=saved;date.value=saved.settings.date;weight.value=['0','0.5','1'].includes(String(saved.settings.weight))?String(saved.settings.weight):'custom';$('position-custom-weight').value=saved.settings.weight*100;holding.value=saved.settings.holding;controls();}}catch{}
 $('position-start-form').onsubmit=event=>{
  event.preventDefault();if(!event.currentTarget.reportValidity())return;
  try{const next=createPositionStart(data,financeGates,{date:date.value,weight:weight.value==='custom'?Number($('position-custom-weight').value)/100:Number(weight.value),holding:holding.value},liveMarket?.quote,{cached:liveCached});positionSelection=next;try{localStorage.setItem(positionStorageKey,JSON.stringify(next));}catch{}renderPosition();}
  catch(error){$('position-selection').textContent=error.message;}
 };
 $('position-reset').onclick=()=>{positionSelection=null;try{localStorage.removeItem(positionStorageKey);}catch{}renderPosition();};
}
async function init(){try{
 const response=await fetch('./data.json',{cache:'no-store'});if(!response.ok)throw Error(`行情文件加载失败 (${response.status})`);data=await response.json();
 try{const a=await fetch('./session-archive.json',{cache:'no-store'});if(a.ok)sessionArchive=await a.json();}catch{}
 try{const c=await fetch('./live-context.json',{cache:'no-store'});if(c.ok)liveContext=await c.json();}catch{}
 await refreshOpportunityContext();
 try{const c=await fetch('./replay-context.json');if(c.ok)replayContexts=(await c.json()).contexts;}catch{}
 const gateResponse=await fetch('./finance-gates.json',{cache:'no-store'});if(!gateResponse.ok)throw Error('融资条件数据加载失败');financeGates=await gateResponse.json();
 for(const id of ['performance','price','intraday'])charts[id]=echarts.init($(id),null,{renderer:'canvas'});
 charts.price.on('click',p=>{if(p.componentType!=='series')return;const date=p.seriesType==='candlestick'?p.name:p.value[0];if(availableReplayDates().includes(date)){selectReplayDate(date);$('day-summary').scrollIntoView({behavior:'smooth',block:'start'});}});
 charts.price.on('datazoom',()=>{const o=charts.price.getOption().dataZoom[0];zoom=[o.start,o.end];});
 for(const id of ['start','end']){$(id).min=data.dates[0];$(id).max=data.dates.at(-1);}
 $('start').value=data.dates[0];$('end').value=data.dates.at(-1);$('run').disabled=false;$('run').textContent='重新回测 ↗';
 day=data.dates.length-1;renderStrategyHelp();run();initPositionStart();
 const latestArchive=evidenceSessions(data,sessionArchive,null).at(-1)?.[0];if(latestArchive){archiveDay=latestArchive;$('day').max=latestArchive;renderDay();$('today-replay').hidden=false;$('today-replay').textContent='最新行情 · '+latestArchive;}
 positionFeed=startPositionFeed({onUpdate:(snapshot,error)=>{if(snapshot)positionSnapshot=snapshot;positionFeedError=error;renderPosition();}});
 liveController=startLive({onUpdate:renderLive,onStatus:text=>$('live-status').textContent=text});
 $('refresh-live').onclick=()=>{liveController.refresh();positionFeed.refresh();};
 $('show-live').onchange=()=>renderPrice();
 $('show-h-mode').onchange=()=>renderPrice();
 window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
 }catch(e){showError('看板未能载入：'+e.message+'。请刷新页面重试。');$('run').textContent='载入失败';$('range-note').textContent='行情数据尚未就绪';}}
startBriefings();
init();

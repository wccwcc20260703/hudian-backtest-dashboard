import {backtest,barTime} from './engine.js';
import {candleValues} from './market.js';
import {startLive} from './live.js';
import {financeBacktest} from './finance-engine.js';
import {tradePosition} from './positions.js';
import {liveSignal} from './live-signals.js';
import {baseHelp,gateHelp} from './strategy-help.js';
const $=id=>document.getElementById(id), names={D:'D · 反转 + 业绩门槛',H:'H · 三状态自适应',B:'全仓持有基准',L:'L · 条件融资'},colors={D:'#078685',H:'#9070cc',B:'#9da9ba',L:'#cf933d'},modeNames=['防御空仓','反转交易','趋势参与'];
const fmt=(v,n=2)=>Number(v).toLocaleString('zh-CN',{minimumFractionDigits:n,maximumFractionDigits:n}),pct=v=>(v>0?'+':'')+fmt(v*100)+'%',money=v=>fmt(v,2),pctAxis=v=>fmt(v,0)+'%';
let data,financeGates,results={},active='L',view='equity',start=0,end=727,day=0,zoom=[0,100];
let liveMarket=null,liveController=null,liveContext=null,liveResults={},liveCached=false;
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
 results.L=financeBacktest(data,financeGates,a,z,{...options,base:$('finance-base').value,gate:$('finance-gate').value,level:Number($('finance-level').value),rate:Number($('finance-rate').value)/100,credit:$('finance-credit-mode').value==='equity50'?null:Number($('finance-credit').value)});
 day=Math.max(start,Math.min(day,end-1));zoom=[0,100];$('finance-pending').hidden=true;
 $('range-note').textContent=`已回测 ${data.dates[start]} → ${data.dates[end-1]} · ${end-start} 个交易日`;
 $('day').min=data.dates[start];$('day').max=data.dates[end-1];
 renderMetrics();renderPerformance();renderPrice();renderDay();
 // Live hints always inherit the full historical model account, independent of range selection.
 for(const k of ['D','H','B'])liveResults[k]=start===0&&end===data.dates.length?results[k]:backtest(data,k,0,data.dates.length,options);
 liveResults.L=start===0&&end===data.dates.length?results.L:financeBacktest(data,financeGates,0,data.dates.length,{...options,...results.L.config});
 if(liveMarket)renderLive(liveMarket,liveCached);
}
function renderMetrics(){
 const r=results[active],b=results.B,m=r.metrics,rel=m.return_-b.metrics.return_;
 $('metrics').innerHTML=[['区间累计收益',pct(m.return_),`期末权益 ¥ ${fmt(r.nav.at(-1),0)}`,m.return_>=0?'positive':'negative'],['相对持有基准',(rel>0?'+':'')+fmt(rel*100)+' pp','收益率差 · 百分点',rel>=0?'positive':'negative'],['最大回撤 · 5 分钟',fmt(m.mdd5*100)+'%',`日线收盘回撤 ${fmt(m.mdd*100)}%`,''],['平均持仓比例',fmt(m.exposure*100)+'%',`${m.orders} 笔成交 · 费用 ¥ ${fmt(m.fees,0)}${active==='L'?' · 利息 ¥ '+fmt(m.interest,0):''}`,'']].map(([l,v,d,c])=>`<div class="metric"><div class="label">${l}</div><div class="value ${c}">${v}</div><div class="detail">${d}</div></div>`).join('');
 $('finance-stats').textContent=`已计算 ${results.L.config.base} / ${fmt(results.L.config.level*100,0)}% / 年息 ${fmt(results.L.config.rate*100,1)}% / ${results.L.config.creditMode==='equity50'?'融资上限为当前净资产的 50%':'固定额度 ¥ '+fmt(results.L.config.credit,0)}：利息 ¥ ${fmt(results.L.metrics.interest,0)} · 最低维持担保比例 ${results.L.metrics.min_maintenance?fmt(results.L.metrics.min_maintenance*100,1)+'%':'无借款'} · 实际仓位峰值 ${fmt(results.L.metrics.max_exposure*100,1)}% · 使用融资 ${results.L.metrics.borrow_days} 天 · 期末欠款 ¥ ${fmt(results.L.metrics.ending_debt,0)}`;
 $('comparison-body').innerHTML=['D','H','L','B'].map(k=>{const m=results[k].metrics;return `<tr class="${k===active?'selected-row':''}"><td><span class="strategy-dot" style="background:${colors[k]}"></span>${names[k]}</td><td class="${m.return_>=0?'positive':'negative'}">${pct(m.return_)}</td><td>${k==='B'?'—':fmt((m.return_-b.metrics.return_)*100)+' pp'}</td><td>${fmt(m.mdd5*100)}%</td><td>${fmt(m.exposure*100,1)}%</td><td>${m.orders}</td><td>¥ ${fmt(m.fees,0)}${k==='L'?'<br><small>融资利息 ¥ '+fmt(m.interest,0)+'</small>':''}</td></tr>`}).join('');
}
function renderPerformance(){
 const dd=view==='drawdown',dates=dd?['区间起点',...data.dates.slice(start,end).flatMap(d=>Array.from({length:48},(_,j)=>d+' '+(j===47?'15:00':barTime(j+1===24?24:j+1))))]:['区间起点',...data.dates.slice(start,end)];
 // The final morning bar is marked 11:30, not 13:00.
 if(dd)for(let d=0;d<end-start;d++)dates[1+d*48+23]=data.dates[start+d]+' 11:30';
 charts.performance.setOption({animation:false,grid:{left:68,right:35,top:48,bottom:45},legend:{top:12,right:25,icon:'roundRect',itemWidth:16,itemHeight:3,textStyle:{fontSize:11,color:'#718199'}},tooltip:{...tooltip,valueFormatter:v=>fmt(v)+'%'},xAxis:{...axis,type:'category',data:dates,boundaryGap:false,axisLabel:{...axis.axisLabel,formatter:v=>v.slice(0,10),hideOverlap:true}},yAxis:{...axis,type:'value',axisLabel:{...axis.axisLabel,formatter:pctAxis}},series:['D','H','L','B'].map(k=>({name:names[k],type:'line',showSymbol:false,sampling:dd?'min':'lttb',lineStyle:{width:k===active?2.5:1.7,type:k==='B'?'dashed':'solid'},itemStyle:{color:colors[k]},data:dd?[0,...results[k].drawdown]:[0,...results[k].nav.map(v=>(v/results[k].capital-1)*100)]}))},true);
}
function positionText(t){const p=tradePosition(data,t);return `${fmt(p.before*100,2)}% → ${fmt(p.after*100,2)}%`;}
function fillDetail(t){return `${barTime(t[1])} ${t[2]>0?'买入':'卖出'} ${fmt(t[3],0)} 股 @ ¥ ${fmt(t[4])}<br>实际仓位 ${positionText(t)}`;}
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
 charts.price.setOption({animation:false,grid:{left:68,right:35,top:28,bottom:62},tooltip:{...tooltip,formatter:candleTooltip},xAxis:{...axis,type:'category',data:ds,axisPointer:{type:'shadow'},axisLabel:{...axis.axisLabel,hideOverlap:true}},yAxis:{...axis,scale:true,name:'元',nameTextStyle:{color:'#9ca7b5'},axisLabel:{...axis.axisLabel,formatter:v=>fmt(v,1)}},dataZoom:[{type:'inside',start:zoom[0],end:zoom[1]},{type:'slider',start:zoom[0],end:zoom[1],bottom:13,height:22,borderColor:'#edf1f6',fillerColor:'#13898812',handleStyle:{color:'#799aab'},textStyle:{color:'#8b9bad',fontSize:10}}],series:[{name:'日线',type:'candlestick',data:candles,itemStyle:{color:'#df6570',color0:'#4a9a8c',borderColor:'#df6570',borderColor0:'#4a9a8c'},markArea:{silent:true,data:stateAreas()},markPoint:includeLive?{symbol:'pin',symbolSize:36,itemStyle:{color:'#d89b48'},label:{formatter:'盘中',fontSize:10},data:[{coord:[quote.date,quote.high]}]}:undefined},tradeScatter(r.trades,1),tradeScatter(r.trades,-1)]},true);
}
function renderDay(){
 const r=results[active],ds=data.dates[day],local=day-start,trades=r.trades.filter(t=>t[0]===day),close=r.daily[local];
 $('day').value=ds;$('day-title').textContent=ds;$('prev').disabled=day===start;$('next').disabled=day===end-1;
 $('next-trade').disabled=!r.trades.some(t=>t[0]>day);
 const signal=active==='B'?null:(active==='L'?r.targets[local]:data.signals[active][day]);
 $('day-summary').innerHTML=`<span>H 事前状态<b>${modeNames[data.state[day]]}</b></span><span>前日 RSI(2)<b>${fmt(data.rsi[day],1)}</b></span><span>已披露利润同比<b>${data.growth[day]===null?'缺失':pct(data.growth[day])}</b></span><span>选中策略目标<b>${signal?fmt(signal[1]*100,0)+'% · '+barTime(signal[0]):'首次建仓后持有'}</b></span><span>收盘仓位<b>${fmt(r.exposure[local]*100,1)}%</b></span><span>收盘权益<b>¥ ${fmt(r.nav[local],0)}</b></span>${active==='L'?'<span>收盘融资欠款<b>¥ '+fmt(r.debt[local],0)+'</b></span><span>当天计提利息<b>¥ '+fmt(r.dailyInterest[local])+'</b></span>':''}`;
 charts.intraday.setOption({animation:false,grid:{left:68,right:35,top:28,bottom:38},tooltip:{...tooltip,formatter:candleTooltip},xAxis:{...axis,type:'category',data:Array.from({length:48},(_,j)=>barTime(j)),axisLabel:{...axis.axisLabel,interval:5}},yAxis:{...axis,scale:true,name:'元',nameTextStyle:{color:'#9ca7b5'},axisLabel:{...axis.axisLabel,formatter:v=>fmt(v)}},series:[{name:'5 分钟',type:'candlestick',data:data.bars[day].map(v=>[v[0],v[3],v[2],v[1]]),itemStyle:{color:'#df6570',color0:'#4a9a8c',borderColor:'#df6570',borderColor0:'#4a9a8c'},markLine:{silent:true,symbol:'none',lineStyle:{color:'#b3bdc9',type:'dashed',width:1},label:{show:false},data:[{yAxis:data.reference[day]}]}},tradeScatter(trades,1,true),tradeScatter(trades,-1,true)]},true);
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
for(const id of ['finance-base','finance-gate','finance-level','finance-rate','finance-credit','finance-credit-mode'])$(id).addEventListener('change',renderStrategyHelp);
$('restore-default').onclick=()=>{
 $('finance-base').value='D';$('finance-gate').value='trend';$('finance-level').value='1.5';
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
$('prev').onclick=()=>{if(day>start){day--;renderDay();}};$('next').onclick=()=>{if(day<end-1){day++;renderDay();}};
$('next-trade').onclick=()=>{const next=results[active].trades.find(t=>t[0]>day);if(next){day=next[0];renderDay();}};
$('day').onchange=()=>{const i=indexAt($('day').value);if(i>=start&&i<end){day=i;renderDay();}else $('day').value=data.dates[day];};
$('apply-zoom').onclick=()=>{const ds=charts.price.getOption().xAxis[0].data,n=ds.length-1,visible=ds.slice(Math.ceil(n*zoom[0]/100),Math.floor(n*zoom[1]/100)+1).filter(d=>d<=data.dates.at(-1));if(!visible.length){showError('当前只包含盘中行情，尚不能用于完整交易日回测。');return;}$('start').value=visible[0];$('end').value=visible.at(-1);run();};
$('export').onclick=()=>{const r=results[active],rows=[['日期','时间','方向','数量','成交价','交易费用','成交后净现金（负数为欠款）','成交后持股','当日可卖','目标仓位','成交前持股','成交前仓位百分比','成交后仓位百分比','仓位估值价格'],...r.trades.map(t=>[data.dates[t[0]],barTime(t[1]),t[2]>0?'买入':'卖出',t[3],t[4],t[5].toFixed(4),t[6].toFixed(4),t[7],t[8],t[10],t[12],(tradePosition(data,t).before*100).toFixed(6),(tradePosition(data,t).after*100).toFixed(6),tradePosition(data,t).mark])];const blob=new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`沪电股份_${active}_${data.dates[start]}_${data.dates[end-1]}_成交.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function renderLive(market,cached){
 liveMarket=market;liveCached=cached;const q=market.quote,minute=market.minutes,change=q.price/q.previous-1;
 $('live-date').textContent=q.date;
 $('live-values').innerHTML=[['最新价',`¥ ${fmt(q.price)}`,change>=0?'buy':'sell'],['涨跌幅',pct(change),change>=0?'buy':'sell'],['今日开盘',`¥ ${fmt(q.open)}`,''],['最高 / 最低',`${fmt(q.high)} / ${fmt(q.low)}`,''],['昨日收盘',`¥ ${fmt(q.previous)}`,'']].map(([label,value,color])=>`<div><span>${label}</span><b class="${color}">${value}</b></div>`).join('');
 $('quote-time').textContent=`${cached?'缓存快照 · ':''}腾讯源时间 ${q.date} ${q.time}（北京时间）${minute?.points.length?' · 分时截至 '+minute.points.at(-1).time:''}`;
 $('live-source-date').textContent=`历史回测截至 ${data.dates.at(-1)} · 最新报价 ${q.date}`;
 if(!charts.live)charts.live=echarts.init($('live-chart'));
 const points=minute?.points??[];
 const times=[...Array.from({length:121},(_,i)=>{const m=570+i;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}),...Array.from({length:121},(_,i)=>{const m=780+i;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');})];
 const prices=new Map(points.map(p=>[p.time,p.price]));
 const liveResult=liveResults[active],base=active==='L'?results.L.config.base:active;
 const state=liveSignal({context:liveContext,market,model:active,config:results.L.config,
 previousTarget:data.signals[base]?.at(-1)?.[1]??1,portfolio:liveResult.daily.at(-1)});
 $('live-signal-title').textContent=`${names[active]} · 计划调仓提示${cached?'（缓存行情）':''}`;
 $('live-signal-status').textContent=state.message;
 $('live-signal-context').textContent=`指标截至 ${liveContext?.asOf??'未载入'}，仅适用于 ${liveContext?.date??'待更新'}；模型账户承接 ${data.dates[0]} 起的完整历史模拟持仓，使用当前本金、滑点与已计算融资设置。按当前设置重算，不是当时推送的记录。`;
 $('live-signals').innerHTML=state.signals.map(v=>`<div class="signal-card"><strong class="${v.side>0?'buy':v.side<0?'sell':''}">${v.time} · ${v.side>0?'▲ 买入 / 加仓提示':v.side<0?'▼ 卖出 / 减仓提示':'仓位检查'}</strong><span>参考价 ¥ ${fmt(v.price)}（非成交价）</span><span>模型起始仓位 ${fmt(v.before*100)}% → 目标 ${fmt(v.target*100,0)}%</span><span>${active==='L'?(v.gate?'融资条件已触发':v.gateMissing?'融资条件缺数据':'融资条件未触发'):'现金策略'} · 成交后仓位：尚无成交记录</span></div>`).join('');
 const signalSeries=state.signals.map(v=>({name:'计划调仓提示',type:'scatter',symbol:v.side===0?'diamond':'triangle',symbolRotate:v.side<0?180:0,symbolSize:18,z:10,itemStyle:{color:v.side>0?'#e25562':v.side<0?'#168d75':'#cf933d'},label:{show:true,position:v.side<0?'bottom':'top',formatter:`${v.side>0?'加仓':v.side<0?'减仓':'目标'} → ${fmt(v.target*100,0)}%`},data:[[v.time,v.price]],tooltip:{trigger:'item',formatter:`${v.time} 策略提示<br>参考价 ¥ ${fmt(v.price)}<br>模型仓位 ${fmt(v.before*100)}% → 目标 ${fmt(v.target*100,0)}%<br>尚未模拟成交`}}));
 charts.live.setOption({animation:false,grid:{left:68,right:35,top:20,bottom:30},tooltip:{...tooltip,valueFormatter:v=>v==null?'未发生':`¥ ${fmt(v)}`},xAxis:{...axis,type:'category',data:times,boundaryGap:false,axisLabel:{...axis.axisLabel,interval:(i,v)=>v.endsWith(':00')||v.endsWith(':30')}},yAxis:{...axis,scale:true,axisLabel:{...axis.axisLabel,formatter:v=>fmt(v)}},series:[{name:'分钟最新价',type:'line',showSymbol:false,connectNulls:false,itemStyle:{color:'#147f9d'},lineStyle:{width:1.7},areaStyle:{color:'#1a92b310'},data:times.map(t=>prices.get(t)??null),markLine:{silent:true,symbol:'none',label:{formatter:'昨收',position:'insideEndTop'},lineStyle:{type:'dashed',color:'#acb7c5',width:1},data:[{yAxis:q.previous}]}},...signalSeries]},true);
 $('live-empty').hidden=points.length>0;
 renderPrice();
}
async function init(){try{
 const response=await fetch('./data.json');if(!response.ok)throw Error(`行情文件加载失败 (${response.status})`);data=await response.json();
 try{const c=await fetch('./live-context.json');if(c.ok)liveContext=await c.json();}catch{}
 const gateResponse=await fetch('./finance-gates.json');if(!gateResponse.ok)throw Error('融资条件数据加载失败');financeGates=await gateResponse.json();
 for(const id of ['performance','price','intraday'])charts[id]=echarts.init($(id),null,{renderer:'canvas'});
 charts.price.on('click',p=>{if(p.componentType!=='series')return;const date=p.seriesType==='candlestick'?p.name:p.value[0];const i=data.dates.indexOf(date);if(i>=start&&i<end){day=i;renderDay();}else if(date===liveMarket?.quote.date){$('live-panel').scrollIntoView({behavior:'smooth',block:'start'});}});
 charts.price.on('datazoom',()=>{const o=charts.price.getOption().dataZoom[0];zoom=[o.start,o.end];});
 for(const id of ['start','end']){$(id).min=data.dates[0];$(id).max=data.dates.at(-1);}
 $('start').value=data.dates[0];$('end').value=data.dates.at(-1);$('run').disabled=false;$('run').textContent='重新回测 ↗';
 day=data.dates.length-1;renderStrategyHelp();run();
 liveController=startLive({onUpdate:renderLive,onStatus:text=>$('live-status').textContent=text});
 $('refresh-live').onclick=()=>liveController.refresh();
 $('show-live').onchange=()=>renderPrice();
 window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
 }catch(e){showError('看板未能载入：'+e.message+'。请刷新页面重试。');$('run').textContent='载入失败';$('range-note').textContent='行情数据尚未就绪';}}
init();

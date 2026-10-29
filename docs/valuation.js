// Display-only valuation. Never imported by the account or order engine.
export function valuationAt(dataset,date,price){
 if(!Number.isFinite(price)||price<=0||!/^\d{4}-\d{2}-\d{2}$/.test(date??''))return null;
 const report=dataset.reports.filter(r=>r.noticeDate<=date&&r.period<=date).sort((a,b)=>a.period.localeCompare(b.period)).at(-1);
 const capital=dataset.capital.filter(r=>r.noticeDate<=date&&r.effectiveDate<=date).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||a.noticeDate.localeCompare(b.noticeDate)).at(-1);
 if(!report||!capital||!Number.isFinite(report.annualProfit)||report.annualProfit<=0||!(capital.shares>0))return null;
 return {pe:price*capital.shares/report.annualProfit,report,capital};
}
export function startValuation(){
 const el=document.getElementById('valuation-chart');if(!el)return {quote(){}};
 const status=document.getElementById('valuation-status'),value=document.getElementById('valuation-value'),basis=document.getElementById('valuation-basis');
 let dataset,chart,lastQuote=null,range='all',lastKey='',loading=false;
 const n=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
 const time=v=>new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
 function render(force=false){
  if(!dataset)return;
  const rows=dataset.points.map(p=>({date:p[0],price:p[1],pe:p[2],report:dataset.reports[p[3]],capital:dataset.capital[p[4]],live:false}));
  const last=rows.at(-1),q=lastQuote?.quote;
  const live=q&&q.date>=last.date?valuationAt(dataset,q.date,q.price):null;
  if(live){const row={date:q.date,price:q.price,...live,live:true};if(q.date===last.date)rows[rows.length-1]=row;else rows.push(row);}
  const latest=rows.at(-1),key=dataset.updatedAt+'|'+range+'|'+latest.date+'|'+latest.price+'|'+(q?.time??'')+'|'+!!lastQuote?.cached;
  if(!force&&key===lastKey)return;lastKey=key;
  value.textContent=n(latest.pe)+' 倍';
  document.getElementById('valuation-price').textContent='¥ '+n(latest.price);
  document.getElementById('valuation-report').textContent=latest.report?.period??'缺失';
  document.getElementById('valuation-profit').textContent=latest.report?n(latest.report.annualProfit/1e8)+' 亿元':'—';
  status.textContent=`日线截至 ${dataset.asOf} · 财务/股本最近核验 ${time(dataset.updatedAt)}${live?` · ${lastQuote.cached?'缓存报价':'报价'} ${q.date} ${q.time}（北京时间）`:' · 当前显示已保存收盘估值'}`;
  if(q&&q.date>dataset.checkedSession.slice(0,10))status.textContent+=' · 今日财务更新待核验，暂沿用最近已知口径';
  basis.textContent=latest.report&&latest.capital?`采用 ${latest.report.noticeDate} 公告的 ${latest.report.period} 财报；累计归母净利润 ${n(latest.report.parentProfit/1e8)} 亿元，年化 ×${n(4/latest.report.quarter,4)}。总股本 ${n(latest.capital.shares/1e8,4)} 亿股（生效 ${latest.capital.effectiveDate}，披露 ${latest.capital.noticeDate}），股本变化尚未披露时沿用旧值。`: '估值依据不完整，暂不计算。';
  const cutoff=range==='all'?'2020-01-01':`${Number(latest.date.slice(0,4))-Number(range)}${latest.date.slice(4)}`;
  const visible=rows.filter(r=>r.date>=cutoff);
  if(!chart)chart=echarts.init(el);
  chart.setOption({animation:false,color:['#3c70d4'],grid:{left:65,right:30,top:35,bottom:85},tooltip:{trigger:'axis',renderMode:'richText',formatter:params=>{const r=visible[params[0].dataIndex];return `${r.date}${r.live?' · 最新报价估算':' · 收盘估算'}\n动态 PE：${n(r.pe)} 倍\n未复权价格：¥ ${n(r.price)}\n财报期：${r.report?.period??'缺失'}\n公告日：${r.report?.noticeDate??'缺失'}\n年化归母净利润：${r.report?n(r.report.annualProfit/1e8):'—'} 亿元`; }},xAxis:{type:'category',data:visible.map(r=>r.date),boundaryGap:false,axisLabel:{color:'#7c8ca2'},axisLine:{lineStyle:{color:'#dfe7f1'}}},yAxis:{type:'value',name:'动态 PE（倍）',min:0,axisLabel:{color:'#7c8ca2'},splitLine:{lineStyle:{color:'#eaf0f7'}}},dataZoom:[{type:'inside'},{type:'slider',bottom:10,height:24}],series:[{name:'动态 PE（财报年化估算）',type:'line',data:visible.map(r=>r.pe),showSymbol:false,connectNulls:false,lineStyle:{width:2},areaStyle:{opacity:0.05}}]}, {replaceMerge:['series','xAxis']});
 }
 async function load(){
  if(loading)return;loading=true;
  try{const r=await fetch('./valuation-history.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const d=await r.json();if(d.symbol!=='002463'||d.schemaVersion!==1||!d.points?.length)throw Error();dataset=d;render(true);}catch{status.textContent=dataset?'估值更新暂不可用；保留上次有效数据。':'估值数据暂不可用，请稍后刷新。';}finally{loading=false;}
 }
 document.getElementById('valuation-range').onchange=e=>{range=e.target.value;render(true);chart?.dispatchAction({type:'dataZoom',start:0,end:100});};
 document.getElementById('valuation-download').onclick=()=>{if(!chart)return;const a=document.createElement('a');a.download='沪电股份-动态PE-'+dataset.asOf+'.png';a.href=chart.getDataURL({type:'png',pixelRatio:2,backgroundColor:'#fff'});a.click();};
 window.addEventListener('resize',()=>chart?.resize());
 setInterval(()=>{if(!document.hidden)void load();},300000);void load();
 return {quote(quote,cached){lastQuote={quote,cached};render();}};
}

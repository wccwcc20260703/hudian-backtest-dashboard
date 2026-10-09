export function briefingState(report,now=new Date()){
 if(!report)return {label:'尚未发布',message:'等待定时整理。'};
 if(report.status==='pending')return now>new Date(report.deadline)?{label:'已过计划时间 · 待补发',message:'本期尚未发布，暂无可执行计划。'}:{label:'待发布',message:report.summary};
 if(now>new Date(report.validUntil))return {label:'历史记录 · 等待更新',message:'本报告已过适用时间，仅供回看，不作为当前交易提示。'};
 return {label:report.status==='partial'?'已发布 · 数据待补齐':'已发布',message:report.summary};
}
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function render(kind,r){const root=document.getElementById(kind+'-briefing');if(!root)return;const state=briefingState(r),body=root.querySelector('[data-field="body"]');root.querySelector('[data-field="status"]').textContent=state.label;body.replaceChildren();if(!r){body.append(node('p',state.message));return;}
 body.append(node('p',`${r.tradeDate} · ${r.title}`),node('p',state.message));
 if(r.facts?.length){const facts=node('div','','briefing-facts');for(const f of r.facts){const item=node('span',f.label,'briefing-fact');item.append(node('strong',f.value));facts.append(item);}body.append(facts);}
 for(const item of r.items||[]){const p=node('p','','briefing-item');p.append(node('strong',item.label),document.createTextNode(item.text));body.append(p);}
 body.append(node('p',`生成：${r.generatedAt?new Date(r.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'尚未生成'} · 数据截至：${r.asOf} · 北京时间`,'briefing-time'));
 if(r.late)body.append(node('p','首次建立／补发时间晚于本期截止时间；未计作按时发布。','briefing-time'));
 if(r.archive){const a=node('a','查看完整报告与来源 ↗','briefing-link');a.href=r.archive;body.append(a);}
}
export function startBriefings(){let last='',reports=null;async function refresh(){try{const response=await fetch('./daily-briefings.json?t='+Math.floor(Date.now()/60000),{cache:'no-store'});if(!response.ok)throw Error('briefings unavailable');reports=await response.json();const signature=JSON.stringify([reports,briefingState(reports.pre),briefingState(reports.post)]);if(signature!==last){render('post',reports.post);render('pre',reports.pre);last=signature;}}catch{if(!reports){render('post',null);render('pre',null);}else{render('post',reports.post);render('pre',reports.pre);}}}
 refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});}

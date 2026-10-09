// Evidence tiers, not calibrated probabilities. No score can unlock all-in/leverage.
export function strengthAt(signal,points){
 const last=points.at(-1),seq=points.slice(-5),continuous=seq.length===5&&seq.slice(1).every((p,i)=>p.sec-seq[i].sec===60000);
 if(signal.side===0)return {level:0,label:'S0 · 观察',budget:'不因触及而新增仓位',evidence:['进入支撑区域'],validated:false};
 if(signal.kind.endsWith('invalidated'))return {level:2,label:'R2 · 原买点失效',budget:'取消原买入观察；检查已有可卖仓位，当日新买股份受T+1约束',evidence:['连续2分钟跌回VWAP下方0.1%'],validated:false};
 const open=Number.isFinite(signal.open)?signal.open:(points[0]?.time==='09:30'?points[0].price:null);
 const up=signal.side>0,tests=[['均价方向',last.vwap>0&&(up?last.price>last.vwap*1.001:last.price<last.vwap*.999)],['相对开盘方向',open>0&&(up?last.price>open:last.price<open)],['持续5分钟',continuous&&seq.every(p=>p.vwap>0&&(up?p.price>p.vwap:p.price<p.vwap))],['月线位置',up?Math.abs(last.price/last.level-1)<=.01&&last.price>=last.level:last.price<last.level*.99]];
 const evidence=tests.filter(x=>x[1]).map(x=>x[0]),level=evidence.length>=3?2:1;
 return {level,label:(up?'S':'R')+level+' · '+(level===2?'中等确认':'弱确认'),budget:up?(level===2?'轻仓研究预算上限20%净资产':'小仓研究预算上限10%净资产'):'风险提示强度，不等于同等比例卖出；仅处理可卖老仓',evidence,validated:false};
}
export const strengthExplanation='S0观察；S1弱确认；S2中等确认；S3强确认暂不开放，须有冻结后独立胜率、收益及回撤证据。10%/20%是未验证的试仓预算示例，不是胜率，不自动叠加或加杠杆，也不计入当前回测；任何级别都不代表可以all in。R表示转弱/失效风险。';

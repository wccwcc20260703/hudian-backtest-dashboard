# -*- coding: utf-8 -*-
from pathlib import Path
import argparse,json,pandas as pd
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,required=True);a=p.parse_args();root=a.workspace;repo=Path(__file__).resolve().parents[1]
def merged(name):
 return pd.concat([pd.read_csv(root/'work/round2/data'/(name+'_early.csv')),pd.read_csv(root/'work/data'/(name+'.csv'))]).sort_values('date').drop_duplicates('date',keep='last').set_index('date')
q=merged('daily_qfq');raw=merged('daily_raw');dates=json.loads((repo/'docs/data.json').read_text())['dates'];out={}
for date in dates:
 prior=q[q.index<date];asof=prior.index[-1]
 # Ratio uses only the prior completed day. On a corporate-action day map that
 # scale to today's ex-right reference using the announced reference price.
 i=dates.index(date);dataref=float(raw.loc[date,'preclose']);priorraw=float(raw.loc[asof,'close']);basis=float(q.loc[asof,'close']/priorraw);scale=dataref/priorraw
 closed=prior[prior.index<date[:7]+'-01'].copy();closed['month']=closed.index.str[:7];months=closed.groupby('month').tail(1).tail(10)
 if len(months)!=10:continue
 rows=[{'date':d,'close':float(v.close/basis*scale)} for d,v in months.iterrows()]
 assert all(v['date']<date[:7]+'-01' for v in rows)
 out[date]={'date':date,'asOf':asof,'completedMonths':rows,'prior9Sum':sum(v['close'] for v in rows[-9:]),'closedMA10':sum(v['close'] for v in rows)/10,'ruleVersion':'observation-5min-v1'}
(repo/'docs/replay-context.json').write_text(json.dumps({'resolutionMinutes':5,'source':'既有BaoStock历史数据；以前一交易日复权比率映射当日除权参考价，月末价格只取已经结束月份','contexts':out},ensure_ascii=False,separators=(',',':')))
print('Historical monthly contexts:',len(out),'/',len(dates))

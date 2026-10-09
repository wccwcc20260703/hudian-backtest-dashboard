# -*- coding: utf-8 -*-
from pathlib import Path
import argparse,json,pandas as pd
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,required=True);p.add_argument('--date',required=True);a=p.parse_args();root=a.workspace;repo=Path(__file__).resolve().parents[1]
def merged(name):
 frames=[pd.read_csv(root/'work/round2/data'/(name+'_early.csv')),pd.read_csv(root/'work/data'/(name+'.csv'))];return pd.concat(frames).sort_values('date').drop_duplicates('date',keep='last').set_index('date')
q=merged('daily_qfq');raw=merged('daily_raw');q=q[q.index<a.date];raw=raw[raw.index<a.date];assert q.index[-1]==raw.index[-1];basis=float(q.close.iloc[-1]/raw.close.iloc[-1]);closed=q[q.index<a.date[:7]+'-01'].copy();closed['month']=closed.index.str[:7];months=closed.groupby('month').tail(1).tail(10);assert len(months)==10
rows=[dict(date=d,close=float(row.close/basis)) for d,row in months.iterrows()];c={'date':a.date,'asOf':q.index[-1],'source':'BaoStock历史前复权月末收盘，换算至上一完整交易日的价格尺度','adjustment':'前复权（保持与历史研究口径一致）；不同供应商复权算法可有小差异','completedMonths':rows,'prior9Sum':sum(x['close'] for x in rows[-9:]),'closedMA10':sum(x['close'] for x in rows)/10,'fixedIntersection':sum(x['close'] for x in rows[-9:])/9,'ruleVersion':'observation-v1','validated':False,'rules':{'touchBand':.005,'breakBand':.01,'confirmMinutes':3,'vwapBand':.001,'cooldownMinutes':30},'note':'触及支撑只作观察；使用截至确认分钟的连续数据，不倒标日内最低价。独立于模型仓位，不纳入默认策略收益。'}
(repo/'docs/opportunity-context.json').write_text(json.dumps(c,ensure_ascii=False,indent=2));print('Monthly support intersection:',c['fixedIntersection'],'completed MA10:',c['closedMA10'])

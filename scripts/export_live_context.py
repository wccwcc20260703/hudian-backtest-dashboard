import sys,json
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Export next-session causal context from existing research data.')
parser.add_argument('--workspace',type=Path,required=True,help='Research workspace containing work/round2 and outputs/leverage')
parser.add_argument('--date',required=True,help='Explicit next trading session, YYYY-MM-DD')
args=parser.parse_args()
ROOT=args.workspace.resolve()
sys.path.insert(0,str(ROOT/'work/round2'))
import engine as e
import numpy as np
import pandas as pd
f=pd.read_csv(e.OUT/'fundamental_point_in_time_map.csv').set_index('date')
g=f.reindex(e.DATES).yoy_netprofit.to_numpy()
r=e.LAG.rsi2.to_numpy()
factor=(e.Q.close/e.D.close).loc[e.DATES].to_numpy()
y=e.B[1:,3,0]*factor[1:]/(e.B[:-1,6,0]*factor[:-1])-1
idx=np.arange(max(0,e.N-127),e.N-1)
low=y[idx][(r[idx]<35)&(g[idx]>0)]
high=y[idx][(r[idx]>60)&(g[idx]>0)]
lo=float(low.mean());hi=float(high.mean())
edge=bool(len(low)>=20 and len(high)>=20 and lo>.002 and lo-hi>.002)
ma=e.Q.close.rolling(120).mean()
trend=bool(e.Q.close.iloc[-1]>e.Q.close.rolling(60).mean().iloc[-1] and ma.iloc[-1]>ma.iloc[-21])
rsi=float(e.F.rsi2.iloc[-1]);growth=float(g[-1])
dweight=0 if growth<=0 else (1 if rsi<35 else (0 if rsi>60 else .5))
hmode=0 if growth<=0 else (1 if edge else (2 if trend else 0))
hweight=dweight if hmode==1 else (1 if hmode==2 else 0)
assert args.date>str(e.DATES[-1]),'Target session must follow historical data'
assert str(e.Q.index[-1])==str(e.DATES[-1]),'Daily and minute history must end on same date'
context=dict(date=args.date,asOf=str(e.DATES[-1]),rsi=rsi,growth=growth,
    trend=trend,mode=hmode,lowMean=lo,highMean=hi,lowCount=len(low),highCount=len(high),
    strongEdge=bool(edge and lo>.004 and lo-hi>.004 and len(low)>=25 and len(high)>=25),
    target=dict(D=dweight,H=hweight),publication=str(f.iloc[-1].get('publication_date','')),
    latestOutcomeStart=str(e.DATES[-2]),source='复用历史研究指标；只使用截至前一完整交易日的行情和已披露业绩。')
repo=Path(__file__).resolve().parents[1]
context['publication']=json.loads((repo/'docs/data.json').read_text())['publication'][-1]
(repo/'docs/live-context.json').write_text(json.dumps(context,ensure_ascii=False,indent=2))
rows=pd.read_csv(ROOT/'outputs/leverage/all_candidates.csv')
cashdd=abs(float(rows.loc[rows.name=='D','mdd5'].iloc[0]))
eligible=rows[(rows.name!='constant_150')&(rows.mdd5.abs()<=cashdd+.01)]
best=eligible.sort_values('return_',ascending=False).iloc[0]
selection=dict(selected=str(best['name']),drawdownBudget=cashdd+.01,
    referenceDrawdown=cashdd,start='2023-10-09',end='2026-10-08',
    capital=1000000,slip=.0005,rate=.06,creditMode='equity50',
    rule='在 D、H 与 24 个条件融资候选中，筛选五分钟最大回撤绝对值不超过无融资 D + 1 个百分点的方案，再按扣费后累计收益降序。该展示偏好在已知结果后设定，不是样本外验证。',
    candidates=rows[rows.name!='constant_150'][['name','return_','mdd5']].to_dict('records'))
(repo/'docs/default-selection.json').write_text(json.dumps(selection,ensure_ascii=False,indent=2))
print(json.dumps(context,ensure_ascii=False));print('selected',best['name'],best['return_'],best['mdd5'])

"""Export frozen research arrays and independent Python parity fixtures.
Usage: python scripts/export_research.py /path/to/original/work/round2
"""
import sys,json
from pathlib import Path
import numpy as np
import pandas as pd
research=Path(sys.argv[1]).resolve();sys.path.insert(0,str(research))
import engine as e
repo=Path(__file__).resolve().parents[1]
models={'D':'D_reversal_growth','H':'H_adaptive_edge'}
signals={k:np.load(research/(v+'_signals.npy')) for k,v in models.items()}
sparse={k:[[int(np.flatnonzero(row>=0)[0]),float(row[row>=0][0])] for row in s[e.START:]] for k,s in signals.items()}
out=research.parent.parent/'outputs'/'round2'
h=pd.read_csv(out/'H_adaptive_edge_states.csv').set_index('date').loc[e.DATES[e.START:]]
g=pd.read_csv(out/'fundamental_point_in_time_map.csv').set_index('date').loc[e.DATES[e.START:]]
def finite(v):return None if pd.isna(v) else float(v)
data={'version':1,'source':'BaoStock; daily OHLC cross-checked with Tencent','dates':e.DATES[e.START:].tolist(),'bars':e.B[e.START:].tolist(),'daily':e.D.loc[e.DATES[e.START:],['open','high','low','close','volume']].values.tolist(),'close':e.C[e.START:].tolist(),'dividend':e.DIV[e.START:].tolist(),'bonus':e.BONUS[e.START:].tolist(),'reference':e.REF[e.START:].tolist(),'stamp':e.STAMP[e.START:].tolist(),'transfer':e.TRANSFER[e.START:].tolist(),'signals':sparse,'state':h['mode'].astype(int).tolist(),'rsi':e.LAG.rsi2.iloc[e.START:].tolist(),'growth':[finite(v) for v in g.yoy_netprofit],'publication':g.pubDate.tolist(),'lowMean':[finite(v) for v in h.historical_low_mean],'highMean':[finite(v) for v in h.historical_high_mean]}
(repo/'docs'/'data.json').write_text(json.dumps(data,separators=(',',':'),allow_nan=False))
fixtures=[]
for a,z,capital,slip in [(0,len(data['dates']),1e6,.0005),(0,1,1e6,.0005),(139,264,1e6,.0005),(375,727,350000,.001),(177,180,10000,.002)]:
 for model in ['D','H','B']:
  s=signals.get(model,signals['D']);r=e.run(s,e.START+a,e.START+z,capital=capital,slip=slip,hold=model=='B',tax=0 if model=='B' else .2)
  trades=r[3].copy();trades[:,0]-=e.START
  fixtures.append({'model':model,'start':a,'end':z,'capital':capital,'slip':slip,'nav':r[0].tolist(),'exposure':r[1].tolist(),'trades':trades.tolist(),'metrics':e.metrics(r,capital)})
(repo/'tests'/'python-fixtures.json').write_text(json.dumps(fixtures,separators=(',',':'),allow_nan=False))
print('Exported',len(data['dates']),'days;',len(fixtures),'Python reference runs; data bytes',(repo/'docs'/'data.json').stat().st_size)

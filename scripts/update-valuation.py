#!/usr/bin/env python3
"""Public valuation data only. Failure preserves the previously published dataset."""
import argparse,csv,datetime as dt,hashlib,json,math,os,subprocess,sys
from pathlib import Path
from urllib.parse import urlencode
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/valuation-history.json'
CN=ZoneInfo('Asia/Shanghai')
FIN='https://datacenter-web.eastmoney.com/api/data/v1/get?'+urlencode(dict(reportName='RPT_LICO_FN_CPD',columns='ALL',filter='(SECURITY_CODE="002463")',pageSize=100,sortColumns='REPORTDATE',sortTypes=-1))
SHARES='https://datacenter-web.eastmoney.com/api/data/v1/get?'+urlencode(dict(reportName='RPT_F10_EH_EQUITY',columns='ALL',filter='(SECUCODE="002463.SZ")',pageSize=200,sortColumns='END_DATE',sortTypes=-1))
PRICE='https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sz002463,day,,,800,'
def number(v):
 return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def fetch(url):
 r=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','12',url],capture_output=True,text=True,timeout=15)
 if r.returncode:raise ValueError(r.stderr[-200:])
 return json.loads(r.stdout)
def records(j):
 result=j.get('result') or {}; rows=result.get('data',[])
 if not j.get('success') or not rows or result.get('count',len(rows))>len(rows):raise ValueError('财务接口不完整或失败')
 return rows
def normalize(fin,shares):
 reports=[];capital=[]
 for r in records(fin):
  if r['SECURITY_CODE']!='002463':raise ValueError('财报证券不一致')
  day=r['REPORTDATE'][:10];notice=r['NOTICE_DATE'][:10];profit=r['PARENT_NETPROFIT']
  if day<'2018-01-01':continue
  quarter=int(day[5:7])//3
  if quarter not in (1,2,3,4) or not number(profit) or notice<day:raise ValueError('财务字段异常')
  reports.append(dict(period=day,noticeDate=notice,providerUpdatedAt=r['UPDATE_DATE'][:10],parentProfit=profit,annualProfit=profit*4/quarter,quarter=quarter))
 for r in records(shares):
  if r['SECURITY_CODE']!='002463':raise ValueError('股本证券不一致')
  if not number(r['TOTAL_SHARES']) or r['TOTAL_SHARES']<=0:raise ValueError('股本字段异常')
  if not r.get('NOTICE_DATE'):continue
  capital.append(dict(effectiveDate=r['END_DATE'][:10],noticeDate=r['NOTICE_DATE'][:10],shares=r['TOTAL_SHARES']))
 return sorted(reports,key=lambda r:r['period']),sorted(capital,key=lambda r:(r['effectiveDate'],r['noticeDate']))
def indices(day,reports,capital):
 rs=[i for i,r in enumerate(reports) if r['noticeDate']<=day and r['period']<=day]
 cs=[i for i,r in enumerate(capital) if max(r['effectiveDate'],r['noticeDate'])<=day]
 return (rs[-1] if rs else None,cs[-1] if cs else None)
def value(price,report,capital):
 if not number(price) or price<=0 or not report or not capital or report['annualProfit']<=0:return None
 return round(price*capital['shares']/report['annualProfit'],4)
def build(now,fin,shares,daily,prior):
 reports,capital=normalize(fin,shares);prices={}
 with (ROOT/'scripts/data/hudian-prices-2020.csv').open() as f:
  for r in csv.DictReader(f):prices[r['date']]=float(r['close'])
 for r in prior.get('points',[]):prices[r[0]]=r[1]
 stock=daily.get('data',{}).get('sz002463',{});rows=stock.get('day',[])
 if not rows:raise ValueError('缺少不复权日线')
 today=now.date().isoformat()
 for r in rows:
  day=r[0];close=float(r[2]);dt.date.fromisoformat(day)
  if day<'2020-01-01' or day>today or (day==today and now.hour*60+now.minute<15*60+5):continue
  if not math.isfinite(close) or close<=0:raise ValueError('日线价格异常')
  prices[day]=close
 points=[]
 for day,price in sorted(prices.items()):
  if day>today:continue
  ri,ci=indices(day,reports,capital)
  pe=value(price,reports[ri] if ri is not None else None,capital[ci] if ci is not None else None)
  points.append([day,price,pe,ri,ci])
 if not points or points[0][0]>'2020-01-10':raise ValueError('历史起点不完整')
 return dict(schemaVersion=1,symbol='002463',updatedAt=now.isoformat(),checkedSession=today+('PM' if now.hour>=15 else 'AM'),asOf=points[-1][0],formula='未复权股价 × 最新已披露总股本 ÷（最新已披露累计归母净利润 × 4 ÷ 季度数）',reports=reports,capital=capital,points=points,sources=[dict(name='东方财富业绩报表',url=FIN),dict(name='东方财富股本变动',url=SHARES),dict(name='腾讯未复权日线',url=PRICE),dict(name='BaoStock历史未复权日线（2020起，既有数据）',url='https://www.baostock.com/')],limitations=['动态PE为最新财报年化估算，不是TTM或分析师预测PE。','财报按公告日期切换；股本从生效日与公告日的较晚日期使用，期间沿用最近披露值。','财务接口可能更新历史比较数；未逐份审计历史公告版本，曲线不是当年原始估值快照，也不用于策略回测。','归母净利润非正数或依据缺失时留空；财报切换可令PE跳变，不代表股价同幅变化。'])
def main():
 p=argparse.ArgumentParser();p.add_argument('--if-due',action='store_true');p.add_argument('--fixture-dir');p.add_argument('--state-dir');a=p.parse_args();now=dt.datetime.now(CN)
 prior=json.loads(OUT.read_text()) if OUT.exists() else {}
 session=now.date().isoformat()+('PM' if now.hour>=15 else 'AM')
 if a.if_due and 15*60<=now.hour*60+now.minute<15*60+5:print('valuation deferred until15:05');return
 previousCheck=dt.datetime.fromisoformat(prior['updatedAt']).astimezone(CN) if prior.get('updatedAt') else None
 prematurePM=bool(previousCheck and prior.get('checkedSession')==session and now.hour>=15 and previousCheck.hour*60+previousCheck.minute<15*60+5)
 if a.if_due and prior.get('checkedSession')==session and not prematurePM:print('valuation unchanged: already checked '+session);return
 state=Path(a.state_dir) if a.state_dir else None
 if state:
  state.mkdir(parents=True,exist_ok=True);attemptFile=state/(session+'.json')
  attempts=json.loads(attemptFile.read_text()) if attemptFile.exists() else {'attempts':0}
  if attempts['attempts']>=2:raise ValueError('当前半日已失败两次；保留旧估值，停止相同请求')
  attempts.update(attempts=attempts['attempts']+1,startedAt=now.isoformat(),status='started');attemptFile.write_text(json.dumps(attempts))
 if a.fixture_dir:
  base=Path(a.fixture_dir);fin=json.loads((base/'hudian-pe-cpd.json').read_text());shares=json.loads((base/'hudian-pe-shares.json').read_text());daily=json.loads((base/'hudian-pe-daily.json').read_text())
 else:fin,shares,daily=fetch(FIN),fetch(SHARES),fetch(PRICE)
 result=build(now,fin,shares,daily,prior)
 result['sourceHashes']={}
 for name,body in [('financial',fin),('capital',shares),('prices',daily)]:
  raw=json.dumps(body,ensure_ascii=False,separators=(',',':')).encode();result['sourceHashes'][name]=hashlib.sha256(raw).hexdigest()
  if state:(state/(session+'-'+name+'.json')).write_bytes(raw)
 tmp=OUT.with_suffix('.json.tmp');tmp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n');os.replace(tmp,OUT)
 if state:
  attempts.update(status='success',completedAt=dt.datetime.now(CN).isoformat(),asOf=result['asOf']);attemptFile.write_text(json.dumps(attempts))
 print(json.dumps(dict(points=len(result['points']),asOf=result['asOf'],report=result['reports'][-1]['period'],missing=sum(r[2] is None for r in result['points'])),ensure_ascii=False))
if __name__=='__main__':main()

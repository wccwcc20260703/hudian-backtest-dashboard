# -*- coding: utf-8 -*-
"""Retain sourced market-only sessions without admitting them to the backtest."""
from pathlib import Path
import json,datetime,hashlib
repo=Path(__file__).resolve().parents[1];root=repo.parent.parent;target=repo/'docs/session-archive.json'
archive=json.loads(target.read_text()) if target.exists() else {'schemaVersion':1,'sessions':{}}
inputs=[repo/'docs/latest-quote.json',*sorted((root/'outputs/pcb_realtime').glob('live-*/post-*/market.json'))]
accepted=json.loads((repo/'docs/data.json').read_text())['dates'][-1]
for p in inputs:
 d=json.loads(p.read_text());q=d.get('quote',{});date=q.get('date');minutes=d.get('minutes')
 if not date or date<=accepted or not minutes or minutes.get('date')!=date:continue
 assert all(float(q[k])>0 for k in ['open','price','low','high','previous'])
 entry={'market':{'quote':q,'minutes':minutes},'status':'market_only','sourceSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceReceivedAt':d.get('receivedAt'),'archivedAt':datetime.datetime.now().astimezone().isoformat(),'report':'briefings/'+date+'/post.html','reason':'行情留存，尚未接入完整账户回测；没有已核验模拟成交、收益或成交后仓位。'}
 if date=='2026-10-09':entry['reason']+='已取得48根五分钟，但日线与分钟高低口径差异及连续账户衔接待验收。'
 prior=archive['sessions'].get(date)
 if not prior or prior['market']['quote']['time']<=q['time']:archive['sessions'][date]=entry
archive['acceptedThrough']=accepted
archive['updatedAt']=datetime.datetime.now().astimezone().isoformat()
target.write_text(json.dumps(archive,ensure_ascii=False,indent=2)+'\n')
print('Market-only archive:',','.join(sorted(archive['sessions'])))

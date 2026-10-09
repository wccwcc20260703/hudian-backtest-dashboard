# -*- coding: utf-8 -*-
"""Validate and save a supplied, evidence-backed briefing. Does not infer market data or push Git."""
from pathlib import Path
from datetime import datetime
import json,sys,html,os
ROOT=Path(__file__).resolve().parents[1];DOCS=ROOT/'docs'
def save(path,obj):
 tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2));os.replace(tmp,path)
def publish(path):
 r=json.loads(Path(path).read_text());kind=r['kind'];assert kind in ['pre','post'];assert r['status'] in ['pending','partial','complete'];datetime.strptime(r['tradeDate'],'%Y-%m-%d')
 deadline=datetime.fromisoformat(r['deadline']);valid=datetime.fromisoformat(r['validUntil']);assert deadline.tzinfo and valid.tzinfo and valid>deadline
 assert str(deadline.date())==r['tradeDate'];assert deadline.strftime('%H:%M')==('09:00' if kind=='pre' else '15:30')
 if r['status']!='pending':
  generated=datetime.fromisoformat(r['generatedAt']);assert generated.tzinfo;r['late']=generated>deadline
  assert r['sources'] and r['items'] and r['asOf'];assert r['summary']
  if r['status']=='complete':assert r['verifiedThrough']==r['requiredSession'] and r['calendarVerified'] is True
 else:assert r.get('generatedAt') is None
 target=DOCS/'briefings'/r['tradeDate'];target.mkdir(parents=True,exist_ok=True);r['archive']='briefings/'+r['tradeDate']+'/'+kind+'.html'
 save(target/(kind+'.json'),r)
 esc=lambda x:html.escape(str(x));items=''.join('<h2>'+esc(x['label'])+'</h2><p>'+esc(x['text'])+'</p>' for x in r['items']);facts=' · '.join(esc(x['label'])+' '+esc(x['value']) for x in r.get('facts',[]));sources=''.join('<li><a href="'+esc(x['url'])+'">'+esc(x['name'])+'</a> · '+esc(x.get('asOf',''))+'</li>' for x in r.get('sources',[]))
 page='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(r['title'])+'</title><style>body{background:#f4f7fa;color:#1b304a;font:16px/1.9 system-ui}main{max-width:900px;margin:30px auto;padding:30px;background:white;border-radius:16px}h2{font-size:20px;margin-top:28px}a{color:#147d83}.meta{color:#8295a9;font-size:14px}</style><main><a href="../../index.html">← 返回看板</a><h1>'+esc(r['tradeDate']+' '+r['title'])+'</h1><p>'+esc(r['summary'])+'</p><p>'+facts+'</p><p class="meta">生成 '+esc(r.get('generatedAt') or '待生成')+' · 截止 '+esc(r['deadline'])+' · 适用至 '+esc(r['validUntil'])+'</p>'+('<p>本期为晚于截止时间的补发。</p>' if r.get('late') else '')+items+'<h2>来源及缺失</h2><ul>'+sources+'</ul><p>'+esc(r.get('limitations',''))+'</p><p class="meta">模型研究记录，不代表真实账户持仓或成交。历史规划过期后仅供回看。</p></main></html>'
 (target/(kind+'.html')).write_text(page)
 p=DOCS/'daily-briefings.json';all=json.loads(p.read_text()) if p.exists() else {'schemaVersion':1,'timezone':'Asia/Shanghai'}
 if all.get(kind) and all[kind]['tradeDate']>r['tradeDate']:raise ValueError('Refuse replacing newer briefing with older date')
 all[kind]=r;save(p,all);print(kind,r['tradeDate'],r['status'])
if __name__=='__main__':publish(sys.argv[1])

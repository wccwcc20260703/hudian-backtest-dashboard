import datetime as dt,importlib.util,json,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('valuation',Path(__file__).with_name('update-valuation.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ValuationTest(unittest.TestCase):
 def test_disclosure_and_capital_gate(self):
  reports=[{'period':'2019-09-30','noticeDate':'2019-10-25'},{'period':'2019-12-31','noticeDate':'2020-03-20'},{'period':'2020-03-31','noticeDate':'2020-04-28'}]
  cap=[{'effectiveDate':'2019-01-01','noticeDate':'2019-01-02'},{'effectiveDate':'2020-02-01','noticeDate':'2020-02-15'}]
  self.assertEqual(m.indices('2020-02-10',reports,cap),(0,0));self.assertEqual(m.indices('2020-03-20',reports,cap),(1,1));self.assertEqual(m.indices('2020-04-01',reports,cap),(1,1))
 def test_annualization_and_missing(self):
  for q in range(1,5):
   f={'success':True,'result':{'data':[{'SECURITY_CODE':'002463','REPORTDATE':f'2020-{q*3:02d}-30','NOTICE_DATE':'2021-03-20','UPDATE_DATE':'2022-03-20','PARENT_NETPROFIT':100}]}}
   s={'success':True,'result':{'data':[{'SECURITY_CODE':'002463','TOTAL_SHARES':1000,'END_DATE':'2019-01-01','NOTICE_DATE':'2019-01-02'}]}}
   rs,cs=m.normalize(f,s);self.assertEqual(rs[0]['annualProfit'],400/q);self.assertEqual(m.value(10,rs[0],cs[0]),25*q)
  self.assertIsNone(m.value(10,{'annualProfit':0},{'shares':100}));self.assertIsNone(m.value(10,None,{}));self.assertIsNone(m.value(float('nan'),{},{}))
 def test_dataset(self):
  d=json.loads(m.OUT.read_text());points=d['points'];self.assertEqual(points[0][0],'2020-01-02');self.assertEqual(len({p[0] for p in points}),len(points));self.assertGreater(len(points),1600)
  for date,price,pe,ri,ci in points:
   self.assertEqual((ri,ci),m.indices(date,d['reports'],d['capital']));self.assertEqual(pe,m.value(price,d['reports'][ri],d['capital'][ci]))
  q3=d['reports'][-1];self.assertEqual(q3['parentProfit'],5621944032);self.assertEqual(q3['noticeDate'],'2026-10-28')
if __name__=='__main__':unittest.main()

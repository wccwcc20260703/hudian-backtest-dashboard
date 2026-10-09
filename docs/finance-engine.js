// Financing research simulator. Net cash < 0 denotes debt plus accrued interest.
export function financeBacktest(data,gates,start,end,{capital=1e6,slip=.0005,rate=.06,credit=null,level=1.5,base='D',gate='all_full',ddlimit=1,maintenance=1.5}={}){
 if(!(capital>0)||(credit!==null&&credit<0)||rate<0||level<1||level>1.5||end<=start||start<0||end>data.dates.length)throw Error('无效融资参数');
 let cash=capital,shares=0,fees=0,interest=0,tax=0,t1=0,limits=0,caps=0,turnover=0,riskOrders=0,borrowDays=0,peak=capital,prevEq=capital,minRatio=Infinity,maxExposure=0;
 const nav=[],exposure=[],curve=[],drawdown=[],trades=[],daily=[],debt=[],dailyInterest=[],targets=[];let mdd5=0,mdd=0,dailyPeak=capital;
 for(let d=start;d<end;d++){
  const carry=d>start?Math.max(0,(Date.parse(data.dates[d])-Date.parse(data.dates[d-1]))/86400000-1):0;
  const cost=Math.max(-cash,0)*rate/365*carry;cash-=cost;interest+=cost;
  cash+=shares*data.dividend[d]*.8;tax+=shares*data.dividend[d]*.2;if(data.bonus[d]>0)shares=Math.round(shares*(1+data.bonus[d]));
  let available=shares,pending=false,deadline=-1,target=0,dayBorrow=Math.max(-cash,0),dayInterest=cost,forced=false;
  const orig=data.signals[base][d],plan=[orig[0],orig[1]===1&&gates[base][gate][d]?level:orig[1]];targets.push(plan);
  for(let j=0;j<48;j++){
   const bar=data.bars[d][j],sig=plan[0]===j?plan[1]:-1;
   if(j>=1&&j<=46){
    if(sig>=0){target=sig;pending=true;deadline=Math.min(j+4,46);forced=false;}
    const known=data.bars[d][j-1][3],knownEq=cash+shares*known,loan=Math.max(-cash,0),ratio=loan>0?(Math.max(cash,0)+shares*known)/loan:Infinity;
    if(loan>0&&(ratio<maintenance||shares*known/Math.max(knownEq,1)>1.6||prevEq/peak-1 < -ddlimit)){target=ratio<maintenance?0:1;pending=true;deadline=Math.min(j+4,46);forced=true;}
    if(pending&&j<=deadline){
     if(prevEq/peak-1 < -ddlimit)target=Math.min(target,1);
     const px=bar[0],equity=cash+shares*px,weight=equity>0?shares*px/equity:1e9,tol=target>=1?.004:.035;
     if(Math.abs(target-weight)>tol){
      const desired=Math.max(0,Math.trunc(equity*target/px/100)*100),delta=desired-shares,side=delta>0?1:-1,cap=Math.trunc(data.bars[d][j-1][4]*.01/100)*100;
      if(Math.abs(delta)>cap)caps++;
      let qty=Math.trunc(Math.min(Math.abs(delta),cap)/100)*100;if(side<0&&target===0&&shares<cap)qty=shares;
      const upper=Math.floor(data.reference[d]*1.1*100+.5)/100,lower=Math.floor(data.reference[d]*.9*100+.5)/100,fill=side>0?Math.ceil(px*(1+slip)*100-1e-8)/100:Math.floor(px*(1-slip)*100+1e-8)/100;
      if((side>0&&(px>=upper-.005||fill>upper))||(side<0&&(px<=lower+.005||fill<lower))){if(qty>0)limits++;qty=0;}
      if(side<0){if(qty>available)t1++;qty=Math.min(qty,available);}
      if(side>0){
       const allowed=Math.min(1.5,Math.max(1,target));let aff;
       if(allowed<=1)aff=Math.max(0,Math.trunc((cash-5)/(fill*(1+.00025+data.transfer[d]))/100)*100);
       else{const budget=allowed*cash+(allowed-1)*shares*px-allowed*5;aff=Math.max(0,Math.trunc(budget/(px+allowed*(fill-px)+allowed*fill*(.00025+data.transfer[d]))/100)*100);}
       if(credit!==null)aff=Math.min(aff,Math.max(0,Math.trunc((cash+credit-5)/(fill*(1+.00025+data.transfer[d]))/100)*100));qty=Math.min(qty,aff);
      }
      if(qty>0){
       const gross=qty*fill,fee=Math.max(5,gross*.00025)+gross*(data.transfer[d]+(side<0?data.stamp[d]:0)),oldAvail=available,oldShares=shares;
       cash-=side*gross+fee;shares+=side*qty;if(side<0)available-=qty;fees+=fee;turnover+=gross/Math.max(equity,1);dayBorrow=Math.max(dayBorrow,-cash);if(forced)riskOrders++;
       trades.push([d,j,side,qty,fill,fee,cash,shares,available,oldAvail,target,cap,oldShares,sig,Math.max(-cash,0),forced?1:0]);
      }else pending=false;
     }else pending=false;
    }
   }
   if(j===47){const charge=dayBorrow*rate/365;cash-=charge;interest+=charge;dayInterest+=charge;}
   const mark=j===47?data.close[d]:bar[3],eq=cash+shares*mark;curve.push(eq);prevEq=eq;peak=Math.max(peak,eq);const dd=eq/peak-1;mdd5=Math.min(mdd5,dd);drawdown.push(dd*100);
   if(eq>0)maxExposure=Math.max(maxExposure,shares*mark/eq);if(cash<0)minRatio=Math.min(minRatio,shares*mark/(-cash));
  }
  const eq=cash+shares*data.close[d];nav.push(eq);exposure.push(shares*data.close[d]/eq);debt.push(Math.max(-cash,0));dailyInterest.push(dayInterest);daily.push({cash,shares});dailyPeak=Math.max(dailyPeak,eq);mdd=Math.min(mdd,eq/dailyPeak-1);if(dayBorrow>0)borrowDays++;
 }
 return {model:'L',config:{base,gate,level,rate,credit,creditMode:credit===null?'equity50':'fixed'},start,end,capital,slip,nav,exposure,curve,drawdown,trades,daily,debt,dailyInterest,targets,metrics:{return_:nav.at(-1)/capital-1,mdd,mdd5,exposure:exposure.reduce((a,b)=>a+b,0)/exposure.length,orders:trades.length,fees,interest,dividend_tax:tax,t1_blocks:t1,limit_blocks:limits,volume_caps:caps,turnover,risk_orders:riskOrders,borrow_days:borrowDays,min_maintenance:Number.isFinite(minRatio)?minRatio:null,max_exposure:maxExposure,ending_debt:debt.at(-1),max_debt:Math.max(...debt)}};
}

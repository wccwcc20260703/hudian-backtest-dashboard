import {STOCK_COMMISSION,MIN_COMMISSION,FEE_VERSION} from './fees.js?v=74745f12a7da';
// Financing research simulator. Net cash < 0 denotes debt plus accrued interest.
export function experimentalBacktest(data,gates,start,end,{account='L',overlay='gated',overlayContext=[],capital=1e6,commission=STOCK_COMMISSION,minCommission=MIN_COMMISSION,slip=.0005,rate=.06,credit=null,level=1.5,base='D',gate='all_full',driftPolicy='buy_cap_only',ddlimit=1,maintenance=1.5}={}){
 if(!['D','L'].includes(account)||!['off','all','gated'].includes(overlay))throw Error('无效实验方案');
 if(account==='D'){level=1;rate=0;}
 if(!Number.isFinite(commission)||commission<0||!Number.isFinite(minCommission)||minCommission<0)throw Error('无效佣金参数');
 if(!['rebalance','buy_cap_only'].includes(driftPolicy))throw Error('无效仓位漂移规则');
 if(!(capital>0)||(credit!==null&&credit<0)||rate<0||level<1||level>1.5||end<=start||start<0||end>data.dates.length)throw Error('无效融资参数');
 let cash=capital,shares=0,fees=0,interest=0,tax=0,t1=0,limits=0,caps=0,turnover=0,riskOrders=0,borrowDays=0,peak=capital,prevEq=capital,minRatio=Infinity,maxExposure=0;
 const trips=[],overlayBlocks={funds:0,inventory:0,limits:0,volume:0};
 const nav=[],exposure=[],curve=[],drawdown=[],trades=[],daily=[],debt=[],dailyInterest=[],targets=[];let mdd5=0,mdd=0,dailyPeak=capital;
 for(let d=start;d<end;d++){
  const ctx=overlayContext[d],enabled=overlay==='all'||overlay==='gated'&&ctx?.date===data.dates[d]&&ctx.trend20>.05&&ctx.marketMA60>0;
  const entries=overlay!=='off'&&enabled?bandEntries(data.bars[d]):{};let trip=null,used=false;
  const carry=d>start?Math.max(0,(Date.parse(data.dates[d])-Date.parse(data.dates[d-1]))/86400000-1):0;
  const cost=Math.max(-cash,0)*rate/365*carry;cash-=cost;interest+=cost;
  cash+=shares*data.dividend[d]*.8;tax+=shares*data.dividend[d]*.2;if(data.bonus[d]>0)shares=Math.round(shares*(1+data.bonus[d]));
  let available=shares,pending=false,deadline=-1,target=0,dayBorrow=Math.max(-cash,0),dayInterest=cost,forced=false;
  const orig=data.signals[base][d],plan=[orig[0],orig[1]===1&&gates[base][gate][d]?level:orig[1]];targets.push(plan);
  for(let j=0;j<48;j++){
   const beforeBase=trades.length;let riskNow=false;
   const bar=data.bars[d][j],sig=plan[0]===j?plan[1]:-1;
   if(j>=1&&j<=46){
    if(sig>=0){target=sig;pending=true;deadline=Math.min(j+4,46);forced=false;}
    const known=data.bars[d][j-1][3],knownEq=cash+shares*known,loan=Math.max(-cash,0),ratio=loan>0?(Math.max(cash,0)+shares*known)/loan:Infinity;
    if(loan>0&&(ratio<maintenance||(driftPolicy==='rebalance'&&shares*known/Math.max(knownEq,1)>1.6)||prevEq/peak-1 < -ddlimit)){target=ratio<maintenance?0:1;pending=true;deadline=Math.min(j+4,46);forced=true;riskNow=true;}
    if(pending&&j<=deadline){
     if(prevEq/peak-1 < -ddlimit)target=Math.min(target,1);
     const px=bar[0],equity=cash+shares*px,weight=equity>0?shares*px/equity:1e9,tol=target>=1?.004:.035;
     if(Math.abs(target-weight)>tol&&!(driftPolicy==='buy_cap_only'&&!forced&&target>1&&weight>target)){
      const desired=Math.max(0,Math.trunc(equity*target/px/100)*100),delta=desired-shares,side=delta>0?1:-1,cap=Math.trunc(data.bars[d][j-1][4]*.01/100)*100;
      if(Math.abs(delta)>cap)caps++;
      let qty=Math.trunc(Math.min(Math.abs(delta),cap)/100)*100;if(side<0&&target===0&&shares<cap)qty=shares;
      const upper=Math.floor(data.reference[d]*1.1*100+.5)/100,lower=Math.floor(data.reference[d]*.9*100+.5)/100,fill=side>0?Math.ceil(px*(1+slip)*100-1e-8)/100:Math.floor(px*(1-slip)*100+1e-8)/100;
      if((side>0&&(px>=upper-.005||fill>upper))||(side<0&&(px<=lower+.005||fill<lower))){if(qty>0)limits++;qty=0;}
      if(side<0){if(qty>available)t1++;qty=Math.min(qty,available);}
      if(side>0){
       const allowed=Math.min(1.5,Math.max(1,target));let aff;
       if(allowed<=1)aff=Math.max(0,Math.trunc((cash-minCommission)/(fill*(1+commission+data.transfer[d]))/100)*100);
       else{const budget=allowed*cash+(allowed-1)*shares*px-allowed*minCommission;aff=Math.max(0,Math.trunc(budget/(px+allowed*(fill-px)+allowed*fill*(commission+data.transfer[d]))/100)*100);}
       if(credit!==null)aff=Math.min(aff,Math.max(0,Math.trunc((cash+credit-minCommission)/(fill*(1+commission+data.transfer[d]))/100)*100));qty=Math.min(qty,aff);
      }
      if(qty>0){
       const gross=qty*fill,fee=Math.max(minCommission,gross*commission)+gross*(data.transfer[d]+(side<0?data.stamp[d]:0)),oldAvail=available,oldShares=shares;
       cash-=side*gross+fee;shares+=side*qty;if(side<0)available-=qty;fees+=fee;turnover+=gross/Math.max(equity,1);dayBorrow=Math.max(dayBorrow,-cash);if(forced)riskOrders++;
       trades.push([d,j,side,qty,fill,fee,cash,shares,available,oldAvail,target,cap,oldShares,sig,Math.max(-cash,0),forced?1:0,0]);
      }else pending=false;
     }else pending=false;
    }

    // Base orders and maintenance instructions always take priority over experimental T.
    if(trip&&!trip.cancelled&&trip.remaining>0&&(riskNow||sig>=0)){trip.cancelled=true;trip.exitReason='cancelled_by_base_or_risk';}
    if(trades.length===beforeBase&&!(pending&&j<=deadline)&&!riskNow){
     let side=0,wanted=0,kind=0;
     if(trip&&trip.remaining>0&&!trip.cancelled){
      const gain=trip.side*(known/trip.entryPrice-1);
      if(!trip.exitReason){if(gain>=.0035)trip.exitReason='take_profit';else if(gain<=-.015)trip.exitReason='stop';else if(j>=46)trip.exitReason='time';}
      if(trip.exitReason){side=-trip.side;wanted=trip.remaining;kind=2;}
     }else if(!used&&!forced&&target>0&&j>=21&&j<=36&&entries[j]){
      side=entries[j];kind=1;
     }
     if(side){
      const px=bar[0],equity=cash+shares*px,cap=Math.trunc(data.bars[d][j-1][4]*.01/100)*100;
      const fill=side>0?Math.ceil(px*(1+slip)*100-1e-8)/100:Math.floor(px*(1-slip)*100+1e-8)/100;
      if(kind===1){wanted=Math.max(0,Math.trunc(equity*.1/fill/100)*100);if(available<wanted)overlayBlocks.inventory++;wanted=Math.min(wanted,available);}
      let qty=Math.floor(Math.min(wanted,cap)/100)*100;if(wanted>cap){caps++;overlayBlocks.volume++;}
      const upper=Math.floor(data.reference[d]*1.1*100+.5)/100,lower=Math.floor(data.reference[d]*.9*100+.5)/100;
      if((side>0&&(px>=upper-.005||fill>upper))||(side<0&&(px<=lower+.005||fill<lower))){if(qty>0){limits++;overlayBlocks.limits++;}qty=0;}
      if(side<0){if(qty>available)t1++;qty=Math.min(qty,available);}
      if(side>0){const allowed=account==='D'?1:Math.min(1.5,Math.max(1,target));
       const budget=allowed*cash+(allowed-1)*shares*px-allowed*minCommission;
       let aff=Math.max(0,Math.trunc(budget/(px+allowed*(fill-px)+allowed*fill*(commission+data.transfer[d]))/100)*100);
       if(credit!==null)aff=Math.min(aff,Math.max(0,Math.trunc((cash+credit-minCommission)/(fill*(1+commission+data.transfer[d]))/100)*100));
       if(qty>aff)overlayBlocks.funds++;qty=Math.min(qty,aff);
      }
      if(qty>0){const gross=qty*fill,fee=Math.max(minCommission,gross*commission)+gross*(data.transfer[d]+(side<0?data.stamp[d]:0)),oldAvail=available,oldShares=shares;
       cash-=side*gross+fee;shares+=side*qty;if(side<0)available-=qty;fees+=fee;turnover+=gross/Math.max(equity,1);dayBorrow=Math.max(dayBorrow,-cash);
       if(kind===1){used=true;trip={day:d,date:data.dates[d],entryBar:j,side,entryPrice:fill,quantity:qty,remaining:qty,netCash:0,exitReason:'',cancelled:false};}
       else trip.remaining-=qty;
       trip.netCash-=side*gross+fee;
       trades.push([d,j,side,qty,fill,fee,cash,shares,available,oldAvail,target,cap,oldShares,-1,Math.max(-cash,0),0,kind]);
      }
     }
    }
   }
   if(j===47){const charge=dayBorrow*rate/365;cash-=charge;interest+=charge;dayInterest+=charge;}
   const mark=j===47?data.close[d]:bar[3],eq=cash+shares*mark;curve.push(eq);prevEq=eq;peak=Math.max(peak,eq);const dd=eq/peak-1;mdd5=Math.min(mdd5,dd);drawdown.push(dd*100);
   if(eq>0)maxExposure=Math.max(maxExposure,shares*mark/eq);if(cash<0)minRatio=Math.min(minRatio,shares*mark/(-cash));
  }
  if(trip){trip.complete=trip.remaining===0&&!trip.cancelled;trip.markedNet=trip.netCash+trip.side*trip.remaining*data.close[d];trips.push(trip);}
  const eq=cash+shares*data.close[d];nav.push(eq);exposure.push(shares*data.close[d]/eq);debt.push(Math.max(-cash,0));dailyInterest.push(dayInterest);daily.push({cash,shares});dailyPeak=Math.max(dailyPeak,eq);mdd=Math.min(mdd,eq/dailyPeak-1);if(dayBorrow>0)borrowDays++;
 }
 return {account,overlay,trips,overlayBlocks,commission,minCommission,feeVersion:commission===STOCK_COMMISSION&&minCommission===MIN_COMMISSION?FEE_VERSION:'custom',model:'L',config:{commission,minCommission,base,gate,level,rate,credit,driftPolicy,creditMode:credit===null?'equity50':'fixed'},start,end,capital,slip,nav,exposure,curve,drawdown,trades,daily,debt,dailyInterest,targets,metrics:{return_:nav.at(-1)/capital-1,mdd,mdd5,exposure:exposure.reduce((a,b)=>a+b,0)/exposure.length,orders:trades.length,fees,interest,dividend_tax:tax,t1_blocks:t1,limit_blocks:limits,volume_caps:caps,turnover,risk_orders:riskOrders,borrow_days:borrowDays,min_maintenance:Number.isFinite(minRatio)?minRatio:null,max_exposure:maxExposure,ending_debt:debt.at(-1),max_debt:Math.max(...debt)}};
}

// Only the prefix through bar j-1 participates in an entry at j.
export function bandEntries(bars){
 const cl=bars.map(b=>b[3]),lo=[],hi=[],out={};
 for(let k=19;k<cl.length;k++){const a=cl.slice(k-19,k+1),mean=a.reduce((s,v)=>s+v,0)/20,sd=Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/20);lo[k]=mean-2*sd;hi[k]=mean+2*sd;}
 for(let j=21;j<Math.min(37,bars.length);j++){if(cl[j-2]<lo[j-2]&&cl[j-1]>=lo[j-1])out[j]=1;else if(cl[j-2]>hi[j-2]&&cl[j-1]<=hi[j-1])out[j]=-1;}
 return out;
}

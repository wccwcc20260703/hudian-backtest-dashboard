import {ETF_COMMISSION,MIN_COMMISSION,FEE_VERSION} from '../fees.js?v=74745f12a7da';
// Causal execution model. Frozen pre-open targets; cash account resets on each run.
export const barTime=j=>{const m=j<24?570+j*5:780+(j-24)*5;return `${Math.floor(m/60).toString().padStart(2,'0')}:${(m%60).toString().padStart(2,'0')}`};
export function backtest(data,model,start,end,{capital=1e6,commission=ETF_COMMISSION,minCommission=MIN_COMMISSION,slip=.0005}={}) {
 if(!Number.isFinite(commission)||commission<0||!Number.isFinite(minCommission)||minCommission<0)throw Error('无效佣金参数');
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>data.dates.length||end<=start||!(capital>0)||slip<0)throw Error('无效回测范围或参数');
 let cash=capital,shares=0,fees=0,dividendTax=0,t1Blocks=0,limitBlocks=0,volumeCaps=0,turnover=0,peak=capital,mdd5=0,dailyPeak=capital,mdd=0;
 const nav=[],exposure=[],curve=[],drawdown=[],trades=[],daily=[];
 for(let d=start;d<end;d++){
  const tax=0;
  cash+=shares*data.dividend[d]*(1-tax);dividendTax+=shares*data.dividend[d]*tax;
  if(data.bonus[d]>0)shares=Math.round(shares*(1+data.bonus[d]));
  let available=shares,pending=false,deadline=-1,target=0,daycap=1,sellonly=false;
  for(let j=0;j<48;j++){
   const bar=data.bars[d][j];
   const sig=model==='B'?(d===start&&j===1?1:-1):(data.signals[model==='V'?'H':model][d][0]===j?data.signals[model==='V'?'H':model][d][1]:-1);
   if(j>=1&&j<=46){
    const risk=model==='V'&&data.riskBars[d]===j;
    if(risk)daycap=.5;
    if(sig>=0){target=Math.min(sig,daycap);pending=true;deadline=Math.min(j+4,46);sellonly=false;}
    if(risk){const known=data.bars[d][j-1][3],eq=cash+shares*known;if(shares*known/eq>daycap){target=pending?Math.min(target,daycap):daycap;pending=true;deadline=Math.min(j+4,46);sellonly=true;}else if(pending)target=Math.min(target,daycap);}
    if(pending&&j<=deadline){
     const px=bar[0],equity=cash+shares*px,weight=shares*px/equity,tol=target===1?.004:.035;
     if(Math.abs(target-weight)>tol){
      const desired=Math.trunc(equity*target/px/100)*100,delta=desired-shares,side=delta>0?1:-1,cap=Math.trunc(data.bars[d][j-1][4]*.01/100)*100;
      if(Math.abs(delta)>cap)volumeCaps++;
      let qty=Math.trunc(Math.min(Math.abs(delta),cap)/100)*100;
      if(side<0&&target===0&&shares<cap)qty=shares;
      const upper=Math.floor(data.reference[d]*1.2*1000+.5)/1000,lower=Math.floor(data.reference[d]*.8*1000+.5)/1000;
      const fill=side>0?Math.ceil(px*(1+slip)*1000-1e-8)/1000:Math.floor(px*(1-slip)*1000+1e-8)/1000;
      if((side>0&&(px>=upper-.0005||fill>upper))||(side<0&&(px<=lower+.0005||fill<lower))){if(qty>0)limitBlocks++;qty=0;}
      if(side<0){if(qty>available)t1Blocks++;qty=Math.min(qty,available);}
      if(side>0)qty=Math.min(qty,Math.max(0,Math.trunc((cash-minCommission)/(fill*(1+commission+data.transfer[d]))/100)*100));
      if(side>0&&sellonly)qty=0;
      if(qty>0){
       const gross=qty*fill,fee=Math.max(minCommission,gross*commission)+gross*(data.transfer[d]+(side<0?data.stamp[d]:0)),oldAvail=available,oldShares=shares;
       cash-=side*gross+fee;shares+=side*qty;if(side<0)available-=qty;
       fees+=fee;turnover+=gross/equity;
       trades.push([d,j,side,qty,fill,fee,cash,shares,available,oldAvail,target,cap,oldShares,sig]);
      }else pending=false;
     }else pending=false;
    }
   }
   const eq=cash+shares*(j===47?data.close[d]:bar[3]);curve.push(eq);peak=Math.max(peak,eq);const dd=eq/peak-1;mdd5=Math.min(mdd5,dd);drawdown.push(dd*100);
  }
  const eq=cash+shares*data.close[d];nav.push(eq);exposure.push(shares*data.close[d]/eq);dailyPeak=Math.max(dailyPeak,eq);mdd=Math.min(mdd,eq/dailyPeak-1);daily.push({cash,shares});
 }
 const ret=nav.at(-1)/capital-1;
 return {commission,minCommission,feeVersion:commission===ETF_COMMISSION&&minCommission===MIN_COMMISSION?FEE_VERSION:'custom',model,start,end,capital,slip,nav,exposure,curve,drawdown,trades,daily,metrics:{return_:ret,cagr:Math.expm1(Math.log1p(ret)/((end-start)/242)),mdd,mdd5,exposure:exposure.reduce((a,b)=>a+b,0)/exposure.length,orders:trades.length,fees,dividend_tax:dividendTax,t1_blocks:t1Blocks,limit_blocks:limitBlocks,volume_caps:volumeCaps,turnover}};
}

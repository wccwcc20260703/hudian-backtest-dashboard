import {STOCK_COMMISSION,MIN_COMMISSION,FEE_VERSION} from './fees.js?v=74745f12a7da';
// Buy-and-hold v2: retry initial capital until no board lot can be afforded.
// Dividends are held as cash; they do not replenish the initial purchase budget.
export function holdBenchmark(data,start,end,{capital=1e6,commission=STOCK_COMMISSION,minCommission=MIN_COMMISSION,slip=.0005,ideal=false}={}){
 let cash=capital,budget=capital,shares=0,fees=0,turnover=0,volumeCaps=0,limitBlocks=0,peak=capital,dailyPeak=capital,mdd5=0,mdd=0,complete=false,completion=null;
 const nav=[],exposure=[],curve=[],drawdown=[],trades=[],daily=[];
 for(let d=start;d<end;d++){
  cash+=shares*data.dividend[d];if(data.bonus[d])shares=ideal?shares*(1+data.bonus[d]):Math.round(shares*(1+data.bonus[d]));let available=shares;
  for(let j=0;j<48;j++){
   const bar=data.bars[d][j];
   if(!complete&&j>=1&&j<=46){
    const px=bar[0],eq=cash+shares*px;
    if(ideal){shares=capital/px;cash=0;budget=0;complete=true;completion={day:d,bar:j,date:data.dates[d]};}
    else{
     const fill=Math.ceil(px*(1+slip)*100-1e-8)/100,rate=commission+data.transfer[d];
     const upper=Math.floor(data.reference[d]*1.1*100+.5)/100;
     // Test affordability at the observed adverse fill, separately from temporary liquidity blocks.
     const lotCost=100*fill+Math.max(minCommission,100*fill*commission)+100*fill*data.transfer[d];
     if(budget+1e-8<lotCost){complete=true;completion={day:d,bar:j,date:data.dates[d]};}
     else{
      const cap=Math.trunc(data.bars[d][j-1][4]*.01/100)*100;
      let affordable=Math.max(0,Math.floor((Math.min(cash,budget)-minCommission)/(fill*(1+rate))/100)*100);
      // The reserve above is conservative. Recover one lot when the exact minimum-fee formula permits it.
      const cost=q=>q*fill+Math.max(minCommission,q*fill*commission)+q*fill*data.transfer[d];
      if(cost(affordable+100)<=Math.min(cash,budget)+1e-8)affordable+=100;
      if(affordable>cap)volumeCaps++;
      let qty=Math.min(affordable,cap);
      if(px>=upper-.005||fill>upper){if(affordable>0)limitBlocks++;qty=0;}
      if(qty>0){
       const gross=qty*fill,fee=Math.max(minCommission,gross*commission)+gross*data.transfer[d],oldShares=shares;
       cash-=gross+fee;budget-=gross+fee;shares+=qty;fees+=fee;turnover+=gross/eq;
       trades.push([d,j,1,qty,fill,fee,cash,shares,available,available,1,cap,oldShares,1]);
       if(budget+1e-8<lotCost){complete=true;completion={day:d,bar:j,date:data.dates[d]};}
      }
     }
    }
   }
   const eq=cash+shares*(j===47?data.close[d]:bar[3]);curve.push(eq);peak=Math.max(peak,eq);const dd=eq/peak-1;mdd5=Math.min(mdd5,dd);drawdown.push(dd*100);
  }
  const eq=cash+shares*data.close[d];nav.push(eq);exposure.push(shares*data.close[d]/eq);daily.push({cash,shares});dailyPeak=Math.max(dailyPeak,eq);mdd=Math.min(mdd,eq/dailyPeak-1);
 }
 const ret=nav.at(-1)/capital-1;
 return {model:'B',start,end,capital,commission,minCommission,slip,feeVersion:ideal?'ideal-no-cost':commission===STOCK_COMMISSION&&minCommission===MIN_COMMISSION?FEE_VERSION:'custom',nav,exposure,curve,drawdown,trades,daily,benchmark:{version:ideal?'ideal-v1':'continuous-v2',ideal,completion,initialBudgetRemaining:budget,complete,firstDayExposure:exposure[0],dividendReinvestment:false},metrics:{return_:ret,cagr:Math.expm1(Math.log1p(ret)/((end-start)/242)),mdd,mdd5,exposure:exposure.reduce((a,b)=>a+b,0)/exposure.length,orders:trades.length,fees,dividend_tax:0,t1_blocks:0,limit_blocks:limitBlocks,volume_caps:volumeCaps,turnover}};
}

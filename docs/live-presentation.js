// Presentation only: estimates never create orders or change the model ledger.
export function orderEstimate({price,target,side,portfolio,model='D',config={},slip=.0005,transfer=.00001,stamp=.0005,previous}){
 const {cash,shares}=portfolio??{},equity=cash+shares*price;
 if(![cash,shares,price,target,slip,transfer,stamp].every(Number.isFinite)||!(price>0&&equity>0)||shares<0)return {valid:false};
 const before=shares*price/equity,desired=Math.max(0,Math.floor(equity*target/price/100)*100);
 const required=side>0?Math.max(0,desired-shares):side<0?Math.max(0,shares-desired):0;
 const fill=side>0?Math.ceil(price*(1+slip)*100-1e-8)/100:Math.floor(price*(1-slip)*100+1e-8)/100;
 let qty=side===0?0:Math.floor(required/100)*100,reason='';
 if(side<0){qty=Math.min(qty,portfolio.available??shares);if(target===0)qty=Math.min(shares,portfolio.available??shares);}
 if(side>0){
  const allowed=model==='L'?Math.min(1.5,Math.max(1,target)):1;
  const budget=allowed*cash+(allowed-1)*shares*price-allowed*5;
  let affordable=Math.max(0,Math.floor(budget/(price+allowed*(fill-price)+allowed*fill*(.00025+transfer))/100)*100);
  if(model==='L'&&config.credit!=null)affordable=Math.min(affordable,Math.max(0,Math.floor((cash+config.credit-5)/(fill*(1+.00025+transfer))/100)*100));
  qty=Math.min(qty,affordable);if(qty<required)reason='资金或融资额度限制';
 }
 if(Number.isFinite(previous)&&previous>0){const upper=Math.floor(previous*1.1*100+.5)/100,lower=Math.floor(previous*.9*100+.5)/100;if(side>0&&(price>=upper-.005||fill>upper)||side<0&&(price<=lower+.005||fill<lower)){qty=0;reason='涨跌停价格限制';}}
 const gross=qty*fill,fee=qty?Math.max(5,gross*.00025)+gross*(transfer+(side<0?stamp:0)):0;
 const cashAfter=cash-side*gross-fee,sharesAfter=shares+side*qty,afterEquity=cashAfter+sharesAfter*price;
 return {valid:true,required,qty,fill,fee,before,after:afterEquity>0?sharesAfter*price/afterEquity:null,cashAfter,sharesAfter,reason};
}
// Keep the hovered graphic and tooltip intact through both quote and minute refreshes.
// The newest pending option is applied on pointer exit; quote fields remain live.
export function hoverStableUpdater(chart){
 let inside=false,pending=null,lastKey=null;
 const apply=()=>{if(!pending||inside)return;const next=pending;pending=null;if(next.key===lastKey)return;chart.setOption(next.option,true);lastKey=next.key;};
 chart.getZr().on('mousemove',()=>{inside=true;});
 chart.getZr().on('globalout',()=>{inside=false;apply();});
 return (option,key)=>{pending={option,key};apply();};
}
export const actionableSignals=signals=>signals.filter(s=>s.side!==0&&!s.passiveDrift);

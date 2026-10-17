/// Reproducible synthetic fixture for method verification, never represented as market history.
export function syntheticPrices(days=181) {
 let eth=3000,btc=60000;
 return Array.from({length:days},(_,i)=>{if(i){eth*=Math.exp(.0004+.018*Math.sin(i*1.31)+.009*Math.cos(i*.23));btc*=Math.exp(.00025+.013*Math.sin(i*.92)-.007*Math.cos(i*.17));}return {day:i,prices:[1,eth,btc]};});
}
const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
export function sampleVol(returns) {if(returns.length<2)return 0;const m=mean(returns);return Math.sqrt(returns.reduce((a,r)=>a+(r-m)**2,0)/(returns.length-1)*365);}
export function signals(rows,lookback=20) {
 if(rows.length<=lookback)throw new Error('Insufficient history');
 return [1,2].map(i=>{const r=rows.slice(-lookback-1);return {volatility:Math.round(sampleVol(r.slice(1).map((x,j)=>Math.log(x.prices[i]/r[j].prices[i])))*10000),momentum:Math.round((r.at(-1).prices[i]/r[0].prices[i]-1)*10000)};});
}
export function weightsFor(strategy,signal,{cashBuffer=2000,targetVolatility=1200}={}) {
 let exposure=10000-cashBuffer;
 if(strategy===1){if(signal.every(s=>s.momentum<=0))return [10000,0,0];const w=signal[0].momentum>=signal[1].momentum?Math.floor(exposure*.75):Math.floor(exposure*.25);return [cashBuffer,w,exposure-w];}
 if(strategy===2){const avg=Math.floor((signal[0].volatility+signal[1].volatility)/2);if(avg>0&&Math.floor(exposure*avg/10000)>targetVolatility)exposure=Math.floor(targetVolatility*10000/avg);}
 const half=Math.floor(exposure/2);return [10000-exposure,half,exposure-half];
}
export function backtest(strategy,{rows=syntheticPrices(),feeBps=20,lookback=20,rebalanceEvery=7}={}) {
 if(![0,1,2].includes(strategy)||rows.length<lookback+3||feeBps<0||feeBps>500)throw new Error('Invalid backtest configuration');
 let units=[10000,0,0],peak=10000,drawdown=0,costs=0;const history=[],returns=[];
 for(let day=lookback;day<rows.length;day++) {
  const prices=rows[day].prices;let nav=units.reduce((s,u,i)=>s+u*prices[i],0);
  // Trading on day t only uses prices observed through t-1.
  if((day-lookback)%rebalanceEvery===0&&day>lookback){const w=weightsFor(strategy,signals(rows.slice(0,day),lookback));const fee=feeBps/10000;
   // Match the MVP's full sell-to-cash then buy execution, charging both legs.
   let cash=units[0];for(let i=1;i<3;i++){const value=units[i]*prices[i];cash+=value*(1-fee);costs+=value*fee;}
   units=[cash*w[0]/10000,0,0];for(let i=1;i<3;i++){const spend=cash*w[i]/10000;units[i]=spend*(1-fee)/prices[i];costs+=spend*fee;}
   nav=units.reduce((s,u,i)=>s+u*prices[i],0);
  }
  if(history.length)returns.push(nav/history.at(-1).nav-1);peak=Math.max(peak,nav);drawdown=Math.max(drawdown,1-nav/peak);history.push({day,nav});
 }
 const annualVol=sampleVol(returns),annualReturn=(history.at(-1).nav/10000)**(365/(history.length-1))-1;
 return {strategy,source:'synthetic deterministic fixture',liveMarketData:false,lookback,rebalanceEvery,feeBps,periodDays:history.length-1,totalReturn:history.at(-1).nav/10000-1,annualReturn,annualVolatility:annualVol,sharpe:annualVol?mean(returns)*365/annualVol:null,maxDrawdown:drawdown,transactionCosts:costs,riskFreeRate:0,history};
}

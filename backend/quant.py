"""Reproducible synthetic research; signals use data available before the trade."""
import math


def synthetic_prices(days=181):
    eth, btc, rows = 3000., 60000., []
    for i in range(days):
        if i:
            eth *= math.exp(.0004 + .018 * math.sin(i * 1.31) + .009 * math.cos(i * .23))
            btc *= math.exp(.00025 + .013 * math.sin(i * .92) - .007 * math.cos(i * .17))
        rows.append({'day': i, 'prices': [1, eth, btc]})
    return rows


def sample_vol(returns):
    if len(returns) < 2:
        return 0
    mean = sum(returns) / len(returns)
    return math.sqrt(sum((r - mean)**2 for r in returns) / (len(returns) - 1) * 365)


def signals(rows, lookback=20):
    if len(rows) <= lookback:
        raise ValueError('Insufficient history')
    recent = rows[-lookback-1:]
    return [{'volatility': math.floor(sample_vol([math.log(b['prices'][i] / a['prices'][i])
             for a, b in zip(recent, recent[1:])]) * 10000 + .5),
             'momentum': math.floor((recent[-1]['prices'][i] / recent[0]['prices'][i] - 1) * 10000 + .5)}
            for i in (1, 2)]


def weights_for(strategy, signal, cash_buffer=2000, target_volatility=1200):
    exposure = 10000 - cash_buffer
    if strategy == 1:
        if all(s['momentum'] <= 0 for s in signal):
            return [10000, 0, 0]
        w = exposure * (3 if signal[0]['momentum'] >= signal[1]['momentum'] else 1) // 4
        return [cash_buffer, w, exposure - w]
    if strategy == 2:
        avg = (signal[0]['volatility'] + signal[1]['volatility']) // 2
        if avg > 0 and exposure * avg // 10000 > target_volatility:
            exposure = target_volatility * 10000 // avg
    return [10000 - exposure, exposure // 2, exposure - exposure // 2]


def backtest(strategy, rows=None, fee_bps=20, lookback=20, rebalance_every=7):
    rows = synthetic_prices() if rows is None else rows
    if strategy not in (0, 1, 2) or len(rows) < lookback + 3 or not 0 <= fee_bps <= 500:
        raise ValueError('Invalid backtest configuration')
    units, peak, drawdown, costs, history, returns = [10000., 0., 0.], 10000., 0., 0., [], []
    for day in range(lookback, len(rows)):
        prices = rows[day]['prices']
        nav = sum(u*p for u, p in zip(units, prices))
        if (day-lookback) % rebalance_every == 0 and day > lookback:
            w = weights_for(strategy, signals(rows[:day], lookback))
            fee, cash = fee_bps / 10000, units[0]
            for i in (1, 2):
                value = units[i]*prices[i]
                cash += value*(1-fee)
                costs += value*fee
            units = [cash*w[0]/10000, 0., 0.]
            for i in (1, 2):
                spend = cash*w[i]/10000
                units[i] = spend*(1-fee)/prices[i]
                costs += spend*fee
            nav = sum(u*p for u, p in zip(units, prices))
        if history:
            returns.append(nav/history[-1]['nav']-1)
        peak = max(peak, nav)
        drawdown = max(drawdown, 1-nav/peak)
        history.append({'day': day, 'nav': nav})
    vol = sample_vol(returns)
    return dict(strategy=strategy, source='synthetic deterministic fixture', liveMarketData=False,
                lookback=lookback, rebalanceEvery=rebalance_every, feeBps=fee_bps, periodDays=len(history)-1,
                totalReturn=history[-1]['nav']/10000-1, annualReturn=(history[-1]['nav']/10000)**(365/(len(history)-1))-1,
                annualVolatility=vol, sharpe=sum(returns)/len(returns)*365/vol if vol else None,
                maxDrawdown=drawdown, transactionCosts=costs, riskFreeRate=0, history=history)

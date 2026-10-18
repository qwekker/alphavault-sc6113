import json
from backend.chain import ROOT
from backend.quant import backtest, signals, synthetic_prices, weights_for
import pytest


@pytest.mark.parametrize('strategy',[0,1,2])
def test_python_research_matches_frozen_original_results(strategy):
    expected=json.loads((ROOT/'evidence/backtests.json').read_text())[strategy]
    actual=backtest(strategy)
    for key in ('totalReturn','annualReturn','annualVolatility','maxDrawdown','sharpe','transactionCosts'):
        assert actual[key] == pytest.approx(expected[key],rel=1e-10,abs=1e-10)
    assert actual['liveMarketData'] is False
    assert actual['periodDays']==160


def test_future_prices_cannot_change_past_results():
    rows=synthetic_prices()
    baseline=backtest(1,rows=rows)
    rows[-1]['prices'][1]*=10
    changed=backtest(1,rows=rows)
    assert baseline['history'][:-1]==changed['history'][:-1]


def test_nonpositive_momentum_and_high_volatility_reduce_risk():
    s=[{'momentum':-100,'volatility':8000},{'momentum':-1,'volatility':8000}]
    assert weights_for(1,s)==[10000,0,0]
    assert weights_for(2,s)==[8500,750,750]


def test_research_endpoint_persists(client,service):
    result=client.get('/api/backtests/2')
    assert result.status_code==200
    row=service.store.one('SELECT * FROM backtests WHERE strategy=?',(2,))
    assert json.loads(row['result'])==result.json

import json
import pytest
from backend.app import create_app
from backend.actions import build_action, amount
from backend.store import Store, open_store
from backend.keeper import keeper_tick
from backend.receipts import bootstrap, receipt_evidence


def test_dashboard_chain_state_and_assets(client, service):
    assert client.get('/api/health').json == dict(ok=True, backend='python-flask', database='sqlite', mode='local-demo', chainId=31337)
    assert client.get('/api/config').json['demo'] is True
    s = client.get('/api/portfolio').json
    assert s['navUsd'] == 10000 and s['target'] == [2000, 4000, 4000]
    assert s['totalSupply'] == str(10000*10**24)
    assert len(client.get('/api/prices').json) == 3
    assert client.get('/api/strategies').json['selected'] == 0
    assert client.get('/api/snapshots').json[-1]['nav'] == str(10000*10**18)
    account = client.get('/api/account/'+service.chain.manifest['roles']['investor']).json
    assert int(account['shares']) == 10000*10**24
    assert b'Your portfolio, in focus' in client.get('/').data
    assert "script-src 'self'" in client.get('/').headers['Content-Security-Policy']
    for path in ('/styles.css', '/app.js', '/vendor/ethers.js'):
        assert client.get(path).status_code == 200


@pytest.mark.parametrize('path', ['/api/history?limit=201','/api/history?limit=0','/api/history?limit=1.5',
                                  '/api/account/nope','/api/backtests/3','/api/backtests/-1'])
def test_invalid_read_inputs(client, path):
    assert client.get(path).status_code == 400


@pytest.mark.parametrize('data', [None, [], {'action':'unknown'}, {'action':'deposit','args':{'amount':'NaN'}},
                                    {'action':'deposit','args':{'amount':1}}, {'action':'configure','args':{}},
                                    {'action':'setPaused','args':{'paused':'true'}}, {'action':'redeem','args':{'shares':'0'}},
                                    {'action':'selectStrategy','args':{'id':True}}, {'action':'setRole','args':{'role':'ADMIN','address':'bad','enabled':True}}])
def test_invalid_transaction_inputs(client, data):
    r = client.post('/api/transactions/build', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 400


def test_json_limits_and_unknown_routes(client):
    assert client.post('/api/transactions/build', data='{', content_type='application/json').status_code == 400
    assert client.post('/api/transactions/build', data='x'*13000, content_type='application/json').status_code == 413
    assert client.get('/api/not-real').status_code == 404
    assert client.get('/../.env.sepolia.local').status_code == 404


def test_public_mode_has_no_signing_endpoint(service):
    public = create_app(service, start_indexer=False).test_client()
    assert public.post('/api/demo/action', json={'action':'rebalance'}, headers={'X-AlphaVault-Demo':'1'}).status_code == 403
    assert public.get('/api/setup/artifacts').status_code == 404
    assert public.get('/api/config').json['demo'] is False


def test_demo_request_guards_and_role_enforcement(client, service):
    data = dict(action='selectStrategy', args={'id':1}, role='manager')
    assert client.post('/api/demo/action', json=data).status_code == 403
    assert client.post('/api/demo/action', json=data, headers={'X-AlphaVault-Demo':'1','Origin':'https://foreign.example'}).status_code == 403
    assert client.post('/api/demo/action', json=data, headers={'X-AlphaVault-Demo':'1','Host':'foreign.example'}).status_code == 403
    assert client.post('/api/demo/action', json=data, headers={'X-AlphaVault-Demo':'1'}, environ_overrides={'REMOTE_ADDR':'10.1.2.3'}).status_code == 403
    data['role']='investor'
    assert client.post('/api/demo/action', json=data, headers={'X-AlphaVault-Demo':'1'}).status_code == 400
    assert service.chain.strategy.functions.selected().call() == 0


def test_all_thirteen_business_methods_and_evidence(client, service, action):
    c = service.chain
    steps = [('approve', {'amount':'1000'}, 'investor'), ('deposit', {'amount':'1000'}, 'investor'),
             ('selectStrategy', {'id':1}, 'manager'), ('configure', {'target':1200,'cash':2000,'cooldown':30}, 'manager'),
             ('setEnabled', {'id':2,'enabled':True}, 'manager'), ('setAutomation', {'enabled':True}, 'manager'),
             ('updateMarket', {'asset':1,'price':'3000','volatility':4000,'momentum':800}, 'risk'),
             ('setAssetEnabled', {'asset':1,'enabled':True}, 'risk'),
             ('setLimits', {'maxWeight':8000,'minCash':1000,'maxVolatility':6000,'maxSlippage':100,'maxAge':86400}, 'risk'),
             ('setRole', {'role':'KEEPER','address':c.manifest['roles']['keeper'],'enabled':True}, 'admin'),
             ('rebalance', {'slippage':100}, 'keeper'), ('setPaused', {'paused':True}, 'risk'),
             ('redeem', {'shares':str(100*10**24)}, 'investor')]
    for method, args, role in steps:
        result = action(method,args,role)
        saved = client.post('/api/receipts',json={'hash':result['hash']})
        assert saved.status_code == 200, saved.json
        assert saved.json['method'] == method and saved.json['status'] == 'confirmed'
    report = client.get('/api/evidence').json
    assert report['successfulKinds'] == 13 and report['minimumTenKindsMet']
    assert all(x['completed'] for x in report['coverage'])
    assert len(client.get('/api/jobs').json) == 13
    assert service.sync(force=True)['paused']


def test_pause_blocks_deposit_but_allows_exit(client, service, action):
    action('setPaused', {'paused':True}, 'risk')
    r=client.post('/api/demo/action',json=dict(action='deposit',args={'amount':'1'},role='investor'),headers={'X-AlphaVault-Demo':'1'})
    assert r.status_code == 400
    before = service.account(service.chain.manifest['roles']['investor'])
    action('redeem', {'shares':str(10**24)}, 'investor')
    after = service.account(service.chain.manifest['roles']['investor'])
    assert int(after['shares']) == int(before['shares'])-10**24


def test_keeper_executes_then_obeys_cooldown(service):
    assert keeper_tick(service)['status'] == 'confirmed'
    assert keeper_tick(service)['status'] == 'skipped'
    assert any(e['name']=='Rebalanced' for e in service.history())


def test_restart_persistence_and_atomic_batch(service, tmp_path):
    service.sync(force=True)
    other = Store(str(tmp_path/'state.sqlite'))
    assert other.one('SELECT count(*) n FROM events')['n'] == len(service.history())
    with pytest.raises(Exception):
        other.batch([('INSERT INTO backtests VALUES(?,?,?,?)',(99,1,'test','{}')),('INSERT INTO no_such_table VALUES(?)',(1,))])
    assert other.one('SELECT * FROM backtests WHERE strategy=?',(99,)) is None
    other.close()


def test_reorg_removes_orphan_events_and_receipt_coverage(service, action, client):
    service.sync(force=True)
    rpc=service.chain.w3.provider
    snapshot=rpc.make_request('evm_snapshot',[])['result']
    tx=action('selectStrategy',{'id':1},'manager')
    assert client.post('/api/receipts',json={'hash':tx['hash']}).status_code == 200
    assert any(e['tx_hash']==tx['hash'] for e in service.history())
    rpc.make_request('evm_revert',[snapshot])
    assert service.sync(force=True)['selected'] == 0
    assert not any(e['tx_hash']==tx['hash'] for e in service.history())
    evidence=client.get('/api/evidence').json
    assert evidence['successfulKinds']==0 and len(evidence['excluded'])==1


def test_receipts_reject_wrong_target_or_spender(service, client):
    c=service.chain
    assert client.post('/api/receipts',json={'hash':'invalid'}).status_code==400
    assert client.post('/api/receipts',json={'hash':'0x'+'cd'*32}).status_code==400
    tx=c.tokens[0].functions.approve(c.risk.address,1).transact({'from':c.manifest['roles']['investor']})
    c.w3.eth.wait_for_transaction_receipt(tx)
    with pytest.raises(ValueError,match='Approval'):
        receipt_evidence(c,c.w3.to_hex(tx))
    seed=dict(chainId=11155111,vault=c.vault.address,hashes=[])
    with pytest.raises(ValueError,match='mismatch'):
        bootstrap(service,seed)


def test_receipt_seed_is_idempotent(service, action):
    tx=action('selectStrategy',{'id':1},'manager')
    seed=dict(chainId=31337,vault=service.chain.vault.address,hashes=[tx['hash'],tx['hash']])
    assert bootstrap(service,seed)==dict(imported=1,skipped=0)
    assert bootstrap(service,seed)==dict(imported=0,skipped=1)


def test_retention_keeps_event_ledger(service, action):
    service.retention=2
    service.sync(force=True)
    initial=len([e for e in service.history() if e['name']=='StrategySelected'])
    for i in [1,2,0]: action('selectStrategy',{'id':i},'manager')
    assert len(service.snapshots())==2
    assert len([e for e in service.history() if e['name']=='StrategySelected'])==initial+3


def test_public_storage_requires_postgres(tmp_path):
    with pytest.raises(ValueError,match='DATABASE_URL'):
        open_store({'DATABASE_REQUIRED':'postgres'},tmp_path)


def test_amount_precision():
    assert amount('999999999999.123456789123456789') == 999999999999123456789123456789

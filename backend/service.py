"""Read one coherent block, index canonical events, persist observations atomically."""
import json
import threading
import time
from web3 import Web3
from web3.exceptions import BlockNotFound, ContractLogicError, Web3RPCError
from .chain import hx

UNIT = 10**18


def event_value(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return str(value)
    if isinstance(value, bytes):
        return hx(value)
    if isinstance(value, (list, tuple)):
        return [event_value(v) for v in value]
    return value


class Service:
    def __init__(self, chain, store, retention=2000):
        if type(retention) is not int or retention < 1:
            raise ValueError('Invalid snapshot retention')
        self.chain, self.store, self.retention = chain, store, retention
        self.scope = str(chain.manifest['chainId']) + ':' + chain.vault.address.lower()
        self.lock = threading.RLock()
        self.last_sync = 0
        self.cached = None

    def read(self):
        c = self.chain
        block_number = c.w3.eth.block_number
        block = c.w3.eth.get_block(block_number)
        def call(contract, name, *args):
            return getattr(contract.functions, name)(*args).call(block_identifier=block_number)
        markets, balances = [], []
        max_age = call(c.risk, 'maxAge')
        for i, asset in enumerate(c.manifest['assets']):
            price, volatility, momentum, updated, enabled = call(c.risk, 'markets', c.tokens[i].address)
            markets.append(dict(asset, price=str(price), priceUsd=price/UNIT, volatility=volatility,
                                momentum=momentum, updatedAt=updated, enabled=enabled,
                                stale=i > 0 and block.timestamp > updated + max_age))
            balances.append(call(c.tokens[i], 'balanceOf', c.vault.address))
        supply = call(c.vault, 'totalSupply')
        values = [b*int(a['price'])//UNIT for b, a in zip(balances, markets)]
        nav = sum(values)
        weights = [v*10000//nav if nav else 0 for v in values]
        target, validation_error = [], None
        try:
            target = list(call(c.strategy, 'targetWeights'))
            call(c.risk, 'validate', target)
        except ContractLogicError as exc:
            validation_error = (getattr(exc, 'message', None) or str(exc)).split('execution reverted: ')[-1]
        except Web3RPCError as exc:
            # Ganache returns -32000 for eth_call reverts, whereas hosted RPCs
            # commonly use code 3 (ContractLogicError). Do not hide transport failures.
            message = (exc.rpc_response or {}).get('error', {}).get('message', '')
            if 'revert' not in message.lower():
                raise
            validation_error = message.split('revert', 1)[-1].lstrip(': ') or 'Contract policy rejected target'
        assets = [dict(a, balance=str(balances[i]), balanceFormatted=balances[i]/UNIT,
                       valueUsd=values[i]/UNIT, weightBps=weights[i]) for i, a in enumerate(markets)]
        return dict(scope=self.scope, blockNumber=block_number, blockHash=hx(block.hash), timestamp=block.timestamp,
                    nav=str(nav), navUsd=nav/UNIT, totalSupply=str(supply), shareIndex=nav*1e8/supply if supply else 100,
                    assets=assets, weights=weights, target=target, validationError=validation_error,
                    selected=call(c.strategy, 'selected'), paused=call(c.risk, 'paused'),
                    automationEnabled=call(c.vault, 'automationEnabled'), lastRebalance=call(c.vault, 'lastRebalance'),
                    cooldown=call(c.strategy, 'cooldown'), cashBuffer=call(c.strategy, 'cashBuffer'),
                    targetVolatility=call(c.strategy, 'targetVolatility'),
                    strategyEnabled=[call(c.strategy, 'enabled', i) for i in range(3)],
                    limits={k: call(c.risk, k) for k in ('maxWeight', 'minCash', 'maxVolatility', 'maxSlippage', 'maxAge')},
                    valuationStale=any(a['stale'] and balances[i] > 0 for i, a in enumerate(markets)))

    def sync(self, force=False):
        with self.lock:
            # The dashboard asks for three resources together. Share a short observation,
            # but force a fresh canonical block after a local transaction or index tick.
            if not force and self.cached and time.monotonic()-self.last_sync < 1:
                return self.cached
            state = self.read()
            c, db = self.chain, self.store
            cursor = db.one('SELECT * FROM cursors WHERE scope=?', (self.scope,))
            start = c.manifest['deploymentBlock']
            reorg = False
            if cursor:
                try:
                    previous = c.w3.eth.get_block(cursor['block_number'])
                    if hx(previous.hash) == cursor['block_hash']:
                        start = cursor['block_number']+1
                    else:
                        reorg = True
                except BlockNotFound:
                    reorg = True
            writes = []
            if reorg:
                writes.extend((f'DELETE FROM {table} WHERE scope=?', (self.scope,))
                              for table in ('events', 'snapshots', 'prices', 'strategies'))
            addresses = {contract.address.lower(): (name, contract) for name, contract in c.contracts.items()}
            for begin in range(start, state['blockNumber']+1, 2000):
                logs = c.w3.eth.get_logs({'address': [v[1].address for v in addresses.values()],
                                          'fromBlock': begin, 'toBlock': min(begin+1999, state['blockNumber'])})
                for log in logs:
                    name, contract = addresses[log.address.lower()]
                    for abi in contract.abi:
                        if abi.get('type') != 'event':
                            continue
                        event = getattr(contract.events, abi['name'])()
                        if log.topics and hx(log.topics[0]) == event.topic:
                            decoded = event.process_log(log)
                            payload = [event_value(decoded['args'][a['name']]) for a in abi['inputs']]
                            writes.append(('INSERT INTO events VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(scope,tx_hash,log_index) DO NOTHING',
                                           (self.scope, hx(log.transactionHash), log.logIndex, log.blockNumber,
                                            hx(log.blockHash), name, abi['name'], json.dumps(payload))))
                            break
            writes.append(('INSERT INTO snapshots VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(scope,block_number) DO UPDATE SET block_hash=excluded.block_hash,timestamp=excluded.timestamp,nav=excluded.nav,supply=excluded.supply,share_index=excluded.share_index,weights=excluded.weights',
                           (self.scope, state['blockNumber'], state['blockHash'], state['timestamp'], state['nav'],
                            state['totalSupply'], state['shareIndex'], json.dumps(state['weights']))))
            for a in state['assets']:
                writes.append(('INSERT INTO prices VALUES(?,?,?,?,?,?,?) ON CONFLICT(scope,asset,block_number) DO UPDATE SET price=excluded.price,volatility=excluded.volatility,momentum=excluded.momentum,updated_at=excluded.updated_at',
                               (self.scope, a['address'], state['blockNumber'], a['price'], a['volatility'], a['momentum'], a['updatedAt'])))
            writes.append(('INSERT INTO strategies VALUES(?,?,?,?,?) ON CONFLICT(scope,block_number) DO UPDATE SET selected=excluded.selected,weights=excluded.weights,config=excluded.config',
                           (self.scope, state['blockNumber'], state['selected'], json.dumps(state['target']),
                            json.dumps({k: state[k] for k in ('cashBuffer', 'targetVolatility', 'cooldown')}))))
            writes.append(('INSERT INTO cursors VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET block_number=excluded.block_number,block_hash=excluded.block_hash',
                           (self.scope, state['blockNumber'], state['blockHash'])))
            for table in ('prices', 'strategies', 'snapshots'):
                writes.append((f'DELETE FROM {table} WHERE scope=? AND block_number NOT IN (SELECT block_number FROM snapshots WHERE scope=? ORDER BY block_number DESC LIMIT ?)',
                               (self.scope, self.scope, self.retention)))
            if hx(c.w3.eth.get_block(state['blockNumber']).hash) != state['blockHash']:
                raise ValueError('Chain changed during indexing; retry')
            db.batch(writes)
            self.cached, self.last_sync = state, time.monotonic()
            return state

    def history(self, limit=50):
        rows = self.store.all('SELECT * FROM events WHERE scope=? ORDER BY block_number DESC,log_index DESC LIMIT ?', (self.scope, limit))
        return [dict(row, payload=json.loads(row['payload'])) for row in rows]

    def snapshots(self):
        return self.store.all('SELECT * FROM snapshots WHERE scope=? ORDER BY block_number DESC LIMIT 200', (self.scope,))[::-1]

    def account(self, address):
        if not Web3.is_address(address):
            raise ValueError('Invalid account')
        address = Web3.to_checksum_address(address)
        c = self.chain
        return dict(address=address, shares=str(c.vault.functions.balanceOf(address).call()),
                    cash=str(c.tokens[0].functions.balanceOf(address).call()),
                    allowance=str(c.tokens[0].functions.allowance(address, c.vault.address).call()))

    def job(self, kind, status, tx_hash='', message=''):
        self.store.execute('INSERT INTO jobs(scope,created_at,kind,status,tx_hash,message) VALUES(?,?,?,?,?,?)',
                           (self.scope, int(time.time()*1000), kind, status, tx_hash, message))

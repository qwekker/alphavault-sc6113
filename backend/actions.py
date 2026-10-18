"""Validated unsigned transactions for MetaMask; disposable local accounts only."""
import re
from web3 import Web3
from .chain import hx


def number(value, low, high, label):
    if isinstance(value, bool) or not re.fullmatch(r'-?\d+', str(value)):
        raise ValueError('Invalid '+label)
    result = int(value)
    if not low <= result <= high:
        raise ValueError('Invalid '+label)
    return result


def amount(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{1,12}(\.\d{1,18})?', value):
        raise ValueError('Invalid positive amount')
    whole, _, fraction = value.partition('.')
    result = int(whole)*10**18 + int(fraction.ljust(18, '0'))
    if not result:
        raise ValueError('Invalid positive amount')
    return result


def boolean(value):
    if type(value) is not bool:
        raise ValueError('Expected boolean')
    return value


def build_action(chain, action, args=None):
    args = {} if args is None else args
    if not isinstance(args, dict) or not isinstance(action, str):
        raise ValueError('Expected action string and args object')
    c, role, method = None, None, action
    def n(key, low, high):
        return number(args.get(key), low, high, key)
    if action == 'approve':
        c, role, params = chain.tokens[0], 'investor', [chain.vault.address, amount(args.get('amount'))]
    elif action == 'deposit':
        value = amount(args.get('amount'))
        c, role = chain.vault, 'investor'
        params = [value, c.functions.previewDeposit(value).call()*9950//10000]
    elif action == 'redeem':
        c, role, params = chain.vault, 'investor', [n('shares', 1, 2**256-1), [0, 0, 0]]
    elif action == 'selectStrategy':
        c, role, params = chain.strategy, 'manager', [n('id', 0, 2)]
    elif action == 'configure':
        c, role, params = chain.strategy, 'manager', [n('target', 1, 10000), n('cash', 0, 10000), n('cooldown', 30, 604800)]
    elif action == 'setEnabled':
        c, role, params = chain.strategy, 'manager', [n('id', 0, 2), boolean(args.get('enabled'))]
    elif action == 'setAutomation':
        c, role, params = chain.vault, 'manager', [boolean(args.get('enabled'))]
    elif action == 'rebalance':
        c, role, params = chain.vault, 'keeper', [number(args.get('slippage', 100), 0, 500, 'slippage'), chain.w3.eth.get_block('latest').timestamp+300]
    elif action == 'setPaused':
        c, role, params = chain.risk, 'risk', [boolean(args.get('paused'))]
    elif action == 'setLimits':
        c, role, params = chain.risk, 'risk', [n('maxWeight', 1, 10000), n('minCash', 0, 10000), n('maxVolatility', 1, 100000), n('maxSlippage', 0, 500), n('maxAge', 60, 86400)]
    elif action == 'updateMarket':
        c, role, params = chain.risk, 'risk', [chain.tokens[n('asset', 1, 2)].address, amount(args.get('price')), n('volatility', 0, 100000), n('momentum', -10000, 100000)]
    elif action == 'setAssetEnabled':
        c, role, params = chain.risk, 'risk', [chain.tokens[n('asset', 1, 2)].address, boolean(args.get('enabled'))]
    elif action == 'setRole':
        if args.get('role') not in ('MANAGER', 'RISK', 'KEEPER') or not Web3.is_address(args.get('address', '')):
            raise ValueError('Invalid role/address')
        c, role = chain.risk, 'admin'
        params = [Web3.keccak(text=args['role']), Web3.to_checksum_address(args['address']), boolean(args.get('enabled'))]
    else:
        raise ValueError('Unknown action')
    return dict(to=c.address, data=c.encode_abi(method, args=params), value='0x0',
                chainId=hex(chain.manifest['chainId']), role=role)


def demo_action(service, action, args, role):
    c = service.chain
    if c.manifest['chainId'] != 31337 or c.w3.eth.chain_id != 31337:
        raise ValueError('Demo signing requires local chain 31337')
    tx = build_action(c, action, args)
    if role != tx['role']:
        raise ValueError('This action requires '+tx['role']+' role')
    # No private key is loaded; only the dedicated loopback Ganache exposes accounts.
    sender = Web3.to_checksum_address(c.manifest['roles'][role])
    payload = {k: v for k, v in tx.items() if k not in ('role', 'chainId')}
    payload['from'] = sender
    try:
        payload['gas'] = c.w3.eth.estimate_gas(payload) * 12 // 10
        tx_hash = c.w3.eth.send_transaction(payload)
        receipt = c.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60, poll_latency=.1)
        if receipt.status != 1:
            raise ValueError('Transaction reverted')
    except Exception:
        service.job(action, 'rejected', message='Local transaction rejected')
        raise
    service.job(action, 'confirmed', hx(tx_hash))
    result = dict(hash=hx(tx_hash), blockNumber=receipt.blockNumber, status=receipt.status, gasUsed=str(receipt.gasUsed))
    try:
        service.sync(force=True)
    except Exception:
        service.last_sync = 0
        result['indexWarning'] = 'Transaction confirmed; index refresh pending'
    return result

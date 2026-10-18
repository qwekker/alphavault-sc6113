"""Only RPC-verified, canonical business receipts count as evidence."""
import json
import re
from datetime import datetime, timezone
from web3.exceptions import TransactionNotFound
from .chain import hx

KINDS = {'PortfolioVault': ['deposit', 'redeem', 'setAutomation', 'rebalance'],
         'StrategyEngine': ['selectStrategy', 'configure', 'setEnabled'],
         'RiskManager': ['updateMarket', 'setAssetEnabled', 'setLimits', 'setPaused', 'setRole'],
         'MockERC20': ['approve']}


def receipt_evidence(chain, tx_hash):
    if not isinstance(tx_hash, str) or not re.fullmatch(r'0x[\da-fA-F]{64}', tx_hash):
        raise ValueError('Invalid transaction hash')
    w3, m = chain.w3, chain.manifest
    try:
        tx = w3.eth.get_transaction(tx_hash)
        receipt = w3.eth.get_transaction_receipt(tx_hash)
    except TransactionNotFound:
        return dict(hash=tx_hash, status='pending-or-unknown', chainId=m['chainId'])
    if tx.get('chainId') != m['chainId']:
        raise ValueError('Transaction chain mismatch')
    candidates = dict(chain.contracts, MockERC20=chain.tokens[0])
    match = next(((n, c) for n, c in candidates.items() if tx.to and c.address.lower() == tx.to.lower()), None)
    if not match:
        raise ValueError('Transaction does not target this AlphaVault deployment')
    name, contract = match
    try:
        function, args = contract.decode_function_input(tx.input)
    except (ValueError, TypeError) as exc:
        raise ValueError('Not a supported AlphaVault business transaction') from exc
    method = function.fn_name
    if method not in KINDS.get(name, []):
        raise ValueError('Not a supported AlphaVault business transaction')
    if name == 'MockERC20' and next(iter(args.values())).lower() != chain.vault.address.lower():
        raise ValueError('Approval does not authorize this vault')
    block = w3.eth.get_block(receipt.blockNumber)
    if block.hash != receipt.blockHash:
        raise ValueError('Receipt is no longer canonical')
    gas_price = receipt.effectiveGasPrice
    return dict(chainId=m['chainId'], vault=chain.vault.address, hash=hx(receipt.transactionHash),
                **{'from': receipt['from'], 'to': receipt.to}, contract=name, method=method, kind=name+'.'+method,
                status='confirmed' if receipt.status == 1 else 'reverted', blockNumber=receipt.blockNumber,
                blockHash=hx(receipt.blockHash), timestamp=block.timestamp,
                confirmations=max(0, w3.eth.block_number-receipt.blockNumber+1), gasUsed=str(receipt.gasUsed),
                effectiveGasPrice=str(gas_price), feeWei=str(receipt.gasUsed*gas_price),
                explorerUrl='https://sepolia.etherscan.io/tx/'+hx(receipt.transactionHash) if m['chainId'] == 11155111 else None)


def remember(service, tx_hash):
    evidence = receipt_evidence(service.chain, tx_hash)
    if evidence['status'] == 'pending-or-unknown':
        raise ValueError('Transaction not yet confirmed; try again later')
    service.store.execute('INSERT INTO receipts VALUES(?,?,?) ON CONFLICT(scope,hash) DO UPDATE SET payload=excluded.payload',
                          (service.scope, tx_hash.lower(), json.dumps(evidence)))
    return evidence


def export_all(service):
    db = service.store
    saved = db.all('SELECT hash FROM receipts WHERE scope=? ORDER BY hash LIMIT 300', (service.scope,))
    total = db.one('SELECT count(*) n FROM receipts WHERE scope=?', (service.scope,))['n']
    receipts, excluded = [], []
    for row in saved:
        try:
            evidence = receipt_evidence(service.chain, row['hash'])
            if evidence['status'] == 'pending-or-unknown':
                excluded.append(dict(hash=row['hash'], reason=evidence['status']))
            else:
                receipts.append(evidence)
        except Exception:
            excluded.append(dict(hash=row['hash'], reason='RPC verification unavailable or receipt no longer valid'))
    completed = {r['kind'] for r in receipts if r['status'] == 'confirmed'}
    return dict(generatedAt=datetime.now(timezone.utc).isoformat(), chainId=service.chain.manifest['chainId'],
                vault=service.chain.vault.address, source='RPC-verified transactions submitted to this deployment',
                totalSaved=total, exportLimit=300, truncated=total > 300,
                finality='Canonical at export time; confirmations are reported, not a finality guarantee',
                successfulKinds=len(completed), minimumTenKindsMet=len(completed) >= 10,
                coverage=[dict(kind=n+'.'+method, completed=n+'.'+method in completed) for n, methods in KINDS.items() for method in methods],
                receipts=receipts, excluded=excluded)


def bootstrap(service, seed):
    m = service.chain.manifest
    if seed.get('chainId') != m['chainId'] or seed.get('vault', '').lower() != service.chain.vault.address.lower():
        raise ValueError('Receipt seed deployment mismatch')
    hashes = seed.get('hashes')
    if not isinstance(hashes, list) or len(hashes) > 300 or any(not isinstance(h, str) or not re.fullmatch(r'0x[\da-fA-F]{64}', h) for h in hashes):
        raise ValueError('Invalid receipt seed hashes')
    imported = skipped = 0
    for tx_hash in sorted({h.lower() for h in hashes}):
        if service.store.one('SELECT 1 FROM receipts WHERE scope=? AND hash=?', (service.scope, tx_hash)):
            skipped += 1
        else:
            remember(service, tx_hash)
            imported += 1
    return dict(imported=imported, skipped=skipped)

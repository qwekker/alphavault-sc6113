"""Web3.py contract attachment and validation. Public requests never hold a key."""
import json
from pathlib import Path
from web3 import Web3

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('RiskManager', 'StrategyEngine', 'PortfolioVault', 'MockExchange', 'MockERC20')


def hx(value):
    return Web3.to_hex(value)


class Chain:
    def __init__(self, rpc_url, manifest, verify=True):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 20}))
        self.manifest = manifest
        self.artifacts = {n: json.loads((ROOT/'artifacts'/f'{n}.json').read_text()) for n in NAMES}
        self.contracts = {n: self.w3.eth.contract(address=Web3.to_checksum_address(a), abi=self.artifacts[n]['abi'])
                          for n, a in manifest['contracts'].items()}
        self.tokens = [self.w3.eth.contract(address=Web3.to_checksum_address(a['address']),
                                           abi=self.artifacts['MockERC20']['abi']) for a in manifest['assets']]
        self.vault, self.risk, self.strategy = [self.contracts[n] for n in ('PortfolioVault', 'RiskManager', 'StrategyEngine')]
        if verify:
            self.verify()

    def verify(self):
        m = self.manifest
        if type(m['chainId']) is not int or m['chainId'] not in (31337, 11155111):
            raise ValueError('Unsupported chain ID')
        if self.w3.eth.chain_id != m['chainId']:
            raise ValueError('Chain mismatch')
        if type(m['deploymentBlock']) is not int or m['deploymentBlock'] < 0:
            raise ValueError('Invalid deployment block')
        addresses = [m['contracts'][n] for n in ('PortfolioVault', 'StrategyEngine', 'RiskManager', 'MockExchange')]
        addresses += [a['address'] for a in m['assets']]
        if len(m['assets']) != 3 or len(set(a.lower() for a in addresses)) != 7:
            raise ValueError('Expected three assets and seven distinct deployed addresses')
        for a in addresses + [m['roles'][r] for r in ('admin', 'investor', 'manager', 'risk', 'keeper')]:
            if not Web3.is_address(a) or int(a, 16) == 0:
                raise ValueError('Invalid deployment address')
        for a in addresses:
            if not self.w3.eth.get_code(Web3.to_checksum_address(a)):
                raise ValueError('Missing deployed contract')
        def same(actual, expected):
            if actual.lower() != expected.lower():
                raise ValueError('Deployment wiring mismatch')
        for name, field, expected in [('PortfolioVault', 'risk', self.risk.address),
                                      ('PortfolioVault', 'strategy', self.strategy.address),
                                      ('PortfolioVault', 'exchange', self.contracts['MockExchange'].address),
                                      ('StrategyEngine', 'risk', self.risk.address),
                                      ('MockExchange', 'risk', self.risk.address),
                                      ('RiskManager', 'admin', m['roles']['admin'])]:
            same(getattr(self.contracts[name].functions, field)().call(), expected)
        for i, token in enumerate(self.tokens):
            same(self.risk.functions.assets(i).call(), token.address)
            same(token.functions.owner().call(), m['roles']['admin'])
            if token.functions.decimals().call() != 18 or m['assets'][i]['decimals'] != 18:
                raise ValueError('Expected 18 decimal mock tokens')
            if token.functions.symbol().call() != m['assets'][i]['symbol']:
                raise ValueError('Token symbol mismatch')

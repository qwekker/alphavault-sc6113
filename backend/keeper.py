"""Optional local demo scheduler; no public signing key is used by Flask."""
import logging
import os
import threading
from .actions import demo_action


def keeper_tick(service, drift_bps=300):
    if service.chain.manifest['chainId'] != 31337:
        raise ValueError('Automatic local Keeper requires chain 31337')
    s = service.sync(force=True)
    if (not s['automationEnabled'] or s['paused'] or s['validationError'] or s['valuationStale']
            or s['navUsd'] <= 0 or s['timestamp'] < s['lastRebalance']+s['cooldown']):
        return dict(status='skipped', reason='Not eligible')
    if max(abs(a-b) for a, b in zip(s['target'], s['weights'])) < drift_bps:
        return dict(status='skipped', reason='Within drift threshold')
    result = demo_action(service, 'rebalance', {'slippage': s['limits']['maxSlippage']}, 'keeper')
    return dict(status='confirmed', hash=result['hash'])


def run_local_keeper(service, stop):
    def loop():
        while not stop.is_set():
            try:
                keeper_tick(service, int(os.environ.get('DRIFT_BPS', '300')))
            except Exception as exc:
                logging.warning('Local Keeper retry: %s', type(exc).__name__)
            stop.wait(10)
    threading.Thread(target=loop, name='local-keeper', daemon=True).start()

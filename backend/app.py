"""Flask REST API and dashboard, served by Gunicorn on Render."""
import atexit
import json
import logging
import os
import threading
import time
from urllib.parse import urlparse
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException
from web3.exceptions import ContractLogicError, Web3RPCError
from .chain import Chain, ROOT
from .store import open_store
from .service import Service
from .actions import build_action, demo_action, number
from .quant import backtest
from . import receipts


def create_app(service=None, *, demo=False, env=None, start_indexer=True):
    env = dict(os.environ if env is None else env)
    if service is None:
        if not env.get('RPC_URL') or not env.get('DEPLOYMENT_FILE'):
            raise ValueError('Set RPC_URL and DEPLOYMENT_FILE, or use python scripts/demo.py')
        manifest = json.loads((ROOT/env['DEPLOYMENT_FILE']).read_text())
        chain = Chain(env['RPC_URL'], manifest)
        if demo and (manifest['chainId'] != 31337 or urlparse(env['RPC_URL']).hostname not in ('localhost', '127.0.0.1', '::1')):
            raise ValueError('Local demo requires a loopback RPC on chain 31337')
        service = Service(chain, open_store(env, ROOT))
        if env.get('RECEIPT_SEED_FILE'):
            receipts.bootstrap(service, json.loads((ROOT/env['RECEIPT_SEED_FILE']).read_text()))
        service.sync(force=True)
        atexit.register(service.store.close)
    if demo and service.chain.manifest['chainId'] != 31337:
        raise ValueError('Demo mode requires chain 31337')
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=12*1024, JSON_SORT_KEYS=False)
    app.json.sort_keys = False
    app.extensions['alphavault'] = service
    demo_lock = threading.Lock()

    @app.after_request
    def headers(response):
        response.headers.update({'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
                                 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"})
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.errorhandler(Exception)
    def error(exc):
        if isinstance(exc, HTTPException):
            return jsonify(error=exc.description), exc.code
        if isinstance(exc, (ValueError, ContractLogicError)):
            return jsonify(error=str(exc)), 400
        if isinstance(exc, Web3RPCError):
            return jsonify(error='Chain rejected the request; check contract state and inputs'), 400
        # Do not leak RPC URLs, credentials or SQL internals into public responses/logs.
        app.logger.error('Request failed: %s', type(exc).__name__)
        return jsonify(error='Chain or database request unavailable; retry after checking service health'), 503

    def body():
        value = request.get_json()
        if not isinstance(value, dict):
            raise ValueError('Expected JSON object')
        return value

    @app.get('/api/health')
    def health():
        try:
            _ = service.chain.w3.eth.block_number
            service.store.one('SELECT 1')
            return jsonify(ok=True, backend='python-flask', database=service.store.kind,
                           mode='local-demo' if demo else 'wallet', chainId=service.chain.manifest['chainId'])
        except Exception:
            return jsonify(ok=False, backend='python-flask', error='Chain or database unavailable'), 503

    @app.get('/api/config')
    def config():
        return jsonify(dict(service.chain.manifest, demo=demo, backend='python-flask',
                            strategies=['Equal Weight', 'Momentum', 'Volatility Target'],
                            disclosures=['Mock prices reported by risk officer', 'Prefunded mock exchange; 20 bp fee',
                                         'Nontransferable shares; in-kind redemption']))

    @app.get('/api/portfolio')
    def portfolio():
        return jsonify(service.sync())

    @app.get('/api/prices')
    def prices():
        return jsonify(service.sync()['assets'])

    @app.get('/api/strategies')
    def strategies():
        s = service.sync()
        return jsonify(selected=s['selected'], enabled=s['strategyEnabled'], target=s['target'],
                       validationError=s['validationError'], cashBuffer=s['cashBuffer'],
                       targetVolatility=s['targetVolatility'], cooldown=s['cooldown'])

    @app.get('/api/history')
    def history():
        limit = number(request.args.get('limit', '50'), 1, 200, 'limit (1..200)')
        service.sync()
        return jsonify(service.history(limit))

    @app.get('/api/snapshots')
    def snapshots():
        service.sync()
        return jsonify(service.snapshots())

    @app.get('/api/account/<address>')
    def account(address):
        return jsonify(service.account(address))

    @app.get('/api/backtests/<strategy>')
    def research(strategy):
        strategy = number(strategy, 0, 2, 'strategy (0..2)')
        result = backtest(strategy)
        service.store.execute('INSERT INTO backtests VALUES(?,?,?,?) ON CONFLICT(strategy) DO UPDATE SET created_at=excluded.created_at,source=excluded.source,result=excluded.result',
                              (strategy, int(time.time()*1000), result['source'], json.dumps(result)))
        return jsonify(result)

    @app.get('/api/jobs')
    def jobs():
        return jsonify(service.store.all('SELECT * FROM jobs WHERE scope=? ORDER BY id DESC LIMIT 50', (service.scope,)))

    @app.post('/api/transactions/build')
    def build():
        data = body()
        return jsonify(build_action(service.chain, data.get('action'), data.get('args')))

    @app.post('/api/receipts')
    def remember():
        return jsonify(receipts.remember(service, body().get('hash')))

    @app.get('/api/evidence')
    def evidence():
        return jsonify(receipts.export_all(service))

    @app.post('/api/demo/action')
    def local_action():
        if not demo:
            return jsonify(error='Demo signing disabled; use your wallet'), 403
        if urlparse(request.host_url).hostname not in ('localhost', '127.0.0.1', '::1'):
            return jsonify(error='Local Host required'), 403
        if request.remote_addr not in ('127.0.0.1', '::1', '::ffff:127.0.0.1'):
            return jsonify(error='Loopback only'), 403
        if request.headers.get('Origin') not in (None, 'http://'+request.host):
            return jsonify(error='Cross-origin action rejected'), 403
        if request.headers.get('X-AlphaVault-Demo') != '1':
            return jsonify(error='Explicit demo header required'), 403
        if not demo_lock.acquire(blocking=False):
            return jsonify(error='Another transaction is pending'), 409
        try:
            data = body()
            return jsonify(demo_action(service, data.get('action'), data.get('args'), data.get('role')))
        finally:
            demo_lock.release()

    @app.get('/api/setup/artifacts')
    def artifacts():
        if not demo:
            return jsonify(error='Unknown API route'), 404
        return jsonify(service.chain.artifacts)

    @app.route('/api/<path:unused>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    def unknown(unused):
        return jsonify(error='Unknown API route'), 404

    @app.get('/vendor/ethers.js')
    def ethers():
        directory = ROOT/'public/vendor'
        if not (directory/'ethers.js').exists():
            return send_from_directory(ROOT/'node_modules/ethers/dist', 'ethers.min.js')
        return send_from_directory(directory, 'ethers.js')

    @app.get('/')
    @app.get('/<path:filename>')
    def static(filename='index.html'):
        return send_from_directory(ROOT/'public', filename)

    if start_indexer:
        stop = threading.Event()
        interval = max(5, int(env.get('INDEX_INTERVAL_MS', '60000'))/1000)
        def index_loop():
            while not stop.wait(interval):
                try:
                    service.sync(force=True)
                except Exception as exc:
                    app.logger.warning('Indexer retry scheduled: %s', type(exc).__name__)
        threading.Thread(target=index_loop, name='alphavault-indexer', daemon=True).start()
        app.extensions['alphavault_stop'] = stop
        atexit.register(stop.set)
    return app

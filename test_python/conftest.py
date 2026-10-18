import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
import pytest
from backend.chain import Chain, ROOT
from backend.service import Service
from backend.store import Store
from backend.app import create_app


@pytest.fixture(scope='session')
def chain(tmp_path_factory):
    folder = tmp_path_factory.mktemp('evm')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    log = (folder/'chain.log').open('w')
    node = os.environ.get('NODE_BINARY') or shutil.which('node')
    proc = subprocess.Popen([node, 'scripts/local-chain.mjs'], cwd=ROOT,
                            env=dict(os.environ, DATA_DIR=str(folder), RPC_PORT=str(port)), stdout=log, stderr=log)
    try:
        for _ in range(600):
            if (folder/'deployment.json').exists():
                break
            if proc.poll() is not None:
                pytest.fail('Ganache failed: '+(folder/'chain.log').read_text())
            time.sleep(.1)
        else:
            pytest.fail('Ganache startup timeout')
        yield Chain(f'http://127.0.0.1:{port}', json.loads((folder/'deployment.json').read_text()))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        log.close()


@pytest.fixture
def service(chain, tmp_path):
    snapshot = chain.w3.provider.make_request('evm_snapshot', [])['result']
    store = Store(str(tmp_path/'state.sqlite'))
    s = Service(chain, store)
    yield s
    store.close()
    chain.w3.provider.make_request('evm_revert', [snapshot])


@pytest.fixture
def client(service):
    return create_app(service, demo=True, start_indexer=False).test_client()


@pytest.fixture
def action(client):
    def call(name, args, role):
        r = client.post('/api/demo/action', json=dict(action=name, args=args, role=role), headers={'X-AlphaVault-Demo':'1'})
        assert r.status_code == 200, r.json
        return r.json
    return call

"""Start disposable local EVM + Flask. Use a separate DATA_DIR for isolated demos."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    node = os.environ.get('NODE_BINARY') or shutil.which('node')
    if not node:
        raise SystemExit('Install Node.js 22.13+ for Ganache and contract compilation')
    directory = Path(os.environ.get('DATA_DIR', ROOT/'data/flask-local')).resolve()
    rpc_port = int(os.environ.get('RPC_PORT', '18547'))
    env = dict(os.environ, DATA_DIR=str(directory), RPC_PORT=str(rpc_port))
    chain = subprocess.Popen([node, 'scripts/local-chain.mjs'], cwd=ROOT, env=env,
                             stdout=subprocess.PIPE, text=True)
    try:
        for line in chain.stdout:
            print(line.rstrip(), flush=True)
            if line.startswith('CHAIN_READY '):
                break
        else:
            raise SystemExit('Local chain failed to start')
        from backend.app import create_app
        # Local demo must never accidentally attach the hosted database or receipt seed.
        local = {'RPC_URL': f'http://127.0.0.1:{rpc_port}', 'DEPLOYMENT_FILE': str(directory/'deployment.json'),
                 'DB_PATH': str(directory/'alphavault.sqlite'), 'INDEX_INTERVAL_MS': '10000'}
        app = create_app(demo=True, env=local)
        if os.environ.get('AUTO_KEEPER') == '1':
            from backend.keeper import run_local_keeper
            run_local_keeper(app.extensions['alphavault'], app.extensions['alphavault_stop'])
        port = int(os.environ.get('PORT', '3100'))
        print(f'AlphaVault Flask: http://127.0.0.1:{port}', flush=True)
        app.run(host='127.0.0.1', port=port, use_reloader=False, debug=False)
    finally:
        chain.terminate()
        try:
            chain.wait(timeout=10)
        except subprocess.TimeoutExpired:
            chain.kill()


if __name__ == '__main__':
    main()

# Deployment

The active backend is Python Flask with Web3.py, served by Gunicorn. Solidity contracts remain unchanged on Sepolia.

## Local software demonstration

Use Python 3.12 and Node.js 22.13+:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
npm ci
npm run compile
python scripts/demo.py
```

Open http://127.0.0.1:3100. Ganache runs at http://127.0.0.1:18547 on chain 31337. The persistent local chain and SQLite database are in data/flask-local. Use independent PORT, RPC_PORT and DATA_DIR values for a separate rehearsal. AUTO_KEEPER=1 enables the local Keeper loop. Public test accounts are only for the loopback chain.

## Public Render service

URL: https://alphavault-sepolia.onrender.com

Render builds Dockerfile in two stages: Node compiles Solidity, then Python 3.12 runs Flask/Gunicorn. The runtime contains no Node HTTP server. Use one Gunicorn worker with four threads so a shared lock serializes the index cursor. render.yaml defines the free service. Existing Supabase PostgreSQL data remains in the private alphavault schema.

Environment variables:

- RPC_URL: Sepolia JSON-RPC endpoint, saved as a Render secret if it contains a provider key.
- DEPLOYMENT_FILE: /app/config/sepolia-deployment.json
- RECEIPT_SEED_FILE: /app/config/sepolia-receipts.json
- DATABASE_URL: existing Supabase Session pooler connection string, stored privately.
- DATABASE_REQUIRED: postgres (refuses ephemeral SQLite).
- HOST: 0.0.0.0
- PORT: 10000 (or Render's assigned port).
- INDEX_INTERVAL_MS: 60000

PostgreSQL connections verify the TLS certificate and hostname. Supabase uses config/supabase-ca.crt. A custom provider can set DATABASE_CA_FILE or DATABASE_CA_CERT. URL query parameters cannot disable verification. Never submit the database password or a private key.

To update, push a tested commit to the public repository and deploy that commit in Render. Blueprint configuration changes may trigger a deployment. Confirm /api/health reports ok=true, backend=python-flask, database=postgres, mode=wallet and chainId=11155111. Check /api/config against the saved manifest, inspect /api/portfolio, and compare /api/jobs and /api/evidence with prior records. /api/demo/action must return 403 publicly.

The current Flask acceptance is saved in evidence/flask-hosted-acceptance.json. It verifies all read endpoints, unsigned transaction preparation, public signing rejection and retention of the existing non-chain jobs record. No Sepolia transactions were sent by this migration.

## Tests and source artifacts

Run python -m pytest -v for Python API/integration tests and npm test for contract/legacy regression tests. npm run compile regenerates artifacts/*.json, abi/*.abi and public/vendor/ethers.js. The standalone ABI files are JSON arrays for integration tools. Wallet-only local execution is python app.py after configuring .env.sepolia.local; production uses gunicorn --config gunicorn.conf.py 'app:create_app()'.

The server never loads public-wallet signing keys. MetaMask confirms and submits public writes. Explorer source verification remains a separate, unfinished step. Mock prices, tokens and the exchange remain demonstration infrastructure.

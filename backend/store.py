"""SQLite and PostgreSQL persistence with the existing AlphaVault schema."""
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse, unquote

TABLES = {
    'events': 'scope TEXT,tx_hash TEXT,log_index INTEGER,block_number INTEGER,block_hash TEXT,contract TEXT,name TEXT,payload TEXT,PRIMARY KEY(scope,tx_hash,log_index)',
    'snapshots': 'scope TEXT,block_number INTEGER,block_hash TEXT,timestamp BIGINT,nav TEXT,supply TEXT,share_index DOUBLE PRECISION,weights TEXT,PRIMARY KEY(scope,block_number)',
    'prices': 'scope TEXT,asset TEXT,block_number INTEGER,price TEXT,volatility INTEGER,momentum INTEGER,updated_at BIGINT,PRIMARY KEY(scope,asset,block_number)',
    'strategies': 'scope TEXT,block_number INTEGER,selected INTEGER,weights TEXT,config TEXT,PRIMARY KEY(scope,block_number)',
    'jobs': 'id INTEGER PRIMARY KEY,scope TEXT,created_at BIGINT,kind TEXT,status TEXT,tx_hash TEXT,message TEXT',
    'backtests': 'strategy INTEGER PRIMARY KEY,created_at BIGINT,source TEXT,result TEXT',
    'cursors': 'scope TEXT PRIMARY KEY,block_number INTEGER,block_hash TEXT',
    'receipts': 'scope TEXT,hash TEXT,payload TEXT,PRIMARY KEY(scope,hash)',
}


class Store:
    def __init__(self, filename=':memory:', database_url=None, ca_file=None):
        self.lock = threading.RLock()
        self.kind = 'postgres' if database_url else 'sqlite'
        if database_url:
            from psycopg_pool import ConnectionPool
            from psycopg.rows import dict_row
            u = urlparse(database_url)
            if u.scheme not in ('postgres', 'postgresql') or not u.hostname or not u.username or not u.password:
                raise ValueError('DATABASE_URL requires PostgreSQL host, username and password')
            # URL query parameters cannot override mandatory TLS verification.
            kwargs = dict(host=u.hostname, port=u.port or 5432, user=unquote(u.username),
                          password=unquote(u.password), dbname=unquote(u.path[1:] or 'postgres'),
                          sslmode='verify-full', connect_timeout=15, row_factory=dict_row,
                          options='-c search_path=alphavault -c statement_timeout=20000')
            if ca_file:
                kwargs['sslrootcert'] = str(ca_file)
            else:
                kwargs['sslrootcert'] = 'system'
            self.pool = ConnectionPool(kwargs=kwargs, min_size=1, max_size=3, timeout=20, open=True)
            self.pool.wait(timeout=25)
        else:
            if filename != ':memory:':
                Path(filename).parent.mkdir(parents=True, exist_ok=True)
            self.connection = sqlite3.connect(filename, check_same_thread=False)
            self.connection.row_factory = sqlite3.Row
            self.connection.execute('PRAGMA journal_mode=WAL')
        with self.session() as conn:
            if database_url:
                conn.execute('CREATE SCHEMA IF NOT EXISTS alphavault')
                conn.execute('REVOKE ALL ON SCHEMA alphavault FROM PUBLIC')
            for name, definition in TABLES.items():
                if database_url and name == 'jobs':
                    definition = definition.replace('id INTEGER PRIMARY KEY', 'id BIGSERIAL PRIMARY KEY')
                conn.execute(f'CREATE TABLE IF NOT EXISTS {name}({definition})')
                if database_url:
                    conn.execute(f'ALTER TABLE {name} ENABLE ROW LEVEL SECURITY')

    @contextmanager
    def session(self):
        if self.kind == 'postgres':
            with self.pool.connection() as conn:
                with conn.transaction():
                    yield conn
        else:
            with self.lock, self.connection:
                yield self.connection

    def sql(self, query):
        # Queries are constants in backend code. Values are bound separately.
        return query.replace('?', '%s') if self.kind == 'postgres' else query

    def all(self, query, params=()):
        with self.session() as conn:
            return [dict(row) for row in conn.execute(self.sql(query), params).fetchall()]

    def one(self, query, params=()):
        rows = self.all(query, params)
        return rows[0] if rows else None

    def execute(self, query, params=()):
        self.batch([(query, params)])

    def batch(self, statements):
        with self.session() as conn:
            for query, values in statements:
                conn.execute(self.sql(query), values)

    def close(self):
        if self.kind == 'postgres':
            self.pool.close()
        else:
            self.connection.close()


def open_store(env, root):
    url = env.get('DATABASE_URL')
    if not url and env.get('DATABASE_REQUIRED') == 'postgres':
        raise ValueError('DATABASE_URL required; refusing ephemeral SQLite on public hosting')
    ca = env.get('DATABASE_CA_FILE')
    if url and not ca:
        host = urlparse(url).hostname or ''
        if host.endswith(('.pooler.supabase.com', '.supabase.co')):
            ca = root/'config/supabase-ca.crt'
    if env.get('DATABASE_CA_CERT'):
        ca = Path(env.get('DB_PATH', str(root/'data/hosted.sqlite'))).parent/'database-ca.crt'
        ca.parent.mkdir(parents=True, exist_ok=True)
        ca.write_text(env['DATABASE_CA_CERT'].replace('\\n', '\n'))
        os.chmod(ca, 0o600)
    return Store(env.get('DB_PATH', str(root/'data/hosted.sqlite')), url, ca)

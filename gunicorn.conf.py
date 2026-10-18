import os

bind = f"{os.environ.get('HOST', '0.0.0.0')}:{os.environ.get('PORT', '3100')}"
# One worker owns the index cursor. Threads share a lock and a small SQL pool.
workers = 1
threads = 4
timeout = 180
graceful_timeout = 30
accesslog = '-'
errorlog = '-'

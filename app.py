"""WSGI entry point: gunicorn 'app:create_app()'."""
from backend.app import create_app

if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    load_dotenv('.env.sepolia.local')
    create_app().run(host=os.environ.get('HOST', '127.0.0.1'), port=int(os.environ.get('PORT', '3100')), debug=False)

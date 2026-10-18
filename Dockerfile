FROM node:22-bookworm-slim AS contracts
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY contracts ./contracts
COPY scripts/compile.mjs ./scripts/compile.mjs
RUN node scripts/compile.mjs

FROM python:3.12-slim-bookworm
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY app.py gunicorn.conf.py ./
COPY public ./public
COPY config ./config
COPY --from=contracts /build/artifacts ./artifacts
COPY --from=contracts /build/abi ./abi
COPY --from=contracts /build/public/vendor ./public/vendor
RUN useradd --create-home appuser && mkdir -p /app/data && chown -R appuser:appuser /app/data
ENV HOST=0.0.0.0 PORT=3100 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER appuser
EXPOSE 3100
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:create_app()"]

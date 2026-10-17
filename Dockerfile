FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY contracts ./contracts
COPY scripts ./scripts
COPY server ./server
COPY public ./public
COPY config ./config
RUN npm run compile && npm prune --omit=dev --no-audit --no-fund && mkdir -p /app/data /app/config && chown -R node:node /app/data /app/config
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
USER node
EXPOSE 3100
CMD ["npm","start"]

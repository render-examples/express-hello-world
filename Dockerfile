FROM node:20.15.1-alpine3.19 AS deps

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node package.json yarn.lock ./
RUN corepack enable \
	&& yarn install --frozen-lockfile --production=true \
	&& yarn cache clean --all

FROM node:20.15.1-alpine3.19 AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

EXPOSE 3001

USER node

CMD ["node", "app.js"]

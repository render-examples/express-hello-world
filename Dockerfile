FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true

COPY . .

EXPOSE 3001

CMD ["yarn", "start"]
FROM node:20-alpine
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

COPY . .
EXPOSE 3001
CMD ["node", "app.js"]

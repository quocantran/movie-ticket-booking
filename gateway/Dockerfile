# API Gateway — Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

COPY gateway ./gateway
COPY libs ./libs

RUN npm install
RUN npx nest build gateway

EXPOSE 8080

CMD ["node", "dist/gateway/main.js"]

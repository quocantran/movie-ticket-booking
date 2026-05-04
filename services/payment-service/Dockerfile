# Payment Service — Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

COPY services/payment-service ./services/payment-service
COPY libs ./libs

RUN npm install
RUN npx nest build payment-service

EXPOSE 5004

CMD ["node", "dist/services/payment-service/main.js"]

# Auth Service — Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

COPY services/auth-service ./services/auth-service
COPY libs ./libs

RUN npm install
RUN npx nest build auth-service

EXPOSE 5005

CMD ["node", "dist/services/auth-service/main.js"]

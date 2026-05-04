# Seat Service — Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

COPY services/seat-service ./services/seat-service
COPY libs ./libs

RUN npm install
RUN npx nest build seat-service

EXPOSE 5002

CMD ["node", "dist/services/seat-service/main.js"]

# Movie Service — Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

COPY services/movie-service ./services/movie-service
COPY libs ./libs

RUN npm install
RUN npx nest build movie-service

EXPOSE 5003

CMD ["node", "dist/services/movie-service/main.js"]

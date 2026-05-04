# AI Recommender Service — Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Copy service source
COPY services/ai-recommender-service ./services/ai-recommender-service

# Copy shared library
COPY libs ./libs

# Install dependencies
RUN npm install

# Build the service
RUN npx nest build ai-recommender-service

# Expose port
EXPOSE 5006

# Start the service
CMD ["node", "dist/services/ai-recommender-service/main.js"]

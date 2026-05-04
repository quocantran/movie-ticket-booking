# Booking Service — Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Copy service source
COPY services/booking-service ./services/booking-service

# Copy shared library
COPY libs ./libs

# Install dependencies
RUN npm install

# Build the service
RUN npx nest build booking-service

# Expose port
EXPOSE 5001

# Start the service
CMD ["node", "dist/services/booking-service/main.js"]

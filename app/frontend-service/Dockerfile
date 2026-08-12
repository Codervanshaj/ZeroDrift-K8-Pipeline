# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js instrumentation.js ./

# Git identity injection
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
ARG SERVICE_NAME=frontend-service

LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.created=$BUILD_TIME

ENV GIT_COMMIT=$GIT_COMMIT \
    BUILD_TIME=$BUILD_TIME \
    SERVICE_NAME=$SERVICE_NAME

EXPOSE 8080

CMD ["node", "--require", "./instrumentation.js", "server.js"]

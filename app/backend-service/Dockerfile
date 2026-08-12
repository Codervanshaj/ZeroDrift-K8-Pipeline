FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

# Git identity injection
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
ARG SERVICE_NAME=backend-service

LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.created=$BUILD_TIME

ENV GIT_COMMIT=$GIT_COMMIT \
    BUILD_TIME=$BUILD_TIME \
    SERVICE_NAME=$SERVICE_NAME

EXPOSE 3000

CMD ["node", "--require", "./instrumentation.js", "server.js"]

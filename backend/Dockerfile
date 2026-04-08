FROM ubuntu:22.04 AS ctf-image

RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    curl wget \
    netcat-openbsd \
    xxd bsdmainutils \
    binutils \
    file \
    zip unzip \
    tar \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash ctf
WORKDIR /home/ctf

FROM node:18-alpine AS backend-runtime

WORKDIR /app
RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8080

ENV CTF_IMAGE=ctf-terminal:latest
CMD ["node", "server.js"]
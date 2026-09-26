FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:server
ENV NODE_ENV=production PORT=3001 BLAZE_DATA_DIR=/data BLAZE_PROJECTS_FILE=/data/projects.json
VOLUME /data
EXPOSE 3001
CMD ["node", "dist/server/src/server.js"]

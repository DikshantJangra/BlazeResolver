FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
# Fix engine: repos' tests run AI-written code as this unprivileged user, which can't read the server's
# environment (its keys and token) or /data. The server stays root so it can start tests as this user.
RUN useradd --system --no-create-home --shell /usr/sbin/nologin blaze-sandbox && mkdir -p /data && chmod 700 /data
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:server
ENV NODE_ENV=production PORT=3001 BLAZE_DATA_DIR=/data BLAZE_PROJECTS_FILE=/data/projects.json BLAZE_SANDBOX_USER=blaze-sandbox
VOLUME /data
EXPOSE 3001
CMD ["node", "dist/server/src/server.js"]

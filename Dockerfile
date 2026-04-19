FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist/ dist/
COPY .aide/ .aide/
ENTRYPOINT ["node", "dist/index.js"]

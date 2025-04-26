# Dépendances minimales + Puppeteer
FROM node:20-slim

# Install required system libraries for Chromium
RUN apt-get update && apt-get install -y \
        ca-certificates fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 \
        libcairo2 libdrm2 libgbm1 libgtk-3-0 libx11-xcb1 libxcomposite1 \
        libxdamage1 libxext6 libxfixes3 libxrandr2 libxss1 libasound2 \
        libpango-1.0-0 libpangocairo-1.0-0 wget && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Use this command if "package-lock.json" is not present
# RUN npm install --omit=dev
# Otherwise, use this command:
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD [ "npm", "start" ]

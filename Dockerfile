FROM node:20-bullseye

# Install dependencies required by Puppeteer/Chromium (Remotion)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxss1 \
    libgbm1 \
    libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Pre-compile the Remotion bundle during the Docker build!
# This prevents Render's free tier from running out of memory and freezing at 5% during export.
RUN npx tsx scripts/build-bundle.ts

# Expose port
EXPOSE 3001

# Start the Express server using tsx
CMD ["npx", "tsx", "server/index.ts"]

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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build Next.js just in case it's needed for shared dependencies, though not strictly required for the backend
# Actually we only need the backend, but Remotion relies on src/remotion/index.ts
# so having the full source is fine.

# Expose port
EXPOSE 3001

# Start the Express server using tsx
CMD ["npx", "tsx", "server/index.ts"]

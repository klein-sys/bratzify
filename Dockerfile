FROM node:20-bookworm

# Install dependencies required by Chrome Headless Shell
RUN apt-get update && apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Download the Remotion browser during the Docker build so it doesn't hang downloading it at runtime!
RUN npx --yes -p @remotion/cli@4.0.519 remotion browser ensure

# Copy source code
COPY . .

# Pre-compile the Remotion bundle during the Docker build!
RUN npx tsx scripts/build-bundle.ts

# Expose port
EXPOSE 3001

# Start the Express server using tsx
CMD ["npx", "tsx", "server/index.ts"]

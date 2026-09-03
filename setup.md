# Bratzify.fm Setup Guide

This guide explains how to set up, run, and deploy the Bratzify.fm architecture. The project is split into a **static Next.js frontend** and an **Express.js rendering backend**.

## Architecture Overview
- **Frontend (Vercel)**: A static Next.js export that provides the UI and the Remotion Player preview.
- **Backend (Render)**: A Node.js/Express server that receives export requests, spawns a headless Chrome browser to render the Remotion video, and uploads the `.mp4` to Vercel Blob.

---

## 1. Local Development Setup

### Prerequisites
- Node.js 20+
- A Vercel Blob storage token (`BLOB_READ_WRITE_TOKEN`) for uploading final videos (optional for local dev, as it saves to `/public/out` by default).

### Installation
1. Clone the repository.
2. Install dependencies for the root (Frontend):
   ```bash
   npm install
   ```
3. Install dependencies for the server (Backend):
   ```bash
   cd server
   npm install
   cd ..
   ```

### Running Locally
To run both the Next.js frontend (Port 3000) and the Express backend (Port 3001) simultaneously:
```bash
npm run dev
```
*(This triggers `concurrently` to run both `next dev` and `tsx server/index.ts`)*.

---

## 2. Cloud Deployment

### A. Frontend (Vercel)
The frontend is hosted as a **static export** on Vercel. 
1. Link your GitHub repository to a new Vercel project.
2. **Framework Preset**: Next.js
3. **Build Command**: `npm run build`
4. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: Set this to your Render backend URL (e.g., `https://bratzify.onrender.com`).
5. **Important**: Because the app relies on an external API for heavy lifting, the `next.config.ts` is configured with `output: "export"` to build purely static HTML/CSS/JS.

**Live Link**: [https://bratzify.vercel.app](https://bratzify.vercel.app)

### B. Backend (Render)
The backend is hosted on Render using a Docker container to ensure Chrome dependencies are perfectly met.
1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. **Environment**: Docker (Render will automatically detect the `Dockerfile` in the root).
4. **Environment Variables**:
   - `BLOB_READ_WRITE_TOKEN`: Your Vercel Blob token (required to upload the final video).
   - `NODE_ENV`: `production`

#### Why Docker?
Remotion requires a headless Chrome browser to render videos. The `Dockerfile` specifically uses `node:20-bookworm` (Debian 12) because it contains the exact `glibc` versions required by modern Chromium. It also pre-installs necessary graphical libraries (like `libxkbcommon-dev`) and pre-downloads the Chrome binary during the build phase to prevent runtime timeouts.

**Live Link**: [https://bratzify.onrender.com](https://bratzify.onrender.com) *(Note: Visiting this in a browser will return `Cannot GET /` because it is an API-only server, this is expected behavior).*

---

## 3. Troubleshooting

- **10% Export Hang**: Ensure the Render deployment successfully ran the `browser ensure` step in the Dockerfile.
- **NaN% Progress Crash**: This means the Render server ran out of memory (OOM). Ensure `concurrency: 1` is strictly maintained in `server/index.ts` to prevent multiple Chrome tabs from crashing the 512MB free tier.

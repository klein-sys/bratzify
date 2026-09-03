# Project Status & Updates: Bratzify.fm

## Current Goal
Fix Vercel deployment by extracting heavy Remotion rendering tasks from Next.js API routes into a standalone Express.js backend. The Next.js frontend will be converted into a static export (`output: 'export'`) to host on Vercel.

## 1. Identified Architecture Issues
- **Problem**: The app currently uses `@remotion/renderer` inside `src/app/api/render/route.ts`. 
- **Why it fails on Vercel**: Vercel Serverless functions freeze as soon as the HTTP response is returned, instantly killing the background rendering task. Furthermore, the 50MB function size limit prevents headless Chromium (required by Remotion) from running.

## 2. Completed Implementation Steps (Sept 3, 2026)

All the following steps were successfully implemented and deployed.

### A. Next.js Frontend (Deployed on Vercel)
- Update `next.config.ts` to `output: 'export'`.
- Remove the `src/app/api` directory entirely.
- Update `src/app/page.tsx` to communicate with the Express backend using a new environment variable `NEXT_PUBLIC_API_URL` instead of relative paths.
- Keep `src/remotion` in the Next.js app to preserve live preview via `@remotion/player`.

### B. Dedicated Express.js Backend (Deployed on Render)
- Created a `server/index.ts` file running an Express.js app.
- Initialize `server/package.json` with dependencies for Express, CORS, Multer, `@remotion/bundler`, and `@remotion/renderer`.
- Migrate `/api/render` and `/api/progress` into `server/index.ts`.
- **100MB File Limit**: Migrate `/api/upload/blob` logic to the Express server using Multer + `@vercel/blob`, ensuring the 100MB max file size is strictly preserved.
- Use port `3001` for local Express development.
- Updated the root `package.json` with a script (`npm run dev`) to launch both Next.js (`:3000`) and Express (`:3001`) simultaneously.
- Created a `Dockerfile` for seamless cloud deployment.

## 3. Live Environments
- **Frontend**: Hosted on Vercel (`https://bratzify.vercel.app`)
- **Backend**: Hosted on Render (`https://bratzify.onrender.com`)
- **Environment Variables**:
  - Render contains `BLOB_READ_WRITE_TOKEN`
  - Vercel contains `NEXT_PUBLIC_API_URL` pointing to the Render instance.

## 4. Planned UX & Codebase Improvements
Once the core deployment is fixed, the following enhancements should be implemented:
1. **Server-Sent Events (SSE) or WebSockets**: Replace the 1-second polling interval in `src/app/page.tsx` with SSE to receive real-time render progress from the Express backend efficiently.
2. **Auto-Sync Reliability**: Add debouncing and robust error-handling for the `lrclib.net` API to prevent search failures caused by aggressive typing or rate limits.

## 4. Agents Learning (Permanent Rule)
We must never attempt to run `@remotion/renderer` inside a standard Vercel API Route. Always separate heavy video rendering logic into a long-running Node.js server or use `@remotion/lambda`.

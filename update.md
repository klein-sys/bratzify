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

### C. Cloud Deployment Hotfixes (Post-Launch)
- **Vercel Blob Client Fix**: Rewrote `AudioUploader` and `BackgroundMediaUploader` to use native `FormData` POST requests to the Express `/api/upload` route, bypassing Vercel's Blob Client SDK which was failing due to the deleted Next.js API routes.
- **Render OOM Fix (NAN%)**: Render's 512MB free tier crashed during runtime Webpack bundling. Created a custom `scripts/build-bundle.ts` script to pre-compile the Remotion bundle during the Docker image build phase, skipping the heavy bundling step at runtime.
- **Chromium OS Dependencies (10% Hang)**: Fixed `Failed to launch browser process` by upgrading the Docker base image to `node:20-bookworm` (Debian 12), fulfilling Remotion's strict `glibc 2.35+` requirement, and installing all recommended `libxkbcommon-dev` and associated Chrome libraries.
- **Chromium Download Timeout (10% Hang)**: Downloading a 200MB Chrome binary at runtime on a 0.1 CPU Render free-tier takes too long and freezes the export. Fixed by pre-downloading Chrome during the Docker build using `npx -p @remotion/cli@4.0.519 remotion browser ensure`.
- **Runtime OOM Crash (NAN%)**: If the progress bar disappears and shows `NAN%` halfway through, it means the server exceeded its 512MB RAM limit and crashed. Fixed by hardcoding `concurrency: 1` in `server/index.ts` to guarantee Remotion only spawns a single Chrome tab at a time.

### D. Frontend UI Improvements
- **Mobile Zooming Bug**: Added `viewport` export to `layout.tsx` (`maximum-scale=1`, `user-scalable=0`) to prevent iOS Safari from automatically zooming in and breaking the UI when users tap input fields or buttons.
- **Responsive Mobile Layout**: Refactored `page.tsx` DOM ordering on mobile to ensure the Title and 'Start Over' buttons appear before the video preview, and scaled down the video preview's max-height to prevent it from eating the entire mobile screen.

### E. Final Codebase Audit
- **TypeScript Integrity**: Added a strict `tsconfig.json` to the `server/` directory enabling `esModuleInterop`. This resolved 100+ hidden module resolution errors in the backend IDE environment, guaranteeing 100% type safety.
- **Frontend Build**: Ran `npm run build` locally, successfully verifying 0 static generation errors and 0 ESLint warnings in the Next.js export.

### F. New Features (Sept 3, 2026)
- **Gemini AI Auto-Sync**: Added a new AI sync feature using Gemini 3.7 Flash. 
  - Integrated `@google/genai` on the backend to upload the audio track directly to the Gemini API.
  - Implemented a structured output JSON schema (via Zod/Schema) to force Gemini to return exactly timestamped lyrics natively.
  - Added a "✨ AI Sync (Gemini)" button in the frontend `LyricSyncEditor.tsx` for songs that aren't on `lrclib.net`.

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

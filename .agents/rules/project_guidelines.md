# Bratzify Project Guidelines

## Tech Stack
- **Framework:** Next.js (App Router)
- **Video Rendering:** Remotion (using `OffthreadVideo` for background videos and `Img` for images).
- **AI Integration:** For all Gemini features, you MUST use the new `@google/genai` SDK. Do NOT use the deprecated `@google/generative-ai` SDK. Refer to the `gemini-api-dev` skill for syntax.

## Vercel Limitations & Uploads
- **Payload Limits:** Vercel serverless API routes have a strict 4.5MB payload limit. Do NOT use standard `fetch` or `FormData` endpoints to upload audio or video files, as they will crash with `413 Request Entity Too Large`.
- **Client-Side Uploads:** You MUST use the `@vercel/blob/client` SDK (`upload()` function) to bypass the API limit and upload directly from the browser to the cloud.
- **Blob Security Constraints:** The Vercel Blob client API also has a default 4.5MB limit. When setting up the `/api/upload/blob` route, you MUST explicitly define `maximumSizeInBytes` (e.g., `100 * 1024 * 1024` for 100MB) inside the `onBeforeGenerateToken` callback to allow large files.
- **Vercel Prod Environments:** Vercel production deployments do not read `.env.local`. Tokens like `BLOB_READ_WRITE_TOKEN` must be explicitly added to the Vercel Production Environment Variables (via Dashboard or CLI).

## External APIs
- **YouTube Scraping:** YouTube heavily blocks scraping (ytdl-core) and free bypass APIs (Cobalt) are dead. Avoid implementing YouTube URL importing; rely on direct user file uploads for media.

## Environment Constraints
- **Windows PowerShell Policy:** The host machine has PowerShell execution scripts disabled. Whenever running `npm` scripts (e.g., `npm run build`, `npm run dev`), you MUST wrap them in `cmd.exe /c` (e.g., `cmd.exe /c npm run build`). Do not run `npm` directly in PowerShell.

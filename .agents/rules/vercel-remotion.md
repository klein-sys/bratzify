---
description: Architectural constraints for running Remotion or Puppeteer on Vercel
---

# Vercel Serverless & Heavy Rendering

When building Next.js applications that require heavy background processing or headless browsers (like `@remotion/renderer` or `puppeteer`) meant to be deployed on Vercel, adhere to the following architectural constraints:

1. **Do NOT use standard Next.js API routes (`/api/...`) for video rendering or headless browser tasks.** Vercel Serverless functions freeze immediately upon returning an HTTP response, killing background tasks, and have a strict 50MB size limit that cannot accommodate Chromium.
2. **Backend Separation**: Separate the heavy rendering logic into a dedicated long-running Node.js server (e.g., Express.js deployed on Render/Railway) OR use `@remotion/lambda` which provisions AWS Lambda functions specifically configured for this task.
3. **Static Export**: If the frontend relies solely on the external dedicated server for processing, strongly consider configuring the Next.js app for static export (`output: 'export'`) to reduce hosting costs and complexity.

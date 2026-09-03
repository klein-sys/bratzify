import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import { put } from '@vercel/blob';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config(); // fallback to standard .env

const app = express();
app.use(cors());
app.use(express.json());

// In-memory render store
interface RenderProgress {
  progress: number;
  status: "rendering" | "done" | "error";
  url?: string;
  error?: string;
}
const activeRenders = new Map<string, RenderProgress>();

function updateRenderProgress(id: string, update: Partial<RenderProgress>) {
  const current = activeRenders.get(id) || { progress: 0, status: "rendering" };
  activeRenders.set(id, { ...current, ...update });
}

// Multer setup for 100MB max file size
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const isDev = process.env.NODE_ENV === "development" || !process.env.BLOB_READ_WRITE_TOKEN;
    const file = req.file;
    const url = req.body.url;

    if (!file && !url) {
      return res.status(400).json({ error: "No file or URL provided" });
    }

    let buffer: Buffer;
    let filename: string;

    if (url) {
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        return res.status(400).json({ error: "YouTube URLs are currently not supported." });
      }
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) return res.status(400).json({ error: "Failed to fetch external URL" });
      const contentType = fetchRes.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        return res.status(400).json({ error: "Provided URL is a webpage, not an audio file." });
      }
      buffer = Buffer.from(await fetchRes.arrayBuffer());
      filename = `${Date.now()}-external-audio.mp3`;
    } else {
      buffer = file!.buffer;
      filename = `${Date.now()}-${file!.originalname.replace(/\s+/g, '-')}`;
    }

    if (isDev) {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      return res.json({ url: `http://localhost:3000/uploads/${filename}` });
    } else {
      const blob = await put(filename, buffer, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.json({ url: blob.url });
    }
  } catch (error: any) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Progress endpoint
app.get('/api/progress', (req, res) => {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "Missing render id" });
  const progress = activeRenders.get(id);
  if (!progress) return res.status(404).json({ error: "Render not found" });
  res.json(progress);
});

// Render endpoint
app.post('/api/render', async (req, res) => {
  try {
    const { lyrics, audioUrl, durationInFrames, quality, startFrameOffset = 0, templateId = "bratz", templateOptions = {} } = req.body;

    if (!lyrics || !Array.isArray(lyrics) || lyrics.length === 0) {
      return res.status(400).json({ error: "Lyrics are missing or empty." });
    }
    if (!audioUrl) {
      return res.status(400).json({ error: "Audio URL is missing." });
    }

    const renderId = `render_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    updateRenderProgress(renderId, { progress: 0, status: "rendering" });

    res.json({ renderId }); // Return immediately

    // Run async background render
    (async () => {
      try {
        const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
        let finalAudioUrl = audioUrl;

        console.log(`[${renderId}] Starting bundling...`);
        updateRenderProgress(renderId, { progress: 0.05 });
        
        const bundleLocation = await bundle({
          entryPoint,
          webpackOverride: (config) => config,
        });

        console.log(`[${renderId}] Bundling complete. Fetching compositions...`);
        updateRenderProgress(renderId, { progress: 0.1 });
        
        const comps = await getCompositions(bundleLocation, {
          inputProps: { lyrics, audioUrl: finalAudioUrl, startFrameOffset, ...templateOptions },
        });
        
        const composition = comps.find((c) => c.id === templateId);
        if (!composition) throw new Error(`No composition found with ID ${templateId}`);

        if (durationInFrames) composition.durationInFrames = durationInFrames;

        console.log(`[${renderId}] Starting render...`);
        const isDev = process.env.NODE_ENV === "development" || !process.env.BLOB_READ_WRITE_TOKEN;
        const outputDir = path.join(process.cwd(), "public", "out");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        const outputPath = path.join(outputDir, `lyric-video-${Date.now()}.mp4`);

        const renderOptions: any = {
          composition,
          serveUrl: bundleLocation,
          codec: "h264",
          outputLocation: outputPath,
          inputProps: { lyrics, audioUrl: finalAudioUrl, startFrameOffset, ...templateOptions },
          imageFormat: "jpeg",
          onProgress: ({ progress }: { progress: number }) => {
            updateRenderProgress(renderId, { progress: 0.1 + (progress * 0.9) });
          }
        };

        if (quality === "fast") {
          renderOptions.crf = 28;
          renderOptions.scale = 0.5;
          renderOptions.concurrency = "100%";
        }

        await renderMedia(renderOptions);
        console.log(`[${renderId}] Render complete:`, outputPath);
        
        if (isDev) {
          updateRenderProgress(renderId, { progress: 1, status: "done", url: `http://localhost:3000/out/${path.basename(outputPath)}` });
        } else {
          console.log(`[${renderId}] Uploading to Vercel Blob...`);
          const fileBuffer = fs.readFileSync(outputPath);
          const blob = await put(path.basename(outputPath), fileBuffer, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN });
          updateRenderProgress(renderId, { progress: 1, status: "done", url: blob.url });
          try { fs.unlinkSync(outputPath); } catch(e) {}
        }
      } catch (error: any) {
        console.error(`[${renderId}] Render Error:`, error);
        updateRenderProgress(renderId, { status: "error", error: error.message });
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});

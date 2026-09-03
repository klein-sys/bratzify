import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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

import { GoogleGenAI, Type } from '@google/genai';

// Progress endpoint
app.get('/api/progress', (req, res) => {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "Missing render id" });
  const progress = activeRenders.get(id);
  if (!progress) return res.status(404).json({ error: "Render not found" });
  res.json(progress);
});

// Gemini Sync endpoint
app.post('/api/gemini-sync', async (req, res) => {
  try {
    const { audioUrl, model = 'gemini-3.7-flash', lyricsText } = req.body;
    if (!audioUrl) return res.status(400).json({ error: "Missing audioUrl" });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is missing on the server" });

    console.log(`[Gemini Sync] Downloading audio from: ${audioUrl}`);
    const fetchRes = await fetch(audioUrl);
    if (!fetchRes.ok) throw new Error("Failed to download audio for Gemini sync");
    
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[Gemini Sync] Downloaded ${buffer.length} bytes. Sending to ${model}...`);

    const ai = new GoogleGenAI({});
    
    let prompt = "";
    if (lyricsText) {
      prompt = `You are a professional audio transcriber and lyric synchronizer.
Listen to the attached audio track. I am providing you with the exact lyrics below.
Do NOT change the lyrics or hallucinate new ones. Your job is to strictly align these lyrics to the audio and return the exact 'start' and 'end' timestamps in seconds for each line.
If the audio contains a long instrumental intro or break, make sure the start and end times strictly wrap the vocal lines. Don't let lyrics stay on screen during long instrumental breaks.

EXACT LYRICS TO ALIGN:
${lyricsText}`;
    } else {
      prompt = `You are a professional audio transcriber and lyric synchronizer.
Listen to the attached audio track. Transcribe the vocal lyrics line by line.
For each line, provide the exact 'start' timestamp and 'end' timestamp in seconds.
If the audio is completely instrumental or contains no vocals, return an empty array.
If the audio contains a long instrumental intro or break, make sure the start and end times strictly wrap the vocal lines. Don't let lyrics stay on screen during long instrumental breaks.`;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          inlineData: {
            mimeType: "audio/mp3",
            data: buffer.toString("base64")
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER }
            },
            required: ["text", "start", "end"]
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      console.log(`[Gemini Sync] Success. Returned ${parsed.length} lines.`);
      return res.json({ lyrics: parsed });
    } else {
      throw new Error("Gemini returned an empty response.");
    }
  } catch (error: any) {
    console.error("[Gemini Sync] Error:", error);
    res.status(500).json({ error: error.message });
  }
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

        console.log(`[${renderId}] Using pre-compiled bundle...`);
        updateRenderProgress(renderId, { progress: 0.05 });
        
        const bundleLocation = path.join(process.cwd(), "remotion-bundle");

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
          concurrency: 1, // CRITICAL: Force 1 Chrome tab to prevent OOM on Render 512MB free tier
          onProgress: ({ progress }: { progress: number }) => {
            updateRenderProgress(renderId, { progress: 0.1 + (progress * 0.9) });
          }
        };

        if (quality === "fast") {
          renderOptions.crf = 28;
          renderOptions.scale = 0.5;
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

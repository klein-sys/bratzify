import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import path from "path";
import fs from "fs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lyrics, audioUrl, durationInFrames, quality, startFrameOffset = 0, templateId = "bratz", templateOptions = {} } = body;

    if (!lyrics || !Array.isArray(lyrics) || lyrics.length === 0) {
      return Response.json({ error: "Lyrics are missing or empty." }, { status: 400 });
    }
    
    if (!audioUrl) {
      return Response.json({ error: "Audio URL is missing." }, { status: 400 });
    }

    const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");

    let finalAudioUrl = audioUrl;
    if (audioUrl && audioUrl.startsWith("/")) {
      // Use absolute HTTP URL to the Next.js server so Remotion can download it correctly
      // In production, this would use the real domain or standard Next.js asset serving
      finalAudioUrl = `http://localhost:3000${audioUrl}`;
    }

    console.log("Starting bundling...");
    // 1. Bundle the project
    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    console.log("Bundling complete. Fetching compositions...");
    // 2. Get composition
    const comps = await getCompositions(bundleLocation, {
      inputProps: { lyrics, audioUrl: finalAudioUrl, startFrameOffset, ...templateOptions },
    });
    
    const compositionId = templateId;
    const composition = comps.find((c) => c.id === compositionId);
    if (!composition) {
      throw new Error(`No composition found with ID ${compositionId}`);
    }

    if (durationInFrames) {
      composition.durationInFrames = durationInFrames;
    }

    console.log("Composition found. Starting render...");
    // 3. Render
    const outputDir = path.join(process.cwd(), "public", "out");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, `lyric-video-${Date.now()}.mp4`);

    const renderOptions: any = {
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: { lyrics, audioUrl: finalAudioUrl, startFrameOffset, ...templateOptions },
      imageFormat: "jpeg",
    };

    if (quality === "fast") {
      renderOptions.crf = 28;
      renderOptions.scale = 0.5;
      renderOptions.concurrency = "100%";
    }

    await renderMedia(renderOptions);

    console.log("Render complete:", outputPath);

    // Return the URL to download
    const downloadUrl = `/out/${path.basename(outputPath)}`;
    
    return Response.json({ url: downloadUrl });
  } catch (error: unknown) {
    console.error("Render Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

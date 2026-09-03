import { bundle } from '@remotion/bundler';
import path from 'path';

(async () => {
  console.log("Starting pre-compilation of Remotion bundle...");
  try {
    const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
    const outDir = path.join(process.cwd(), "remotion-bundle");
    
    await bundle({
      entryPoint,
      outDir,
      webpackOverride: (config) => config,
    });
    
    console.log("Successfully pre-compiled bundle to", outDir);
  } catch (error) {
    console.error("Failed to bundle:", error);
    process.exit(1);
  }
})();

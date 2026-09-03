export interface RenderProgress {
  progress: number;
  status: "rendering" | "done" | "error";
  url?: string;
  error?: string;
}

// In-memory store for active renders
// Note: This works for local Node/Next.js servers, but wouldn't work across multiple
// serverless function invocations on Vercel without an external store like Redis.
const activeRenders = new Map<string, RenderProgress>();

export function getRenderProgress(id: string): RenderProgress | undefined {
  return activeRenders.get(id);
}

export function updateRenderProgress(id: string, update: Partial<RenderProgress>) {
  const current = activeRenders.get(id) || { progress: 0, status: "rendering" };
  activeRenders.set(id, { ...current, ...update });
}

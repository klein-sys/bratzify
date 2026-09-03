"use client";

import React, { useState } from "react";
import AudioUploader from "@/components/AudioUploader";
import LyricSyncEditor, { SyncedLyric } from "@/components/LyricSyncEditor";
import BackgroundMediaUploader from "@/components/BackgroundMediaUploader";
import { Player } from "@remotion/player";
import { TEMPLATES, DEFAULT_TEMPLATE } from "@/lib/templates";
import { BratzTemplate } from "@/remotion/templates/BratzTemplate";
import { FisheyeTemplate } from "@/remotion/templates/FisheyeTemplate";

// Map template IDs to their React components for the live preview
const TemplateComponents: Record<string, React.FC<any>> = {
  bratz: BratzTemplate,
  fisheye: FisheyeTemplate,
};

export default function Home() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyric[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExportSuccess, setIsExportSuccess] = useState(false);
  const [quality, setQuality] = useState<"high" | "fast">("high");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [templateOptions, setTemplateOptions] = useState<Record<string, string>>({});
  
  const [siteTheme, setSiteTheme] = useState({
    background: TEMPLATES[DEFAULT_TEMPLATE].theme.background,
    foreground: TEMPLATES[DEFAULT_TEMPLATE].theme.foreground,
    accent: TEMPLATES[DEFAULT_TEMPLATE].theme.accent,
  });

  const activeTemplate = TEMPLATES[templateId] || TEMPLATES[DEFAULT_TEMPLATE];
  const ActiveComponent = TemplateComponents[templateId] || TemplateComponents[DEFAULT_TEMPLATE];

  // Initialize template options when template changes
  React.useEffect(() => {
    if (activeTemplate.customOptions) {
      const defaults: Record<string, string> = {};
      activeTemplate.customOptions.forEach((opt) => {
        defaults[opt.id] = opt.defaultValue;
      });
      setTemplateOptions(defaults);
    } else {
      setTemplateOptions({});
    }
  }, [activeTemplate]);

  // Apply theme colors dynamically from siteTheme
  React.useEffect(() => {
    document.documentElement.style.setProperty("--theme-accent", siteTheme.accent);
    document.documentElement.style.setProperty("--background", siteTheme.background);
    document.documentElement.style.setProperty("--foreground", siteTheme.foreground);
  }, [siteTheme]);

  const handleReset = () => {
    if (confirm("Are you sure you want to start over? All progress will be lost.")) {
      setAudioUrl(null);
      setSyncedLyrics([]);
      setIsExportSuccess(false);
    }
  };

  // Calculate the segment of the video to render based on lyrics
  const startFrameOffset = syncedLyrics.length > 0 ? Math.max(0, Math.floor(syncedLyrics[0].start * 30) - 15) : 0; // start 0.5s before first lyric
  const lastFrame = syncedLyrics.length > 0 ? Math.ceil(syncedLyrics[syncedLyrics.length - 1].end * 30) + 30 : 900; // end 1s after last lyric
  
  const durationInFrames = Math.max(150, lastFrame - startFrameOffset);

  const handleExport = async () => {
    if (!audioUrl) {
      alert("Please upload an audio file first.");
      return;
    }
    
    try {
      setIsExporting(true);
      setExportProgress(0);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: syncedLyrics,
          audioUrl,
          durationInFrames,
          startFrameOffset,
          quality,
          templateId,
          templateOptions
        })
      });

      const data = await res.json();
      
      if (!res.ok || !data.renderId) {
        alert("Export failed: " + (data.error || "Unknown error"));
        setIsExporting(false);
        return;
      }

      const { renderId } = data;
      
      // Poll progress
      const poll = setInterval(async () => {
        try {
          const pRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/progress?id=${renderId}`);
          const pData = await pRes.json();
          
          if (pData.status === "done") {
             clearInterval(poll);
             // Trigger download
             const a = document.createElement("a");
             a.href = pData.url;
             a.download = `bratzify-${Date.now()}.mp4`;
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);
             setIsExportSuccess(true);
             setIsExporting(false);
          } else if (pData.status === "error") {
             clearInterval(poll);
             alert("Export failed: " + pData.error);
             setIsExporting(false);
          } else {
             setExportProgress(Math.min(99, pData.progress * 100)); // cap at 99% until actually done
          }
        } catch (err) {
           console.error("Polling error", err);
        }
      }, 1000);

    } catch (error: any) {
      console.error(error);
      alert("Export failed: " + (error.message || "Unknown error") + ". See console for details.");
      setIsExporting(false);
    }
  };

  return (
    <main className="flex flex-col lg:block min-h-[100dvh] bg-background text-foreground selection:bg-theme-accent selection:text-foreground transition-colors duration-500 bg-grid-pattern overflow-x-hidden overflow-y-auto lg:overflow-hidden relative font-sans">
      
      {/* Centerpiece: Interactive Canvas (Video Preview) */}
      <div className="relative lg:absolute lg:inset-0 flex items-center justify-center p-4 lg:p-0 pointer-events-none z-0 order-first lg:order-none mt-4 lg:mt-0">
        <div className="brutal-card aspect-[9/16] w-full max-w-[360px] lg:max-w-[420px] h-auto max-h-[85vh] relative overflow-hidden pointer-events-auto bg-foreground/5 transition-transform hover:scale-[1.02] duration-300 flex items-center justify-center">
          {!audioUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-theme-accent text-accent-foreground">
              <div className="absolute inset-0 opacity-20 bg-grid-pattern" style={{ backgroundSize: '40px 40px', animation: 'slide-down 2s linear infinite' }} />
              <div className="relative z-10 p-8 text-center flex flex-col items-center justify-center h-full">
                <div className="animate-pulse mb-8 border-4 border-accent-foreground p-6 bg-background text-foreground shadow-[8px_8px_0px_var(--color-accent-foreground)] -rotate-3">
                  <h2 className="text-4xl font-bold brat-text leading-tight uppercase">feed me<br/>audio.</h2>
                </div>
                
                <div className="flex flex-col gap-4 text-left w-full max-w-[250px]">
                  <div className="flex items-center gap-4 bg-background text-foreground border-4 border-accent-foreground p-3 shadow-[4px_4px_0px_var(--color-accent-foreground)] rotate-1">
                    <span className="text-3xl font-bold font-mono">1</span>
                    <span className="text-xl font-bold brat-text">upload track</span>
                  </div>
                  <div className="flex items-center gap-4 bg-background text-foreground border-4 border-accent-foreground p-3 shadow-[4px_4px_0px_var(--color-accent-foreground)] -rotate-1 opacity-60">
                    <span className="text-3xl font-bold font-mono">2</span>
                    <span className="text-xl font-bold brat-text">sync lyrics</span>
                  </div>
                  <div className="flex items-center gap-4 bg-background text-foreground border-4 border-accent-foreground p-3 shadow-[4px_4px_0px_var(--color-accent-foreground)] rotate-2 opacity-60">
                    <span className="text-3xl font-bold font-mono">3</span>
                    <span className="text-xl font-bold brat-text">export video</span>
                  </div>
                </div>
                
                <p className="mt-12 text-lg font-bold brat-text opacity-70 animate-bounce">
                  ← load your track to start
                </p>
              </div>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes slide-down {
                  from { background-position: 0 0; }
                  to { background-position: 0 40px; }
                }
              `}} />
            </div>
          ) : (
            <Player
              component={ActiveComponent}
              inputProps={{ lyrics: syncedLyrics, audioUrl, startFrameOffset, ...templateOptions }}
              durationInFrames={durationInFrames}
              fps={30}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: "100%", height: "100%" }}
              controls
              autoPlay={false}
              acknowledgeRemotionLicense={true}
            />
          )}
        </div>
      </div>

      {/* Floating Panels Container */}
      <div className="relative z-10 w-full min-h-[100dvh] lg:h-[100dvh] max-w-[1600px] mx-auto p-4 lg:p-8 flex flex-col lg:flex-row justify-between pointer-events-none gap-8 lg:gap-0">
        
        {/* Left Floating Panel */}
        <div className="flex flex-col gap-6 w-full lg:w-[450px] h-auto lg:h-full overflow-y-visible lg:overflow-y-auto pointer-events-auto pb-8 lg:pb-32 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          <div className="brutal-card p-6 flex flex-col gap-4">
            <div>
              <h1 className="text-6xl lg:text-7xl font-bold brat-text tracking-tighter text-foreground mb-1">bratzify.fm</h1>
              <p className="text-xl font-bold text-foreground opacity-70 brat-text">brat lyric video generator.</p>
            </div>
            {(audioUrl || syncedLyrics.length > 0) && (
              <button 
                onClick={handleReset} 
                className="brutal-btn w-fit px-6 py-2 text-xl"
              >
                start over
              </button>
            )}
          </div>

          {/* Template Selector */}
          <div className="brutal-card p-6 bg-foreground/5">
            <label className="text-2xl font-bold brat-text block mb-4">choose aesthetic.</label>
            <div className="flex flex-wrap gap-2">
              {Object.values(TEMPLATES).map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={`px-4 py-2 font-bold brat-text text-xl border-4 border-foreground transition-colors ${
                    templateId === tpl.id ? "bg-theme-accent text-accent-foreground shadow-[4px_4px_0px_var(--color-foreground)] -translate-y-1" : "bg-transparent text-foreground hover:bg-foreground/10"
                  }`}
                >
                  {tpl.name}
                </button>
              ))}
            </div>

            {/* Template Options UI */}
            {activeTemplate.customOptions && activeTemplate.customOptions.length > 0 && (
              <div className="mt-6 flex flex-col gap-3 border-t-4 border-foreground pt-4">
                {activeTemplate.customOptions.map((opt) => (
                  <div key={opt.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <label className="font-bold brat-text text-xl">{opt.label}</label>
                    {opt.type === "color" && (
                      <input 
                        type="color" 
                        value={templateOptions[opt.id] || opt.defaultValue}
                        onChange={(e) => setTemplateOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                        className="w-12 h-12 border-4 border-foreground p-0 rounded-none cursor-pointer bg-background"
                      />
                    )}
                    {opt.type === "select" && opt.options && (
                      <select 
                        value={templateOptions[opt.id] || opt.defaultValue}
                        onChange={(e) => setTemplateOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                        className="w-full border-4 border-foreground px-4 py-2 bg-background font-bold brat-text text-xl outline-none"
                      >
                        {opt.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                    {opt.type === "media" && (
                      <BackgroundMediaUploader 
                        value={templateOptions[opt.id] || opt.defaultValue}
                        onChange={(val) => setTemplateOptions(prev => ({ ...prev, [opt.id]: val }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <AudioUploader onAudioSelect={setAudioUrl} />
          
          <LyricSyncEditor 
            audioUrl={audioUrl} 
            onSyncComplete={setSyncedLyrics} 
          />
        </div>

        {/* Right Floating Panel */}
        <div className="flex flex-col gap-6 w-full lg:w-[400px] h-auto lg:h-full overflow-y-visible lg:overflow-y-auto pointer-events-auto pb-32 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          <div className="brutal-card p-6 bg-theme-accent text-accent-foreground border-accent-foreground shadow-[8px_8px_0px_var(--color-foreground)]">
             <h2 className="text-4xl font-bold brat-text mb-6">export video.</h2>
             
             {isExportSuccess ? (
               <div className="text-center font-bold flex flex-col items-center">
                 <p className="text-4xl brat-text mb-4 animate-pulse">download complete!</p>
                 <button 
                   onClick={() => setIsExportSuccess(false)}
                   className="brutal-btn px-6 py-2 text-2xl bg-background text-foreground border-accent-foreground shadow-[4px_4px_0px_var(--color-accent-foreground)]"
                 >
                   export another
                 </button>
               </div>
             ) : (
               <div className="flex flex-col gap-4">
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setQuality("high")}
                      className={`flex-1 px-4 py-2 border-4 border-accent-foreground font-bold brat-text text-xl transition-all ${quality === "high" ? "bg-accent-foreground text-theme-accent shadow-[2px_2px_0px_var(--color-accent-foreground)] translate-x-[2px] translate-y-[2px]" : "bg-transparent hover:bg-accent-foreground/10"}`}
                      disabled={isExporting}
                    >
                      high (1080p)
                    </button>
                    <button 
                      onClick={() => setQuality("fast")}
                      className={`flex-1 px-4 py-2 border-4 border-accent-foreground font-bold brat-text text-xl transition-all ${quality === "fast" ? "bg-accent-foreground text-theme-accent shadow-[2px_2px_0px_var(--color-accent-foreground)] translate-x-[2px] translate-y-[2px]" : "bg-transparent hover:bg-accent-foreground/10"}`}
                      disabled={isExporting}
                    >
                      fast (draft)
                    </button>
                 </div>
                 <button 
                    className="bg-background text-foreground border-4 border-foreground shadow-[4px_4px_0px_var(--color-foreground)] hover:bg-accent-foreground hover:text-theme-accent hover:-translate-y-1 transition-all py-4 text-3xl font-bold brat-text w-full disabled:opacity-50"
                    onClick={handleExport}
                    disabled={isExporting || syncedLyrics.length === 0}
                 >
                   {isExporting ? "rendering..." : "export."}
                 </button>
                 {isExporting && (
                   <div className="mt-4 border-4 border-foreground w-full h-10 bg-background relative overflow-hidden">
                     <div 
                       className="absolute inset-y-0 left-0 bg-accent-foreground transition-all duration-1000 ease-linear"
                       style={{ width: `${exportProgress}%` }}
                     />
                     <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-theme-accent mix-blend-difference pointer-events-none uppercase">
                       rendering: {Math.round(exportProgress)}%
                     </div>
                   </div>
                 )}
               </div>
             )}
          </div>
          
          {/* Website Theme UI */}
          <div className="brutal-card p-6">
            <label className="text-3xl font-bold brat-text block mb-6">website theme.</label>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={siteTheme.background}
                  onChange={(e) => setSiteTheme(prev => ({ ...prev, background: e.target.value }))}
                  className="w-12 h-12 p-0 border-4 border-foreground bg-transparent cursor-pointer"
                />
                <label className="font-bold brat-text text-xl">background</label>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={siteTheme.foreground}
                  onChange={(e) => setSiteTheme(prev => ({ ...prev, foreground: e.target.value }))}
                  className="w-12 h-12 p-0 border-4 border-foreground bg-transparent cursor-pointer"
                />
                <label className="font-bold brat-text text-xl">text color</label>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={siteTheme.accent}
                  onChange={(e) => setSiteTheme(prev => ({ ...prev, accent: e.target.value }))}
                  className="w-12 h-12 p-0 border-4 border-foreground bg-transparent cursor-pointer"
                />
                <label className="font-bold brat-text text-xl">accent color</label>
              </div>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import AudioUploader from "@/components/AudioUploader";
import LyricSyncEditor, { SyncedLyric } from "@/components/LyricSyncEditor";
import BackgroundMediaUploader from "@/components/BackgroundMediaUploader";
import SyncLandingHero from "@/components/SyncLandingHero";
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
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyric[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExportSuccess, setIsExportSuccess] = useState(false);
  const [quality, setQuality] = useState<"high" | "fast">("high");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [templateOptions, setTemplateOptions] = useState<Record<string, string>>({});
  
  const activeTemplate = TEMPLATES[templateId] || TEMPLATES[DEFAULT_TEMPLATE];
  const ActiveComponent = TemplateComponents[templateId] || TemplateComponents[DEFAULT_TEMPLATE];

  // Initialize template options when template changes
  useEffect(() => {
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

  // Apply theme to document body so background transitions smoothly globally
  useEffect(() => {
    document.body.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => prev === "dark" ? "light" : "dark");
  };

  const handleLaunchStudio = (query: string, useGemini: boolean) => {
    setIsStudioOpen(true);
    // Future integration: use `query` and `useGemini` to trigger auto-sync
    // For now, it just opens the studio
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to exit the studio? All progress will be lost.")) {
      setAudioUrl(null);
      setSyncedLyrics([]);
      setIsExportSuccess(false);
      setIsStudioOpen(false);
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
             a.download = `syncid-${Date.now()}.mp4`;
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

  if (!isStudioOpen) {
    return (
      <SyncLandingHero 
        theme={themeMode} 
        toggleTheme={toggleTheme} 
        onLaunch={handleLaunchStudio} 
      />
    );
  }

  return (
    <main 
      className="flex flex-col lg:block min-h-[100dvh] transition-colors duration-500 bg-grid-pattern overflow-x-hidden overflow-y-auto lg:overflow-hidden relative font-sans"
      data-theme={themeMode}
    >
      
      {/* Mobile Title (Only visible on mobile) */}
      <div className="lg:hidden p-4 pb-0 z-10 relative pointer-events-auto">
        <div className="glass-panel p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1 font-sans">SYNCID<span className="opacity-50">.FM</span></h1>
              <p className="text-xs font-mono text-foreground opacity-70 uppercase tracking-widest">lyric sync studio</p>
            </div>
            <button onClick={toggleTheme} className="premium-btn ghost px-3 py-1 text-xs">
              {themeMode === 'dark' ? 'LIGHT' : 'DARK'}
            </button>
          </div>
          <button onClick={handleReset} className="premium-btn w-fit px-4 py-2 mt-2">exit studio</button>
        </div>
      </div>

      {/* Centerpiece: Interactive Canvas (Video Preview) */}
      <div className="relative lg:absolute lg:inset-0 flex items-center justify-center p-4 lg:p-0 pointer-events-none z-0 mt-2 lg:mt-0">
        <div className="glass-panel aspect-[9/16] w-full max-w-[280px] sm:max-w-[360px] lg:max-w-[420px] h-auto max-h-[55vh] sm:max-h-[65vh] lg:max-h-[85vh] relative overflow-hidden pointer-events-auto transition-transform hover:scale-[1.02] duration-300 flex items-center justify-center border-2 border-line">
          {!audioUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-foreground backdrop-blur-sm">
              <div className="relative z-10 p-8 text-center flex flex-col items-center justify-center h-full">
                <div className="glass-panel p-6 mb-8 bg-background/80">
                  <h2 className="text-2xl font-bold font-sans uppercase tracking-widest text-theme-accent">Awaiting Audio</h2>
                </div>
                
                <div className="flex flex-col gap-4 text-left w-full max-w-[250px] font-mono text-sm opacity-70">
                  <div className="flex items-center gap-4">
                    <span className="text-theme-accent font-bold">[1]</span>
                    <span>Upload Track</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-theme-accent font-bold">[2]</span>
                    <span>Sync Lyrics</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-theme-accent font-bold">[3]</span>
                    <span>Export Video</span>
                  </div>
                </div>
              </div>
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
          
          <div className="glass-panel p-6 hidden lg:flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-5xl font-bold font-sans tracking-tight text-foreground mb-1">SYNCID</h1>
                <p className="text-sm font-mono text-foreground opacity-60 uppercase tracking-widest mt-1">Premium Lyric Engine</p>
              </div>
            </div>
            <button 
              onClick={handleReset} 
              className="premium-btn ghost w-fit mt-2"
            >
              Exit Studio
            </button>
          </div>

          {/* Template Selector */}
          <div className="glass-panel p-6">
            <label className="text-lg font-bold font-sans uppercase tracking-widest text-theme-accent block mb-4">Aesthetics</label>
            <div className="flex flex-wrap gap-3">
              {Object.values(TEMPLATES).map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={`px-4 py-2 font-mono text-sm uppercase tracking-wider transition-all rounded-md ${
                    templateId === tpl.id 
                      ? "bg-theme-accent text-accent-foreground font-bold shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                      : "bg-fill-ghost text-foreground hover:bg-fill-solid border border-line"
                  }`}
                >
                  {tpl.name}
                </button>
              ))}
            </div>

            {/* Template Options UI */}
            {activeTemplate.customOptions && activeTemplate.customOptions.length > 0 && (
              <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5">
                {activeTemplate.customOptions.map((opt) => (
                  <div key={opt.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <label className="font-mono text-xs uppercase tracking-widest text-text-dim">{opt.label}</label>
                    {opt.type === "color" && (
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-line">
                        <input 
                          type="color" 
                          value={templateOptions[opt.id] || opt.defaultValue}
                          onChange={(e) => setTemplateOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                          className="absolute inset-[-10px] w-16 h-16 p-0 cursor-pointer"
                        />
                      </div>
                    )}
                    {opt.type === "select" && opt.options && (
                      <select 
                        value={templateOptions[opt.id] || opt.defaultValue}
                        onChange={(e) => setTemplateOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                        className="bg-fill-ghost border border-line text-foreground px-3 py-2 font-mono text-sm rounded outline-none focus:border-theme-accent transition-colors"
                      >
                        {opt.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                    {opt.type === "media" && (
                      <div className="w-full sm:w-auto">
                        <BackgroundMediaUploader 
                          value={templateOptions[opt.id] || opt.defaultValue}
                          onChange={(val) => setTemplateOptions(prev => ({ ...prev, [opt.id]: val }))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel p-6">
            <AudioUploader onAudioSelect={setAudioUrl} />
          </div>
          
          <div className="glass-panel p-6">
            <LyricSyncEditor 
              audioUrl={audioUrl} 
              onSyncComplete={setSyncedLyrics} 
            />
          </div>
        </div>

        {/* Right Floating Panel */}
        <div className="flex flex-col gap-6 w-full lg:w-[400px] h-auto lg:h-full overflow-y-visible lg:overflow-y-auto pointer-events-auto pb-32 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          <div className="glass-panel p-6 relative overflow-hidden">
             {/* Decorative gradient for the export panel */}
             <div className="absolute inset-0 bg-gradient-to-br from-theme-accent/20 to-transparent pointer-events-none" />
             
             <h2 className="text-xl font-bold font-sans uppercase tracking-widest text-foreground mb-6 relative z-10 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-theme-accent animate-pulse" />
               Render Engine
             </h2>
             
             {isExportSuccess ? (
               <div className="text-center flex flex-col items-center relative z-10 py-4">
                 <p className="font-mono text-theme-accent mb-6 tracking-widest">DOWNLOAD COMPLETE_</p>
                 <button 
                   onClick={() => setIsExportSuccess(false)}
                   className="premium-btn w-full"
                 >
                   RENDER ANOTHER
                 </button>
               </div>
             ) : (
               <div className="flex flex-col gap-5 relative z-10">
                 <div className="flex gap-2 p-1 bg-fill-ghost rounded-md border border-line">
                    <button 
                      onClick={() => setQuality("high")}
                      className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider rounded transition-all ${quality === "high" ? "bg-theme-accent text-accent-foreground shadow-md" : "text-text-dim hover:text-foreground"}`}
                      disabled={isExporting}
                    >
                      1080p (Pro)
                    </button>
                    <button 
                      onClick={() => setQuality("fast")}
                      className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider rounded transition-all ${quality === "fast" ? "bg-fill-solid text-foreground shadow-md border border-line-strong" : "text-text-dim hover:text-foreground"}`}
                      disabled={isExporting}
                    >
                      720p (Draft)
                    </button>
                 </div>
                 
                 <button 
                    className="premium-btn w-full py-4 text-base bg-theme-accent text-accent-foreground hover:bg-theme-accent/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all"
                    onClick={handleExport}
                    disabled={isExporting || syncedLyrics.length === 0}
                 >
                   {isExporting ? "PROCESSING..." : "INITIALIZE RENDER"}
                 </button>
                 
                 {isExporting && (
                   <div className="mt-2 h-2 bg-fill-ghost rounded-full overflow-hidden relative">
                     <div 
                       className="absolute inset-y-0 left-0 bg-theme-accent transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(59,130,246,1)]"
                       style={{ width: `${exportProgress}%` }}
                     />
                     <div className="mt-4 text-center font-mono text-xs text-theme-accent">
                       [{Math.round(exportProgress)}%]
                     </div>
                   </div>
                 )}
               </div>
             )}
          </div>
          
          {/* Website Theme UI - Converted to Simple Toggle */}
          <div className="glass-panel p-6">
            <label className="text-sm font-bold font-mono uppercase tracking-widest text-text-dim block mb-4">Environment</label>
            <div className="flex justify-between items-center bg-fill-ghost p-4 rounded-md border border-line">
              <span className="font-sans font-medium">Theme Mode</span>
              <button
                onClick={toggleTheme}
                className="premium-btn ghost px-4 py-2 text-xs"
              >
                {themeMode === 'dark' ? 'SWITCH TO LIGHT' : 'SWITCH TO DARK'}
              </button>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}


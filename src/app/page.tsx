"use client";

import React, { useState } from "react";
import AudioUploader from "@/components/AudioUploader";
import LyricSyncEditor, { SyncedLyric } from "@/components/LyricSyncEditor";
import { Player } from "@remotion/player";
import { TEMPLATES, DEFAULT_TEMPLATE } from "@/lib/templates";
import { BratzTemplate } from "@/remotion/templates/BratzTemplate";

// Map template IDs to their React components for the live preview
const TemplateComponents: Record<string, React.FC<any>> = {
  bratz: BratzTemplate,
};

export default function Home() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyric[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportSuccess, setIsExportSuccess] = useState(false);
  const [quality, setQuality] = useState<"high" | "fast">("high");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [templateOptions, setTemplateOptions] = useState<Record<string, string>>({});

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

  // Apply theme colors dynamically
  React.useEffect(() => {
    document.documentElement.style.setProperty("--theme-accent", activeTemplate.theme.accent);
    document.documentElement.style.setProperty("--background", activeTemplate.theme.background);
    document.documentElement.style.setProperty("--foreground", activeTemplate.theme.foreground);
  }, [activeTemplate]);

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
      const res = await fetch("/api/render", {
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
      
      if (res.ok && data.url) {
        // Trigger download
        const a = document.createElement("a");
        a.href = data.url;
        a.download = `bratzify-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsExportSuccess(true);
      } else {
        alert("Export failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      alert("Export failed. See console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-background text-foreground selection:bg-theme-accent selection:text-foreground transition-colors duration-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Left Panel: Input & Sync */}
        <div className="flex flex-col gap-8">
          <div className="text-center lg:text-left mt-4 flex flex-col lg:flex-row justify-between lg:items-start gap-4">
            <div>
              <h1 className="text-8xl font-bold brat-text tracking-tighter mb-2 text-foreground">bratzify.fm</h1>
              <p className="text-3xl font-bold text-foreground opacity-70 brat-text">brat lyric video generator.</p>
            </div>
            {(audioUrl || syncedLyrics.length > 0) && (
              <button 
                onClick={handleReset} 
                className="bg-transparent border-4 border-foreground text-foreground px-6 py-2 font-bold brat-text hover:bg-foreground hover:text-theme-accent transition-colors text-2xl lg:mt-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
              >
                start over
              </button>
            )}
          </div>

          {/* Template Selector */}
          <div className="bg-foreground/5 p-4 border-4 border-foreground">
            <label className="text-2xl font-bold brat-text block mb-2">choose aesthetic.</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Object.values(TEMPLATES).map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={`px-4 py-2 font-bold brat-text text-xl border-4 border-foreground transition-colors whitespace-nowrap ${
                    templateId === tpl.id ? "bg-foreground text-theme-accent" : "bg-transparent text-foreground hover:bg-foreground/10"
                  }`}
                >
                  {tpl.name}
                </button>
              ))}
            </div>

            {/* Template Options UI */}
            {activeTemplate.customOptions && activeTemplate.customOptions.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t-2 border-foreground/20 pt-4">
                {activeTemplate.customOptions.map((opt) => (
                  <div key={opt.id} className="flex justify-between items-center">
                    <label className="font-bold brat-text text-xl">{opt.label}</label>
                    {opt.type === "color" && (
                      <input 
                        type="color" 
                        value={templateOptions[opt.id] || opt.defaultValue}
                        onChange={(e) => setTemplateOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                        className="w-12 h-12 border-2 border-foreground p-0 rounded-none cursor-pointer"
                      />
                    )}
                    {opt.type === "select" && opt.options && (
                      <select 
                        value={templateOptions[opt.id] || opt.defaultValue}
                        onChange={(e) => setTemplateOptions(prev => ({ ...prev, [opt.id]: e.target.value }))}
                        className="bg-transparent border-2 border-foreground px-2 py-1 font-bold brat-text text-xl outline-none"
                      >
                        {opt.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
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

        {/* Right Panel: Preview & Export */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-8 mt-12 lg:mt-0">
          <div className="bg-theme-accent border-4 border-foreground p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] transition-colors duration-500">
            <h2 className="text-4xl font-bold brat-text mb-6 text-center text-foreground">live preview.</h2>
            
            <div className="border-4 border-foreground aspect-[9/16] bg-foreground max-w-[320px] mx-auto w-full relative overflow-hidden">
              <Player
                component={ActiveComponent}
                inputProps={{ lyrics: syncedLyrics, audioUrl, startFrameOffset, ...templateOptions }}
                durationInFrames={durationInFrames}
                fps={30}
                compositionWidth={1080}
                compositionHeight={1920}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                controls
                autoPlay={false}
              />
            </div>
            
            <div className="mt-8 flex justify-center flex-col items-center gap-4">
               {isExportSuccess ? (
                 <div className="text-foreground text-center font-bold flex flex-col items-center">
                   <p className="text-4xl brat-text mb-4 animate-pulse">download complete!</p>
                   <button 
                     onClick={() => setIsExportSuccess(false)}
                     className="bg-transparent border-4 border-foreground text-foreground px-6 py-2 brat-text text-2xl hover:bg-foreground hover:text-theme-accent transition-colors shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
                   >
                     export another
                   </button>
                 </div>
               ) : (
                 <>
                   <div className="flex gap-4 items-center mb-2">
                      <span className="text-xl font-bold brat-text text-foreground">export quality:</span>
                      <button 
                        onClick={() => setQuality("high")}
                        className={`px-4 py-1 border-4 border-foreground font-bold brat-text text-xl ${quality === "high" ? "bg-foreground text-theme-accent shadow-[2px_2px_0px_rgba(0,0,0,1)]" : "bg-transparent text-foreground"}`}
                        disabled={isExporting}
                      >
                        high (1080p)
                      </button>
                      <button 
                        onClick={() => setQuality("fast")}
                        className={`px-4 py-1 border-4 border-foreground font-bold brat-text text-xl ${quality === "fast" ? "bg-foreground text-theme-accent shadow-[2px_2px_0px_rgba(0,0,0,1)]" : "bg-transparent text-foreground"}`}
                        disabled={isExporting}
                      >
                        fast (draft)
                      </button>
                   </div>
                   <button 
                      className="bg-foreground text-theme-accent px-8 py-4 font-bold text-3xl brat-text hover:scale-[1.02] transition-transform shadow-[4px_4px_0px_rgba(0,0,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-sm"
                      onClick={handleExport}
                      disabled={isExporting || syncedLyrics.length === 0}
                   >
                     {isExporting ? "rendering..." : "export video."}
                   </button>
                   {isExporting && (
                     <p className="text-sm text-foreground font-bold animate-pulse mt-2 text-center">
                       please wait, server is rendering your mp4...
                     </p>
                   )}
                 </>
               )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

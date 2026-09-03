"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, RotateCcw, CheckCircle2, Search, Loader2, X, Sparkles } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import RegionsPlugin from "wavesurfer.js/plugins/regions";

export interface SyncedLyric {
  id: string;
  text: string;
  start: number;
  end: number;
}

interface LyricSyncEditorProps {
  audioUrl: string | null;
  onSyncComplete: (lyrics: SyncedLyric[]) => void;
}

export default function LyricSyncEditor({ audioUrl, onSyncComplete }: LyricSyncEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const isSpaceDownRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rawLyrics, setRawLyrics] = useState("");
  const [syncedLines, setSyncedLines] = useState<SyncedLyric[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<"input" | "sync">("input");
  
  // LRCLIB state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [isGeminiSyncing, setIsGeminiSyncing] = useState(false);
  const [geminiError, setGeminiError] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-3.5-flash-lite");

  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(0, 0, 0, 0.4)",
      progressColor: "#000000",
      cursorColor: "#ffffff",
      barWidth: 2,
      barGap: 1,
      barRadius: 0,
      height: 100,
    });

    ws.load(audioUrl);

    const wsRegions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = wsRegions;

    wsRegions.on("region-updated", (region) => {
      setSyncedLines((prev) => {
        const newLines = [...prev];
        const idx = newLines.findIndex((l) => l.id === region.id);
        if (idx !== -1) {
          newLines[idx].start = region.start;
          newLines[idx].end = region.end;
        }
        return newLines;
      });
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  const deleteLyric = (index: number) => {
    const lyricToDelete = syncedLines[index];
    setSyncedLines((prev) => prev.filter((_, i) => i !== index));
    if (lyricToDelete && regionsRef.current) {
      // Find the region by ID and remove it
      const regions = regionsRef.current.getRegions();
      const regionToRemove = regions.find(r => r.id === lyricToDelete.id);
      if (regionToRemove) {
        regionToRemove.remove();
      }
    }
    if (currentIndex > index) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const startSync = () => {
    const lines = rawLyrics.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    setSyncedLines(
      lines.map((text, i) => ({
        id: `lyric-${i}`,
        text,
        start: 0,
        end: 0,
      }))
    );
    setCurrentIndex(0);
    setMode("sync");
    regionsRef.current?.clearRegions();
    
    wrapperRef.current?.focus();
  };

  const handleAutoSync = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError("");

    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      
      if (!data || data.length === 0) {
        setSearchError("No lyrics found for this song.");
        setIsSearching(false);
        return;
      }

      // Find first result with synced lyrics
      const syncedResult = data.find((d: any) => d.syncedLyrics);
      if (!syncedResult) {
        setSearchError("Found lyrics, but they don't have timestamps. You'll have to manually sync!");
        setIsSearching(false);
        return;
      }

      // Parse LRC format
      const lrcString = syncedResult.syncedLyrics;
      const lines = lrcString.split('\n');
      const result: SyncedLyric[] = [];
      const timeRegex = /\[(\d{2}):(\d{2}\.\d{2})\](.*)/;

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(timeRegex);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseFloat(match[2]);
          const text = match[3].trim();
          if (text) {
            const timeInSeconds = minutes * 60 + seconds;
            result.push({
              id: `lyric-auto-${i}`,
              text,
              start: timeInSeconds,
              end: timeInSeconds + 3
            });
          }
        }
      }

      // Refine end times: cap duration to max 5 seconds so lyrics don't stay during instrumental breaks
      for (let i = 0; i < result.length - 1; i++) {
        result[i].end = Math.min(result[i].start + 5, result[i + 1].start);
      }
      if (result.length > 0) {
        result[result.length - 1].end = result[result.length - 1].start + 5;
      }

      setSyncedLines(result);
      setCurrentIndex(result.length); // mark all as done
      setMode("sync");
      
      regionsRef.current?.clearRegions();
      result.forEach(lyric => {
        regionsRef.current?.addRegion({
          id: lyric.id,
          start: lyric.start,
          end: lyric.end,
          content: lyric.text,
          color: "rgba(255, 122, 0, 0.4)",
          drag: true,
          resize: true,
        });
      });
    } catch (e) {
      setSearchError("Error searching for lyrics.");
    }
    setIsSearching(false);
  };

  const handleGeminiSync = async (alignMode = false) => {
    if (!audioUrl) return;
    setIsGeminiSyncing(true);
    setGeminiError("");

    let payload: any = { audioUrl, model: geminiModel };
    if (alignMode && syncedLines.length > 0) {
      payload.lyricsText = syncedLines.map(l => l.text).join('\n');
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gemini-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setGeminiError(data.error || "Failed to sync with Gemini.");
        setIsGeminiSyncing(false);
        return;
      }

      if (data.lyrics && data.lyrics.length > 0) {
        const result: SyncedLyric[] = data.lyrics.map((l: any, i: number) => ({
          id: `lyric-gemini-${i}`,
          text: l.text,
          start: l.start,
          end: l.end
        }));

        setSyncedLines(result);
        setCurrentIndex(result.length); // mark all as done
        setMode("sync");
        
        regionsRef.current?.clearRegions();
        result.forEach(lyric => {
          regionsRef.current?.addRegion({
            id: lyric.id,
            start: lyric.start,
            end: lyric.end,
            content: lyric.text,
            color: "rgba(255, 122, 0, 0.4)",
            drag: true,
            resize: true,
          });
        });
      } else {
        setGeminiError("Gemini didn't find any vocals or returned an empty response.");
      }
    } catch (e) {
      setGeminiError("Error connecting to Gemini sync server.");
    }
    setIsGeminiSyncing(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "sync" || !wavesurferRef.current) return;
      if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") return;
      if (e.code !== "Space") return;
      e.preventDefault();

      if (!isSpaceDownRef.current) {
        isSpaceDownRef.current = true;
        if (!isPlaying) {
          wavesurferRef.current.play();
        }
        
        if (currentIndex < syncedLines.length) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          setSyncedLines((prev) => {
            const newLines = [...prev];
            newLines[currentIndex].start = currentTime;
            return newLines;
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (mode !== "sync" || !wavesurferRef.current) return;
      if (e.code !== "Space") return;
      e.preventDefault();

      if (isSpaceDownRef.current) {
        isSpaceDownRef.current = false;
        if (currentIndex < syncedLines.length) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          
          setSyncedLines((prev) => {
            const newLines = [...prev];
            const start = newLines[currentIndex].start;
            newLines[currentIndex].end = currentTime;
            
            // Add region visually
            regionsRef.current?.addRegion({
              id: newLines[currentIndex].id,
              start: start,
              end: currentTime,
              content: newLines[currentIndex].text,
              color: "rgba(255, 122, 0, 0.4)", // theme-accent with opacity
              drag: true,
              resize: true,
            });
            
            return newLines;
          });
          
          setCurrentIndex((prev) => prev + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode, isPlaying, currentIndex, syncedLines]);

  const updateLyricTime = (index: number, field: "start" | "end", value: number) => {
    if (isNaN(value)) return;
    
    // Prevent negative timestamps
    const safeValue = Math.max(0, value);

    setSyncedLines((prev) => {
      const newLines = [...prev];
      const lyric = { ...newLines[index] };
      
      lyric[field] = safeValue;
      
      // Ensure start is not greater than end, and end is not less than start
      if (field === "start" && lyric.start > lyric.end) {
        lyric.start = lyric.end;
      }
      if (field === "end" && lyric.end < lyric.start) {
        lyric.end = lyric.start;
      }
      
      newLines[index] = lyric;
      return newLines;
    });
  };

  useEffect(() => {
     if (mode === "sync" && currentIndex >= syncedLines.length && syncedLines.length > 0) {
        onSyncComplete(syncedLines);
     }
  }, [currentIndex, syncedLines, mode, onSyncComplete]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold font-sans uppercase tracking-widest text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-theme-accent opacity-50" />
          Lyric Studio
        </h2>
        {mode === "sync" && currentIndex < syncedLines.length && (
          <span className="text-xs bg-theme-accent/20 text-theme-accent px-3 py-1 rounded font-mono uppercase tracking-widest animate-pulse border border-theme-accent/30">
            Hold spacebar to sync
          </span>
        )}
      </div>

      {audioUrl && (
        <div 
          className="glass-panel relative outline-none focus:border-theme-accent transition-colors overflow-hidden" 
          tabIndex={0} 
          ref={wrapperRef}
        >
          <div ref={containerRef} className="opacity-90 mix-blend-difference"></div>
          
          <div className="flex gap-4 items-center mt-4">
            <button
              onClick={togglePlay}
              className="premium-btn w-12 h-12 flex items-center justify-center p-0 rounded-full"
            >
              {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
            </button>
            <div className="text-sm font-mono tracking-widest uppercase text-text-dim">
              {currentIndex}/{syncedLines.length} lines synced
            </div>
            
            {mode === "sync" && (
               <button onClick={() => { setMode("input"); setCurrentIndex(0); }} className="ml-auto flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-text-dim hover:text-theme-accent transition-colors">
                  <RotateCcw className="w-4 h-4"/> Reset Sync
               </button>
            )}
          </div>
        </div>
      )}

      {mode === "input" ? (
        <div className="flex flex-col gap-4 mt-2">
          {/* Auto Sync Section */}
          <div className="glass-panel">
            <label className="text-sm font-sans font-bold uppercase tracking-widest flex items-center gap-2 mb-2 text-foreground">
              <Search className="w-4 h-4 text-theme-accent" /> Auto-Sync (Free)
            </label>
            <p className="text-text-dim font-sans text-sm mb-4 leading-relaxed">
              Type the song name and artist to magically grab perfectly synced lyrics from the internet.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="e.g. 360 charli xcx" 
                className="flex-1 bg-fill-ghost border border-line rounded px-4 py-2 font-mono text-sm outline-none focus:border-theme-accent text-foreground placeholder-text-dimmer transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAutoSync()}
              />
              <button 
                onClick={handleAutoSync}
                disabled={isSearching || !searchQuery}
                className="premium-btn py-2 px-6 w-full sm:w-auto flex items-center justify-center gap-2"
              >
                {isSearching ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</> : "Auto-Sync"}
              </button>
            </div>
            {searchError && <p className="text-red-500 font-mono text-xs mt-3 uppercase tracking-widest">{searchError}</p>}
          </div>

          <div className="glass-panel">
            <label className="text-sm font-sans font-bold uppercase tracking-widest flex items-center gap-2 mb-2 text-foreground">
              <Sparkles className="w-4 h-4 text-theme-accent" /> AI Sync (Gemini)
            </label>
            <p className="text-text-dim font-sans text-sm mb-4 leading-relaxed">
              Can't find lyrics online? Let Gemini listen to your audio and transcribe it perfectly.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              <label className="text-xs font-mono opacity-70 text-text-dim uppercase tracking-widest">Select Model</label>
              <select 
                className="w-full bg-fill-ghost border border-line rounded px-4 py-2 font-mono text-sm outline-none focus:border-theme-accent text-foreground transition-colors"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                disabled={isGeminiSyncing}
              >
                <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Fastest)</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash (High Accuracy)</option>
              </select>
            </div>
            <button 
              onClick={() => handleGeminiSync(false)}
              disabled={isGeminiSyncing || !audioUrl}
              className="premium-btn w-full py-3 flex items-center justify-center gap-2"
            >
              {isGeminiSyncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing audio with Gemini...</> : "✨ Start AI Sync"}
            </button>
            {geminiError && <p className="text-red-500 font-mono text-xs mt-3 uppercase tracking-widest">{geminiError}</p>}
          </div>

          <div className="flex items-center gap-4 py-2">
             <div className="flex-1 h-px bg-line"></div>
             <div className="font-mono text-xs uppercase tracking-widest text-text-dim">OR MANUAL SYNC</div>
             <div className="flex-1 h-px bg-line"></div>
          </div>

          <div className="glass-panel">
            <label className="text-sm font-sans font-bold uppercase tracking-widest flex items-center gap-2 mb-3 text-foreground">
              Paste Lyrics
            </label>
            <textarea
              className="w-full h-48 bg-fill-ghost text-foreground border border-line rounded p-4 outline-none focus:border-theme-accent transition-colors resize-none font-sans text-lg leading-relaxed placeholder-text-dimmer"
              placeholder="brat and it's the same&#10;but there's three more songs..."
              value={rawLyrics}
              onChange={(e) => setRawLyrics(e.target.value)}
            />
            <button
              onClick={startSync}
              disabled={!audioUrl || rawLyrics.trim().length === 0}
              className="premium-btn py-3 w-full mt-4"
            >
              Start Manual Sync
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-2">
          {/* AI Align Button */}
          {syncedLines.length > 0 && (
            <div className="glass-panel flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex-1">
                 <label className="text-sm font-sans font-bold uppercase tracking-widest flex items-center gap-2 text-foreground mb-1">
                    <Sparkles className="w-4 h-4 text-theme-accent" /> Auto-Align Timestamps
                 </label>
                 <p className="text-text-dim font-sans text-sm leading-relaxed">
                   Don't want to press spacebar? Let Gemini map these lyrics to the audio for you.
                 </p>
               </div>
               <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                 <select 
                  className="bg-fill-ghost border border-line rounded px-3 py-2 font-mono text-xs outline-none focus:border-theme-accent text-foreground transition-colors"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  disabled={isGeminiSyncing}
                 >
                  <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                  <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                 </select>
                 <button 
                   onClick={() => handleGeminiSync(true)}
                   disabled={isGeminiSyncing || !audioUrl}
                   className="premium-btn px-6 py-2 flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
                 >
                   {isGeminiSyncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Aligning...</> : "✨ Align Now"}
                 </button>
               </div>
            </div>
          )}

          <div className="glass-panel p-2 h-64 overflow-y-auto space-y-2 relative custom-scrollbar">
            {isGeminiSyncing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-foreground font-sans font-bold text-lg">
                <Loader2 className="w-10 h-10 text-theme-accent animate-spin mb-4" />
                Gemini is listening to your audio...
              </div>
            )}
            <AnimatePresence>
          {syncedLines.map((line, i) => (
            <motion.div 
              key={line.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={clsx(
                "p-4 rounded-lg flex items-center justify-between transition-all border",
                i === currentIndex ? "bg-theme-accent/10 border-theme-accent shadow-[0_0_15px_rgba(var(--theme-accent-rgb),0.2)]" : 
                i < currentIndex ? "bg-fill-ghost border-line text-text-dim" : "bg-transparent border-transparent text-text-dimmer"
              )}
            >
              <div className="flex flex-col pr-4 overflow-hidden">
                <span className={clsx("font-sans text-xl font-bold truncate", i === currentIndex ? "text-foreground" : "")}>{line.text}</span>
                {mode === "sync" && currentIndex >= syncedLines.length && (
                  <div className="text-theme-accent/80 mt-1 font-mono text-xs uppercase tracking-widest">
                    Drag blocks on the waveform to adjust timings
                  </div>
                )}
              </div>
              <div className="flex items-center shrink-0">
                {i < currentIndex && <CheckCircle2 className="text-text-dim w-5 h-5 ml-4" />}
                {i === currentIndex && <span className="w-3 h-3 rounded-full bg-theme-accent animate-pulse shadow-[0_0_10px_rgba(var(--theme-accent-rgb),0.8)] ml-4"></span>}
                <button 
                  onClick={() => deleteLyric(i)} 
                  className="text-text-dim hover:text-red-400 ml-4 transition-colors outline-none focus:outline-none bg-transparent p-1 rounded-full hover:bg-red-400/10"
                  title="Remove this lyric"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
          {currentIndex >= syncedLines.length && syncedLines.length > 0 && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center mt-6 mb-4 gap-4">
               <div className="px-6 py-2 text-center font-mono text-sm uppercase tracking-widest text-theme-accent bg-theme-accent/10 rounded-full border border-theme-accent/30 animate-pulse">
                  Sync Complete!
               </div>
               <button 
                 onClick={() => {
                   onSyncComplete(syncedLines);
                   // Ensure regions state matches one final time just in case
                   setSyncedLines([...syncedLines]);
                 }}
                 className="premium-btn py-3 px-8"
               >
                 Apply Time Tweaks
               </button>
             </motion.div>
          )}
        </div>
        </div>
      )}
    </div>
  );
}

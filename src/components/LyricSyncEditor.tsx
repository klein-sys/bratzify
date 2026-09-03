"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, RotateCcw, CheckCircle2, Search, Loader2, X } from "lucide-react";
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
    <div className="w-full brutal-card p-6 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-bold brat-text text-accent-foreground">lyric studio.</h2>
        {mode === "sync" && currentIndex < syncedLines.length && (
          <span className="text-xl bg-accent-foreground text-theme-accent px-4 py-1 animate-pulse font-bold brat-text">
            hold spacebar to sync
          </span>
        )}
      </div>

      {audioUrl && (
        <div 
          className="bg-accent-foreground/5 p-4 border-4 border-accent-foreground relative outline-none focus:bg-accent-foreground/10 transition-colors" 
          tabIndex={0} 
          ref={wrapperRef}
        >
          <div ref={containerRef}></div>
          
          <div className="flex gap-4 items-center mt-4">
            <button
              onClick={togglePlay}
              className="bg-accent-foreground hover:bg-accent-foreground/80 transition-colors p-3 text-theme-accent"
            >
              {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6" fill="currentColor" />}
            </button>
            <div className="text-xl font-bold brat-text opacity-80 text-accent-foreground">
              {currentIndex}/{syncedLines.length} lines synced
            </div>
            
            {mode === "sync" && (
               <button onClick={() => { setMode("input"); setCurrentIndex(0); }} className="ml-auto flex items-center gap-2 text-xl opacity-70 hover:opacity-100 brat-text underline decoration-2 text-accent-foreground">
                  <RotateCcw className="w-5 h-5"/> reset sync
               </button>
            )}
          </div>
        </div>
      )}

      {mode === "input" ? (
        <div className="flex flex-col gap-6 mt-4">
          {/* Auto Sync Section */}
          <div className="bg-accent-foreground/5 p-4 border-4 border-accent-foreground">
            <label className="text-2xl font-bold brat-text flex items-center gap-2 mb-2 text-accent-foreground">
              <Search className="w-6 h-6" /> auto-sync (free)
            </label>
            <p className="text-accent-foreground/70 font-bold brat-text mb-4 leading-tight">
              Type the song name and artist to magically grab perfectly synced lyrics from the internet.
            </p>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. 360 charli xcx" 
                className="flex-1 bg-background border-4 border-foreground px-4 py-3 font-bold brat-text text-xl outline-none focus:bg-foreground/5 text-foreground placeholder-foreground/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAutoSync()}
              />
              <button 
                onClick={handleAutoSync}
                disabled={isSearching || !searchQuery}
                className="brutal-btn px-6 py-3 disabled:opacity-50 flex items-center gap-2"
              >
                {isSearching ? <><Loader2 className="animate-spin" /> searching...</> : "auto-sync"}
              </button>
            </div>
            {searchError && <p className="text-red-700 font-bold brat-text mt-2">{searchError}</p>}
          </div>

          <div className="flex items-center gap-4">
             <div className="flex-1 h-1 bg-accent-foreground/20"></div>
             <div className="font-bold brat-text text-xl text-accent-foreground/50">OR MANUAL SYNC</div>
             <div className="flex-1 h-1 bg-accent-foreground/20"></div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-2xl font-bold brat-text flex items-center gap-2 text-accent-foreground">
              paste lyrics
            </label>
            <textarea
              className="w-full h-48 bg-background text-foreground border-4 border-foreground placeholder-foreground/50 p-4 outline-none focus:bg-foreground/5 transition-colors resize-none brat-text text-4xl leading-[1.1]"
              placeholder="brat and it's the same&#10;but there's three more songs..."
              value={rawLyrics}
              onChange={(e) => setRawLyrics(e.target.value)}
            />
            <button
              onClick={startSync}
              disabled={!audioUrl || rawLyrics.trim().length === 0}
              className="brutal-btn py-4 text-3xl disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              start manual sync
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-transparent border-4 border-accent-foreground p-4 h-64 overflow-y-auto space-y-2">
          <AnimatePresence>
          {syncedLines.map((line, i) => (
            <motion.div 
              key={line.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={clsx(
                "p-3 flex items-center justify-between transition-colors border-2",
                i === currentIndex ? "bg-accent-foreground text-theme-accent border-accent-foreground" : 
                i < currentIndex ? "bg-transparent border-accent-foreground/20 text-accent-foreground/50" : "bg-transparent border-transparent text-accent-foreground/30"
              )}
            >
              <div className="flex flex-col">
                <span className="font-bold brat-text text-3xl">{line.text}</span>
                {mode === "sync" && currentIndex >= syncedLines.length && (
                  <div className="text-accent-foreground/70 mt-2 font-mono text-sm">
                    Drag blocks on the waveform above to adjust timings.
                  </div>
                )}
              </div>
              <div className="flex items-center">
                {i < currentIndex && <CheckCircle2 className="text-accent-foreground/50 w-6 h-6 ml-4" />}
                {i === currentIndex && <span className="w-4 h-4 rounded-full bg-theme-accent animate-pulse ml-4"></span>}
                <button 
                  onClick={() => deleteLyric(i)} 
                  className="text-red-500 hover:text-red-700 ml-4 bg-transparent outline-none focus:outline-none border-none p-1"
                  title="Remove this lyric"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
          {currentIndex >= syncedLines.length && syncedLines.length > 0 && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center mt-4 gap-2">
               <div className="p-4 text-center font-bold text-accent-foreground brat-text text-4xl animate-pulse">
                  sync complete!
               </div>
               <button 
                 onClick={() => {
                   onSyncComplete(syncedLines);
                   // Ensure regions state matches one final time just in case
                   setSyncedLines([...syncedLines]);
                 }}
                 className="brutal-btn px-4 py-2 text-xl"
               >
                 apply time tweaks
               </button>
             </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

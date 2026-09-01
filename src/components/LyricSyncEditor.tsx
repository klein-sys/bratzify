"use client";

import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, RotateCcw, CheckCircle2, Search, Loader2, X } from "lucide-react";
import clsx from "clsx";

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
    setSyncedLines((prev) => prev.filter((_, i) => i !== index));
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
    } catch (e) {
      setSearchError("Error searching for lyrics.");
    }
    setIsSearching(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "sync" || !wavesurferRef.current) return;
      
      if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") return;

      if (e.code === "Space") {
        e.preventDefault();
        const currentTime = wavesurferRef.current.getCurrentTime();
        
        if (!isPlaying) {
          wavesurferRef.current.play();
        } else {
          if (currentIndex < syncedLines.length) {
            setSyncedLines((prev) => {
              const newLines = [...prev];
              if (currentIndex > 0) {
                 newLines[currentIndex - 1].end = Math.min(newLines[currentIndex - 1].start + 5, currentTime);
              }
              newLines[currentIndex].start = currentTime;
              if (currentIndex === newLines.length - 1) {
                 newLines[currentIndex].end = currentTime + 5;
              }
              return newLines;
            });
            setCurrentIndex((prev) => prev + 1);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
    <div className="w-full bg-theme-accent border-4 border-foreground p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-4xl font-bold brat-text">lyric studio.</h2>
        {mode === "sync" && currentIndex < syncedLines.length && (
          <span className="text-xl bg-foreground text-theme-accent px-4 py-1 animate-pulse font-bold brat-text">
            tap spacebar to sync
          </span>
        )}
      </div>

      {audioUrl && (
        <div 
          className="bg-foreground/5 p-4 border-4 border-foreground relative outline-none focus:bg-foreground/10 transition-colors" 
          tabIndex={0} 
          ref={wrapperRef}
        >
          <div ref={containerRef}></div>
          
          <div className="flex gap-4 items-center mt-4">
            <button
              onClick={togglePlay}
              className="bg-foreground hover:bg-foreground/80 transition-colors p-3 text-theme-accent"
            >
              {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6" fill="currentColor" />}
            </button>
            <div className="text-xl font-bold brat-text opacity-80">
              {currentIndex}/{syncedLines.length} lines synced
            </div>
            
            {mode === "sync" && (
               <button onClick={() => { setMode("input"); setCurrentIndex(0); }} className="ml-auto flex items-center gap-2 text-xl opacity-70 hover:opacity-100 brat-text underline decoration-2">
                  <RotateCcw className="w-5 h-5"/> reset sync
               </button>
            )}
          </div>
        </div>
      )}

      {mode === "input" ? (
        <div className="flex flex-col gap-6 mt-4">
          {/* Auto Sync Section */}
          <div className="bg-foreground/5 p-4 border-4 border-foreground">
            <label className="text-2xl font-bold brat-text flex items-center gap-2 mb-2">
              <Search className="w-6 h-6" /> auto-sync (free)
            </label>
            <p className="text-foreground/70 font-bold brat-text mb-4 leading-tight">
              Type the song name and artist to magically grab perfectly synced lyrics from the internet.
            </p>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. 360 charli xcx" 
                className="flex-1 bg-background border-4 border-foreground px-4 py-3 font-bold brat-text text-xl outline-none focus:bg-foreground/5"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAutoSync()}
              />
              <button 
                onClick={handleAutoSync}
                disabled={isSearching || !searchQuery}
                className="bg-foreground text-theme-accent px-6 py-3 font-bold brat-text text-xl hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center gap-2"
              >
                {isSearching ? <><Loader2 className="animate-spin" /> searching...</> : "auto-sync"}
              </button>
            </div>
            {searchError && <p className="text-red-700 font-bold brat-text mt-2">{searchError}</p>}
          </div>

          <div className="flex items-center gap-4">
             <div className="flex-1 h-1 bg-foreground/20"></div>
             <div className="font-bold brat-text text-xl text-foreground/50">OR MANUAL SYNC</div>
             <div className="flex-1 h-1 bg-foreground/20"></div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-2xl font-bold brat-text flex items-center gap-2">
              paste lyrics
            </label>
            <textarea
              className="w-full h-48 bg-transparent border-4 border-foreground p-4 outline-none focus:bg-foreground/5 transition-colors resize-none brat-text text-4xl leading-[1.1]"
              placeholder="brat and it's the same&#10;but there's three more songs..."
              value={rawLyrics}
              onChange={(e) => setRawLyrics(e.target.value)}
            />
            <button
              onClick={startSync}
              disabled={!audioUrl || rawLyrics.trim().length === 0}
              className="bg-foreground text-theme-accent py-4 font-bold text-3xl brat-text disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-all mt-2 shadow-[4px_4px_0px_rgba(0,0,0,0.3)]"
            >
              start manual sync
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-transparent border-4 border-foreground p-4 h-64 overflow-y-auto space-y-2">
          {syncedLines.map((line, i) => (
            <div 
              key={line.id}
              className={clsx(
                "p-3 flex items-center justify-between transition-colors border-2",
                i === currentIndex ? "bg-foreground text-theme-accent border-foreground" : 
                i < currentIndex ? "bg-transparent border-foreground/20 text-foreground/50" : "bg-transparent border-transparent text-foreground/30"
              )}
            >
              <div className="flex flex-col">
                <span className="font-bold brat-text text-3xl">{line.text}</span>
                {mode === "sync" && currentIndex >= syncedLines.length && (
                  <div className="flex gap-2 items-center text-foreground/70 mt-2 font-mono text-sm">
                    <span>start:</span>
                    <input 
                      type="number" 
                      step="0.05"
                      className="w-16 bg-transparent border-b-2 border-foreground/50 text-center outline-none focus:border-foreground"
                      value={Number(line.start).toFixed(2)}
                      onChange={(e) => updateLyricTime(i, "start", parseFloat(e.target.value))}
                    />
                    <span className="ml-2">end:</span>
                    <input 
                      type="number" 
                      step="0.05"
                      className="w-16 bg-transparent border-b-2 border-foreground/50 text-center outline-none focus:border-foreground"
                      value={Number(line.end).toFixed(2)}
                      onChange={(e) => updateLyricTime(i, "end", parseFloat(e.target.value))}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center">
                {i < currentIndex && <CheckCircle2 className="text-foreground/50 w-6 h-6 ml-4" />}
                {i === currentIndex && <span className="w-4 h-4 rounded-full bg-theme-accent animate-pulse ml-4"></span>}
                <button 
                  onClick={() => deleteLyric(i)} 
                  className="text-red-500 hover:text-red-700 ml-4 bg-transparent outline-none focus:outline-none border-none p-1"
                  title="Remove this lyric"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          ))}
          {currentIndex >= syncedLines.length && syncedLines.length > 0 && (
             <div className="flex flex-col items-center mt-4 gap-2">
               <div className="p-4 text-center font-bold text-foreground brat-text text-4xl animate-pulse">
                  sync complete!
               </div>
               <button 
                 onClick={() => onSyncComplete(syncedLines)}
                 className="bg-foreground text-theme-accent px-4 py-2 font-bold brat-text text-xl hover:scale-[1.02] transition-transform"
               >
                 apply time tweaks
               </button>
             </div>
          )}
        </div>
      )}
    </div>
  );
}

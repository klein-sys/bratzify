"use client";

import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon } from "lucide-react";
import clsx from "clsx";

interface AudioUploaderProps {
  onAudioSelect: (url: string) => void;
}

export default function AudioUploader({ onAudioSelect }: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file && (file.type.includes("audio") || file.name.endsWith(".mp3") || file.name.endsWith(".wav"))) {
      try {
        setIsUploading(true);
        
        const formData = new FormData();
        formData.append("file", file);
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/upload`, {
          method: "POST",
          body: formData
        });
        
        const data = await res.json();
        
        if (res.ok && data.url) {
          onAudioSelect(data.url);
        } else {
          alert("Upload failed: " + (data.error || "Unknown error"));
        }
      } catch (error: any) {
        console.error(error);
        alert("Upload failed: " + (error.message || "Check console."));
      } finally {
        setIsUploading(false);
      }
    } else {
      alert("Please upload a valid audio file (.mp3 or .wav)");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput) {
      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("url", urlInput);
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/upload`, { method: "POST", body: formData });
        const data = await res.json();
        
        if (res.ok && data.url) {
          onAudioSelect(data.url);
          setUrlInput("");
        } else {
          alert("URL import failed: " + (data.error || "Unknown error"));
        }
      } catch (error) {
        console.error(error);
        alert("URL import failed. Check console.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <h2 className="text-xl font-bold font-sans uppercase tracking-widest text-foreground flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-theme-accent opacity-50" />
        Audio Source
      </h2>
      
      <div 
        className={clsx(
          "border border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all cursor-pointer border-line",
          isDragging ? "bg-theme-accent/10 border-theme-accent scale-[1.02]" : "hover:bg-fill-ghost hover:border-line-strong"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
           <div className="text-theme-accent font-mono text-sm uppercase tracking-widest animate-pulse">Uploading Track...</div>
        ) : (
           <>
             <Upload className="w-10 h-10 text-text-dim mb-4" />
             <p className="font-sans font-bold text-foreground text-lg tracking-tight">Drag & Drop Audio</p>
             <p className="text-xs text-text-dim font-mono mt-2 uppercase tracking-widest">.mp3 or .wav</p>
           </>
        )}
        <input 
          type="file" 
          accept="audio/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
      </div>

      <div className="mt-2 flex items-center justify-center gap-4">
        <div className="h-px bg-line flex-1"></div>
        <span className="font-mono text-xs text-text-dim uppercase tracking-widest">OR IMPORT</span>
        <div className="h-px bg-line flex-1"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="mt-2 flex flex-col sm:flex-row gap-3 items-end">
        <div className="relative flex-1 w-full">
          <LinkIcon className="absolute left-3 bottom-3 w-4 h-4 text-text-dim" />
          <input 
            type="url" 
            placeholder="Paste audio URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-fill-ghost border border-line rounded py-2 pl-9 pr-4 outline-none placeholder-text-dimmer text-foreground font-mono text-sm focus:border-theme-accent transition-colors"
          />
        </div>
        <button 
          type="submit"
          className="premium-btn w-full sm:w-auto"
        >
          Load
        </button>
      </form>
    </div>
  );
}


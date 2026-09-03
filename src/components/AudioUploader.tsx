"use client";

import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon } from "lucide-react";
import clsx from "clsx";
import { upload } from "@vercel/blob/client";

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
        
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
        
        const newBlob = await upload(filename, file, {
          access: 'public',
          handleUploadUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/upload/blob`,
        });
        
        onAudioSelect(newBlob.url);
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
    <div className="w-full brutal-card p-6">
      <h2 className="text-4xl font-bold mb-4 brat-text text-accent-foreground">load your track.</h2>
      
      <div 
        className={clsx(
          "border-4 border-dashed rounded-none p-8 flex flex-col items-center justify-center transition-all cursor-pointer border-accent-foreground",
          isDragging ? "bg-accent-foreground/10 scale-[1.02]" : "hover:bg-accent-foreground/5"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
           <div className="text-accent-foreground font-bold text-2xl brat-text animate-pulse">uploading track...</div>
        ) : (
           <>
             <Upload className="w-12 h-12 text-accent-foreground mb-4" />
             <p className="font-bold text-2xl brat-text text-accent-foreground">drag & drop audio</p>
             <p className="text-sm opacity-70 text-center font-mono mt-2 text-accent-foreground">.mp3 or .wav</p>
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

      <div className="mt-6 flex items-center justify-center gap-4">
        <div className="h-1 bg-accent-foreground flex-1"></div>
        <span className="font-bold lowercase brat-text text-xl text-accent-foreground">or</span>
        <div className="h-1 bg-accent-foreground flex-1"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="mt-6 flex gap-4 items-end">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-0 bottom-3 w-6 h-6 text-accent-foreground opacity-50" />
          <input 
            type="url" 
            placeholder="paste audio url..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-transparent border-b-4 border-accent-foreground py-2 pl-8 pr-4 outline-none placeholder-accent-foreground/50 text-accent-foreground brat-text text-2xl"
          />
        </div>
        <button 
          type="submit"
          className="brutal-btn px-6 py-2 text-2xl"
        >
          load
        </button>
      </form>
    </div>
  );
}

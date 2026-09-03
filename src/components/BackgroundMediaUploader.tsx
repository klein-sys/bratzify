"use client";

import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon, Loader2 } from "lucide-react";
import clsx from "clsx";
import { upload } from "@vercel/blob/client";

interface BackgroundMediaUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

export default function BackgroundMediaUploader({ value, onChange }: BackgroundMediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
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
          onChange(data.url);
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
      alert("Please upload a valid image or video file.");
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-[250px]">
      <div 
        className={clsx(
          "w-full border-4 border-dashed p-3 flex flex-col items-center justify-center transition-all cursor-pointer border-foreground bg-background",
          isDragging ? "bg-foreground/10 scale-[1.02]" : "hover:bg-foreground/5"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <div className="flex items-center gap-2 text-foreground font-bold font-mono text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> uploading...
          </div>
        ) : (
          <div className="flex items-center gap-2 text-foreground font-bold font-mono text-sm">
            <Upload className="w-4 h-4" /> drop image/video
          </div>
        )}
        <input 
          type="file" 
          accept="image/*,video/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <LinkIcon className="w-4 h-4 text-foreground opacity-50" />
        <input 
          type="text" 
          placeholder="or paste url..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 w-full border-4 border-foreground px-2 py-1 bg-background font-bold font-mono text-sm outline-none placeholder-foreground/50 text-foreground"
        />
      </div>
    </div>
  );
}

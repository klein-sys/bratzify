import React from "react";
import { AbsoluteFill, useVideoConfig, useCurrentFrame, Audio, interpolate } from "remotion";
import { SyncedLyric } from "../components/LyricSyncEditor";

export interface LyricTemplateProps {
  lyrics: SyncedLyric[];
  audioUrl?: string | null;
  startFrameOffset?: number;
}

export const BratzTemplate: React.FC<LyricTemplateProps> = ({ lyrics, audioUrl, startFrameOffset = 0 }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const globalFrame = frame + startFrameOffset;
  const currentTime = globalFrame / fps;

  // Find active lyric
  const activeLyricIndex = lyrics.findIndex(
    (l) => currentTime >= l.start && currentTime <= l.end
  );
  
  const activeLyric = activeLyricIndex !== -1 ? lyrics[activeLyricIndex] : null;

  const activeStartFrame = activeLyric ? activeLyric.start * fps : 0;
  const activeEndFrame = activeLyric ? activeLyric.end * fps : 1;
  const lineDurationInFrames = Math.max(1, activeEndFrame - activeStartFrame);
  const currentFrameInLine = Math.max(0, globalFrame - activeStartFrame);
  
  const words = activeLyric ? activeLyric.text.split(" ") : [];
  
  // Calculate a realistic reading duration for the line
  // 0.3 seconds per word, minimum 1 second, but never longer than the line itself
  const readingDurationInFrames = Math.min(
    lineDurationInFrames,
    Math.max(fps, words.length * fps * 0.3)
  );
  
  return (
    <AbsoluteFill style={{ backgroundColor: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem" }}>
      {audioUrl && <Audio src={audioUrl} startFrom={startFrameOffset} />}
      {activeLyric && (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }} key={activeLyric.id}>
          <h1 
            style={{ 
              fontSize: "160px",
              lineHeight: 0.9,
              color: "black",
              textTransform: "lowercase",
              width: "100%",
              transform: "scaleY(1.25)", 
              transformOrigin: "center",
              textAlign: "justify",
              textAlignLast: "justify",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontWeight: 400,
              letterSpacing: "-1.5px",
              filter: "blur(0.6px)",
              margin: 0
            }}
          >
            {words.map((word, index) => {
              // Calculate the exact frame this word should start appearing
              const frameWhenVisible = (index / words.length) * readingDurationInFrames;
              
              // Frame-accurate fade in using Remotion's interpolate over 6 frames (~0.2s)
              const opacity = interpolate(
                currentFrameInLine,
                [frameWhenVisible, frameWhenVisible + 6], 
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              
              return (
                <React.Fragment key={`${activeLyric.id}-${index}`}>
                  <span style={{ opacity }}>
                    {word}
                  </span>
                  {index < words.length - 1 ? " " : ""}
                </React.Fragment>
              );
            })}
          </h1>
        </div>
      )}
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useVideoConfig, useCurrentFrame, Audio, interpolate, spring } from "remotion";
import { SyncedLyric } from "../../components/LyricSyncEditor";

export interface FisheyeTemplateProps {
  lyrics: SyncedLyric[];
  audioUrl?: string | null;
  startFrameOffset?: number;
  textColor?: string;
  bgColor?: string;
  effect?: string;
}

export const FisheyeTemplate: React.FC<FisheyeTemplateProps> = ({ 
  lyrics, 
  audioUrl, 
  startFrameOffset = 0,
  textColor = "#FF7A00",
  bgColor = "#050505",
  effect = "none"
}) => {
  const { fps, width, height } = useVideoConfig();
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

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {audioUrl && <Audio src={audioUrl} startFrom={startFrameOffset} />}
      
      {/* Fisheye Lens Container */}
      <div 
        style={{ 
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "1400px",
          height: "1400px",
          borderRadius: "50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `inset 0 0 400px 150px ${bgColor}`, // Strong Vignette
        }}
      >
        {activeLyric && words.map((word, index) => {
          // Calculate distance from center (0 is center, 1 is edge)
          const centerIndex = (words.length - 1) / 2;
          const distanceFromCenter = Math.abs(index - centerIndex);
          const maxDistance = Math.max(1, centerIndex);
          const normalizedDistance = distanceFromCenter / maxDistance;
          
          // Bulge effect: center is largest, edges are smaller and squeezed
          const scale = 1 - (normalizedDistance * 0.4);
          const translateY = (index - centerIndex) * 20 * normalizedDistance;
          
          // Animate words popping in
          const wordStartFrame = (index / words.length) * Math.min(lineDurationInFrames, fps);
          const wordPop = spring({
            frame: currentFrameInLine - wordStartFrame,
            fps,
            config: { damping: 12, stiffness: 200 }
          });
          
          // Glitch effect on the center word
          const isCenter = index === Math.floor(centerIndex);
          const glitchOffset = isCenter && effect === "vhs" && currentFrameInLine % 10 < 3 
            ? (Math.random() > 0.5 ? 20 : -20) 
            : 0;

          return (
            <h1 
              key={index}
              style={{
                fontFamily: "Impact, sans-serif",
                fontSize: "200px",
                lineHeight: "0.85",
                textTransform: "lowercase",
                color: textColor,
                margin: 0,
                padding: 0,
                transform: `scale(${scale * wordPop}) translateY(${translateY}px) translateX(${glitchOffset}px)`,
                opacity: currentFrameInLine >= wordStartFrame ? 1 : 0,
                textShadow: effect === "vhs" ? `8px 0px 0px rgba(255,0,0,0.7), -8px 0px 0px rgba(0,0,255,0.7)` : "none",
                filter: `blur(${normalizedDistance * 3}px)`, // Outer words get slightly blurry
              }}
            >
              {word}
            </h1>
          );
        })}
      </div>

      {/* Effects Overlays */}
      {effect === "rain" && (
        <AbsoluteFill style={{ opacity: 0.3, pointerEvents: "none" }}>
          <svg width="100%" height="100%">
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.1 0.8" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="1 0 0 0 0, 1 0 0 0 0, 1 0 0 0 0, 0 0 0 3 -1" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noise)" transform={`translate(0, ${(globalFrame * 50) % 1920})`} />
            <rect width="100%" height="100%" filter="url(#noise)" transform={`translate(0, ${((globalFrame * 50) + 960) % 1920 - 1920})`} />
          </svg>
        </AbsoluteFill>
      )}

      {effect === "vhs" && (
        <AbsoluteFill style={{ opacity: 0.15, pointerEvents: "none", mixBlendMode: "screen" }}>
          <svg width="100%" height="100%">
            <filter id="static">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={globalFrame % 10} />
              <feColorMatrix type="matrix" values="1 0 0 0 0, 1 0 0 0 0, 1 0 0 0 0, 0 0 0 1 0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#static)" />
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

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
  
  // Calculate a realistic reading duration for the line (same as Bratz)
  const readingDurationInFrames = Math.min(
    lineDurationInFrames,
    Math.max(fps, words.length * fps * 0.3)
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {audioUrl && <Audio src={audioUrl} startFrom={startFrameOffset} />}
      
      {/* True SVG Spherical Fisheye Lens */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ overflow: "visible" }}>
          {/* Subtle vignette/glow behind the text */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={bgColor} stopOpacity="0" />
            <stop offset="100%" stopColor={bgColor} stopOpacity="1" />
          </radialGradient>
          <rect width="1080" height="1920" fill="url(#vignette)" pointerEvents="none" />
          
          {activeLyric && words.map((word, index) => {
            const centerIndex = (words.length - 1) / 2;
            const maxDistance = Math.max(1, centerIndex);
            
            const offsetFromCenter = index - centerIndex;
            const distanceRatio = Math.abs(offsetFromCenter) / maxDistance;
            
            const svgWidth = 1080;
            const svgHeight = 1920;
            const centerX = svgWidth / 2;
            const centerY = svgHeight / 2;
            
            // Safe vertical spacing
            const ySpacing = Math.min(180, 1000 / Math.max(1, words.length));
            const y = centerY + offsetFromCenter * ySpacing; 
            
            // Spherical bulge math: proportional wrap to guarantee paths never intersect!
            const wrapAmount = offsetFromCenter * (ySpacing * 0.4); 
            const endY = y - wrapAmount;
            const controlY = 2 * y - endY; 
            
            // Width mapping: center is huge, edges compress to form a perfect sphere
            // We multiply distanceRatio by 0.85 so the top/bottom poles never collapse to a 0-width vertical line!
            const sphereRatio = distanceRatio * 0.85;
            const pathWidth = 1000 * Math.sqrt(1 - Math.pow(sphereRatio, 2)); 
            const startX = centerX - pathWidth / 2;
            const endX = centerX + pathWidth / 2;
            
            const pathId = `path-${activeLyric.id}-${index}`;
            const pathD = `M ${startX} ${endY} Q ${centerX} ${controlY} ${endX} ${endY}`;
            
            const fontSize = Math.min(220, ySpacing * 0.9);
            
            // Bratz-style sequential fade-in
            const frameWhenVisible = (index / words.length) * readingDurationInFrames;
            const opacity = interpolate(
              currentFrameInLine,
              [frameWhenVisible, frameWhenVisible + 6], 
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            
            // Stretch horizontal based on estimated word width to fit the path
            const estimatedTextWidth = word.length * (fontSize * 0.55);
            const stretchFactor = pathWidth / Math.max(1, estimatedTextWidth);
            const safeScaleX = Math.min(3.5, Math.max(0.6, stretchFactor));
            const scaleY = 1 + (1 - distanceRatio) * 0.3; // center is slightly taller
            
            const glitchOffset = (index === Math.floor(centerIndex)) && effect === "vhs" && currentFrameInLine % 10 < 3 
              ? (Math.random() > 0.5 ? 20 : -20) 
              : 0;

            return (
              <g key={index}>
                <path id={pathId} d={pathD} fill="transparent" stroke="none" />
                <text 
                  fill={textColor}
                  style={{
                    fontFamily: "Impact, sans-serif",
                    fontSize: `${fontSize}px`,
                    textTransform: "lowercase",
                    opacity: opacity,
                    textShadow: effect === "vhs" ? `8px 0px 0px rgba(255,0,0,0.7), -8px 0px 0px rgba(0,0,255,0.7)` : "none",
                    filter: `blur(${distanceRatio * 2}px)`,
                    transformOrigin: `${centerX}px ${y}px`,
                    transform: `scale(${safeScaleX}, ${scaleY}) translateX(${glitchOffset}px)`,
                  }}
                >
                  <textPath 
                    href={`#${pathId}`} 
                    startOffset="50%" 
                    textAnchor="middle"
                  >
                    {word}
                  </textPath>
                </text>
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Effects Overlays */}
      {effect === "rain" && (
        <AbsoluteFill style={{ opacity: 0.15, pointerEvents: "none" }}>
          <svg width="100%" height="100%">
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.01 0.6" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="1 0 0 0 0, 1 0 0 0 0, 1 0 0 0 0, 0 0 0 3 -1" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noise)" transform={`translate(0, ${(globalFrame * 80) % 1920})`} />
            <rect width="100%" height="100%" filter="url(#noise)" transform={`translate(0, ${((globalFrame * 80) + 960) % 1920 - 1920})`} />
          </svg>
        </AbsoluteFill>
      )}

      {effect === "vhs" && (
        <AbsoluteFill style={{ opacity: 0.1, pointerEvents: "none", mixBlendMode: "screen" }}>
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

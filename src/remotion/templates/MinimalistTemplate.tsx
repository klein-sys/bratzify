import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";
import { SyncedLyric } from "../../../src/components/LyricSyncEditor";

const { fontFamily } = loadFont({
  ignoreTooManyRequestsWarning: true,
});

export interface MinimalistTemplateProps {
  lyrics: SyncedLyric[];
  templateOptions: Record<string, any>;
}

export const MinimalistTemplate: React.FC<MinimalistTemplateProps> = ({ lyrics, templateOptions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ambientColor = templateOptions.ambientColor || "#EAEAEA";

  // Slow ambient drift
  const slowDriftX = Math.sin(frame / 200) * 20;
  const slowDriftY = Math.cos(frame / 250) * 20;

  return (
    <AbsoluteFill style={{ backgroundColor: "#F7F6F3" }}>
      {/* Ambient Radial Gradient Blob */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${50 + slowDriftX}% ${50 + slowDriftY}%, ${ambientColor} 0%, transparent 70%)`,
          opacity: 0.8, // subtle depth
        }}
      />
      
      {/* Content */}
      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10%' }}>
        {lyrics.map((lyric, index) => {
          const startFrame = lyric.start * fps;
          const endFrame = lyric.end * fps;
          
          // Only render if currently active
          if (frame < startFrame || frame > endFrame) {
            return null;
          }

          // Gentle fade-in and subtle upward shift
          const entranceProgress = spring({
            fps,
            frame: frame - startFrame,
            config: {
              damping: 100,
              stiffness: 200,
              mass: 0.5,
            },
          });

          const fadeOutProgress = spring({
            fps,
            frame: frame - (endFrame - 15), // start fade out 15 frames before end
            config: {
              damping: 100,
              stiffness: 200,
              mass: 0.5,
            },
          });

          // Opacity goes 0 -> 1 on entrance, and 1 -> 0 on exit
          const opacity = frame < endFrame - 15 
            ? interpolate(entranceProgress, [0, 1], [0, 1])
            : interpolate(fadeOutProgress, [0, 1], [1, 0]);

          // Shift upwards 12px to 0px
          const translateY = interpolate(entranceProgress, [0, 1], [12, 0]);

          return (
            <div
              key={lyric.id}
              style={{
                position: 'absolute',
                fontFamily,
                fontSize: '80px',
                fontWeight: 500,
                color: '#111111',
                textAlign: 'center',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                maxWidth: '100%',
                opacity,
                transform: `translateY(${translateY}px)`,
                willChange: 'transform, opacity',
              }}
            >
              {lyric.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

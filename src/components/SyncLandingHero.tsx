import React, { useState } from "react";
import "./SyncLandingHero.css";

interface SyncLandingHeroProps {
  theme: string;
  toggleTheme: () => void;
  onLaunch: (query: string, useGemini: boolean) => void;
}

export default function SyncLandingHero({ theme, toggleTheme, onLaunch }: SyncLandingHeroProps) {
  const [songQuery, setSongQuery] = useState("");

  return (
    <div className="sync-root" data-theme={theme}>
      <section className="hero" aria-label="Lyric Sync Station">
        {/* Ambient video layer with reactive theme scrim */}
        <div className="hero__media" aria-hidden="true">
          <video
            className="hero__video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_132328_5f9029c8-218f-4489-82b6-29ff2849920e.png"
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4"
              type="video/mp4"
            />
          </video>
          <div className="hero__scrim" />
        </div>

        {/* Navigation */}
        <header className="hero__nav">
          <a href="#" className="hero__logo">
            BRATZIFY<span>.FM</span>
          </a>
          <div className="hero__nav-cluster">
            <nav className="hero__desktop-nav hidden md:flex">
              <a href="#studio" className="hero__link">
                Studio
              </a>
              <a href="#presets" className="hero__link">
                Templates
              </a>
              <a href="#docs" className="hero__link">
                API / Docs
              </a>
            </nav>

            {/* Theme Toggle Button */}
            <button
              type="button"
              className="hero__theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle dark/light mode"
            >
              [{theme === "dark" ? "LIGHT MODE" : "DARK MODE"}]
            </button>
          </div>
        </header>

        {/* Functional Sync Utility Panel */}
        <main className="hero__body">
          <div className="panel">
            <div className="panel__chip">[ LRCLIB & GEMINI SYNC ]</div>
            <h1 className="panel__title">SYNCID</h1>
            <p className="panel__tagline">
              Real-time millisecond lyric synchronization & 1080p export.
            </p>

            <form
              className="panel__form"
              onSubmit={(e) => {
                e.preventDefault();
                onLaunch(songQuery, false);
              }}
            >
              <label htmlFor="track-search" className="sr-only">
                Song title or LRCLIB track URL
              </label>
              <input
                id="track-search"
                type="text"
                placeholder="Track title, artist, or paste .lrc / audio URL"
                value={songQuery}
                onChange={(e) => setSongQuery(e.target.value)}
                className="panel__input"
              />
              <button type="submit" className="panel__btn panel__btn--solid">
                Launch Sync Studio
              </button>
              <button 
                type="button" 
                className="panel__btn panel__btn--ghost"
                onClick={() => onLaunch(songQuery, true)}
              >
                Auto-Sync with Gemini AI
              </button>
            </form>

            <div className="panel__shortcuts">
              <span>[SPACE] PLAY/PAUSE</span>
              <span>[ENTER] STAMP</span>
              <span>[Q/E] NUDGE</span>
            </div>
          </div>
        </main>

        {/* Legal / Engine Footer */}
        <footer className="hero__footer">
          <p className="hero__legal">
            Powered by <strong>Remotion</strong>, <strong>LRCLIB</strong>, and{" "}
            <strong>Gemini 3.7</strong>. All video rendering is containerized on cloud nodes.
          </p>
        </footer>
      </section>
    </div>
  );
}

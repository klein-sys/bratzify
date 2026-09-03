# 🍏 bratzify.fm

**bratzify.fm** is an open-source, brutalist web application that lets anyone instantly generate high-quality, aesthetic lyric videos for their favorite tracks. Inspired by modern hyperpop aesthetics (specifically the iconic "Brat" green), it provides a seamless, code-free experience for creating social-media-ready music videos right in the browser.

---

## 🎧 What it does

Bratzify eliminates the need for expensive, complex video editing software like Premiere Pro or After Effects just to make a simple lyric video. 

With Bratzify, you can:
1. **Upload any audio track** straight from your computer or phone.
2. **Auto-fetch & sync lyrics** perfectly to the beat using an interactive, real-time sync editor.
3. **AI Sync with Gemini** - Can't find the lyrics online? Use Gemini 3.7 Flash to instantly transcribe and timestamp your audio track natively!
4. **Customize the aesthetic** by choosing different templates (like the classic "Brat" style or the distorted "Fisheye"), picking custom colors, or uploading your own background media.
5. **Export to MP4** with a single click, and watch as a cloud engine renders your video in pristine 1080p quality, ready to post on TikTok, Instagram Reels, or YouTube Shorts.

---

## 🛠 Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Video Engine:** Remotion, FFmpeg
- **Backend:** Node.js, Express.js
- **AI/Transcriptions:** Google Gemini API (Gemini 1.5 Flash)
- **APIs:** LRCLIB (Lyrics syncing)
- **Infrastructure:** Vercel (Static Frontend), Render (Dockerized Backend)

---

## ⚙️ How it works

The project is built on a split-architecture design to ensure blazing-fast UI performance while handling incredibly heavy video rendering in the cloud.

### 1. The Interactive Frontend (Next.js & Vercel)
The user interface is built with **Next.js 15 (React)** and styled with **Tailwind CSS**. It is designed to be fully responsive, locking out mobile zooming for a native app feel. 
- It uses the open-source **LRCLIB API** to instantly fetch timestamped lyrics for whatever song you're syncing.
- It uses the **Remotion Player** to give you a live, 60fps preview of your video as you build it.
- This frontend is completely static (`output: export`) and hosted on **Vercel's Edge Network** for instant global loading times.

### 2. The Rendering Engine (Express.js & Render)
Video rendering requires massive CPU and memory resources, which standard serverless functions (like Vercel API routes) cannot handle. 
- When you click "Export", the frontend sends your audio and synced lyrics to a dedicated **Node.js/Express** backend hosted on **Render**.
- The backend uses **Remotion** to spawn a hidden **Google Chrome** browser in the background. It plays your video frame-by-frame and records the screen natively using `ffmpeg`.
- To survive cloud memory limits, the engine is carefully containerized inside **Docker** (Debian 12 Bookworm), with strict concurrency controls to prevent Out-Of-Memory crashes.

### 3. The Cloud Delivery (Vercel Blob)
- Once the backend finishes recording the frames and stitching the `.mp4` file, it securely uploads the final video directly to **Vercel Blob Storage**.
- The frontend is notified, and the video immediately pops up on your screen, ready to be downloaded!

---

## 🚀 Getting Started

If you want to clone this repository and run it locally, please refer to the [Setup Guide](setup.md) for full installation and deployment instructions!

# VoiceCV AI – Transcribe, Translate, and Build Multilingual Portfolios

VoiceCV AI is a modern, high-fidelity full-stack web application designed to help job-seekers bypass ATS filters effortlessly. Users can build professional resumes in minutes by simply speaking in any of the 10 major Indian regional languages or typing details.

---

## 🌟 Major Highlights & Features

- **Multilingual Voice Input Recorder**: Speak freely in native regional dialects (including Hindi, Tamil, Telugu, Marathi, Bengali, Urdu, Punjabi, etc.). Powered by **Sarvam AI STT** and backed by continuous Google **Gemini Multimodal Audio Transcription** fallbacks.
- **Dynamic Translation Network**: Voice inputs are automatically translated into professional, grammatically complete English formats. 
- **Google Gemini Resume Parser**: Converts raw conversational notes or voice transcripts into structured, field-by-field JSON outputs representing 20 mandatory Resume sections.
- **Live ATS Scorecard Matching**: Dynamically screens resumes against standard industry buzzwords and outputs visual circle progress matches, strengths lists, missing keywords, and recruiter recommendations.
- **Intelligent smart Layout Engine**: Provides Modern, Centered Classical, and Minimalist templates styled beautifully with zero clipped margins, page overlaps, or overflows.
- **Accurate multi-page PDF Export**: Integrates client-side high-resolution rendering with `html2canvas` and `jsPDF`.
- **Pre-recorded verbal AI feedback**: Generates textual feedback of resume readiness and synthesizes it aloud in the user's selected tongue using standard browser voice synthesizers.

---

## 📁 System Directory Layout

```text
/
├── server.ts              # Full-stack Custom Express backend (Mongoose setup & API gateways)
├── index.html             # React entry wrapper
├── metadata.json          # Standard application framing configurations
├── package.json           # Global dependencies & start/compiler script controls
├── tsconfig.json          # TypeScript workspace settings
├── vite.config.ts         # Vite bundler configurations
├── .env.example           # Example workspace secrets manifest
└── src/
    ├── main.tsx           # React client-side entry point
    ├── index.css          # Global Tailwind configurations & font family inclusions
    ├── App.tsx            # Main App layout, Home hero view, & dashboard route controller
    ├── types.ts           # Shared interfaces representing MongoDB resumes and calculations
    ├── components/
    │   ├── ResumePreview.tsx # Printable resume template renderers (Modern, Centered, Minimal)
    │   ├── VoiceInput.tsx    # Audio recorder, Sarvam integrations, & Speech synthesizers
    │   └── ATSAnalysis.tsx   # Visual progress meters detailing strengths & keyword suggestions
    └── lib/
        └── firebase.ts    # Firebase Authentication Google & Email proxy managers
```

---

## 🔑 Environment Variables & Secrets

The application reads all integrations dynamically. Create a `.env` in the root workspace directory matching the variable names below:

### Frontend Variables
```env
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
VITE_FIREBASE_PROJECT_ID="your_firebase_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
VITE_FIREBASE_APP_ID="your_firebase_app_id"
```

### Backend Secrets
```env
SARVAM_API_KEY="your_sarvam_developer_api_key"
GEMINI_API_KEY="your_google_ai_studio_gemini_api_key"
MONGODB_URI="your_mongodb_cluster_atlas_srv_connection_string"
PORT=3000
```

> **Note on Sandbox Fallbacks**:
> - If `MONGODB_URI` is not provided, the database gracefully and securely switches to a fully functional **In-Memory database layer** inside the server, preventing startup crashes.
> - If `SARVAM_API_KEY` is not provided, speech-to-text transcribing and translation will gracefully transition to **Google Gemini Multimodal Audio model processing**, guaranteeing 100% operation inside sandboxes immediately out of the box!

---

## 🚀 Local Development Setup Guide

### 1. Install Dependencies
Run the package installation command to populates the workspace:
```bash
npm install
```

### 2. Start the Development Server
Power up the dual-mode hot reloading full-stack server on port `3000`:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 3. Production Build Compilation
Compile the frontend static assets and pack the TS Express backend into a single bundled CommonJS standard node file:
```bash
npm run build
```

### 4. Direct Production Run
Start the production server:
```bash
npm run start
```

---

## 🌐 Production Deployment Guide

### Option A: Deployment to Render (Express Backend + Frontend Proxy)
Since the Express server (`server.ts`) integrates Vite middleware inside development, but serves fully-compiled static pages under `dist/` in production:
1. **Web Service Creation**: Add a new Web Service on Render and link your repository.
2. **Environment Variable Configuration**: Add all Backend & Frontend variables in Render's Env settings.
3. **Build Command**: Set Build command to:
   ```bash
   npm install && npm run build
   ```
4. **Start Command**: Set Start command to:
   ```bash
   npm run start
   ```

### Option B: Split Client Vercel Deployment (Alternative Client-Only)
If you prefer hosting static portfolios on Vercel:
1. Add a new project from your linked GitHub repository.
2. Configure all `VITE_FIREBASE_*` variables.
3. Set your Build command as `npm run build` and output directory as `dist`.

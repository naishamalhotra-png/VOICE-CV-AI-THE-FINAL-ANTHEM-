/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// NVIDIA NIM API
async function geminiGenerate(prompt: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY environment variable is required");

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.15,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA API error: ${err}`);
  }

  const data: any = await response.json();
  return data.choices[0].message.content;
}


function cleanJSON(raw: string): string {
  // Strip markdown code fences first
  let cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Extract the outermost JSON object — handles preamble/postamble from the model
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0].trim();

  // Replace literal control characters inside JSON string values.
  // The model occasionally emits raw \n/\t/\r inside a string rather than
  // the escaped \\n, causing JSON.parse to throw
  // "Bad control character in string literal at position N".
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === "\\") { result += ch; escaped = true; continue; }
    if (ch === "\"") { inString = !inString; result += ch; continue; }
    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
      if (ch.charCodeAt(0) < 0x20) continue; // strip other control chars
    }
    result += ch;
  }
  return result;
}

// ========================
// MIDDLEWARE
// ========================

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ========================
// DATABASE (Mongo + Memory fallback)
// ========================

const MONGODB_URI = process.env.MONGODB_URI;
let useMemoryDb = true;

const UserSchema = new mongoose.Schema({
  userId: String, email: String, name: String,
  createdAt: String, updatedAt: String,
});

const ResumeSchema = new mongoose.Schema({
  userId: String, title: String,
  resumeData: mongoose.Schema.Types.Mixed,
  atsScore: Number,
  atsAnalysis: mongoose.Schema.Types.Mixed,
  templateId: String,
  createdAt: String, updatedAt: String,
});

let MongoUser: any;
let MongoResume: any;

try { MongoUser  = mongoose.model("User",   UserSchema);   } catch { MongoUser  = mongoose.model("User");   }
try { MongoResume = mongoose.model("Resume", ResumeSchema); } catch { MongoResume = mongoose.model("Resume"); }

let memoryUsers:   any[] = [];
let memoryResumes: any[] = [];

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => { console.log("🍃 MongoDB connected"); useMemoryDb = false; })
    .catch((err) => { console.log("⚠️ MongoDB fallback to memory:", err.message); useMemoryDb = true; });
}

// ========================
// HELPERS
// ========================

function base64ToBuffer(base64: string) {
  return Buffer.from(base64, "base64");
}

// ========================
// AUTH SYNC (called by App.tsx on login)
// ========================

app.post("/api/auth", async (req, res) => {
  try {
    const { userId, email, name } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const now = new Date().toISOString();

    if (useMemoryDb) {
      const existing = memoryUsers.find(u => u.userId === userId);
      if (!existing) {
        memoryUsers.push({ userId, email, name, createdAt: now, updatedAt: now });
      }
      return res.json({ ok: true, userId });
    }

    await MongoUser.findOneAndUpdate(
      { userId },
      { userId, email, name, updatedAt: now },
      { upsert: true, new: true }
    );
    return res.json({ ok: true, userId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// SARVAM — Speech to Text
// ========================

app.post("/api/speech/transcribe", async (req, res) => {
  try {
    const { audio, languageCode } = req.body;
    if (!audio) return res.status(400).json({ error: "Audio required" });

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (!sarvamApiKey?.trim()) return res.status(400).json({ error: "Missing SARVAM_API_KEY" });

    console.log("🎙️ Using Sarvam STT...");

    const audioBuffer = base64ToBuffer(audio);
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");
    formData.append("language_code", languageCode || "hi-IN");
    formData.append("model", "saarika:v2.5"); // ✅ valid model

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": sarvamApiKey },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Sarvam STT error:", err);
      return res.status(503).json({ error: "Speech-to-text failed", details: err });
    }

    const data: any = await response.json();
    return res.json({ transcript: data.transcript || "" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// SARVAM — Translation
// ========================

app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (!sarvamApiKey?.trim()) return res.status(400).json({ error: "Missing SARVAM_API_KEY" });

    const response = await fetch("https://api.sarvam.ai/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": sarvamApiKey,
      },
      body: JSON.stringify({
        input: text,
        source_language_code: sourceLanguage || "hi-IN",
        target_language_code: targetLanguage || "en-IN",
        speaker_gender: "Male",
        mode: "formal",
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: "Translation failed", details: err });
    }

    const data: any = await response.json();
    return res.json({ translatedText: data.translated_text || "" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// SARVAM — Text to Speech
// ========================

app.post("/api/speech/synthesize", async (req, res) => {
  try {
    const { text, languageCode, speaker } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (!sarvamApiKey?.trim()) return res.status(400).json({ error: "Missing SARVAM_API_KEY" });

        const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": sarvamApiKey,
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: languageCode || "hi-IN",
        speaker: speaker || "anushka",
        pitch: 0,
        pace: 1.0,
        loudness: 1.5,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: "bulbul:v2",
      }),
    });

    if (!response.ok) {
  const err = await response.text();

  console.log("SARVAM TTS ERROR:");
  console.log(err);

  return res.status(response.status).json({
    error: err
  });
}

    const data: any = await response.json();

console.log(
  "SARVAM TTS RESPONSE:",
  JSON.stringify(data, null, 2)
);

return res.json({
  ...data,
  audio: data.audios?.[0] || null,
});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// GEMINI — Resume Generation
// ✅ Returns flat structure matching App.tsx expectations:
//    { personalInfo, experience, education, skills, projects,
//      certifications, achievements, languages, extracurriculars,
//      volunteer, references }
// ========================

app.post("/api/resume/generate", async (req, res) => {
  try {
    const { input, transcript, currentResumeData } = req.body;
    const userInput = input || transcript;

    if (!userInput) return res.status(400).json({ error: "input or transcript required" });

const existingContext = currentResumeData
  ? JSON.stringify({
      personalInfo: {
        name: currentResumeData.personalInfo?.name || "",
        jobTitle: currentResumeData.personalInfo?.jobTitle || "",
      },
      education: (currentResumeData.education || []).map((e: any) => ({
        school: e.school || "",
        degree: e.degree || "",
        fieldOfStudy: e.fieldOfStudy || "",
      })),
      experience: (currentResumeData.experience || []).map((e: any) => ({
        company: e.company || "",
        position: e.position || "",
      })),
    })
  : "{}";

const prompt = `
You are a professional resume writer and ATS optimization expert.

IMPORTANT: Generate the COMPLETE resume ONLY IN ENGLISH.
All fields must be in professional English regardless of input language.
Do not output Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Punjabi, Malayalam, Kannada, or any other regional language.
Translate any non-English content into professional resume-quality English before generating output.

EXISTING RESUME DATA (already collected from previous voice inputs):
${existingContext}

NEW VOICE INPUT to process:
"${userInput}"

CRITICAL MERGING RULES:
1. If the new input mentions a school/university already present in the existing education list, DO NOT create a new entry. Instead, return that same entry with any missing fields now filled in (degree, fieldOfStudy, dates, etc.).
2. If the new input mentions a company already present in the existing experience list, DO NOT create a new entry. Instead, return that entry with missing fields filled in.
3. Only create a NEW array entry when the institution or company is genuinely different from all existing ones.
4. Match by name similarity — "Manipal" matches "Manipal University", "Bal Bharati" matches "Bal Bharati Public School".

Return ONLY a valid JSON object (no markdown, no backticks, no explanation).
The JSON must exactly match this structure — App.tsx will merge it field by field:

{
  "personalInfo": {
    "name": "",
    "jobTitle": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "portfolio": "",
    "github": "",
    "summary": "ENGLISH ONLY. Write 2-3 sentences in professional English."
  },
  "experience": [
    {
      "company": "",
      "position": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "description": "bullet achievements starting with action verbs, one per line"
    }
  ],
  "education": [
    {
      "school": "",
      "degree": "",
      "fieldOfStudy": "",
      "startDate": "",
      "endDate": "",
      "description": ""
    }
  ],
  "skills": {
    "technical": [],
    "soft": []
  },
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": "",
      "link": ""
    }
  ],
  "certifications": [],
  "achievements": [],
  "languages": [],
  "extracurriculars": [],
  "volunteer": [],
  "references": ""
}

Rules:
- Use "" for missing strings, [] for missing arrays
- Keep arrays empty [] if nothing relevant is found — do not invent or copy placeholder data
- Start experience description bullets with strong action verbs
- Extract ALL technical skills and tools mentioned
- NEVER fill certifications, achievements, languages, or extracurriculars with example or placeholder text

FINAL CHECK: Every field must be in English only. The summary must be 2-3 professional English sentences.
`;
    const raw = await geminiGenerate(prompt);
    const parsed = JSON.parse(cleanJSON(raw));
    // Strip placeholder / empty certifications that the AI may still generate
if (Array.isArray(parsed.certifications)) {
  parsed.certifications = parsed.certifications
    .map((c: any) => {
      if (typeof c === "string") return { name: c, issuer: "", date: "", link: "" };
      return { name: c.name || "", issuer: c.issuer || "", date: c.date || "", link: c.link || "" };
    })
    .filter((c: any) =>
      c.name &&
      c.name.trim() !== "" &&
      c.name.toLowerCase() !== "certification name"   // catch the placeholder
    );
}
 
// Strip placeholder achievements / languages / extracurriculars
const placeholders = ["achievement 1", "language 1", "activity 1", "skill1", "skill2"];
const stripPlaceholders = (arr: string[]) =>
  (Array.isArray(arr) ? arr : []).filter(
    (s) => typeof s === "string" && s.trim() !== "" && !placeholders.includes(s.toLowerCase().trim())
  );
parsed.achievements    = stripPlaceholders(parsed.achievements);
parsed.languages       = stripPlaceholders(parsed.languages);
parsed.extracurriculars = stripPlaceholders(parsed.extracurriculars);

    // Normalize certifications: AI sometimes returns strings instead of objects
    if (Array.isArray(parsed.certifications)) {
      parsed.certifications = parsed.certifications.map((c: any) => {
        if (typeof c === "string") {
          return { name: c, issuer: "", date: "", link: "" };
        }
        return {
          name: c.name || "",
          issuer: c.issuer || "",
          date: c.date || "",
          link: c.link || "",
        };
      });
    }

    // Normalize skills: AI sometimes returns a flat array or wrong shape
    if (Array.isArray(parsed.skills)) {
      // e.g. ["React", "Node.js"] — treat whole list as technical
      parsed.skills = { technical: parsed.skills, soft: [] };
    } else if (!parsed.skills || typeof parsed.skills !== "object") {
      parsed.skills = { technical: [], soft: [] };
    } else {
      // Has the right shape but fields might be missing
      parsed.skills.technical = Array.isArray(parsed.skills.technical) ? parsed.skills.technical : [];
      parsed.skills.soft = Array.isArray(parsed.skills.soft) ? parsed.skills.soft : [];
    }

    // Normalize array fields — guard against AI returning strings
    const arrayFields = ["experience", "education", "projects", "achievements", "languages", "extracurriculars", "volunteer"];
    for (const field of arrayFields) {
      if (!Array.isArray(parsed[field])) parsed[field] = [];
    }

    // Return the flat structure directly — App.tsx merges it field by field
    return res.json(parsed);
  } catch (err: any) {
    console.error("Gemini resume error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// GEMINI — ATS Score
// ✅ Returns { score, breakdown, suggestions, keywords }
//    matching ATSAnalysisResult type in App.tsx
// ========================

app.post("/api/resume/ats", async (req, res) => {
  try {
    const { resumeData } = req.body;
    if (!resumeData) return res.status(400).json({ error: "resumeData required" });

    const prompt = `
Analyze this resume JSON and return an ATS (Applicant Tracking System) compatibility score.

RESUME:
${JSON.stringify(resumeData, null, 2)}

Return ONLY a valid JSON object (no markdown, no backticks, no explanation):
{
  "score": <number 0-100>,
  "breakdown": {
    "contactInfo": <0-10>,
    "summary": <0-15>,
    "experience": <0-25>,
    "education": <0-15>,
    "skills": <0-20>,
    "formatting": <0-15>
  },
  "suggestions": [
    "Specific actionable suggestion 1",
    "Specific actionable suggestion 2",
    "Specific actionable suggestion 3"
  ],
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
`;

    const raw = await geminiGenerate(prompt);
    const result = JSON.parse(cleanJSON(raw));
    return res.json(result);
  } catch (err: any) {
    console.error("ATS error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// GEMINI — Translate full resume data to regional language
// Called by App.tsx: POST /api/resume/translate-data
// ========================

app.post("/api/resume/translate-data", async (req, res) => {
  try {
    const { resumeData, targetLanguage } = req.body;
    if (!resumeData || !targetLanguage) {
      return res.status(400).json({ error: "resumeData and targetLanguage required" });
    }

    // If target is English, return as-is
    if (targetLanguage === "en-IN" || targetLanguage === "en-US") {
      return res.json(resumeData);
    }

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (!sarvamApiKey?.trim()) {
      return res.status(400).json({ error: "Missing SARVAM_API_KEY for translation" });
    }

    // Guard: don't translate if resume has no meaningful content yet
    const hasContent = resumeData.personalInfo?.name?.trim() ||
      resumeData.personalInfo?.summary?.trim() ||
      (resumeData.experience || []).length > 0;

    if (!hasContent) {
      return res.json(resumeData);
    }

    // Translate the summary and key text fields via Sarvam
    const translateText = async (text: string): Promise<string> => {
      if (!text || text.trim() === "") return text;
      try {
        const response = await fetch("https://api.sarvam.ai/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": sarvamApiKey,
          },
          body: JSON.stringify({
            input: text,
            source_language_code: "en-IN",
            target_language_code: targetLanguage,
            speaker_gender: "Male",
            mode: "formal",
            enable_preprocessing: true,
          }),
        });
        if (!response.ok) return text;
        const data: any = await response.json();
        return data.translated_text || text;
      } catch {
        return text;
      }
    };

    // Actually translate the key text fields
    const translated = {
      ...resumeData,
      personalInfo: {
        ...resumeData.personalInfo,
        summary: await translateText(resumeData.personalInfo?.summary || ""),
        jobTitle: await translateText(resumeData.personalInfo?.jobTitle || ""),
      },
      experience: await Promise.all(
        (resumeData.experience || []).map(async (exp: any) => ({
          ...exp,
          description: await translateText(exp.description || ""),
        }))
      ),
      education: await Promise.all(
        (resumeData.education || []).map(async (edu: any) => ({
          ...edu,
          description: await translateText(edu.description || ""),
        }))
      ),
      projects: await Promise.all(
        (resumeData.projects || []).map(async (proj: any) => ({
          ...proj,
          description: await translateText(proj.description || ""),
        }))
      ),
      achievements: await Promise.all(
        (resumeData.achievements || []).map((a: string) => translateText(a))
      ),
    };

    return res.json(translated);
  } catch (err: any) {
    console.error("Translate resume error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// GEMINI — Translate ATS analysis to regional language
// Called by App.tsx: POST /api/resume/translate-ats
// ========================

app.post("/api/resume/translate-ats", async (req, res) => {
  try {
    const { atsAnalysis, targetLanguage } = req.body;
    if (!atsAnalysis || !targetLanguage) {
      return res.status(400).json({ error: "atsAnalysis and targetLanguage required" });
    }

    if (targetLanguage === "en-IN" || targetLanguage === "en-US") {
      return res.json(atsAnalysis);
    }

    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (!sarvamApiKey?.trim()) {
      return res.status(400).json({ error: "Missing SARVAM_API_KEY" });
    }

    const translateText = async (text: string): Promise<string> => {
      if (!text || text.trim() === "") return text;
      try {
        const response = await fetch("https://api.sarvam.ai/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": sarvamApiKey,
          },
          body: JSON.stringify({
            input: text,
            source_language_code: "en-IN",
            target_language_code: targetLanguage,
            speaker_gender: "Male",
            mode: "formal",
            enable_preprocessing: true,
          }),
        });
        if (!response.ok) return text;
        const data: any = await response.json();
        return data.translated_text || text;
      } catch {
        return text;
      }
    };

    // Only translate text fields — breakdown is a numeric score object { contactInfo: 8, summary: 12, ... }
    // so we pass it through unchanged. Only suggestions (strings) need translation.
    const translated = {
      ...atsAnalysis,
      suggestions: await Promise.all(
        (atsAnalysis.suggestions || []).map((s: string) => translateText(s))
      ),
      keywords: await Promise.all(
        (atsAnalysis.keywords || []).map((k: string) => translateText(k))
      ),
      // breakdown is numeric scores — no translation needed
      breakdown: atsAnalysis.breakdown,
    };

    return res.json(translated);
  } catch (err: any) {
    console.error("Translate ATS error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// RESUME SAVE
// ✅ App.tsx sends: { _id, userId, title, resumeData, atsScore, atsAnalysis, templateId }
// ========================

app.post("/api/resume/save", async (req, res) => {
  try {
    const { _id, userId, title, resumeData, atsScore, atsAnalysis, templateId } = req.body;

    if (!userId || !resumeData) {
      return res.status(400).json({ error: "userId and resumeData are required" });
    }

    const now = new Date().toISOString();

    if (useMemoryDb) {
      // Update existing if _id provided
      if (_id) {
        const idx = memoryResumes.findIndex(r => r._id === _id);
        if (idx !== -1) {
          memoryResumes[idx] = { ...memoryResumes[idx], title, resumeData, atsScore, atsAnalysis, templateId, updatedAt: now };
          console.log(`💾 Resume updated in memory: ${_id}`);
          return res.json(memoryResumes[idx]);
        }
      }
      // Create new
      const doc = {
        _id: `resume_${Date.now()}`,
        id:  `resume_${Date.now()}`,
        userId,
        title: title || `Resume ${new Date().toLocaleDateString()}`,
        resumeData,
        templateId: templateId || "modern",
        atsScore: atsScore || 0,
        atsAnalysis: atsAnalysis || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryResumes.push(doc);
      console.log(`💾 Resume saved to memory for user ${userId}`);
      return res.json(doc);
    }

    // MongoDB upsert
    const doc = await MongoResume.findOneAndUpdate(
      { _id: _id || new mongoose.Types.ObjectId() },
      {
        userId,
        title: title || `Resume ${new Date().toLocaleDateString()}`,
        resumeData,
        templateId: templateId || "modern",
        atsScore: atsScore || 0,
        atsAnalysis: atsAnalysis || null,
        updatedAt: now,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, new: true }
    );

    console.log(`💾 Resume saved to MongoDB for user ${userId}`);
    return res.json(doc);
  } catch (err: any) {
    console.error("Resume save error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// RESUME LIST
// ✅ App.tsx calls: GET /api/resumes?userId=xxx
// ========================

app.get("/api/resumes", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId query param required" });

    if (useMemoryDb) {
      const list = memoryResumes
        .filter(r => r.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return res.json(list);
    }

    const list = await MongoResume.find({ userId }).sort({ updatedAt: -1 });
    return res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// RESUME DELETE
// ✅ App.tsx calls: DELETE /api/resume/:id
// ========================

app.delete("/api/resume/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (useMemoryDb) {
      const idx = memoryResumes.findIndex(r => r._id === id);
      if (idx === -1) return res.status(404).json({ error: "Resume not found" });
      memoryResumes.splice(idx, 1);
      return res.json({ success: true });
    }

    await MongoResume.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// HEALTH CHECK
// ========================

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    service: "VoiceCV AI",
    db: useMemoryDb ? "memory" : "mongodb",
    nvidia: !!process.env.NVIDIA_API_KEY,
    sarvam: !!process.env.SARVAM_API_KEY,
    ts: new Date().toISOString(),
  });
});

// ========================
// VITE / STATIC
// ========================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (_, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 VoiceCV AI running on port ${PORT}`);
    console.log(`📊 DB:     ${useMemoryDb ? "in-memory (no MONGODB_URI set)" : "MongoDB Atlas"}`);
    console.log(`🤖 NVIDIA: ${process.env.NVIDIA_API_KEY ? "✅ connected" : "❌ missing NVIDIA_API_KEY"}`);
    console.log(`🎙️  Sarvam: ${process.env.SARVAM_API_KEY ? "✅ connected" : "❌ missing SARVAM_API_KEY"}\n`);
  });
}

startServer();

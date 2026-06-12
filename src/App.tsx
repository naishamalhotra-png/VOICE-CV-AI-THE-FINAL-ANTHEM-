/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Mic,
  Sparkles,
  Award,
  Globe,
  Trash2,
  FolderLock,
  ArrowRight,
  BookOpen,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  CheckCircle,
  FileText,
  Bookmark,
  History,
  Download,
  LogOut,
  Sliders,
  ChevronRight,
  User,
  LayoutTemplate,
  Terminal,
  Cpu,
  Search,
  CheckCircle2,
  ChevronDown,
  Loader2
} from "lucide-react";

import { firebaseAuthHelper, WebUser } from "./lib/firebase";
import { ResumeData, ResumeTemplate, ATSAnalysisResult, SavedResume, initialResumeData } from "./types";
import ResumePreview from "./components/ResumePreview";
import VoiceInput from "./components/VoiceInput";
import ATSAnalysis from "./components/ATSAnalysis";

export default function App() {
  // Navigation & Sessions state
  const [currentUser, setCurrentUser] = useState<WebUser | null>(null);
  const [currentView, setCurrentView] = useState<"home" | "builder" | "history" | "auth">("home");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Resume builder Core states
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [resumeTitle, setResumeTitle] = useState("My Professional Resume");
  const [templateId, setTemplateId] = useState<string>(ResumeTemplate.MODERN);
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);

  // Lists & Score states
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [atsAnalysis, setAtsAnalysis] = useState<ATSAnalysisResult | undefined>(undefined);
  
  // UI Loading & feedback toggles
  const [isSTTLoading, setIsSTTLoading] = useState(false);
  const [isATSLoading, setIsATSLoading] = useState(false);
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Raw text console text entry
  const [manualRawText, setManualRawText] = useState("");
  const [isProcessingManualText, setIsProcessingManualText] = useState(false);

  // Active form section accordion tabs
  const [activeAccordion, setActiveAccordion] = useState<string>("personal");

  // Multi-page template settings and downloading alerts
  const [isDownloading, setIsDownloading] = useState(false);

  // Multilingual regional translation states
  const [selectedLang, setSelectedLang] = useState<string>(() => {
    return localStorage.getItem("voice_cv_session_lang") || "en-IN";
  });
  const [isTranslatingLocal, setIsTranslatingLocal] = useState(false);
  const [translatedResumeData, setTranslatedResumeData] = useState<ResumeData | null>(null);
  const [translatedAtsAnalysis, setTranslatedAtsAnalysis] = useState<ATSAnalysisResult | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);

  // Sync selectedLang to localStorage
  useEffect(() => {
    localStorage.setItem("voice_cv_session_lang", selectedLang);
  }, [selectedLang]);

  const translateFullResume = async (data: ResumeData) => {
    if (selectedLang === "en-IN" || selectedLang === "en-US") {
      setTranslatedResumeData(null);
      setShowTranslated(false);
      return;
    }
    setIsTranslatingLocal(true);
    try {
      const res = await fetch("/api/resume/translate-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeData: data,
          targetLanguage: selectedLang
        })
      });
      if (res.ok) {
        const translated = await res.json();
        setTranslatedResumeData(translated);
        setShowTranslated(true);
      } else {
        console.warn("Failed translating resume data to regional tongue.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslatingLocal(false);
    }
  };

  const translateFullAts = async (analysis: ATSAnalysisResult) => {
    if (selectedLang === "en-IN" || selectedLang === "en-US") {
      setTranslatedAtsAnalysis(null);
      return;
    }
    try {
      const res = await fetch("/api/resume/translate-ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          atsAnalysis: analysis,
          targetLanguage: selectedLang
        })
      });
      if (res.ok) {
        const translated = await res.json();
        setTranslatedAtsAnalysis(translated);
      } else {
        console.warn("Failed translating ATS scorecard to regional tongue.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Automatically trigger translations when language changes
  useEffect(() => {
    if (selectedLang !== "en-IN" && selectedLang !== "en-US") {
      if (resumeData && resumeData.personalInfo && resumeData.personalInfo.name) {
        translateFullResume(resumeData);
      }
      if (atsAnalysis) {
        translateFullAts(atsAnalysis);
      }
    } else {
      setTranslatedResumeData(null);
      setTranslatedAtsAnalysis(null);
      setShowTranslated(false);
    }
  }, [selectedLang]);

  // 1. Check logged sessions
  useEffect(() => {
    const unsub = firebaseAuthHelper.onUserChanged((user) => {
      setCurrentUser(user);
      if (user) {
        // Log profile in backend to satisfy specification schema
        fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            email: user.email,
            name: user.displayName,
          }),
        })
          .then((res) => res.json())
          .then((d) => console.log("Profile sync update logs:", d))
          .catch((e) => console.error(e));

        // Sync save database list
        fetchUserResumes(user.uid);
      } else {
        setSavedResumes([]);
      }
    });

    return () => unsub();
  }, []);

  // Sync users' resumes
  const fetchUserResumes = async (userId: string) => {
    try {
      const res = await fetch(`/api/resumes?userId=${userId}`);
      if (res.ok) {
        const list = await res.json();
        setSavedResumes(list);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getFriendlyAuthErrorMessage = (error: any): string => {
    let code = error?.code || "";
    // Check if error message holds Firebase auth code
    if (!code && error?.message) {
      const match = error.message.match(/auth\/[a-zA-Z0-9-]+/);
      if (match) {
        code = match[0];
      }
    }
    
    if (code) {
      if (code.includes("email-already-in-use")) {
        return "This email address is already in use by another account.";
      }
      if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found") || code.includes("invalid-email")) {
        return "Incorrect email or password. Please verify your credentials.";
      }
      if (code.includes("weak-password")) {
        return "The password is too weak. It must be at least 6 characters long.";
      }
      if (code.includes("operation-not-allowed")) {
        return "Email/Password sign-up is not enabled. Please enable the Email/Password sign-in method in your Firebase console.";
      }
      if (code.includes("user-disabled")) {
        return "This user account has been disabled.";
      }
      if (code.includes("too-many-requests")) {
        return "Access has been temporarily disabled due to many failed login attempts. Please try again later.";
      }
    }
    return error.message || "Authentication failed. Clear your parameters and submit again.";
  };

  // 2. Auth Actions handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    if (!authEmail || !authPassword) {
      setAuthError("Email and Password are required");
      setAuthLoading(false);
      return;
    }

    try {
      if (authMode === "login") {
        await firebaseAuthHelper.loginWithEmail(authEmail, authPassword);
        showSuccessMessage("Successfully signed in!");
      } else {
        await firebaseAuthHelper.registerWithEmail(authEmail, authPassword);
        showSuccessMessage("Account registered successfully!");
      }
      setCurrentView("builder");
    } catch (err: any) {
      setAuthError(getFriendlyAuthErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const signInWithGoogleHandler = async () => {
    setAuthError("");
    try {
      await firebaseAuthHelper.loginWithGoogle();
      showSuccessMessage("Signed in with Google!");
      setCurrentView("builder");
    } catch (err: any) {
      setAuthError(err.message || "Google authentication failed.");
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseAuthHelper.logoutSession();
      setCurrentView("home");
      setResumeData(initialResumeData);
      setActiveResumeId(null);
      setAtsAnalysis(undefined);
      setResumeTitle("My Professional Resume");
      showSuccessMessage("Successfully logged out");
    } catch (err) {
      console.error(err);
    }
  };

  // Temporary Toast feedback maker
  const showSuccessMessage = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 4000);
  };

  // 3. AI Builder Core processors
  // Handle STT voice output callback
  const handleVoiceTranscriptReceived = (englishText: string, regionalText: string) => {
    setManualRawText(englishText);
    // Automatically triggers Gemini parser to fill fields
    parseContentWithGeminiAI(englishText);
  };

  // Send raw text typing or transcript to generate structure
  const parseContentWithGeminiAI = async (textToParse: string) => {
    if (!textToParse || textToParse.trim() === "") return;
    setApiErrorMessage("");
    setIsProcessingManualText(true);

    try {
      const res = await fetch("/api/resume/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: textToParse,
          currentResumeData: {
            personalInfo: {
              name: resumeData.personalInfo.name,
              jobTitle: resumeData.personalInfo.jobTitle,
            },
            education: resumeData.education.map((e) => ({
              school: e.school,
              degree: e.degree,
              fieldOfStudy: e.fieldOfStudy,
            })),
            experience: resumeData.experience.map((e) => ({
              company: e.company,
              position: e.position,
            })),
          },
        }),
      });

      if (!res.ok) {
        const details = await res.json();
        throw new Error(details.error || "Failed to parse data");
      }

      const generatedData = await res.json();
      
      // Merge values safely to ensure we preserve other untouched components
      setResumeData((prev) => {
        const merged = { ...prev };
        if (generatedData.personalInfo) {
          merged.personalInfo = { ...prev.personalInfo, ...generatedData.personalInfo };
        }
// ── Education: entity-resolution merge ──────────────────────────────
if (generatedData.education && generatedData.education.length > 0) {
  const updatedEducation = [...prev.education];

  for (const newEdu of generatedData.education) {
    const newSchool = (newEdu.school || "").toLowerCase().trim();
    const newDegree = (newEdu.degree || "").toLowerCase().trim();

    // Skip if completely empty
    if (!newSchool && !newDegree && !newEdu.fieldOfStudy?.trim()) continue;

    // Find existing entry referring to the same institution
    const existingIdx = updatedEducation.findIndex((e) => {
      const s = (e.school || "").toLowerCase().trim();
      if (!s || !newSchool) return false;
      return s.includes(newSchool) || newSchool.includes(s);
    });

    if (existingIdx !== -1) {
      // Enrich existing entry — fill only blank fields
      const e = updatedEducation[existingIdx];
      updatedEducation[existingIdx] = {
        school:       e.school       || newEdu.school,
        degree:       e.degree       || newEdu.degree,
        fieldOfStudy: e.fieldOfStudy || newEdu.fieldOfStudy,
        startDate:    e.startDate    || newEdu.startDate,
        endDate:      e.endDate      || newEdu.endDate,
        description:  e.description  || newEdu.description,
      };
    } else {
      // Genuinely new institution — append
      updatedEducation.push(newEdu);
    }
  }

  merged.education = updatedEducation;
}

// ── Experience: entity-resolution merge ─────────────────────────────
if (generatedData.experience && generatedData.experience.length > 0) {
  const updatedExperience = [...prev.experience];

  for (const newExp of generatedData.experience) {
    const newCompany  = (newExp.company  || "").toLowerCase().trim();
    const newPosition = (newExp.position || "").toLowerCase().trim();

    // Skip if completely empty
    if (!newCompany && !newPosition) continue;

    const existingIdx = updatedExperience.findIndex((e) => {
      const c = (e.company || "").toLowerCase().trim();
      if (!c || !newCompany) return false;
      return c.includes(newCompany) || newCompany.includes(c);
    });

    if (existingIdx !== -1) {
      const e = updatedExperience[existingIdx];
      updatedExperience[existingIdx] = {
        company:   e.company   || newExp.company,
        position:  e.position  || newExp.position,
        location:  e.location  || newExp.location,
        startDate: e.startDate || newExp.startDate,
        endDate:   e.endDate   || newExp.endDate,
        // Append new description bullets rather than overwrite
        description: e.description
          ? e.description + (newExp.description ? "\n" + newExp.description : "")
          : newExp.description,
      };
    } else {
      updatedExperience.push(newExp);
    }
  }

  merged.experience = updatedExperience;
}

// ── Projects: deduplicate by name ────────────────────────────────────
if (generatedData.projects && generatedData.projects.length > 0) {
  const existingNames = new Set(prev.projects.map(p => p.name?.toLowerCase().trim()));
  const newProjects = generatedData.projects.filter(
    (p: any) => p.name?.trim() && !existingNames.has(p.name.toLowerCase().trim())
  );
  merged.projects = [...prev.projects, ...newProjects];
}

// ── Skills: deduplicated union ───────────────────────────────────────
if (generatedData.skills) {
  merged.skills = {
    technical: Array.from(new Set([
      ...(prev.skills?.technical || []),
      ...(generatedData.skills?.technical || []),
    ])),
    soft: Array.from(new Set([
      ...(prev.skills?.soft || []),
      ...(generatedData.skills?.soft || []),
    ])),
  };
}

// ── Certifications: deduplicate by name ──────────────────────────────
if (generatedData.certifications && generatedData.certifications.length > 0) {
  const existingCertNames = new Set(
    prev.certifications.map(c => c.name?.toLowerCase().trim())
  );
  const newCerts = generatedData.certifications.filter(
    (c: any) => c.name?.trim() && !existingCertNames.has(c.name.toLowerCase().trim())
  );
  merged.certifications = [...prev.certifications, ...newCerts];
}

// ── Simple deduplicated arrays ────────────────────────────────────────
if (generatedData.achievements && generatedData.achievements.length > 0) {
  merged.achievements = Array.from(new Set([...prev.achievements, ...generatedData.achievements]));
}
if (generatedData.languages && generatedData.languages.length > 0) {
  merged.languages = Array.from(new Set([...prev.languages, ...generatedData.languages]));
}
if (generatedData.extracurriculars && generatedData.extracurriculars.length > 0) {
  merged.extracurriculars = Array.from(new Set([...prev.extracurriculars, ...generatedData.extracurriculars]));
}

// ── Volunteer: deduplicate by organization ───────────────────────────
if (generatedData.volunteer && generatedData.volunteer.length > 0) {
  const existingOrgs = new Set(
    prev.volunteer.map(v => v.organization?.toLowerCase().trim())
  );
  const newVols = generatedData.volunteer.filter(
    (v: any) => v.organization?.trim() && !existingOrgs.has(v.organization.toLowerCase().trim())
  );
  merged.volunteer = [...prev.volunteer, ...newVols];
}

if (generatedData.references) {
  merged.references = generatedData.references;
}
        // Automatically translate the merged resume data if regional language is chosen
        setTimeout(() => {
          if (selectedLang !== "en-IN" && selectedLang !== "en-US") {
            translateFullResume(merged);
          }
        }, 0);

        return merged;
      });

      showSuccessMessage("AI successfully extracted resume fields!");

      // Auto run ATS scoring instantly to keep real-time UI updated
      triggerATSScoring(generatedData);

    } catch (err: any) {
      console.error(err);
      setApiErrorMessage(err.message || "AI engine busy. Feel free to edit the fields manually in the fields editor.");
    } finally {
      setIsProcessingManualText(false);
    }
  };

  // Run ATS analyzer
  const triggerATSScoring = async (dataToScore = resumeData) => {
    setIsATSLoading(true);
    setApiErrorMessage("");
    try {
      const res = await fetch("/api/resume/ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData: dataToScore }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response from ATS Engine");
      }

      const result: ATSAnalysisResult = await res.json();
      setAtsAnalysis(result);

      // Automatically translate ATS report if regional language is active
      if (selectedLang !== "en-IN" && selectedLang !== "en-US") {
        translateFullAts(result);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsATSLoading(false);
    }
  };

  // Save/Publish active resume changes in Atlas
  const saveResumeToDatabase = async () => {
    if (!currentUser) {
      // Prompt log
      setCurrentView("auth");
      return;
    }

    setIsSavingResume(true);
    setApiErrorMessage("");
    try {
      const payload = {
        _id: activeResumeId,
        userId: currentUser.uid,
        title: resumeTitle,
        resumeData: resumeData,
        atsScore: atsAnalysis?.score || 0,
        atsAnalysis: atsAnalysis || null,
        templateId: templateId
      };

      const res = await fetch("/api/resume/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Atlas save transaction failed.");
      }

      const saved: SavedResume = await res.json();
      setActiveResumeId(saved._id || saved.id || null);
      showSuccessMessage("Successful! Resume saved to MongoDB Atlas.");
      fetchUserResumes(currentUser.uid);
    } catch (err: any) {
      console.error(err);
      setApiErrorMessage(err.message || "Failed to commit resume updates.");
    } finally {
      setIsSavingResume(false);
    }
  };

  // Load a historic resume from list
  const loadSavedResume = (resume: SavedResume) => {
    setActiveResumeId(resume._id || resume.id || null);
    setResumeTitle(resume.title);
    setResumeData(resume.resumeData);
    setTemplateId(resume.templateId || "modern");
    setAtsAnalysis(resume.atsAnalysis);
    setCurrentView("builder");
    showSuccessMessage(`Loaded "${resume.title}"`);
  };

  // Delete a historic resume
  const deleteSavedResume = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this resume? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/resume/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showSuccessMessage("Resume deleted successfully");
        if (currentUser) fetchUserResumes(currentUser.uid);
        if (activeResumeId === id) {
          setActiveResumeId(null);
          setResumeData(initialResumeData);
          setAtsAnalysis(undefined);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create clean blank document
  const createNewResumeHandler = () => {
    setActiveResumeId(null);
    setResumeTitle("My New Resume Progress");
    setResumeData(initialResumeData);
    setTranslatedResumeData(null);
    setTranslatedAtsAnalysis(null);
    setShowTranslated(false);
    setAtsAnalysis(undefined);
    setManualRawText("");
    setCurrentView("builder");
    showSuccessMessage("Created new clean resume!");
  };

  // Accordion sub-field inline manual editor change handling
  const handlePersonalInfoChange = (field: keyof typeof resumeData.personalInfo, value: string) => {
    setResumeData((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value,
      },
    }));
  };

  // Trigger manual score recalculated
  useEffect(() => {
    // Delay score update slightly to capture final typings
    if (resumeData.personalInfo.name) {
      const timer = setTimeout(() => {
        triggerATSScoring(resumeData);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [resumeData]);

  // General Navbar component
  const renderNavbar = () => {
    return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/30 backdrop-blur-3xl shadow-[0_0_40px_rgba(34,211,238,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={() => setCurrentView("home")}
            className="flex items-center gap-2.5 cursor-pointer transition active:scale-95 group"
          >
           <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.45)] transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
              <Mic className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white font-display">
              VoiceCV<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 font-extrabold font-display">.AI</span>
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setCurrentView("home")} className={`text-sm font-semibold transition ${currentView === "home" ? "text-cyan-400" : "text-slate-500 hover:text-white"} cursor-pointer`}>
              Home
            </button>
            <button onClick={() => { setCurrentView("builder"); setActiveAccordion("personal"); }} className={`text-sm font-semibold transition ${currentView === "builder" ? "text-cyan-400" : "text-slate-500 hover:text-white"} cursor-pointer`}>
              Resume Builder
            </button>
            {currentUser && (
              <button onClick={() => setCurrentView("history")} className={`text-sm font-semibold transition ${currentView === "history" ? "text-cyan-400" : "text-slate-500 hover:text-white"} cursor-pointer`}>
                Saved Resumes
              </button>
            )}
            <a href="#features-deck" onClick={() => { if (currentView !== "home") setCurrentView("home"); }} className="text-sm font-semibold text-slate-500 hover:text-white transition cursor-pointer">
              Features
            </a>
          </nav>

          {/* Auth CTA Trigger Button */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div onClick={() => setCurrentView("history")} className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 cursor-pointer hover:bg-white/5 transition shadow-sm animate-fade-in">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-300">{currentUser.displayName || currentUser.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  id="btn-signout"
                  className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 transition text-sm font-semibold cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setAuthMode("login"); setCurrentView("auth"); }}
                id="btn-nav-signin"
                className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:from-cyan-300 hover:to-fuchsia-400 text-white text-xs font-bold px-6 py-2.5 rounded-full glow-cyan transition-all duration-200 active:scale-95 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>
    );
  };

  // Homepage view renderer
  const renderHomeView = () => {
    return (
      <div className="flex flex-col gap-16 py-10 antialiased">
        {/* Hero Area */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 py-12 relative">
          <div className="absolute inset-x-0 top-0 h-[420px] grid-backdrop pointer-events-none -z-10"></div>
         <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.04] border border-cyan-400/20 backdrop-blur-xl text-cyan-300 text-xs font-bold uppercase tracking-[0.25em] shadow-[0_0_30px_rgba(34,211,238,0.12)]"></div>
            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></span>
            Empowered by Sarvam AI & NVIDIA AI
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight max-w-5xl mx-auto leading-[1.05] font-display">
            Build Professional ATS-Friendly Resumes{" "}
            <span className="gradient-text-animated font-serif italic font-normal">
              With Your Voice.
            </span>
          </h1>
          
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-light">
            Speak in any Indian regional language. Our system transcribes, structures, translates to English, and compiles printable job portfolios in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                if (currentUser) {
                  setCurrentView("builder");
                } else {
                  setAuthMode("register");
                  setCurrentView("auth");
                }
              }}
              id="btn-hero-build-resume"
              className="w-full sm:w-auto bg-gradient-to-r from-cyan-400 to-fuchsia-500 hover:from-cyan-300 hover:to-fuchsia-400 text-white font-bold text-sm px-8 py-3.5 rounded-full glow-cyan transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              Build Resume Now <ArrowRight className="w-4.5 h-4.5" />
            </button>
            
            {!currentUser && (
              <button
                onClick={() => { setAuthMode("login"); setCurrentView("auth"); }}
                className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-sm px-8 py-3.5 rounded-full shadow-sm transition active:scale-95 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </section>

        {/* Steps visual workflow */}
        <section className="bg-white/[0.02] backdrop-blur-xl border-y border-white/5 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-2 mb-12">
              <h2 className="text-2xl font-bold text-white font-display">How It Works</h2>
              <p className="text-xs text-slate-500 font-medium">Transform voice to a stellar certified resume in four simple steps</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { step: "01", title: "Select Local Tone", desc: "Choose your native speech language (Hindi, Tamil, Marathi, Punjabi, etc.) from our menu." },
                { step: "02", title: "Speak Audibly", desc: "Describe your job, projects, credentials, and achievements into the microphone." },
                { step: "03", title: "AI Real-time Structuring", desc: "Sarvam & AI translate and format details into 20 mandatory fields." },
                { step: "04", title: "Review & Save", desc: "Fine-tune with live ATS scoring suggestions, select your template, and download standard PDF." }
              ].map((item, idx) => (
                <div key={idx} className="group bg-white/[0.04] backdrop-blur-2xl p-7 rounded-[30px] border border-white/10 shadow-2xl shadow-black/30 relative space-y-4 transition-all duration-500 hover:-translate-y-4 hover:scale-[1.03] hover:border-cyan-400/40 hover:shadow-[0_0_50px_rgba(34,211,238,0.15)]">
                  <span className="text-3xl font-black gradient-text font-display block">{item.step}</span>
                  <h3 className="font-bold text-white text-sm">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features deck */}
        <section id="features-deck" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 py-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-white font-display">Platform Features</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">Everything you need to successfully bypass automatic corporate filters.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Multilingual Voice Input", desc: "Supports Hindi, Telugu, Marathi, Bengali, Urdu, and more. Describe values comfortably in your native tongue." },
              { title: "AI Resume Generation", desc: "AI parses transcripts instantly into verified professional executive summary headers." },
              { title: "ATS Score Analysis", desc: "Detailed breakdown of formatting mistakes, missing buzzwords, and actual compatibility scores." },
              { title: "Professional Templates", desc: "Select Modern, Centered Professional, or Minimalist standard templates tailored for recruitment." },
              { title: "PDF Export", desc: "Direct multi-page PDF rendering via jsPDF. Accurate typography layouts ready for submissions." },
              { title: "Accessibility First", desc: "Clear layouts, dynamic verbal speech audio feedback translation loop, and responsive grids." },
              { title: "Real-Time Preview", desc: "Every edit in details updates the active templates instantly. Know exactly how it looks before saving." },
              { title: "AI Content Enhancement", desc: "Automatically translates conversational speech transcripts into standard recruiter action items." }
            ].map((feat, idx) => (
              <div key={idx} className="group p-7 rounded-[30px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-xl shadow-black/20 hover:border-cyan-400/40 hover:-translate-y-3 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(34,211,238,0.12)] transition-all duration-500 space-y-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-fuchsia-500/15 flex items-center justify-center text-cyan-400">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-sm font-bold text-white">{feat.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-light">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Home CTA footer */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="bg-gradient-to-tr from-slate-950 via-violet-950 to-fuchsia-950 py-16 rounded-3xl border border-white/10 shadow-xl shadow-fuchsia-900/30 text-white text-center px-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(34,211,238,0.22),transparent_55%)] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(232,121,249,0.18),transparent_55%)] pointer-events-none"></div>
            <div className="max-w-4xl mx-auto space-y-6 relative z-10">
              <h3 className="text-3xl sm:text-4xl font-extrabold font-display">Ready to Craft an Interview-Ready Resume?</h3>
              <p className="text-cyan-200 text-sm max-w-lg mx-auto font-light">Skip the tedious typing and write your summary simply using your own regional voice.</p>
              <button
                onClick={() => {
                  if (currentUser) {
                    setCurrentView("builder");
                  } else {
                    setAuthMode("register");
                    setCurrentView("auth");
                  }
                }}
                className="bg-white text-violet-950 hover:bg-cyan-100 font-bold text-xs px-8 py-4 rounded-full shadow transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  };

  // Auth pages view
  const renderAuthView = () => {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="glass-panel p-8 rounded-2xl shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">
              {authMode === "login" ? "Welcome Back to VoiceCV" : "Create Your VoiceCV Account"}
            </h2>
            <p className="text-xs text-slate-500">
              {authMode === "login"
                ? "Sign in to save and retrieve your custom resume histories."
                : "Create an account to unlock cloud storage integrations."}
            </p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 text-rose-300 text-xs p-3.5 rounded-lg border border-rose-500/30">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Email address</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="developer@example.com"
                className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 shadow-inner"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Security Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="********"
                className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              id="btn-auth-submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl glow-cyan transition cursor-pointer"
            >
              {authLoading ? "Synchronizing database security..." : authMode === "login" ? "Sign In" : "Register Credentials"}
            </button>
          </form>

          {/* Google Sign In Auth */}
          <div className="space-y-4 pt-2">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-xs font-medium text-slate-500">or use single sign-on</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              onClick={signInWithGoogleHandler}
              id="btn-google-auth-trigger"
              className="w-full bg-white/[0.03] hover:bg-white/5 text-slate-300 hover:text-white border border-white/10 font-medium text-xs py-2.5 rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google (Secure Session)
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => setAuthMode((prev) => (prev === "login" ? "register" : "login"))}
              className="text-xs font-semibold text-cyan-400 hover:underline cursor-pointer"
            >
              {authMode === "login" ? "Don't have an account? Sign up" : "Already registered? Log in"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Historic lists dashboard View
  const renderHistoryView = () => {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex justify-between items-center glass-panel p-4 rounded-xl shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
              <History className="w-5 h-5 text-slate-500" />
              Your Generated Resumes History
            </h2>
            <p className="text-xs text-slate-500">Previously saved portfolios stored securely in MongoDB Atlas.</p>
          </div>
          <button
            onClick={createNewResumeHandler}
            className="bg-cyan-500 hover:bg-cyan-400 text-white font-medium text-xs px-4 py-2 rounded-lg cursor-pointer"
          >
            + Create New
          </button>
        </div>

        {savedResumes.length === 0 ? (
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl py-12 text-center text-slate-500 space-y-2">
            <FileText className="w-12 h-12 mx-auto text-slate-200" />
            <h3 className="font-semibold text-slate-300 text-sm">No Saved Portfolios Found</h3>
            <p className="text-xs max-w-xs mx-auto text-slate-500">
              Create a new resume in the builder and click "Save to Database" to preserve your historic records dynamically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedResumes.map((resume) => (
              <div
                key={resume._id}
                onClick={() => loadSavedResume(resume)}
                className="glass-panel p-5 rounded-2xl hover:border-cyan-400/40 shadow-sm hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer transition flex flex-col justify-between gap-4 select-none"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{new Date(resume.updatedAt || "").toLocaleDateString()}</span>
                    {resume.atsScore ? (
                      <span className="bg-cyan-500/10 border border-fuchsia-500/20 text-fuchsia-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Score: {resume.atsScore}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-bold text-white text-sm leading-snug break-all">{resume.title}</h3>
                  <p className="text-xs text-slate-500 truncate">Candidate: {resume.resumeData?.personalInfo?.name || "Anonymous"}</p>
                </div>

                <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-1 text-xs">
                  <span className="text-cyan-400 font-medium hover:underline flex items-center gap-1">Update fields <ChevronRight className="w-3 h-3" /></span>
                  <button
                    onClick={(e) => deleteSavedResume(resume._id || "", e)}
                    className="p-1 px-2 hover:bg-white/5 text-slate-500 hover:text-rose-600 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Main Builder Page View
  const renderBuilderView = () => {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        
        {/* Workspace controllers bar */}
        <div className="glass-panel p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <LayoutTemplate className="w-5 h-5 text-cyan-400" />
            <input
              type="text"
              value={resumeTitle}
              onChange={(e) => setResumeTitle(e.target.value)}
              className="text-base font-bold text-white bg-transparent border-b border-dashed border-white/10 focus:border-cyan-400 focus:outline-none w-full sm:max-w-xs font-display"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {selectedLang !== "en-IN" && selectedLang !== "en-US" && (translatedResumeData || isTranslatingLocal) && (
              <div className="flex items-center gap-1 bg-cyan-500/10 border border-fuchsia-500/20 p-1 rounded-lg mr-2 shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTranslated(false)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${!showTranslated ? "bg-white/10 text-cyan-300 shadow-sm" : "text-slate-500 hover:text-slate-200"}`}
                >
                  English View
                </button>
                <button
                  type="button"
                  onClick={() => setShowTranslated(true)}
                  disabled={isTranslatingLocal}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 ${showTranslated ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-200"}`}
                >
                  {isTranslatingLocal ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Localizing...
                    </>
                  ) : (
                    <span>Regional ({selectedLang.split("-")[0].toUpperCase()})</span>
                  )}
                </button>
              </div>
            )}
            <button
              onClick={createNewResumeHandler}
              className="bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer"
            >
              Clear Slate
            </button>
            <button
              onClick={saveResumeToDatabase}
              disabled={isSavingResume}
              id="btn-save-database"
              className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-lg glow-cyan cursor-pointer flex items-center gap-1.5"
            >
              {isSavingResume ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5" /> Save to Database (MongoDB)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Builder Panels Core split column: Forms Inputs vs Printable Page Layout Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel col (Speech module & Manual Form fields editor) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Audio transcription recorder module */}
            <VoiceInput
              onTranscriptReceived={handleVoiceTranscriptReceived}
              isLoading={isSTTLoading}
              setIsLoading={setIsSTTLoading}
              selectedLang={selectedLang}
              setSelectedLang={setSelectedLang}
            />

            {/* Alternating Manual typing assistant terminal console */}
            <div className="glass-panel p-5 rounded-2xl shadow-sm space-y-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">Manual Typing Assistant Console</span>
                <p className="text-xs text-slate-500 mt-1">Don't want to speak? Just copy-paste any unstructured text profile here, and AI will organize it instantly.</p>
              </div>
              <textarea
                value={manualRawText}
                onChange={(e) => setManualRawText(e.target.value)}
                placeholder="Paste biographical info, LinkedIn text, or bullet notes here..."
                rows={4}
                className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 font-mono"
              />
              <button
                onClick={() => parseContentWithGeminiAI(manualRawText)}
                disabled={isProcessingManualText || !manualRawText}
                id="btn-manual-parse-trigger"
                className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl glow-cyan flex items-center justify-center gap-1.5 pointer-events-auto cursor-pointer"
              >
                {isProcessingManualText ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    AI structuring values...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-300" />
                    Submit to AI Parser
                  </>
                )}
              </button>
            </div>

            {/* Dynamic visual parameters accordion manually override values */}
            <div className="glass-panel rounded-2xl shadow-sm overflow-hidden divide-y divide-white/5">
              <div className="p-4 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Interactive Fields override</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">20 ATS Fields verified</span>
              </div>

              {/* Accordion 1: Personal Info overriding */}
              <div>
                <button
                  onClick={() => setActiveAccordion((prev) => (prev === "personal" ? "" : "personal"))}
                  className="w-full p-4 flex justify-between items-center text-left hover:bg-white/[0.03] transition cursor-pointer"
                >
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" /> 1. General Contact & Role Summary
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${activeAccordion === "personal" ? "transform rotate-180" : ""}`} />
                </button>

                {activeAccordion === "personal" && (
                  <div className="p-4 bg-transparent space-y-4 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Full Name</label>
                        <input
                          type="text"
                          value={resumeData.personalInfo.name}
                          onChange={(e) => handlePersonalInfoChange("name", e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Target Job Title</label>
                        <input
                          type="text"
                          value={resumeData.personalInfo.jobTitle}
                          onChange={(e) => handlePersonalInfoChange("jobTitle", e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Email</label>
                        <input
                          type="email"
                          value={resumeData.personalInfo.email}
                          onChange={(e) => handlePersonalInfoChange("email", e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={resumeData.personalInfo.phone}
                          onChange={(e) => handlePersonalInfoChange("phone", e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">LinkedIn link</label>
                        <input
                          type="text"
                          value={resumeData.personalInfo.linkedin}
                          onChange={(e) => handlePersonalInfoChange("linkedin", e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Portfolio link</label>
                        <input
                          type="text"
                          value={resumeData.personalInfo.portfolio}
                          onChange={(e) => handlePersonalInfoChange("portfolio", e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Current Location</label>
                      <input
                        type="text"
                        value={resumeData.personalInfo.location}
                        onChange={(e) => handlePersonalInfoChange("location", e.target.value)}
                        placeholder="New Delhi, India"
                        className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Executive summary summary</label>
                      <textarea
                        value={resumeData.personalInfo.summary}
                        onChange={(e) => handlePersonalInfoChange("summary", e.target.value)}
                        rows={3}
                        className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Professional work experience details */}
              <div>
                <button
                  onClick={() => setActiveAccordion((prev) => (prev === "experience" ? "" : "experience"))}
                  className="w-full p-4 flex justify-between items-center text-left hover:bg-white/[0.03] transition cursor-pointer"
                >
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-cyan-400" /> 2. Industrial Work History ({resumeData.experience.length})
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${activeAccordion === "experience" ? "transform rotate-180" : ""}`} />
                </button>

                {activeAccordion === "experience" && (
                  <div className="p-4 bg-transparent space-y-4 border-t border-white/5">
                    {resumeData.experience.map((exp, idx) => (
                      <div key={idx} className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-2 relative">
                        <button
                          onClick={() => {
                            setResumeData((prev) => ({
                              ...prev,
                              experience: prev.experience.filter((_, i) => i !== idx),
                            }));
                          }}
                          className="absolute top-2 right-2 text-slate-500 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <p className="text-xs font-bold text-slate-200">Job Entry #{idx + 1}</p>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Company Name"
                            value={exp.company}
                            onChange={(e) => {
                              const updated = [...resumeData.experience];
                              updated[idx].company = e.target.value;
                              setResumeData((prev) => ({ ...prev, experience: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-slate-200 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Designation / Position"
                            value={exp.position}
                            onChange={(e) => {
                              const updated = [...resumeData.experience];
                              updated[idx].position = e.target.value;
                              setResumeData((prev) => ({ ...prev, experience: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="text"
                            placeholder="Dates (e.g. May 2024)"
                            value={exp.startDate}
                            onChange={(e) => {
                              const updated = [...resumeData.experience];
                              updated[idx].startDate = e.target.value;
                              setResumeData((prev) => ({ ...prev, experience: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-[10px] text-slate-200"
                          />
                          <input
                            type="text"
                            placeholder="End Date or 'Present'"
                            value={exp.endDate}
                            onChange={(e) => {
                              const updated = [...resumeData.experience];
                              updated[idx].endDate = e.target.value;
                              setResumeData((prev) => ({ ...prev, experience: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-[10px] text-slate-200"
                          />
                          <input
                            type="text"
                            placeholder="Location"
                            value={exp.location}
                            onChange={(e) => {
                              const updated = [...resumeData.experience];
                              updated[idx].location = e.target.value;
                              setResumeData((prev) => ({ ...prev, experience: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-[10px] text-slate-200"
                          />
                        </div>

                        <textarea
                          placeholder="Bullet Achievements description (use action verbs)"
                          rows={2}
                          value={exp.description}
                          onChange={(e) => {
                            const updated = [...resumeData.experience];
                            updated[idx].description = e.target.value;
                            setResumeData((prev) => ({ ...prev, experience: updated }));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        setResumeData((prev) => ({
                          ...prev,
                          experience: [
                            ...prev.experience,
                            { company: "", position: "", location: "", startDate: "", endDate: "", description: "" },
                          ],
                        }));
                      }}
                      className="bg-white/5 hover:bg-white/10 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-medium transition block border border-white/10"
                    >
                      + Add Work Entry
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 3: Academic education records */}
              <div>
                <button
                  onClick={() => setActiveAccordion((prev) => (prev === "education" ? "" : "education"))}
                  className="w-full p-4 flex justify-between items-center text-left hover:bg-white/[0.03] transition cursor-pointer"
                >
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-cyan-400" /> 3. Education Profile ({resumeData.education.length})
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${activeAccordion === "education" ? "transform rotate-180" : ""}`} />
                </button>

                {activeAccordion === "education" && (
                  <div className="p-4 bg-transparent space-y-4 border-t border-white/5">
                    {resumeData.education.map((edu, idx) => (
                      <div key={idx} className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-2 relative">
                        <button
                          onClick={() => {
                            setResumeData((prev) => ({
                              ...prev,
                              education: prev.education.filter((_, i) => i !== idx),
                            }));
                          }}
                          className="absolute top-2 right-2 text-slate-500 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <p className="text-xs font-bold text-slate-200">Academic Institution #{idx + 1}</p>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="College / School Name"
                            value={edu.school}
                            onChange={(e) => {
                              const updated = [...resumeData.education];
                              updated[idx].school = e.target.value;
                              setResumeData((prev) => ({ ...prev, education: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-slate-200 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Degree (e.g. Master's)"
                            value={edu.degree}
                            onChange={(e) => {
                              const updated = [...resumeData.education];
                              updated[idx].degree = e.target.value;
                              setResumeData((prev) => ({ ...prev, education: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="text"
                            placeholder="Field of Study"
                            value={edu.fieldOfStudy}
                            onChange={(e) => {
                              const updated = [...resumeData.education];
                              updated[idx].fieldOfStudy = e.target.value;
                              setResumeData((prev) => ({ ...prev, education: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-[10px] text-slate-200"
                          />
                          <input
                            type="text"
                            placeholder="Start Date"
                            value={edu.startDate}
                            onChange={(e) => {
                              const updated = [...resumeData.education];
                              updated[idx].startDate = e.target.value;
                              setResumeData((prev) => ({ ...prev, education: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-[10px] text-slate-200"
                          />
                          <input
                            type="text"
                            placeholder="End Date"
                            value={edu.endDate}
                            onChange={(e) => {
                              const updated = [...resumeData.education];
                              updated[idx].endDate = e.target.value;
                              setResumeData((prev) => ({ ...prev, education: updated }));
                            }}
                            className="bg-white/5 border border-white/10 rounded p-1.5 text-[10px] text-slate-200"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        setResumeData((prev) => ({
                          ...prev,
                          education: [
                            ...prev.education,
                            { school: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", description: "" },
                          ],
                        }));
                      }}
                      className="bg-white/5 hover:bg-white/10 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-medium transition block border border-white/10"
                    >
                      + Add Education Entry
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 4: Skills and Keywords list override */}
              <div>
                <button
                  onClick={() => setActiveAccordion((prev) => (prev === "skills" ? "" : "skills"))}
                  className="w-full p-4 flex justify-between items-center text-left hover:bg-white/[0.03] transition cursor-pointer"
                >
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-cyan-400" /> 4. Keywords & Core Skills
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${activeAccordion === "skills" ? "transform rotate-180" : ""}`} />
                </button>

                {activeAccordion === "skills" && (
                  <div className="p-4 bg-transparent space-y-4 border-t border-white/5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Technical Skills & Software Tools (Comma separated)</label>
                      <input
                        type="text"
                        value={resumeData.skills?.technical?.join(", ")}
                        onChange={(e) => {
                          const list = e.target.value.split(",").map(s => s.trim()).filter(s => s.length > 0);
                          setResumeData((prev) => ({
                            ...prev,
                            skills: { ...(prev.skills || { soft: [] }), technical: list }
                          }));
                        }}
                        className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Professional Soft Skills (Comma separated)</label>
                      <input
                        type="text"
                        value={resumeData.skills?.soft?.join(", ")}
                        onChange={(e) => {
                          const list = e.target.value.split(",").map(s => s.trim()).filter(s => s.length > 0);
                          setResumeData((prev) => ({
                            ...prev,
                            skills: { ...(prev.skills || { technical: [] }), soft: list }
                          }));
                        }}
                        className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error messaging inside workspace panel */}
            {apiErrorMessage && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-xl text-xs leading-relaxed font-light">
                {apiErrorMessage}
              </div>
            )}

            {/* General system status credit details */}
            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] shadow-inner flex items-center justify-between gap-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> API Sync Standard</span>
              <span className="font-light">ATS Level v4.5</span>
            </div>

          </div>

          {/* Right Preview Pane column container */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Template select tabs */}
            <div className="glass-panel p-5 rounded-2xl shadow-sm space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Select Portfolio Theme Layout</span>
                <p className="text-xs text-slate-500 mt-1">Select an ATS-compliant template structure mapped to standard recruiter parsers.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: ResumeTemplate.MODERN, label: "Modern Split", desc: "Two column modern" },
                  { id: ResumeTemplate.PROFESSIONAL, label: "Centered Classic", desc: "Academic aligned standard" },
                  { id: ResumeTemplate.MINIMAL, label: "Minimalist Slate", desc: "High-contrast clean spacing" }
                ].map((temp) => (
                  <button
                    key={temp.id}
                    onClick={() => setTemplateId(temp.id)}
                    className={`p-3 rounded-xl border text-left transition ${
                      templateId === temp.id
                        ? "border-cyan-400 bg-cyan-500/5 shadow-sm"
                        : "border-white/10 hover:border-cyan-400/40"
                    } cursor-pointer`}
                  >
                    <span className="text-xs font-bold text-white block">{temp.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">{temp.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live ATS rating report card */}
            <ATSAnalysis
              analysis={showTranslated && translatedAtsAnalysis ? translatedAtsAnalysis : atsAnalysis}
              isLoading={isATSLoading}
            />

            {/* Standard template printer viewer */}
            <ResumePreview
              data={showTranslated && translatedResumeData ? translatedResumeData : resumeData}
              templateId={templateId}
              onDownloadStart={() => setIsDownloading(true)}
              onDownloadEnd={() => setIsDownloading(false)}
            />

          </div>

        </div>

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-between font-sans text-slate-200 relative overflow-x-hidden antialiased">
      
      {/* Decors & Ambient Blurs for Artistic Flair design */}
      <div className="absolute top-[-5%] right-[-5%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl opacity-60 z-0 pointer-events-none"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-fuchsia-500/10 rounded-full blur-3xl opacity-60 z-0 pointer-events-none"></div>
      <div className="absolute top-[40%] right-[-10%] w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-3xl opacity-50 z-0 pointer-events-none"></div>

      {/* Dynamic Navbar */}
      <div className="relative z-10 w-full">
        {renderNavbar()}
      </div>

      {/* Floating success confirmation feedback node */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm glass-panel text-white p-4 rounded-xl shadow-2xl slide-in-bottom flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold leading-relaxed">{successToast}</span>
        </div>
      )}

      {/* Active layout viewer switch routing panel */}
      <main className="flex-grow relative z-10">
        {currentView === "home" && renderHomeView()}
        {currentView === "builder" && renderBuilderView()}
        {currentView === "history" && renderHistoryView()}
        {currentView === "auth" && renderAuthView()}
      </main>

      {/* Standard brand information footer */}
      <footer className="border-t border-white/10 bg-slate-950/60 backdrop-blur-xl relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="text-base font-extrabold tracking-tight text-white font-display">
              VoiceCV<span className="text-cyan-400">.AI</span>
            </span>
            <p className="text-xs text-slate-500 max-w-sm font-light">
              Designing premium ATS certified modern multilingual portfolio interfaces using high-fidelity regional vocal recognition.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-slate-500">
            <a onClick={() => setCurrentView("home")} className="hover:text-white transition cursor-pointer">About</a>
            <a onClick={() => { setCurrentView("builder"); }} className="hover:text-white transition cursor-pointer">Interactive Builder</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a>
            <a className="hover:text-white transition cursor-pointer">Privacy Policy</a>
          </div>
        </div>
        
        <div className="border-t border-white/5 py-4 bg-white/[0.03] text-center text-[11px] text-slate-500">
          <span>© 2026 VoiceCV AI Web App Inc. All Rights Reserved.</span>
        </div>
      </footer>

    </div>
  );
}

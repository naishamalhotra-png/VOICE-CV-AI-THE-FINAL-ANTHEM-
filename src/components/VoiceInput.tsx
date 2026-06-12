/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Volume2, Globe, Sparkles, Check, Play, Pause } from "lucide-react";

interface VoiceInputProps {
  onTranscriptReceived: (englishText: string, regionalText: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  selectedLang: string;
  setSelectedLang: (val: string) => void;
}

const INDIAN_LANGUAGES = [
  { code: "en-IN", name: "English", nativeName: "English" }, 
  { code: "hi-IN", name: "Hindi (हिन्दी)", nativeName: "हिन्दी" },
  { code: "mr-IN", name: "Marathi (मराठी)", nativeName: "मराठी" },
  { code: "ta-IN", name: "Tamil (தமிழ்)", nativeName: "தமிழ்" },
  { code: "te-IN", name: "Telugu (తెలుగు)", nativeName: "తెలుగు" },
  { code: "bn-IN", name: "Bengali (বাংলা)", nativeName: "বাংলা" },
  { code: "gu-IN", name: "Gujarati (ગુજરાતી)", nativeName: "ગુજરાતી" },
  { code: "pa-IN", name: "Punjabi (ਪੰਜਾਬੀ)", nativeName: "ਪੰਜਾਬੀ" },
  { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)", nativeName: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam (മലയാളം)", nativeName: "മലയാളം" },
  { code: "ur-IN", name: "Urdu (اردو)", nativeName: "اردو" }
];

export default function VoiceInput({
  onTranscriptReceived,
  isLoading,
  setIsLoading,
  selectedLang,
  setSelectedLang,
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [regionalTranscript, setRegionalTranscript] = useState("");
  const [englishTranslation, setEnglishTranslation] = useState("");
  const [aiSpeechFeedback, setAiSpeechFeedback] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorText, setErrorText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Sync browser SpeechSynthesis status
  useEffect(() => {
    const handleSilence = () => {
      if (!window.speechSynthesis.speaking) {
        setIsSpeaking(false);
      }
    };
    const interval = setInterval(handleSilence, 500);
    return () => clearInterval(interval);
  }, []);

  // Web Speech Synthesis (read regional feedback aloud)
const speakFeedbackAloud = async (textToSpeak: string) => {
  if (!textToSpeak) return;

  try {
    setIsSpeaking(true);

    // Use browser speech synthesis for English (Sarvam TTS doesn't support English)
    if (selectedLang === "en-IN" || selectedLang === "en-US") {
      // Ensure voices are loaded before speaking (Chrome loads them async)
      const speakWhenReady = () => {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "en-US";
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.cancel(); // Clear any stuck queue first
        window.speechSynthesis.speak(utterance);
        // Safety timeout in case onend never fires
        setTimeout(() => setIsSpeaking(false), (textToSpeak.length / 10) * 1000 + 3000);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        speakWhenReady();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          speakWhenReady();
        };
        // Fallback if onvoiceschanged never fires (e.g. Firefox)
        setTimeout(speakWhenReady, 500);
      }
      return;
    }

    const response = await fetch("/api/speech/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textToSpeak,
        languageCode: selectedLang,
      }),
    });

    const result = await response.json();

    if (!result.audio) {
      throw new Error("No audio returned");
    }

    currentAudioRef.current = new Audio(
      `data:audio/wav;base64,${result.audio}`
    );

    currentAudioRef.current.onended = () => setIsSpeaking(false);

    await currentAudioRef.current.play();

  } catch (err) {
    console.error("TTS Error:", err);
    setIsSpeaking(false);
  }
};

  const stopSpeakingAloud = () => {
    try {
      window.speechSynthesis.cancel();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsSpeaking(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Start microphone voice recorder
  const startRecordingHandler = async () => {
    stopSpeakingAloud(); // Stop any active AI speech feedback before starting recording
    audioChunksRef.current = [];
    setErrorText("");
    setRecordDuration(0);

    // For English, use browser Web Speech API directly (Sarvam doesn't support English)
    if (selectedLang === "en-IN" || selectedLang === "en-US") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setErrorText("Browser speech recognition not supported. Please type your input instead.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      setIsRecording(true);
      let resultReceived = false;
      recognition.onresult = (event: any) => {
        resultReceived = true;
        const transcript = event.results[0][0].transcript;
        setIsRecording(false);
        setRegionalTranscript(transcript);
        setEnglishTranslation(transcript);
        onTranscriptReceived(transcript, transcript);
        setIsLoading(false);
        speakFeedbackAloud("Resume structured successfully in English!");
      };
      recognition.onerror = (event: any) => {
        setIsRecording(false);
        setIsLoading(false);
        if (event.error === "no-speech") {
          setErrorText("No speech detected. Please try again and speak clearly.");
        } else {
          setErrorText("Voice recognition failed. Please try again or type your input.");
        }
      };
      recognition.onend = () => {
        setIsRecording(false);
        if (!resultReceived) setIsLoading(false);
      };
      recognition.start();
      return;
    }

    try {
      // Prompt permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm", // Use highly-compatible webm container
      });

      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Collect recorded audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);

        // Convert Blob to Base64 to communicate standard JSON with full-stack proxy
        setIsLoading(true);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const rawBase64 = (reader.result as string).split(",")[1];
          await processVoiceInput(rawBase64);
        };
      };

      // Trigger recording chunks every 250ms
      mediaRecorder.start(250);
      setIsRecording(true);

      // Start duration counter
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 44) {
            stopRecordingHandler();
            setErrorText("Recording limit reached (45s). Processing now...");
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error: any) {
      console.error("Mic access denied:", error);
      setErrorText("Microphone permission denied. Please allow microphone permissions in metadata configuration.");
    }
  };

  // Stop recording
  const stopRecordingHandler = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // Stop all mic tracks
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  // Process voice base64 buffer via Node.js Gateway
  const processVoiceInput = async (base64Audio: string) => {
    try {
      // Step 1: Speech to Text (Regional language output)
      const transcribeRes = await fetch("/api/speech/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64Audio, languageCode: selectedLang }),
      });

      if (!transcribeRes.ok) {
        const errorDetail = await transcribeRes.json();
        throw new Error(errorDetail.error || "STT Transcription failed");
      }

      const { transcript } = await transcribeRes.json();
      if (!transcript || transcript.trim() === "") {
        throw new Error("No voice detected. Please speak clearly into the microphone.");
      }

      setRegionalTranscript(transcript);

      // Step 2: Translate Regional Language -> English
      const translationRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          sourceLanguage: selectedLang,
          targetLanguage: "en-IN",
        }),
      });

      if (!translationRes.ok) {
        let serverError = "Failed to translate regional text into English.";
        try {
          const errDetail = await translationRes.json();
          serverError = errDetail.error || serverError;
        } catch (_) {
          try {
            const rawText = await translationRes.text();
            if (rawText) serverError = rawText;
          } catch (_) {}
        }
        throw new Error(serverError);
      }

      const { translatedText } = await translationRes.json();
      setEnglishTranslation(translatedText);

      // Inform App Resume generator about completed transcript
      onTranscriptReceived(translatedText, transcript);

      // Step 3: Informative regional AI voice feedback
      const langName = INDIAN_LANGUAGES.find(l => l.code === selectedLang)?.nativeName || "Regional language";
      const userText = `Resume structured successfully in English!`;
      
      // Translate this feedback success confirmation message back to original regional language
      const feedbackTranslationRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Success! I have processed your speech. Your professional resume details have been extracted and added to your portfolio preview successfully. You can now edit the sections or choose other formats below.`,
          sourceLanguage: "en-IN",
          targetLanguage: selectedLang,
        }),
      });

      if (feedbackTranslationRes.ok) {
        const result = await feedbackTranslationRes.json();
        setAiSpeechFeedback(result.translatedText);
        // Play audio confirmation in selected regional tongue
        speakFeedbackAloud(result.translatedText);
      }

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "An error occurred during voice analysis. Using text typing is highly recommended as a fallback.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
  <div
  id="voice-input-panel"
  className="relative overflow-hidden bg-white/[0.04] backdrop-blur-3xl p-8 rounded-[32px] border border-white/10 shadow-[0_0_60px_rgba(34,211,238,0.08)] flex flex-col gap-8"
>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-3 font-display tracking-tight">
            <Globe className="w-5 h-5 text-cyan-400" />
            Speak and Build Multilingual Resume
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose your preferred Indian regional language, click the mic, and describe your profile details aloud.
          </p>
        </div>

        {/* Regional Language Select */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isSpeaking && (
            <button
              onClick={stopSpeakingAloud}
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition shadow-sm cursor-pointer shrink-0 animate-pulse"
              title="Immediately stop all active verbal reading"
            >
              <Pause className="w-3.5 h-3.5 fill-current" /> Stop Voice
            </button>
          )}
          <span className="text-xs font-medium text-slate-500 font-sans">Language:</span>
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            disabled={isRecording || isLoading}
            className="bg-white/[0.05] backdrop-blur-xl border border-white/10 text-slate-200 text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 max-w-[220px] shadow-lg shadow-cyan-500/5 cursor-pointer transition-all duration-300 hover:border-cyan-400/30"
            >
            {INDIAN_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Center Card */}
      <div className="relative overflow-hidden flex flex-col items-center justify-center border border-white/10 rounded-[32px] bg-gradient-to-br from-cyan-500/5 via-white/[0.03] to-fuchsia-500/5 p-10 backdrop-blur-2xl">
        
        {/* Animated Sound Waveforms */}
        {isRecording && (
          <div className="absolute inset-x-0 bottom-0 top-0 bg-cyan-500/5 flex items-center justify-center gap-1 z-0 pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-cyan-400/80 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 40 + 10}px`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "0.8s",
                }}
              />
            ))}
          </div>
        )}

        {/* Record Control Node */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecordingHandler}
              disabled={isLoading}
              id="btn-voice-mic-trigger"
              className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-[0_0_60px_rgba(34,211,238,0.55)] transition-all duration-500 hover:scale-110 active:scale-95 cursor-pointer"
            >
              <Mic className="w-6 h-6 animate-none" />
            </button>
          ) : (
            <button
              onClick={stopRecordingHandler}
              id="btn-voice-stop-trigger"
              className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-pink-500 text-white flex items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.55)] transition-all duration-500 hover:scale-110 active:scale-95 cursor-pointer pulse-glow"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          )}

          {/* Status Label */}
          <div className="text-center">
            {isRecording ? (
              <span className="text-xs font-semibold text-red-500 flex items-center justify-center gap-1.5 animate-pulse">
                Recording... {formatTime(recordDuration)}
              </span>
            ) : isLoading ? (
              <span className="text-xs font-medium text-cyan-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing voice and translating speech via AI gateway...
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-300">
                Click to Speak ("Talk about school, projects, or job history")
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Errors display */}
      {errorText && (
        <div className="bg-red-500/10 text-red-300 border border-red-500/30 p-3.5 rounded-lg text-xs leading-relaxed">
          {errorText}
        </div>
      )}

      {/* Output Results panel */}
      {(regionalTranscript || englishTranslation) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Regional text display */}
          <div className="glass-panel p-4 rounded-xl shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Original Transcript ({selectedLang.split("-")[0].toUpperCase()})</span>
            <p className="text-sm font-semibold text-slate-200 break-words leading-relaxed bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
              {regionalTranscript || "Waiting..."}
            </p>
          </div>

          {/* English Translation */}
          <div className="glass-panel p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 fill-cyan-500/20" />
                AI English Extraction
              </span>
              <p className="text-sm text-slate-300 font-light break-words leading-relaxed bg-fuchsia-500/5 p-2.5 rounded-lg border border-cyan-500/15">
                {englishTranslation || "Extracting summary..."}
              </p>
            </div>

            {/* Read Feedback Block */}
            {aiSpeechFeedback && (
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Volume2 className="w-4 h-4 text-emerald-500" />
                  <span>AI Verbal Feedback translated back:</span>
                </div>
                {!isSpeaking ? (
                  <button
                    onClick={() => speakFeedbackAloud(aiSpeechFeedback)}
                    className="flex items-center gap-1 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[11px] font-medium px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" /> Play
                  </button>
                ) : (
                  <button
                    onClick={stopSpeakingAloud}
                    className="flex items-center gap-1 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-[11px] font-medium px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    <Pause className="w-3 h-3 fill-current" /> Stop
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

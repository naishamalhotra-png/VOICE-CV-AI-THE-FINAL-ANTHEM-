/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ATSAnalysisResult } from "../types";
import { CheckCircle2, AlertTriangle, Lightbulb, TrendingUp, HelpCircle } from "lucide-react";

interface ATSAnalysisProps {
  analysis: ATSAnalysisResult | undefined;
  isLoading: boolean;
}

export default function ATSAnalysis({ analysis, isLoading }: ATSAnalysisProps) {
  if (isLoading) {
    return (
      <div id="ats-analysis-panel" className="glass-panel p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center py-12 animate-pulse">
        <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin mb-4" />
        <span className="text-sm font-semibold text-slate-300">Recalculating ATS Match Rate Score...</span>
        <p className="text-xs text-slate-500 mt-1">Measuring grammar context, keyword density, and structural integrity.</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div id="ats-analysis-panel" className="bg-white/[0.02] p-6 rounded-2xl border border-white/10 shadow-sm flex flex-col items-center justify-center text-center py-10">
        <TrendingUp className="w-10 h-10 text-slate-300" />
        <h3 className="text-sm font-bold text-slate-300 mt-3">Calculate ATS Keyword Score</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
          Once your resume content is populated, click the button below or start typing to analyze keyword compatibility and recruiter readiness.
        </p>
      </div>
    );
  }

  // Choose colors based on scoring scales
  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", stroke: "stroke-emerald-400" };
    if (score >= 50) return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", stroke: "stroke-amber-400" };
    return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", stroke: "stroke-rose-400" };
  };

  const style = getScoreColor(analysis.score);

  return (
    <div id="ats-analysis-panel" className="glass-panel p-6 rounded-2xl shadow-sm flex flex-col gap-6">
      
      {/* Visual Header Grid with Radical Dial Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Core Percentage Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-white/[0.03] border border-white/5 relative">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* SVG circle track */}
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="50"
                className="stroke-white/10 fill-none"
                strokeWidth="10"
              />
              <circle
                cx="64"
                cy="64"
                r="50"
                className={`fill-none transition-all duration-500 ${style.stroke}`}
                strokeWidth="10"
                strokeDasharray="314.15"
                strokeDashoffset={314.15 - (314.15 * analysis.score) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center z-10">
              <span className={`text-3xl font-extrabold tracking-tight ${style.text}`}>{analysis.score}</span>
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mt-0.5">ATS Match</span>
            </div>
          </div>
          
          <div className="text-center mt-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${style.bg} ${style.text} ${style.border}`}>
              {analysis.score >= 80 ? "Highly Ready" : analysis.score >= 50 ? "Needs Fine-Tuning" : "Critical Fixes Required"}
            </span>
          </div>
        </div>

        {/* Readiness Index Metrics bar */}
        <div className="md:col-span-7 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 font-display">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Recruiter Strategy Report
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Your resume was screened against high-frequency keywords and technical skills standard in corporate software and logistics directories.
            </p>
          </div>

          {/* Sub progress loader */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-500">Recruiter Readiness Index</span>
              <span className="text-white">{analysis.recruiterReadiness}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${analysis.recruiterReadiness}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Score ≥ 80% increases your organic interview matching probability by 4.2x in algorithmic ATS pipelines.
            </p>
          </div>
        </div>
      </div>

      {/* Grid for Strengths and Suggestions details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Strengths Card */}
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 mb-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-500/10" />
            Resume Strengths
          </span>
          <ul className="space-y-2 text-xs font-normal text-slate-300">
            {analysis.strengths && analysis.strengths.length > 0 ? (
              analysis.strengths.map((str, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span className="break-words">{str}</span>
                </li>
              ))
            ) : (
              <li className="italic text-slate-500">No strengths logged. Add details to expand.</li>
            )}
          </ul>
        </div>

        {/* Missing Keywords Card */}
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <span className="text-xs font-bold uppercase tracking-wider text-red-300 flex items-center gap-1.5 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 fill-red-500/10" />
            Missing Recruiter Keywords
          </span>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingKeywords && analysis.missingKeywords.length > 0 ? (
              analysis.missingKeywords.map((word, idx) => (
                <span
                  key={idx}
                  className="bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                >
                  +{word}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">No keywords missing! Perfect.</span>
            )}
          </div>
          <p className="text-[10px] text-red-500 mt-3 font-medium leading-snug">
            ⚠️ Try mentioning these terms inside your Professional Summary or Projects to satisfy semantic search filters.
          </p>
        </div>
      </div>

      {/* Improvement Suggestions Callouts */}
      <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
        <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-300 flex items-center gap-1.5 mb-3">
          <Lightbulb className="w-4 h-4 text-cyan-400 fill-cyan-500/10" />
          Improvement Recommendations
        </span>
        <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
          {analysis.suggestions && analysis.suggestions.length > 0 ? (
            analysis.suggestions.map((sug, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="bg-cyan-500/15 text-fuchsia-300 font-bold rounded-full w-4 h-4 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="break-words">{sug}</span>
              </li>
            ))
          ) : (
            <li className="italic text-slate-500">Excellent structural integrity! No further suggestions needed.</li>
          )}
        </ul>
      </div>

    </div>
  );
}

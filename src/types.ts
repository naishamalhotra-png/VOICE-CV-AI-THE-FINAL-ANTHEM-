/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  location: string;
  jobTitle: string;
  summary: string;
}

export interface Education {
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface WorkExperience {
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Project {
  name: string;
  role: string;
  description: string;
  technologies: string[];
  link?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  link?: string;
}

export interface VolunteerExperience {
  organization: string;
  role: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  education: Education[];
  experience: WorkExperience[];
  projects: Project[];
  skills: {
    technical: string[];
    soft: string[];
  };
  certifications: Certification[];
  achievements: string[];
  languages: string[];
  extracurriculars: string[];
  volunteer: VolunteerExperience[];
  references?: string;
}

export interface ATSAnalysisResult {
  score: number;
  strengths: string[];
  missingKeywords: string[];
  suggestions: string[];
  recruiterReadiness: number;
}

export interface SavedResume {
  _id?: string;
  id?: string; // fallback
  userId: string;
  title: string;
  resumeData: ResumeData;
  atsScore?: number;
  atsAnalysis?: ATSAnalysisResult;
  templateId: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum ResumeTemplate {
  MODERN = "modern",
  PROFESSIONAL = "professional",
  MINIMAL = "minimal"
}

export const initialResumeData: ResumeData = {
  personalInfo: {
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    portfolio: "",
    location: "",
    jobTitle: "",
    summary: ""
  },
  education: [],
  experience: [],
  projects: [],
  skills: {
    technical: [],
    soft: []
  },
  certifications: [],
  achievements: [],
  languages: [],
  extracurriculars: [],
  volunteer: [],
  references: ""
};

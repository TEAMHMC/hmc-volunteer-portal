

import { TrainingPlan, Message, Opportunity } from "../types";
import { apiService } from "./apiService";

export const geminiService = {
  async analyzeResume(base64Data: string, mimeType: string) {
    try {
      const result = await apiService.post('/api/gemini/analyze-resume', { base64Data, mimeType }, 90000);
      if (!result) {
          throw new Error("AI analysis returned an empty response.");
      }
      return result;
    } catch (error: any) {
      console.error("Gemini service error during resume analysis:", error);
      return {
        recommendations: [],
        extractedSkills: [],
        error: error?.message || 'Resume analysis is temporarily unavailable. Please select a role manually.',
      };
    }
  },

  async generateModuleContent(moduleId: string, moduleTitle: string, moduleDesc: string, role: string): Promise<{ content: string; sections: { heading: string; body: string }[] }> {
    try {
      const result = await apiService.post('/api/gemini/generate-module-content', { moduleId, moduleTitle, moduleDesc, role }, 60000);
      return result;
    } catch (error) {
      console.error("Module content generation failed", error);
      return {
        content: moduleDesc,
        sections: [
          { heading: 'Overview', body: moduleDesc || `This module covers ${moduleTitle}.` },
          { heading: 'Key Expectations', body: 'All volunteers are expected to understand and follow these guidelines in their work with Health Matters Clinic.' },
          { heading: 'Your Responsibility', body: `As a ${role}, you play a critical role in upholding these standards. Apply what you learn here in every interaction.` }
        ]
      };
    }
  },

  async generateModuleQuiz(moduleTitle: string, role: string) {
    try {
      const result = await apiService.post('/api/gemini/generate-quiz', { moduleTitle, role });
      return result;
    } catch (error) {
      console.error("Quiz generation failed", error);
       return { 
        question: `As a ${role}, what is your primary objective during a wellness activation?`,
        learningObjective: `Understand the core responsibilities of a ${role}.`,
        keyConcepts: [{concept: "Community Engagement", description: "Building relationships and trust with community members."}, {concept: "Resource Distribution", description: "Efficiently providing materials and information."}, {concept: "Safety Protocols", description: "Ensuring a safe environment for all."}]
      };
    }
  },

  async validateQuizAnswer(question: string, answer: string): Promise<boolean> {
     try {
      const { isCorrect } = await apiService.post('/api/gemini/validate-answer', { question, answer });
      return isCorrect;
    } catch (error) {
      console.error("Answer validation failed", error);
      return false;
    }
  },

  async generateTrainingPlan(role: string, experience: string): Promise<TrainingPlan> {
    try {
      const plan = await apiService.post('/api/gemini/generate-plan', { role, experience }, 90000);
      return plan;
    } catch (error) {
      console.error("Training plan generation failed", error);
      return {
        role,
        orientationModules: [
          { id: 'default-1', title: 'Welcome to HMC', objective: 'Understand our mission and values.', estimatedMinutes: 10 },
          { id: 'default-2', title: 'Your Role', objective: `Learn the basics of being a ${role}.`, estimatedMinutes: 15 },
        ],
        completionGoal: 'Complete these modules to get started with your volunteer journey.',
        coachSummary: `This plan is designed to quickly onboard you as a ${role}.`
      };
    }
  },

  async draftFundraisingEmail(volunteerName: string, volunteerRole: string) {
    try {
      const result = await apiService.post('/api/gemini/draft-fundraising-email', { volunteerName, volunteerRole });
      return result;
    } catch (error) {
      console.error("Fundraising email draft failed", error);
      return { emailBody: "Sorry, we couldn't draft an email at this time. Please try again." };
    }
  },
  
  async draftSocialMediaPost(topic: string, platform: 'Instagram' | 'LinkedIn') {
    try {
      const result = await apiService.post('/api/gemini/draft-social-post', { topic, platform });
      return result;
    } catch (error) {
      console.error("Social media post draft failed", error);
      return { postText: "Sorry, we couldn't draft a post at this time. Please try again." };
    }
  },

  async generateImpactSummary(data: { volunteerName: string; totalHours: number; role: string; tenantId: string; skills: string[] }) {
     try {
      const { summary } = await apiService.post('/api/gemini/generate-summary', data);
      return summary;
    } catch (error) {
      console.error("Summary generation failed", error);
      return "Could not generate impact summary at this time.";
    }
  },

  async summarizeVolunteerFeedback(feedback: string[]): Promise<string> {
    try {
      const { summary } = await apiService.post('/api/gemini/summarize-feedback', { feedback });
      return summary;
    } catch (error) {
      console.error("Feedback summarization failed", error);
      return "Could not generate feedback summary at this time.";
    }
  },

  async generateSupplyList(serviceNames: string[], attendeeCount: number): Promise<string> {
    try {
      const { supplyList } = await apiService.post('/api/gemini/generate-supply-list', { serviceNames, attendeeCount });
      return supplyList;
    } catch (error) {
      console.error("Supply list generation failed", error);
      return "Could not generate a supply list at this time. Please try again.";
    }
  },

  async draftAnnouncement(topic: string, tenantId: string): Promise<string> {
    try {
      const { content } = await apiService.post('/api/gemini/draft-announcement', { topic, tenantId });
      return content;
    } catch (error) {
      console.error("Announcement draft failed", error);
      // Return a helpful template as fallback
      return `Dear Team,\n\nThis is an important update regarding ${topic}.\n\n[Add your key message here]\n\nThank you for your continued dedication to our mission.\n\n- Health Matters Clinic Leadership`;
    }
  },

  async generateDocument(prompt: string, title: string): Promise<string> {
    try {
      const { content } = await apiService.post('/api/gemini/generate-document', { prompt, title }, 60000);
      return content;
    } catch (error) {
      console.error("Document generation failed", error);
      return '';
    }
  },

  async improveDocument(content: string, instructions: string): Promise<string> {
    try {
      const { improved } = await apiService.post('/api/gemini/improve-document', { content, instructions }, 60000);
      return improved;
    } catch (error) {
      console.error("Document improvement failed", error);
      return content; // Return original if improvement fails
    }
  }
};

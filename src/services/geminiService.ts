

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
    } catch (error) {
      console.error("Gemini service error during resume analysis:", error);
      throw error;
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
  }
};

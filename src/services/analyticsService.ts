import { apiService } from "./apiService";

/**
 * Logs a key user event to the backend for analytics.
 * @param eventName A clear, snake_cased name for the event (e.g., 'user_login', 'onboarding_step_complete').
 * @param eventData An object containing relevant data about the event.
 */
export const analyticsService = {
  async logEvent(eventName: string, eventData: object = {}): Promise<void> {
    try {
      // We don't need to wait for this to complete, but we want to handle errors.
      await apiService.post('/api/analytics/log', { eventName, eventData });
    } catch (error) {
      console.warn(`Analytics event '${eventName}' failed to log:`, error);
    }
  },
};

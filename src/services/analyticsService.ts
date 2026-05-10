import { apiService } from "./apiService";

/**
 * Logs a key user event to the backend for analytics.
 * @param eventName A clear, snake_cased name for the event (e.g., 'user_login', 'onboarding_step_complete').
 * @param eventData An object containing relevant data about the event.
 */
export const analyticsService = {
  async logEvent(eventName: string, eventData: object = {}): Promise<void> {
    // Fire to GA4 (non-blocking)
    const g = (window as any).gtag;
    if (g) g('event', eventName, eventData);

    // Also log to backend
    try {
      await apiService.post('/api/analytics/log', { eventName, eventData });
    } catch (error) {
      console.warn(`Analytics event '${eventName}' failed to log:`, error);
    }
  },
};

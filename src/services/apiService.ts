
// A simple API service to handle requests to our backend

const BASE_URL = ''; // We are on the same origin

// Track whether a session refresh is already in-flight (prevents cascading retries)
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempt to refresh the session. Returns true if refresh succeeded, false otherwise.
 * Deduplicates concurrent calls so only one refresh request fires at a time.
 */
const tryRefreshSession = async (): Promise<boolean> => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return false;
      const res = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
};

const request = async (method: string, endpoint: string, body?: any, timeout = 30000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const token = localStorage.getItem('authToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    clearTimeout(id);

    if (response.status === 204) {
      return null;
    }

    const responseText = await response.text();

    if (!response.ok) {
      // On 403, check if it's actually a session/auth issue vs a permission error
      if (response.status === 403) {
        let errorMessage = 'Forbidden';
        try {
          const errJson = JSON.parse(responseText);
          errorMessage = errJson.error || errorMessage;
        } catch { /* not JSON */ }

        // Only treat as session expiration if the error is from the verifyToken middleware
        // (all verifyToken errors start with "Unauthorized:"). Other 403s (permission checks,
        // role gates, ticket auth) should NOT trigger logout.
        const isSessionError = /^Unauthorized:/i.test(errorMessage);
        if (isSessionError) {
          // Don't immediately logout — try to refresh the session first.
          // Skip retry if the failing request IS the refresh endpoint (avoids infinite loop).
          if (endpoint !== '/api/auth/refresh-session') {
            const refreshed = await tryRefreshSession();
            if (refreshed) {
              // Session refreshed — retry the original request once
              console.info(`[Session] Refreshed session, retrying ${method} ${endpoint}`);
              return request(method, endpoint, body, timeout);
            }
          }
          console.error(`[Session] 403 on ${endpoint} — session expired or invalid.`);
          localStorage.removeItem('authToken');
          // Dispatch event so App.tsx can handle navigation cleanly
          window.dispatchEvent(new CustomEvent('session-expired'));
          throw new Error('Your session has expired. Please log in again.');
        }

        // Permission error (training gate, role check, etc.) — just throw, don't log out
        throw new Error(errorMessage);
      }

      // Try to parse as JSON error response
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        // Not JSON — check if it's an HTML error page
        if (responseText.trim().startsWith('<!DOCTYPE html>')) {
          errorMessage = `API Error (${response.status}): Endpoint not found or server configuration issue.`;
        } else if (responseText) {
          errorMessage = responseText;
        }
      }
      throw new Error(errorMessage);
    }

    try {
      const data = JSON.parse(responseText);
      if (data.token) {
          localStorage.setItem('authToken', data.token);
      }
      return data;
    } catch(e) {
        console.error("Failed to parse successful response as JSON:", responseText);
        throw new Error("Received an invalid response from the server.");
    }

  } catch (error) {
    clearTimeout(id);
    if ((error as Error).name === 'AbortError') {
      console.error(`API Error: Request to ${endpoint} timed out.`);
      throw new Error("The request took too long and was aborted. Please check your network connection and try again.");
    }
    console.error(`API Error on ${method} ${endpoint}:`, error);
    throw error;
  }
};

// Session heartbeat: keeps active sessions alive by pinging the server every 15 min.
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function startSessionHeartbeat() {
  stopSessionHeartbeat();
  heartbeatInterval = setInterval(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      stopSessionHeartbeat();
      return;
    }
    try {
      await request('POST', '/api/auth/refresh-session', {});
    } catch {
      // Session refresh failed — the 403 handler in request() will handle redirect
    }
  }, 15 * 60 * 1000); // 15 minutes (matches the session extension window)
}

function stopSessionHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export const apiService = {
  get: (endpoint: string) => request('GET', endpoint),
  post: (endpoint: string, body: any, timeout?: number) => request('POST', endpoint, body, timeout),
  put: (endpoint: string, body: any) => request('PUT', endpoint, body),
  delete: (endpoint: string) => request('DELETE', endpoint),
  startSessionHeartbeat,
  stopSessionHeartbeat,
};

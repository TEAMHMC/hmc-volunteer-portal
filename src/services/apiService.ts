
// A simple API service to handle requests to our backend

const BASE_URL = ''; // We are on the same origin

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
      // On 403, redirect to login with clear message
      if (response.status === 403) {
        console.error(`[Session] 403 on ${endpoint} — session expired or invalid.`);
        localStorage.removeItem('authToken');
        // Only redirect if we're not already on the landing page
        if (endpoint !== '/auth/me') {
          window.location.reload();
        }
        throw new Error('Your session has expired. Please log in again.');
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

    if ((error as Error).message.includes('token') || (error as Error).message.includes('Unauthorized')) {
        localStorage.removeItem('authToken');
    }
    throw error;
  }
};

// Session heartbeat: keeps active sessions alive by pinging the server every 30 min.
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
  }, 30 * 60 * 1000); // 30 minutes
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

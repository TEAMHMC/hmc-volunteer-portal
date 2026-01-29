
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
      try {
        const errorJson = JSON.parse(responseText);
        throw new Error(errorJson.error || 'An unknown server error occurred.');
      } catch (e) {
        // If it's HTML error (like standard Express 404), return a friendly message
        if (responseText.trim().startsWith('<!DOCTYPE html>')) {
             throw new Error(`API Error (${response.status}): Endpoint not found or server configuration issue.`);
        }
        throw new Error(responseText || `Request failed with status ${response.status}`);
      }
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

export const apiService = {
  get: (endpoint: string) => request('GET', endpoint),
  post: (endpoint: string, body: any, timeout?: number) => request('POST', endpoint, body, timeout),
  put: (endpoint: string, body: any) => request('PUT', endpoint, body),
  delete: (endpoint: string) => request('DELETE', endpoint),
};

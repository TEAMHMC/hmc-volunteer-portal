
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import admin from 'firebase-admin';
import twilio from 'twilio';
import helmet from 'helmet';
import { GoogleGenerativeAI } from "@google/generative-ai";
import process from 'process';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { STATIC_MODULE_CONTENT } from './staticModuleContent';

// --- CONFIGURATION ---
dotenv.config();

// --- FIREBASE ADMIN SDK ---
let firebaseConfigured = false;
try {
  // Method 1: Service account JSON file path
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseConfigured = true;
    console.log("✅ Firebase Admin SDK initialized with service account file.");
  }
  // Method 2: Service account JSON as environment variable (for cloud platforms)
  else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseConfigured = true;
    console.log("✅ Firebase Admin SDK initialized with service account from env.");
  }
  // Method 3: Application default credentials (GCP/Cloud Run) or FIREBASE_CONFIG
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    firebaseConfigured = true;
    console.log("✅ Firebase Admin SDK initialized with application default credentials.");
  }
  // No explicit credentials - try default initialization (works on GCP)
  else {
    admin.initializeApp();
    firebaseConfigured = true; // Assume it works on GCP
    console.log("✅ Firebase Admin SDK initialized with default settings.");
  }
} catch (e) {
  console.error("❌ Firebase Admin SDK initialization failed:", e);
}
const db = admin.firestore();
const auth = admin.auth();

// --- TWILIO ---
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
if (!FIREBASE_WEB_API_KEY) {
    console.error('[CRITICAL] FIREBASE_WEB_API_KEY is not set — email/password login will not work. Set it from Firebase Console → Project Settings → General → Web API Key.');
} else {
    const keySource = process.env.FIREBASE_WEB_API_KEY ? 'FIREBASE_WEB_API_KEY' : 'VITE_FIREBASE_API_KEY (fallback)';
    const keyPreview = FIREBASE_WEB_API_KEY.substring(0, 8) + '...' + FIREBASE_WEB_API_KEY.substring(FIREBASE_WEB_API_KEY.length - 4);
    console.log(`[AUTH] Using API key from ${keySource}: ${keyPreview}`);
}
const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

// --- GOOGLE APPS SCRIPT EMAIL SERVICE ---
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;

if (EMAIL_SERVICE_URL) {
  console.log("✅ Email configured via Google Apps Script");
} else {
  console.warn("⚠️ EMAIL_SERVICE_URL not set - emails will be disabled");
}

// --- GEMINI API ---
let ai: GoogleGenerativeAI | null = null;
// Support multiple common environment variable names for Gemini API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.API_KEY;
if (GEMINI_API_KEY) {
    ai = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log("Gemini AI client initialized successfully.");
    console.log(`[GEMINI] API Key detected (env var used: ${process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : process.env.GOOGLE_AI_API_KEY ? 'GOOGLE_AI_API_KEY' : 'API_KEY'})`);
} else {
    console.warn("No Gemini API key found. Checked: GEMINI_API_KEY, GOOGLE_AI_API_KEY, API_KEY");
    console.warn("Gemini AI features will be disabled.");
}

// Helper for Gemini API calls
type GeminiPart = string | { inlineData: { mimeType: string; data: string } };
const generateAIContent = async (
  modelName: string,
  parts: GeminiPart | GeminiPart[],
  jsonMode: boolean = false
): Promise<string> => {
  if (!ai) throw new Error('AI not configured - no API key found');
  try {
    console.log(`[GEMINI] Initializing model: ${modelName}`);
    const model = ai.getGenerativeModel({
      model: modelName,
      generationConfig: jsonMode ? { responseMimeType: 'application/json' } : undefined
    });
    const content = Array.isArray(parts) ? parts : [parts];
    const hasInlineData = content.some(p => typeof p === 'object' && 'inlineData' in p);
    console.log(`[GEMINI] Calling model ${modelName} with ${content.length} parts (hasFile: ${hasInlineData})`);
    const result = await model.generateContent(content);
    const text = result.response.text();
    console.log(`[GEMINI] Response received (${text.length} chars)`);
    return text;
  } catch (error: any) {
    // Extract detailed error info
    const errorDetails = {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      errorDetails: error.errorDetails,
    };
    console.error(`[GEMINI] API Error:`, JSON.stringify(errorDetails, null, 2));
    // Re-throw with more info
    throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
  }
};

const app = express();
const PORT = process.env.PORT || 8080;

// --- SSE CLIENT REGISTRY ---
// Map of userId -> Set of SSE response objects (supports multiple tabs per user)
const sseClients = new Map<string, Set<Response>>();

function broadcastSSE(targetUserId: string, data: object) {
  const clients = sseClients.get(targetUserId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { clients.delete(client); }
  }
}

// SECURITY: Configure helmet with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com", "https://apis.google.com", "https://www.gstatic.com", "https://www.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://www.googleapis.com", "https://firestore.googleapis.com", "https://generativelanguage.googleapis.com", "wss:", "https:"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://www.google.com", "https://meet.google.com", "https://www.youtube.com", "https://youtube.com", "https://hmc.screencasthost.com", "https://screencasthost.com", "https://screenpal.com", "https://*.screenpal.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}));

// SECURITY: Restrict CORS to allowed origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://healthmatters.clinic,https://www.healthmatters.clinic,https://volunteer.healthmatters.clinic,http://localhost:5173,http://localhost:8080,https://hmc-volunteer-portal-172668994130.us-west2.run.app,https://teamhmc.github.io').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    // Allow same-origin requests and Cloud Run URLs
    if (ALLOWED_ORIGINS.includes(origin) || origin.includes('.run.app') || origin.includes('localhost') || origin.includes('healthmatters.clinic') || origin.includes('teamhmc.github.io')) {
      callback(null, true);
    } else {
      console.warn(`[SECURITY] Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Limit request body size to prevent memory exhaustion
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// --- HEALTH CHECK ENDPOINT (no auth required) ---
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      emailConfigured: !!EMAIL_SERVICE_URL,
      smsConfigured: twilioClient !== null && !!TWILIO_PHONE_NUMBER,
      aiConfigured: ai !== null,
      aiKeySource: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : process.env.GOOGLE_AI_API_KEY ? 'GOOGLE_AI_API_KEY' : process.env.API_KEY ? 'API_KEY' : 'none',
      firebaseAuthConfigured: firebaseConfigured,
      firebaseWebApiKey: !!FIREBASE_WEB_API_KEY,
      firebaseWebApiKeySource: process.env.FIREBASE_WEB_API_KEY ? 'FIREBASE_WEB_API_KEY' : process.env.VITE_FIREBASE_API_KEY ? 'VITE_FIREBASE_API_KEY' : 'none',
      firebaseWebApiKeyPreview: FIREBASE_WEB_API_KEY ? FIREBASE_WEB_API_KEY.substring(0, 8) + '...' : 'NOT SET'
    }
  });
});

// --- GEMINI TEST ENDPOINT (for debugging) ---
app.get('/api/gemini/test', async (req: Request, res: Response) => {
  if (!ai) {
    return res.json({ success: false, error: 'AI not configured - no API key found' });
  }

  // Try multiple model names to find one that works
  const modelsToTry = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.5-pro',
    'models/gemini-2.0-flash',
    'models/gemini-1.5-flash'
  ];

  const results: any[] = [];

  for (const modelName of modelsToTry) {
    try {
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say "works" and nothing else.');
      const text = result.response.text();
      results.push({ model: modelName, success: true, response: text.trim() });
      break; // Stop after first success
    } catch (error: any) {
      results.push({ model: modelName, success: false, error: error.message });
    }
  }

  const workingModel = results.find(r => r.success);
  res.json({
    workingModel: workingModel?.model || null,
    apiKeyConfigured: !!GEMINI_API_KEY,
    results
  });
});

// --- ANALYTICS ENDPOINT ---
app.post('/api/analytics/log', async (req: Request, res: Response) => {
  try {
    const { eventName, eventData } = req.body;

    // Log to console in development, store in Firestore for production analytics
    console.log(`[ANALYTICS] ${eventName}:`, JSON.stringify(eventData || {}).substring(0, 200));

    // Store analytics event in Firestore (non-blocking, best-effort)
    db.collection('analytics_events').add({
      eventName,
      eventData: eventData || {},
      timestamp: new Date(),
      userAgent: req.headers['user-agent'] || 'unknown',
    }).catch(err => console.warn('[ANALYTICS] Failed to store event:', err.message));

    res.status(204).send();
  } catch (error) {
    // Analytics should never break the user experience
    console.warn('[ANALYTICS] Error:', error);
    res.status(204).send();
  }
});

// --- HELPERS ---

// PII masking for logs
const maskEmail = (email: string) => email ? email.replace(/(.{2}).*(@.*)/, '$1***$2') : '[no email]';
const maskPhone = (phone: string) => phone ? phone.slice(-4).padStart(phone.length, '*') : '[no phone]';

// In-memory rate limit store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (limit: number, timeframeMs: number) => (req: Request, res: Response, next: NextFunction) => {
  const key = `${req.ip}_${req.path}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + timeframeMs });
    return next();
  }

  if (record.count >= limit) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  record.count++;
  return next();
};

// Admin authorization middleware - MUST be used on all /api/admin/* routes
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user?.profile?.isAdmin) {
    console.warn(`[SECURITY] Non-admin attempted admin action: ${maskEmail(user?.profile?.email || 'unknown')} on ${req.path}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- reCAPTCHA MIDDLEWARE ---
const verifyCaptcha = async (req: Request, res: Response, next: NextFunction) => {
  const { captchaToken } = req.body;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // Skip if not configured (dev mode)
  if (!secretKey) {
    console.warn('[CAPTCHA] Secret key not configured, skipping verification');
    return next();
  }

  if (!captchaToken) {
    return res.status(400).json({ error: 'CAPTCHA verification required' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey!, response: captchaToken }).toString()
    });
    const result = await response.json() as { success: boolean; score?: number };

    // For v2: check success; for v3: check score
    if (!result.success) {
      return res.status(403).json({ error: 'CAPTCHA verification failed' });
    }

    // Optional: For reCAPTCHA v3, enforce score threshold
    if (result.score !== undefined && result.score < 0.5) {
      return res.status(403).json({ error: 'CAPTCHA score too low' });
    }

    next();
  } catch (error) {
    console.error('[CAPTCHA] Verification error:', error);
    return res.status(500).json({ error: 'CAPTCHA verification failed' });
  }
};

// --- GOOGLE OAUTH TOKEN VERIFICATION ---
interface GoogleTokenPayload {
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  sub: string; // Google user ID
  aud: string; // Client ID
  iss: string;
  exp: number;
}

const verifyGoogleToken = async (credential: string): Promise<GoogleTokenPayload | null> => {
  try {
    // Verify with Google's tokeninfo endpoint
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!response.ok) {
      console.error('[GOOGLE AUTH] Token verification failed:', response.status);
      return null;
    }
    const payload = await response.json() as GoogleTokenPayload;

    // Verify the token is for our app (check audience matches our client ID)
    const expectedClientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && payload.aud !== expectedClientId) {
      console.error('[GOOGLE AUTH] Token audience mismatch');
      return null;
    }

    // Check token hasn't expired
    if (payload.exp * 1000 < Date.now()) {
      console.error('[GOOGLE AUTH] Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[GOOGLE AUTH] Token verification error:', error);
    return null;
  }
};

// --- EMAIL OPT-IN HELPERS ---
const canSendEmail = async (userId: string, type: 'alerts' | 'opportunities' | 'training' | 'events'): Promise<boolean> => {
  try {
    const userDoc = await db.collection('volunteers').doc(userId).get();
    if (!userDoc.exists) return false;

    const prefs = userDoc.data()?.notificationPrefs;
    if (!prefs?.emailAlerts) return false; // Master email toggle

    switch (type) {
      case 'opportunities': return prefs.opportunityUpdates !== false;
      case 'training': return prefs.trainingReminders !== false;
      case 'events': return prefs.eventInvitations !== false;
      default: return true;
    }
  } catch {
    return false;
  }
};

// --- DATE FORMATTING ---
// Format YYYY-MM-DD to human-readable "Friday, February 14, 2026"
const formatEventDate = (dateStr: string): string => {
  if (!dateStr || dateStr === 'TBD') return dateStr || 'TBD';
  // Append T00:00:00 to avoid UTC offset interpretation
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// --- PHONE NORMALIZATION ---
const normalizePhone = (phone: string | undefined | null): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Remove leading US country code '1' if present and result is 11 digits
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits.length === 10 ? digits : null;
};

// --- SMS OPT-IN HELPER ---
const sendSMS = async (
  userId: string | null,
  to: string,
  body: string
): Promise<{ sent: boolean; reason?: string }> => {
  // Feature flag: check if Twilio is configured
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    console.log('[SMS] Twilio not configured, skipping SMS');
    return { sent: false, reason: 'not_configured' };
  }

  // Check user opt-in if userId provided
  if (userId) {
    try {
      const userDoc = await db.collection('volunteers').doc(userId).get();
      const prefs = userDoc.data()?.notificationPrefs;
      if (!prefs?.smsAlerts) {
        console.log(`[SMS] Skipped - user ${userId} has opted out of SMS`);
        return { sent: false, reason: 'opted_out' };
      }
    } catch {
      return { sent: false, reason: 'user_lookup_failed' };
    }
  }

  try {
    await twilioClient.messages.create({
      body,
      from: TWILIO_PHONE_NUMBER,
      to
    });
    console.log(`[SMS] Sent to ${to}`);
    return { sent: true };
  } catch (error) {
    console.error('[SMS] Send failed:', error);
    return { sent: false, reason: 'send_failed' };
  }
};

// ═══════════════════════════════════════════════════════════════
// EMAIL SERVICE - 14 Professional Templates
// ═══════════════════════════════════════════════════════════════

const EMAIL_CONFIG = {
  BRAND_COLOR: '#233DFF',
  FROM_NAME: 'Health Matters Clinic',
  WEBSITE_URL: process.env.PORTAL_URL || '',
};

if (!EMAIL_CONFIG.WEBSITE_URL) {
  console.warn('⚠️ PORTAL_URL not set - email links will be broken');
}

const emailHeader = (title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    <div style="padding: 40px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
      <h2 style="font-size: 24px; font-weight: 700; margin: 0; color: #1f2937;">${title}</h2>
    </div>
    <div style="padding: 40px 32px; color: #4b5563; line-height: 1.6;">
`;

const emailFooter = () => `
    </div>
    <div style="background: #f9fafb; padding: 32px; text-align: center; border-top: 1px solid #f3f4f6;">
      <p style="margin: 0; font-size: 13px; color: #6b7280;">
        <strong>Health Matters Clinic</strong><br/>
        Serving our community with care
      </p>
      <p style="margin: 16px 0 0 0; font-size: 11px; color: #9ca3af;">
        © ${new Date().getFullYear()} Health Matters Clinic. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

const actionButton = (text: string, url: string) => `
<div style="text-align: center; margin: 32px 0;">
  <a href="${url}" style="display: inline-block; background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 14px 32px; border-radius: 24px; text-decoration: none; font-weight: 600; font-size: 14px;">${text} →</a>
</div>
`;

type EmailTemplateData = Record<string, any>;

const EmailTemplates = {
  // 1. Email Verification
  email_verification: (data: EmailTemplateData) => ({
    subject: 'Verify Your Health Matters Clinic Account',
    html: `${emailHeader('Verify Your Email')}
      <p>Hi ${data.volunteerName},</p>
      <p>Welcome to Health Matters Clinic! Please verify your email address using this code:</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: ${EMAIL_CONFIG.BRAND_COLOR}; font-family: monospace;">${data.verificationCode}</span>
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 13px;">This code expires in ${data.expiresIn || 15} minutes.</p>
      ${actionButton('Verify Email Address', `${EMAIL_CONFIG.WEBSITE_URL}/auth/verify?code=${data.verificationCode}`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, Your verification code is: ${data.verificationCode}. This expires in ${data.expiresIn || 15} minutes.`
  }),

  // 2. Welcome Volunteer
  welcome_volunteer: (data: EmailTemplateData) => ({
    subject: `Welcome to Health Matters Clinic, ${data.volunteerName}!`,
    html: `${emailHeader('Welcome to the Team!')}
      <p>Hi ${data.volunteerName},</p>
      <p>We're excited to have you join our volunteer community! You've applied as a <strong>${data.appliedRole}</strong>.</p>
      <p><strong>Next steps:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li style="margin: 8px 0;">Complete your profile with availability</li>
        <li style="margin: 8px 0;">Take our HIPAA Training (required)</li>
        <li style="margin: 8px 0;">Await approval from our team (2-3 business days)</li>
      </ul>
      ${actionButton('View Your Application', `${EMAIL_CONFIG.WEBSITE_URL}/dashboard`)}
    ${emailFooter()}`,
    text: `Welcome ${data.volunteerName}! You've applied as a ${data.appliedRole}. Next: Complete profile, HIPAA training, await approval.`
  }),

  // 2b. Admin Added Volunteer (with password reset link)
  admin_added_volunteer: (data: EmailTemplateData) => ({
    subject: `Welcome to Health Matters Clinic, ${data.volunteerName}!`,
    html: `${emailHeader('Welcome to the Team!')}
      <p>Hi ${data.volunteerName},</p>
      <p>An administrator has added you to our volunteer community as a <strong>${data.appliedRole}</strong>.</p>
      ${data.hasPasswordReset ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #92400e;">Set Up Your Password</p>
        <p style="margin: 8px 0 0 0; color: #78350f;">Please click the button below to set your password and activate your account.</p>
      </div>
      ${actionButton('Set Your Password', data.passwordResetLink)}
      ` : `
      ${actionButton('Log In to Your Account', `${EMAIL_CONFIG.WEBSITE_URL}`)}
      `}
      <p><strong>Next steps:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li style="margin: 8px 0;">Log in and complete your profile</li>
        <li style="margin: 8px 0;">Take our HIPAA Training (required)</li>
        <li style="margin: 8px 0;">Explore available volunteer opportunities</li>
      </ul>
    ${emailFooter()}`,
    text: `Welcome ${data.volunteerName}! You've been added as a ${data.appliedRole}. ${data.hasPasswordReset ? `Set your password here: ${data.passwordResetLink}` : 'Log in to get started.'}`
  }),

  // 3. Password Reset
  password_reset: (data: EmailTemplateData) => ({
    subject: 'Reset Your Password',
    html: `${emailHeader('Reset Your Password')}
      <p>Hi ${data.volunteerName},</p>
      <p>We received a request to reset your password. Click the button below to create a new password.</p>
      <p style="color: #9ca3af; font-size: 13px;">This link expires in ${data.expiresInHours || 24} hours.</p>
      ${actionButton('Reset Password', data.resetLink)}
      <p style="color: #9ca3af; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, Reset your password here: ${data.resetLink}. Expires in ${data.expiresInHours || 24} hours.`
  }),

  // 4. Login Confirmation
  login_confirmation: (data: EmailTemplateData) => ({
    subject: 'New Login to Your Account',
    html: `${emailHeader('New Login Detected')}
      <p>Hi ${data.volunteerName},</p>
      <p>We detected a new login to your account:</p>
      <div style="background: #f9fafb; padding: 16px; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Device:</strong> ${data.deviceInfo}</p>
        <p style="margin: 0;"><strong>Location:</strong> ${data.location}</p>
      </div>
      <p>If this wasn't you, <a href="${EMAIL_CONFIG.WEBSITE_URL}/security" style="color: ${EMAIL_CONFIG.BRAND_COLOR}; font-weight: 600;">secure your account</a> immediately.</p>
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, New login from ${data.deviceInfo} at ${data.location}. If not you, secure your account.`
  }),

  // 5. Shift Confirmation
  shift_confirmation: (data: EmailTemplateData) => ({
    subject: `You're Assigned: ${data.eventName}`,
    html: `${emailHeader("You're Assigned to a Shift")}
      <p>Hi ${data.volunteerName},</p>
      <p>Great news! You've been assigned to an upcoming shift:</p>
      <div style="background: #f9fafb; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.eventName}</p>
        <p style="margin: 8px 0;"><strong>Date:</strong> ${data.eventDate}</p>
        <p style="margin: 8px 0;"><strong>Time:</strong> ${data.eventTime}</p>
        <p style="margin: 8px 0;"><strong>Location:</strong> ${data.location}</p>
        <p style="margin: 8px 0;"><strong>Duration:</strong> ${data.duration}</p>
        <p style="margin: 8px 0;"><strong>Your Role:</strong> <span style="color: ${EMAIL_CONFIG.BRAND_COLOR}; font-weight: 600;">${data.role}</span></p>
      </div>
      ${actionButton('Confirm Attendance', `${EMAIL_CONFIG.WEBSITE_URL}/shifts/confirm`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, You're assigned to ${data.eventName} on ${data.eventDate} at ${data.eventTime}. Location: ${data.location}. Role: ${data.role}.`
  }),

  // 6. Shift Reminder (24h)
  shift_reminder_24h: (data: EmailTemplateData) => ({
    subject: `Reminder: Your Shift Tomorrow at ${data.eventTime}`,
    html: `${emailHeader('Your Shift is Tomorrow!')}
      <p>Hi ${data.volunteerName},</p>
      <p>Just a friendly reminder—you have a shift <strong>tomorrow</strong>!</p>
      <div style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 12px; text-transform: uppercase;">Tomorrow at</p>
        <p style="margin: 0 0 16px 0; font-size: 32px; font-weight: bold;">${data.eventTime}</p>
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${data.eventName}</p>
        <p style="margin: 0; opacity: 0.9;">${data.location}</p>
      </div>
      <p><strong>Arrive 15 minutes early</strong> to get oriented.</p>
      ${actionButton('View Shift Details', `${EMAIL_CONFIG.WEBSITE_URL}/shifts/upcoming`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, Reminder: ${data.eventName} tomorrow at ${data.eventTime}. Location: ${data.location}. Arrive 15 min early.`
  }),

  // 7. Shift Cancellation
  shift_cancellation: (data: EmailTemplateData) => ({
    subject: `Shift Cancelled: ${data.eventName}`,
    html: `${emailHeader('Shift Cancelled')}
      <p>Hi ${data.volunteerName},</p>
      <p>Unfortunately, the following shift has been cancelled:</p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">${data.eventName}</p>
        <p style="margin: 0; color: #6b7280;">${data.eventDate}</p>
      </div>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p>Your volunteer standing is unaffected. We'll reach out with new opportunities soon.</p>
      ${actionButton('View Other Shifts', `${EMAIL_CONFIG.WEBSITE_URL}/shifts`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, ${data.eventName} on ${data.eventDate} has been cancelled. Reason: ${data.reason}.`
  }),

  // 8. Training Assigned
  training_assigned: (data: EmailTemplateData) => ({
    subject: `New Training Assigned: ${data.trainingName}`,
    html: `${emailHeader('New Training Module')}
      <p>Hi ${data.volunteerName},</p>
      <p>You've been assigned a new training module:</p>
      <div style="background: #f9fafb; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.trainingName}</p>
        <p style="margin: 8px 0; color: #6b7280;">Estimated time: ${data.estimatedMinutes} minutes</p>
        <p style="margin: 8px 0; color: #9ca3af;">Complete by: ${data.deadline}</p>
      </div>
      <p>All modules are self-paced and mobile-friendly.</p>
      ${actionButton('Start Training', `${EMAIL_CONFIG.WEBSITE_URL}/training`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, New training: ${data.trainingName}. ${data.estimatedMinutes} min. Due: ${data.deadline}.`
  }),

  // 9. Training Reminder
  training_reminder: (data: EmailTemplateData) => ({
    subject: `${data.daysRemaining} Days Left: ${data.trainingName}`,
    html: `${emailHeader('Training Deadline Approaching')}
      <p>Hi ${data.volunteerName},</p>
      <p>You have <strong>${data.daysRemaining} days left</strong> to complete your training:</p>
      <p style="font-size: 18px; font-weight: 600; color: ${EMAIL_CONFIG.BRAND_COLOR}; margin: 24px 0;">${data.trainingName}</p>
      <p>Complete it now to stay eligible for upcoming shifts.</p>
      ${actionButton('Continue Training', `${EMAIL_CONFIG.WEBSITE_URL}/training`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, ${data.daysRemaining} days left to complete ${data.trainingName}.`
  }),

  // 10. HIPAA Acknowledgment
  hipaa_acknowledgment: (data: EmailTemplateData) => ({
    subject: 'HIPAA Training Complete',
    html: `${emailHeader('HIPAA Training Complete')}
      <p>Hi ${data.volunteerName},</p>
      <p>Thank you for completing HIPAA training on ${data.completionDate}.</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 48px; color: #10b981; font-family: sans-serif;">&#10003;</span>
      </div>
      <p style="text-align: center; font-weight: 600; color: #10b981;">You're now cleared to volunteer!</p>
      <p><strong>Next steps:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li style="margin: 8px 0;">Set your availability preferences</li>
        <li style="margin: 8px 0;">Browse and register for shifts</li>
      </ul>
      ${actionButton('View Available Shifts', `${EMAIL_CONFIG.WEBSITE_URL}/shifts`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, HIPAA training complete on ${data.completionDate}. You're cleared to volunteer!`
  }),

  // 11. Application Received
  application_received: (data: EmailTemplateData) => ({
    subject: 'We Received Your Application',
    html: `${emailHeader('Application Received')}
      <p>Hi ${data.volunteerName},</p>
      <p>We received your volunteer application! Thank you for your interest.</p>
      <div style="background: #f9fafb; padding: 16px; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; margin: 24px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Position:</strong> ${data.appliedRole}</p>
        <p style="margin: 0;"><strong>Application ID:</strong> ${data.applicationId}</p>
      </div>
      <p>Our team will review your application and get back to you within 2-3 business days.</p>
      ${actionButton('Check Application Status', `${EMAIL_CONFIG.WEBSITE_URL}/applications/${data.applicationId}`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, Application received for ${data.appliedRole}. ID: ${data.applicationId}. Review in 2-3 days.`
  }),

  // 11b. Admin Notification: New Applicant
  admin_new_applicant: (data: EmailTemplateData) => ({
    subject: `New Volunteer Application: ${data.volunteerName} — ${data.appliedRole}`,
    html: `${emailHeader('New Volunteer Application')}
      <p>Hi Team,</p>
      <p>A new volunteer application has been submitted and is awaiting review.</p>
      <div style="background: #f9fafb; padding: 20px; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${data.volunteerName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${data.volunteerEmail}</p>
        <p style="margin: 0 0 8px 0;"><strong>Applied Role:</strong> ${data.appliedRole}</p>
        <p style="margin: 0;"><strong>Application ID:</strong> ${data.applicationId}</p>
      </div>
      <p>Please review this application in the Volunteer Directory.</p>
      ${actionButton('Review Application', `${EMAIL_CONFIG.WEBSITE_URL}/dashboard?tab=directory`)}
    ${emailFooter()}`,
    text: `New applicant: ${data.volunteerName} (${data.volunteerEmail}) applied as ${data.appliedRole}. ID: ${data.applicationId}. Review in dashboard.`
  }),

  // 12. Application Approved
  application_approved: (data: EmailTemplateData) => ({
    subject: 'Welcome! Your Application is Approved',
    html: `${emailHeader('Application Approved!')}
      <p>Congratulations, ${data.volunteerName}!</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 48px; color: #10b981; font-family: sans-serif;">&#10003;</span>
      </div>
      <p>Your application has been approved! You're now a <strong>${data.approvedRole}</strong>.</p>
      <p><strong>Next steps:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li style="margin: 8px 0;">Complete required HIPAA training</li>
        <li style="margin: 8px 0;">Set your availability preferences</li>
        <li style="margin: 8px 0;">Start registering for shifts</li>
      </ul>
      ${actionButton('Complete Training', `${EMAIL_CONFIG.WEBSITE_URL}/training/hipaa`)}
    ${emailFooter()}`,
    text: `Congratulations ${data.volunteerName}! Your application is approved as ${data.approvedRole}. Complete HIPAA training next.`
  }),

  // 13. Application Rejected
  application_rejected: (data: EmailTemplateData) => ({
    subject: 'Application Decision - Health Matters Clinic',
    html: `${emailHeader('Application Decision')}
      <p>Hi ${data.volunteerName},</p>
      <p>Thank you for your interest in volunteering with Health Matters Clinic.</p>
      <p>Unfortunately, we're unable to move forward at this time:</p>
      <div style="background: #f9fafb; padding: 16px; border-left: 4px solid #9ca3af; margin: 24px 0; color: #4b5563;">
        ${data.reason}
      </div>
      <p>We encourage you to reapply in the future or reach out to discuss other ways to get involved.</p>
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, Unfortunately we cannot move forward with your application. Reason: ${data.reason}.`
  }),

  // 14. Monthly Summary
  monthly_summary: (data: EmailTemplateData) => ({
    subject: `Your Impact: ${data.hoursContributed} Hours, ${data.peopleHelped} Lives Touched`,
    html: `${emailHeader('Your Impact This Month')}
      <p>Hi ${data.volunteerName},</p>
      <p>Thank you for your service this month. Here's the impact you've made:</p>
      <div style="display: flex; gap: 16px; margin: 24px 0;">
        <div style="flex: 1; background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 20px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 36px; font-weight: bold;">${data.hoursContributed}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">Hours Served</p>
        </div>
        <div style="flex: 1; background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 20px; border-radius: 12px; text-align: center;">
          <p style="margin: 0; font-size: 36px; font-weight: bold;">${data.peopleHelped}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">People Helped</p>
        </div>
      </div>
      <div style="background: #eff6ff; padding: 16px; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; border-radius: 4px;">
        <p style="margin: 0;"><strong>You made a real difference</strong> for ${data.peopleHelped} people in our community. Thank you.</p>
      </div>
      ${actionButton('View Your Dashboard', `${EMAIL_CONFIG.WEBSITE_URL}/profile`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, This month: ${data.hoursContributed} hours, ${data.shiftsCompleted} shifts, ${data.peopleHelped} people helped. Thank you!`
  }),

  // Achievement Unlocked (for gamification)
  achievement_unlocked: (data: EmailTemplateData) => ({
    subject: `Achievement Unlocked: ${data.achievementName}`,
    html: `${emailHeader('Achievement Unlocked!')}
      <p>Hi ${data.volunteerName},</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 48px; color: ${EMAIL_CONFIG.BRAND_COLOR}; font-weight: 900;">&#9733;</span>
      </div>
      <p style="text-align: center; font-size: 20px; font-weight: 600; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.achievementName}</p>
      <p style="text-align: center; color: #6b7280;">${data.achievementDescription}</p>
      <p style="text-align: center; font-weight: 600; color: #10b981;">+${data.xpReward} XP earned!</p>
      <p style="text-align: center; color: #9ca3af;">You're now Level ${data.currentLevel}</p>
      ${actionButton('View All Achievements', `${EMAIL_CONFIG.WEBSITE_URL}/profile`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, Achievement unlocked: ${data.achievementName}! +${data.xpReward} XP. Level ${data.currentLevel}.`
  }),

  // Referral Converted
  referral_converted: (data: EmailTemplateData) => ({
    subject: `Your Referral Joined: ${data.referredName}`,
    html: `${emailHeader('Referral Success!')}
      <p>Hi ${data.volunteerName},</p>
      <p>Great news! <strong>${data.referredName}</strong> just joined Health Matters Clinic using your referral!</p>
      <p style="text-align: center; font-weight: 600; color: #10b981;">+${data.referralBonus} XP earned!</p>
      <p>Keep sharing your referral link to earn more XP and help grow our volunteer community.</p>
      ${actionButton('View Referral Dashboard', `${EMAIL_CONFIG.WEBSITE_URL}/referrals`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, ${data.referredName} joined via your referral! +${data.referralBonus} XP.`
  }),

  // Event Registration Confirmation
  event_registration_confirmation: (data: EmailTemplateData) => ({
    subject: `You're Signed Up: ${data.eventTitle}`,
    html: `${emailHeader('Event Registration Confirmed')}
      <p>Hi ${data.volunteerName},</p>
      <p>You're registered for the following event:</p>
      <div style="background: #f0f9ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
        <h3 style="margin: 0 0 12px 0; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.eventTitle}</h3>
        <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${data.eventDate}</p>
        <p style="margin: 0;"><strong>Location:</strong> ${data.eventLocation}</p>
      </div>
      <p><strong>What to bring:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin: 8px 0;">Your HMC volunteer badge (if you have one)</li>
        <li style="margin: 8px 0;">Comfortable closed-toe shoes</li>
        <li style="margin: 8px 0;">Water bottle</li>
        <li style="margin: 8px 0;">A positive attitude!</li>
      </ul>
      <p style="color: #6b7280;">If you can no longer attend, please update your registration in the portal so another volunteer can take your spot.</p>
      ${actionButton('View My Schedule', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, You're registered for ${data.eventTitle} on ${data.eventDate} at ${data.eventLocation}. See you there!`
  }),

  // Coordinator Registration Alert
  coordinator_registration_alert: (data: EmailTemplateData) => ({
    subject: `New Volunteer Signup: ${data.eventTitle}`,
    html: `${emailHeader('New Event Registration')}
      <p>Hi ${data.coordinatorName},</p>
      <p>A volunteer has signed up for an upcoming event:</p>
      <div style="background: #f0fdf4; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0 0 8px 0;"><strong>Volunteer:</strong> ${data.volunteerName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
        <p style="margin: 0;"><strong>Date:</strong> ${data.eventDate}</p>
      </div>
      <p>You can view all registrations and manage staffing in the admin portal.</p>
      ${actionButton('View Event Dashboard', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.coordinatorName}, ${data.volunteerName} signed up for ${data.eventTitle} on ${data.eventDate}.`
  }),

  // Public RSVP: Training Nudge (sent to matched but untrained volunteers)
  public_rsvp_training_nudge: (data: EmailTemplateData) => ({
    subject: `Complete Your Training to Volunteer at ${data.eventTitle}`,
    html: `${emailHeader('Almost Ready to Volunteer!')}
      <p>Hi ${data.volunteerName},</p>
      <p>We noticed you RSVP'd for <strong>${data.eventTitle}</strong> on <strong>${data.eventDate}</strong> — that's awesome!</p>
      <p>To volunteer at this event (not just attend), you'll need to complete your training first. It only takes a few minutes and you'll be ready to make a real impact.</p>
      <div style="background: #fef3c7; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
        <p style="margin: 0;"><strong>Date:</strong> ${data.eventDate}</p>
      </div>
      <p>Complete your training now so you can be part of the volunteer team:</p>
      ${actionButton('Complete My Training', `${EMAIL_CONFIG.WEBSITE_URL}/training`)}
      <p style="color: #6b7280;">You're already in our system — just finish your training and you'll be good to go!</p>
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, you RSVP'd for ${data.eventTitle} on ${data.eventDate}. Complete your training to volunteer at this event: ${EMAIL_CONFIG.WEBSITE_URL}/training`
  }),

  // Public RSVP: Volunteer Invite (sent to non-volunteers)
  public_rsvp_volunteer_invite: (data: EmailTemplateData) => ({
    subject: `Thanks for Your RSVP — Want to Join Our Volunteer Team?`,
    html: `${emailHeader('Join Our Volunteer Team!')}
      <p>Hi ${data.rsvpName},</p>
      <p>Thanks for RSVPing to <strong>${data.eventTitle}</strong> on <strong>${data.eventDate}</strong>! We're excited to have you there.</p>
      <p>Did you know you can also <strong>join our volunteer team</strong>? As a Health Matters Clinic volunteer, you'll get to:</p>
      <ul style="margin: 16px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin: 8px 0;">Make a direct impact in your community</li>
        <li style="margin: 8px 0;">Gain valuable experience and skills</li>
        <li style="margin: 8px 0;">Earn volunteer hours and recognition</li>
        <li style="margin: 8px 0;">Connect with an amazing team</li>
      </ul>
      ${actionButton('Apply to Volunteer', `${EMAIL_CONFIG.WEBSITE_URL}/apply`)}
      <p style="color: #6b7280;">No pressure — we'd love to have you whether you attend as a guest or join the team!</p>
    ${emailFooter()}`,
    text: `Hi ${data.rsvpName}, thanks for RSVPing to ${data.eventTitle}! Want to join our volunteer team? Apply here: ${EMAIL_CONFIG.WEBSITE_URL}/apply`
  }),

  // Event-based volunteer invite (sent by coordinator/admin to recruit new volunteers)
  event_volunteer_invite: (data: EmailTemplateData) => ({
    subject: `You're Invited to Volunteer with Health Matters Clinic!`,
    html: `${emailHeader("You're Invited to Volunteer!")}
      <p>Hi ${data.volunteerName},</p>
      <p>Thanks for your interest in volunteering with <strong>Health Matters Clinic</strong>! You've been invited to help at <strong>${data.eventTitle}</strong> on <strong>${data.eventDate}</strong>.</p>
      <p>To get started, create your account on our volunteer portal. Once registered, you'll be able to:</p>
      <ul style="margin: 16px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin: 8px 0;">Sign up for upcoming community health events</li>
        <li style="margin: 8px 0;">Complete required training modules</li>
        <li style="margin: 8px 0;">Track your volunteer hours and impact</li>
        <li style="margin: 8px 0;">Connect with the volunteer team</li>
      </ul>
      ${actionButton('Create Your Account', `${EMAIL_CONFIG.WEBSITE_URL}/apply`)}
      <p style="color: #6b7280;">We're excited to have you on the team!</p>
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, you're invited to volunteer at ${data.eventTitle} on ${data.eventDate}! Create your account here: ${EMAIL_CONFIG.WEBSITE_URL}/apply`
  }),

  // Coordinator: Public RSVP Name Match (needs manual review)
  coordinator_public_rsvp_name_match: (data: EmailTemplateData) => ({
    subject: `Review Needed: Possible Volunteer Match for RSVP`,
    html: `${emailHeader('RSVP Volunteer Match — Review Needed')}
      <p>Hi ${data.coordinatorName},</p>
      <p>A public RSVP was submitted that matches a volunteer by <strong>name only</strong> (no email or phone match). Please review and confirm whether this is the same person.</p>
      <div style="background: #fef3c7; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #f59e0b;">
        <h4 style="margin: 0 0 16px 0; color: #92400e;">RSVP Details</h4>
        <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${data.rsvpName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${data.rsvpEmail}</p>
        <p style="margin: 0 0 8px 0;"><strong>Phone:</strong> ${data.rsvpPhone || 'Not provided'}</p>
        <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
        <p style="margin: 0;"><strong>Date:</strong> ${data.eventDate}</p>
      </div>
      <div style="background: #f0f9ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
        <h4 style="margin: 0 0 16px 0; color: ${EMAIL_CONFIG.BRAND_COLOR};">Possible Volunteer Match</h4>
        <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${data.volunteerName}</p>
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${data.volunteerEmail}</p>
        <p style="margin: 0 0 8px 0;"><strong>Phone:</strong> ${data.volunteerPhone || 'Not on file'}</p>
        <p style="margin: 0;"><strong>Status:</strong> ${data.volunteerStatus}</p>
      </div>
      <p>If this is the same person, you can manually register them for the event in the admin portal.</p>
      ${actionButton('Review in Admin Portal', `${EMAIL_CONFIG.WEBSITE_URL}/admin/volunteers`)}
    ${emailFooter()}`,
    text: `Review needed: RSVP from ${data.rsvpName} (${data.rsvpEmail}) for ${data.eventTitle} may match volunteer ${data.volunteerName} (${data.volunteerEmail}). Name-only match — please verify.`
  }),

  // Event Created Notification (sent to outreach/content team leads)
  event_created_notification: (data: EmailTemplateData) => ({
    subject: `New Event Created: ${data.eventTitle}`,
    html: `${emailHeader('New Event Created')}
      <p>Hi ${data.volunteerName},</p>
      <p>A new community event has been created and may need outreach or content support:</p>
      <div style="background: #eef2ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
        <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${data.eventTitle}</p>
        <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${data.eventDate}</p>
        <p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${data.eventLocation}</p>
        <p style="margin: 0;"><strong>Created by:</strong> ${data.creatorName || 'Admin'}</p>
      </div>
      <p>Please coordinate any necessary social media posts, newsletters, or outreach materials for this event.</p>
      ${actionButton('View Event Dashboard', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, a new event "${data.eventTitle}" on ${data.eventDate} at ${data.eventLocation} has been created. Please coordinate outreach/content support.`
  }),

  // Support Ticket Notification
  support_ticket_notification: (data: EmailTemplateData) => ({
    subject: `New Support Ticket: ${data.subject}`,
    html: `${emailHeader('New Support Ticket Received')}
      <p>A new support ticket has been submitted:</p>
      <div style="background: #fef3c7; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 8px 0;"><strong>Subject:</strong> ${data.subject}</p>
        <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${data.submitterName} (${data.submitterEmail})</p>
        <p style="margin: 0 0 8px 0;"><strong>Category:</strong> ${data.category}</p>
        <p style="margin: 0 0 8px 0;"><strong>Priority:</strong> ${data.priority}</p>
        <p style="margin: 0 0 8px 0;"><strong>Ticket ID:</strong> ${data.ticketId}</p>
      </div>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; color: #374151;"><strong>Description:</strong></p>
        <p style="margin: 8px 0 0 0; color: #6b7280;">${data.description}</p>
      </div>
      <p>Please respond to this ticket at your earliest convenience.</p>
      ${actionButton('View Ticket', `${EMAIL_CONFIG.WEBSITE_URL}/admin/support`)}
    ${emailFooter()}`,
    text: `New support ticket from ${data.submitterName}: ${data.subject}. Description: ${data.description}. Ticket ID: ${data.ticketId}`
  }),
};

// Email Service Class - Uses Google Apps Script
class EmailService {
  static async send(
    templateName: keyof typeof EmailTemplates,
    data: EmailTemplateData
  ): Promise<{ sent: boolean; reason?: string }> {
    // Check opt-in for non-transactional emails
    const transactionalTypes = ['email_verification', 'password_reset', 'login_confirmation'];
    if (!transactionalTypes.includes(templateName) && data.userId) {
      const canSend = await canSendEmail(data.userId, 'alerts');
      if (!canSend) {
        console.log(`[EMAIL] Skipped ${templateName} - user opted out`);
        return { sent: false, reason: 'opted_out' };
      }
    }

    if (!EMAIL_SERVICE_URL) {
      console.warn('[EMAIL] EMAIL_SERVICE_URL not configured');
      return { sent: false, reason: 'not_configured' };
    }

    try {
      // Send to Google Apps Script
      const response = await fetch(EMAIL_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: templateName,
          ...data
        })
      });

      const result = await response.json() as { success?: boolean; error?: string };

      if (result.success) {
        console.log(`[EMAIL] ✅ Sent ${templateName} to ${maskEmail(data.toEmail)}`);
        return { sent: true };
      } else {
        console.error(`[EMAIL] ❌ Apps Script error: ${result.error}`);
        return { sent: false, reason: result.error || 'apps_script_error' };
      }
    } catch (error) {
      console.error(`[EMAIL] ❌ Failed to send ${templateName}:`, error);
      return { sent: false, reason: 'send_failed' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// GAMIFICATION SERVICE - XP, Achievements, Streaks
// ═══════════════════════════════════════════════════════════════

const XP_CONFIG = {
  SHIFT_COMPLETED: 50,
  SHIFT_COMPLETED_FLEXIBLE: 75,
  TRAINING_COMPLETED: 100,
  SIGNUP_COMPLETED: 50,
  REFERRAL_SIGNED_UP: 200,
  REFERRAL_COMPLETED_SHIFT: 100,
  SOCIAL_SHARE: 25,
  DONATION_MADE: 10,
  STREAK_7_DAYS: 100,
  STREAK_30_DAYS: 300,
  STREAK_52_WEEKS: 500,
};

const LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 6000, 10000, 15000, 25000, 40000, 60000];

interface VolunteerProfile {
  volunteerId: string;
  volunteerType: 'weekly_committed' | 'flexible';
  currentXP: number;
  totalXPEarned: number;
  level: number;
  achievementIds: string[];
  referralCode: string;
  referralCount: number;
  streakDays: number;
  lastActivityDate: Date | null;
  createdAt: Date;
}

class GamificationService {
  static generateReferralCode(): string {
    return 'HMC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  static calculateLevel(xp: number): number {
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
      else break;
    }
    return level;
  }

  static getXPToNextLevel(currentXP: number): number {
    const currentLevel = this.calculateLevel(currentXP);
    if (currentLevel >= LEVEL_THRESHOLDS.length) return 0;
    return LEVEL_THRESHOLDS[currentLevel] - currentXP;
  }

  static async getProfile(volunteerId: string): Promise<VolunteerProfile> {
    const doc = await db.collection('volunteer_profiles').doc(volunteerId).get();
    if (doc.exists) return doc.data() as VolunteerProfile;

    const newProfile: VolunteerProfile = {
      volunteerId,
      volunteerType: 'flexible',
      currentXP: 0,
      totalXPEarned: 0,
      level: 1,
      achievementIds: [],
      referralCode: this.generateReferralCode(),
      referralCount: 0,
      streakDays: 0,
      lastActivityDate: null,
      createdAt: new Date(),
    };
    await db.collection('volunteer_profiles').doc(volunteerId).set(newProfile);
    return newProfile;
  }

  static async addXP(
    volunteerId: string,
    action: string,
    customXP?: number,
    metadata?: Record<string, any>
  ): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
    const profile = await this.getProfile(volunteerId);

    let xp = customXP;
    if (!xp) {
      const actionXP: Record<string, number> = {
        shift_completed: profile.volunteerType === 'weekly_committed' ? XP_CONFIG.SHIFT_COMPLETED : XP_CONFIG.SHIFT_COMPLETED_FLEXIBLE,
        training_completed: XP_CONFIG.TRAINING_COMPLETED,
        signup_completed: XP_CONFIG.SIGNUP_COMPLETED,
        event_signup: 25, // XP for signing up for events
        referral_joined: XP_CONFIG.REFERRAL_SIGNED_UP,
        shared: XP_CONFIG.SOCIAL_SHARE,
        donated: XP_CONFIG.DONATION_MADE,
      };
      xp = actionXP[action] || 0;
    }

    const newXP = profile.currentXP + xp;
    const newLevel = this.calculateLevel(newXP);
    const leveledUp = newLevel > profile.level;

    await db.collection('volunteer_profiles').doc(volunteerId).update({
      currentXP: newXP,
      totalXPEarned: (profile.totalXPEarned || 0) + xp,
      level: newLevel,
      lastActivityDate: new Date(),
    });

    await db.collection('xp_events').add({
      volunteerId,
      action,
      xpAmount: xp,
      metadata,
      timestamp: new Date(),
    });

    // Check achievements if leveled up
    if (leveledUp) {
      await this.checkAchievements(volunteerId, newLevel);
    }

    return { newXP, newLevel, leveledUp };
  }

  static async checkAchievements(volunteerId: string, level: number): Promise<void> {
    const profile = await this.getProfile(volunteerId);
    const volunteer = await db.collection('volunteers').doc(volunteerId).get();
    const volData = volunteer.data();

    // Level-based achievements
    const levelAchievements: Record<number, { name: string; description: string; xp: number }> = {
      2: { name: 'Getting Started', description: 'Reached Level 2', xp: 50 },
      5: { name: 'Rising Star', description: 'Reached Level 5 (Silver Tier)', xp: 100 },
      8: { name: 'Community Champion', description: 'Reached Level 8 (Gold Tier)', xp: 200 },
      10: { name: 'Volunteer Legend', description: 'Reached Level 10 (Platinum)', xp: 500 },
    };

    const achievement = levelAchievements[level];
    if (achievement && !profile.achievementIds.includes(`level_${level}`)) {
      await db.collection('volunteer_profiles').doc(volunteerId).update({
        achievementIds: admin.firestore.FieldValue.arrayUnion(`level_${level}`),
      });

      // Send achievement email
      if (volData?.email) {
        await EmailService.send('achievement_unlocked', {
          toEmail: volData.email,
          volunteerName: volData.name || volData.firstName || 'Volunteer',
          achievementName: achievement.name,
          achievementDescription: achievement.description,
          xpReward: achievement.xp,
          currentLevel: level,
        });
      }

      // Award bonus XP
      await this.addXP(volunteerId, 'achievement', achievement.xp, { achievement: `level_${level}` });
    }
  }

  static async updateStreak(volunteerId: string): Promise<{ streakDays: number; bonusXP: number }> {
    const profile = await this.getProfile(volunteerId);
    const today = new Date().toISOString().split('T')[0];
    const lastActivity = profile.lastActivityDate
      ? new Date(profile.lastActivityDate).toISOString().split('T')[0]
      : null;

    if (lastActivity === today) {
      return { streakDays: profile.streakDays, bonusXP: 0 };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const newStreak = lastActivity === yesterdayStr ? profile.streakDays + 1 : 1;
    let bonusXP = 0;

    if (newStreak === 7) bonusXP = XP_CONFIG.STREAK_7_DAYS;
    else if (newStreak === 30) bonusXP = XP_CONFIG.STREAK_30_DAYS;
    else if (newStreak === 52) bonusXP = XP_CONFIG.STREAK_52_WEEKS;

    await db.collection('volunteer_profiles').doc(volunteerId).update({
      streakDays: newStreak,
      lastActivityDate: new Date(),
    });

    if (bonusXP > 0) {
      await this.addXP(volunteerId, 'streak_bonus', bonusXP, { streakDays: newStreak });
    }

    return { streakDays: newStreak, bonusXP };
  }

  static async convertReferral(referralCode: string, newVolunteerId: string): Promise<boolean> {
    const referrerSnapshot = await db.collection('volunteer_profiles')
      .where('referralCode', '==', referralCode)
      .limit(1)
      .get();

    if (referrerSnapshot.empty) return false;

    const referrerId = referrerSnapshot.docs[0].id;
    const referrer = await db.collection('volunteers').doc(referrerId).get();
    const newVol = await db.collection('volunteers').doc(newVolunteerId).get();

    await db.collection('referrals').add({
      referrerId,
      referralCode,
      referredVolunteerId: newVolunteerId,
      status: 'converted',
      convertedAt: new Date(),
      createdAt: new Date(),
    });

    await db.collection('volunteer_profiles').doc(referrerId).update({
      referralCount: admin.firestore.FieldValue.increment(1),
    });

    await this.addXP(referrerId, 'referral_joined', undefined, { newVolunteerId });

    // Send email to referrer
    if (referrer.exists && referrer.data()?.email) {
      await EmailService.send('referral_converted', {
        toEmail: referrer.data()?.email,
        volunteerName: referrer.data()?.name || referrer.data()?.firstName || 'Volunteer',
        referredName: newVol.data()?.name || newVol.data()?.firstName || 'New Volunteer',
        referralBonus: XP_CONFIG.REFERRAL_SIGNED_UP,
      });
    }

    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
// REFERRAL EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════

const REFERRAL_TEMPLATES = {
  basic: {
    subject: 'Join me volunteering with Health Matters Clinic!',
    body: `Hi [Friend Name],

I've been volunteering with Health Matters Clinic, a 501(c)(3) nonprofit focused on health equity.

Whether you have 2 hours a month or 5 hours a week, there's a role for you.

Sign up: [VOLUNTEER_LINK]
Donate: [DONATION_LINK]

– [Your Name]`
  },
  impact_focused: {
    subject: 'Come volunteer with me - make a real difference!',
    body: `Hi [Friend Name],

I've been volunteering with Health Matters Clinic.

In the past month, I've served [HOURS] hours helping [PEOPLE_HELPED] people get healthcare.

Join me: [VOLUNTEER_LINK]
Donate: [DONATION_LINK]

– [Your Name]`
  },
  short: {
    subject: 'Volunteer with me at Health Matters Clinic',
    body: `Hi [Friend Name],

I'm volunteering with Health Matters Clinic. They need people like you.

Sign up: [VOLUNTEER_LINK]
Donate: [DONATION_LINK]

– [Your Name]`
  },
  team_building: {
    subject: 'Build a volunteer team with me!',
    body: `Hi [Friend Name],

I'm recruiting friends to volunteer together with Health Matters Clinic.

Sign up with my link: [VOLUNTEER_LINK]
Or donate: [DONATION_LINK]

– [Your Name]`
  }
};

const SOCIAL_TEMPLATES = {
  instagram: `Just completed [HOURS] hours volunteering with @healthmatters.clinic

Want to join me? Link in bio!

#HealthMatters #Volunteering #HealthEquity`,
  linkedin: `I'm proud to volunteer with Health Matters Clinic, a 501(c)(3) nonprofit dedicated to health equity.

I've contributed [HOURS] hours as a [ROLE], helping [PEOPLE_HELPED] people.

Learn more: [ORG_WEBSITE]

#HealthEquity #Volunteering`,
  youtube: `I volunteer with Health Matters Clinic, a nonprofit providing mobile health services in LA.

Want to volunteer? → [VOLUNTEER_LINK]
Donate → [DONATION_LINK]`
};

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const sessionToken = req.headers.authorization?.split('Bearer ')[1];
    if (!sessionToken) return res.status(403).json({ error: 'Unauthorized: No token provided.' });
    try {
        const sessionDoc = await db.collection('sessions').doc(sessionToken).get();
        if (!sessionDoc.exists) return res.status(403).json({ error: 'Unauthorized: Invalid session.' });
        const session = sessionDoc.data()!;
        if (new Date() > session.expires.toDate()) {
            await db.collection('sessions').doc(sessionToken).delete();
            return res.status(403).json({ error: 'Unauthorized: Session expired.' });
        }

        const userDoc = await db.collection('volunteers').doc(session.uid).get();
        if (!userDoc.exists) {
            return res.status(403).json({ error: 'Unauthorized: User profile not found.' });
        }

        // Google OAuth users have IDs like 'google_<sub>' - they don't exist in Firebase Auth
        // Email/password users exist in Firebase Auth and can be verified there
        let userRecord = null;
        if (!session.uid.startsWith('google_')) {
            try {
                userRecord = await auth.getUser(session.uid);
            } catch (authError) {
                console.warn(`Firebase Auth user not found for ${session.uid}, using Firestore profile only`);
            }
        }

        const profile = userDoc.data();
        (req as any).user = userRecord ? { ...userRecord, profile } : { uid: session.uid, profile };
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(403).json({ error: 'Unauthorized: Invalid or expired token.' });
    }
};

const createSession = async (uid: string, res: Response) => {
    const userDoc = await db.collection('volunteers').doc(uid).get();
    const user = userDoc.data();
    // SECURITY: isAdmin status is ONLY read from database, never from client request

    const sessionToken = crypto.randomBytes(64).toString('hex');
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours (reduced from 24 for security)
    await db.collection('sessions').doc(sessionToken).set({ uid, expires });
    res.json({ token: sessionToken, user: { ...user, id: uid } });
};

// ═══════════════════════════════════════════════════════════════
// SHARED ROLE CONSTANTS — Single source of truth for all role checks
// ═══════════════════════════════════════════════════════════════
const EVENT_MANAGEMENT_ROLES = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead'];
const BOARD_ROLES = ['Board Member', 'Community Advisory Board'];
const COORDINATOR_AND_LEAD_ROLES = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Development Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead'];
const REGISTRATION_MANAGEMENT_ROLES = EVENT_MANAGEMENT_ROLES; // roles that can register/unregister others
const ORG_CALENDAR_ROLES = [...COORDINATOR_AND_LEAD_ROLES, 'Board Member'];

// --- AUTHENTICATION ROUTES ---

app.post('/auth/send-verification', verifyCaptcha, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    // Rate limiting: 5 requests per hour per email
    const rateLimitDoc = await db.collection('email_rate_limits').doc(email).get();
    const hourAgo = Date.now() - 60 * 60 * 1000;

    if (rateLimitDoc.exists) {
      const data = rateLimitDoc.data()!;
      if (data.windowStart > hourAgo && data.count >= 5) {
        return res.status(429).json({ error: 'Too many verification requests. Try again later.' });
      }
      // Reset window if expired, otherwise increment
      if (data.windowStart <= hourAgo) {
        await db.collection('email_rate_limits').doc(email).set({ windowStart: Date.now(), count: 1 });
      } else {
        await db.collection('email_rate_limits').doc(email).update({ count: admin.firestore.FieldValue.increment(1) });
      }
    } else {
      await db.collection('email_rate_limits').doc(email).set({ windowStart: Date.now(), count: 1 });
    }

    // Secure code generation using crypto.randomInt
    const code = crypto.randomInt(100000, 999999).toString();

    // Hash code before storage
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    await db.collection('verification_codes').doc(email).set({
      hashedCode,
      expires: Date.now() + 15 * 60 * 1000,
      attempts: 0
    });

    // Send verification email using template
    console.log(`[SERVER] Attempting to send verification email to ${maskEmail(email)}...`);
    console.log(`[SERVER] EMAIL_SERVICE_URL configured: ${!!EMAIL_SERVICE_URL}`);

    const emailResult = await EmailService.send('email_verification', {
      toEmail: email,
      volunteerName: email.split('@')[0], // Use email prefix as name
      verificationCode: code,
      expiresIn: 15,
    });

    if (!emailResult.sent) {
      console.error("[SERVER] Email send failed:", emailResult.reason);
      if (emailResult.reason === 'not_configured') {
        return res.status(500).json({ error: "Email service is not configured. Please set EMAIL_SERVICE_URL." });
      }
      return res.status(500).json({ error: `Email send failed: ${emailResult.reason}` });
    }

    console.log(`[SERVER] Verification email sent successfully to ${maskEmail(email)}.`);
    res.json({ success: true });

  } catch (error) {
    console.error("[SERVER] Email send error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Email error: ${errMsg}` });
  }
});

app.post('/auth/verify-code', async (req: Request, res: Response) => {
  const { email, code } = req.body;
  try {
      const doc = await db.collection('verification_codes').doc(email).get();
      if (!doc.exists) return res.status(400).json({ valid: false, message: "Code not found or expired" });

      const data = doc.data();
      if (Date.now() > data?.expires) {
          await db.collection('verification_codes').doc(email).delete();
          return res.status(400).json({ valid: false, message: "Code expired" });
      }

      // Hash the input code and compare with stored hash
      const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
      if (data?.hashedCode !== hashedInput) {
          return res.status(400).json({ valid: false, message: "Invalid code" });
      }

      await db.collection('verification_codes').doc(email).delete();
      res.json({ valid: true });
  } catch(e) {
      console.error("Verification error", e);
      res.status(500).json({ error: "Verification failed" });
  }
});

// Note: CAPTCHA already verified during email verification step, not needed here
app.post('/auth/signup', rateLimit(5, 60000), async (req: Request, res: Response) => {
    const { user, password, googleCredential, referralCode } = req.body;

    // Either password or googleCredential is required
    if (!password && !googleCredential) {
        return res.status(400).json({ error: 'Authentication method required.' });
    }

    // Check Firebase is configured for email/password signup
    if (password && !firebaseConfigured) {
        console.error('[SIGNUP] Firebase Auth not configured - cannot create email/password users');
        return res.status(503).json({
            error: 'Email signup is temporarily unavailable. Please use Google Sign-In or contact support.',
            details: 'Firebase credentials not configured on server.'
        });
    }

    try {
        // Check if email already exists
        const existingByEmail = await db.collection('volunteers')
            .where('email', '==', user.email.toLowerCase())
            .limit(1)
            .get();

        if (!existingByEmail.empty) {
            return res.status(409).json({
                error: 'An account with this email already exists. Please log in instead.',
                existingAccount: true
            });
        }

        user.role = user.appliedRole || 'HMC Champion';
        user.status = 'applicant';
        user.applicationStatus = 'pendingReview';

        let finalUserId: string;

        if (googleCredential) {
            // Google OAuth signup - verify token and use Google's sub as ID
            const googleUser = await verifyGoogleToken(googleCredential);
            if (!googleUser) {
                return res.status(401).json({ error: 'Invalid Google credential.' });
            }
            finalUserId = `google_${googleUser.sub}`;
            user.authProvider = 'google';
        } else {
            // Email/password signup - create Firebase Auth user
            try {
                const userRecord = await auth.createUser({ email: user.email, password, displayName: user.name });
                finalUserId = userRecord.uid;
                user.authProvider = 'email';
            } catch (authError: any) {
                console.error('[SIGNUP] Firebase Auth createUser failed:', authError.message);
                if (authError.message?.includes('no configuration') || authError.code === 'auth/configuration-not-found') {
                    return res.status(503).json({
                        error: 'Email signup is temporarily unavailable. Please use Google Sign-In.',
                        details: 'Firebase Auth configuration issue.'
                    });
                }
                throw authError;
            }
        }

        const { resume, ...userDataToSave } = user;
        userDataToSave.id = finalUserId;

        // Check if this email is in the admin bootstrap list
        const bootstrapDoc = await db.collection('admin_bootstrap').doc('pending').get();
        if (bootstrapDoc.exists && bootstrapDoc.data()?.email === user.email.toLowerCase()) {
            userDataToSave.isAdmin = true;
            await db.collection('admin_bootstrap').doc('pending').delete();
            console.log(`[BOOTSTRAP] Auto-promoted new signup ${maskEmail(user.email)} to admin`);
        }

        await db.collection('volunteers').doc(finalUserId).set(userDataToSave);

        // Initialize gamification profile
        await GamificationService.getProfile(finalUserId);

        // Send welcome email
        await EmailService.send('welcome_volunteer', {
          toEmail: user.email,
          volunteerName: user.name || user.firstName || 'Volunteer',
          appliedRole: user.appliedRole || 'HMC Champion',
        });

        // Send application received email
        await EmailService.send('application_received', {
          toEmail: user.email,
          volunteerName: user.name || user.firstName || 'Volunteer',
          appliedRole: user.appliedRole || 'HMC Champion',
          applicationId: finalUserId.substring(0, 12).toUpperCase(),
        });

        // Notify admin team about new applicant
        try {
          await EmailService.send('admin_new_applicant', {
            toEmail: 'volunteer@healthmatters.clinic',
            volunteerName: user.name || user.firstName || 'New Applicant',
            volunteerEmail: user.email,
            appliedRole: user.appliedRole || 'HMC Champion',
            applicationId: finalUserId.substring(0, 12).toUpperCase(),
          });
          console.log(`[SIGNUP] Sent admin notification for new applicant: ${maskEmail(user.email)}`);
        } catch (adminEmailErr) {
          console.error('[SIGNUP] Failed to send admin notification:', adminEmailErr);
        }

        // Process referral if provided
        if (referralCode) {
          await GamificationService.convertReferral(referralCode, finalUserId);
        }

        await createSession(finalUserId, res);
    } catch (error) {
        console.error("Signup error:", error);
        res.status(400).json({ error: (error as Error).message });
    }
});

app.post('/auth/login', rateLimit(10, 60000), async (req: Request, res: Response) => {
    const { email, password } = req.body;
    // SECURITY: isAdmin is NEVER accepted from client - always read from database
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    try {
        if (!FIREBASE_WEB_API_KEY) {
            console.error('[AUTH] FIREBASE_WEB_API_KEY is not configured — cannot verify password');
            return res.status(503).json({ error: 'Login is temporarily unavailable. Please try Google Sign-In or contact support.' });
        }
        const firebaseLoginUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
        const firebaseRes = await fetch(firebaseLoginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        });

        if (!firebaseRes.ok) {
            const err = await firebaseRes.json() as { error?: { message?: string; code?: number } };
            const errorMsg = err.error?.message || "Invalid credentials.";
            console.error(`[AUTH] Login failed for ${maskEmail(email)} — Firebase error: ${errorMsg} (HTTP ${firebaseRes.status})`);

            // Email/password sign-in disabled at project level
            if (errorMsg.includes('PASSWORD_LOGIN_DISABLED')) {
                console.warn('[AUTH] PASSWORD_LOGIN_DISABLED - Email/password sign-in may be disabled in Firebase console');
                const existingUser = await db.collection('volunteers')
                    .where('email', '==', email.toLowerCase())
                    .limit(1)
                    .get();

                if (!existingUser.empty) {
                    return res.status(401).json({
                        error: "Email/password login is currently unavailable. Please sign in with Google instead.",
                        useGoogle: true
                    });
                }
                return res.status(401).json({
                    error: "Email/password login is currently unavailable. Please sign in with Google or contact support."
                });
            }

            // Invalid credentials - determine root cause and provide actionable recovery
            if (errorMsg.includes('INVALID_LOGIN_CREDENTIALS')) {
                const emailLower = email.toLowerCase();

                // Step 1: Check Firebase Auth record directly for provider info
                let fbUser: admin.auth.UserRecord | null = null;
                try {
                    fbUser = await auth.getUserByEmail(emailLower);
                    const providers = fbUser.providerData.map(p => p.providerId);
                    const hasPasswordProvider = providers.includes('password');
                    const hasGoogleProvider = providers.includes('google.com');
                    console.error(`[AUTH] Firebase Auth record for ${maskEmail(email)}: uid=${fbUser.uid}, providers=[${providers.join(',')}], hasPassword=${hasPasswordProvider}, disabled=${fbUser.disabled}, created=${fbUser.metadata.creationTime}`);

                    // Account is disabled
                    if (fbUser.disabled) {
                        return res.status(401).json({ error: 'This account has been disabled. Please contact support.' });
                    }

                    // No password provider — must use Google
                    if (!hasPasswordProvider && hasGoogleProvider) {
                        return res.status(401).json({
                            error: "This account uses Google Sign-In. Please click 'Sign in with Google' instead.",
                            useGoogle: true
                        });
                    }

                    // Has password provider but credentials rejected — password is wrong
                    if (hasPasswordProvider) {
                        console.error(`[AUTH] Account ${maskEmail(email)} HAS password provider but credentials rejected. API key source: ${process.env.FIREBASE_WEB_API_KEY ? 'FIREBASE_WEB_API_KEY' : 'VITE_FIREBASE_API_KEY'}, key preview: ${FIREBASE_WEB_API_KEY.substring(0, 8)}...${FIREBASE_WEB_API_KEY.substring(FIREBASE_WEB_API_KEY.length - 4)}`);
                        return res.status(401).json({
                            error: "Incorrect password. Please try again or click 'Forgot password?' to reset it.",
                            needsPasswordReset: true
                        });
                    }

                    // No password provider and no Google — account exists but no login method
                    if (!hasPasswordProvider && !hasGoogleProvider) {
                        console.error(`[AUTH] Account ${maskEmail(email)} has NO usable providers: [${providers.join(',')}]`);
                        return res.status(401).json({
                            error: "Your account needs a password. Please click 'Forgot password?' below to set one up.",
                            needsPasswordReset: true
                        });
                    }
                } catch (fbErr: any) {
                    console.error(`[AUTH] Could not look up Firebase Auth for ${maskEmail(email)}: ${fbErr.message}`);
                }

                // Step 2: Check Firestore record for additional context
                const existingUser = await db.collection('volunteers')
                    .where('email', '==', emailLower)
                    .limit(1)
                    .get();

                if (!existingUser.empty) {
                    const userData = existingUser.docs[0].data();
                    console.error(`[AUTH] Firestore record for ${maskEmail(email)}: authProvider=${userData.authProvider}, docId=${existingUser.docs[0].id}, fbUid=${fbUser?.uid || 'unknown'}`);

                    // Firestore says Google but Firebase Auth lookup failed — still suggest Google
                    if (userData.authProvider === 'google') {
                        return res.status(401).json({
                            error: "This account uses Google Sign-In. Please click 'Sign in with Google' instead.",
                            useGoogle: true
                        });
                    }

                    // Account exists but may need password setup
                    if (userData.authProvider === 'manual' || !userData.authProvider) {
                        return res.status(401).json({
                            error: "Your account needs a password. Please click 'Forgot password?' below to set one up.",
                            needsPasswordReset: true
                        });
                    }

                    // authProvider is 'email' — they should have a password but it's wrong
                    return res.status(401).json({
                        error: "Incorrect password. Please try again or click 'Forgot password?' to reset it.",
                        needsPasswordReset: true
                    });
                } else {
                    console.error(`[AUTH] No Firestore volunteer record found for ${maskEmail(email)}`);
                }
                return res.status(401).json({ error: 'No account found with this email. Please sign up first.' });
            }

            // Never expose raw Firebase error codes to users
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const firebaseData = await firebaseRes.json() as { localId: string };
        console.log(`[AUTH] Login successful for ${maskEmail(email)} (uid: ${firebaseData.localId})`);
        await createSession(firebaseData.localId, res);
    } catch (error) {
        console.error(`[AUTH] Login exception for ${maskEmail(email)}:`, (error as Error).message);
        res.status(500).json({ error: "Internal server error." });
    }
});

app.post('/auth/forgot-password', rateLimit(3, 60000), async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    try {
        const emailLower = email.toLowerCase();

        // Look up volunteer in Firestore
        const volSnap = await db.collection('volunteers')
            .where('email', '==', emailLower)
            .limit(1)
            .get();

        if (volSnap.empty) {
            // No volunteer record - return success anyway to prevent email enumeration
            console.log(`[AUTH] Password reset requested for unknown email: ${maskEmail(emailLower)}`);
            return res.json({ success: true, message: 'If an account exists with that email, a password reset link has been sent.' });
        }

        const volDoc = volSnap.docs[0];
        const volData = volDoc.data();
        const volunteerName = volData.name || 'Volunteer';

        // Check if Firebase Auth user exists; if not, create one
        let resetLink: string;
        try {
            resetLink = await auth.generatePasswordResetLink(emailLower);
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
                // Volunteer exists in Firestore but not in Firebase Auth - create the auth account
                console.log(`[AUTH] Creating Firebase Auth account for existing volunteer: ${maskEmail(emailLower)}`);
                const tempPassword = crypto.randomBytes(9).toString('base64url') + 'A1!';
                const userRecord = await auth.createUser({
                    email: emailLower,
                    password: tempPassword,
                    displayName: volunteerName,
                });

                // Update Firestore doc to link to Firebase Auth UID
                await db.collection('volunteers').doc(userRecord.uid).set({
                    ...volData,
                    id: userRecord.uid,
                    authProvider: 'email',
                }, { merge: true });

                // If old doc ID was different, delete the orphan
                if (volDoc.id !== userRecord.uid) {
                    await db.collection('volunteers').doc(volDoc.id).delete();
                    console.log(`[AUTH] Migrated volunteer doc ${volDoc.id} -> ${userRecord.uid}`);
                }

                resetLink = await auth.generatePasswordResetLink(emailLower);
            } else {
                throw err;
            }
        }

        // Send branded email through our own email service
        await EmailService.send('password_reset', {
            toEmail: emailLower,
            volunteerName,
            resetLink,
            expiresInHours: 1,
        });

        console.log(`[AUTH] Password reset email sent to ${maskEmail(emailLower)}`);
        res.json({ success: true, message: 'If an account exists with that email, a password reset link has been sent.' });
    } catch (error: any) {
        console.error('Password reset error:', error);
        res.json({ success: true, message: 'If an account exists with that email, a password reset link has been sent.' });
    }
});

app.post('/auth/login/google', rateLimit(10, 60000), async (req: Request, res: Response) => {
    const { credential, referralCode } = req.body;
    // SECURITY: isAdmin is NEVER accepted from client - always read from database
    if (!credential) return res.status(400).json({ error: "Google credential is required." });
    try {
        // Verify Google OAuth token
        const googleUser = await verifyGoogleToken(credential);
        if (!googleUser) {
            return res.status(401).json({ error: "Invalid Google token." });
        }

        // Use Google's sub (subject) as user ID, prefixed to avoid conflicts
        const userId = `google_${googleUser.sub}`;

        // First check if this Google account already exists
        const userDoc = await db.collection('volunteers').doc(userId).get();

        // Also check if this email exists with a different auth provider
        const existingByEmail = await db.collection('volunteers')
            .where('email', '==', googleUser.email.toLowerCase())
            .limit(1)
            .get();

        // If email exists with different provider, link accounts or inform user
        if (!userDoc.exists && !existingByEmail.empty) {
            const existingUser = existingByEmail.docs[0].data();
            if (existingUser.authProvider === 'email') {
                // User signed up with email/password before - log them in with that account
                console.log(`[AUTH] Google login for existing email/password user: ${maskEmail(googleUser.email)}`);
                await createSession(existingByEmail.docs[0].id, res);
                return;
            }
        }

        const isNewUser = !userDoc.exists && existingByEmail.empty;

        if (isNewUser) {
             // Check if this email is in the admin bootstrap list
             let shouldBeAdmin = false;
             const bootstrapDoc = await db.collection('admin_bootstrap').doc('pending').get();
             if (bootstrapDoc.exists && bootstrapDoc.data()?.email === googleUser.email.toLowerCase()) {
                 shouldBeAdmin = true;
                 await db.collection('admin_bootstrap').doc('pending').delete();
                 console.log(`[BOOTSTRAP] Auto-promoted Google signup ${maskEmail(googleUser.email)} to admin`);
             }

             await db.collection('volunteers').doc(userId).set({
                 id: userId,
                 email: googleUser.email,
                 name: googleUser.name || 'Volunteer',
                 firstName: googleUser.name?.split(' ')[0] || 'Volunteer',
                 profilePhoto: googleUser.picture || null,
                 authProvider: 'google',
                 role: 'HMC Champion',
                 status: 'onboarding',
                 isNewUser: true,
                 joinedDate: new Date().toISOString(),
                 onboardingProgress: 0,
                 hoursContributed: 0,
                 points: 0,
                 isAdmin: shouldBeAdmin,
                 compliance: {
                    application: { id: 'c-app', label: 'Application', status: 'verified' },
                    backgroundCheck: { id: 'c-bg', label: 'Background Check', status: 'pending' },
                    training: { id: 'c-train', label: 'Training', status: 'pending' },
                    orientation: { id: 'c-orient', label: 'Orientation', status: 'pending' }
                 },
                 availability: { days: [], preferredTime: 'Flexible', startDate: new Date().toISOString() },
                 skills: [],
                 tasks: [],
                 achievements: []
             });

             // Initialize gamification profile
             await GamificationService.getProfile(userId);

             // Send welcome email
             await EmailService.send('welcome_volunteer', {
               toEmail: googleUser.email,
               volunteerName: googleUser.name || 'Volunteer',
               appliedRole: 'HMC Champion',
             });

             // Process referral if provided
             if (referralCode) {
               await GamificationService.convertReferral(referralCode, userId);
             }
        }

        await createSession(userId, res);
    } catch (error) {
        console.error("Google Login error:", error);
        res.status(500).json({ error: "Google login verification failed." });
    }
});

app.post('/auth/logout', async (req: Request, res: Response) => {
    const sessionToken = req.headers.authorization?.split('Bearer ')[1];
    if (sessionToken) { try { await db.collection('sessions').doc(sessionToken).delete(); } catch (error) {} }
    res.status(204).send();
});

app.post('/auth/decode-google-token', async (req: Request, res: Response) => {
    const { credential } = req.body;
    try {
        const payload = await verifyGoogleToken(credential);
        if (!payload) {
            return res.status(400).json({ error: "Invalid Google token" });
        }
        res.json({ email: payload.email, name: payload.name });
    } catch(e) {
        console.error('[DECODE TOKEN] Error:', e);
        res.status(400).json({ error: "Invalid token" });
    }
});

app.get('/auth/me', verifyToken, async (req: Request, res: Response) => {
    try {
        const userProfile = (req as any).user.profile;
        const userId = userProfile.id;

        // Fetch core data first (these should always work)
        const [volunteersSnap, opportunitiesSnap, shiftsSnap, ticketsSnap, announcementsSnap] = await Promise.all([
            db.collection('volunteers').get(),
            db.collection('opportunities').get(),
            db.collection('shifts').get(),
            db.collection('support_tickets').get(),
            db.collection('announcements').orderBy('date', 'desc').get().catch(() => ({ docs: [] })),
        ]);

        // Fetch messages separately with fallback (these queries require indexes)
        let messages: any[] = [];
        try {
            const [sentMsgs, receivedMsgs, generalMsgs] = await Promise.all([
                db.collection('messages').where('senderId', '==', userId).orderBy('timestamp', 'desc').limit(100).get(),
                db.collection('messages').where('recipientId', '==', userId).orderBy('timestamp', 'desc').limit(100).get(),
                db.collection('messages').where('recipientId', '==', 'general').orderBy('timestamp', 'desc').limit(50).get(),
            ]);
            // Dedupe messages
            const messagesMap = new Map();
            [...sentMsgs.docs, ...receivedMsgs.docs, ...generalMsgs.docs].forEach(doc => {
                messagesMap.set(doc.id, { id: doc.id, ...doc.data() });
            });
            messages = Array.from(messagesMap.values());
        } catch (msgError) {
            console.warn('[AUTH/ME] Messages query failed (may need Firestore indexes):', msgError);
            // Fallback: try simple query without orderBy
            try {
                const allMsgs = await db.collection('messages').limit(200).get();
                messages = allMsgs.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter((m: any) => m.senderId === userId || m.recipientId === userId || m.recipientId === 'general');
            } catch (fallbackError) {
                console.warn('[AUTH/ME] Fallback messages query also failed:', fallbackError);
                messages = [];
            }
        }

        // Compute online status based on lastActiveAt (within last 90 seconds = online)
        const fiveMinutesAgo = new Date(Date.now() - 90 * 1000).toISOString();
        const volunteersWithOnlineStatus = volunteersSnap.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                isOnline: data.lastActiveAt ? data.lastActiveAt >= fiveMinutesAgo : false
            };
        });

        // Fetch gamification profile
        let gamification = null;
        try {
            const gpDoc = await db.collection('volunteer_profiles').doc(userId).get();
            if (gpDoc.exists) {
                const gp = gpDoc.data()!;
                const currentXP = gp.currentXP || 0;
                const level = GamificationService.calculateLevel(currentXP);
                const xpToNext = GamificationService.getXPToNextLevel(currentXP);
                const nextThreshold = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
                const prevThreshold = level > 1 ? LEVEL_THRESHOLDS[level - 1] : 0;
                const levelProgress = nextThreshold > prevThreshold ? Math.round(((currentXP - prevThreshold) / (nextThreshold - prevThreshold)) * 100) : 100;
                gamification = {
                    currentXP, level, xpToNext, levelProgress,
                    streakDays: gp.streakDays || 0,
                    achievementIds: gp.achievementIds || [],
                    volunteerType: gp.volunteerType || 'flexible',
                    referralCode: gp.referralCode || '',
                    referralCount: gp.referralCount || 0,
                };
            }
        } catch (gpErr) {
            console.warn('[AUTH/ME] Gamification profile fetch failed:', gpErr);
        }

        res.json({
            user: userProfile,
            gamification,
            volunteers: volunteersWithOnlineStatus,
            opportunities: opportunitiesSnap.docs.map(d => ({...d.data(), id: d.id })),
            shifts: shiftsSnap.docs.map(d => ({...d.data(), id: d.id })),
            supportTickets: ticketsSnap.docs.map(d => ({...d.data(), id: d.id })),
            announcements: announcementsSnap.docs.map(d => ({...d.data(), id: d.id })),
            messages,
        });
    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        res.status(500).json({ error: "Failed to load application data." });
    }
});

// --- AI & DATA ROUTES ---

app.post('/api/gemini/analyze-resume', async (req: Request, res: Response) => {
    // Define available volunteer roles (excluding admin roles)
    const VOLUNTEER_ROLES = [
        'Core Volunteer',
        'Board Member',
        'Community Advisory Board',
        'Licensed Medical Professional',
        'Medical Admin',
        'Tech Team',
        'Data Analyst',
        'Development Coordinator',
        'Grant Writer',
        'Fundraising Volunteer',
        'Newsletter & Content Writer',
        'Social Media Team',
        'Events Lead',
        'Program Coordinator',
        'General Operations Coordinator',
        'Outreach & Engagement Lead',
        'Outreach Volunteer',
        'Volunteer Lead',
        'Student Intern'
    ];

    try {
        // Check if AI is configured
        if (!ai) {
            console.warn('[GEMINI] AI not configured - API_KEY environment variable not set');
            return res.json({
                recommendations: [],
                extractedSkills: [],
                error: 'AI service not configured. Please select a role manually.'
            });
        }

        const { base64Data, mimeType } = req.body;

        // Validate input
        if (!base64Data || !mimeType) {
            return res.status(400).json({
                error: 'Missing required fields: base64Data and mimeType',
                recommendations: [],
                extractedSkills: []
            });
        }

        console.log(`[GEMINI] Analyzing resume (mimeType: ${mimeType}, size: ${base64Data.length} chars)`);

        const rolesList = VOLUNTEER_ROLES.join(', ');
        const prompt = `You are an expert volunteer coordinator for Health Matters Clinic, a community health nonprofit.

Analyze this resume carefully and match the candidate to volunteer roles.

AVAILABLE ROLES (use EXACT names):
${rolesList}

ROLE DESCRIPTIONS:
- Core Volunteer: Community health event support, client interaction, general assistance
- Licensed Medical Professional: For doctors, nurses, NPs, PAs with active medical licenses
- Medical Admin: Medical records, patient intake, healthcare administration
- Tech Team: Software development, IT support, data engineering
- Data Analyst: Data analysis, visualization, SQL/Python skills
- Events Lead: Plan and coordinate pop-up clinics, wellness meetups, and community activations
- Volunteer Lead: Team leadership and volunteer management
- Newsletter & Content Writer: Donor newsletters, blog posts, and impact storytelling
- Social Media Team: Content creation and social media management
- Grant Writer: Grant proposal writing and research
- Development Coordinator: Fundraising and donor relations
- Fundraising Volunteer: Peer-to-peer and community fundraising
- Board Member: Governance, strategic planning (executive experience)
- Community Advisory Board: Community voice and advocacy
- Program Coordinator: Program management and delivery
- General Operations Coordinator: Scheduling, communications, data entry, and project coordination
- Outreach & Engagement Lead: Community outreach strategy, partnership building, grassroots engagement
- Outreach Volunteer: Grassroots outreach, event promotion, resource distribution
- Student Intern: Academic internship (currently enrolled students)

INSTRUCTIONS:
1. Extract all professional skills from the resume
2. Recommend the TOP 3 most suitable roles based on experience and qualifications
3. Calculate a realistic match percentage (50-95%) based on how well they fit
4. Provide brief reasoning for each recommendation

Return ONLY valid JSON in this exact format:
{
  "recommendations": [
    {"roleName": "EXACT_ROLE_NAME", "matchPercentage": 85, "reasoning": "Brief explanation"},
    {"roleName": "EXACT_ROLE_NAME", "matchPercentage": 75, "reasoning": "Brief explanation"},
    {"roleName": "EXACT_ROLE_NAME", "matchPercentage": 65, "reasoning": "Brief explanation"}
  ],
  "extractedSkills": ["skill1", "skill2", "skill3"]
}`;

        // Use gemini-2.0-flash for file/image analysis
        const text = await generateAIContent('gemini-2.0-flash', [
            { inlineData: { mimeType, data: base64Data } },
            prompt
        ], true);

        // Parse and validate the response
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (parseError) {
            console.error('[GEMINI] Failed to parse AI response:', text.substring(0, 200));
            return res.json({
                recommendations: [],
                extractedSkills: [],
                error: 'AI returned invalid response. Please select a role manually.'
            });
        }

        // Validate structure
        if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
            parsed.recommendations = [];
        }
        if (!parsed.extractedSkills || !Array.isArray(parsed.extractedSkills)) {
            parsed.extractedSkills = [];
        }

        // Validate role names - only keep valid ones
        parsed.recommendations = parsed.recommendations.filter((rec: any) =>
            rec.roleName && VOLUNTEER_ROLES.includes(rec.roleName)
        ).slice(0, 3);

        console.log(`[GEMINI] Resume analysis successful - ${parsed.recommendations.length} recommendations, ${parsed.extractedSkills.length} skills`);
        res.json(parsed);
    } catch (e: any) {
        const errorMsg = e.message || String(e);
        console.error('[GEMINI] Resume analysis error:', errorMsg);
        console.error('[GEMINI] Full error object:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
        // Return the actual error for debugging
        res.json({
            recommendations: [],
            extractedSkills: [],
            error: `Resume analysis failed: ${errorMsg}`
        });
    }
});

app.post('/api/gemini/generate-plan', async (req: Request, res: Response) => {
    const { role, experience } = req.body;

    // Helper to create default training plan
    const createDefaultPlan = (roleName: string) => ({
        role: roleName,
        orientationModules: [
            { id: 'default-1', title: 'Welcome to HMC', objective: 'Understand our mission and values.', estimatedMinutes: 10 },
            { id: 'default-2', title: `${roleName} Fundamentals`, objective: `Learn the core responsibilities of a ${roleName}.`, estimatedMinutes: 15 },
            { id: 'default-3', title: 'HIPAA & Privacy', objective: 'Understand patient privacy and data protection.', estimatedMinutes: 20 },
        ],
        completionGoal: 'Complete orientation to begin volunteering with HMC.',
        coachSummary: `Welcome to your ${roleName} journey at Health Matters Clinic!`
    });

    try {
        // Return default if AI is not configured
        if (!ai) {
            console.warn('[GEMINI] AI not configured for training plan generation - using default');
            return res.json(createDefaultPlan(role || 'Volunteer'));
        }

        const prompt = `You are creating a training plan for a new ${role} volunteer at Health Matters Clinic, a community health nonprofit serving underserved populations in Los Angeles.

CONTEXT:
- Health Matters Clinic provides free healthcare services at community events
- All volunteers must complete HIPAA training
- Training should be practical and role-specific

VOLUNTEER BACKGROUND: ${experience || 'General interest in community health'}

Generate a personalized onboarding training plan with 3-5 modules specific to the ${role} role.

Return ONLY valid JSON in this exact format:
{
  "role": "${role}",
  "orientationModules": [
    {"id": "mod-1", "title": "Module Title", "objective": "What they will learn", "estimatedMinutes": 15},
    {"id": "mod-2", "title": "Module Title", "objective": "What they will learn", "estimatedMinutes": 20}
  ],
  "completionGoal": "What completing this training enables them to do",
  "coachSummary": "A brief personalized message about their training path"
}`;

        const text = await generateAIContent('gemini-2.0-flash', prompt, true);

        // Parse and validate
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (parseError) {
            console.error('[GEMINI] Failed to parse training plan:', text.substring(0, 200));
            return res.json(createDefaultPlan(role || 'Volunteer'));
        }

        // Ensure required fields exist
        if (!parsed.role) parsed.role = role;
        if (!parsed.orientationModules || !Array.isArray(parsed.orientationModules) || parsed.orientationModules.length === 0) {
            parsed.orientationModules = createDefaultPlan(role).orientationModules;
        }
        if (!parsed.completionGoal) parsed.completionGoal = 'Complete orientation to begin volunteering.';
        if (!parsed.coachSummary) parsed.coachSummary = `Welcome to your ${role} journey at HMC!`;

        console.log(`[GEMINI] Training plan generated for ${role} with ${parsed.orientationModules.length} modules`);
        res.json(parsed);
    } catch(e: any) {
        console.error('[GEMINI] Training plan generation error:', e.message || e);
        res.json(createDefaultPlan(role || 'Volunteer'));
    }
});

app.post('/api/gemini/generate-quiz', async (req: Request, res: Response) => {
    const { moduleTitle, role } = req.body;

    // Default quiz content
    const createDefaultQuiz = () => ({
        question: `What is the most important takeaway from "${moduleTitle}" for your role as a ${role}?`,
        learningObjective: `Understand the key concepts covered in ${moduleTitle}.`,
        keyConcepts: [
            { concept: 'Core Knowledge', description: 'The fundamental principles covered in this training module.' },
            { concept: 'Practical Application', description: 'How to apply what you learned in real volunteer situations.' },
            { concept: 'HMC Values', description: "Aligning your work with Health Matters Clinic's mission." }
        ]
    });

    try {
        if (!ai) {
            console.warn('[GEMINI] AI not configured for quiz generation - using default');
            return res.json(createDefaultQuiz());
        }

        const text = await generateAIContent('gemini-2.0-flash',
            `Generate a reflective quiz question for the training module "${moduleTitle}" for a ${role} at Health Matters Clinic.

Return ONLY valid JSON in this format:
{
  "question": "A thoughtful open-ended question about the module content",
  "learningObjective": "What the volunteer should understand after this module",
  "keyConcepts": [
    {"concept": "Concept Name", "description": "Brief explanation of the concept"},
    {"concept": "Concept Name", "description": "Brief explanation of the concept"},
    {"concept": "Concept Name", "description": "Brief explanation of the concept"}
  ]
}`,
            true);

        let parsed;
        try {
            parsed = JSON.parse(text);
            // Validate structure
            if (!parsed.question || !parsed.learningObjective || !parsed.keyConcepts) {
                throw new Error('Invalid quiz structure');
            }
        } catch (parseError) {
            console.error('[GEMINI] Failed to parse quiz:', text.substring(0, 200));
            return res.json(createDefaultQuiz());
        }

        res.json(parsed);
    } catch(e: any) {
        console.error('[GEMINI] Quiz generation error:', e.message || e);
        res.json(createDefaultQuiz());
    }
});

// --- AI MODULE CONTENT GENERATION (for read_ack modules) ---
const moduleContentCache = new Map<string, { content: string; sections: { heading: string; body: string }[] }>();

app.post('/api/gemini/generate-module-content', async (req: Request, res: Response) => {
    const { moduleId, moduleTitle, moduleDesc, role } = req.body;

    if (!moduleTitle) {
        return res.status(400).json({ error: 'moduleTitle is required' });
    }

    // Check cache first (keyed by moduleId + role)
    const cacheKey = `${moduleId || moduleTitle}_${role || 'general'}`;
    const cached = moduleContentCache.get(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    // Serve real governance/clinical documents without AI generation
    const staticContent = STATIC_MODULE_CONTENT[moduleId];
    if (staticContent) {
        moduleContentCache.set(cacheKey, staticContent);
        return res.json(staticContent);
    }

    const createDefaultContent = () => ({
        content: moduleDesc || moduleTitle,
        sections: [
            { heading: 'Overview', body: moduleDesc || `This module covers ${moduleTitle}.` },
            { heading: 'Key Expectations', body: 'All volunteers are expected to understand and follow these guidelines in their work with Health Matters Clinic.' },
            { heading: 'Your Responsibility', body: `As a ${role || 'volunteer'}, you play a critical role in upholding these standards. Apply what you learn here in every interaction.` }
        ]
    });

    try {
        if (!ai) {
            console.warn('[GEMINI] AI not configured for module content - using default');
            const fallback = createDefaultContent();
            moduleContentCache.set(cacheKey, fallback);
            return res.json(fallback);
        }

        const text = await generateAIContent('gemini-2.0-flash',
            `You are creating training content for Health Matters Clinic (HMC), a nonprofit providing mobile health services in Los Angeles.

Generate detailed, professional training content for the module: "${moduleTitle}"
Module summary: "${moduleDesc || 'No summary provided'}"
This content is for a volunteer whose role is: "${role || 'General Volunteer'}"

CRITICAL: Always refer to the reader by their actual role title ("${role || 'Volunteer'}"). Never call them a "core volunteer," "general volunteer," or any other generic label unless that is literally their role. Frame all content, examples, and takeaways through the lens of what a ${role || 'volunteer'} would actually do at HMC.

Tailor the content to be relevant to their specific role. For example:
- A Board Member should see governance, oversight, fiduciary duty, and strategic decision-making perspectives
- A Community Advisory Board member should see community advocacy, program feedback, and accountability perspectives
- A Licensed Medical Professional should see clinical protocols, scope of practice, and patient safety angles
- A Medical Admin should see administrative compliance, records management, and clinical support perspectives
- A Data Analyst should see data governance, analytics ethics, reporting accuracy, and how this topic affects the data they handle
- A Tech Team member should see data security, system access, technical compliance, and infrastructure angles
- A Core Volunteer should see practical field guidance, community engagement, and hands-on event tips
- A Content Writer should see communication ethics, messaging standards, and storytelling with dignity
- A Social Media Team member should see public-facing communication, consent for media, and brand representation
- A Development Coordinator or Grant Writer should see donor relations, ethical fundraising, and compliance in funding
- A Volunteer Lead should see team management, training oversight, and volunteer support perspectives
- An Events or Program Coordinator should see logistics, operations, participant experience, and coordination angles

Return ONLY valid JSON in this format:
{
  "content": "A 1-2 sentence overall summary of this module tailored to the ${role || 'volunteer'} role",
  "sections": [
    { "heading": "Section Title", "body": "2-4 paragraphs of detailed, actionable content. Use clear language. Include specific examples relevant to what a ${role || 'volunteer'} would encounter at HMC." },
    { "heading": "Section Title", "body": "More detailed content..." },
    { "heading": "Section Title", "body": "More detailed content..." },
    { "heading": "Key Takeaways for ${role || 'Your Role'}", "body": "3-5 specific takeaways directly relevant to a ${role || 'volunteer'} at HMC." }
  ]
}

Generate 4-6 sections. Each section body should be 2-4 paragraphs of plain text. Content should be substantive (at least 800 words total) and specific to HMC's mission of serving underserved communities in Los Angeles through mobile health clinics, street medicine outreach, and community wellness activations.

IMPORTANT FORMATTING RULES:
- Do NOT use any markdown formatting. No **bold**, no *italic*, no bullet points with - or *, no # headings.
- Write in plain prose paragraphs only. The headings are already provided via the JSON "heading" field.
- Do NOT describe features or dashboards that may not exist. Focus on general principles, policies, and role expectations.
- Keep content grounded in real-world practices — do not invent specific UI features.`,
            true);

        let parsed;
        try {
            parsed = JSON.parse(text);
            if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
                throw new Error('Invalid content structure');
            }
        } catch (parseError) {
            console.error('[GEMINI] Failed to parse module content:', text.substring(0, 200));
            const fallback = createDefaultContent();
            moduleContentCache.set(cacheKey, fallback);
            return res.json(fallback);
        }

        moduleContentCache.set(cacheKey, parsed);
        res.json(parsed);
    } catch (e: any) {
        console.error('[GEMINI] Module content generation error:', e.message || e);
        const fallback = createDefaultContent();
        moduleContentCache.set(cacheKey, fallback);
        res.json(fallback);
    }
});

app.post('/api/gemini/validate-answer', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ isCorrect: true });
        const { question, answer } = req.body;

        // Be very lenient - if answer is at least 10 chars and shows effort, accept it
        if (answer && answer.trim().length >= 10) {
            const text = await generateAIContent('gemini-2.0-flash',
                `You are an EXTREMELY lenient volunteer training evaluator. Your job is to ENCOURAGE learners.

Question: "${question}"
User's Answer: "${answer}"

IMPORTANT RULES - Be VERY generous:
1. Accept ANY answer that shows the person watched/engaged with the content
2. Accept partial answers, paraphrased answers, or answers that capture the general spirit
3. Accept answers that mention ANY relevant concept from the training
4. If the answer is at least a few words and shows ANY effort or understanding, mark it CORRECT
5. Only mark as incorrect if the answer is completely unrelated, gibberish, or clearly shows no effort

Remember: This is volunteer training to help the community. We want to encourage participation, not gatekeep.

Respond with JSON only: { "isCorrect": true } or { "isCorrect": false }`,
                true);
            res.send(text);
        } else {
            // Very short answers (under 10 chars) are likely not real attempts
            res.json({ isCorrect: false });
        }
    } catch(e) {
        // On error, be lenient and pass them
        res.json({ isCorrect: true });
    }
});

app.post('/api/gemini/find-referral-match', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ recommendations: [] });
        const { clientNeed } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `Suggest 3 generic types of resources for: "${clientNeed}". JSON: { recommendations: [{ "Resource Name": "Example", "reasoning": "Fits need" }] }`,
            true);
        res.send(text);
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/generate-supply-list', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ supplyList: "- Water\n- Pens" });
        const { serviceNames, attendeeCount } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `Generate a checklist of supplies for a health fair with ${attendeeCount} attendees offering: ${serviceNames.join(', ')}. Plain text list.`);
        res.json({ supplyList: text });
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/generate-summary', async (req: Request, res: Response) => {
    if (!ai) return res.json({ summary: "Thank you for your service!" });
    try {
        const { volunteerName, totalHours } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `Write a 2 sentence impact summary for ${volunteerName} who contributed ${totalHours} hours.`);
        res.json({ summary: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/draft-fundraising-email', async (req: Request, res: Response) => {
    if (!ai) return res.json({ emailBody: "Please support HMC!" });
    try {
        const { volunteerName, volunteerRole } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `Draft a short fundraising email for ${volunteerName}, a ${volunteerRole}, asking friends to support Health Matters Clinic.`);
        res.json({ emailBody: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/draft-social-post', async (req: Request, res: Response) => {
    if (!ai) return res.json({ postText: "#HealthMatters" });
    try {
        const { topic, platform } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `Draft a ${platform} post about ${topic} for a nonprofit.`);
        res.json({ postText: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/summarize-feedback', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ summary: "No feedback to summarize." });
        const { feedback } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `Summarize the following volunteer feedback into key themes and sentiment: ${feedback.join('\n')}`);
        res.json({ summary: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/generate-document', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.status(503).json({ error: "AI not configured" });
        const { prompt, title } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `You are a professional technical writer for Health Matters Clinic, a community health nonprofit.
            Create a well-structured document based on this request: "${prompt}"
            ${title ? `The document is titled: "${title}"` : ''}

            Guidelines:
            - Use clear, professional language appropriate for healthcare/nonprofit context
            - Use markdown formatting with ## for main headings and ### for subheadings
            - Include practical, actionable information
            - Be thorough but concise
            - Do not mention AI or that this was generated

            Generate the document content now:`);
        res.json({ content: text });
    } catch(e) {
        console.error('[AI] Document generation failed:', e);
        res.status(500).json({ error: "Document generation failed" });
    }
});

app.post('/api/gemini/improve-document', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.status(503).json({ error: "AI not configured" });
        const { content, instructions } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `You are a professional editor for Health Matters Clinic documents.

            Improve the following document according to these instructions: "${instructions || 'Make it more professional and comprehensive'}"

            Original content:
            ${content}

            Guidelines:
            - Maintain the original structure and intent
            - Improve clarity, professionalism, and completeness
            - Use markdown formatting
            - Keep healthcare/nonprofit context appropriate
            - Do not mention AI or that this was edited

            Provide the improved document:`);
        res.json({ improved: text });
    } catch(e) {
        console.error('[AI] Document improvement failed:', e);
        res.status(500).json({ error: "Document improvement failed" });
    }
});

app.post('/api/gemini/draft-announcement', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.status(503).json({ error: "AI not configured" });
        const { topic, tenantId } = req.body;
        const text = await generateAIContent('gemini-2.0-flash',
            `Draft a professional announcement for Health Matters Clinic volunteers about: "${topic}".
            Keep it warm, professional, and under 150 words. Do not mention AI.`);
        res.json({ content: text });
    } catch(e) {
        console.error('[AI] Announcement draft failed:', e);
        res.status(500).json({ error: "Announcement draft failed" });
    }
});

// --- DATA & OPS ROUTES ---
app.get('/api/resources', verifyToken, async (req: Request, res: Response) => {
    const snap = await db.collection('referral_resources').get();
    res.json(snap.docs.map(d => d.data()));
});
app.post('/api/resources/create', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    const ref = await db.collection('referral_resources').add(req.body.resource);
    res.json({ success: true, id: ref.id });
});

// Bulk import resources from CSV
app.post('/api/resources/bulk-import', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { csvData } = req.body;
        const csvContent = Buffer.from(csvData, 'base64').toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

        const importedResources: any[] = [];
        const batch = db.batch();

        for (let i = 1; i < lines.length; i++) {
            // Parse CSV line handling quoted values
            const values: string[] = [];
            let current = '';
            let inQuotes = false;
            for (const char of lines[i]) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            const resource: any = { 'Active / Inactive': 'checked' };
            headers.forEach((header, idx) => {
                if (values[idx]) {
                    resource[header] = values[idx];
                }
            });

            if (resource['Resource Name']) {
                const docRef = db.collection('referral_resources').doc();
                batch.set(docRef, resource);
                importedResources.push({ id: docRef.id, ...resource });
            }
        }

        await batch.commit();
        console.log(`[RESOURCES] Bulk imported ${importedResources.length} resources`);
        res.json({ success: true, importedCount: importedResources.length });
    } catch (error: any) {
        console.error('[RESOURCES] Bulk import failed:', error);
        res.status(500).json({ error: error.message || 'Failed to import resources' });
    }
});

app.get('/api/referrals', verifyToken, async (req: Request, res: Response) => {
    const snap = await db.collection('referrals').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
app.post('/api/referrals/create', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    const ref = await db.collection('referrals').add(req.body.referral);
    res.json({ id: ref.id, ...req.body.referral });
});
app.put('/api/referrals/:id', verifyToken, async (req: Request, res: Response) => {
    await db.collection('referrals').doc(req.params.id).update(req.body.referral);
    res.json({ id: req.params.id, ...req.body.referral });
});
app.post('/api/clients/search', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    const { phone, email } = req.body;
    let query: admin.firestore.Query = db.collection('clients');
    if (phone) query = query.where('phone', '==', phone);
    else if (email) query = query.where('email', '==', email);
    
    const snap = await query.get();
    if (snap.empty) return res.status(404).json({ error: "Not found" });
    res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
});
app.post('/api/clients/create', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    const client = {
        ...req.body.client,
        createdAt: new Date().toISOString(),
        status: 'Active'
    };
    const ref = await db.collection('clients').add(client);
    res.json({ id: ref.id, ...client });
});

// Get all clients (admin)
app.get('/api/clients', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('clients').orderBy('createdAt', 'desc').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
        console.error('[CLIENTS] Failed to fetch:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get single client
app.get('/api/clients/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const doc = await db.collection('clients').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// Update client
app.put('/api/clients/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const updates = { ...req.body.client, updatedAt: new Date().toISOString() };
        await db.collection('clients').doc(req.params.id).update(updates);
        res.json({ id: req.params.id, ...updates });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// Get client referral history
app.get('/api/clients/:id/referrals', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('referrals').where('clientId', '==', req.params.id).orderBy('createdAt', 'desc').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch client referrals' });
    }
});

// --- PUBLIC EVENT ENDPOINTS (for Event-Finder-Tool integration) ---

// GET /api/public/events - Public endpoint to get approved, public-facing events
app.get('/api/public/events', async (req: Request, res: Response) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const includeAll = req.query.all === 'true'; // ?all=true to get all approved (for internal tools)

        // Query approved events with date >= today
        const snapshot = await db.collection('opportunities')
            .where('approvalStatus', '==', 'approved')
            .where('date', '>=', today)
            .orderBy('date', 'asc')
            .get();

        const events = snapshot.docs
            .filter(doc => includeAll || doc.data().isPublicFacing !== false)
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title || data.name || 'Untitled Event',
                    date: data.date,
                    dateDisplay: data.dateDisplay || data.date,
                    time: data.time || data.startTime || 'TBD',
                    location: data.location || data.serviceLocation || 'TBD',
                    city: data.city || 'Los Angeles',
                    address: data.address || data.location || '',
                    program: data.program || data.category || 'Community Health',
                    lat: data.locationCoordinates?.lat || data.lat || 34.0522,
                    lng: data.locationCoordinates?.lng || data.lng || -118.2437,
                    description: data.description || '',
                    saveTheDate: data.saveTheDate || false,
                    flyerUrl: data.flyerUrl || undefined,
                };
            });

        console.log(`[PUBLIC EVENTS] Returned ${events.length} approved events (includeAll=${includeAll})`);
        res.json(events);
    } catch (error: any) {
        console.error('[PUBLIC EVENTS] Failed to fetch events:', error);
        res.status(500).json({ error: 'Failed to fetch public events' });
    }
});

// --- VOLUNTEER MATCH FOR PUBLIC RSVPS ---
const processVolunteerMatch = async (
  rsvpId: string,
  rsvpData: { eventId: string; eventTitle: string; eventDate: string; name: string; email: string; phone?: string }
): Promise<void> => {
  try {
    const { eventId, eventTitle, eventDate, name, email, phone } = rsvpData;
    const rsvpRef = db.collection('public_rsvps').doc(rsvpId);

    // 1. Email match (strongest) — case-insensitive
    const emailLower = email.toLowerCase();
    const emailSnap = await db.collection('volunteers')
      .where('email', '==', emailLower)
      .limit(1)
      .get();

    if (!emailSnap.empty) {
      const vol = emailSnap.docs[0];
      const volData = vol.data();
      await handleVolunteerMatch(rsvpRef, vol.id, volData, 'email', rsvpData);
      return;
    }

    // 2. Phone match (strong) — normalized digits
    const normalizedRsvpPhone = normalizePhone(phone);
    if (normalizedRsvpPhone) {
      const allVolunteers = await db.collection('volunteers').get();
      for (const vol of allVolunteers.docs) {
        const volData = vol.data();
        const normalizedVolPhone = normalizePhone(volData.phone);
        const normalizedVolHome = normalizePhone(volData.homePhone);
        if (
          (normalizedVolPhone && normalizedVolPhone === normalizedRsvpPhone) ||
          (normalizedVolHome && normalizedVolHome === normalizedRsvpPhone)
        ) {
          await handleVolunteerMatch(rsvpRef, vol.id, volData, 'phone', rsvpData);
          return;
        }
      }
    }

    // 3. Name match (weak — flagged for review)
    const rsvpNameParts = name.trim().toLowerCase().split(/\s+/);
    if (rsvpNameParts.length >= 2) {
      const rsvpFirst = rsvpNameParts[0];
      const rsvpLast = rsvpNameParts[rsvpNameParts.length - 1];
      const allVolunteers = await db.collection('volunteers').get();
      for (const vol of allVolunteers.docs) {
        const v = vol.data();
        const legalMatch =
          (v.legalFirstName || '').toLowerCase() === rsvpFirst &&
          (v.legalLastName || '').toLowerCase() === rsvpLast;
        const preferredMatch =
          (v.preferredFirstName || '').toLowerCase() === rsvpFirst &&
          (v.preferredLastName || '').toLowerCase() === rsvpLast;
        const legacyName = (v.name || '').trim().toLowerCase();
        const legacyMatch = legacyName === name.trim().toLowerCase();

        if (legalMatch || preferredMatch || legacyMatch) {
          // Name-only match — flag for coordinator review
          await rsvpRef.update({
            volunteerMatch: {
              matchType: 'name',
              volunteerId: vol.id,
              autoRegistered: false,
              flaggedForReview: true
            }
          });

          // Notify coordinators
          const coordinatorsSnap = await db.collection('volunteers')
            .where('role', 'in', EVENT_MANAGEMENT_ROLES)
            .where('status', '==', 'active')
            .get();

          for (const coord of coordinatorsSnap.docs) {
            const coordData = coord.data();
            if (coordData.email) {
              await EmailService.send('coordinator_public_rsvp_name_match', {
                toEmail: coordData.email,
                coordinatorName: coordData.name || coordData.legalFirstName || 'Coordinator',
                rsvpName: name,
                rsvpEmail: email,
                rsvpPhone: phone || '',
                eventTitle,
                eventDate: formatEventDate(eventDate),
                volunteerName: v.name || `${v.legalFirstName} ${v.legalLastName}`.trim(),
                volunteerEmail: v.email || '',
                volunteerPhone: v.phone || '',
                volunteerStatus: v.status || 'unknown'
              });
            }
          }

          console.log(`[PUBLIC RSVP] Name-only match: RSVP ${rsvpId} → volunteer ${vol.id} (flagged for review)`);
          return;
        }
      }
    }

    // 4. No match — send volunteer invite email
    await rsvpRef.update({
      volunteerMatch: {
        matchType: 'none',
        volunteerId: null,
        autoRegistered: false,
        flaggedForReview: false
      }
    });

    await EmailService.send('public_rsvp_volunteer_invite', {
      toEmail: email,
      rsvpName: name,
      eventTitle,
      eventDate: formatEventDate(eventDate)
    });

    console.log(`[PUBLIC RSVP] No match: sent volunteer invite to ${maskEmail(email)}`);
  } catch (error) {
    console.error(`[PUBLIC RSVP] processVolunteerMatch failed for RSVP ${rsvpId}:`, error);
  }
};

// Helper: handle email/phone volunteer match (auto-register if trained, nudge if not)
const handleVolunteerMatch = async (
  rsvpRef: FirebaseFirestore.DocumentReference,
  volunteerId: string,
  volData: FirebaseFirestore.DocumentData,
  matchType: 'email' | 'phone',
  rsvpData: { eventId: string; eventTitle: string; eventDate: string; name: string; email: string }
): Promise<void> => {
  const isTrained = volData.status === 'active' && (volData.onboardingProgress >= 100 || volData.coreVolunteerStatus === true);

  if (isTrained) {
    // Auto-register: add eventId to rsvpedEventIds, update slotsFilled, send confirmation, award XP
    const volunteerRef = db.collection('volunteers').doc(volunteerId);
    const existingRsvps = volData.rsvpedEventIds || [];
    const updatedRsvpIds = [...new Set([...existingRsvps, rsvpData.eventId])];
    await volunteerRef.update({ rsvpedEventIds: updatedRsvpIds });

    // Update opportunity slotsFilled
    const oppRef = db.collection('opportunities').doc(rsvpData.eventId);
    const oppDoc = await oppRef.get();
    if (oppDoc.exists) {
      const oppData = oppDoc.data() as any;
      await oppRef.update({ slotsFilled: (oppData.slotsFilled || 0) + 1 });
    }

    // Send confirmation email
    const volunteerName = volData.name || volData.legalFirstName || 'Volunteer';
    const volunteerEmail = volData.email;
    if (volunteerEmail) {
      await EmailService.send('event_registration_confirmation', {
        toEmail: volunteerEmail,
        volunteerName,
        eventTitle: rsvpData.eventTitle,
        eventDate: formatEventDate(rsvpData.eventDate),
        eventLocation: 'See event details'
      });
    }

    // Award XP
    try {
      await GamificationService.addXP(volunteerId, 'event_signup');
    } catch (xpErr) {
      console.error(`[PUBLIC RSVP] Failed to award XP to ${volunteerId}:`, xpErr);
    }

    await rsvpRef.update({
      volunteerMatch: {
        matchType,
        volunteerId,
        autoRegistered: true,
        flaggedForReview: false
      }
    });

    console.log(`[PUBLIC RSVP] ${matchType} match: auto-registered volunteer ${volunteerId} for event ${rsvpData.eventId}`);
  } else {
    // Untrained / onboarding — send training nudge
    await rsvpRef.update({
      volunteerMatch: {
        matchType,
        volunteerId,
        autoRegistered: false,
        flaggedForReview: false
      }
    });

    const volunteerName = volData.name || volData.legalFirstName || 'Volunteer';
    const volunteerEmail = volData.email;
    if (volunteerEmail) {
      await EmailService.send('public_rsvp_training_nudge', {
        toEmail: volunteerEmail,
        volunteerName,
        eventTitle: rsvpData.eventTitle,
        eventDate: formatEventDate(rsvpData.eventDate)
      });
    }

    console.log(`[PUBLIC RSVP] ${matchType} match: sent training nudge to volunteer ${volunteerId}`);
  }
};

// POST /api/public/rsvp - Public webhook to receive RSVPs from Event-Finder-Tool
app.post('/api/public/rsvp', rateLimit(10, 60000), async (req: Request, res: Response) => {
    try {
        const { eventId, eventTitle, eventDate, name, email, phone, guests, needs, source } = req.body;

        if (!eventId || !name || !email) {
            return res.status(400).json({ error: 'eventId, name, and email are required' });
        }

        // Generate a unique check-in token
        const checkinToken = crypto.randomBytes(16).toString('hex');

        // Store the RSVP with default volunteerMatch
        const rsvp = {
            eventId,
            eventTitle: eventTitle || '',
            eventDate: eventDate || '',
            name,
            email,
            phone: phone || '',
            guests: guests || 0,
            needs: needs || '',
            source: source || 'event-finder-tool',
            checkinToken,
            checkedIn: false,
            checkedInAt: null,
            volunteerMatch: {
                matchType: 'none',
                volunteerId: null,
                autoRegistered: false,
                flaggedForReview: false
            },
            createdAt: new Date().toISOString()
        };

        const rsvpRef = await db.collection('public_rsvps').add(rsvp);

        // Update the event's RSVP count atomically
        const eventRef = db.collection('opportunities').doc(eventId);
        const eventDoc = await eventRef.get();
        if (eventDoc.exists) {
            await eventRef.update({
                rsvpCount: admin.firestore.FieldValue.increment(1 + (guests || 0))
            });
        }

        console.log(`[PUBLIC RSVP] Created RSVP ${rsvpRef.id} for event ${eventId}`);

        // Fire-and-forget: process volunteer matching asynchronously
        processVolunteerMatch(rsvpRef.id, {
            eventId,
            eventTitle: eventTitle || '',
            eventDate: eventDate || '',
            name,
            email,
            phone: phone || ''
        }).catch(err => console.error(`[PUBLIC RSVP] Background match failed for ${rsvpRef.id}:`, err));

        res.json({
            success: true,
            rsvpId: rsvpRef.id,
            checkinToken,
            message: 'RSVP recorded successfully'
        });
    } catch (error: any) {
        console.error('[PUBLIC RSVP] Failed to create RSVP:', error);
        res.status(500).json({ error: 'Failed to record RSVP' });
    }
});

// POST /api/public/checkin - Public endpoint for event check-in
app.post('/api/public/checkin', rateLimit(20, 60000), async (req: Request, res: Response) => {
    try {
        const { checkinToken } = req.body;

        if (!checkinToken) {
            return res.status(400).json({ error: 'checkinToken is required' });
        }

        // Find the RSVP by check-in token
        const rsvpSnapshot = await db.collection('public_rsvps')
            .where('checkinToken', '==', checkinToken)
            .limit(1)
            .get();

        if (rsvpSnapshot.empty) {
            return res.status(404).json({ error: 'RSVP not found' });
        }

        const rsvpDoc = rsvpSnapshot.docs[0];
        const rsvpData = rsvpDoc.data();

        if (rsvpData.checkedIn) {
            return res.status(400).json({ error: 'Already checked in', checkedInAt: rsvpData.checkedInAt });
        }

        // Mark as checked in
        const checkedInAt = new Date().toISOString();
        await rsvpDoc.ref.update({
            checkedIn: true,
            checkedInAt
        });

        // Update the event's check-in count
        const eventRef = db.collection('opportunities').doc(rsvpData.eventId);
        const eventDoc = await eventRef.get();
        if (eventDoc.exists) {
            await eventRef.update({
                checkinCount: admin.firestore.FieldValue.increment(1 + (rsvpData.guests || 0))
            });
        }

        console.log(`[PUBLIC CHECKIN] Checked in RSVP ${rsvpDoc.id} for event ${rsvpData.eventId}`);
        res.json({
            success: true,
            name: rsvpData.name,
            eventTitle: rsvpData.eventTitle,
            checkedInAt,
            message: 'Check-in successful'
        });
    } catch (error: any) {
        console.error('[PUBLIC CHECKIN] Failed to check in:', error);
        res.status(500).json({ error: 'Failed to check in' });
    }
});

// GET /api/events/:id/rsvp-stats - Protected endpoint for admins/coordinators to see RSVP stats
app.get('/api/events/:id/rsvp-stats', verifyToken, async (req: Request, res: Response) => {
    const userProfile = (req as any).user?.profile;
    if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
        return res.status(403).json({ error: 'Only admins and event coordinators can view RSVP stats' });
    }
    try {
        const { id } = req.params;

        // Get the event
        const eventDoc = await db.collection('opportunities').doc(id).get();
        if (!eventDoc.exists) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const eventData = eventDoc.data();

        // Get all RSVPs for this event
        const rsvpSnapshot = await db.collection('public_rsvps')
            .where('eventId', '==', id)
            .get();

        const rsvps = rsvpSnapshot.docs.map(doc => doc.data());

        // Calculate totals
        const totalRsvps = rsvps.length;
        const totalGuests = rsvps.reduce((sum, rsvp) => sum + (rsvp.guests || 0), 0);
        const totalExpectedAttendees = totalRsvps + totalGuests;
        const estimatedAttendance = Math.round(totalExpectedAttendees * 0.7); // 70% show rate
        const checkedInCount = rsvps.filter(r => r.checkedIn).length;
        const checkedInGuests = rsvps.filter(r => r.checkedIn).reduce((sum, rsvp) => sum + (rsvp.guests || 0), 0);
        const totalCheckedIn = checkedInCount + checkedInGuests;

        // Calculate needs breakdown
        const needsBreakdown: Record<string, number> = {};
        rsvps.forEach(rsvp => {
            if (rsvp.needs) {
                const needs = rsvp.needs.split(',').map((n: string) => n.trim()).filter(Boolean);
                needs.forEach((need: string) => {
                    needsBreakdown[need] = (needsBreakdown[need] || 0) + 1;
                });
            }
        });

        // Source breakdown
        const sourceBreakdown: Record<string, number> = {};
        rsvps.forEach(rsvp => {
            const source = rsvp.source || 'unknown';
            sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
        });

        const stats = {
            eventId: id,
            eventTitle: eventData?.title || 'Unknown Event',
            eventDate: eventData?.date,
            totalRsvps,
            totalGuests,
            totalExpectedAttendees,
            estimatedAttendance,
            checkedInCount: totalCheckedIn,
            checkInRate: totalExpectedAttendees > 0 ? Math.round((totalCheckedIn / totalExpectedAttendees) * 100) : 0,
            needsBreakdown,
            sourceBreakdown,
            rsvpCount: eventData?.rsvpCount || totalExpectedAttendees,
            checkinCount: eventData?.checkinCount || totalCheckedIn
        };

        console.log(`[RSVP STATS] Retrieved stats for event ${id}: ${totalRsvps} RSVPs, ${totalCheckedIn} checked in`);
        res.json(stats);
    } catch (error: any) {
        console.error('[RSVP STATS] Failed to get stats:', error);
        res.status(500).json({ error: 'Failed to get RSVP stats' });
    }
});

// --- FEEDBACK ENDPOINTS ---
app.get('/api/feedback', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('feedback').orderBy('submittedAt', 'desc').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

app.post('/api/feedback', verifyToken, async (req: Request, res: Response) => {
    try {
        const feedback = {
            ...req.body,
            submittedAt: new Date().toISOString()
        };
        const ref = await db.collection('feedback').add(feedback);

        // Update resource average rating if this is service feedback
        if (feedback.resourceId) {
            const resourceFeedback = await db.collection('feedback').where('resourceId', '==', feedback.resourceId).get();
            const ratings = resourceFeedback.docs.map(d => d.data().rating).filter(r => r);
            const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            await db.collection('referral_resources').doc(feedback.resourceId).update({
                averageRating: Math.round(avgRating * 10) / 10,
                lastFeedbackDate: new Date().toISOString()
            });
        }

        res.json({ id: ref.id, ...feedback });
    } catch (error) {
        console.error('[FEEDBACK] Failed to create:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// --- PARTNER AGENCY ENDPOINTS ---
app.get('/api/partners', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('partner_agencies').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch partners' });
    }
});

app.post('/api/partners', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const partner = {
            ...req.body,
            createdAt: new Date().toISOString(),
            status: 'Active'
        };
        const ref = await db.collection('partner_agencies').add(partner);
        res.json({ id: ref.id, ...partner });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create partner' });
    }
});

app.put('/api/partners/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        await db.collection('partner_agencies').doc(req.params.id).update(req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update partner' });
    }
});

// --- SLA COMPLIANCE TRACKING ---
app.get('/api/referrals/sla-report', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('referrals').get();
        const referrals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const now = new Date();

        const report = {
            total: referrals.length,
            compliant: 0,
            nonCompliant: 0,
            onTrack: 0,
            pending: 0,
            byStatus: {} as Record<string, number>,
            byUrgency: {} as Record<string, number>,
            avgResponseTimeHours: 0
        };

        let totalResponseTime = 0;
        let responseCount = 0;

        referrals.forEach((r: any) => {
            // Count by status
            report.byStatus[r.status] = (report.byStatus[r.status] || 0) + 1;
            report.byUrgency[r.urgency] = (report.byUrgency[r.urgency] || 0) + 1;

            // Calculate SLA compliance
            if (r.status === 'Pending') {
                const created = new Date(r.createdAt);
                const deadline = new Date(created.getTime() + 72 * 60 * 60 * 1000); // 72 hours
                if (now > deadline) {
                    report.nonCompliant++;
                } else {
                    report.onTrack++;
                }
                report.pending++;
            } else if (r.firstContactDate) {
                const created = new Date(r.createdAt);
                const contacted = new Date(r.firstContactDate);
                const hoursToContact = (contacted.getTime() - created.getTime()) / (1000 * 60 * 60);
                totalResponseTime += hoursToContact;
                responseCount++;

                if (hoursToContact <= 72) {
                    report.compliant++;
                } else {
                    report.nonCompliant++;
                }
            }
        });

        if (responseCount > 0) {
            report.avgResponseTimeHours = Math.round(totalResponseTime / responseCount * 10) / 10;
        }

        res.json(report);
    } catch (error) {
        console.error('[SLA] Report generation failed:', error);
        res.status(500).json({ error: 'Failed to generate SLA report' });
    }
});

// --- AI REFERRAL MATCHING ---
app.post('/api/ai/match-resources', verifyToken, async (req: Request, res: Response) => {
    try {
        const { clientId, serviceNeeded, clientData } = req.body;

        // Get all active resources
        const resourcesSnap = await db.collection('referral_resources').get();
        const resources = resourcesSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((r: any) => r['Active / Inactive'] === 'checked');

        if (!ai || !GEMINI_API_KEY) {
            // Fallback: simple keyword matching
            const matches = resources
                .filter((r: any) => {
                    const searchText = `${r['Service Category']} ${r['Key Offerings']}`.toLowerCase();
                    return serviceNeeded.toLowerCase().split(' ').some((word: string) => searchText.includes(word));
                })
                .slice(0, 5)
                .map((r: any) => ({
                    resourceId: r.id,
                    resourceName: r['Resource Name'],
                    matchScore: 70,
                    matchReason: `Matched based on service category: ${r['Service Category']}`
                }));
            return res.json({ matches, aiGenerated: false });
        }

        // Use Gemini for intelligent matching
        const prompt = `You are a social services case manager AI. Match a client to the most appropriate resources.

CLIENT NEED: ${serviceNeeded}
${clientData ? `CLIENT INFO: Language: ${clientData.primaryLanguage || 'English'}, Location: SPA ${clientData.spa || 'Unknown'}, Demographics: ${JSON.stringify(clientData.needs || {})}` : ''}

AVAILABLE RESOURCES:
${resources.slice(0, 20).map((r: any, i: number) => `${i + 1}. ${r['Resource Name']} - ${r['Service Category']} - ${r['Key Offerings']} - Languages: ${r['Languages Spoken']} - SPA: ${r['SPA']}`).join('\n')}

Return JSON array of top 3-5 matches with format:
[{"index": 1, "score": 95, "reason": "Best match because..."}]

Only return valid JSON array.`;

        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
            const aiMatches = JSON.parse(jsonMatch[0]);
            const matches = aiMatches.map((m: any) => {
                const resource = resources[m.index - 1] as any;
                return {
                    resourceId: resource?.id,
                    resourceName: resource?.['Resource Name'],
                    matchScore: m.score,
                    matchReason: m.reason
                };
            }).filter((m: any) => m.resourceId);

            res.json({ matches, aiGenerated: true });
        } else {
            throw new Error('Invalid AI response');
        }
    } catch (error) {
        console.error('[AI MATCH] Failed:', error);
        res.status(500).json({ error: 'AI matching failed' });
    }
});

app.get('/api/ops/run/:shiftId/:userId', verifyToken, async (req: Request, res: Response) => {
    const { shiftId, userId } = req.params;
    const runId = `${shiftId}_${userId}`;
    const doc = await db.collection('mission_ops_runs').doc(runId).get();
    const incidentsSnap = await db.collection('incidents').where('shiftId', '==', shiftId).get();
    const auditSnap = await db.collection('audit_logs').where('shiftId', '==', shiftId).orderBy('timestamp', 'desc').get();
    
    res.json({
        opsRun: doc.exists ? { id: doc.id, ...doc.data() } : { id: runId, shiftId, userId, completedItems: [] },
        incidents: incidentsSnap.docs.map(d => ({id: d.id, ...d.data()})),
        auditLogs: auditSnap.docs.map(d => ({id: d.id, ...d.data()})),
    });
});
app.post('/api/ops/checklist', verifyToken, async (req: Request, res: Response) => {
    const { runId, completedItems } = req.body;
    await db.collection('mission_ops_runs').doc(runId).set({ completedItems }, { merge: true });
    res.json({ success: true });
});
app.put('/api/volunteer', verifyToken, async (req: Request, res: Response) => {
    const updatedUser = req.body;
    await db.collection('volunteers').doc(updatedUser.id).set(updatedUser, { merge: true });
    res.json(updatedUser);
});

// User presence tracking - update last active time
app.post('/api/volunteer/presence', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.profile?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        await db.collection('volunteers').doc(userId).update({
            lastActiveAt: new Date().toISOString(),
            isOnline: true
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[PRESENCE] Failed to update presence:', error);
        res.status(500).json({ error: 'Failed to update presence' });
    }
});

// Get online users for chat
app.get('/api/volunteers/online', verifyToken, async (req: Request, res: Response) => {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 90 * 1000).toISOString();
        const snapshot = await db.collection('volunteers')
            .where('lastActiveAt', '>=', fiveMinutesAgo)
            .get();

        const onlineUsers = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            role: doc.data().role,
            lastActiveAt: doc.data().lastActiveAt
        }));

        res.json(onlineUsers);
    } catch (error) {
        console.error('[PRESENCE] Failed to get online users:', error);
        res.status(500).json({ error: 'Failed to get online users' });
    }
});

// --- MESSAGING ENDPOINTS ---
app.get('/api/messages', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.profile?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Get messages where user is sender or recipient, plus general channel
        const [sentSnapshot, receivedSnapshot, generalSnapshot] = await Promise.all([
            db.collection('messages').where('senderId', '==', userId).orderBy('timestamp', 'desc').limit(200).get(),
            db.collection('messages').where('recipientId', '==', userId).orderBy('timestamp', 'desc').limit(200).get(),
            db.collection('messages').where('recipientId', '==', 'general').orderBy('timestamp', 'desc').limit(100).get()
        ]);

        const messagesMap = new Map();
        [...sentSnapshot.docs, ...receivedSnapshot.docs, ...generalSnapshot.docs].forEach(doc => {
            messagesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const messages = Array.from(messagesMap.values()).sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        res.json(messages);
    } catch (error) {
        console.error('[MESSAGES] Failed to get messages:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// --- SSE STREAM ENDPOINT ---
app.get('/api/messages/stream', async (req: Request, res: Response) => {
    // EventSource can't send headers, so auth via query param
    const token = req.query.token as string;
    if (!token) return res.status(403).json({ error: 'No token' });

    try {
        const sessionDoc = await db.collection('sessions').doc(token).get();
        if (!sessionDoc.exists) return res.status(403).json({ error: 'Invalid session' });
        const session = sessionDoc.data()!;
        if (new Date() > session.expires.toDate()) return res.status(403).json({ error: 'Session expired' });

        const userDoc = await db.collection('volunteers').doc(session.uid).get();
        if (!userDoc.exists) return res.status(403).json({ error: 'User not found' });

        const userId = session.uid;

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // disable nginx buffering
        });
        res.flushHeaders();

        // Register client
        if (!sseClients.has(userId)) sseClients.set(userId, new Set());
        sseClients.get(userId)!.add(res);
        console.log(`[SSE] Client connected: ${userId} (${sseClients.get(userId)!.size} tabs)`);

        // Heartbeat every 25s to keep connection alive
        const heartbeat = setInterval(() => {
            try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
        }, 25000);

        // Clean up on disconnect
        req.on('close', () => {
            clearInterval(heartbeat);
            const clients = sseClients.get(userId);
            if (clients) {
                clients.delete(res);
                if (clients.size === 0) sseClients.delete(userId);
            }
            console.log(`[SSE] Client disconnected: ${userId}`);
        });
    } catch (error) {
        console.error('[SSE] Connection failed:', error);
        res.status(500).json({ error: 'SSE connection failed' });
    }
});

app.post('/api/messages', verifyToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.profile?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const message = req.body;

        // Validate message
        if (!message.content || !message.recipientId) {
            return res.status(400).json({ error: 'Message content and recipientId are required' });
        }

        // Store message in Firestore
        const messageData = {
            senderId: userId,
            sender: message.sender || 'Unknown',
            recipientId: message.recipientId,
            content: message.content,
            timestamp: message.timestamp || new Date().toISOString(),
            read: false
        };

        const docRef = await db.collection('messages').add(messageData);
        const savedMessage = { id: docRef.id, ...messageData };

        // Broadcast via SSE (don't send back to sender — they have it via optimistic update)
        if (message.recipientId === 'general') {
            // General channel: broadcast to all connected clients except sender
            for (const [clientUserId] of sseClients) {
                if (clientUserId !== userId) broadcastSSE(clientUserId, savedMessage);
            }
        } else {
            // DM: send only to the recipient
            broadcastSSE(message.recipientId, savedMessage);
        }

        console.log(`[MESSAGES] Message sent from ${userId} to ${message.recipientId}`);
        res.json(savedMessage);
    } catch (error) {
        console.error('[MESSAGES] Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.put('/api/messages/:messageId/read', verifyToken, async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        await db.collection('messages').doc(messageId).update({ read: true, readAt: new Date().toISOString() });
        res.json({ success: true });
    } catch (error) {
        console.error('[MESSAGES] Failed to mark message as read:', error);
        res.status(500).json({ error: 'Failed to mark message as read' });
    }
});

// Admin: delete a message
app.delete('/api/messages/:messageId', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const msgRef = db.collection('messages').doc(messageId);
        const msgDoc = await msgRef.get();
        if (!msgDoc.exists) {
            return res.status(404).json({ error: 'Message not found' });
        }
        await msgRef.delete();
        console.log(`[MESSAGES] Message ${messageId} deleted by admin ${maskEmail((req as any).user?.profile?.email || '')}`);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[MESSAGES] Failed to delete message:', error);
        res.status(500).json({ error: error.message || 'Failed to delete message' });
    }
});

app.post('/api/opportunities', verifyToken, async (req: Request, res: Response) => {
    try {
        const userProfile = (req as any).user?.profile;
        if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
            return res.status(403).json({ error: 'Only admins and event management roles can create events' });
        }
        const { opportunity } = req.body;
        if (!opportunity.locationCoordinates) {
            opportunity.locationCoordinates = { lat: 34.0522 + (Math.random() - 0.5) * 0.1, lng: -118.2437 + (Math.random() - 0.5) * 0.1 };
        }
        const docRef = await db.collection('opportunities').add(opportunity);
        const opportunityId = docRef.id;

        // Create shifts for each staffing quota
        const createdShifts: any[] = [];
        const eventDate = opportunity.date || new Date().toISOString().split('T')[0];
        const startTimePart = opportunity.startTime || '09:00:00';
        const endTimePart = opportunity.endTime || '14:00:00';
        const defaultStartTime = `${eventDate}T${startTimePart}`;
        const defaultEndTime = `${eventDate}T${endTimePart}`;

        if (opportunity.staffingQuotas && opportunity.staffingQuotas.length > 0) {
            for (const quota of opportunity.staffingQuotas) {
                const shift = {
                    tenantId: opportunity.tenantId || 'hmc-health',
                    opportunityId: opportunityId,
                    roleType: quota.role,
                    slotsTotal: quota.count,
                    slotsFilled: 0,
                    assignedVolunteerIds: [],
                    startTime: defaultStartTime,
                    endTime: defaultEndTime,
                };
                const shiftRef = await db.collection('shifts').add(shift);
                createdShifts.push({ id: shiftRef.id, ...shift });
            }
        } else {
            // Create a default general shift if no quotas specified
            const defaultShift = {
                tenantId: opportunity.tenantId || 'hmc-health',
                opportunityId: opportunityId,
                roleType: 'Core Volunteer',
                slotsTotal: opportunity.slotsTotal || 10,
                slotsFilled: 0,
                assignedVolunteerIds: [],
                startTime: defaultStartTime,
                endTime: defaultEndTime,
            };
            const shiftRef = await db.collection('shifts').add(defaultShift);
            createdShifts.push({ id: shiftRef.id, ...defaultShift });
        }

        console.log(`[EVENTS] Created opportunity ${opportunityId} with ${createdShifts.length} shift(s)`);

        // Notify outreach & content teams about the new event
        try {
            const NOTIFY_ROLES = ['Outreach & Engagement Lead', 'Newsletter & Content Writer', 'Social Media Coordinator', 'Events Lead', 'Events Coordinator'];
            const teamSnap = await db.collection('volunteers')
                .where('role', 'in', NOTIFY_ROLES.slice(0, 10))
                .get();
            const creatorName = userProfile?.name || userProfile?.firstName || 'Admin';
            for (const doc of teamSnap.docs) {
                const vol = doc.data();
                if (vol.email && doc.id !== (req as any).user?.uid) {
                    EmailService.send('event_created_notification', {
                        toEmail: vol.email,
                        volunteerName: vol.name || vol.firstName || 'Team Member',
                        eventTitle: opportunity.title || 'Untitled Event',
                        eventDate: opportunity.date || 'TBD',
                        eventLocation: opportunity.serviceLocation || 'TBD',
                        creatorName,
                    }).catch(err => console.warn(`[EVENTS] Failed to notify ${vol.email}:`, err));
                }
            }
        } catch (notifyErr) {
            console.warn('[EVENTS] Failed to send team notifications:', notifyErr);
        }

        res.json({ id: opportunityId, ...opportunity, shifts: createdShifts });
    } catch (error) {
        console.error('[EVENTS] Failed to create opportunity:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

// Update opportunity (for approval workflow, editing, etc.)
app.put('/api/opportunities/:id', verifyToken, async (req: Request, res: Response) => {
    try {
        const userProfile = (req as any).user?.profile;
        if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
            return res.status(403).json({ error: 'Only admins and event management roles can update events' });
        }
        const { id } = req.params;
        const updates = req.body;

        // Security: Only allow certain fields to be updated
        const allowedFields = [
            'approvalStatus', 'approvedBy', 'approvedAt', 'isPublic', 'isPublicFacing',
            'urgency', 'description', 'title', 'date', 'serviceLocation', 'category',
            'staffingQuotas', 'estimatedAttendees', 'slotsTotal', 'startTime', 'endTime', 'time', 'address',
            'requiredSkills', 'supplyList', 'flyerUrl', 'flyerBase64', 'locationCoordinates',
            'checklistOverride'
        ];
        const sanitizedUpdates: any = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                sanitizedUpdates[field] = updates[field];
            }
        }

        if (Object.keys(sanitizedUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        await db.collection('opportunities').doc(id).update(sanitizedUpdates);

        // If date or time changed, update associated shifts
        if (sanitizedUpdates.date || sanitizedUpdates.startTime || sanitizedUpdates.endTime) {
            const shiftsSnap = await db.collection('shifts').where('opportunityId', '==', id).get();
            const batch = db.batch();
            const eventDate = sanitizedUpdates.date || (await db.collection('opportunities').doc(id).get()).data()?.date;
            shiftsSnap.docs.forEach(shiftDoc => {
                const shiftUpdates: any = {};
                if (sanitizedUpdates.startTime) shiftUpdates.startTime = `${eventDate}T${sanitizedUpdates.startTime}`;
                else if (sanitizedUpdates.date) shiftUpdates.startTime = `${eventDate}T${shiftDoc.data().startTime?.split('T')[1] || '09:00:00'}`;
                if (sanitizedUpdates.endTime) shiftUpdates.endTime = `${eventDate}T${sanitizedUpdates.endTime}`;
                else if (sanitizedUpdates.date) shiftUpdates.endTime = `${eventDate}T${shiftDoc.data().endTime?.split('T')[1] || '14:00:00'}`;
                if (Object.keys(shiftUpdates).length > 0) batch.update(shiftDoc.ref, shiftUpdates);
            });
            await batch.commit();
        }

        // If staffingQuotas changed, sync shift documents
        if (sanitizedUpdates.staffingQuotas) {
            const shiftsSnap = await db.collection('shifts').where('opportunityId', '==', id).get();
            const existingShiftsByRole: Record<string, any> = {};
            shiftsSnap.docs.forEach(doc => { existingShiftsByRole[doc.data().roleType] = { id: doc.id, ref: doc.ref, ...doc.data() }; });

            const oppDoc = await db.collection('opportunities').doc(id).get();
            const oppData = oppDoc.data() || {};
            const eventDate = sanitizedUpdates.date || oppData.date || '';
            const defaultStart = `${eventDate}T09:00:00`;
            const defaultEnd = `${eventDate}T14:00:00`;

            for (const quota of sanitizedUpdates.staffingQuotas) {
                const existing = existingShiftsByRole[quota.role];
                if (existing) {
                    // Update slotsTotal if count changed
                    if (existing.slotsTotal !== quota.count) {
                        await existing.ref.update({ slotsTotal: quota.count });
                    }
                } else {
                    // Create new shift for this role
                    await db.collection('shifts').add({
                        tenantId: oppData.tenantId || 'hmc-health',
                        opportunityId: id,
                        roleType: quota.role,
                        slotsTotal: quota.count,
                        slotsFilled: 0,
                        assignedVolunteerIds: [],
                        startTime: defaultStart,
                        endTime: defaultEnd,
                    });
                }
            }
            console.log(`[EVENTS] Synced shifts for opportunity ${id} with updated quotas`);
        }

        // Fetch and return the updated document + current shifts
        const updatedDoc = await db.collection('opportunities').doc(id).get();
        const updatedData: any = { id: updatedDoc.id, ...updatedDoc.data() };

        // Always return shifts so frontend can sync after quota changes
        const currentShiftsSnap = await db.collection('shifts').where('opportunityId', '==', id).get();
        updatedData.shifts = currentShiftsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        console.log(`[EVENTS] Updated opportunity ${id} with:`, Object.keys(sanitizedUpdates));
        res.json(updatedData);
    } catch (error) {
        console.error('[EVENTS] Failed to update opportunity:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete opportunity and its associated shifts
app.delete('/api/opportunities/:id', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userProfile = (req as any).user?.profile;
        if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
            return res.status(403).json({ error: 'Only admins and event management roles can delete events' });
        }

        // Delete associated shifts
        const shiftsSnap = await db.collection('shifts').where('opportunityId', '==', id).get();
        const batch = db.batch();
        shiftsSnap.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection('opportunities').doc(id));
        await batch.commit();

        console.log(`[EVENTS] Deleted opportunity ${id} and ${shiftsSnap.size} associated shift(s)`);
        res.json({ success: true, deletedShifts: shiftsSnap.size });
    } catch (error) {
        console.error('[EVENTS] Failed to delete opportunity:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Bulk import events from CSV
app.post('/api/events/bulk-import', verifyToken, async (req: Request, res: Response) => {
    try {
        const userProfile = (req as any).user?.profile;
        if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
            return res.status(403).json({ error: 'Only admins and event management roles can import events' });
        }
        const { csvData } = req.body;
        const csvContent = Buffer.from(csvData, 'base64').toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

        const importedEvents: any[] = [];
        const createdShifts: any[] = [];

        for (let i = 1; i < lines.length; i++) {
            // Parse CSV line handling quoted values
            const values: string[] = [];
            let current = '';
            let inQuotes = false;
            for (const char of lines[i]) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            const row: any = {};
            headers.forEach((header, idx) => {
                if (values[idx]) {
                    row[header] = values[idx];
                }
            });

            // Skip if no title
            if (!row.title && !row.Title && !row['Event Title']) continue;

            const eventTitle = row.title || row.Title || row['Event Title'] || 'Untitled Event';
            const eventDate = row.date || row.Date || row['Event Date'] || new Date().toISOString().split('T')[0];
            const eventLocation = row.location || row.Location || row.serviceLocation || row['Service Location'] || 'TBD';
            const category = row.category || row.Category || 'Health Fair';
            const description = row.description || row.Description || `Community health event: ${eventTitle}`;
            const slotsTotal = parseInt(row.slotsTotal || row['Slots Total'] || row.volunteers || '10') || 10;
            const estimatedAttendees = parseInt(row.estimatedAttendees || row['Estimated Attendees'] || '100') || 100;

            // Parse staffing quotas if provided (format: "Core Volunteer:5;Medical Professional:2")
            let staffingQuotas: { role: string; count: number; filled: number }[] = [];
            if (row.staffingQuotas || row['Staffing Quotas']) {
                const quotaStr = row.staffingQuotas || row['Staffing Quotas'];
                const quotaPairs = quotaStr.split(';');
                staffingQuotas = quotaPairs.map((pair: string) => {
                    const [role, count] = pair.split(':');
                    return { role: role.trim(), count: parseInt(count) || 1, filled: 0 };
                }).filter((q: any) => q.role);
            } else {
                // Default staffing quota
                staffingQuotas = [{ role: 'Core Volunteer', count: slotsTotal, filled: 0 }];
            }

            const opportunity = {
                title: eventTitle,
                description,
                category,
                serviceLocation: eventLocation,
                date: eventDate,
                staffingQuotas,
                slotsTotal: staffingQuotas.reduce((sum, q) => sum + q.count, 0),
                slotsFilled: 0,
                isPublic: true,
                isPublicFacing: true,
                approvalStatus: 'approved',
                requiredSkills: [] as string[],
                estimatedAttendees,
                tenantId: 'hmc-health',
                urgency: row.urgency || 'medium',
                locationCoordinates: { lat: 34.0522 + (Math.random() - 0.5) * 0.1, lng: -118.2437 + (Math.random() - 0.5) * 0.1 },
                createdAt: new Date().toISOString(),
                createdBy: userProfile?.id || 'bulk-import',
            };

            const docRef = await db.collection('opportunities').add(opportunity);
            const opportunityId = docRef.id;
            importedEvents.push({ id: opportunityId, ...opportunity });

            // Create shifts for each staffing quota
            const defaultStartTime = `${eventDate}T09:00:00`;
            const defaultEndTime = `${eventDate}T14:00:00`;

            for (const quota of staffingQuotas) {
                const shift = {
                    tenantId: 'hmc-health',
                    opportunityId: opportunityId,
                    roleType: quota.role,
                    slotsTotal: quota.count,
                    slotsFilled: 0,
                    assignedVolunteerIds: [],
                    startTime: defaultStartTime,
                    endTime: defaultEndTime,
                };
                const shiftRef = await db.collection('shifts').add(shift);
                createdShifts.push({ id: shiftRef.id, ...shift });
            }
        }

        console.log(`[EVENTS] Bulk imported ${importedEvents.length} events with ${createdShifts.length} shifts`);
        res.json({
            success: true,
            importedCount: importedEvents.length,
            shiftsCreated: createdShifts.length,
            events: importedEvents,
            shifts: createdShifts
        });
    } catch (error: any) {
        console.error('[EVENTS] Bulk import failed:', error);
        res.status(500).json({ error: error.message || 'Failed to import events' });
    }
});

// Parse event time string into start/end times (e.g. "8:00 AM", "10:00 AM - 2:00 PM")
const parseEventTime = (timeStr: string | undefined): { startTime: string; endTime: string; hasEndTime: boolean } => {
    let startTime = '09:00:00';
    let endTime = '14:00:00';
    let hasEndTime = false;

    if (!timeStr || timeStr === 'TBD') return { startTime, endTime, hasEndTime };

    // Check for range format first: "10:00 AM - 2:00 PM"
    const rangeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}:\d{2})\s*(AM|PM)?/i);
    if (rangeMatch) {
        let sHours = parseInt(rangeMatch[1].split(':')[0]);
        const sMins = rangeMatch[1].split(':')[1];
        if (rangeMatch[2]?.toUpperCase() === 'PM' && sHours !== 12) sHours += 12;
        if (rangeMatch[2]?.toUpperCase() === 'AM' && sHours === 12) sHours = 0;
        startTime = `${sHours.toString().padStart(2, '0')}:${sMins}:00`;

        let eHours = parseInt(rangeMatch[3].split(':')[0]);
        const eMins = rangeMatch[3].split(':')[1];
        if (rangeMatch[4]?.toUpperCase() === 'PM' && eHours !== 12) eHours += 12;
        if (rangeMatch[4]?.toUpperCase() === 'AM' && eHours === 12) eHours = 0;
        endTime = `${eHours.toString().padStart(2, '0')}:${eMins}:00`;
        hasEndTime = true;
        return { startTime, endTime, hasEndTime };
    }

    // Single time: "8:00 AM"
    const timeMatch = timeStr.match(/(\d{1,2}:\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1].split(':')[0]);
        const mins = timeMatch[1].split(':')[1];
        if (timeMatch[2]?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (timeMatch[2]?.toUpperCase() === 'AM' && hours === 12) hours = 0;
        startTime = `${hours.toString().padStart(2, '0')}:${mins}:00`;
        // No explicit end time — estimate 3 hours for walks/runs, 2 hours for others
        const defaultDuration = 3;
        const endHours = Math.min(hours + defaultDuration, 23);
        endTime = `${endHours.toString().padStart(2, '0')}:${mins}:00`;
        hasEndTime = false;
    }

    return { startTime, endTime, hasEndTime };
};

// Sync events from Event Finder Tool (Google Sheets via Apps Script)
app.post('/api/events/sync-from-finder', verifyToken, async (req: Request, res: Response) => {
    try {
        const userProfile = (req as any).user?.profile;
        if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
            return res.status(403).json({ error: 'Only admins and event management roles can sync events' });
        }

        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycby-KmIXY2Qu8zooU4f-hjbdpb59WKonTPJOwcktDV0SjxW5CJPMbtAV1rO0SdJx_0tK8Q/exec';
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getEvents`, {
            headers: { 'Accept': 'application/json' },
            redirect: 'follow',
        });
        if (!response.ok) {
            return res.status(502).json({ error: `Event Finder backend returned status ${response.status}` });
        }

        // Google Apps Script can return HTML (login/CAPTCHA) even with 200 status
        const contentType = response.headers.get('content-type') || '';
        const responseText = await response.text();
        let data: { success?: boolean; events?: any[] };
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error('[SYNC] Event Finder returned non-JSON response:', responseText.substring(0, 200));
            return res.status(502).json({ error: 'Event Finder returned an invalid response. The Apps Script may need to be redeployed or authorized.' });
        }
        if (!data.success || !Array.isArray(data.events) || data.events.length === 0) {
            return res.json({ success: true, synced: 0, skipped: 0, message: 'No events found in Event Finder Tool' });
        }

        // Get existing opportunities to avoid duplicates (match by syncSourceId or normalized title+date)
        const existingSnap = await db.collection('opportunities').get();
        const existingEvents = existingSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

        // Normalize title for fuzzy matching: lowercase, strip punctuation, collapse whitespace
        const normalizeTitle = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

        let synced = 0;
        let skipped = 0;
        let updated = 0;
        const syncedEvents: any[] = [];
        const syncedShifts: any[] = [];

        for (const event of data.events) {
            if (!event.title || !event.date) { skipped++; continue; }

            // Check for existing event by syncSourceId or normalized title+date match
            const normTitle = normalizeTitle(event.title);
            const existing = existingEvents.find(e =>
                e.syncSourceId === event.id ||
                (normalizeTitle(e.title) === normTitle && e.date === event.date)
            );

            if (existing) {
                // Always refresh key fields from Event Finder on re-sync
                const updates: any = {};
                if (event.title && event.title !== existing.title) updates.title = event.title;
                if (event.description && event.description !== existing.description) updates.description = event.description;
                if (event.program && event.program !== existing.category) updates.category = event.program;
                if (event.location && event.location !== (existing.serviceLocation || existing.location)) updates.serviceLocation = event.location;
                if (event.flyerUrl && event.flyerUrl !== existing.flyerUrl) updates.flyerUrl = event.flyerUrl;
                if (event.date && event.date !== existing.date) updates.date = event.date;
                // Always force-update time, address, dateDisplay, and coordinates
                if (event.time) updates.time = event.time;
                if (event.address) updates.address = event.address;
                if (event.dateDisplay) updates.dateDisplay = event.dateDisplay;
                if (event.lat && event.lng) updates.locationCoordinates = { lat: event.lat, lng: event.lng };

                // Always re-sync shift times from Event Finder time string
                const timeStr = event.time || existing.time || '';
                const dateStr = event.date || existing.date;
                if (timeStr && timeStr !== 'TBD') {
                    const parsed = parseEventTime(timeStr);
                    const shiftsSnap = await db.collection('shifts').where('opportunityId', '==', existing.id).get();
                    for (const shiftDoc of shiftsSnap.docs) {
                        await shiftDoc.ref.update({
                            startTime: `${dateStr}T${parsed.startTime}`,
                            endTime: `${dateStr}T${parsed.endTime}`,
                        });
                    }
                }

                if (Object.keys(updates).length > 0) {
                    updates.lastSyncedAt = new Date().toISOString();
                    await db.collection('opportunities').doc(existing.id).update(updates);
                    updated++;
                } else {
                    skipped++;
                }
                continue;
            }

            const { startTime, endTime } = parseEventTime(event.time);

            const opportunity = {
                title: event.title,
                description: event.description || '',
                category: event.program || 'Community Health',
                serviceLocation: event.location || event.city || 'TBD',
                address: event.address || '',
                date: event.date,
                dateDisplay: event.dateDisplay || event.date,
                time: event.time || 'TBD',
                isPublic: true,
                isPublicFacing: false, // Default: NOT public-facing until admin marks it
                urgency: 'medium' as const,
                requiredSkills: [],
                slotsTotal: 10,
                slotsFilled: 0,
                staffingQuotas: [{ role: 'Core Volunteer', count: 10, filled: 0 }],
                tenantId: 'hmc-health',
                approvalStatus: 'approved',
                locationCoordinates: (event.lat && event.lng) ? { lat: event.lat, lng: event.lng } : undefined,
                flyerUrl: event.flyerUrl || undefined,
                syncSource: 'event-finder-tool',
                syncSourceId: event.id,
                lastSyncedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };

            const docRef = await db.collection('opportunities').add(opportunity);
            const opportunityId = docRef.id;

            // Create a default shift
            const shift = {
                tenantId: 'hmc-health',
                opportunityId,
                roleType: 'Core Volunteer',
                slotsTotal: 10,
                slotsFilled: 0,
                assignedVolunteerIds: [],
                startTime: `${event.date}T${startTime}`,
                endTime: `${event.date}T${endTime}`,
            };
            const shiftRef = await db.collection('shifts').add(shift);

            syncedEvents.push({ id: opportunityId, ...opportunity });
            syncedShifts.push({ id: shiftRef.id, ...shift });
            synced++;
        }

        console.log(`[SYNC] Event Finder sync complete: ${synced} new, ${updated} updated, ${skipped} skipped`);
        res.json({
            success: true,
            synced,
            updated,
            skipped,
            total: data.events.length,
            events: syncedEvents,
            shifts: syncedShifts,
        });
    } catch (error: any) {
        console.error('[SYNC] Event Finder sync failed:', error);
        res.status(500).json({ error: error.message || 'Failed to sync events' });
    }
});

// Invite a non-portal volunteer to register via email
app.post('/api/events/invite-volunteer', verifyToken, async (req: Request, res: Response) => {
  try {
    const callerUser = (req as any).user;
    const callerData = (await db.collection('volunteers').doc(callerUser.uid).get()).data();
    if (!callerData?.isAdmin && !COORDINATOR_AND_LEAD_ROLES.includes(callerData?.role)) {
      return res.status(403).json({ error: 'Only admins, coordinators, and leads can invite volunteers' });
    }

    const { email, name, eventId, eventTitle, eventDate } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if email already exists in volunteers collection
    const existingSnap = await db.collection('volunteers')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      return res.json({ alreadyRegistered: true, volunteerId: existing.id, volunteerName: existing.data().name });
    }

    // Store invite record
    const inviteData = {
      email: email.toLowerCase(),
      name,
      eventId: eventId || null,
      eventTitle: eventTitle || null,
      eventDate: eventDate || null,
      invitedBy: callerUser.uid,
      invitedAt: new Date().toISOString(),
      status: 'pending',
    };
    const inviteRef = await db.collection('event_invites').add(inviteData);

    // Send invite email
    const emailResult = await EmailService.send('event_volunteer_invite', {
      toEmail: email.toLowerCase(),
      volunteerName: name,
      eventTitle: eventTitle || 'a community event',
      eventDate: eventDate || 'an upcoming date',
    });

    if (emailResult.sent) {
      console.log(`[INVITE] Volunteer invite sent to ${maskEmail(email)} for event ${eventTitle || eventId}`);
      res.json({ sent: true, inviteId: inviteRef.id });
    } else {
      console.warn(`[INVITE] Invite saved but email not sent to ${maskEmail(email)}: ${emailResult.reason}`);
      res.json({ sent: true, inviteId: inviteRef.id, emailFailed: true, emailReason: emailResult.reason || 'Email service not configured' });
    }
  } catch (error: any) {
    console.error('[INVITE] Failed to send volunteer invite:', error);
    res.status(500).json({ error: error.message || 'Failed to send invite' });
  }
});

// Unregister a volunteer from an event shift
app.post('/api/events/unregister', verifyToken, async (req: Request, res: Response) => {
  try {
    const { volunteerId, eventId, shiftId } = req.body;
    if (!volunteerId || !eventId) {
      return res.status(400).json({ error: 'volunteerId and eventId are required' });
    }

    // Auth: caller must be the volunteer themselves or an admin/coordinator
    const callerUid = (req as any).user?.uid;
    const callerProfile = (req as any).user?.profile;
    if (callerUid !== volunteerId && !callerProfile?.isAdmin && !REGISTRATION_MANAGEMENT_ROLES.includes(callerProfile?.role)) {
      return res.status(403).json({ error: 'You can only unregister yourself or must be a coordinator' });
    }

    // Update shift: remove volunteer and decrement count atomically (if shift provided)
    if (shiftId) {
      const shiftRef = db.collection('shifts').doc(shiftId);
      const shiftDoc = await shiftRef.get();
      if (shiftDoc.exists) {
        const shiftData = shiftDoc.data()!;
        // Only decrement if volunteer is actually assigned
        const isAssigned = (shiftData.assignedVolunteerIds || []).includes(volunteerId);
        if (isAssigned) {
          await shiftRef.update({
            slotsFilled: admin.firestore.FieldValue.increment(-1),
            assignedVolunteerIds: admin.firestore.FieldValue.arrayRemove(volunteerId),
          });

          // Update opportunity staffingQuotas
          const oppRef = db.collection('opportunities').doc(eventId);
          const oppDoc = await oppRef.get();
          if (oppDoc.exists) {
            const oppData = oppDoc.data()!;
            const updatedQuotas = (oppData.staffingQuotas || []).map((q: any) =>
              q.role === shiftData.roleType ? { ...q, filled: Math.max(0, (q.filled || 0) - 1) } : q
            );
            await oppRef.update({
              staffingQuotas: updatedQuotas,
              slotsFilled: admin.firestore.FieldValue.increment(-1),
            });
          }
        }
      }
    }

    // Remove from volunteer's assignedShiftIds and rsvpedEventIds
    const volRef = db.collection('volunteers').doc(volunteerId);
    const volDoc = await volRef.get();
    if (volDoc.exists) {
      const volData = volDoc.data()!;
      const updates: any = {
        rsvpedEventIds: (volData.rsvpedEventIds || []).filter((id: string) => id !== eventId),
      };
      if (shiftId) {
        updates.assignedShiftIds = (volData.assignedShiftIds || []).filter((id: string) => id !== shiftId);
      }
      await volRef.update(updates);
    }

    console.log(`[EVENTS] Unregistered volunteer ${volunteerId} from event ${eventId}${shiftId ? ` shift ${shiftId}` : ''}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[EVENTS] Failed to unregister volunteer:', error);
    res.status(500).json({ error: error.message || 'Failed to unregister' });
  }
});

// Event registration endpoint - registers volunteer for event and sends confirmation email
app.post('/api/events/register', verifyToken, async (req: Request, res: Response) => {
  try {
    const { volunteerId, eventId, shiftId, eventTitle, eventDate, eventLocation, volunteerEmail, volunteerName } = req.body;

    // Auth: caller must be the volunteer themselves or an admin/coordinator
    const callerUid = (req as any).user?.uid;
    const callerProfile = (req as any).user?.profile;
    if (callerUid !== volunteerId && !callerProfile?.isAdmin && !REGISTRATION_MANAGEMENT_ROLES.includes(callerProfile?.role)) {
      return res.status(403).json({ error: 'You can only register yourself or must be a coordinator' });
    }

    // Validate volunteer exists
    const volunteerRef = db.collection('volunteers').doc(volunteerId);
    const volunteerDoc = await volunteerRef.get();
    if (!volunteerDoc.exists) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    const volunteerData = volunteerDoc.data() as any;

    // Training gate enforcement — admins/coordinators can bypass when registering others
    const isSelfRegistration = callerUid === volunteerId;
    if (isSelfRegistration) {
      if (!volunteerData.coreVolunteerStatus && !callerProfile?.isAdmin) {
        return res.status(403).json({ error: 'You must complete Core Volunteer training before registering for events' });
      }
      if (!volunteerData.completedHIPAATraining && !callerProfile?.isAdmin) {
        return res.status(403).json({ error: 'You must complete HIPAA training before registering for events' });
      }
    }

    // Tier 3: Program-specific training gate enforcement
    if (isSelfRegistration && !callerProfile?.isAdmin) {
      const oppDoc = await db.collection('opportunities').doc(eventId).get();
      if (oppDoc.exists) {
        const oppData = oppDoc.data() as any;
        const eventCategory = (oppData.category || '').toLowerCase();
        const eligibility = volunteerData.eventEligibility || {};
        const qualifiedTypes = (eligibility.qualifiedEventTypes || []).map((t: string) => t.toLowerCase());

        // Check program-specific gates based on event category
        if (eventCategory.includes('street medicine') && !eligibility.streetMedicineGate) {
          return res.status(403).json({ error: 'You must complete Street Medicine training before registering for Street Medicine events' });
        }
        if ((eventCategory.includes('clinical') || eventCategory.includes('screening') || eventCategory.includes('vaccination')) && !eligibility.clinicGate) {
          return res.status(403).json({ error: 'You must complete Clinical training before registering for clinical events' });
        }
      }
    }

    // Check for duplicate registration on this shift
    if (shiftId) {
      const shiftRef = db.collection('shifts').doc(shiftId);
      const shiftDoc = await shiftRef.get();
      if (shiftDoc.exists) {
        const shiftData = shiftDoc.data() as any;
        if ((shiftData.assignedVolunteerIds || []).includes(volunteerId)) {
          return res.json({ success: true, message: 'Already registered', alreadyRegistered: true,
            rsvpedEventIds: volunteerData.rsvpedEventIds || [], assignedShiftIds: volunteerData.assignedShiftIds || [] });
        }
        // Check slot capacity
        if ((shiftData.slotsFilled || 0) >= (shiftData.slotsTotal || 0)) {
          return res.status(409).json({ error: 'This shift is full' });
        }
      }
    }

    const updatedRsvpIds = [...new Set([...(volunteerData.rsvpedEventIds || []), eventId])];
    const updatedShiftIds = shiftId
      ? [...new Set([...(volunteerData.assignedShiftIds || []), shiftId])]
      : (volunteerData.assignedShiftIds || []);

    await volunteerRef.update({
      rsvpedEventIds: updatedRsvpIds,
      assignedShiftIds: updatedShiftIds
    });

    // Update shift slot count atomically if a shift was assigned
    if (shiftId) {
      const shiftRef = db.collection('shifts').doc(shiftId);
      await shiftRef.update({
        slotsFilled: admin.firestore.FieldValue.increment(1),
        assignedVolunteerIds: admin.firestore.FieldValue.arrayUnion(volunteerId)
      });

      // Read shift for roleType, then update opportunity quotas
      const shiftDoc = await shiftRef.get();
      if (shiftDoc.exists) {
        const shiftData = shiftDoc.data() as any;
        const opportunityRef = db.collection('opportunities').doc(eventId);
        const oppDoc = await opportunityRef.get();
        if (oppDoc.exists) {
          const oppData = oppDoc.data() as any;
          const roleType = shiftData.roleType || 'Core Volunteer';
          const updatedQuotas = (oppData.staffingQuotas || []).map((q: any) => {
            if (q.role === roleType) {
              return { ...q, filled: (q.filled || 0) + 1 };
            }
            return q;
          });
          await opportunityRef.update({
            staffingQuotas: updatedQuotas,
            slotsFilled: admin.firestore.FieldValue.increment(1)
          });
        }
      }
    }

    // Send confirmation email
    if (volunteerEmail) {
      try {
        await EmailService.send('event_registration_confirmation', {
          toEmail: volunteerEmail,
          volunteerName: volunteerName || 'Volunteer',
          eventTitle: eventTitle || 'Community Event',
          eventDate: formatEventDate(eventDate || 'TBD'),
          eventLocation: eventLocation || 'TBD'
        });
        console.log(`[EVENTS] Sent registration confirmation to ${maskEmail(volunteerEmail)} for ${eventTitle}`);
      } catch (emailError) {
        console.error('[EVENTS] Failed to send confirmation email:', emailError);
        // Don't fail the registration if email fails
      }
    }

    // Award XP for signing up
    try {
      await GamificationService.addXP(volunteerId, 'event_signup');
    } catch (xpError) {
      console.error('[EVENTS] Failed to award XP:', xpError);
    }

    // Notify Event Coordinators about the new registration
    try {
      const coordinatorsSnap = await db.collection('volunteers')
        .where('role', 'in', EVENT_MANAGEMENT_ROLES)
        .where('status', '==', 'active')
        .get();

      const coordinatorNotifications = coordinatorsSnap.docs.map(async (doc) => {
        const coordinator = doc.data();
        if (coordinator.email) {
          // Send email notification to coordinator
          await EmailService.send('coordinator_registration_alert', {
            toEmail: coordinator.email,
            coordinatorName: coordinator.name || coordinator.firstName || 'Coordinator',
            volunteerName: volunteerName || 'A volunteer',
            eventTitle: eventTitle || 'an event',
            eventDate: formatEventDate(eventDate || 'upcoming'),
          });
        }
      });

      await Promise.allSettled(coordinatorNotifications);
      console.log(`[EVENTS] Notified ${coordinatorsSnap.size} coordinator(s) about registration`);
    } catch (coordError) {
      console.error('[EVENTS] Failed to notify coordinators:', coordError);
      // Non-blocking - don't fail registration if coordinator notification fails
    }

    res.json({
      success: true,
      message: 'Successfully registered for event',
      rsvpedEventIds: updatedRsvpIds,
      assignedShiftIds: updatedShiftIds
    });
  } catch (error: any) {
    console.error('[EVENTS] Failed to register for event:', error);
    res.status(500).json({ error: error.message || 'Failed to register for event' });
  }
});

app.post('/api/broadcasts/send', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { title, content, category = 'General', sendAsSms = false, targetRoles } = req.body;
        const announcement = { title, content, date: new Date().toISOString(), category, status: 'approved', ...(targetRoles ? { targetRoles } : {}) };
        const docRef = await db.collection('announcements').add(announcement);

        let smsResults = { attempted: 0, sent: 0, failed: 0 };

        // Send SMS to all opted-in volunteers if requested
        if (sendAsSms) {
            console.log('[BROADCAST] SMS broadcast requested');

            if (!twilioClient || !TWILIO_PHONE_NUMBER) {
                console.log('[BROADCAST] Twilio not configured, skipping SMS');
            } else {
                // Fetch all volunteers who have opted in to SMS
                const volunteersSnap = await db.collection('volunteers')
                    .where('notificationPrefs.smsAlerts', '==', true)
                    .get();

                console.log(`[BROADCAST] Found ${volunteersSnap.size} volunteers opted in to SMS`);

                // Also check volunteers without explicit prefs who have phone numbers
                const allVolunteersSnap = await db.collection('volunteers').get();
                const eligibleVolunteers: { id: string; phone: string }[] = [];

                allVolunteersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const phone = data.phone || data.phoneNumber;
                    const smsOptIn = data.notificationPrefs?.smsAlerts;

                    // Include if they have a phone and haven't explicitly opted out
                    if (phone && smsOptIn !== false) {
                        eligibleVolunteers.push({ id: doc.id, phone });
                    }
                });

                console.log(`[BROADCAST] ${eligibleVolunteers.length} volunteers eligible for SMS`);
                smsResults.attempted = eligibleVolunteers.length;

                // Compose SMS message (truncate if too long)
                const smsBody = `[HMC] ${title}\n\n${content}`.substring(0, 1500);

                // Send SMS to each volunteer
                const smsPromises = eligibleVolunteers.map(async (vol) => {
                    try {
                        await twilioClient!.messages.create({
                            body: smsBody,
                            from: TWILIO_PHONE_NUMBER,
                            to: vol.phone
                        });
                        console.log(`[BROADCAST] SMS sent to ${maskPhone(vol.phone)}`);
                        return { success: true };
                    } catch (error: any) {
                        console.error(`[BROADCAST] SMS failed for ${maskPhone(vol.phone)}:`, error.message);
                        return { success: false, error: error.message };
                    }
                });

                const results = await Promise.allSettled(smsPromises);
                results.forEach((result, idx) => {
                    if (result.status === 'fulfilled' && result.value.success) {
                        smsResults.sent++;
                    } else {
                        smsResults.failed++;
                    }
                });

                console.log(`[BROADCAST] SMS results: ${smsResults.sent} sent, ${smsResults.failed} failed`);
            }
        }

        res.json({
            id: docRef.id,
            ...announcement,
            smsResults: sendAsSms ? smsResults : undefined
        });
    } catch (error: any) {
        console.error('[BROADCAST] Failed to send broadcast:', error);
        res.status(500).json({ error: error.message || 'Failed to send broadcast' });
    }
});
app.post('/api/support_tickets', verifyToken, async (req: Request, res: Response) => {
    try {
        const { ticket } = req.body;
        const ticketWithTimestamp = {
            ...ticket,
            createdAt: new Date().toISOString(),
            status: 'open'
        };
        const docRef = await db.collection('support_tickets').add(ticketWithTimestamp);

        // Send email notification to tech support
        try {
            await EmailService.send('support_ticket_notification', {
                toEmail: 'tech@healthmatters.clinic',
                ticketId: docRef.id,
                subject: ticket.subject || 'New Support Ticket',
                description: ticket.description || ticket.message || 'No description provided',
                category: ticket.category || 'General',
                priority: ticket.priority || 'Normal',
                submitterName: ticket.submitterName || 'Unknown',
                submitterEmail: ticket.submitterEmail || 'Unknown',
            });
            console.log(`[SUPPORT] Ticket ${docRef.id} created and notification sent to tech@healthmatters.clinic`);
        } catch (emailError) {
            console.error('[SUPPORT] Failed to send ticket notification email:', emailError);
            // Don't fail the ticket creation if email fails
        }

        res.json({ id: docRef.id, ...ticketWithTimestamp, success: true });
    } catch (error: any) {
        console.error('[SUPPORT] Failed to create support ticket:', error);
        res.status(500).json({ error: error.message || 'Failed to create support ticket' });
    }
});

// Update support ticket (for assignment, status changes, etc.)
app.put('/api/support_tickets/:ticketId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const updates = req.body;

        // Validate ticket exists
        const ticketRef = db.collection('support_tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        if (!ticketDoc.exists) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Sanitize updates: remove undefined values (Firestore rejects them)
        // and use FieldValue.deleteField() for explicit field removal
        const sanitized: Record<string, any> = { updatedAt: new Date().toISOString() };
        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) {
                sanitized[key] = admin.firestore.FieldValue.delete();
            } else {
                sanitized[key] = value;
            }
        }

        await ticketRef.update(sanitized);

        const updatedTicket = (await ticketRef.get()).data();
        console.log(`[SUPPORT] Ticket ${ticketId} updated:`, Object.keys(updates).join(', '));
        res.json({ id: ticketId, ...updatedTicket });
    } catch (error: any) {
        console.error('[SUPPORT] Failed to update support ticket:', error);
        res.status(500).json({ error: error.message || 'Failed to update support ticket' });
    }
});

app.post('/api/admin/bulk-import', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        console.log(`[ADMIN] Bulk import initiated by ${(req as any).user?.profile?.email}`);
        const { csvData } = req.body;
        // Decode base64 CSV data
        const csvContent = Buffer.from(csvData, 'base64').toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        const newVolunteers: any[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: any = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });

            // Create volunteer object
            const volunteer: Record<string, any> = {
                legalFirstName: row.legalFirstName || row.firstName || '',
                legalLastName: row.legalLastName || row.lastName || '',
                name: `${row.legalFirstName || row.firstName || ''} ${row.legalLastName || row.lastName || ''}`.trim(),
                email: row.email,
                phone: row.phone || '',
                role: row.role || row.volunteerRole || 'Core Volunteer',
                tenantId: 'hmc-health',
                status: 'active',
                identityLabel: 'HMC Champion',
                volunteerRole: row.role || row.volunteerRole || 'Core Volunteer',
                joinedDate: row.joinedDate || new Date().toISOString(),
                onboardingProgress: 0,
                hoursContributed: parseInt(row.hoursContributed) || 0,
                points: 0,
                isAdmin: false,
                coreVolunteerStatus: false,
                compliance: {
                    application: { id: 'application', label: 'Application', status: 'completed' },
                    backgroundCheck: { id: 'backgroundCheck', label: 'Background Check', status: 'pending' },
                    hipaaTraining: { id: 'hipaaTraining', label: 'HIPAA Training', status: 'pending' },
                    training: { id: 'training', label: 'Core Training', status: 'pending' },
                    orientation: { id: 'orientation', label: 'Orientation', status: 'pending' },
                },
                skills: [],
                tasks: [],
                achievements: [],
                availability: {
                    days: row.availability_days ? row.availability_days.split(';') : [],
                    preferredTime: row.availability_preferredTime || 'Any',
                    startDate: row.availability_startDate || new Date().toISOString().split('T')[0]
                },
                eventEligibility: {
                    canDeployCore: false,
                    streetMedicineGate: false,
                    clinicGate: false,
                    healthFairGate: false,
                    naloxoneDistribution: false,
                    oraQuickDistribution: false,
                    qualifiedEventTypes: []
                }
            };

            if (volunteer.email) {
                const emailLower = volunteer.email.toLowerCase();
                volunteer.email = emailLower;
                let finalUserId: string;

                // Create Firebase Auth account so the volunteer can actually log in
                try {
                    const tempPassword = crypto.randomBytes(9).toString('base64url') + 'A1!';
                    const userRecord = await auth.createUser({
                        email: emailLower,
                        password: tempPassword,
                        displayName: volunteer.name,
                    });
                    finalUserId = userRecord.uid;
                    volunteer.authProvider = 'email';
                } catch (authErr: any) {
                    if (authErr.code === 'auth/email-already-exists') {
                        // Firebase Auth user already exists - use their UID
                        const existingUser = await auth.getUserByEmail(emailLower);
                        finalUserId = existingUser.uid;
                        volunteer.authProvider = existingUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email';
                    } else {
                        console.error(`[BULK IMPORT] Failed to create auth for ${emailLower}:`, authErr.message);
                        // Fallback to Firestore-only
                        const docRef = await db.collection('volunteers').add(volunteer);
                        finalUserId = docRef.id;
                        volunteer.authProvider = 'manual';
                    }
                }

                await db.collection('volunteers').doc(finalUserId).set({ ...volunteer, id: finalUserId }, { merge: true });
                newVolunteers.push({ id: finalUserId, ...volunteer });

                // Send welcome email
                try {
                    await EmailService.send('welcome_volunteer', {
                        toEmail: emailLower,
                        volunteerName: volunteer.name || volunteer.legalFirstName || 'Volunteer',
                        appliedRole: volunteer.role,
                    });
                } catch (emailErr) {
                    console.error(`Failed to send welcome email to ${maskEmail(emailLower)}:`, emailErr);
                }
            }
        }

        console.log(`[BULK IMPORT] Successfully imported ${newVolunteers.length} volunteers`);
        res.json({ importedCount: newVolunteers.length, newVolunteers });
    } catch (error: any) {
        console.error('[BULK IMPORT] Failed:', error);
        res.status(500).json({ error: error.message || 'Failed to import volunteers' });
    }
});

// Reconcile Firestore volunteers with Firebase Auth - provisions missing auth accounts
app.post('/api/admin/reconcile-auth', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const allVols = await db.collection('volunteers').get();
        let created = 0, skipped = 0, migrated = 0, errors = 0;
        const results: string[] = [];

        for (const doc of allVols.docs) {
            const vol = doc.data();
            if (!vol.email) { skipped++; continue; }
            const emailLower = vol.email.toLowerCase();

            try {
                // Check if Firebase Auth user exists and if Firestore doc ID matches
                const authUser = await auth.getUserByEmail(emailLower);
                if (doc.id !== authUser.uid) {
                    // Migrate doc to correct UID
                    await db.collection('volunteers').doc(authUser.uid).set({
                        ...vol, id: authUser.uid,
                        authProvider: authUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : (vol.authProvider || 'email'),
                    }, { merge: true });
                    await db.collection('volunteers').doc(doc.id).delete();
                    migrated++;
                    results.push(`Migrated ${emailLower}: ${doc.id} -> ${authUser.uid}`);
                } else {
                    skipped++;
                }
            } catch (err: any) {
                if (err.code === 'auth/user-not-found') {
                    // Create Firebase Auth account
                    try {
                        const tempPassword = crypto.randomBytes(9).toString('base64url') + 'A1!';
                        const userRecord = await auth.createUser({
                            email: emailLower,
                            password: tempPassword,
                            displayName: vol.name || `${vol.legalFirstName || ''} ${vol.legalLastName || ''}`.trim() || 'Volunteer',
                        });
                        // Migrate Firestore doc to new UID
                        await db.collection('volunteers').doc(userRecord.uid).set({
                            ...vol, id: userRecord.uid, authProvider: 'email',
                        }, { merge: true });
                        if (doc.id !== userRecord.uid) {
                            await db.collection('volunteers').doc(doc.id).delete();
                        }
                        created++;
                        results.push(`Created auth + migrated ${emailLower}: ${doc.id} -> ${userRecord.uid}`);
                    } catch (createErr: any) {
                        errors++;
                        results.push(`Failed ${emailLower}: ${createErr.message}`);
                    }
                } else {
                    errors++;
                    results.push(`Error checking ${emailLower}: ${err.message}`);
                }
            }
        }

        console.log(`[RECONCILE] Created: ${created}, Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
        res.json({ created, migrated, skipped, errors, results });
    } catch (error: any) {
        console.error('[RECONCILE] Failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add single volunteer manually
app.post('/api/admin/add-volunteer', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { volunteer, password, sendPasswordReset } = req.body;
        console.log(`[ADMIN] Add volunteer initiated by ${(req as any).user?.profile?.email}`);

        if (!volunteer.email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // SECURITY: Prevent creating admin accounts via this endpoint
        if (volunteer.isAdmin) {
            return res.status(403).json({ error: 'Cannot create admin accounts via this endpoint' });
        }

        // Check if email already exists
        const existingByEmail = await db.collection('volunteers')
            .where('email', '==', volunteer.email.toLowerCase())
            .limit(1)
            .get();

        if (!existingByEmail.empty) {
            return res.status(409).json({ error: 'A volunteer with this email already exists.' });
        }

        let finalUserId: string;
        let passwordResetLink: string | null = null;

        // If password provided and Firebase is configured, create Firebase Auth user
        if (password && firebaseConfigured) {
            try {
                const userRecord = await auth.createUser({
                    email: volunteer.email.toLowerCase(),
                    password: password,
                    displayName: volunteer.name || `${volunteer.legalFirstName} ${volunteer.legalLastName}`.trim()
                });
                finalUserId = userRecord.uid;
                volunteer.authProvider = 'email';
                console.log(`[ADD VOLUNTEER] Created Firebase Auth user: ${finalUserId}`);

                // Generate password reset link if requested
                if (sendPasswordReset) {
                    try {
                        passwordResetLink = await auth.generatePasswordResetLink(volunteer.email.toLowerCase());
                        console.log(`[ADD VOLUNTEER] Generated password reset link for ${volunteer.email}`);
                    } catch (resetErr) {
                        console.error('[ADD VOLUNTEER] Failed to generate password reset link:', resetErr);
                    }
                }
            } catch (authError: any) {
                console.error('[ADD VOLUNTEER] Firebase Auth error:', authError.message);
                return res.status(400).json({
                    error: `Failed to create account: ${authError.message}`
                });
            }
        } else if (firebaseConfigured) {
            // No password provided - create Firebase Auth user with random password and send reset
            try {
                const tempPassword = crypto.randomBytes(9).toString('base64url') + 'A1!';
                const userRecord = await auth.createUser({
                    email: volunteer.email.toLowerCase(),
                    password: tempPassword,
                    displayName: volunteer.name || `${volunteer.legalFirstName} ${volunteer.legalLastName}`.trim()
                });
                finalUserId = userRecord.uid;
                volunteer.authProvider = 'email';

                // Always send password reset when no password provided
                passwordResetLink = await auth.generatePasswordResetLink(volunteer.email.toLowerCase());
                console.log(`[ADD VOLUNTEER] Created user with temp password, reset link generated`);
            } catch (authError: any) {
                console.error('[ADD VOLUNTEER] Firebase Auth error:', authError.message);
                return res.status(400).json({
                    error: `Failed to create account: ${authError.message}`
                });
            }
        } else {
            // Firebase not configured - create Firestore-only entry
            const docRef = await db.collection('volunteers').add({
                ...volunteer,
                email: volunteer.email.toLowerCase(),
                authProvider: 'manual',
                status: volunteer.status || 'active'
            });
            finalUserId = docRef.id;
        }

        // Save volunteer data to Firestore with the correct ID
        const volunteerData = {
            ...volunteer,
            id: finalUserId,
            email: volunteer.email.toLowerCase(),
            status: volunteer.status || 'active',
            role: volunteer.role || 'HMC Champion',
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
            mustResetPassword: sendPasswordReset || !password
        };

        await db.collection('volunteers').doc(finalUserId).set(volunteerData, { merge: true });

        // Send welcome email with password reset link if available
        try {
            await EmailService.send('admin_added_volunteer', {
                toEmail: volunteer.email,
                volunteerName: volunteer.name || volunteer.legalFirstName || 'Volunteer',
                appliedRole: volunteer.role || 'HMC Champion',
                passwordResetLink: passwordResetLink || undefined,
                hasPasswordReset: !!passwordResetLink
            });
            console.log(`[ADD VOLUNTEER] Welcome email sent to ${volunteer.email} (with reset link: ${!!passwordResetLink})`);
        } catch (emailErr) {
            console.error(`Failed to send welcome email to ${maskEmail(volunteer.email)}:`, emailErr);
        }

        res.json({ id: finalUserId, ...volunteerData });
    } catch (error: any) {
        console.error('[ADD VOLUNTEER] Failed:', error);
        res.status(500).json({ error: error.message || 'Failed to add volunteer' });
    }
});
app.post('/api/admin/update-volunteer-profile', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    const { volunteer } = req.body;
    if (!volunteer?.id) return res.status(400).json({ error: 'Volunteer ID required' });
    // SECURITY: Prevent escalation - cannot set isAdmin via this endpoint
    const { isAdmin, ...safeUpdates } = volunteer;
    await db.collection('volunteers').doc(volunteer.id).update(safeUpdates);
    console.log(`[ADMIN] Profile updated for volunteer ${volunteer.id} by ${(req as any).user?.profile?.email}`);
    res.json({ success: true });
});

// Delete a volunteer (admin only)
app.delete('/api/admin/volunteer/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Volunteer ID is required' });

    // Don't allow deleting yourself
    const callerUid = (req as any).user?.uid;
    if (callerUid === id) return res.status(400).json({ error: 'You cannot delete your own account' });

    // Check volunteer exists
    const volDoc = await db.collection('volunteers').doc(id).get();
    if (!volDoc.exists) return res.status(404).json({ error: 'Volunteer not found' });

    // Remove volunteer from any assigned shifts
    const shiftsSnap = await db.collection('shifts').where('assignedVolunteerIds', 'array-contains', id).get();
    const batch = db.batch();
    shiftsSnap.docs.forEach(shiftDoc => {
      const data = shiftDoc.data();
      batch.update(shiftDoc.ref, {
        assignedVolunteerIds: (data.assignedVolunteerIds || []).filter((vid: string) => vid !== id),
        slotsFilled: Math.max(0, (data.slotsFilled || 0) - 1),
      });
    });

    // Delete the volunteer document
    batch.delete(db.collection('volunteers').doc(id));
    await batch.commit();

    // Try to delete their Firebase Auth account too
    try {
      await admin.auth().deleteUser(id);
    } catch (authErr: any) {
      console.warn(`[ADMIN] Could not delete auth user ${id}: ${authErr.message}`);
    }

    console.log(`[ADMIN] Deleted volunteer ${id} (${volDoc.data()?.name}) by ${(req as any).user?.profile?.email}`);
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('[ADMIN] Failed to delete volunteer:', error);
    res.status(500).json({ error: error.message || 'Failed to delete volunteer' });
  }
});

app.post('/api/admin/review-application', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { volunteerId, action, notes } = req.body;
    console.log(`[ADMIN] Application ${action} for ${volunteerId} by ${(req as any).user?.profile?.email}`);
    const updates: any = {
      applicationStatus: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes || ''
    };
    if (action === 'approve') {
      updates.status = 'active';
      updates.role = (await db.collection('volunteers').doc(volunteerId).get()).data()?.appliedRole || 'Core Volunteer';
    }
    await db.collection('volunteers').doc(volunteerId).update(updates);
    const updatedDoc = await db.collection('volunteers').doc(volunteerId).get();
    const docData = updatedDoc.data() as any;
    const volData = { id: volunteerId, ...docData };

    // Send application decision email (non-blocking - don't fail if email fails)
    if (docData?.email) {
      try {
        if (action === 'approve') {
          await EmailService.send('application_approved', {
            toEmail: docData.email,
            volunteerName: docData.name || docData.firstName || 'Volunteer',
            approvedRole: docData.role || docData.appliedRole || 'Volunteer',
          });
          // Award XP for approval
          await GamificationService.addXP(volunteerId, 'signup_completed');
        } else {
          await EmailService.send('application_rejected', {
            toEmail: docData.email,
            volunteerName: docData.name || docData.firstName || 'Volunteer',
            reason: notes || 'Unfortunately, we are unable to move forward at this time.',
          });
        }
      } catch (emailError) {
        console.error('Failed to send application decision email:', emailError);
        // Continue - email failure shouldn't block the review
      }
    }

    res.json({ volunteer: volData });
  } catch (error: any) {
    console.error('Failed to review application:', error);
    res.status(500).json({ error: error.message || 'Failed to review application' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GAMIFICATION API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Get volunteer profile with XP, level, achievements
app.get('/api/volunteer/profile', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const profile = await GamificationService.getProfile(userId);
    const volunteer = await db.collection('volunteers').doc(userId).get();

    res.json({
      ...profile,
      volunteerData: volunteer.data(),
      xpToNextLevel: GamificationService.getXPToNextLevel(profile.currentXP),
      levelProgress: profile.currentXP / (LEVEL_THRESHOLDS[profile.level] || 60000) * 100,
    });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete shift and award XP
app.post('/api/volunteer/complete-shift', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const { shiftId } = req.body;

    const result = await GamificationService.addXP(userId, 'shift_completed', undefined, { shiftId });

    // Update streak for weekly committed volunteers
    const profile = await GamificationService.getProfile(userId);
    let streakResult = { streakDays: 0, bonusXP: 0 };
    if (profile.volunteerType === 'weekly_committed') {
      streakResult = await GamificationService.updateStreak(userId);
    }

    res.json({
      success: true,
      xpEarned: result.newXP - (profile.currentXP - (result.leveledUp ? 0 : result.newXP - profile.currentXP)),
      newXP: result.newXP,
      newLevel: result.newLevel,
      leveledUp: result.leveledUp,
      streak: streakResult,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set volunteer type (weekly_committed or flexible)
app.post('/api/volunteer/volunteer-type', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const { volunteerType } = req.body;

    if (!['weekly_committed', 'flexible'].includes(volunteerType)) {
      return res.status(400).json({ error: 'Invalid volunteer type' });
    }

    await db.collection('volunteer_profiles').doc(userId).update({ volunteerType });
    res.json({ success: true, volunteerType });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete training and award XP
app.post('/api/volunteer/complete-training', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const { trainingId, trainingName } = req.body;

    const result = await GamificationService.addXP(userId, 'training_completed', undefined, { trainingId, trainingName });

    // If HIPAA training, send acknowledgment email
    if (trainingName?.toLowerCase().includes('hipaa')) {
      const volunteer = await db.collection('volunteers').doc(userId).get();
      const volData = volunteer.data();
      if (volData?.email) {
        await EmailService.send('hipaa_acknowledgment', {
          toEmail: volData.email,
          volunteerName: volData.name || volData.firstName || 'Volunteer',
          completionDate: new Date().toLocaleDateString(),
        });
      }
    }

    res.json({
      success: true,
      newXP: result.newXP,
      newLevel: result.newLevel,
      leveledUp: result.leveledUp,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// REFERRAL API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Get referral email templates
app.get('/api/referral/templates', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const profile = await GamificationService.getProfile(userId);
    const volunteer = await db.collection('volunteers').doc(userId).get();
    const volData = volunteer.data();

    const templates: Record<string, { subject: string; body: string }> = {};
    const portalUrl = process.env.PORTAL_URL || EMAIL_CONFIG.WEBSITE_URL;

    for (const [key, template] of Object.entries(REFERRAL_TEMPLATES)) {
      let body = template.body
        .replace(/\[Your Name\]/g, volData?.name || volData?.firstName || 'A Health Matters Volunteer')
        .replace(/\[VOLUNTEER_LINK\]/g, `${portalUrl}/join?ref=${profile.referralCode}`)
        .replace(/\[DONATION_LINK\]/g, 'https://healthmatters.clinic/donate')
        .replace(/\[HOURS\]/g, String(volData?.hoursContributed || 0))
        .replace(/\[PEOPLE_HELPED\]/g, String((volData?.hoursContributed || 0) * 5));

      templates[key] = { subject: template.subject, body };
    }

    res.json({
      templates,
      referralCode: profile.referralCode,
      referralLink: `${portalUrl}/join?ref=${profile.referralCode}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send referral email
app.post('/api/referral/send-email', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const { recipientEmail, recipientName, templateType, customMessage } = req.body;

    if (!recipientEmail || !templateType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const profile = await GamificationService.getProfile(userId);
    const volunteer = await db.collection('volunteers').doc(userId).get();
    const volData = volunteer.data();
    const portalUrl = process.env.PORTAL_URL || EMAIL_CONFIG.WEBSITE_URL;

    const template = REFERRAL_TEMPLATES[templateType as keyof typeof REFERRAL_TEMPLATES];
    if (!template) {
      return res.status(400).json({ error: 'Invalid template type' });
    }

    let body = customMessage || template.body
      .replace(/\[Friend Name\]/g, recipientName || 'Friend')
      .replace(/\[Your Name\]/g, volData?.name || volData?.firstName || 'A Health Matters Volunteer')
      .replace(/\[VOLUNTEER_LINK\]/g, `${portalUrl}/join?ref=${profile.referralCode}`)
      .replace(/\[DONATION_LINK\]/g, 'https://healthmatters.clinic/donate')
      .replace(/\[HOURS\]/g, String(volData?.hoursContributed || 0))
      .replace(/\[PEOPLE_HELPED\]/g, String((volData?.hoursContributed || 0) * 5));

    // Send via Google Apps Script
    if (EMAIL_SERVICE_URL) {
      await fetch(EMAIL_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'referral_invitation',
          toEmail: recipientEmail,
          subject: template.subject,
          body: body,
          volunteerName: volData?.firstName,
          referralLink: `${portalUrl}/join?ref=${profile.referralCode}`,
        })
      });
    }

    // Log sharing event
    await db.collection('sharing_events').add({
      volunteerId: userId,
      channel: 'email',
      recipientEmail,
      templateType,
      timestamp: new Date(),
      referralCode: profile.referralCode,
    });

    // Award XP for sharing
    await GamificationService.addXP(userId, 'shared', XP_CONFIG.SOCIAL_SHARE, { shareType: 'referral_email' });

    res.json({ success: true, referralCode: profile.referralCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get referral dashboard stats
app.get('/api/referral/dashboard', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const profile = await GamificationService.getProfile(userId);
    const portalUrl = process.env.PORTAL_URL || EMAIL_CONFIG.WEBSITE_URL;

    // Count shares this month
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sharesSnapshot = await db.collection('sharing_events')
      .where('volunteerId', '==', userId)
      .where('timestamp', '>=', thirtyDaysAgo)
      .get();

    const referralsSnapshot = await db.collection('referrals')
      .where('referrerId', '==', userId)
      .get();

    res.json({
      referralCode: profile.referralCode,
      referralLink: `${portalUrl}/join?ref=${profile.referralCode}`,
      totalReferrals: profile.referralCount || 0,
      activeReferrals: referralsSnapshot.size,
      sharesThisMonth: sharesSnapshot.size,
      estimatedImpact: (referralsSnapshot.size * 5) || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SOCIAL SHARING ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Get social share content
app.get('/api/share/content/:platform', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const platform = req.params.platform as 'instagram' | 'linkedin' | 'youtube';

    if (!SOCIAL_TEMPLATES[platform]) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    const profile = await GamificationService.getProfile(userId);
    const volunteer = await db.collection('volunteers').doc(userId).get();
    const volData = volunteer.data();
    const portalUrl = process.env.PORTAL_URL || EMAIL_CONFIG.WEBSITE_URL;

    let content = SOCIAL_TEMPLATES[platform]
      .replace(/\[HOURS\]/g, String(volData?.hoursContributed || 0))
      .replace(/\[ROLE\]/g, volData?.role || 'Volunteer')
      .replace(/\[PEOPLE_HELPED\]/g, String((volData?.hoursContributed || 0) * 5))
      .replace(/\[VOLUNTEER_LINK\]/g, `${portalUrl}/join?ref=${profile.referralCode}`)
      .replace(/\[DONATION_LINK\]/g, 'https://healthmatters.clinic/donate')
      .replace(/\[ORG_WEBSITE\]/g, 'https://healthmatters.clinic');

    res.json({ platform, content, referralCode: profile.referralCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Log social share (for XP tracking)
app.post('/api/share/log', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.profile.id;
    const { platform } = req.body;

    if (!['instagram', 'linkedin', 'youtube', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    const profile = await GamificationService.getProfile(userId);

    await db.collection('sharing_events').add({
      volunteerId: userId,
      channel: platform,
      timestamp: new Date(),
      referralCode: profile.referralCode,
    });

    const result = await GamificationService.addXP(userId, 'shared', XP_CONFIG.SOCIAL_SHARE, { shareType: platform });

    res.json({
      success: true,
      xpEarned: XP_CONFIG.SOCIAL_SHARE,
      newXP: result.newXP,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// XP Leaderboard
app.get('/api/leaderboard/xp', verifyToken, async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('volunteer_profiles')
      .orderBy('currentXP', 'desc')
      .limit(50)
      .get();

    const leaderboard = await Promise.all(
      snapshot.docs.map(async (doc, index) => {
        const volunteer = await db.collection('volunteers').doc(doc.id).get();
        const volData = volunteer.data();
        return {
          rank: index + 1,
          volunteerId: doc.id,
          name: volData?.name || volData?.firstName || 'Volunteer',
          xp: doc.data().currentXP || 0,
          level: doc.data().level || 1,
          hoursWorked: volData?.hoursContributed || 0,
        };
      })
    );

    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Referral Leaderboard
app.get('/api/leaderboard/referrals', verifyToken, async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('volunteer_profiles')
      .orderBy('referralCount', 'desc')
      .limit(50)
      .get();

    const leaderboard = await Promise.all(
      snapshot.docs.map(async (doc, index) => {
        const volunteer = await db.collection('volunteers').doc(doc.id).get();
        const volData = volunteer.data();
        return {
          rank: index + 1,
          volunteerId: doc.id,
          name: volData?.name || volData?.firstName || 'Volunteer',
          referrals: doc.data().referralCount || 0,
          impact: (doc.data().referralCount || 0) * 5,
        };
      })
    );

    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Streak Leaderboard (weekly committed only)
app.get('/api/leaderboard/streaks', verifyToken, async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('volunteer_profiles')
      .where('volunteerType', '==', 'weekly_committed')
      .orderBy('streakDays', 'desc')
      .limit(50)
      .get();

    const leaderboard = await Promise.all(
      snapshot.docs.map(async (doc, index) => {
        const volunteer = await db.collection('volunteers').doc(doc.id).get();
        const volData = volunteer.data();
        return {
          rank: index + 1,
          volunteerId: doc.id,
          name: volData?.name || volData?.firstName || 'Volunteer',
          streakDays: doc.data().streakDays || 0,
        };
      })
    );

    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// BOARD GOVERNANCE API ENDPOINTS
// =============================================

// Get all board meetings
app.get('/api/board/meetings', verifyToken, async (req: Request, res: Response) => {
  try {
    const meetingsSnap = await db.collection('board_meetings').orderBy('date', 'asc').get();
    const meetings = meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(meetings);
  } catch (e) { res.json([]); }
});

// Create/update board meeting (admin/board chair only)
app.post('/api/board/meetings', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !BOARD_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Only admins and board members can manage board meetings' });
    }
    const { id, ...meetingData } = req.body;
    if (id) {
      await db.collection('board_meetings').doc(id).set(meetingData, { merge: true });
      res.json({ id, ...meetingData });
    } else {
      const ref = await db.collection('board_meetings').add({ ...meetingData, createdBy: user.uid, createdAt: new Date().toISOString() });
      res.json({ id: ref.id, ...meetingData });
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// RSVP to a board meeting
app.post('/api/board/meetings/:meetingId/rsvp', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    const { status } = req.body;
    const meetingRef = db.collection('board_meetings').doc(req.params.meetingId);
    const meetingSnap = await meetingRef.get();
    if (!meetingSnap.exists) return res.status(404).json({ error: 'Meeting not found' });
    const meeting = meetingSnap.data()!;
    const rsvps = meeting.rsvps || [];
    const existingIdx = rsvps.findIndex((r: any) => r.odId === user.uid);
    const rsvpEntry = { odId: user.uid, odName: userData?.name || userData?.legalFirstName || 'Unknown', status, respondedAt: new Date().toISOString() };
    if (existingIdx >= 0) rsvps[existingIdx] = rsvpEntry;
    else rsvps.push(rsvpEntry);
    await meetingRef.update({ rsvps });
    res.json({ success: true, rsvps });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Request emergency meeting (emails board chair + volunteer@healthmatters.clinic)
app.post('/api/board/emergency-meeting', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    const { reason } = req.body;
    await db.collection('board_meetings').add({
      title: 'Emergency Meeting Request',
      type: 'emergency',
      status: 'pending_approval',
      reason,
      requestedBy: user.uid,
      requestedByName: userData?.name || 'Board Member',
      createdAt: new Date().toISOString(),
      rsvps: [],
    });
    if (EMAIL_SERVICE_URL) {
      try {
        await fetch(EMAIL_SERVICE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'emergency_board_meeting',
            toEmail: 'volunteer@healthmatters.clinic',
            subject: `Emergency Board Meeting Requested by ${userData?.name || 'Board Member'}`,
            requestedBy: userData?.name,
            reason,
          })
        });
      } catch {}
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Save/update meeting minutes (board members + admins only)
app.put('/api/board/meetings/:meetingId/minutes', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !BOARD_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Only admins and board members can edit meeting minutes' });
    }
    const { minutesContent, minutesStatus } = req.body;
    await db.collection('board_meetings').doc(req.params.meetingId).update({ minutesContent, minutesStatus, minutesUpdatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get Give or Get data for current user
app.get('/api/board/give-or-get', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const docSnap = await db.collection('board_give_or_get').doc(user.uid).get();
    if (!docSnap.exists) {
      const defaults = { goal: 0, raised: 0, personalContribution: 0, fundraised: 0, prospects: [], donationLog: [] };
      await db.collection('board_give_or_get').doc(user.uid).set(defaults);
      res.json(defaults);
    } else {
      res.json(docSnap.data());
    }
  } catch (e) { res.json({ goal: 0, raised: 0, personalContribution: 0, fundraised: 0, prospects: [], donationLog: [] }); }
});

// Update Give or Get data
app.put('/api/board/give-or-get', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await db.collection('board_give_or_get').doc(user.uid).set(req.body, { merge: true });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Save form signature
app.post('/api/board/forms/:formId/sign', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { signatureData } = req.body;
    await db.collection('board_form_signatures').doc(`${user.uid}_${req.params.formId}`).set({
      volunteerId: user.uid,
      formId: req.params.formId,
      signatureData,
      signedAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Get signed forms for current user
app.get('/api/board/forms/signed', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const snap = await db.collection('board_form_signatures').where('volunteerId', '==', user.uid).get();
    const signed: Record<string, string> = {};
    snap.docs.forEach(d => { const data = d.data(); signed[data.formId] = data.signedAt; });
    res.json(signed);
  } catch (e) { res.json({}); }
});

// --- SERVE FRONTEND & INJECT RUNTIME CONFIG ---
const buildPath = path.resolve(process.cwd(), 'dist/client'); 
app.use(express.static(buildPath, { index: false }));

app.get('*', (req: Request, res: Response) => {
    const indexPath = path.join(buildPath, 'index.html');
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('[SERVER] Error reading index.html:', err);
            return res.status(500).send('Error loading application.');
        }

        // Robustly find environment variables, checking common naming conventions.
        const envConfig = {
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
            RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY || process.env.VITE_RECAPTCHA_SITE_KEY || process.env.REACT_APP_RECAPTCHA_SITE_KEY || ''
        };
        
        console.log(`[SERVER] Injecting runtime config. Google Auth: ${envConfig.GOOGLE_CLIENT_ID ? '✓' : '✗'}, Recaptcha: ${envConfig.RECAPTCHA_SITE_KEY ? '✓' : '✗'}`);
        
        const injectedHtml = htmlData.replace(
            '<!--__ENV_CONFIG__-->',
            `<script>window.env = ${JSON.stringify(envConfig)};</script>`
        );

        res.send(injectedHtml);
    });
});

// --- ADMIN SETUP ENDPOINT (One-time setup) ---
app.post('/api/admin/setup', rateLimit(3, 3600000), async (req: Request, res: Response) => {
  const { email, setupKey } = req.body;

  // SECURITY: Setup key MUST be configured in environment - no default fallback
  const validSetupKey = process.env.ADMIN_SETUP_KEY;
  if (!validSetupKey) {
    console.error('[SECURITY] ADMIN_SETUP_KEY not configured - setup endpoint disabled');
    return res.status(503).json({ error: 'Admin setup not configured. Contact system administrator.' });
  }

  if (!setupKey || setupKey !== validSetupKey) {
    console.warn(`[SECURITY] Invalid admin setup attempt for email: ${email ? maskEmail(email) : 'none'}`);
    return res.status(403).json({ error: 'Invalid setup key.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    // Find user by email
    const snapshot = await db.collection('volunteers')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'User not found. Please sign up first.' });
    }

    const doc = snapshot.docs[0];
    if (doc.data().isAdmin) {
      return res.json({ message: 'User is already an admin.', userId: doc.id });
    }

    await doc.ref.update({ isAdmin: true });
    console.log(`[ADMIN SETUP] Promoted ${maskEmail(email)} to admin via API`);
    res.json({ message: 'Successfully promoted to admin!', userId: doc.id });
  } catch (error) {
    console.error('[ADMIN SETUP] Failed:', error);
    res.status(500).json({ error: 'Failed to promote user.' });
  }
});

// =============================================
// ORG-WIDE CALENDAR API ENDPOINTS
// =============================================

// Unified calendar feed — merges org_calendar_events + board_meetings + opportunities
app.get('/api/org-calendar', verifyToken, async (req: Request, res: Response) => {
  try {
    const callerProfile = (req as any).user?.profile;
    const callerRole = callerProfile?.role || '';
    const isAdmin = callerProfile?.isAdmin === true;

    const [orgSnap, boardSnap, oppsSnap] = await Promise.all([
      db.collection('org_calendar_events').get(),
      db.collection('board_meetings').get(),
      db.collection('opportunities').get(),
    ]);

    // 1. Org calendar events (native) — filter by visibleTo
    const orgEvents = orgSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      source: 'org-calendar',
    })).filter((e: any) => {
      if (isAdmin) return true;
      if (!e.visibleTo || e.visibleTo.length === 0) return true;
      return e.visibleTo.includes(callerRole);
    });

    // 2. Board meetings → mapped to OrgCalendarEvent shape (board members + admins only)
    const boardEvents = (isAdmin || BOARD_ROLES.includes(callerRole)) ? boardSnap.docs.map(d => {
      const m = d.data();
      const meetingType = (m.type === 'committee' || m.type === 'cab') ? 'committee' : 'board';
      return {
        id: d.id,
        title: m.title || 'Board Meeting',
        description: m.agenda ? (Array.isArray(m.agenda) ? m.agenda.join(', ') : m.agenda) : undefined,
        date: m.date || '',
        startTime: m.time || '',
        type: meetingType,
        location: m.googleMeetLink ? 'Virtual' : undefined,
        meetLink: m.googleMeetLink || undefined,
        rsvps: m.rsvps || [],
        createdBy: m.createdBy,
        source: 'board-meeting',
      };
    }) : [];

    // 3. Opportunities → mapped to OrgCalendarEvent shape
    const oppEvents = oppsSnap.docs.map(d => {
      const o = d.data();
      return {
        id: d.id,
        title: o.title || 'Community Event',
        description: o.description || undefined,
        date: o.date ? (o.date.includes('T') ? o.date.split('T')[0] : o.date) : '',
        startTime: o.time || o.dateDisplay || '',
        type: 'community-event',
        location: o.serviceLocation || undefined,
        source: 'event-finder',
      };
    }).filter(e => e.date); // Only include events with valid dates

    // Merge and sort
    const all = [...orgEvents, ...boardEvents, ...oppEvents].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
    res.json(all);
  } catch (e: any) {
    console.error('[ORG-CALENDAR] GET failed:', e);
    res.json([]);
  }
});

// Create org calendar event (coordinator/admin only)
app.post('/api/org-calendar', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !ORG_CALENDAR_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Only admins, coordinators, and leads can create calendar events' });
    }
    const { title, date, startTime, endTime, type, location, meetLink, description, isRecurring, recurrenceNote, visibleTo } = req.body;
    const eventData = {
      title, date, startTime, endTime: endTime || null, type: type || 'other',
      location: location || null, meetLink: meetLink || null, description: description || null,
      isRecurring: isRecurring || false, recurrenceNote: recurrenceNote || null,
      visibleTo: visibleTo || null, rsvps: [],
      createdBy: user.uid, createdAt: new Date().toISOString(), source: 'org-calendar',
    };
    const ref = await db.collection('org_calendar_events').add(eventData);
    res.json({ id: ref.id, ...eventData });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update org calendar event
app.put('/api/org-calendar/:eventId', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !ORG_CALENDAR_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Only admins, coordinators, and leads can update calendar events' });
    }
    const { eventId } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.source;
    updates.updatedAt = new Date().toISOString();
    await db.collection('org_calendar_events').doc(eventId).update(updates);
    res.json({ id: eventId, ...updates });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete org calendar event (admin only)
app.delete('/api/org-calendar/:eventId', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin) {
      return res.status(403).json({ error: 'Only admins can delete calendar events' });
    }
    await db.collection('org_calendar_events').doc(req.params.eventId).delete();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// RSVP to an org calendar event (any authenticated user)
app.post('/api/org-calendar/:eventId/rsvp', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    const { status } = req.body;
    if (!['attending', 'tentative', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid RSVP status' });
    }

    // Check if this is an org-calendar event or a board meeting
    let docRef = db.collection('org_calendar_events').doc(req.params.eventId);
    let docSnap = await docRef.get();
    if (!docSnap.exists) {
      // Try board_meetings collection
      docRef = db.collection('board_meetings').doc(req.params.eventId);
      docSnap = await docRef.get();
    }
    if (!docSnap.exists) return res.status(404).json({ error: 'Event not found' });

    const eventData = docSnap.data()!;
    const rsvps = eventData.rsvps || [];
    const rsvpEntry = {
      odId: user.uid,
      odName: userData?.name || userData?.legalFirstName || 'Unknown',
      status,
      respondedAt: new Date().toISOString(),
    };
    const existingIdx = rsvps.findIndex((r: any) => r.odId === user.uid);
    if (existingIdx >= 0) rsvps[existingIdx] = rsvpEntry;
    else rsvps.push(rsvpEntry);

    await docRef.update({ rsvps });
    res.json({ success: true, rsvps });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- ADMIN BOOTSTRAP ---
const bootstrapAdmin = async () => {
  // Support multiple admin emails (comma-separated or single)
  const adminEmailsEnv = process.env.INITIAL_ADMIN_EMAIL || '';
  const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  // Always include these core admins
  const coreAdmins = ['admin@healthmatters.clinic', 'erica@healthmatters.clinic'];
  const allAdminEmails = [...new Set([...adminEmails, ...coreAdmins])];

  if (allAdminEmails.length === 0) return;

  console.log(`[BOOTSTRAP] Checking admin bootstrap for: ${allAdminEmails.join(', ')}`);

  for (const adminEmail of allAdminEmails) {
    try {
      // Find user by email in volunteers collection
      const snapshot = await db.collection('volunteers')
        .where('email', '==', adminEmail.toLowerCase())
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        if (!doc.data().isAdmin) {
          await doc.ref.update({ isAdmin: true });
          console.log(`[BOOTSTRAP] Promoted ${adminEmail} to admin`);
        } else {
          console.log(`[BOOTSTRAP] ${adminEmail} is already admin`);
        }
      } else {
        // Create placeholder for future signup
        console.log(`[BOOTSTRAP] Admin user ${adminEmail} not found. Will be promoted on signup.`);
        await db.collection('admin_bootstrap').doc(adminEmail.replace(/[^a-zA-Z0-9]/g, '_')).set({
          email: adminEmail.toLowerCase(),
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(`[BOOTSTRAP] Admin bootstrap failed for ${adminEmail}:`, error);
    }
  }
};

// Call bootstrap during startup
bootstrapAdmin();

const server = app.listen(PORT, () => {
    console.log(`[SERVER] Server listening on port ${PORT}`);
    console.log("[SERVER] Mode: PRODUCTION");
});

// --- GRACEFUL SHUTDOWN (Cloud Run requirement) ---
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 30 seconds if connections don't close
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});


import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import admin from 'firebase-admin';
import twilio from 'twilio';
import cron from 'node-cron';
import helmet from 'helmet';
import { GoogleGenerativeAI } from "@google/generative-ai";
import process from 'process';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import Papa from 'papaparse';
import { STATIC_MODULE_CONTENT } from './staticModuleContent';
import { COORDINATOR_AND_LEAD_ROLES, GOVERNANCE_ROLES, EVENT_MANAGEMENT_ROLES, BROADCAST_ROLES, ORG_CALENDAR_ROLES, REGISTRATION_MANAGEMENT_ROLES, BOARD_FORM_CONTENTS, TIER_1_IDS, TIER_2_CORE_IDS, hasCompletedAllModules } from './constants';

// --- CONFIGURATION ---
dotenv.config();

// --- SSN ENCRYPTION (AES-256-GCM) ---
const SSN_KEY = process.env.SSN_ENCRYPTION_KEY || '';
function encryptSSN(ssn: string): string {
    if (!SSN_KEY || !ssn) return ssn;
    const key = crypto.createHash('sha256').update(SSN_KEY).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(ssn, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${tag}:${encrypted}`;
}
function decryptSSN(encrypted: string): string {
    if (!SSN_KEY || !encrypted || !encrypted.startsWith('enc:')) return encrypted;
    const [, ivHex, tagHex, data] = encrypted.split(':');
    const key = crypto.createHash('sha256').update(SSN_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// --- FIREBASE ADMIN SDK ---
// Each method is tried independently so a failure in one doesn't block the fallback
let firebaseConfigured = false;

// Method 1: Service account JSON file path
if (!firebaseConfigured && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseConfigured = true;
    console.log("✅ Firebase Admin SDK initialized with service account file.");
  } catch (e) {
    console.warn("⚠️ Method 1 (service account file) failed:", (e as Error).message);
  }
}

// Method 2: Service account JSON as environment variable
if (!firebaseConfigured && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseConfigured = true;
    console.log("✅ Firebase Admin SDK initialized with service account from env.");
  } catch (e) {
    console.warn("⚠️ Method 2 (service account env var) failed:", (e as Error).message);
  }
}

// Method 3: Application default credentials (GCP/Cloud Run)
if (!firebaseConfigured && (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG)) {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    firebaseConfigured = true;
    console.log("✅ Firebase Admin SDK initialized with application default credentials.");
  } catch (e) {
    console.warn("⚠️ Method 3 (application default credentials) failed:", (e as Error).message);
  }
}

// Method 4: Default initialization (works on GCP where metadata server provides credentials)
if (!firebaseConfigured) {
  try {
    admin.initializeApp();
    firebaseConfigured = true;
    console.log("✅ Firebase Admin SDK initialized with default settings.");
  } catch (e) {
    console.error("❌ Firebase Admin SDK initialization failed — all methods exhausted:", (e as Error).message);
  }
}
const db = admin.firestore();
const auth = admin.auth();

// --- CLOUD STORAGE ---
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ||
  (admin.app().options.projectId ? `${admin.app().options.projectId}.appspot.com` : '');
let bucket: any = null;
try {
  if (storageBucket) {
    bucket = admin.storage().bucket(storageBucket);
    console.log(`✅ Cloud Storage initialized: ${storageBucket}`);
  } else {
    console.warn('⚠️ FIREBASE_STORAGE_BUCKET not set — file uploads will be disabled');
  }
} catch (e) {
  console.error('❌ Cloud Storage initialization failed:', e);
}

async function uploadToStorage(base64Data: string, filePath: string, contentType: string): Promise<string> {
  if (!bucket) throw new Error('Cloud Storage not configured');
  const buffer = Buffer.from(base64Data, 'base64');
  const file = bucket.file(filePath);
  await file.save(buffer, { metadata: { contentType }, resumable: false });
  return filePath;
}

async function downloadFileBuffer(filePath: string): Promise<{ buffer: Buffer; metadata: any }> {
  if (!bucket) throw new Error('Cloud Storage not configured');
  const file = bucket.file(filePath);
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  return { buffer, metadata };
}

// Legacy helper — tries signed URL first, falls back to error
async function getSignedDownloadUrl(filePath: string, expiresMinutes = 60): Promise<string> {
  if (!bucket) throw new Error('Cloud Storage not configured');
  const file = bucket.file(filePath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresMinutes * 60 * 1000,
  });
  return url;
}

// --- TWILIO ---
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_MESSAGING_SERVICE_SID } = process.env;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
if (!FIREBASE_WEB_API_KEY) {
    console.error('[CRITICAL] FIREBASE_WEB_API_KEY is not set — email/password login will not work. Set it from Firebase Console → Project Settings → General → Web API Key.');
} else {
    const keySource = process.env.FIREBASE_WEB_API_KEY ? 'FIREBASE_WEB_API_KEY' : 'VITE_FIREBASE_API_KEY (fallback)';
    console.log(`[AUTH] Using API key from ${keySource}`);
}
const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;
if (twilioClient) {
  console.log(`✅ Twilio SMS configured${TWILIO_MESSAGING_SERVICE_SID ? ' with Messaging Service SID' : TWILIO_PHONE_NUMBER ? ' with phone number' : ' (⚠️ no Messaging SID or phone number — SMS will not send)'}`);
} else {
  console.warn('⚠️  Twilio not configured — SMS features will be disabled');
}

// Twilio signature validation middleware (prevents spoofed webhook requests)
const validateTwilioSignature = (req: Request, res: Response, next: NextFunction) => {
  if (!TWILIO_AUTH_TOKEN) return res.sendStatus(403);
  const signature = req.headers['x-twilio-signature'] as string;
  const portalUrl = process.env.PORTAL_URL || `http://localhost:${process.env.PORT || 8080}`;
  const url = `${portalUrl}${req.originalUrl}`;
  const isValid = twilio.validateRequest(TWILIO_AUTH_TOKEN, signature || '', url, req.body || {});
  if (!isValid) {
    console.warn('[TWILIO] Invalid signature on webhook:', req.originalUrl);
    return res.sendStatus(403);
  }
  next();
};

// --- STARTUP ENV VALIDATION ---
const REQUIRED_ENV_WARNINGS: [string, string][] = [
  ['FIREBASE_WEB_API_KEY', 'Email/password login will not work'],
  ['EMAIL_SERVICE_URL', 'Emails will be disabled'],
  ['GOOGLE_CLIENT_ID', 'Google OAuth will not work'],
];
for (const [envVar, consequence] of REQUIRED_ENV_WARNINGS) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  ${envVar} not set — ${consequence}`);
  }
}
if (!firebaseConfigured) {
  console.error('❌ CRITICAL: Firebase not configured. Server will start but most features will fail.');
}

// --- GOOGLE APPS SCRIPT EMAIL SERVICE ---
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;

if (EMAIL_SERVICE_URL) {
  console.log("✅ Email configured via Google Apps Script");
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

// Gemini model — single constant so upgrades are one-line changes
const GEMINI_MODEL = 'gemini-2.5-flash';

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

// Periodic SSE cleanup — prune destroyed/finished connections every 60s
setInterval(() => {
  let pruned = 0;
  for (const [userId, clients] of sseClients) {
    for (const client of clients) {
      if (client.writableEnded || client.destroyed) {
        clients.delete(client);
        pruned++;
      }
    }
    if (clients.size === 0) sseClients.delete(userId);
  }
  if (pruned > 0) console.log(`[SSE] Pruned ${pruned} stale connection(s). Active users: ${sseClients.size}`);
}, 60000);

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
    if (ALLOWED_ORIGINS.includes(origin) || (origin.endsWith('.run.app') && origin.includes('hmc-volunteer-portal')) || origin.startsWith('http://localhost') || origin.includes('healthmatters.clinic') || origin.includes('teamhmc.github.io')) {
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
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// --- GEMINI TEST ENDPOINT — moved after middleware definitions, see below ---

// --- ANALYTICS ENDPOINT — moved after middleware definitions, see below ---
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

// P0 FIX: Field whitelisting — only allow specified fields from user input
const pickFields = <T extends Record<string, any>>(obj: T | undefined, fields: string[]): Partial<T> => {
  if (!obj || typeof obj !== 'object') return {};
  const result: any = {};
  for (const key of fields) {
    if (key in obj && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

// P0 FIX: Sanitize user input before embedding in AI prompts
const sanitizeForPrompt = (input: string, maxLen = 500): string => {
  if (!input || typeof input !== 'string') return '';
  return input
    .slice(0, maxLen)
    .replace(/[<>{}]/g, '')          // strip HTML/template chars
    .replace(/\r?\n/g, ' ')          // flatten newlines
    .replace(/\s+/g, ' ')            // collapse whitespace
    .trim();
};

// Firestore-backed rate limiter — works across Cloud Run instances
const rateLimit = (limit: number, timeframeMs: number) => async (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const key = `${ip}_${req.path}`.replace(/[\/\.#\$\[\]]/g, '_');
  const now = Date.now();
  try {
    const ref = db.collection('rate_limits').doc(key);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (!data || now > data.resetTime) {
        tx.set(ref, { count: 1, resetTime: now + timeframeMs });
        return { allowed: true };
      }
      if (data.count >= limit) {
        return { allowed: false };
      }
      tx.update(ref, { count: data.count + 1 });
      return { allowed: true };
    });
    if (!result.allowed) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    return next();
  } catch (err) {
    // If Firestore rate limit fails, allow the request (fail-open)
    console.warn('[RATE-LIMIT] Firestore check failed, allowing request:', (err as any)?.message);
    return next();
  }
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

// Editor authorization middleware - allows admins AND coordinator roles (for Doc Hub, etc.)
const COORDINATOR_ROLES = ['Events Lead', 'Events Coordinator', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Outreach & Engagement Lead', 'Volunteer Lead', 'Development Coordinator'];
const requireEditor = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const profile = user?.profile;
  if (profile?.isAdmin || COORDINATOR_ROLES.includes(profile?.role)) {
    return next();
  }
  console.warn(`[SECURITY] Non-editor attempted edit: ${maskEmail(profile?.email || 'unknown')} (role: ${profile?.role}) on ${req.path}`);
  return res.status(403).json({ error: 'Editor access required' });
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
  // Feature flag: check if Twilio is configured (prefer Messaging Service SID, fallback to phone number)
  if (!twilioClient || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER)) {
    console.log('[SMS] Twilio not configured, skipping SMS');
    return { sent: false, reason: 'not_configured' };
  }

  // Check user opt-out if userId provided (default: SMS enabled unless explicitly disabled)
  if (userId) {
    try {
      const userDoc = await db.collection('volunteers').doc(userId).get();
      const prefs = userDoc.data()?.notificationPrefs;
      // Only block if user explicitly set smsAlerts to false
      if (prefs?.smsAlerts === false) {
        console.log(`[SMS] Skipped - user ${userId} has opted out of SMS`);
        return { sent: false, reason: 'opted_out' };
      }
    } catch {
      return { sent: false, reason: 'user_lookup_failed' };
    }
  }

  try {
    const messageParams: { body: string; to: string; messagingServiceSid?: string; from?: string } = { body, to };
    if (TWILIO_MESSAGING_SERVICE_SID) {
      messageParams.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
    } else {
      messageParams.from = TWILIO_PHONE_NUMBER;
    }
    await twilioClient.messages.create(messageParams);
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
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'volunteer@healthmatters.clinic',
  TECH_EMAIL: process.env.TECH_EMAIL || 'tech@healthmatters.clinic',
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || 'admin@healthmatters.clinic,erica@healthmatters.clinic').split(',').map(e => e.trim()),
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
    subject: `You're Assigned: ${data.eventName || 'Upcoming Event'}`,
    html: `${emailHeader("You're Assigned to a Shift")}
      <p>Hi ${data.volunteerName || 'Volunteer'},</p>
      <p>Great news! You've been assigned to an upcoming shift:</p>
      <div style="background: #f9fafb; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.eventName || 'Upcoming Event'}</p>
        <p style="margin: 8px 0;"><strong>Date:</strong> ${data.eventDate || 'See event details'}</p>
        <p style="margin: 8px 0;"><strong>Time:</strong> ${data.eventTime || 'See event details'}</p>
        <p style="margin: 8px 0;"><strong>Location:</strong> ${data.location || 'See event details'}</p>
        ${data.duration ? `<p style="margin: 8px 0;"><strong>Duration:</strong> ${data.duration}</p>` : ''}
        ${data.role ? `<p style="margin: 8px 0;"><strong>Your Role:</strong> <span style="color: ${EMAIL_CONFIG.BRAND_COLOR}; font-weight: 600;">${data.role}</span></p>` : ''}
      </div>
      ${actionButton('Confirm Attendance', `${EMAIL_CONFIG.WEBSITE_URL}/shifts/confirm`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName || 'Volunteer'}, You're assigned to ${data.eventName || 'an event'} on ${data.eventDate || 'TBD'} at ${data.eventTime || 'TBD'}. Location: ${data.location || 'TBD'}.`
  }),

  // 6. Shift Reminder (24h)
  shift_reminder_24h: (data: EmailTemplateData) => ({
    subject: `Reminder: Your Shift Tomorrow${data.eventTime ? ' at ' + data.eventTime : ''}`,
    html: `${emailHeader('Your Shift is Tomorrow!')}
      <p>Hi ${data.volunteerName || 'Volunteer'},</p>
      <p>Just a friendly reminder—you have a shift <strong>tomorrow</strong>!</p>
      <div style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 12px; text-transform: uppercase;">Tomorrow${data.eventTime ? ' at' : ''}</p>
        ${data.eventTime ? `<p style="margin: 0 0 16px 0; font-size: 32px; font-weight: bold;">${data.eventTime}</p>` : ''}
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${data.eventName || 'Your Scheduled Event'}</p>
        <p style="margin: 0; opacity: 0.9;">${data.location || 'See event details for location'}</p>
      </div>
      <p><strong>Arrive 15 minutes early</strong> to get oriented.</p>
      ${actionButton('View Shift Details', `${EMAIL_CONFIG.WEBSITE_URL}/shifts/upcoming`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName || 'Volunteer'}, Reminder: ${data.eventName || 'Your event'} tomorrow${data.eventTime ? ' at ' + data.eventTime : ''}. ${data.location ? 'Location: ' + data.location + '. ' : ''}Arrive 15 min early.`
  }),

  // 6b. Post-Shift Thank You
  post_shift_thank_you: (data: EmailTemplateData) => ({
    subject: `Thank You for Volunteering at ${data.eventName || 'Our Event'}`,
    html: `${emailHeader('Thank You!')}
      <p>Hi ${data.volunteerName || 'Volunteer'},</p>
      <p>Thank you for volunteering at <strong>${data.eventName || 'our event'}</strong> yesterday! Your service made a real difference in our community.</p>
      <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #065f46;">Your impact matters</p>
        <p style="margin: 0; color: #047857;">Every hour you contribute helps improve health outcomes for the people in our community who need it most.</p>
      </div>
      <p>Your volunteer hours have been recorded and your dashboard has been updated.</p>
      ${actionButton('View Your Dashboard', `${EMAIL_CONFIG.WEBSITE_URL}/dashboard`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName || 'Volunteer'}, Thank you for volunteering at ${data.eventName || 'our event'} yesterday! Your service made a real difference.`
  }),

  // 6c. Post-Event Debrief
  post_event_debrief: (data: EmailTemplateData) => ({
    subject: `Mission Complete! Debrief Survey for ${data.eventName || 'Today\'s Event'}`,
    html: `${emailHeader('Mission Complete!')}
      <p>Hi ${data.volunteerName || 'Volunteer'},</p>
      <p>Thank you for volunteering at <strong>${data.eventName || 'today\'s event'}</strong> today! Your service made a real difference.</p>
      <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #065f46;">Before you check out...</p>
        <p style="margin: 0; color: #047857;">Please take 2 minutes to complete your debrief survey. Your feedback helps us improve every event.</p>
      </div>
      ${actionButton('Complete Debrief Survey', data.surveyUrl || `${EMAIL_CONFIG.WEBSITE_URL}?survey=volunteer-debrief`)}
      ${(data as any).nextEventTeaser ? `<div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e3a5f;">Your next mission is loading...</p>
        <p style="margin: 0; color: #1e40af;">${(data as any).nextEventTeaser.replace(/\n/g, '')}</p>
      </div>` : ''}
    ${emailFooter()}`,
    text: `Mission Complete, ${data.volunteerName || 'Volunteer'}! Thank you for volunteering at ${data.eventName || 'today\'s event'}. Please complete your debrief survey: ${data.surveyUrl || EMAIL_CONFIG.WEBSITE_URL + '?survey=volunteer-debrief'}`
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
  event_registration_confirmation: (data: EmailTemplateData) => {
    const isTraining = ['training', 'workshop'].includes((data.eventType || '').toLowerCase());
    const whatToBring = isTraining
      ? `<p><strong>What you'll need:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin: 8px 0;">A computer or mobile device with internet access</li>
        <li style="margin: 8px 0;">A quiet space to focus</li>
        <li style="margin: 8px 0;">Something to take notes with</li>
      </ul>`
      : `<p><strong>What to bring:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin: 8px 0;">Your HMC volunteer badge (if you have one)</li>
        <li style="margin: 8px 0;">Comfortable closed-toe shoes</li>
        <li style="margin: 8px 0;">Water bottle</li>
        <li style="margin: 8px 0;">A positive attitude!</li>
      </ul>`;
    return {
    subject: `You're Signed Up: ${data.eventTitle}`,
    html: `${emailHeader(isTraining ? 'Training Registration Confirmed' : 'Event Registration Confirmed')}
      <p>Hi ${data.volunteerName},</p>
      <p>You're registered for the following ${isTraining ? 'training' : 'event'}:</p>
      <div style="background: #f0f9ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
        <h3 style="margin: 0 0 12px 0; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.eventTitle}</h3>
        <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${data.eventDate}</p>
        ${isTraining ? '' : `<p style="margin: 0;"><strong>Location:</strong> ${data.eventLocation}</p>`}
      </div>
      ${whatToBring}
      <p style="color: #6b7280;">If you can no longer attend, please update your registration in the portal so another volunteer can take your spot.</p>
      ${actionButton('View My Schedule', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, You're registered for ${data.eventTitle} on ${data.eventDate}${isTraining ? '' : ` at ${data.eventLocation}`}. See you there!`
  }; },

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

  // @Mention Notification
  mention_notification: (data: EmailTemplateData) => ({
    subject: `${data.mentionedByName} mentioned you${data.context ? ` in ${data.context}` : ''}`,
    html: `${emailHeader('You Were Mentioned')}
      <p>Hi ${data.volunteerName},</p>
      <p><strong>${data.mentionedByName}</strong> mentioned you${data.context ? ` in <strong>${data.context}</strong>` : ''}:</p>
      <div style="background: #eef2ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
        <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.messagePreview}</p>
      </div>
      ${actionButton('View in Portal', EMAIL_CONFIG.WEBSITE_URL)}
    ${emailFooter()}`,
    text: `${data.mentionedByName} mentioned you${data.context ? ` in ${data.context}` : ''}: "${data.messagePreview}"`
  }),

  // ── Event Reminder Cadence Templates ──

  // Stage 2: 7-Day Reminder
  event_reminder_7day: (data: EmailTemplateData) => {
    const isTraining = ['training', 'workshop'].includes((data.eventType || '').toLowerCase());
    const whatToBring = isTraining
      ? `<p><strong>What you'll need:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin: 8px 0;">A computer or mobile device with internet access</li>
        <li style="margin: 8px 0;">A quiet space to focus</li>
      </ul>`
      : `<p><strong>What to bring:</strong></p>
      <ul style="margin: 16px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin: 8px 0;">Your HMC volunteer badge (if you have one)</li>
        <li style="margin: 8px 0;">Comfortable closed-toe shoes</li>
        <li style="margin: 8px 0;">Water bottle</li>
      </ul>`;
    return {
    subject: `One Week Until ${data.eventName}`,
    html: `${emailHeader('One Week to Go!')}
      <p>Hi ${data.volunteerName},</p>
      <p>Just a heads up — <strong>${data.eventName}</strong> is one week away!</p>
      <div style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 12px; text-transform: uppercase;">Coming Up</p>
        <p style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold;">${data.eventDate}</p>
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${data.eventName}</p>
        ${isTraining ? '' : `<p style="margin: 0; opacity: 0.9;">${data.location || 'TBD'}</p>`}
      </div>
      ${whatToBring}
      ${actionButton('View Event Details', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, ${data.eventName} is one week away on ${data.eventDate}${isTraining ? '' : ` at ${data.location || 'TBD'}`}. See you there!`
  }; },

  // Stage 3: 72-Hour Reminder
  event_reminder_72h: (data: EmailTemplateData) => ({
    subject: `3 Days Until ${data.eventName}`,
    html: `${emailHeader('3 Days Away!')}
      <p>Hi ${data.volunteerName},</p>
      <p><strong>${data.eventName}</strong> is just 3 days away!</p>
      <div style="background: #f0f9ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
        <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${data.eventDate}</p>
        <p style="margin: 0 0 8px 0;"><strong>Time:</strong> ${data.eventTime || 'See event details'}</p>
        <p style="margin: 0;"><strong>Location:</strong> ${data.location || 'TBD'}</p>
      </div>
      <p>If you have any questions or need to make changes, please contact your event coordinator.</p>
      ${actionButton('View My Schedule', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, ${data.eventName} is in 3 days on ${data.eventDate} at ${data.location || 'TBD'}. Contact your coordinator with any questions.`
  }),

  // Stage 4: 24-Hour Reminder
  event_reminder_24h: (data: EmailTemplateData) => ({
    subject: `Tomorrow: ${data.eventName}`,
    html: `${emailHeader('See You Tomorrow!')}
      <p>Hi ${data.volunteerName},</p>
      <p><strong>${data.eventName}</strong> is <strong>tomorrow</strong>!</p>
      <div style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 12px; text-transform: uppercase;">Tomorrow at</p>
        <p style="margin: 0 0 16px 0; font-size: 32px; font-weight: bold;">${data.eventTime || 'See event details'}</p>
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${data.eventName}</p>
        <p style="margin: 0; opacity: 0.9;">${data.location || 'TBD'}</p>
      </div>
      <p><strong>Check-in:</strong> Please arrive 15 minutes early and check in with your event coordinator.</p>
      ${actionButton('View Event Details', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, ${data.eventName} is tomorrow at ${data.eventTime || 'your scheduled time'}, ${data.location || 'TBD'}. Arrive 15 min early for check-in.`
  }),

  // ── SMO Workflow Templates ──

  smo_registration_open: (data: EmailTemplateData) => ({
    subject: `Street Medicine Outreach: Registration Open for ${data.eventDate}`,
    html: `${emailHeader('SMO Registration Open')}
      <p>Hi ${data.volunteerName},</p>
      <p>Registration is now open for the upcoming <strong>Street Medicine Outreach</strong>!</p>
      <div style="background: #f0fdf4; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0 0 8px 0;"><strong>Saturday Event:</strong> ${data.eventDate}</p>
        <p style="margin: 0 0 8px 0;"><strong>Thursday Training:</strong> ${data.trainingDate || 'TBD'}</p>
        <p style="margin: 0;"><strong>Requirement:</strong> You must attend Thursday training to keep your Saturday spot.</p>
      </div>
      <p>Spots are limited — register now to secure your place!</p>
      ${actionButton('Register Now', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, SMO registration is open for ${data.eventDate}. Thursday training on ${data.trainingDate || 'TBD'} is required. Register now!`
  }),

  smo_registration_confirmed: (data: EmailTemplateData) => ({
    subject: `SMO Registration Confirmed — Training Required ${data.trainingDate}`,
    html: `${emailHeader('SMO Registration Confirmed')}
      <p>Hi ${data.volunteerName},</p>
      <p>You're registered for <strong>Street Medicine Outreach</strong>!</p>
      <div style="background: #eff6ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
        <p style="margin: 0 0 8px 0;"><strong>Saturday Event:</strong> ${data.eventDate}</p>
        <p style="margin: 0 0 8px 0;"><strong>Thursday Training (REQUIRED):</strong> ${data.trainingDate}</p>
        ${data.googleMeetLink ? `<p style="margin: 0;"><strong>Training Link:</strong> <a href="${data.googleMeetLink}" style="color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.googleMeetLink}</a></p>` : ''}
      </div>
      <p style="color: #dc2626; font-weight: bold;">Important: If you miss Thursday training, your Saturday spot will be reassigned.</p>
      ${actionButton('View My Schedule', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, you're registered for SMO on ${data.eventDate}. Thursday training (${data.trainingDate}) is REQUIRED. Miss it and your spot will be reassigned.`
  }),

  smo_training_reminder: (data: EmailTemplateData) => ({
    subject: `Tomorrow: SMO Training — Required for Saturday`,
    html: `${emailHeader('SMO Training Tomorrow')}
      <p>Hi ${data.volunteerName},</p>
      <p>Your <strong>Street Medicine Outreach training</strong> is <strong>tomorrow</strong> (Thursday).</p>
      <div style="background: #fef3c7; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0 0 8px 0;"><strong>Training Date:</strong> ${data.trainingDate}</p>
        ${data.googleMeetLink ? `<p style="margin: 0;"><strong>Join Link:</strong> <a href="${data.googleMeetLink}" style="color: ${EMAIL_CONFIG.BRAND_COLOR}; font-weight: bold;">${data.googleMeetLink}</a></p>` : ''}
      </div>
      <p style="color: #dc2626;"><strong>Reminder:</strong> Attendance is mandatory to keep your Saturday event spot.</p>
      ${actionButton('View Event Details', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, SMO training is tomorrow (${data.trainingDate}). ${data.googleMeetLink ? 'Join: ' + data.googleMeetLink : ''} Attendance is mandatory for Saturday.`
  }),

  smo_removed_no_training: (data: EmailTemplateData) => ({
    subject: `SMO Saturday Spot Reassigned — Missed Thursday Training`,
    html: `${emailHeader('SMO Registration Update')}
      <p>Hi ${data.volunteerName},</p>
      <p>Unfortunately, since you did not attend the required Thursday training session, your spot for <strong>Saturday's Street Medicine Outreach (${data.eventDate})</strong> has been reassigned.</p>
      <p>We understand things come up! You're welcome to register for next month's outreach.</p>
      ${actionButton('View Upcoming Events', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, your Saturday SMO spot (${data.eventDate}) was reassigned because you missed Thursday training. Register for next month!`
  }),

  smo_waitlist_promoted: (data: EmailTemplateData) => ({
    subject: `You're In! SMO Spot Available for ${data.eventDate}`,
    html: `${emailHeader('SMO Spot Available!')}
      <p>Hi ${data.volunteerName},</p>
      <p>Great news — a spot opened up for <strong>Saturday's Street Medicine Outreach (${data.eventDate})</strong>!</p>
      <div style="background: #f0fdf4; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${data.eventDate}</p>
        <p style="margin: 0;"><strong>Location:</strong> ${data.location || 'See event details'}</p>
      </div>
      <p>You've been moved from the waitlist to the active roster. See you Saturday!</p>
      ${actionButton('View My Schedule', `${EMAIL_CONFIG.WEBSITE_URL}/missions`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, a spot opened up for Saturday SMO (${data.eventDate}). You've been moved from the waitlist. See you there!`
  }),

  // Birthday Recognition
  birthday_recognition: (data: EmailTemplateData) => ({
    subject: `Happy Birthday, ${data.volunteerName}! 🎂`,
    html: `${emailHeader('Happy Birthday!')}
      <p>Hi ${data.volunteerName},</p>
      <p>Everyone at <strong>Health Matters Clinic</strong> wants to wish you a wonderful birthday!</p>
      <div style="background: linear-gradient(135deg, #fdf2f8, #fce7f3); padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; font-size: 48px;">🎂</p>
        <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: bold; color: #1f2937;">Happy Birthday!</p>
        <p style="margin: 0; color: #6b7280;">We've added <strong>100 bonus XP</strong> to your profile to celebrate you.</p>
      </div>
      <p>Thank you for being part of our team and making a difference in the community.</p>
      ${actionButton('View My Profile', `${EMAIL_CONFIG.WEBSITE_URL}/profile`)}
    ${emailFooter()}`,
    text: `Happy Birthday, ${data.volunteerName}! We've added 100 bonus XP to your profile to celebrate. Thank you for being part of Health Matters Clinic!`
  }),

  // Compliance Expiry Warning
  compliance_expiry_warning: (data: EmailTemplateData) => ({
    subject: `Action Required: ${data.eventName} Expiring Soon`,
    html: `${emailHeader('Compliance Item Expiring')}
      <p>Hi ${data.volunteerName},</p>
      <p>This is a reminder that one of your compliance items is expiring soon:</p>
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">${data.eventName}</p>
        <p style="margin: 0; color: #6b7280;">Please contact your coordinator to renew before it expires.</p>
      </div>
      <p>Keeping your compliance up to date ensures you can continue volunteering without interruption.</p>
      ${actionButton('View Compliance Status', `${EMAIL_CONFIG.WEBSITE_URL}/profile`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, your ${data.eventName} is expiring soon. Please contact your coordinator to renew.`
  }),

  // New Opportunity Alert (w3)
  new_opportunity_alert: (data: EmailTemplateData) => ({
    subject: `New Volunteer Opportunity: ${data.eventName}`,
    html: `${emailHeader('New Opportunity Available!')}
      <p>Hi ${data.volunteerName},</p>
      <p>A new volunteer opportunity matching your role is available:</p>
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937; font-size: 16px;">${data.eventName}</p>
        <p style="margin: 0; color: #6b7280;">Date: ${data.eventDate || 'TBD'}</p>
      </div>
      <p>Log in to your dashboard to sign up before spots fill up!</p>
      ${actionButton('View Opportunity', `${EMAIL_CONFIG.WEBSITE_URL}/dashboard`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, new opportunity: ${data.eventName} on ${data.eventDate || 'TBD'}. Log in to sign up!`
  }),

  // Volunteer Deactivation Notice
  account_deactivated: (data: EmailTemplateData) => ({
    subject: 'Your Health Matters Clinic Account Has Been Deactivated',
    html: `${emailHeader('Account Status Update')}
      <p>Hi ${data.volunteerName},</p>
      <p>Your volunteer account has been deactivated. If you believe this is an error or would like to reactivate, please contact our team.</p>
      ${actionButton('Contact Support', `mailto:${EMAIL_CONFIG.SUPPORT_EMAIL}`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, your volunteer account has been deactivated. Contact ${EMAIL_CONFIG.SUPPORT_EMAIL} for assistance.`
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
      // Render server-side template to get subject + HTML body
      const templateFn = EmailTemplates[templateName];
      // Normalize data with safe defaults to prevent "undefined" in emails
      const safeData: EmailTemplateData = {
        ...data,
        volunteerName: data.volunteerName || 'Volunteer',
        eventName: data.eventName || 'Upcoming Event',
        eventTitle: data.eventTitle || data.eventName || 'Upcoming Event',
        eventDate: data.eventDate || 'See event details',
        eventTime: data.eventTime || 'See event details',
        location: data.location || 'See event details',
        eventLocation: data.eventLocation || data.location || 'See event details',
        reason: data.reason || 'No additional details provided',
        trainingName: data.trainingName || 'Training Module',
        trainingDate: data.trainingDate || 'See portal for details',
        completionDate: data.completionDate || 'today',
        appliedRole: data.appliedRole || 'Volunteer',
        approvedRole: data.approvedRole || 'Volunteer',
        coordinatorName: data.coordinatorName || 'Coordinator',
        rsvpName: data.rsvpName || 'Guest',
        rsvpEmail: data.rsvpEmail || '',
        subject: data.subject || 'Support Request',
        submitterName: data.submitterName || 'A user',
        submitterEmail: data.submitterEmail || '',
      };
      const rendered = templateFn(safeData);

      // Send pre-rendered HTML to Google Apps Script.
      // Use type='prerendered' to bypass Apps Script's own templates (which would
      // try to use data fields that are no longer sent) and force the fallback
      // path that uses our server-rendered subject/html directly.
      const response = await fetch(EMAIL_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'prerendered',
          toEmail: data.toEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
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
    const today = getPacificDate();
    const lastActivity = profile.lastActivityDate
      ? new Date(profile.lastActivityDate).toISOString().split('T')[0]
      : null;

    if (lastActivity === today) {
      return { streakDays: profile.streakDays, bonusXP: 0 };
    }

    const yesterdayStr = getPacificDate(-1);

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
        const expiresDate = session.expires.toDate();
        if (new Date() > expiresDate) {
            await db.collection('sessions').doc(sessionToken).delete();
            return res.status(403).json({ error: 'Unauthorized: Session expired.' });
        }

        // Sliding window: auto-extend session if < 30 min remaining
        const thirtyMinFromNow = new Date(Date.now() + 30 * 60 * 1000);
        if (expiresDate < thirtyMinFromNow) {
            const newExpires = new Date(Date.now() + 2 * 60 * 60 * 1000); // extend by 2 hours
            await db.collection('sessions').doc(sessionToken).update({ expires: newExpires });
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

// --- GEMINI TEST ENDPOINT (admin-only, placed after verifyToken definition) ---
app.get('/api/gemini/test', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  if (!ai) return res.json({ success: false, error: 'AI not configured' });
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const results: any[] = [];
  for (const modelName of modelsToTry) {
    try {
      const model = ai!.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say "works" and nothing else.');
      results.push({ model: modelName, success: true, response: result.response.text().trim() });
      break;
    } catch (error: any) { results.push({ model: modelName, success: false, error: error.message }); }
  }
  res.json({ workingModel: results.find(r => r.success)?.model || null, results });
});

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
// ROLE CONSTANTS — Imported from src/constants.ts (single source of truth)
// ═══════════════════════════════════════════════════════════════
// Re-exported locally for backward compat with BOARD_ROLES references:
const BOARD_ROLES = GOVERNANCE_ROLES;

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
        // Normalize email before duplicate check and storage
        user.email = user.email.toLowerCase().trim();

        // Check if email already exists
        const existingByEmail = await db.collection('volunteers')
            .where('email', '==', user.email)
            .limit(1)
            .get();

        if (!existingByEmail.empty) {
            return res.status(409).json({
                error: 'An account with this email already exists. Please log in instead.',
                existingAccount: true
            });
        }

        // Foundational role is always HMC Champion until admin approval
        user.role = 'HMC Champion';
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

        // Upload resume to Cloud Storage if provided
        if (resume?.data && bucket) {
          try {
            const ext = resume.name?.split('.').pop() || 'pdf';
            const storagePath = `resumes/${finalUserId}/resume.${ext}`;
            await uploadToStorage(resume.data, storagePath, resume.type || 'application/pdf');
            userDataToSave.resume = { name: resume.name, type: resume.type, storagePath, uploadedAt: new Date().toISOString() };
            console.log(`[SIGNUP] Resume uploaded to ${storagePath}`);
          } catch (uploadErr) {
            console.error('[SIGNUP] Resume upload failed:', uploadErr);
            // Still store metadata without storagePath
            userDataToSave.resume = { name: resume.name, type: resume.type };
          }
        } else if (resume) {
          userDataToSave.resume = { name: resume.name, type: resume.type };
        }

        // Default notification prefs — volunteers opt in during application/RSVP
        if (!userDataToSave.notificationPrefs) {
            userDataToSave.notificationPrefs = { emailAlerts: true, smsAlerts: true };
        }

        // Check if this email is in the admin bootstrap list
        const bootstrapDoc = await db.collection('admin_bootstrap').doc('pending').get();
        if (bootstrapDoc.exists && bootstrapDoc.data()?.email === user.email.toLowerCase()) {
            userDataToSave.isAdmin = true;
            await db.collection('admin_bootstrap').doc('pending').delete();
            console.log(`[BOOTSTRAP] Auto-promoted new signup ${maskEmail(user.email)} to admin`);
        }

        // Encrypt SSN before storing
        if (userDataToSave.ssn) {
            userDataToSave.ssn = encryptSSN(userDataToSave.ssn);
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

        // Notify ALL admins about new applicant (with dedup guard to prevent spam on retries)
        const freshDoc = await db.collection('volunteers').doc(finalUserId).get();
        if (!freshDoc.data()?._signupAlertSent) {
          for (const adminEmail of EMAIL_CONFIG.ADMIN_EMAILS) {
            try {
              await EmailService.send('admin_new_applicant', {
                toEmail: adminEmail,
                volunteerName: user.name || user.firstName || 'New Applicant',
                volunteerEmail: user.email,
                appliedRole: user.appliedRole || 'HMC Champion',
                applicationId: finalUserId.substring(0, 12).toUpperCase(),
              });
              console.log(`[SIGNUP] Sent admin notification to ${maskEmail(adminEmail)} for new applicant: ${maskEmail(user.email)}`);
            } catch (adminEmailErr) {
              console.error(`[SIGNUP] Failed to send admin notification to ${maskEmail(adminEmail)}:`, adminEmailErr);
            }
          }

          // Also create an in-app notification in Firestore as fallback
          try {
            await db.collection('admin_notifications').add({
              type: 'new_application',
              volunteerName: user.name || user.firstName || 'New Applicant',
              volunteerEmail: user.email,
              volunteerId: finalUserId,
              appliedRole: user.appliedRole || 'HMC Champion',
              status: 'unread',
              createdAt: new Date().toISOString(),
            });
          } catch (notifErr) {
            console.error('[SIGNUP] Failed to create in-app notification:', notifErr);
          }

          // Mark signup alerts as sent to prevent duplicate emails on retries
          await db.collection('volunteers').doc(finalUserId).update({ _signupAlertSent: true });
        }

        // Process referral if provided
        if (referralCode) {
          await GamificationService.convertReferral(referralCode, finalUserId);
        }

        await createSession(finalUserId, res);
    } catch (error) {
        console.error("Signup error:", error);
        res.status(400).json({ error: 'Signup failed. Please try again.' });
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
                 status: 'applicant',
                 // NOTE: applicationStatus is intentionally NOT set here.
                 // It gets set to 'pendingReview' when the user completes the
                 // onboarding form. Setting it prematurely causes needsOnboarding
                 // check in App.tsx to skip onboarding → blank applications.
                 isNewUser: true,
                 joinedDate: new Date().toISOString(),
                 onboardingProgress: 0,
                 hoursContributed: 0,
                 points: 0,
                 isAdmin: shouldBeAdmin,
                 notificationPrefs: { emailAlerts: true, smsAlerts: true },
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

             // Send welcome email (admin notifications deferred until application completion in PUT /api/volunteer)
             try {
               await EmailService.send('welcome_volunteer', {
                 toEmail: googleUser.email,
                 volunteerName: googleUser.name || 'Volunteer',
                 appliedRole: 'HMC Champion',
               });
             } catch (welcomeErr) {
               console.error(`[GOOGLE-AUTH] Failed to send welcome email:`, welcomeErr);
             }

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
    if (sessionToken) {
      try { await db.collection('sessions').doc(sessionToken).delete(); } catch (error) {
        console.error('[Logout] Failed to delete session:', error);
      }
    }
    res.status(204).send();
});

// Explicit session refresh endpoint (called by frontend heartbeat)
app.post('/api/auth/refresh-session', verifyToken, async (req: Request, res: Response) => {
    try {
        const sessionToken = req.headers.authorization?.split('Bearer ')[1];
        if (!sessionToken) return res.status(403).json({ error: 'No session token' });
        const newExpires = new Date(Date.now() + 2 * 60 * 60 * 1000); // extend by 2 hours
        await db.collection('sessions').doc(sessionToken).update({ expires: newExpires });
        res.json({ success: true, expiresAt: newExpires.toISOString() });
    } catch (error) {
        console.error('[Session Refresh] Failed:', error);
        res.status(500).json({ error: 'Failed to refresh session' });
    }
});

app.post('/auth/decode-google-token', rateLimit(10, 60000), async (req: Request, res: Response) => {
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
                db.collection('messages').where('senderId', '==', userId).get(),
                db.collection('messages').where('recipientId', '==', userId).get(),
                db.collection('messages').where('recipientId', '==', 'general').get(),
            ]);
            // Dedupe and sort messages
            const messagesMap = new Map();
            [...sentMsgs.docs, ...receivedMsgs.docs, ...generalMsgs.docs].forEach(doc => {
                messagesMap.set(doc.id, { id: doc.id, ...doc.data() });
            });
            messages = Array.from(messagesMap.values());
            messages.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            messages = messages.slice(0, 200);
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
            // Decrypt SSN for admin users, strip it for non-admins
            if (data.ssn && userProfile.isAdmin) {
                data.ssn = decryptSSN(data.ssn);
            } else {
                delete data.ssn;
            }
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

        // Auto-fix stale isNewUser flag for users who actually completed onboarding
        // (must have real application data like legalFirstName, not just applicationStatus
        //  which was previously set prematurely in the Google login skeleton doc)
        if (userProfile.isNewUser && userProfile.legalFirstName && userProfile.onboardingProgress === 100) {
            userProfile.isNewUser = false;
            db.collection('volunteers').doc(userId).update({ isNewUser: false }).catch(() => {});
        }

        // Auto-fix: skeleton docs created with premature applicationStatus but no real data
        // Clear applicationStatus so the needsOnboarding check routes them to onboarding
        if (userProfile.isNewUser && userProfile.applicationStatus && !userProfile.legalFirstName) {
            delete userProfile.applicationStatus;
            db.collection('volunteers').doc(userId).update({
                applicationStatus: admin.firestore.FieldValue.delete()
            }).catch(() => {});
        }

        // Auto-fix missing status field for volunteers who completed onboarding
        // (affected by a prior bug where the PUT whitelist stripped the status field)
        if (!userProfile.status && userProfile.applicationStatus) {
            userProfile.status = 'active';
            db.collection('volunteers').doc(userId).update({ status: 'active' }).catch(() => {});
        }

        // Auto-fix completedHIPAATraining flag if user completed the HIPAA module
        // but the flag wasn't set (e.g. completed before flag existed, or field was stripped)
        const completedIds: string[] = userProfile.completedTrainingIds || [];
        if (!userProfile.completedHIPAATraining && (completedIds.includes('hipaa_nonclinical') || completedIds.includes('hipaa_staff_2025'))) {
            userProfile.completedHIPAATraining = true;
            db.collection('volunteers').doc(userId).update({ completedHIPAATraining: true }).catch(() => {});
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
// Rate limit all Gemini AI endpoints (10 requests per minute per IP)
const aiRateLimit = rateLimit(10, 60000);
app.use('/api/gemini', aiRateLimit);

// No verifyToken — this endpoint is used during onboarding before the user has an account.
// Rate-limited by aiRateLimit (10 req/min per IP) applied via app.use('/api/gemini', aiRateLimit).
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

        // Validate supported MIME types for Gemini inline data
        const supportedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain'];
        if (!supportedMimeTypes.includes(mimeType)) {
            console.warn(`[GEMINI] Unsupported MIME type for resume analysis: ${mimeType}`);
            return res.json({
                recommendations: [],
                extractedSkills: [],
                error: `Unsupported file format (${mimeType}). Please upload a PDF file instead.`
            });
        }

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

        const text = await generateAIContent(GEMINI_MODEL, [
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

app.post('/api/gemini/generate-plan', verifyToken, async (req: Request, res: Response) => {
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

        const text = await generateAIContent(GEMINI_MODEL, prompt, true);

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

app.post('/api/gemini/generate-quiz', verifyToken, async (req: Request, res: Response) => {
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

        const text = await generateAIContent(GEMINI_MODEL,
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

app.post('/api/gemini/generate-module-content', verifyToken, async (req: Request, res: Response) => {
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

        const text = await generateAIContent(GEMINI_MODEL,
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

app.post('/api/gemini/validate-answer', verifyToken, async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ isCorrect: true });
        const { question, answer } = req.body;

        // Be very lenient - if answer is at least 10 chars and shows effort, accept it
        if (answer && answer.trim().length >= 10) {
            const text = await generateAIContent(GEMINI_MODEL,
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

app.post('/api/gemini/find-referral-match', verifyToken, async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ recommendations: [] });
        const clientNeed = sanitizeForPrompt(req.body.clientNeed);
        if (!clientNeed) return res.status(400).json({ error: 'clientNeed is required' });
        const text = await generateAIContent(GEMINI_MODEL,
            `Suggest 3 generic types of resources for: "${clientNeed}". JSON: { recommendations: [{ "Resource Name": "Example", "reasoning": "Fits need" }] }`,
            true);
        res.send(text);
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/generate-supply-list', verifyToken, async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ supplyList: "- Water\n- Pens" });
        const serviceNames = (req.body.serviceNames || []).map((s: string) => sanitizeForPrompt(s, 100));
        const attendeeCount = Math.min(Math.max(parseInt(req.body.attendeeCount) || 50, 1), 10000);
        const text = await generateAIContent(GEMINI_MODEL,
            `Generate a checklist of supplies for a health fair with ${attendeeCount} attendees offering: ${serviceNames.join(', ')}. Plain text list.`);
        res.json({ supplyList: text });
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/generate-summary', verifyToken, async (req: Request, res: Response) => {
    if (!ai) return res.json({ summary: "Thank you for your service!" });
    try {
        const volunteerName = sanitizeForPrompt(req.body.volunteerName, 100);
        const totalHours = Math.min(Math.max(parseFloat(req.body.totalHours) || 0, 0), 99999);
        const text = await generateAIContent(GEMINI_MODEL,
            `Write a 2 sentence impact summary for ${volunteerName} who contributed ${totalHours} hours.`);
        res.json({ summary: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/draft-fundraising-email', verifyToken, async (req: Request, res: Response) => {
    if (!ai) return res.json({ emailBody: "Please support HMC!" });
    try {
        const volunteerName = sanitizeForPrompt(req.body.volunteerName, 100);
        const volunteerRole = sanitizeForPrompt(req.body.volunteerRole, 100);
        const text = await generateAIContent(GEMINI_MODEL,
            `Draft a short fundraising email for ${volunteerName}, a ${volunteerRole}, asking friends to support Health Matters Clinic.`);
        res.json({ emailBody: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/draft-social-post', verifyToken, async (req: Request, res: Response) => {
    if (!ai) return res.json({ postText: "#HealthMatters" });
    try {
        const topic = sanitizeForPrompt(req.body.topic, 200);
        const platform = sanitizeForPrompt(req.body.platform, 50);
        const text = await generateAIContent(GEMINI_MODEL,
            `Draft a ${platform} post about ${topic} for a nonprofit.`);
        res.json({ postText: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/summarize-feedback', verifyToken, async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ summary: "No feedback to summarize." });
        const feedback = (req.body.feedback || []).map((f: string) => sanitizeForPrompt(f, 300)).slice(0, 50);
        if (!feedback.length) return res.status(400).json({ error: 'feedback array is required' });
        const text = await generateAIContent(GEMINI_MODEL,
            `Summarize the following volunteer feedback into key themes and sentiment: ${feedback.join('\n')}`);
        res.json({ summary: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/generate-document', verifyToken, async (req: Request, res: Response) => {
    try {
        if (!ai) return res.status(503).json({ error: "AI not configured" });
        const prompt = sanitizeForPrompt(req.body.prompt, 1000);
        const title = sanitizeForPrompt(req.body.title || '', 200);
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        const text = await generateAIContent(GEMINI_MODEL,
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

app.post('/api/gemini/improve-document', verifyToken, async (req: Request, res: Response) => {
    try {
        if (!ai) return res.status(503).json({ error: "AI not configured" });
        const content = sanitizeForPrompt(req.body.content, 5000);
        const instructions = sanitizeForPrompt(req.body.instructions || 'Make it more professional and comprehensive', 500);
        if (!content) return res.status(400).json({ error: 'content is required' });
        const text = await generateAIContent(GEMINI_MODEL,
            `You are a professional editor for Health Matters Clinic documents.

            Improve the following document according to these instructions: "${instructions}"

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

app.post('/api/gemini/draft-announcement', verifyToken, async (req: Request, res: Response) => {
    try {
        if (!ai) return res.status(503).json({ error: "AI not configured" });
        const topic = sanitizeForPrompt(req.body.topic, 300);
        if (!topic) return res.status(400).json({ error: 'topic is required' });
        const text = await generateAIContent(GEMINI_MODEL,
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
    try {
        const snap = await db.collection('referral_resources').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error: any) {
        console.error('[RESOURCES] Failed to fetch:', error);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
});
app.post('/api/resources/create', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const resource = req.body.resource;
        if (!resource || !resource.name) return res.status(400).json({ error: 'Resource name is required' });
        const ref = await db.collection('referral_resources').add(resource);
        res.json({ success: true, id: ref.id });
    } catch (error: any) {
        console.error('[RESOURCES] Failed to create:', error);
        res.status(500).json({ error: 'Failed to create resource' });
    }
});

// Bulk import resources from CSV (uses PapaParse for multi-line quoted field support)
const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB max CSV payload
const MAX_CSV_ROWS = 2000;

// Clean up UTF-8 encoding artifacts from CSV data (curly quotes, em-dashes, BOM, etc.)
function sanitizeCSVText(text: string): string {
    return text
        .replace(/\uFEFF/g, '')              // BOM
        .replace(/[\u2018\u2019\u201A]/g, "'")  // Curly single quotes → straight
        .replace(/[\u201C\u201D\u201E]/g, '"')  // Curly double quotes → straight
        .replace(/[\u2013\u2014]/g, '-')         // En/em dash → hyphen
        .replace(/\u2026/g, '...')               // Ellipsis → three dots
        .replace(/[\u00A0]/g, ' ')               // Non-breaking space → space
        .replace(/\u00AD/g, '')                  // Soft hyphen → remove
        .replace(/[\u200B-\u200D\uFEFF]/g, '');  // Zero-width chars → remove
}

// Map variant column names from different CSV formats to canonical field names
function normalizeResourceRow(row: Record<string, string>): Record<string, string> | null {
    const get = (...keys: string[]) => {
        for (const k of keys) {
            const val = row[k]?.trim();
            if (val) return sanitizeCSVText(val);
        }
        return '';
    };

    // Build Resource Name with fallback to Agency + Program
    let resourceName = get('Resource Name');
    if (!resourceName) {
        const agency = get('Agency', 'Agency / Lead Organization', 'Organization', 'Provider');
        const program = get('Program / Site', 'Team / Program Name', 'Program', 'Site Name');
        if (agency && program) resourceName = `${agency} - ${program}`;
        else if (agency) resourceName = agency;
        else if (program) resourceName = program;
    }
    if (!resourceName) return null; // Skip rows with no identifiable name

    // Build Address with fallback to City/State/Zip composition
    let address = get('Address', 'Street Address');
    if (!address) {
        const city = get('City');
        const state = get('State');
        const zip = get('Zip', 'Zip Code', 'ZIP');
        const parts = [city, state, zip].filter(Boolean);
        if (parts.length >= 2) address = parts.join(', ');
    }

    const normalized: Record<string, string> = {};
    normalized['Resource Name'] = resourceName;
    normalized['Service Category'] = get('Service Category', 'Category', 'Service Type');
    normalized['Contact Phone'] = get('Contact Phone', 'Phone Number', 'Phone', 'Contact Phone');
    normalized['Contact Email'] = get('Contact Email', 'Email');
    normalized['Address'] = address;
    normalized['SPA'] = get('SPA', 'Service Planning Area', 'Coverage Area');
    normalized['Key Offerings'] = get('Key Offerings', 'Description', 'Services Provided', 'Services');
    normalized['Operation Hours'] = get('Operation Hours', 'Hours of Operation', 'Operating Hours', 'Coverage Hours');
    normalized['Website'] = get('Website', 'URL');
    normalized['Target Population'] = get('Target Population', 'Population Served', 'Population Focus', 'Subcategory');
    normalized['Languages Spoken'] = get('Languages Spoken', 'Languages Available', 'Languages');
    normalized['Eligibility Criteria'] = get('Eligibility Criteria', 'Eligibility Requirements', 'Eligibility');
    normalized['Contact Person Name'] = get('Contact Person Name', 'Primary Contact Name');
    normalized['Intake / Referral Process Notes'] = get('Intake / Referral Process Notes', 'Intake / Referral Channel', 'Referral Process');

    // Pass through any other fields that don't need mapping
    const passThrough = [
        'Resource Type', 'Data type', 'Contact Info Notes',
        'SLA / Typical Response Time', 'Source',
        'Last Modified By', 'Active / Inactive', 'Active?', 'Date Added', 'Last Updated',
        'Partner Agency', 'Linked Clients', 'Notes'
    ];
    for (const key of passThrough) {
        if (row[key]?.trim()) normalized[key] = row[key].trim();
    }

    // Remove empty string values
    for (const key of Object.keys(normalized)) {
        if (!normalized[key]) delete normalized[key];
    }

    return normalized;
}

app.post('/api/resources/bulk-import', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { csvData } = req.body;
        if (!csvData || typeof csvData !== 'string') return res.status(400).json({ error: 'csvData is required' });
        if (csvData.length > MAX_CSV_SIZE) return res.status(400).json({ error: `CSV too large (max ${MAX_CSV_SIZE / 1024 / 1024}MB)` });
        const csvContent = Buffer.from(csvData, 'base64').toString('utf-8');

        // Use PapaParse to correctly handle multi-line quoted fields
        const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, dynamicTyping: false });
        if (parsed.errors.length > 0) console.warn('[RESOURCES] CSV parse warnings:', parsed.errors.slice(0, 5));
        const rows = parsed.data as Record<string, string>[];

        if (rows.length > MAX_CSV_ROWS) return res.status(400).json({ error: `Too many rows (max ${MAX_CSV_ROWS})` });

        // Fetch existing resources for de-duplication (by Resource Name + Address)
        const existingSnap = await db.collection('referral_resources').get();
        const existingMap = new Map<string, string>(); // key -> docId
        existingSnap.docs.forEach(d => {
            const data = d.data();
            const name = (data['Resource Name'] || '').toLowerCase().trim();
            const address = (data['Address'] || '').toLowerCase().trim();
            if (name) existingMap.set(`${name}|${address}`, d.id);
        });

        const importedResources: any[] = [];
        const updatedResources: any[] = [];
        const skippedResources: any[] = [];
        const seenInBatch = new Set<string>(); // Prevent intra-CSV duplicates

        // Firestore batch limit is 500 — use multiple batches
        const batches: FirebaseFirestore.WriteBatch[] = [db.batch()];
        let batchOpCount = 0;

        for (const row of rows) {
            const resource = normalizeResourceRow(row);
            if (!resource) continue;

            // Normalize Active/Inactive field (also check 'Active?' column from Community CSV)
            const activeVal = resource['Active / Inactive'] || resource['Active?'] || '';
            delete resource['Active?'];
            if (!activeVal || activeVal.toLowerCase() === 'yes') {
                resource['Active / Inactive'] = 'checked';
            } else {
                const val = activeVal.toLowerCase().trim();
                resource['Active / Inactive'] = (val === 'inactive' || val === 'unchecked' || val === 'no') ? 'unchecked' : 'checked';
            }

            // Add timestamps
            resource.updatedAt = new Date().toISOString();

            // De-duplicate: check by Resource Name + Address
            const dedupeKey = `${(resource['Resource Name'] || '').toLowerCase().trim()}|${(resource['Address'] || '').toLowerCase().trim()}`;

            if (seenInBatch.has(dedupeKey)) {
                skippedResources.push({ name: resource['Resource Name'], reason: 'Duplicate within CSV' });
                continue;
            }
            seenInBatch.add(dedupeKey);

            // Get current batch, create new one if at limit
            if (batchOpCount >= 499) {
                batches.push(db.batch());
                batchOpCount = 0;
            }
            const currentBatch = batches[batches.length - 1];

            const existingDocId = existingMap.get(dedupeKey);
            if (existingDocId) {
                const docRef = db.collection('referral_resources').doc(existingDocId);
                currentBatch.set(docRef, resource, { merge: true });
                updatedResources.push({ id: existingDocId, name: resource['Resource Name'] });
            } else {
                resource.createdAt = resource['Date Added'] || new Date().toISOString();
                const docRef = db.collection('referral_resources').doc();
                currentBatch.set(docRef, resource);
                importedResources.push({ id: docRef.id, ...resource });
            }
            batchOpCount++;
        }

        // Commit all batches
        for (const b of batches) {
            await b.commit();
        }
        console.log(`[RESOURCES] Bulk import: ${importedResources.length} new, ${updatedResources.length} updated, ${skippedResources.length} skipped`);
        res.json({
            success: true,
            importedCount: importedResources.length,
            updatedCount: updatedResources.length,
            skippedCount: skippedResources.length,
            skipped: skippedResources,
        });
    } catch (error: any) {
        console.error('[RESOURCES] Bulk import failed:', error);
        res.status(500).json({ error: 'Failed to import resources' });
    }
});

// Admin endpoint to clear all resources (for wiping bad import data)
app.delete('/api/resources/clear-all', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('referral_resources').get();
        if (snap.empty) return res.json({ success: true, deletedCount: 0 });

        // Firestore batch limit is 500 — delete in batches
        let deletedCount = 0;
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 499) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + 499);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deletedCount += chunk.length;
        }

        console.log(`[RESOURCES] Cleared all resources: ${deletedCount} deleted`);
        res.json({ success: true, deletedCount });
    } catch (error: any) {
        console.error('[RESOURCES] Clear all failed:', error);
        res.status(500).json({ error: 'Failed to clear resources' });
    }
});

app.get('/api/referrals', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('referrals').orderBy('createdAt', 'desc').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error: any) {
        console.error('[REFERRALS] Failed to fetch:', error);
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
});
app.post('/api/referrals/create', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const referral = req.body.referral;
        if (!referral || !referral.clientId) return res.status(400).json({ error: 'clientId required' });
        referral.createdAt = new Date().toISOString();
        referral.status = referral.status || 'pending';
        const ref = await db.collection('referrals').add(referral);
        res.json({ id: ref.id, ...referral });
    } catch (error: any) {
        console.error('[REFERRALS] Failed to create:', error);
        res.status(500).json({ error: 'Failed to create referral' });
    }
});
app.put('/api/referrals/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        if (!req.body.referral) return res.status(400).json({ error: 'Referral data required' });
        const doc = await db.collection('referrals').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Referral not found' });
        const referralUpdates = pickFields(req.body.referral, ['clientId', 'resourceId', 'status', 'notes', 'matchedDate', 'completedDate', 'rating', 'priority', 'assignedTo', 'outcome']);
        await db.collection('referrals').doc(req.params.id).update(referralUpdates);
        res.json({ id: req.params.id, ...referralUpdates });
    } catch (error: any) {
        console.error('[REFERRALS] Failed to update:', error);
        res.status(500).json({ error: 'Failed to update referral' });
    }
});

// --- REFERRAL FLAGS (Live Feed → Intake handoff) ---

// Create a referral flag
app.post('/api/referral-flags', verifyToken, async (req: Request, res: Response) => {
    try {
        const { clientId, clientName, screeningId, eventId, notes } = req.body;
        if (!clientId || !eventId) return res.status(400).json({ error: 'clientId and eventId are required' });
        const flag = {
            clientId,
            clientName: clientName || '',
            screeningId: screeningId || '',
            eventId,
            notes: notes || '',
            flaggedBy: (req as any).user.uid,
            flaggedByName: (req as any).user.profile?.name || 'Unknown',
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        const doc = await db.collection('referral_flags').add(flag);
        res.json({ id: doc.id, ...flag });
    } catch (error) {
        console.error('[REFERRAL-FLAGS] Failed to create:', error);
        res.status(500).json({ error: 'Failed to create referral flag' });
    }
});

// Get pending referral flags for an event
app.get('/api/referral-flags', verifyToken, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.query;
        if (!eventId) return res.status(400).json({ error: 'eventId is required' });
        // Single where clause — filter status in memory to avoid composite index
        const snap = await db.collection('referral_flags')
            .where('eventId', '==', String(eventId))
            .get();
        const flags = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((f: any) => f.status === 'pending');
        flags.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        res.json(flags);
    } catch (error) {
        console.error('[REFERRAL-FLAGS] Failed to fetch:', error);
        res.status(500).json({ error: 'Failed to fetch referral flags' });
    }
});

// Mark a referral flag as addressed
app.put('/api/referral-flags/:id', verifyToken, async (req: Request, res: Response) => {
    try {
        await db.collection('referral_flags').doc(req.params.id).update({
            status: 'addressed',
            addressedBy: (req as any).user.uid,
            addressedAt: new Date().toISOString(),
        });
        res.json({ id: req.params.id, status: 'addressed' });
    } catch (error) {
        console.error('[REFERRAL-FLAGS] Failed to update:', error);
        res.status(500).json({ error: 'Failed to update referral flag' });
    }
});

app.post('/api/clients/search', verifyToken, async (req: Request, res: Response) => {
    try {
        const { phone, email, name } = req.body;

        if (name) {
            // Name-based search: query all clients and filter by first/last name match
            const snap = await db.collection('clients').get();
            const nameLower = (name as string).toLowerCase().trim();
            const matches = snap.docs.filter(d => {
                const data = d.data();
                const fullName = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase().trim();
                const first = (data.firstName || '').toLowerCase();
                const last = (data.lastName || '').toLowerCase();
                return fullName.includes(nameLower) || first.includes(nameLower) || last.includes(nameLower);
            }).map(d => ({ id: d.id, ...d.data() }));

            if (matches.length === 0) return res.status(404).json({ error: 'Not found' });
            if (matches.length === 1) return res.json(matches[0]);
            // Return multiple matches for name search
            return res.json({ multiple: true, results: matches.slice(0, 10) });
        }

        // Normalize phone/email search for flexible matching
        if (phone) {
            const phoneDigits = (phone as string).replace(/\D/g, '');
            const snap = await db.collection('clients').get();
            const match = snap.docs.find(d => {
                const stored = (d.data().phone || '').replace(/\D/g, '');
                return stored && stored === phoneDigits;
            });
            if (!match) return res.status(404).json({ error: "Not found" });
            return res.json({ id: match.id, ...match.data() });
        } else if (email) {
            const emailLower = (email as string).toLowerCase().trim();
            const snap = await db.collection('clients').get();
            const match = snap.docs.find(d => {
                const stored = (d.data().email || '').toLowerCase().trim();
                return stored && stored === emailLower;
            });
            if (!match) return res.status(404).json({ error: "Not found" });
            return res.json({ id: match.id, ...match.data() });
        }

        return res.status(400).json({ error: "Phone or email required" });
    } catch (error: any) {
        console.error('[CLIENTS] Search failed:', error);
        res.status(500).json({ error: 'Client search failed' });
    }
});
app.post('/api/clients/create', verifyToken, async (req: Request, res: Response) => {
    try {
        const clientData = pickFields(req.body.client, ['name', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'dob', 'address', 'city', 'state', 'zip', 'insuranceProvider', 'insuranceId', 'language', 'notes', 'demographics', 'housingStatus', 'preferredName', 'identifyingInfo', 'contactMethod', 'gender', 'race', 'ethnicity', 'veteranStatus', 'homelessnessStatus', 'zipCode', 'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactPhone', 'insuranceMemberId', 'insuranceGroupNumber', 'consentToShare', 'consentDate', 'consentSignature', 'primaryLanguage', 'pronouns', 'needs', 'lgbtqiaIdentity', 'insuranceStatus']);
        if (!clientData.name && !clientData.firstName) return res.status(400).json({ error: 'Client name required' });
        const client = {
            ...clientData,
            createdAt: new Date().toISOString(),
            status: 'Active'
        };
        const ref = await db.collection('clients').add(client);
        res.json({ id: ref.id, ...client });
    } catch (error: any) {
        console.error('[CLIENTS] Failed to create:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
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
app.get('/api/clients/:id', verifyToken, async (req: Request, res: Response) => {
    try {
        const doc = await db.collection('clients').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Client not found' });
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// Update client
app.put('/api/clients/:id', verifyToken, async (req: Request, res: Response) => {
    try {
        const updates = { ...pickFields(req.body.client, ['name', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'address', 'city', 'state', 'zip', 'insuranceProvider', 'insuranceId', 'language', 'notes', 'demographics', 'status', 'dob', 'housingStatus', 'primaryLanguage', 'identifyingInfo', 'preferredName', 'homelessnessStatus', 'zipCode', 'contactMethod', 'gender', 'pronouns', 'race', 'ethnicity', 'veteranStatus', 'lgbtqiaIdentity', 'needs', 'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactPhone', 'insuranceMemberId', 'insuranceGroupNumber', 'insuranceStatus', 'consentToShare', 'consentDate', 'consentSignature']), updatedAt: new Date().toISOString(), updatedBy: (req as any).user.uid };
        await db.collection('clients').doc(req.params.id).update(updates);
        res.json({ id: req.params.id, ...updates });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// Get client referral history
app.get('/api/clients/:id/referrals', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('referrals').where('clientId', '==', req.params.id).get();
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        results.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch client referrals' });
    }
});

// --- INTAKE PDF GENERATION ---
app.get('/api/clients/:clientId/intake-pdf', verifyToken, async (req: Request, res: Response) => {
    try {
        const { clientId } = req.params;
        const screeningId = req.query.screeningId as string | undefined;
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
        const client = clientDoc.data() as any;

        let screening: any = null;
        if (screeningId) {
            const screenDoc = await db.collection('screenings').doc(screeningId).get();
            if (screenDoc.exists) screening = screenDoc.data();
        }

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const margin = 50;
        const pageW = 612;
        const pageH = 792;
        const contentW = pageW - margin * 2;

        // Helper functions
        const drawField = (page: any, label: string, value: any, x: number, y: number, labelW = 120) => {
            page.drawText(label, { x, y, font: fontBold, size: 8, color: rgb(0.4, 0.4, 0.4) });
            const safeVal = (value != null && String(value).trim()) ? String(value) : '---';
            page.drawText(safeVal, { x: x + labelW, y, font, size: 9, color: rgb(0.1, 0.1, 0.1) });
        };
        const drawCheckbox = (page: any, label: string, checked: boolean, x: number, y: number) => {
            page.drawRectangle({ x, y: y - 2, width: 10, height: 10, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.5 });
            if (checked) {
                page.drawRectangle({ x: x + 1.5, y: y - 0.5, width: 7, height: 7, color: rgb(0.1, 0.6, 0.3) });
                page.drawText('X', { x: x + 2, y: y - 0.5, font: fontBold, size: 7, color: rgb(1, 1, 1) });
            }
            page.drawText(label, { x: x + 15, y, font, size: 8, color: rgb(0.2, 0.2, 0.2) });
        };
        const drawSectionHeader = (page: any, title: string, y: number) => {
            page.drawRectangle({ x: margin, y: y - 4, width: contentW, height: 16, color: rgb(0.96, 0.96, 0.96) });
            page.drawText(title.toUpperCase(), { x: margin + 8, y, font: fontBold, size: 8, color: rgb(0.2, 0.5, 0.35) });
            return y - 24;
        };
        const drawFooter = (page: any) => {
            page.drawText('HMC provides screening & education only - NO diagnosis or treatment.', {
                x: margin, y: 30, font: fontItalic, size: 7, color: rgb(0.5, 0.5, 0.5)
            });
        };

        // === PAGE 1: Client Intake Form ===
        const page1 = pdfDoc.addPage([pageW, pageH]);
        let y = pageH - margin;

        // Header
        page1.drawRectangle({ x: 0, y: pageH - 6, width: pageW, height: 6, color: rgb(0.2, 0.5, 0.35) });
        page1.drawText('HMC CLIENT INTAKE FORM', { x: margin, y: y - 10, font: fontBold, size: 16, color: rgb(0.1, 0.1, 0.1) });
        page1.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: pageW - margin - 120, y: y - 10, font, size: 8, color: rgb(0.5, 0.5, 0.5) });
        y -= 40;

        // Client Info
        y = drawSectionHeader(page1, 'Client Information', y);
        const fullName = client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : (client.name || '—');
        drawField(page1, 'Name:', fullName, margin + 8, y);
        drawField(page1, 'DOB:', client.dob || client.dateOfBirth || '—', margin + 280, y);
        y -= 18;
        drawField(page1, 'Gender:', client.gender || '—', margin + 8, y);
        drawField(page1, 'Pronouns:', client.pronouns || '—', margin + 280, y);
        y -= 18;
        drawField(page1, 'Phone:', client.phone || '—', margin + 8, y);
        drawField(page1, 'Email:', client.email || '—', margin + 280, y);
        y -= 18;
        drawField(page1, 'Address:', client.address || '—', margin + 8, y);
        drawField(page1, 'Zip Code:', client.zipCode || '—', margin + 280, y);
        y -= 18;
        drawField(page1, 'Language:', client.primaryLanguage || '—', margin + 8, y);
        drawField(page1, 'Contact Method:', client.contactMethod || '—', margin + 280, y);
        y -= 18;
        drawField(page1, 'Housing Status:', client.homelessnessStatus || client.housingStatus, margin + 8, y);
        y -= 26;

        // Emergency Contact
        y = drawSectionHeader(page1, 'Emergency Contact', y);
        drawField(page1, 'Name:', client.emergencyContactName || '—', margin + 8, y);
        drawField(page1, 'Relationship:', client.emergencyContactRelationship || '—', margin + 280, y);
        y -= 18;
        drawField(page1, 'Phone:', client.emergencyContactPhone || '—', margin + 8, y);
        y -= 26;

        // Demographics
        y = drawSectionHeader(page1, 'Demographics', y);
        const raceOptions = ['Asian American/Pacific Islander', 'Black/African American', 'American Indian/Alaska Native', 'Asian', 'White', 'Hispanic/Latino', 'Other'];
        let rx = margin + 8;
        raceOptions.forEach(race => {
            const checked = Array.isArray(client.race) && client.race.includes(race);
            const labelW = font.widthOfTextAtSize(race, 8) + 26;
            if (rx + labelW > pageW - margin) { rx = margin + 8; y -= 16; }
            drawCheckbox(page1, race, checked, rx, y);
            rx += labelW;
        });
        y -= 20;
        drawCheckbox(page1, 'Veteran', !!client.veteranStatus, margin + 8, y);
        drawCheckbox(page1, 'LGBTQIA+', !!client.lgbtqiaIdentity, margin + 140, y);
        y -= 26;

        // Social Determinant Needs
        y = drawSectionHeader(page1, 'Social Determinant Needs', y);
        const needOptions = [
            { key: 'housing', label: 'Housing' }, { key: 'food', label: 'Food' },
            { key: 'healthcare', label: 'Healthcare' }, { key: 'mentalHealth', label: 'Mental Health' },
            { key: 'employment', label: 'Employment' }, { key: 'transportation', label: 'Transportation' },
            { key: 'childcare', label: 'Childcare' }, { key: 'substanceUse', label: 'Substance Use' },
            { key: 'legal', label: 'Legal' },
        ];
        rx = margin + 8;
        needOptions.forEach(need => {
            const checked = client.needs?.[need.key] === true;
            const labelW = font.widthOfTextAtSize(need.label, 8) + 26;
            if (rx + labelW > pageW - margin) { rx = margin + 8; y -= 16; }
            drawCheckbox(page1, need.label, checked, rx, y);
            rx += labelW;
        });
        y -= 26;

        // Insurance
        y = drawSectionHeader(page1, 'Insurance', y);
        drawField(page1, 'Provider:', client.insuranceStatus || client.insuranceProvider || '—', margin + 8, y);
        drawField(page1, 'Member ID:', client.insuranceMemberId || '—', margin + 280, y);
        y -= 18;
        drawField(page1, 'Group Number:', client.insuranceGroupNumber || '—', margin + 8, y);
        y -= 26;

        // Consent
        if (y > margin + 180) {
            y = drawSectionHeader(page1, 'Consent to Share Information / Consentimiento', y);
            const consentEn = 'I understand that my personal information, including my contact details, basic demographic information, and relevant service needs, may be shared with partner agencies and service providers for the purpose of connecting me to appropriate resources and support. I consent to the release of this information solely for referral and coordination purposes.';
            const consentEs = 'Entiendo que mi información personal, incluyendo mis datos de contacto, información demográfica básica y necesidades de servicios relevantes, puede ser compartida con agencias asociadas y proveedores de servicios con el propósito de conectarme con recursos y apoyos adecuados. Doy mi consentimiento para la divulgación de esta información únicamente con fines de referencia y coordinación.';

            const enLines = wrapText(consentEn, contentW - 16, font, 7);
            enLines.forEach(line => {
                if (y > margin + 40) { page1.drawText(line, { x: margin + 8, y, font, size: 7, color: rgb(0.3, 0.3, 0.3) }); y -= 10; }
            });
            y -= 6;
            const esLines = wrapText(consentEs, contentW - 16, fontItalic, 7);
            esLines.forEach(line => {
                if (y > margin + 40) { page1.drawText(line, { x: margin + 8, y, font: fontItalic, size: 7, color: rgb(0.4, 0.4, 0.4) }); y -= 10; }
            });
            y -= 10;
            drawCheckbox(page1, `Verbal consent obtained${client.consentDate ? ` on ${new Date(client.consentDate).toLocaleDateString()}` : ''}`, !!client.consentToShare, margin + 8, y);
            if (client.consentSignature) {
                y -= 16;
                drawField(page1, 'Consent obtained by:', client.consentSignature, margin + 8, y);
            }
        }
        drawFooter(page1);

        // === PAGE 2: Health Screening (if screeningId provided) ===
        if (screening) {
            const page2 = pdfDoc.addPage([pageW, pageH]);
            let sy = pageH - margin;
            page2.drawRectangle({ x: 0, y: pageH - 6, width: pageW, height: 6, color: rgb(0.2, 0.5, 0.35) });
            page2.drawText('HMC HEALTH SCREENING REPORT', { x: margin, y: sy - 10, font: fontBold, size: 16, color: rgb(0.1, 0.1, 0.1) });
            page2.drawText(`Screening Date: ${screening.timestamp ? new Date(screening.timestamp).toLocaleDateString() : '---'}`, { x: pageW - margin - 180, y: sy - 10, font, size: 8, color: rgb(0.5, 0.5, 0.5) });
            sy -= 36;

            // Client Info on screening page
            sy = drawSectionHeader(page2, 'Client Information', sy);
            const sName = client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : (client.name || screening.clientName || '---');
            drawField(page2, 'Name:', sName, margin + 8, sy);
            drawField(page2, 'DOB:', client.dob || client.dateOfBirth || '---', margin + 280, sy);
            sy -= 18;
            drawField(page2, 'Phone:', client.phone || '---', margin + 8, sy);
            drawField(page2, 'Gender:', client.gender || '---', margin + 280, sy);
            sy -= 18;
            drawField(page2, 'Language:', client.primaryLanguage || '---', margin + 8, sy);
            drawField(page2, 'Housing:', client.homelessnessStatus || client.housingStatus || '---', margin + 280, sy);
            sy -= 18;
            if (client.emergencyContactName) {
                drawField(page2, 'Emergency Contact:', `${client.emergencyContactName} (${client.emergencyContactRelationship || '---'}) ${client.emergencyContactPhone || ''}`, margin + 8, sy);
                sy -= 18;
            }
            if (client.insuranceStatus || client.insuranceProvider) {
                drawField(page2, 'Insurance:', `${client.insuranceStatus || client.insuranceProvider || '---'}${client.insuranceMemberId ? ' / ID: ' + client.insuranceMemberId : ''}`, margin + 8, sy);
                sy -= 18;
            }
            sy -= 8;

            // Past Medical History
            sy = drawSectionHeader(page2, 'Past Medical History', sy);
            drawField(page2, 'Current Medications:', screening.currentMedications || 'None', margin + 8, sy);
            sy -= 18;
            drawField(page2, 'Allergies:', screening.allergies || 'None', margin + 8, sy);
            sy -= 26;

            // Vital Signs
            sy = drawSectionHeader(page2, 'Vital Signs', sy);
            const sVitals = screening.vitals || {};
            const bp = sVitals.bloodPressure || {};
            const v = (val: any, unit = '') => (val != null && val !== '' && val !== 0) ? `${val}${unit}` : '---';
            drawField(page2, 'Blood Pressure:', (bp.systolic && bp.diastolic) ? `${bp.systolic}/${bp.diastolic} mmHg` : `${screening.systolic || '---'}/${screening.diastolic || '---'} mmHg`, margin + 8, sy);
            drawField(page2, 'Heart Rate:', v(sVitals.heartRate || screening.heartRate, ' bpm'), margin + 280, sy);
            sy -= 18;
            drawField(page2, 'O2 Saturation:', v(sVitals.oxygenSat || screening.oxygenSaturation, '%'), margin + 8, sy);
            drawField(page2, 'Temperature:', v(sVitals.temperature, ' F'), margin + 280, sy);
            sy -= 18;
            drawField(page2, 'Weight:', v(sVitals.weight || screening.weight, ' lbs'), margin + 8, sy);
            drawField(page2, 'Height:', v(sVitals.height || screening.height, ' in'), margin + 280, sy);
            sy -= 18;
            drawField(page2, 'Glucose:', v(sVitals.glucose || screening.glucose, ' mg/dL'), margin + 8, sy);
            if (screening.bmi) drawField(page2, 'BMI:', `${screening.bmi}`, margin + 280, sy);
            sy -= 26;

            // Flags
            if (screening.flags) {
                sy = drawSectionHeader(page2, 'Screening Flags', sy);
                if (screening.flags.bloodPressure) {
                    drawField(page2, 'Blood Pressure:', `${screening.flags.bloodPressure.label} (${screening.flags.bloodPressure.level})`, margin + 8, sy);
                    sy -= 18;
                }
                if (screening.flags.glucose) {
                    drawField(page2, 'Glucose:', `${screening.flags.glucose.label} (${screening.flags.glucose.level})`, margin + 8, sy);
                    sy -= 18;
                }
                sy -= 8;
            }

            // Notes & Results
            if (screening.notes || screening.resultsSummary) {
                sy = drawSectionHeader(page2, 'Notes & Results', sy);
                if (screening.notes) {
                    const noteLines = wrapText(screening.notes, contentW - 16, font, 8);
                    noteLines.forEach(line => {
                        if (sy > margin + 60) { page2.drawText(line, { x: margin + 8, y: sy, font, size: 8, color: rgb(0.2, 0.2, 0.2) }); sy -= 12; }
                    });
                    sy -= 4;
                }
                if (screening.resultsSummary) {
                    page2.drawText('Results Summary:', { x: margin + 8, y: sy, font: fontBold, size: 8, color: rgb(0.4, 0.4, 0.4) });
                    sy -= 14;
                    const summaryLines = wrapText(screening.resultsSummary, contentW - 16, font, 8);
                    summaryLines.forEach(line => {
                        if (sy > margin + 60) { page2.drawText(line, { x: margin + 8, y: sy, font, size: 8, color: rgb(0.2, 0.2, 0.2) }); sy -= 12; }
                    });
                    sy -= 4;
                }
            }

            // Completion
            sy = drawSectionHeader(page2, 'Completion & Attestation', sy);
            drawField(page2, 'Performed by:', screening.performedByName || '—', margin + 8, sy);
            sy -= 18;
            if (screening.refusalOfCare) {
                drawCheckbox(page2, 'Refusal of Care form completed and submitted', true, margin + 8, sy);
                sy -= 18;
                if (screening.refusalData) {
                    if (screening.refusalData.reason) {
                        drawField(page2, 'Reason:', screening.refusalData.reason, margin + 8, sy);
                        sy -= 16;
                    }
                    drawField(page2, 'Witness 1:', `${screening.refusalData.witness1Name || '—'} (signed: ${screening.refusalData.witness1Signature || '—'})`, margin + 8, sy);
                    sy -= 16;
                    drawField(page2, 'Witness 2:', `${screening.refusalData.witness2Name || '—'} (signed: ${screening.refusalData.witness2Signature || '—'})`, margin + 8, sy);
                    sy -= 18;
                }
            }
            if (screening.abnormalFlag) {
                drawField(page2, 'Abnormal Flag:', screening.abnormalReason || 'Yes', margin + 8, sy);
                sy -= 18;
            }
            if (screening.followUpNeeded) {
                drawField(page2, 'Follow-up:', screening.followUpReason || 'Required', margin + 8, sy);
            }
            drawFooter(page2);
        }

        const pdfBytes = await pdfDoc.save();
        const clientName = (client.firstName && client.lastName) ? `${client.firstName}_${client.lastName}` : (client.name || 'client');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="HMC_Intake_${clientName.replace(/\s+/g, '_')}.pdf"`);
        res.send(Buffer.from(pdfBytes));
    } catch (error: any) {
        console.error('[INTAKE PDF] Generation failed:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// --- REFUSAL OF CARE PDF ---
app.get('/api/screenings/:screeningId/refusal-pdf', verifyToken, async (req: Request, res: Response) => {
    try {
        const screenDoc = await db.collection('screenings').doc(req.params.screeningId).get();
        if (!screenDoc.exists) return res.status(404).json({ error: 'Screening not found' });
        const screening = screenDoc.data() as any;
        if (!screening.refusalOfCare || !screening.refusalData) return res.status(400).json({ error: 'No refusal of care data' });

        let client: any = {};
        if (screening.clientId) {
            const clientDoc = await db.collection('clients').doc(screening.clientId).get();
            if (clientDoc.exists) client = clientDoc.data();
        }

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const margin = 50;
        const pageW = 612;
        const pageH = 792;
        const contentW = pageW - margin * 2;

        const page = pdfDoc.addPage([pageW, pageH]);
        let y = pageH - margin;

        // Header
        page.drawRectangle({ x: 0, y: pageH - 6, width: pageW, height: 6, color: rgb(0.7, 0.15, 0.15) });
        page.drawText('REFUSAL OF CARE FORM', { x: margin, y: y - 10, font: fontBold, size: 18, color: rgb(0.1, 0.1, 0.1) });
        page.drawText('Health Matters Clinic (HMC)', { x: margin, y: y - 28, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
        y -= 55;

        // Client Info
        page.drawRectangle({ x: margin, y: y - 4, width: contentW, height: 16, color: rgb(0.96, 0.96, 0.96) });
        page.drawText('CLIENT INFORMATION', { x: margin + 8, y, font: fontBold, size: 8, color: rgb(0.5, 0.2, 0.2) });
        y -= 24;
        const fullName = client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : (screening.clientName || '—');
        page.drawText(`Name: ${fullName}`, { x: margin + 8, y, font: fontBold, size: 10, color: rgb(0.1, 0.1, 0.1) });
        page.drawText(`DOB: ${client.dob || '—'}`, { x: margin + 300, y, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
        y -= 18;
        page.drawText(`Date: ${new Date(screening.refusalData.timestamp || screening.timestamp).toLocaleDateString()}`, { x: margin + 8, y, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
        y -= 30;

        // Statement
        page.drawRectangle({ x: margin, y: y - 4, width: contentW, height: 16, color: rgb(0.96, 0.96, 0.96) });
        page.drawText('STATEMENT OF REFUSAL', { x: margin + 8, y, font: fontBold, size: 8, color: rgb(0.5, 0.2, 0.2) });
        y -= 24;
        const statement = 'I, the above-named individual, have been informed of the health screening services available to me today. I understand the purpose and potential benefits of these services. I voluntarily choose to decline the recommended care/screening at this time. I understand that by refusing care, I may be at risk for undetected health conditions. I release Health Matters Clinic (HMC) and its volunteers from any liability related to my decision to refuse care.';
        const stLines = wrapText(statement, contentW - 16, font, 9);
        stLines.forEach(line => {
            page.drawText(line, { x: margin + 8, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
            y -= 14;
        });
        y -= 10;

        // Reason
        if (screening.refusalData.reason) {
            page.drawText('Reason for Refusal:', { x: margin + 8, y, font: fontBold, size: 9, color: rgb(0.3, 0.3, 0.3) });
            y -= 14;
            page.drawText(screening.refusalData.reason, { x: margin + 8, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
            y -= 24;
        }

        // Witness signatures
        page.drawRectangle({ x: margin, y: y - 4, width: contentW, height: 16, color: rgb(0.96, 0.96, 0.96) });
        page.drawText('WITNESS SIGNATURES', { x: margin + 8, y, font: fontBold, size: 8, color: rgb(0.5, 0.2, 0.2) });
        y -= 30;

        // Witness 1
        page.drawText('Witness 1:', { x: margin + 8, y, font: fontBold, size: 9, color: rgb(0.3, 0.3, 0.3) });
        y -= 18;
        page.drawText(`Name: ${screening.refusalData.witness1Name || '—'}`, { x: margin + 8, y, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
        y -= 18;
        page.drawLine({ start: { x: margin + 8, y: y + 2 }, end: { x: margin + 250, y: y + 2 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
        page.drawText(screening.refusalData.witness1Signature || '', { x: margin + 8, y: y + 4, font: fontItalic, size: 12, color: rgb(0.1, 0.1, 0.5) });
        page.drawText('Signature', { x: margin + 8, y: y - 10, font, size: 7, color: rgb(0.5, 0.5, 0.5) });
        y -= 40;

        // Witness 2
        page.drawText('Witness 2:', { x: margin + 8, y, font: fontBold, size: 9, color: rgb(0.3, 0.3, 0.3) });
        y -= 18;
        page.drawText(`Name: ${screening.refusalData.witness2Name || '—'}`, { x: margin + 8, y, font, size: 10, color: rgb(0.1, 0.1, 0.1) });
        y -= 18;
        page.drawLine({ start: { x: margin + 8, y: y + 2 }, end: { x: margin + 250, y: y + 2 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
        page.drawText(screening.refusalData.witness2Signature || '', { x: margin + 8, y: y + 4, font: fontItalic, size: 12, color: rgb(0.1, 0.1, 0.5) });
        page.drawText('Signature', { x: margin + 8, y: y - 10, font, size: 7, color: rgb(0.5, 0.5, 0.5) });
        y -= 40;

        // Footer
        page.drawText('HMC provides screening & education only — NO diagnosis or treatment.', {
            x: margin, y: 30, font: fontItalic, size: 7, color: rgb(0.5, 0.5, 0.5)
        });

        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="HMC_Refusal_of_Care_${fullName.replace(/\s+/g, '_')}.pdf"`);
        res.send(Buffer.from(pdfBytes));
    } catch (error: any) {
        console.error('[REFUSAL PDF] Generation failed:', error);
        res.status(500).json({ error: 'Failed to generate refusal PDF' });
    }
});

// --- EVENT CLIENTS (cross-tab visibility) ---
app.get('/api/clients/event/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        if (!eventId) return res.status(400).json({ error: 'eventId required' });

        // Query referrals and screenings for this event in parallel
        // Also fetch today's orphaned screenings (no eventId) so no clients are missed
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayISO = todayStart.toISOString();

        const [referralsSnap, screeningsSnap, todayScreeningsSnap, todayClientsSnap] = await Promise.all([
            db.collection('referrals').where('eventId', '==', eventId).get(),
            db.collection('screenings').where('eventId', '==', eventId).get(),
            db.collection('screenings').where('createdAt', '>=', todayISO).get(),
            db.collection('clients').where('createdAt', '>=', todayISO).get(),
        ]);

        // Collect unique clientIds with their station sources
        const clientMap = new Map<string, { referral: boolean; screening: boolean }>();
        for (const doc of referralsSnap.docs) {
            const cid = doc.data().clientId;
            if (cid) {
                const entry = clientMap.get(cid) || { referral: false, screening: false };
                entry.referral = true;
                clientMap.set(cid, entry);
            }
        }
        const seenScreeningIds = new Set<string>();
        for (const doc of screeningsSnap.docs) {
            seenScreeningIds.add(doc.id);
            const cid = doc.data().clientId;
            if (cid) {
                const entry = clientMap.get(cid) || { referral: false, screening: false };
                entry.screening = true;
                clientMap.set(cid, entry);
            }
        }
        // Include today's screenings that have no eventId (orphaned)
        for (const doc of todayScreeningsSnap.docs) {
            if (seenScreeningIds.has(doc.id)) continue;
            const data = doc.data();
            if (!data.eventId && data.clientId) {
                const entry = clientMap.get(data.clientId) || { referral: false, screening: false };
                entry.screening = true;
                clientMap.set(data.clientId, entry);
            }
        }
        // Include clients created today (registered but screening not yet submitted)
        for (const doc of todayClientsSnap.docs) {
            if (!clientMap.has(doc.id)) {
                clientMap.set(doc.id, { referral: false, screening: false });
            }
        }

        if (clientMap.size === 0) return res.json([]);

        // Batch-fetch client records (Firestore IN queries limited to 30)
        const clientIds = Array.from(clientMap.keys());
        const clients: any[] = [];
        for (let i = 0; i < clientIds.length; i += 30) {
            const batch = clientIds.slice(i, i + 30);
            const snap = await db.collection('clients').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
            snap.docs.forEach(d => {
                const data = d.data();
                const stations = clientMap.get(d.id)!;
                clients.push({ id: d.id, firstName: data.firstName, lastName: data.lastName, dob: data.dob, phone: data.phone, stations });
            });
        }

        res.json(clients);
    } catch (error: any) {
        console.error('[EVENT CLIENTS] Failed:', error.message);
        res.status(500).json({ error: 'Failed to fetch event clients' });
    }
});

// --- PUBLIC EVENT ENDPOINTS (for Event-Finder-Tool integration) ---

// GET /api/public/events - Public endpoint to get approved, public-facing events
app.get('/api/public/events', async (req: Request, res: Response) => {
    try {
        const today = getPacificDate();
        const includeAll = req.query.all === 'true'; // ?all=true to get all approved (for internal tools)

        // Single where clause, filter date in memory to avoid composite index
        const snapshot = await db.collection('opportunities')
            .where('approvalStatus', '==', 'approved')
            .get();

        const events = snapshot.docs
            .filter(doc => doc.data().date >= today)
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

        events.sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
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
  rsvpData: { eventId: string; eventTitle: string; eventDate: string; name: string; email: string; phone?: string; eventType?: string }
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

          // Notify coordinators — single where, filter role in memory to avoid composite index
          const coordinatorsSnap = await db.collection('volunteers')
            .where('status', '==', 'active')
            .get();
          const coordinatorDocs = coordinatorsSnap.docs.filter((d: any) => EVENT_MANAGEMENT_ROLES.includes(d.data().role));

          for (const coord of coordinatorDocs) {
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
  rsvpData: { eventId: string; eventTitle: string; eventDate: string; name: string; email: string; eventType?: string }
): Promise<void> => {
  const isTrained = volData.status === 'active' && (volData.onboardingProgress >= 100 || volData.coreVolunteerStatus === true);

  if (isTrained) {
    // Auto-register: add eventId to rsvpedEventIds, update slotsFilled, send confirmation, award XP
    const volunteerRef = db.collection('volunteers').doc(volunteerId);
    const existingRsvps = volData.rsvpedEventIds || [];
    const updatedRsvpIds = [...new Set([...existingRsvps, rsvpData.eventId])];
    // RSVP with phone = SMS consent; ensure notificationPrefs defaults are set
    const prefUpdates: any = { rsvpedEventIds: updatedRsvpIds };
    if (!volData.notificationPrefs) {
      prefUpdates.notificationPrefs = { emailAlerts: true, smsAlerts: true };
    }
    await volunteerRef.update(prefUpdates);

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
        eventLocation: 'See event details',
        eventType: rsvpData.eventType || '',
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
        const { eventId, eventTitle, eventDate, name, email, phone, guests, needs, source, contactPreference } = req.body;

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
            contactPreference: contactPreference || 'email',
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

        // Batch RSVP creation + event count update atomically
        const rsvpRef = db.collection('public_rsvps').doc();
        const eventRef = db.collection('opportunities').doc(eventId);
        const eventDoc = await eventRef.get();

        const publicBatch = db.batch();
        publicBatch.set(rsvpRef, rsvp);
        if (eventDoc.exists) {
            publicBatch.update(eventRef, {
                rsvpCount: admin.firestore.FieldValue.increment(1 + (guests || 0))
            });
        }
        await publicBatch.commit();

        console.log(`[PUBLIC RSVP] Created RSVP ${rsvpRef.id} for event ${eventId}`);

        // Send SMS confirmation if phone provided and contact preference is text
        if (phone && (contactPreference === 'text' || contactPreference === 'sms')) {
            const smsBody = `Hi ${name}! You're confirmed for ${eventTitle || 'an HMC event'}${eventDate ? ` on ${eventDate}` : ''}. We'll send you a reminder before the event. See you there! - Health Matters Clinic`;
            sendSMS(null, phone, smsBody).catch(err => console.error(`[PUBLIC RSVP] SMS confirmation failed:`, err));
        }

        // Fire-and-forget: process volunteer matching asynchronously
        const oppType = eventDoc.exists ? (eventDoc.data() as any)?.type || '' : '';
        processVolunteerMatch(rsvpRef.id, {
            eventId,
            eventTitle: eventTitle || '',
            eventDate: eventDate || '',
            name,
            email,
            phone: phone || '',
            eventType: oppType,
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

        // Use transaction to prevent double check-in race condition
        const checkedInAt = new Date().toISOString();
        const result = await db.runTransaction(async (tx) => {
            const rsvpSnap = await tx.get(rsvpDoc.ref);
            const rsvpData = rsvpSnap.data();
            if (!rsvpData) throw new Error('RSVP not found');
            if (rsvpData.checkedIn) {
                return { alreadyCheckedIn: true, checkedInAt: rsvpData.checkedInAt };
            }
            tx.update(rsvpDoc.ref, { checkedIn: true, checkedInAt });
            const eventRef = db.collection('opportunities').doc(rsvpData.eventId);
            const eventSnap = await tx.get(eventRef);
            if (eventSnap.exists) {
                tx.update(eventRef, { checkinCount: admin.firestore.FieldValue.increment(1 + (rsvpData.guests || 0)) });
            }
            return { alreadyCheckedIn: false, name: rsvpData.name, eventTitle: rsvpData.eventTitle, eventId: rsvpData.eventId };
        });

        if (result.alreadyCheckedIn) {
            return res.status(400).json({ error: 'Already checked in', checkedInAt: result.checkedInAt });
        }

        console.log(`[PUBLIC CHECKIN] Checked in RSVP ${rsvpDoc.id} for event ${result.eventId}`);
        res.json({
            success: true,
            name: result.name,
            eventTitle: result.eventTitle,
            checkedInAt,
            message: 'Check-in successful'
        });
    } catch (error: any) {
        console.error('[PUBLIC CHECKIN] Failed to check in:', error);
        res.status(500).json({ error: 'Failed to check in' });
    }
});

// GET /api/public/event-checkin/:eventId - Serve standalone HTML check-in page for QR code scanning
app.get('/api/public/event-checkin/:eventId', rateLimit(30, 60000), async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;

        // Validate eventId format (alphanumeric + hyphens only, XSS prevention)
        if (!eventId || !/^[a-zA-Z0-9\-]+$/.test(eventId)) {
            return res.status(400).send('Invalid event ID');
        }

        // Fetch event for title/date
        const eventDoc = await db.collection('opportunities').doc(eventId).get();
        const eventData = eventDoc.exists ? eventDoc.data() : null;
        const eventTitle = eventData?.title || 'Health Matters Clinic Event';
        const eventDate = eventData?.date || '';

        const logoUrl = 'https://cdn.prod.website-files.com/67359e6040140078962e8a54/6912e29e5710650a4f45f53f_Untitled%20(256%20x%20256%20px).png';
        const submitUrl = `/api/public/event-checkin-submit`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Check-in | Health Matters Clinic</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0;padding:0}body{-webkit-font-smoothing:antialiased;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(180deg,#f5f3ef 0%,#eae7e2 100%);min-height:100vh;padding:48px 24px}
.card{max-width:400px;margin:0 auto;background:white;border-radius:24px;padding:40px 32px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.08)}
.logo{width:72px;height:72px;border-radius:18px;margin:0 auto 24px;display:block;box-shadow:0 4px 16px rgba(0,0,0,0.1)}
h1{color:#1a1a1a;font-size:26px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px}
.subtitle{color:#666;font-size:15px;margin-bottom:8px}
.event-info{background:#f8f9fc;padding:20px;border-radius:16px;margin-bottom:24px}
.event-title{font-weight:600;color:#1a1a1a;font-size:16px;line-height:1.4;margin-bottom:4px}
.event-date{color:#233dff;font-size:13px;font-weight:600}
.input{width:100%;padding:16px 20px;border:2px solid #e5e5e5;border-radius:16px;font-size:16px;font-family:Inter,sans-serif;outline:none;transition:border-color 0.2s}
.input:focus{border-color:#233dff}
.input+.input{margin-top:12px}
.btn{display:inline-block;width:100%;background:#233dff;color:white;padding:16px;border-radius:100px;border:none;font-weight:700;font-size:15px;font-family:Inter,sans-serif;cursor:pointer;margin-top:16px;box-shadow:0 4px 12px rgba(35,61,255,0.3);transition:opacity 0.2s}
.btn:disabled{opacity:0.5;cursor:not-allowed}
.btn-hero{background:#10b981;font-size:18px;font-weight:800;padding:20px;margin-top:0;margin-bottom:16px;box-shadow:0 6px 20px rgba(16,185,129,0.35);letter-spacing:0.5px}
.or-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#bbb;font-size:12px;font-weight:600}
.or-divider::before,.or-divider::after{content:'';flex:1;height:1px;background:#e5e5e5}
.msg{margin-top:20px;padding:16px;border-radius:16px;font-size:14px;font-weight:600}
.msg.success{background:#ecfdf5;color:#065f46}
.msg.already{background:#fefce8;color:#854d0e}
.msg.error{background:#fef2f2;color:#991b1b}
.footer{text-align:center;color:#999;font-size:11px;margin-top:24px;font-weight:500;letter-spacing:0.5px}
.spinner{display:inline-block;width:20px;height:20px;border:3px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.6s linear infinite;vertical-align:middle;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.hidden{display:none}
.check-icon{font-size:48px;margin-bottom:16px}
.hint{color:#999;font-size:12px;margin-top:8px}
.walkin-link{color:#233dff;font-size:13px;font-weight:600;cursor:pointer;margin-top:16px;display:inline-block;text-decoration:none}
.walkin-link:hover{text-decoration:underline}
</style></head>
<body>
<div class="card" id="card">
<img src="${logoUrl}" alt="Health Matters Clinic" class="logo">
<h1>I'm Here!</h1>
<p class="subtitle">Check in to the event</p>
<div class="event-info">
<p class="event-title">${eventTitle.replace(/'/g, '&#39;').replace(/"/g, '&quot;')}</p>
${eventDate ? `<p class="event-date">${eventDate}</p>` : ''}
</div>
<form id="checkinForm">
<input type="text" id="nameInput" class="input" placeholder="Your full name" required autocomplete="name">
<input type="text" id="contactInput" class="input" placeholder="Email or phone (optional)" autocomplete="email">
<button type="submit" class="btn btn-hero" id="submitBtn">I'm Here!</button>
<p class="hint">Enter your name to find your registration</p>
</form>
<form id="walkinForm" class="hidden">
<p style="color:#666;font-size:14px;margin-bottom:16px;font-weight:500">No registration found. Check in as a walk-in:</p>
<input type="text" id="walkinName" class="input" placeholder="Your full name" required autocomplete="name">
<input type="text" id="walkinContact" class="input" placeholder="Email or phone" autocomplete="email">
<button type="submit" class="btn">Check In as Walk-In</button>
</form>
<div id="loading" class="hidden" style="margin-top:20px"><div class="spinner"></div><span style="color:#666;font-size:14px">Checking in...</span></div>
<div id="message" class="msg hidden"></div>
</div>
<p class="footer">HEALTH MATTERS CLINIC</p>
<script>
var form=document.getElementById('checkinForm'),nameIn=document.getElementById('nameInput'),contactIn=document.getElementById('contactInput'),loading=document.getElementById('loading'),msg=document.getElementById('message'),walkinForm=document.getElementById('walkinForm'),walkinName=document.getElementById('walkinName'),walkinContact=document.getElementById('walkinContact');
function showResult(res){
loading.classList.add('hidden');
msg.classList.remove('hidden');
if(res.ok&&res.data.success){
msg.className='msg success';
msg.innerHTML='<div class="check-icon">\\u2705</div><strong>You\\u2019re Checked In!</strong><br>Welcome, '+(res.data.name||'')+'<br><small style="color:#233dff">'+(res.data.eventTitle||'')+'</small>';
}else if(res.data.code==='already_checked_in'){
msg.className='msg already';
msg.innerHTML='<div class="check-icon">\\u2714\\uFE0F</div><strong>Already Checked In</strong><br>You\\u2019re all set!';
}else{
msg.className='msg error';
msg.innerHTML='<strong>Something went wrong</strong><br>Please try again.';
form.classList.remove('hidden');
}
}
form.addEventListener('submit',function(e){
e.preventDefault();
var n=nameIn.value.trim(),c=contactIn.value.trim();
if(!n)return;
form.classList.add('hidden');
loading.classList.remove('hidden');
msg.classList.add('hidden');
fetch('${submitUrl}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:'${eventId}',name:n,contact:c})})
.then(function(r){return r.json().then(function(d){return{ok:r.ok,status:r.status,data:d}})})
.then(function(res){
if(res.data.code==='no_rsvp'){
loading.classList.add('hidden');
walkinName.value=n;
walkinContact.value=c;
walkinForm.classList.remove('hidden');
}else{
showResult(res);
}
}).catch(function(){
loading.classList.add('hidden');
msg.classList.remove('hidden');
msg.className='msg error';
msg.innerHTML='<strong>Connection error</strong><br>Please check your internet and try again.';
form.classList.remove('hidden');
});
});
walkinForm.addEventListener('submit',function(e){
e.preventDefault();
var nm=walkinName.value.trim(),ct=walkinContact.value.trim();
if(!nm)return;
walkinForm.classList.add('hidden');
loading.classList.remove('hidden');
msg.classList.add('hidden');
fetch('${submitUrl}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:'${eventId}',name:nm,contact:ct,walkIn:true})})
.then(function(r){return r.json().then(function(d){return{ok:r.ok,status:r.status,data:d}})})
.then(function(res){showResult(res);})
.catch(function(){
loading.classList.add('hidden');
msg.classList.remove('hidden');
msg.className='msg error';
msg.innerHTML='<strong>Connection error</strong><br>Please check your internet and try again.';
walkinForm.classList.remove('hidden');
});
});
</script>
</body></html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error: any) {
        console.error('[EVENT CHECKIN PAGE] Failed:', error);
        res.status(500).send('Something went wrong');
    }
});

// POST /api/public/event-checkin-submit - Name/email/phone check-in from QR code page
app.post('/api/public/event-checkin-submit', rateLimit(20, 60000), async (req: Request, res: Response) => {
    try {
        // Support both old format (email only) and new format (name + contact)
        const { eventId, email, name, contact, walkIn } = req.body;

        if (!eventId) {
            return res.status(400).json({ error: 'eventId is required' });
        }

        // Normalize inputs
        const searchName = String(name || '').trim().toLowerCase();
        const searchContact = String(contact || email || '').trim().toLowerCase();
        // Strip non-digits for phone matching
        const searchPhone = searchContact.replace(/\D/g, '');
        const isPhoneLike = searchPhone.length >= 7;

        if (!searchName && !searchContact) {
            return res.status(400).json({ error: 'Name or contact info is required' });
        }

        // Query all RSVPs for this event
        const rsvpAllSnap = await db.collection('public_rsvps')
            .where('eventId', '==', eventId)
            .get();

        // Search by name, email, or phone — flexible matching
        let matchDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        for (const doc of rsvpAllSnap.docs) {
            const data = doc.data();
            const rsvpEmail = String(data.email || '').toLowerCase().trim();
            const rsvpName = String(data.name || '').toLowerCase().trim();
            const rsvpPhone = String(data.phone || '').replace(/\D/g, '');

            // Exact email match
            if (searchContact && rsvpEmail && rsvpEmail === searchContact) {
                matchDoc = doc;
                break;
            }
            // Phone match (last 10 digits)
            if (isPhoneLike && rsvpPhone) {
                const rsvpLast10 = rsvpPhone.slice(-10);
                const searchLast10 = searchPhone.slice(-10);
                if (rsvpLast10 === searchLast10 && rsvpLast10.length >= 7) {
                    matchDoc = doc;
                    break;
                }
            }
            // Name match (case-insensitive, trimmed)
            if (searchName && rsvpName && rsvpName === searchName) {
                matchDoc = doc;
                break;
            }
        }

        // Fuzzy name match if exact didn't work (first+last name partial)
        if (!matchDoc && searchName) {
            for (const doc of rsvpAllSnap.docs) {
                const rsvpName = String(doc.data().name || '').toLowerCase().trim();
                // Check if search name contains the RSVP name or vice versa
                if (rsvpName && (rsvpName.includes(searchName) || searchName.includes(rsvpName))) {
                    matchDoc = doc;
                    break;
                }
            }
        }

        // No RSVP found — handle walk-in or return error
        if (!matchDoc) {
            if (walkIn) {
                const displayName = String(name || '').trim() || 'Walk-in';
                const eventDoc = await db.collection('opportunities').doc(eventId).get();
                const eventData = eventDoc.exists ? eventDoc.data() : null;
                const checkedInAt = new Date().toISOString();
                const walkinRsvp: any = {
                    eventId,
                    name: displayName,
                    guests: 0,
                    rsvpDate: checkedInAt,
                    checkedIn: true,
                    checkedInAt,
                    checkedInMethod: 'qr-walkin',
                    isWalkIn: true,
                    eventTitle: eventData?.title || '',
                    eventDate: eventData?.date || '',
                };
                // Store contact as email or phone
                if (searchContact) {
                    if (searchContact.includes('@')) {
                        walkinRsvp.email = searchContact;
                    } else {
                        walkinRsvp.phone = searchContact;
                    }
                }
                await db.collection('public_rsvps').add(walkinRsvp);
                if (eventDoc.exists) {
                    await db.collection('opportunities').doc(eventId).update({
                        checkinCount: admin.firestore.FieldValue.increment(1)
                    });
                }
                // Try to bridge walk-in to volunteer account by email
                let walkinVolunteerId: string | null = null;
                if (searchContact && searchContact.includes('@')) {
                    try {
                        const volSnap = await db.collection('volunteers').where('email', '==', searchContact).limit(1).get();
                        if (!volSnap.empty) {
                            const volDoc = volSnap.docs[0];
                            walkinVolunteerId = volDoc.id;
                            const volData = volDoc.data();
                            const volCheckinRef = db.collection('volunteer_checkins').doc(`${eventId}_${volDoc.id}`);
                            const existingCheckin = await volCheckinRef.get();
                            if (!existingCheckin.exists || !existingCheckin.data()?.checkedIn) {
                                await volCheckinRef.set({
                                    volunteerId: volDoc.id,
                                    volunteerName: volData?.name || displayName,
                                    volunteerRole: volData?.volunteerRole || volData?.role || 'Volunteer',
                                    eventId,
                                    shiftId: '',
                                    checkedIn: true,
                                    checkedInAt,
                                    checkedOut: false,
                                    checkedOutAt: null,
                                    hoursServed: 0,
                                    checkedInMethod: 'qr-walkin-bridge',
                                }, { merge: true });
                                console.log(`[QR CHECKIN] Bridged walk-in volunteer check-in for ${volData?.name || displayName} (${volDoc.id})`);
                            }
                        }
                    } catch (bridgeErr: any) {
                        console.error(`[QR CHECKIN] Walk-in volunteer bridge failed:`, bridgeErr.message);
                    }
                }

                console.log(`[QR CHECKIN] Walk-in checked in for event ${eventId}: ${displayName}`);
                return res.json({
                    success: true,
                    name: displayName,
                    eventTitle: eventData?.title || '',
                    checkedInAt,
                    walkIn: true,
                    volunteerBridged: !!walkinVolunteerId,
                });
            }
            return res.status(404).json({ error: 'No RSVP found', code: 'no_rsvp' });
        }

        // Use transaction to prevent double check-in
        const checkedInAt = new Date().toISOString();
        const result = await db.runTransaction(async (tx) => {
            const rsvpSnap = await tx.get(matchDoc!.ref);
            const rsvpData = rsvpSnap.data();
            if (!rsvpData) throw new Error('RSVP not found');
            if (rsvpData.checkedIn) {
                return { alreadyCheckedIn: true, checkedInAt: rsvpData.checkedInAt };
            }
            tx.update(matchDoc!.ref, { checkedIn: true, checkedInAt, checkedInMethod: 'qr-name' });
            const eventRef = db.collection('opportunities').doc(eventId);
            const eventSnap = await tx.get(eventRef);
            if (eventSnap.exists) {
                tx.update(eventRef, { checkinCount: admin.firestore.FieldValue.increment(1 + (rsvpData.guests || 0)) });
            }
            return { alreadyCheckedIn: false, name: rsvpData.name, eventTitle: rsvpData.eventTitle, volunteerMatch: rsvpData.volunteerMatch };
        });

        if (result.alreadyCheckedIn) {
            return res.status(400).json({ error: 'Already checked in', code: 'already_checked_in', checkedInAt: result.checkedInAt });
        }

        // Bridge to volunteer_checkins: if this RSVP is linked to a volunteer account,
        // also create a volunteer_checkins record so they can check out through the portal
        const volunteerId = result.volunteerMatch?.volunteerId;
        if (volunteerId) {
            try {
                const volCheckinRef = db.collection('volunteer_checkins').doc(`${eventId}_${volunteerId}`);
                const existing = await volCheckinRef.get();
                if (!existing.exists || !existing.data()?.checkedIn) {
                    // Look up volunteer profile for name/role
                    const volDoc = await db.collection('volunteers').doc(volunteerId).get();
                    const volData = volDoc.data();
                    const volName = volData?.name || volData?.legalFirstName ? `${volData?.legalFirstName || ''} ${volData?.legalLastName || ''}`.trim() : result.name || 'Volunteer';
                    const volRole = volData?.volunteerRole || volData?.role || 'Volunteer';

                    await volCheckinRef.set({
                        volunteerId,
                        volunteerName: volName,
                        volunteerRole: volRole,
                        eventId,
                        shiftId: '',
                        checkedIn: true,
                        checkedInAt,
                        checkedOut: false,
                        checkedOutAt: null,
                        hoursServed: 0,
                        checkedInMethod: 'qr-bridge',
                    }, { merge: true });
                    console.log(`[QR CHECKIN] Bridged volunteer check-in for ${volName} (${volunteerId}) on event ${eventId}`);
                }
            } catch (bridgeErr: any) {
                // Non-fatal — log but don't fail the check-in
                console.error(`[QR CHECKIN] Failed to bridge volunteer check-in:`, bridgeErr.message);
            }
        }

        console.log(`[QR CHECKIN] Checked in for event ${eventId}: ${result.name}`);
        res.json({
            success: true,
            name: result.name,
            eventTitle: result.eventTitle,
            checkedInAt,
            volunteerBridged: !!volunteerId,
        });
    } catch (error: any) {
        console.error('[QR CHECKIN] Failed:', error);
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

// GET /api/events/:id/public-rsvps - List all public RSVPs for an event (coordinators/admins)
app.get('/api/events/:id/public-rsvps', verifyToken, async (req: Request, res: Response) => {
    const userProfile = (req as any).user?.profile;
    if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
        return res.status(403).json({ error: 'Only admins and event coordinators can view public RSVPs' });
    }
    try {
        const rsvpSnapshot = await db.collection('public_rsvps')
            .where('eventId', '==', req.params.id)
            .get();
        const rsvps = rsvpSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(rsvps);
    } catch (error: any) {
        console.error('[PUBLIC RSVPS] Failed to list:', error);
        res.status(500).json({ error: 'Failed to list RSVPs' });
    }
});

// POST /api/events/:id/manual-checkin - Coordinator manually checks in an RSVP attendee
app.post('/api/events/:id/manual-checkin', verifyToken, async (req: Request, res: Response) => {
    const userProfile = (req as any).user?.profile;
    if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
        return res.status(403).json({ error: 'Only admins and event coordinators can check in attendees' });
    }
    try {
        const { rsvpId } = req.body;
        if (!rsvpId) return res.status(400).json({ error: 'rsvpId is required' });

        const rsvpRef = db.collection('public_rsvps').doc(rsvpId);
        const rsvpDoc = await rsvpRef.get();
        if (!rsvpDoc.exists) return res.status(404).json({ error: 'RSVP not found' });

        const rsvpData = rsvpDoc.data()!;
        if (rsvpData.checkedIn) {
            return res.json({ success: true, message: 'Already checked in', checkedInAt: rsvpData.checkedInAt });
        }

        const checkedInAt = new Date().toISOString();
        await rsvpRef.update({ checkedIn: true, checkedInAt, checkedInBy: (req as any).user?.uid });

        // Update event check-in count
        const eventRef = db.collection('opportunities').doc(req.params.id);
        const eventDoc = await eventRef.get();
        if (eventDoc.exists) {
            await eventRef.update({
                checkinCount: admin.firestore.FieldValue.increment(1 + (rsvpData.guests || 0))
            });
        }

        console.log(`[MANUAL CHECKIN] Coordinator checked in RSVP ${rsvpId} for event ${req.params.id}`);
        res.json({ success: true, checkedInAt });
    } catch (error: any) {
        console.error('[MANUAL CHECKIN] Failed:', error);
        res.status(500).json({ error: 'Failed to check in' });
    }
});

// POST /api/events/:id/walkin-checkin - Coordinator registers and checks in a walk-in attendee
app.post('/api/events/:id/walkin-checkin', verifyToken, async (req: Request, res: Response) => {
    const userProfile = (req as any).user?.profile;
    if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
        return res.status(403).json({ error: 'Only admins and event coordinators can register walk-ins' });
    }
    try {
        const eventId = req.params.id;
        const { name, email } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const eventDoc = await db.collection('opportunities').doc(eventId).get();
        const eventData = eventDoc.exists ? eventDoc.data() : null;
        const checkedInAt = new Date().toISOString();

        const walkinRsvp = {
            eventId,
            email: email ? String(email).toLowerCase().trim() : '',
            name: String(name).trim(),
            guests: 0,
            rsvpDate: checkedInAt,
            checkedIn: true,
            checkedInAt,
            checkedInMethod: 'coordinator-walkin',
            checkedInBy: (req as any).user?.uid,
            isWalkIn: true,
            eventTitle: eventData?.title || '',
            eventDate: eventData?.date || '',
        };
        const rsvpRef = await db.collection('public_rsvps').add(walkinRsvp);

        // Increment event check-in count
        if (eventDoc.exists) {
            await db.collection('opportunities').doc(eventId).update({
                checkinCount: admin.firestore.FieldValue.increment(1)
            });
        }

        console.log(`[WALKIN CHECKIN] Coordinator registered walk-in for event ${eventId}: ${String(name).trim()}`);
        res.json({ success: true, rsvpId: rsvpRef.id, ...walkinRsvp });
    } catch (error: any) {
        console.error('[WALKIN CHECKIN] Failed:', error);
        res.status(500).json({ error: 'Failed to register walk-in' });
    }
});

// --- CLIENT SURVEY ENDPOINTS ---
app.get('/api/client-surveys', verifyToken, async (req: Request, res: Response) => {
    try {
        const { eventId, surveyKitId } = req.query;
        let snap;
        if (eventId) {
            snap = await db.collection('clientSurveys')
                .where('eventId', '==', String(eventId))
                .get();
        } else if (surveyKitId) {
            snap = await db.collection('clientSurveys')
                .where('surveyKitId', '==', String(surveyKitId))
                .get();
        } else {
            snap = await db.collection('clientSurveys').get();
        }
        const results = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        results.sort((a: any, b: any) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
        res.json(results);
    } catch (e: any) {
        console.error('[CLIENT SURVEY] Failed to fetch:', e.message);
        res.status(500).json({ error: 'Failed to fetch surveys' });
    }
});

app.post('/api/client-surveys/create', verifyToken, async (req: Request, res: Response) => {
    try {
        const survey = req.body;
        survey.submittedAt = new Date().toISOString();
        survey.submittedByUid = (req as any).user?.uid;
        const ref = await db.collection('clientSurveys').add(survey);
        res.json({ id: ref.id, ...survey });
    } catch (e: any) {
        console.error('[CLIENT SURVEY] Failed to create:', e.message);
        res.status(500).json({ error: 'Failed to submit survey' });
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
        const { rating, category, message, suggestion, resourceId } = req.body;
        const feedback = {
            rating,
            category,
            message,
            suggestion,
            resourceId,
            submittedBy: (req as any).user?.uid,
            submittedAt: new Date().toISOString()
        };
        const ref = await db.collection('feedback').add(feedback);

        // Update resource average rating if this is service feedback (using transaction to avoid race)
        if (feedback.resourceId) {
            const resourceRef = db.collection('referral_resources').doc(feedback.resourceId);
            await db.runTransaction(async (tx) => {
                const resourceFeedback = await db.collection('feedback').where('resourceId', '==', feedback.resourceId).get();
                const ratings = resourceFeedback.docs.map(d => d.data().rating).filter((r: any) => typeof r === 'number' && r > 0);
                if (ratings.length === 0) return;
                const avgRating = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length;
                const resSnap = await tx.get(resourceRef);
                if (resSnap.exists) {
                    tx.update(resourceRef, {
                        averageRating: Math.round(avgRating * 10) / 10,
                        lastFeedbackDate: new Date().toISOString()
                    });
                }
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
        if (!req.body.name) return res.status(400).json({ error: 'Partner name required' });
        const partner = {
            ...pickFields(req.body, ['name', 'contactEmail', 'contactPhone', 'address', 'services', 'notes', 'website', 'type', 'description']),
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
        const { name, contactEmail, contactPhone, address, services, status, notes } = req.body;
        const updates = { name, contactEmail, contactPhone, address, services, status, notes };
        await db.collection('partner_agencies').doc(req.params.id).update(updates);
        res.json({ id: req.params.id, ...updates });
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
app.post('/api/ai/match-resources', verifyToken, rateLimit(10, 60000), async (req: Request, res: Response) => {
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

        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
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

// --- AI RESOURCE SEARCH ---
// When a resource isn't in our database, use Gemini to suggest external community resources
app.post('/api/resources/ai-search', verifyToken, rateLimit(10, 60000), async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return res.status(400).json({ error: 'Please provide a search query.' });
        }

        if (!ai || !GEMINI_API_KEY) {
            return res.status(503).json({ error: 'AI search is not configured. Set a Gemini API key.' });
        }

        // First check local DB for matches
        const resourcesSnap = await db.collection('referral_resources').get();
        const allResources = resourcesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const localMatches = allResources.filter((r: any) => {
            const searchText = `${r['Resource Name'] || ''} ${r['Service Category'] || ''} ${r['Key Offerings'] || ''} ${r['Target Population'] || ''}`.toLowerCase();
            return query.toLowerCase().split(' ').every((word: string) => searchText.includes(word));
        }).slice(0, 5);

        const prompt = `You are a community health resource navigator for Health Matters Clinic in Los Angeles, CA (Skid Row / Downtown LA area). Search the internet for real, currently operating community resources matching: "${query}"

${localMatches.length > 0 ? `We already have ${localMatches.length} matches in our database. Find ADDITIONAL resources beyond: ${localMatches.map((r: any) => r['Resource Name']).join(', ')}` : 'We have NO matches in our database for this search.'}

Search for 5-8 real, verified community resources in the Los Angeles area. Focus on resources near Downtown LA / Skid Row when relevant. Look up their actual current contact information.

Return a JSON array where each object uses these EXACT field names (matching our database schema):
[
  {
    "Resource Name": "Full official name of organization",
    "Service Category": "One of: Housing, Food Assistance, Medical, Mental Health, Substance Use Treatment, Legal Aid, Employment, Clothing, Hygiene, Transportation, Benefits Enrollment, Domestic Violence, Veteran Services, Youth Services, Senior Services, Disability Services, Education, Financial Assistance",
    "Key Offerings": "Detailed description of specific services offered (2-3 sentences)",
    "Eligibility Criteria": "Who qualifies — age, income, residency requirements, documentation needed",
    "Target Population": "Who this resource primarily serves (e.g., Adults experiencing homelessness, Families, Veterans)",
    "Languages Spoken": "Languages available (e.g., English, Spanish, Korean)",
    "Operation Hours": "Days and hours of operation (e.g., Mon-Fri 8am-5pm)",
    "Contact Phone": "Main phone number",
    "Contact Email": "Email address if available",
    "Address": "Full street address including city, state, zip",
    "Website": "Full URL",
    "SPA": "Service Planning Area number (1-8) based on LA County location, or empty string if unsure",
    "Intake / Referral Process Notes": "How to access services — walk-in, appointment, referral needed, etc.",
    "notes": "Any important additional info — wait times, capacity, special instructions"
  }
]

CRITICAL: Only include organizations you are confident actually exist and are currently operating. Verify names and addresses are real. Return ONLY the valid JSON array.`;

        // Use standard Gemini (faster + more reliable than Google Search grounding)
        const model = ai.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let suggestions: any[] = [];
        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                suggestions = JSON.parse(jsonMatch[0]);
            } else {
                const parsed = JSON.parse(text);
                suggestions = Array.isArray(parsed) ? parsed : [];
            }
        } catch (parseErr) {
            console.warn('[AI RESOURCE SEARCH] Failed to parse AI response:', text.slice(0, 200));
            suggestions = [];
        }

        // Normalize AI results to match ReferralResource schema
        const normalizedSuggestions = suggestions.map((s: any) => ({
            'Resource Name': s['Resource Name'] || s.name || '',
            'Service Category': s['Service Category'] || s.category || '',
            'Key Offerings': s['Key Offerings'] || s.description || '',
            'Eligibility Criteria': s['Eligibility Criteria'] || '',
            'Target Population': s['Target Population'] || '',
            'Languages Spoken': s['Languages Spoken'] || '',
            'Operation Hours': s['Operation Hours'] || s.hours || '',
            'Contact Phone': s['Contact Phone'] || s.phone || '',
            'Contact Email': s['Contact Email'] || '',
            'Address': s['Address'] || s.address || '',
            'Website': s['Website'] || s.website || '',
            'SPA': s['SPA'] || '',
            'Intake / Referral Process Notes': s['Intake / Referral Process Notes'] || s.notes || '',
            'Active / Inactive': 'checked',
            'Source': 'AI Search',
            source: 'ai'
        }));

        res.json({
            query,
            localMatches: localMatches.slice(0, 5).map((r: any) => ({
                id: r.id,
                'Resource Name': r['Resource Name'],
                'Service Category': r['Service Category'],
                'Contact Phone': r['Contact Phone'],
                'Address': r['Address'],
                source: 'database'
            })),
            aiSuggestions: normalizedSuggestions,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[AI RESOURCE SEARCH] Failed:', error);
        res.status(500).json({ error: 'AI resource search failed. Please try again.' });
    }
});

app.get('/api/ops/run/:shiftId/:userId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { shiftId, userId } = req.params;
        // Shared checklist: stored per-shift (not per-user) so all registered users see the same state
        const sharedDoc = await db.collection('mission_ops_runs').doc(shiftId).get();
        // Individual signoff: stored per-user
        const signoffDoc = await db.collection('mission_ops_signoffs').doc(`${shiftId}_${userId}`).get();
        const incidentsSnap = await db.collection('incidents').where('shiftId', '==', shiftId).get();

        const auditSnap = await db.collection('audit_logs').where('shiftId', '==', shiftId).get();
        const auditLogs = auditSnap.docs.map(d => ({id: d.id, ...d.data()} as any));
        auditLogs.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        const sharedData = sharedDoc.exists ? sharedDoc.data() : {};
        const signoffData = signoffDoc.exists ? signoffDoc.data() : {};

        res.json({
            opsRun: {
                id: shiftId,
                shiftId,
                userId,
                completedItems: sharedData?.completedItems || [],
                ...signoffData, // signedOff, signedOffAt, signatureStoragePath
            },
            incidents: incidentsSnap.docs.map(d => ({id: d.id, ...d.data()})),
            auditLogs,
        });
    } catch (e: any) {
        console.error('[OPS RUN] GET failed:', e.message);
        res.status(500).json({ error: 'Failed to load ops run data' });
    }
});
app.post('/api/ops/checklist', verifyToken, async (req: Request, res: Response) => {
    try {
        const { runId, completedItems } = req.body;
        // runId is now the shiftId — shared across all users
        await db.collection('mission_ops_runs').doc(runId).set({ completedItems, updatedAt: new Date().toISOString() }, { merge: true });
        res.json({ success: true });
    } catch (e: any) {
        console.error('[OPS CHECKLIST] POST failed:', e.message);
        res.status(500).json({ error: 'Failed to save checklist' });
    }
});

// POST /api/ops/signoff — Save shift signoff with signature (per-user)
app.post('/api/ops/signoff', verifyToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { shiftId, signatureData, completedItems } = req.body;
    if (!shiftId || !signatureData) return res.status(400).json({ error: 'shiftId and signatureData required' });

    const signoffId = `${shiftId}_${user.uid}`;
    try {
        // Upload signature to Cloud Storage if bucket available
        let signatureStoragePath: string | undefined;
        if (bucket) {
            try {
                signatureStoragePath = `signoffs/${signoffId}/signature.png`;
                const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
                await uploadToStorage(base64Data, signatureStoragePath, 'image/png');
            } catch { signatureStoragePath = undefined; }
        }

        // Save individual signoff to per-user collection
        await db.collection('mission_ops_signoffs').doc(signoffId).set({
            shiftId,
            userId: user.uid,
            signedOff: true,
            signedOffAt: new Date().toISOString(),
            signatureStoragePath: signatureStoragePath || null,
            signatureData: signatureStoragePath ? null : signatureData,
        }, { merge: true });

        // Also save final checklist state to shared ops run
        if (completedItems) {
            await db.collection('mission_ops_runs').doc(shiftId).set({ completedItems, updatedAt: new Date().toISOString() }, { merge: true });
        }

        console.log(`[OPS] Shift ${shiftId} signed off by ${user.uid}`);
        res.json({ success: true });
    } catch (error) {
        console.error('[OPS] Signoff failed:', error);
        res.status(500).json({ error: 'Failed to save signoff' });
    }
});

// ========================================
// EVENT DISTRIBUTION TRACKER
// ========================================

// GET /api/ops/tracker/:eventId — Load distribution tracker for an event
app.get('/api/ops/tracker/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const trackerDoc = await db.collection('event_trackers').doc(eventId).get();
        const distSnap = await db.collection('distribution_entries').where('eventId', '==', eventId).get();
        const distributions = distSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        distributions.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        const clientLogSnap = await db.collection('client_service_logs').where('eventId', '==', eventId).get();
        const clientLogs = clientLogSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        clientLogs.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        const trackerData = trackerDoc.exists ? trackerDoc.data() : { participantsServed: 0 };
        res.json({ ...trackerData, eventId, distributions, clientLogs });
    } catch (e: any) {
        console.error('[TRACKER] GET failed:', e.message);
        res.json({ eventId: req.params.eventId, participantsServed: 0, distributions: [], clientLogs: [] });
    }
});

// POST /api/ops/tracker/:eventId/distribution — Log a distribution entry
app.post('/api/ops/tracker/:eventId/distribution', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { eventId } = req.params;
        const { item, quantity, notes, shiftId } = req.body;
        if (!item || !quantity) return res.status(400).json({ error: 'item and quantity required' });
        const volunteerDoc = await db.collection('volunteers').doc(user.uid).get();
        const volunteerName = volunteerDoc.data()?.name || 'Unknown';
        const entry = {
            eventId,
            shiftId: shiftId || '',
            item,
            quantity: Number(quantity),
            notes: notes || null,
            loggedBy: user.uid,
            loggedByName: volunteerName,
            timestamp: new Date().toISOString(),
        };
        const ref = await db.collection('distribution_entries').add(entry);
        res.json({ id: ref.id, ...entry });
    } catch (e: any) {
        console.error('[TRACKER] POST distribution failed:', e.message);
        res.status(500).json({ error: 'Failed to log distribution' });
    }
});

// PUT /api/ops/tracker/:eventId/participants — Update participants served count
app.put('/api/ops/tracker/:eventId/participants', verifyToken, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const { participantsServed } = req.body;
        await db.collection('event_trackers').doc(eventId).set(
            { participantsServed: Number(participantsServed), updatedAt: new Date().toISOString() },
            { merge: true }
        );
        res.json({ success: true });
    } catch (e: any) {
        console.error('[TRACKER] PUT participants failed:', e.message);
        res.status(500).json({ error: 'Failed to update participants count' });
    }
});

// DELETE /api/ops/tracker/:eventId/distribution/:entryId — Delete a distribution entry
app.delete('/api/ops/tracker/:eventId/distribution/:entryId', verifyToken, async (req: Request, res: Response) => {
    try {
        await db.collection('distribution_entries').doc(req.params.entryId).delete();
        res.json({ success: true });
    } catch (e: any) {
        console.error('[TRACKER] DELETE distribution failed:', e.message);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

// POST /api/ops/tracker/:eventId/client-log — Log a client service entry (demographics + services)
app.post('/api/ops/tracker/:eventId/client-log', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { eventId } = req.params;
        const { genderIdentity, raceEthnicity, ageRange, zipCode,
            resourcesOnly, healthScreeningOnly, fullConsult, referralGiven,
            hivSelfTestToGo, hivSelfTestWithTeam, harmReductionSupplies,
            resourcesDistributed, notes, shiftId } = req.body;
        const volunteerDoc = await db.collection('volunteers').doc(user.uid).get();
        const volunteerName = volunteerDoc.data()?.name || 'Unknown';
        const entry = {
            eventId, shiftId: shiftId || '',
            genderIdentity: genderIdentity || '', raceEthnicity: raceEthnicity || '',
            ageRange: ageRange || '', zipCode: zipCode || '',
            resourcesOnly: !!resourcesOnly, healthScreeningOnly: !!healthScreeningOnly, fullConsult: !!fullConsult,
            referralGiven: !!referralGiven, hivSelfTestToGo: !!hivSelfTestToGo,
            hivSelfTestWithTeam: !!hivSelfTestWithTeam, harmReductionSupplies: !!harmReductionSupplies,
            resourcesDistributed: resourcesDistributed || [],
            notes: notes || null,
            loggedBy: user.uid, loggedByName: volunteerName,
            timestamp: new Date().toISOString(),
        };
        const ref = await db.collection('client_service_logs').add(entry);
        // Auto-increment participants served count
        await db.collection('event_trackers').doc(eventId).set(
            { participantsServed: admin.firestore.FieldValue.increment(1), updatedAt: new Date().toISOString() },
            { merge: true }
        );
        res.json({ id: ref.id, ...entry });
    } catch (e: any) {
        console.error('[TRACKER] POST client-log failed:', e.message);
        res.status(500).json({ error: 'Failed to log client service entry' });
    }
});

// DELETE /api/ops/tracker/:eventId/client-log/:logId — Delete a client service log entry
app.delete('/api/ops/tracker/:eventId/client-log/:logId', verifyToken, async (req: Request, res: Response) => {
    try {
        await db.collection('client_service_logs').doc(req.params.logId).delete();
        // Decrement participants served count
        await db.collection('event_trackers').doc(req.params.eventId).set(
            { participantsServed: admin.firestore.FieldValue.increment(-1), updatedAt: new Date().toISOString() },
            { merge: true }
        );
        res.json({ success: true });
    } catch (e: any) {
        console.error('[TRACKER] DELETE client-log failed:', e.message);
        res.status(500).json({ error: 'Failed to delete client log entry' });
    }
});

// GET /api/ops/itinerary/:eventId — Load saved itinerary
app.get('/api/ops/itinerary/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const doc = await db.collection('event_itineraries').doc(req.params.eventId).get();
        res.json(doc.exists ? doc.data() : { itinerary: null, setupDiagram: '' });
    } catch (e: any) {
        console.error('[ITINERARY] GET failed:', e.message);
        res.json({ itinerary: null, setupDiagram: '' });
    }
});

// PUT /api/ops/itinerary/:eventId — Save itinerary and diagram
app.put('/api/ops/itinerary/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { itinerary, setupDiagram } = req.body;
        await db.collection('event_itineraries').doc(req.params.eventId).set(
            { itinerary, setupDiagram, updatedAt: new Date().toISOString(), updatedBy: (req as any).user.uid },
            { merge: true }
        );
        res.json({ success: true });
    } catch (e: any) {
        console.error('[ITINERARY] PUT failed:', e.message);
        res.status(500).json({ error: 'Failed to save itinerary' });
    }
});

// ============================================================
// STATION ROTATION PLANNER ROUTES
// ============================================================

// GET /api/ops/station-rotation/:eventId — Load station rotation config
app.get('/api/ops/station-rotation/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const doc = await db.collection('station_rotation_configs').doc(req.params.eventId).get();
        if (!doc.exists) return res.json({ config: null });
        res.json({ config: { eventId: doc.id, ...doc.data() } });
    } catch (e: any) {
        console.error('[STATION-ROTATION] GET failed:', e.message);
        res.json({ config: null });
    }
});

// PUT /api/ops/station-rotation/:eventId — Save/update station rotation config
app.put('/api/ops/station-rotation/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const config = req.body;
        await db.collection('station_rotation_configs').doc(req.params.eventId).set(
            { ...config, updatedAt: new Date().toISOString(), updatedBy: (req as any).user.uid },
            { merge: true }
        );
        res.json({ success: true });
    } catch (e: any) {
        console.error('[STATION-ROTATION] PUT failed:', e.message);
        res.status(500).json({ error: 'Failed to save station rotation config' });
    }
});

// POST /api/ops/station-rotation/:eventId/reallocate — Log a reallocation entry
app.post('/api/ops/station-rotation/:eventId/reallocate', verifyToken, async (req: Request, res: Response) => {
    try {
        const entry = req.body;
        const docRef = db.collection('station_rotation_configs').doc(req.params.eventId);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Config not found' });

        const data = doc.data() || {};
        const log = data.reallocationLog || [];
        log.push({ ...entry, timestamp: new Date().toISOString() });

        await docRef.set({ reallocationLog: log, updatedAt: new Date().toISOString(), updatedBy: (req as any).user.uid }, { merge: true });
        res.json({ success: true });
    } catch (e: any) {
        console.error('[STATION-ROTATION] Reallocate failed:', e.message);
        res.status(500).json({ error: 'Failed to log reallocation' });
    }
});

// ============================================================
// VOLUNTEER SELF CHECK-IN / CHECK-OUT
// ============================================================

// POST /api/ops/volunteer-checkin/:eventId — Volunteer checks themselves in
app.post('/api/ops/volunteer-checkin/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { eventId } = req.params;
        const { shiftId } = req.body;
        const now = new Date().toISOString();

        // Store check-in record
        const checkinRef = db.collection('volunteer_checkins').doc(`${eventId}_${user.uid}`);
        const existing = await checkinRef.get();
        if (existing.exists && existing.data()?.checkedIn) {
            return res.json({ success: true, alreadyCheckedIn: true, ...existing.data() });
        }

        const checkinData = {
            volunteerId: user.uid,
            volunteerName: user.profile?.name || `${user.profile?.legalFirstName || ''} ${user.profile?.legalLastName || ''}`.trim(),
            volunteerRole: user.profile?.volunteerRole || user.profile?.role || 'Volunteer',
            eventId,
            shiftId: shiftId || '',
            checkedIn: true,
            checkedInAt: now,
            checkedOut: false,
            checkedOutAt: null,
            hoursServed: 0,
        };

        await checkinRef.set(checkinData, { merge: true });

        // Auto-assign buddy pair: find another checked-in volunteer without a pair
        const rotationDoc = await db.collection('station_rotation_configs').doc(eventId).get();
        let buddyAssignment: any = null;

        if (rotationDoc.exists) {
            const config = rotationDoc.data() || {};
            const buddyPairs: any[] = config.buddyPairs || [];
            const pairedIds = new Set<string>();
            buddyPairs.forEach((p: any) => { pairedIds.add(p.volunteerId1); pairedIds.add(p.volunteerId2); });

            if (!pairedIds.has(user.uid)) {
                // Find unpaired checked-in volunteers
                const checkinsSnap = await db.collection('volunteer_checkins')
                    .where('eventId', '==', eventId)
                    .get();

                const unpairedCheckedIn = checkinsSnap.docs
                    .filter(d => d.data().checkedIn === true && d.data().volunteerId !== user.uid && !pairedIds.has(d.data().volunteerId))
                    .map(d => d.data());

                if (unpairedCheckedIn.length > 0) {
                    const partner = unpairedCheckedIn[0];
                    const newPair = {
                        id: `pair-auto-${Date.now()}`,
                        volunteerId1: user.uid,
                        volunteerId2: partner.volunteerId,
                        currentRoles: { [user.uid]: 'hands_on', [partner.volunteerId]: 'observer' },
                        pairType: 'core',
                        label: `Pair ${String.fromCharCode(65 + buddyPairs.filter((p: any) => p.pairType === 'core').length)}`,
                    };
                    buddyPairs.push(newPair);
                    await db.collection('station_rotation_configs').doc(eventId).set(
                        { buddyPairs, updatedAt: now, updatedBy: 'auto-checkin' },
                        { merge: true }
                    );
                    buddyAssignment = {
                        pairId: newPair.id,
                        pairLabel: newPair.label,
                        buddyName: partner.volunteerName,
                        buddyRole: partner.volunteerRole,
                    };
                }
            }
        }

        console.log(`[VOLUNTEER-CHECKIN] ${checkinData.volunteerName} checked in to event ${eventId}`);
        res.json({ success: true, checkinData, buddyAssignment });
    } catch (e: any) {
        console.error('[VOLUNTEER-CHECKIN] Failed:', e.message);
        res.status(500).json({ error: 'Failed to check in' });
    }
});

// POST /api/ops/volunteer-checkout/:eventId — Volunteer checks themselves out
app.post('/api/ops/volunteer-checkout/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { eventId } = req.params;
        const now = new Date();

        const checkinRef = db.collection('volunteer_checkins').doc(`${eventId}_${user.uid}`);
        const doc = await checkinRef.get();
        if (!doc.exists || !doc.data()?.checkedIn) {
            return res.status(400).json({ error: 'Not checked in' });
        }

        const checkinData = doc.data()!;
        const checkedInAt = new Date(checkinData.checkedInAt);
        const hoursServed = Math.round(((now.getTime() - checkedInAt.getTime()) / (1000 * 60 * 60)) * 100) / 100;

        await checkinRef.update({
            checkedOut: true,
            checkedOutAt: now.toISOString(),
            hoursServed,
        });

        // Credit hours to volunteer profile
        try {
            const volRef = db.collection('volunteers').doc(user.uid);
            await volRef.update({
                hoursContributed: admin.firestore.FieldValue.increment(hoursServed),
                points: admin.firestore.FieldValue.increment(Math.round(hoursServed * 10)),
                lastActiveAt: now.toISOString(),
            });
        } catch { /* Non-critical */ }

        console.log(`[VOLUNTEER-CHECKOUT] ${checkinData.volunteerName} checked out after ${hoursServed}h`);
        res.json({ success: true, hoursServed, pointsEarned: Math.round(hoursServed * 10) });
    } catch (e: any) {
        console.error('[VOLUNTEER-CHECKOUT] Failed:', e.message);
        res.status(500).json({ error: 'Failed to check out' });
    }
});

// GET /api/volunteer/recent-checkins — Get volunteer's check-ins for today (for debrief prompt)
app.get('/api/volunteer/recent-checkins', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const todayStr = getPacificDate(0);

        // Find today's events where this volunteer was checked in
        const checkinsSnap = await db.collection('volunteer_checkins')
            .where('volunteerId', '==', user.uid)
            .get();

        const todayCheckins: any[] = checkinsSnap.docs
            .filter(doc => doc.data().eventId && doc.id.includes(todayStr.replace(/-/g, '')))
            .map(doc => ({ id: doc.id, ...doc.data() }));

        // If no checkins found by doc ID pattern, try matching by fetching event dates
        if (todayCheckins.length === 0) {
            const recentCheckins: any[] = checkinsSnap.docs
                .filter(doc => doc.data().checkedIn === true)
                .map(doc => ({ id: doc.id, ...doc.data() }));

            // Check which events are from today
            for (const checkin of recentCheckins) {
                try {
                    const eventDoc = await db.collection('opportunities').doc(checkin.eventId).get();
                    if (eventDoc.exists && eventDoc.data()?.date === todayStr) {
                        todayCheckins.push({ ...checkin, eventTitle: eventDoc.data()?.title || checkin.eventTitle });
                    }
                } catch {}
            }
        }

        // Check if volunteer already submitted a debrief for any of these events
        const filtered = [];
        for (const checkin of todayCheckins) {
            try {
                const responsesSnap = await db.collection('surveyResponses')
                    .where('formId', '==', 'volunteer-debrief')
                    .where('respondentId', '==', user.uid)
                    .where('eventId', '==', checkin.eventId)
                    .get();
                if (responsesSnap.empty) {
                    filtered.push(checkin);
                }
            } catch {
                filtered.push(checkin); // If query fails, still show the prompt
            }
        }

        res.json(filtered);
    } catch (error: any) {
        console.error('[RECENT-CHECKINS] Error:', error.message);
        res.json([]);
    }
});

// POST /api/volunteer/award-points — Award XP points to current user (daily quests, training, etc.)
app.post('/api/volunteer/award-points', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { points, source, date } = req.body;
        if (!points || typeof points !== 'number' || points <= 0 || points > 200) {
            return res.status(400).json({ error: 'Invalid points value (1-200)' });
        }
        if (!source) return res.status(400).json({ error: 'source is required' });
        // Deduplicate: check if already awarded for this source+date
        const dedupeId = `${user.uid}_${source}_${date || new Date().toISOString().slice(0, 10)}`;
        const existing = await db.collection('points_awards').doc(dedupeId).get();
        if (existing.exists) {
            return res.json({ success: true, alreadyAwarded: true, points: 0 });
        }
        // Award points atomically
        const volRef = db.collection('volunteers').doc(user.uid);
        await volRef.update({
            points: admin.firestore.FieldValue.increment(points),
        });
        // Record award for deduplication
        await db.collection('points_awards').doc(dedupeId).set({
            userId: user.uid,
            points,
            source,
            date: date || new Date().toISOString().slice(0, 10),
            awardedAt: new Date().toISOString(),
        });
        console.log(`[POINTS] Awarded ${points} XP to ${user.uid} for ${source}`);
        res.json({ success: true, alreadyAwarded: false, points });
    } catch (e: any) {
        console.error('[POINTS] Award failed:', e.message);
        res.status(500).json({ error: 'Failed to award points' });
    }
});

// GET /api/ops/volunteer-checkin/:eventId/status — Get current volunteer's check-in status
app.get('/api/ops/volunteer-checkin/:eventId/status', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const doc = await db.collection('volunteer_checkins').doc(`${req.params.eventId}_${user.uid}`).get();
        if (!doc.exists) return res.json({ checkedIn: false });
        res.json(doc.data());
    } catch (e: any) {
        res.json({ checkedIn: false });
    }
});

// GET /api/ops/volunteer-checkin/:eventId/all — Get all check-ins for an event (for leads)
app.get('/api/ops/volunteer-checkin/:eventId/all', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('volunteer_checkins')
            .where('eventId', '==', req.params.eventId)
            .get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e: any) {
        res.json([]);
    }
});

// POST /api/ops/rotation-notify/:eventId — Send rotation notification to volunteers
app.post('/api/ops/rotation-notify/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const { slotIndex, message } = req.body;
        const now = new Date().toISOString();

        // Store notification
        await db.collection('rotation_notifications').add({
            eventId,
            slotIndex,
            message,
            createdAt: now,
            createdBy: (req as any).user.uid,
        });

        // Create in-app notifications for all checked-in volunteers
        const checkinsSnap = await db.collection('volunteer_checkins')
            .where('eventId', '==', eventId)
            .get();
        const activeCheckins = checkinsSnap.docs.filter(d => d.data().checkedIn === true && d.data().checkedOut === false);

        const batch = db.batch();
        activeCheckins.forEach(doc => {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                userId: doc.data().volunteerId,
                type: 'rotation_change',
                title: 'Station Rotation',
                message,
                eventId,
                read: false,
                createdAt: now,
            });
        });
        await batch.commit();

        res.json({ success: true, notifiedCount: activeCheckins.length });
    } catch (e: any) {
        console.error('[ROTATION-NOTIFY] Failed:', e.message);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// ============================================================
// INVENTORY & EVENT LOADOUT ROUTES
// ============================================================

// GET /api/inventory — List all inventory items
app.get('/api/inventory', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('inventory').orderBy('category').get();
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(items);
    } catch (e: any) {
        console.error('[INVENTORY] GET failed:', e.message);
        res.json([]);
    }
});

// POST /api/inventory — Add/update inventory item (upsert by ID)
app.post('/api/inventory', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const item = req.body;
        const id = item.id || db.collection('inventory').doc().id;
        await db.collection('inventory').doc(id).set(
            { ...item, id, lastUpdated: new Date().toISOString(), updatedBy: (req as any).user.uid },
            { merge: true }
        );
        res.json({ id, ...item });
    } catch (e: any) {
        console.error('[INVENTORY] POST failed:', e.message);
        res.status(500).json({ error: 'Failed to save inventory item' });
    }
});

// POST /api/inventory/bulk — Bulk import inventory items
app.post('/api/inventory/bulk', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const items: any[] = (req.body.items || []).slice(0, 450); // Firestore batch limit is 500
        const batch = db.batch();
        const now = new Date().toISOString();
        const uid = (req as any).user.uid;
        items.forEach((item: any) => {
            const id = item.id || db.collection('inventory').doc().id;
            const ref = db.collection('inventory').doc(id);
            batch.set(ref, { ...item, id, lastUpdated: now, updatedBy: uid }, { merge: true });
        });
        await batch.commit();
        res.json({ success: true, count: items.length });
    } catch (e: any) {
        console.error('[INVENTORY] BULK failed:', e.message);
        res.status(500).json({ error: 'Failed to bulk import inventory' });
    }
});

// GET /api/events/:eventId/loadout — Get event loadout
app.get('/api/events/:eventId/loadout', verifyToken, async (req: Request, res: Response) => {
    try {
        const doc = await db.collection('event_loadouts').doc(req.params.eventId).get();
        if (!doc.exists) return res.json({ loadout: null });
        res.json({ loadout: { eventId: doc.id, ...doc.data() } });
    } catch (e: any) {
        console.error('[LOADOUT] GET failed:', e.message);
        res.json({ loadout: null });
    }
});

// PUT /api/events/:eventId/loadout — Save/update event loadout
app.put('/api/events/:eventId/loadout', verifyToken, async (req: Request, res: Response) => {
    try {
        const loadout = req.body;
        await db.collection('event_loadouts').doc(req.params.eventId).set(
            { ...loadout, eventId: req.params.eventId, updatedAt: new Date().toISOString(), updatedBy: (req as any).user.uid },
            { merge: true }
        );
        res.json({ success: true });
    } catch (e: any) {
        console.error('[LOADOUT] PUT failed:', e.message);
        res.status(500).json({ error: 'Failed to save event loadout' });
    }
});

// GET /api/loadout-templates — List loadout templates
app.get('/api/loadout-templates', verifyToken, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('loadout_templates').orderBy('name').get();
        const templates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(templates);
    } catch (e: any) {
        console.error('[LOADOUT-TEMPLATES] GET failed:', e.message);
        res.json([]);
    }
});

// POST /api/loadout-templates — Save a loadout template
app.post('/api/loadout-templates', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const template = req.body;
        const id = template.id || db.collection('loadout_templates').doc().id;
        await db.collection('loadout_templates').doc(id).set(
            { ...template, id, createdAt: new Date().toISOString(), createdBy: (req as any).user.uid },
            { merge: true }
        );
        res.json({ id, ...template });
    } catch (e: any) {
        console.error('[LOADOUT-TEMPLATES] POST failed:', e.message);
        res.status(500).json({ error: 'Failed to save loadout template' });
    }
});

// ============================================================
// TEST SMS ENDPOINT
// ============================================================
app.post('/api/admin/test-sms', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { phoneNumber, message } = req.body;
        if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
        const to = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`;
        const body = message || 'HMC Street Medicine Outreach Reminder: Join us this Saturday for our community health event! Reply STOP to opt out.';
        const result = await sendSMS(null, to, body);
        console.log(`[TEST-SMS] Sent to ${to}: ${JSON.stringify(result)}`);
        res.json({ success: result.sent, ...result, to });
    } catch (e: any) {
        console.error('[TEST-SMS] Failed:', e.message);
        res.status(500).json({ error: 'Failed to send test SMS', details: e.message });
    }
});

// ============================================================
// REFERRAL SUBMISSION — EMAIL / FORM / CALL HANDLING
// ============================================================

// POST /api/referrals/submit-to-agency — Auto-send referral to partner agency
app.post('/api/referrals/submit-to-agency', verifyToken, async (req: Request, res: Response) => {
    try {
        const { referralId, method, clientData, resourceData, volunteerName } = req.body;
        if (!referralId || !method) return res.status(400).json({ error: 'referralId and method required' });

        const now = new Date().toISOString();
        const referralRef = db.collection('referrals').doc(referralId);

        if (method === 'email') {
            // Send referral to internal review queue first — NOT directly to agency
            const agencyEmail = resourceData?.['Contact Email'] || 'N/A';
            const agencyName = resourceData?.['Resource Name'] || 'Unknown Agency';
            const internalReviewEmail = 'referrals@healthmatters.clinic';

            const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim();
            const subject = `[REVIEW] Referral to ${agencyName} — ${clientName}`;
            const html = `${emailHeader('Referral for Review')}
                <p><strong>⚠️ This referral requires review before being sent to the agency.</strong></p>
                <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0 0 4px; font-weight: bold;">Agency: ${agencyName}</p>
                    <p style="margin: 0;">Agency Email: ${agencyEmail}</p>
                    ${resourceData?.['Contact Phone'] ? `<p style="margin: 4px 0 0;">Agency Phone: ${resourceData['Contact Phone']}</p>` : ''}
                </div>
                <div style="background: #f0f9ff; padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR};">
                    <p style="margin: 0 0 8px;"><strong>Client Name:</strong> ${clientName}</p>
                    ${clientData?.dob ? `<p style="margin: 0 0 8px;"><strong>Date of Birth:</strong> ${clientData.dob}</p>` : ''}
                    ${clientData?.phone ? `<p style="margin: 0 0 8px;"><strong>Phone:</strong> ${clientData.phone}</p>` : ''}
                    ${clientData?.email ? `<p style="margin: 0 0 8px;"><strong>Email:</strong> ${clientData.email}</p>` : ''}
                    ${clientData?.primaryLanguage ? `<p style="margin: 0 0 8px;"><strong>Primary Language:</strong> ${clientData.primaryLanguage}</p>` : ''}
                    <p style="margin: 0 0 8px;"><strong>Service Needed:</strong> ${resourceData?.['Service Category'] || 'General assistance'}</p>
                    ${clientData?.needs ? `<p style="margin: 0;"><strong>Identified Needs:</strong> ${Object.entries(clientData.needs).filter(([, v]) => v).map(([k]) => k).join(', ')}</p>` : ''}
                </div>
                <p><strong>Referred By:</strong> ${volunteerName || 'HMC Volunteer'}</p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">Please review this referral and forward to the agency when approved.</p>
            ${emailFooter()}`;

            if (EMAIL_SERVICE_URL) {
                await fetch(EMAIL_SERVICE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'prerendered', toEmail: internalReviewEmail, subject, html, text: `Referral for review: ${clientName} → ${agencyName}` }),
                });
            }

            await referralRef.update({
                status: 'Pending Review',
                firstContactDate: now,
                firstContactBy: (req as any).user.uid,
                submissionMethod: 'email',
                submittedAt: now,
                updatedAt: now,
                agencyEmail,
            });

            console.log(`[REFERRAL] Sent to internal review (${internalReviewEmail}) for referral ${referralId} → ${agencyName}`);
            res.json({ success: true, method: 'email', sentTo: internalReviewEmail, agencyEmail });

        } else if (method === 'call') {
            // Log that a call is needed — schedule Monday follow-up
            const nextMonday = new Date();
            const dayOfWeek = nextMonday.getDay();
            const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
            nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
            nextMonday.setHours(9, 0, 0, 0);

            await referralRef.update({
                submissionMethod: 'call',
                followUpDate: nextMonday.toISOString(),
                followUpNotes: `Call ${resourceData?.['Resource Name'] || 'agency'} at ${resourceData?.['Contact Phone'] || 'N/A'}. Intake notes: ${resourceData?.['Intake / Referral Process Notes'] || 'Standard intake process.'}`,
                updatedAt: now,
            });

            // Create a follow-up notification for the assigned volunteer
            await db.collection('notifications').add({
                userId: (req as any).user.uid,
                type: 'referral_followup',
                title: 'Referral Follow-Up Required',
                message: `Call ${resourceData?.['Resource Name']} at ${resourceData?.['Contact Phone']} for client referral. ${resourceData?.['Intake / Referral Process Notes'] || ''}`,
                referralId,
                scheduledFor: nextMonday.toISOString(),
                read: false,
                createdAt: now,
            });

            console.log(`[REFERRAL] Call follow-up scheduled for ${nextMonday.toISOString()}`);
            res.json({ success: true, method: 'call', followUpDate: nextMonday.toISOString(), phoneNumber: resourceData?.['Contact Phone'] });

        } else if (method === 'form') {
            // Mark as pending form submission — volunteer will fill out agency's form
            await referralRef.update({
                submissionMethod: 'form',
                formSubmitted: false,
                updatedAt: now,
            });

            res.json({
                success: true,
                method: 'form',
                intakeNotes: resourceData?.['Intake / Referral Process Notes'] || 'Contact agency for intake form.',
                website: resourceData?.['Website'] || '',
                phone: resourceData?.['Contact Phone'] || '',
                email: resourceData?.['Contact Email'] || '',
            });
        } else {
            res.status(400).json({ error: 'Invalid method. Use: email, call, or form' });
        }
    } catch (e: any) {
        console.error('[REFERRAL] Submit to agency failed:', e.message);
        res.status(500).json({ error: 'Failed to submit referral' });
    }
});

// ============================================================
// WARM HANDOFF AUTOMATION — Cron checks for aging referrals
// ============================================================
async function checkReferralSLA(): Promise<void> {
    try {
        const snap = await db.collection('referrals')
            .where('status', 'in', ['Pending', 'In Progress'])
            .get();

        const now = new Date();
        const batch = db.batch();
        let notifications = 0;

        for (const doc of snap.docs) {
            const referral = doc.data();
            const created = new Date(referral.createdAt);
            const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
            const assignedTo = referral.referredBy || referral.assignedTo;

            // Skip if already has first contact
            if (referral.firstContactDate) continue;

            // 24-hour nudge
            if (hoursElapsed >= 24 && hoursElapsed < 25 && !referral._nudge24h) {
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    userId: assignedTo,
                    type: 'referral_sla_warning',
                    title: 'Referral Follow-Up Needed',
                    message: `24h since referral for ${referral.clientName} to ${referral.referredTo}. Please make first contact.`,
                    referralId: doc.id,
                    read: false,
                    createdAt: now.toISOString(),
                });
                batch.update(doc.ref, { _nudge24h: true });
                notifications++;
            }

            // 48-hour escalation to coordinators
            if (hoursElapsed >= 48 && hoursElapsed < 49 && !referral._nudge48h) {
                // Notify coordinators
                const coordSnap = await db.collection('volunteers')
                    .where('status', '==', 'active')
                    .get();
                const coordinators = coordSnap.docs.filter(d => {
                    const role = d.data().volunteerRole || d.data().role || '';
                    return role.includes('Coordinator') || role.includes('Lead') || d.data().isAdmin;
                });
                for (const coord of coordinators.slice(0, 5)) {
                    const notifRef = db.collection('notifications').doc();
                    batch.set(notifRef, {
                        userId: coord.id,
                        type: 'referral_sla_escalation',
                        title: 'Referral SLA Escalation — 48h',
                        message: `No contact logged for ${referral.clientName} referral to ${referral.referredTo}. ${Math.round(hoursElapsed)}h elapsed. Please follow up.`,
                        referralId: doc.id,
                        read: false,
                        createdAt: now.toISOString(),
                    });
                }
                batch.update(doc.ref, { _nudge48h: true });
                notifications++;
            }

            // 72-hour non-compliant alert to admins
            if (hoursElapsed >= 72 && !referral._nudge72h) {
                batch.update(doc.ref, {
                    slaComplianceStatus: 'Non-Compliant',
                    _nudge72h: true,
                });
                // Alert admins
                const adminSnap = await db.collection('volunteers')
                    .where('isAdmin', '==', true)
                    .get();
                for (const admin of adminSnap.docs) {
                    const notifRef = db.collection('notifications').doc();
                    batch.set(notifRef, {
                        userId: admin.id,
                        type: 'referral_sla_breach',
                        title: 'SLA BREACH — 72h No Contact',
                        message: `Referral for ${referral.clientName} to ${referral.referredTo} has breached the 72-hour SLA. No first contact logged.`,
                        referralId: doc.id,
                        read: false,
                        createdAt: now.toISOString(),
                    });
                }
                notifications++;
            }
        }

        if (notifications > 0) {
            await batch.commit();
            console.log(`[SLA-CHECK] Sent ${notifications} referral SLA notifications`);
        }
    } catch (e: any) {
        console.error('[SLA-CHECK] Failed:', e.message);
    }
}

// Run SLA check every hour
cron.schedule('0 * * * *', () => {
    checkReferralSLA().catch(e => console.error('[CRON] SLA check failed:', e));
});

app.put('/api/volunteer', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const updates = req.body;
        const docId = user.uid;

        // Check if this is an onboarding completion (new user finishing their application)
        const existingDoc = await db.collection('volunteers').doc(docId).get();
        const existingData = existingDoc.exists ? existingDoc.data() : null;
        // Detect onboarding completion: only fire when user is transitioning FROM isNewUser=true
        // TO completing onboarding (isNewUser=false), and guard with _onboardingAlertSent to prevent re-firing
        const isOnboardingCompletion = existingData &&
            existingData.isNewUser === true &&
            updates.isNewUser === false &&
            !existingData._onboardingAlertSent;

        let finalUpdates: any;
        if (isOnboardingCompletion) {
            // Allow all onboarding fields through — only strip isAdmin for safety
            const { isAdmin, ...onboardingUpdates } = updates;
            finalUpdates = onboardingUpdates;
        } else {
            // SECURITY: Whitelist fields volunteers can update on their own profile
            // NOTE: coreVolunteerStatus and eventEligibility are allowed through
            // because TrainingAcademy sets them when a volunteer completes training.
            // The backend registration endpoint independently validates training gates.
            const { isAdmin, isTeamLead, compliance, points, hoursContributed, status,
                    applicationStatus,
                    volunteerRole, role, appliedRole, appliedRoleStatus,
                    ...safeUpdates } = updates;
            finalUpdates = safeUpdates;
        }

        // Encrypt SSN if being updated
        if (finalUpdates.ssn) finalUpdates.ssn = encryptSSN(finalUpdates.ssn);
        // Ensure they can only update their own doc
        // If this is an onboarding completion, also set the guard flag to prevent duplicate alerts
        if (isOnboardingCompletion) {
            finalUpdates._onboardingAlertSent = true;
        }
        await db.collection('volunteers').doc(docId).set(finalUpdates, { merge: true });
        const updated = (await db.collection('volunteers').doc(docId).get()).data();

        // Send admin notifications when a pre-auth user completes their application
        if (isOnboardingCompletion) {
            const volName = updates.name || `${updates.legalFirstName || ''} ${updates.legalLastName || ''}`.trim() || 'New Applicant';
            const volEmail = updates.email || user.profile?.email || '';
            const volAppliedRole = updates.appliedRole || 'HMC Champion';

            // Send application confirmation email to the applicant
            try {
                await EmailService.send('application_received', {
                    toEmail: volEmail,
                    volunteerName: volName,
                    appliedRole: volAppliedRole,
                    applicationId: docId.substring(0, 12).toUpperCase(),
                });
            } catch (emailErr) {
                console.error('[ONBOARDING] Failed to send application confirmation email:', emailErr);
            }

            // Notify ALL admins
            for (const adminEmail of EMAIL_CONFIG.ADMIN_EMAILS) {
                try {
                    await EmailService.send('admin_new_applicant', {
                        toEmail: adminEmail,
                        volunteerName: volName,
                        volunteerEmail: volEmail,
                        appliedRole: volAppliedRole,
                        applicationId: docId.substring(0, 12).toUpperCase(),
                    });
                    console.log(`[ONBOARDING] Sent admin notification to ${maskEmail(adminEmail)} for completed application: ${maskEmail(volEmail)}`);
                } catch (adminEmailErr) {
                    console.error(`[ONBOARDING] Failed to send admin notification to ${maskEmail(adminEmail)}:`, adminEmailErr);
                }
            }

            // In-app notification
            try {
                await db.collection('admin_notifications').add({
                    type: 'new_application',
                    volunteerName: volName,
                    volunteerEmail: volEmail,
                    volunteerId: docId,
                    appliedRole: volAppliedRole,
                    status: 'unread',
                    createdAt: new Date().toISOString(),
                });
            } catch (notifErr) {
                console.error('[ONBOARDING] Failed to create in-app notification:', notifErr);
            }

            console.log(`[ONBOARDING] Pre-auth user ${maskEmail(volEmail)} completed full application as ${volAppliedRole}`);
        }

        res.json({ ...updated, id: docId });
    } catch (error: any) {
        console.error('[VOLUNTEER] Failed to update profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Admin: identify volunteers with incomplete application data
// Returns volunteers who have accounts but are missing key onboarding fields
app.get('/api/admin/incomplete-profiles', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const allVols = await db.collection('volunteers').get();
        const incomplete: any[] = [];
        const requiredFields = ['legalFirstName', 'legalLastName', 'phone', 'dob', 'email'];

        for (const doc of allVols.docs) {
            const data = doc.data();
            // Skip admins and truly new users who haven't started onboarding
            if (data.isAdmin && !data.applicationStatus) continue;
            if (data.isNewUser && !data.applicationStatus) continue;

            const missingFields = requiredFields.filter(f => !data[f]);
            const hasNoStatus = !data.status;
            const isBlankApp = missingFields.length >= 3; // Missing 3+ required fields = blank application

            if (isBlankApp || hasNoStatus) {
                incomplete.push({
                    id: doc.id,
                    name: data.name || data.email || doc.id,
                    email: data.email || 'unknown',
                    status: data.status || 'not set',
                    applicationStatus: data.applicationStatus || 'not set',
                    missingFields,
                    hasOnboardingData: !!data.legalFirstName,
                    isNewUser: data.isNewUser || false,
                    createdAt: data.joinedDate || data.createdAt || 'unknown',
                });
            }
        }

        // Also auto-heal status field for all affected volunteers
        let healed = 0;
        for (const doc of allVols.docs) {
            const data = doc.data();
            if (!data.status && data.applicationStatus) {
                await db.collection('volunteers').doc(doc.id).update({ status: 'active' });
                healed++;
            }
        }

        res.json({ incomplete, totalVolunteers: allVols.size, healedStatusCount: healed });
    } catch (error) {
        console.error('[ADMIN] Failed to check incomplete profiles:', error);
        res.status(500).json({ error: 'Failed to check profiles' });
    }
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
            db.collection('messages').where('senderId', '==', userId).get(),
            db.collection('messages').where('recipientId', '==', userId).get(),
            db.collection('messages').where('recipientId', '==', 'general').get()
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

// --- SSE TICKET EXCHANGE (short-lived, single-use) ---
const sseTickets = new Map<string, { uid: string; expires: number }>();
app.post('/api/messages/sse-ticket', verifyToken, async (req: Request, res: Response) => {
    const user = (req as any).user;
    const ticket = crypto.randomBytes(32).toString('hex');
    sseTickets.set(ticket, { uid: user.uid, expires: Date.now() + 30_000 }); // 30s TTL
    res.json({ ticket });
});

// --- SSE STREAM ENDPOINT ---
app.get('/api/messages/stream', async (req: Request, res: Response) => {
    // Use short-lived ticket instead of session token in URL
    const ticket = req.query.ticket as string;
    const token = req.query.token as string; // legacy fallback
    let userId: string;

    try {
        if (ticket && sseTickets.has(ticket)) {
            const t = sseTickets.get(ticket)!;
            sseTickets.delete(ticket); // single-use
            if (Date.now() > t.expires) return res.status(403).json({ error: 'Ticket expired' });
            userId = t.uid;
        } else if (token) {
            // Legacy fallback for existing clients
            const sessionDoc = await db.collection('sessions').doc(token).get();
            if (!sessionDoc.exists) return res.status(403).json({ error: 'Invalid session' });
            const session = sessionDoc.data()!;
            if (new Date() > session.expires.toDate()) return res.status(403).json({ error: 'Session expired' });
            userId = session.uid;
        } else {
            return res.status(403).json({ error: 'No ticket or token' });
        }

        // Verify user exists
        const userDoc = await db.collection('volunteers').doc(userId).get();
        if (!userDoc.exists) return res.status(403).json({ error: 'User not found' });

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
        if (!res.headersSent) {
            res.status(500).json({ error: 'SSE connection failed' });
        }
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
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

app.post('/api/opportunities', verifyToken, async (req: Request, res: Response) => {
    try {
        const userProfile = (req as any).user?.profile;
        if (!userProfile?.isAdmin && !EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
            return res.status(403).json({ error: 'Only admins and event management roles can create events' });
        }
        const { opportunity } = req.body;
        // Auto-approve events created by admins and event management roles
        if (userProfile?.isAdmin || EVENT_MANAGEMENT_ROLES.includes(userProfile?.role)) {
            opportunity.approvalStatus = 'approved';
            opportunity.approvedBy = userProfile?.id || 'system';
            opportunity.approvedAt = new Date().toISOString();
        }
        if (!opportunity.locationCoordinates) {
            opportunity.locationCoordinates = { lat: 34.0522 + (Math.random() - 0.5) * 0.1, lng: -118.2437 + (Math.random() - 0.5) * 0.1 };
        }
        if (!opportunity.rsvps) {
            opportunity.rsvps = [];
        }
        const docRef = await db.collection('opportunities').add(opportunity);
        const opportunityId = docRef.id;

        // Create shifts for each staffing quota
        const createdShifts: any[] = [];
        const eventDate = opportunity.date || getPacificDate();
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
            'checklistOverride', 'serviceOfferingIds', 'equipment', 'checklist', 'requiresClinicalLead'
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
        if (!csvData || typeof csvData !== 'string') return res.status(400).json({ error: 'csvData is required' });
        if (csvData.length > MAX_CSV_SIZE) return res.status(400).json({ error: `CSV too large (max ${MAX_CSV_SIZE / 1024 / 1024}MB)` });
        const csvContent = Buffer.from(csvData, 'base64').toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length > MAX_CSV_ROWS) return res.status(400).json({ error: `Too many rows (max ${MAX_CSV_ROWS})` });
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
            const eventDate = row.date || row.Date || row['Event Date'] || getPacificDate();
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

            // Parse time fields from CSV
            const eventTime = row.time || row.Time || row['Event Time'] || '';
            const csvStartTime = row.startTime || row['Start Time'] || '';
            const csvEndTime = row.endTime || row['End Time'] || '';
            let startTimePart = '09:00:00';
            let endTimePart = '14:00:00';
            if (csvStartTime) {
                const parsed = parseEventTime(csvStartTime);
                startTimePart = parsed.startTime;
            } else if (eventTime) {
                const parsed = parseEventTime(eventTime);
                startTimePart = parsed.startTime;
                if (parsed.hasEndTime) endTimePart = parsed.endTime;
            }
            if (csvEndTime) {
                const parsed = parseEventTime(csvEndTime);
                endTimePart = parsed.startTime; // parseEventTime returns the time in startTime
            }

            const opportunity = {
                title: eventTitle,
                description,
                category,
                serviceLocation: eventLocation,
                date: eventDate,
                time: eventTime || `${startTimePart} - ${endTimePart}`,
                startTime: startTimePart,
                endTime: endTimePart,
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
            const defaultStartTime = `${eventDate}T${startTimePart}`;
            const defaultEndTime = `${eventDate}T${endTimePart}`;

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

        // Trigger new opportunity alerts (w3) for each imported event (non-blocking)
        for (const event of importedEvents) {
          executeNewOpportunityAlert({
            id: event.id,
            title: event.title,
            date: event.date,
            staffingQuotas: event.staffingQuotas,
          }).catch(e => console.error('[WORKFLOW] New opportunity alert failed for', event.title, e));
        }

        res.json({
            success: true,
            importedCount: importedEvents.length,
            shiftsCreated: createdShifts.length,
            events: importedEvents,
            shifts: createdShifts
        });
    } catch (error: any) {
        console.error('[EVENTS] Bulk import failed:', error);
        res.status(500).json({ error: 'Failed to import events' });
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

        const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
        if (!APPS_SCRIPT_URL) {
            return res.status(400).json({ error: 'Event Finder sync is not configured. Add APPS_SCRIPT_URL to your environment variables in Cloud Run.' });
        }
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

        // Get existing opportunities to avoid duplicates
        const existingSnap = await db.collection('opportunities').get();
        const existingEvents = existingSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

        // Normalize title for fuzzy matching: lowercase, strip punctuation, collapse whitespace
        const normalizeTitle = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        // Normalize date to YYYY-MM-DD regardless of input format
        const normalizeDate = (d: string) => {
            if (!d) return '';
            // Handle "MM/DD/YYYY", "YYYY-MM-DD", "YYYY-M-D", etc.
            const parts = d.includes('/') ? d.split('/') : d.split('-');
            if (parts.length === 3) {
                const [a, b, c] = parts;
                // If first part is 4 digits, assume YYYY-MM-DD
                if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
                // Otherwise assume MM/DD/YYYY
                return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
            }
            return d;
        };

        // Build lookup indexes for fast dedup
        const bySyncSourceId = new Map<string, any>();
        const byTitleDate = new Map<string, any>();
        const byDateLocation = new Map<string, any>();
        for (const e of existingEvents) {
            if (e.syncSourceId) bySyncSourceId.set(e.syncSourceId, e);
            const nd = normalizeDate(e.date);
            const nt = normalizeTitle(e.title);
            if (nt && nd) byTitleDate.set(`${nt}|${nd}`, e);
            // Also index by date + normalized location for broader matching
            const loc = normalizeTitle(e.serviceLocation || e.location || e.address || '');
            if (nd && loc) byDateLocation.set(`${nd}|${loc}`, e);
        }

        let synced = 0;
        let skipped = 0;
        let updated = 0;
        const syncedEvents: any[] = [];
        const syncedShifts: any[] = [];

        for (const event of data.events) {
            if (!event.title || !event.date) { skipped++; continue; }

            const normTitle = normalizeTitle(event.title);
            const normDate = normalizeDate(event.date);
            const normLocation = normalizeTitle(event.location || event.address || '');

            // Multi-strategy dedup: check syncSourceId, title+date, and date+location
            const existing =
                (event.id ? bySyncSourceId.get(event.id) : null) ||
                byTitleDate.get(`${normTitle}|${normDate}`) ||
                // Title contains check: catch "Street Medicine Outreach" matching "HMC Street Medicine Outreach - Skid Row"
                existingEvents.find(e => {
                    const eTitle = normalizeTitle(e.title);
                    const eDate = normalizeDate(e.date);
                    return eDate === normDate && (eTitle.includes(normTitle) || normTitle.includes(eTitle));
                }) ||
                // Same date + same location = very likely same event
                (normLocation && normLocation.length > 3 ? byDateLocation.get(`${normDate}|${normLocation}`) : null);

            if (existing) {
                // Always refresh key fields from Event Finder on re-sync
                const updates: any = {};
                // Backfill syncSourceId if this event was matched by title/date/location but didn't have one
                if (event.id && !existing.syncSourceId) {
                    updates.syncSourceId = event.id;
                    updates.syncSource = 'event-finder-tool';
                }
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
        res.status(500).json({ error: 'Failed to sync events' });
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
    res.status(500).json({ error: 'Failed to send invite' });
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

    // Use a Firestore transaction to atomically update volunteer, shift, and opportunity
    await db.runTransaction(async (transaction) => {
      // --- Read phase: fetch all documents inside the transaction ---
      const volRef = db.collection('volunteers').doc(volunteerId);
      const volSnap = await transaction.get(volRef);

      let shiftSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      let shiftData: any = null;
      const shiftRef = shiftId ? db.collection('shifts').doc(shiftId) : null;
      if (shiftRef) {
        shiftSnap = await transaction.get(shiftRef);
        shiftData = shiftSnap.exists ? shiftSnap.data() : null;
      }

      let oppSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      let oppData: any = null;
      const oppRef = shiftId ? db.collection('opportunities').doc(eventId) : null;
      if (oppRef) {
        oppSnap = await transaction.get(oppRef);
        oppData = oppSnap.exists ? oppSnap.data() : null;
      }

      // --- Write phase ---
      // Update shift: remove volunteer and decrement count (if shift provided and volunteer is assigned)
      const isAssigned = shiftData ? (shiftData.assignedVolunteerIds || []).includes(volunteerId) : false;
      if (shiftRef && shiftSnap?.exists && isAssigned) {
        transaction.update(shiftRef, {
          slotsFilled: admin.firestore.FieldValue.increment(-1),
          assignedVolunteerIds: admin.firestore.FieldValue.arrayRemove(volunteerId),
        });

        // Update opportunity staffingQuotas
        if (oppRef && oppData) {
          const updatedQuotas = (oppData.staffingQuotas || []).map((q: any) =>
            q.role === shiftData.roleType ? { ...q, filled: Math.max(0, (q.filled || 0) - 1) } : q
          );
          transaction.update(oppRef, {
            staffingQuotas: updatedQuotas,
            slotsFilled: admin.firestore.FieldValue.increment(-1),
          });
        }
      }

      // Remove from volunteer's assignedShiftIds and rsvpedEventIds
      if (volSnap.exists) {
        const volData = volSnap.data()!;
        const updates: any = {
          rsvpedEventIds: (volData.rsvpedEventIds || []).filter((id: string) => id !== eventId),
        };
        if (shiftId) {
          updates.assignedShiftIds = (volData.assignedShiftIds || []).filter((id: string) => id !== shiftId);
        }
        transaction.update(volRef, updates);
      }
    });

    console.log(`[EVENTS] Unregistered volunteer ${volunteerId} from event ${eventId}${shiftId ? ` shift ${shiftId}` : ''}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[EVENTS] Failed to unregister volunteer:', error);
    res.status(500).json({ error: 'Failed to unregister' });
  }
});

// Event registration endpoint - registers volunteer for event and sends confirmation email
app.post('/api/events/register', verifyToken, async (req: Request, res: Response) => {
  try {
    const { volunteerId, eventId, shiftId, eventTitle, eventDate, eventLocation, volunteerEmail, volunteerName, eventType, status: registrationStatus } = req.body;

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
    if (isSelfRegistration && !callerProfile?.isAdmin) {
      // Auto-heal: if completedTrainingIds show training is done but coreVolunteerStatus was
      // never persisted (due to previous field-stripping bug), fix it now
      const completedIds: string[] = volunteerData.completedTrainingIds || [];
      const tier1Done = hasCompletedAllModules(completedIds, TIER_1_IDS);
      const tier2Done = hasCompletedAllModules(completedIds, TIER_2_CORE_IDS);
      if (tier1Done && tier2Done && !volunteerData.coreVolunteerStatus) {
        volunteerData.coreVolunteerStatus = true;
        volunteerData.completedHIPAATraining = true;
        volunteerRef.update({ coreVolunteerStatus: true, completedHIPAATraining: true }).catch(() => {});
      }

      if (!volunteerData.coreVolunteerStatus) {
        return res.status(400).json({ error: 'You must complete Core Volunteer training before registering for events' });
      }
      if (!volunteerData.completedHIPAATraining) {
        return res.status(400).json({ error: 'You must complete HIPAA training before registering for events' });
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
          return res.status(400).json({ error: 'You must complete Street Medicine training before registering for Street Medicine events' });
        }
        if ((eventCategory.includes('clinical') || eventCategory.includes('screening') || eventCategory.includes('vaccination')) && !eligibility.clinicGate) {
          return res.status(400).json({ error: 'You must complete Clinical training before registering for clinical events' });
        }
      }
    }

    // Use a Firestore transaction to atomically check constraints and update
    // volunteer, shift, and opportunity documents together
    const { updatedRsvpIds, updatedShiftIds, alreadyRegistered } = await db.runTransaction(async (transaction) => {
      // --- Read phase: fetch all documents we need inside the transaction ---
      const volSnap = await transaction.get(volunteerRef);
      const volData = volSnap.data() as any;

      let shiftSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      let shiftData: any = null;
      const shiftRef = shiftId ? db.collection('shifts').doc(shiftId) : null;
      if (shiftRef) {
        shiftSnap = await transaction.get(shiftRef);
        shiftData = shiftSnap.exists ? shiftSnap.data() : null;
      }

      let oppSnap: FirebaseFirestore.DocumentSnapshot | null = null;
      let oppData: any = null;
      const oppRef = shiftId ? db.collection('opportunities').doc(eventId) : null;
      if (oppRef) {
        oppSnap = await transaction.get(oppRef);
        oppData = oppSnap.exists ? oppSnap.data() : null;
      }

      // --- Validation phase ---
      // Check for duplicate registration on this shift
      if (shiftData && (shiftData.assignedVolunteerIds || []).includes(volunteerId)) {
        return {
          updatedRsvpIds: volData.rsvpedEventIds || [],
          updatedShiftIds: volData.assignedShiftIds || [],
          alreadyRegistered: true,
        };
      }
      // Check slot capacity
      if (shiftData && (shiftData.slotsFilled || 0) >= (shiftData.slotsTotal || 0)) {
        throw new Error('SHIFT_FULL');
      }

      // --- Write phase: compute new values and apply all updates ---
      const newRsvpIds = [...new Set([...(volData.rsvpedEventIds || []), eventId])];
      const newShiftIds = shiftId
        ? [...new Set([...(volData.assignedShiftIds || []), shiftId])]
        : (volData.assignedShiftIds || []);

      transaction.update(volunteerRef, {
        rsvpedEventIds: newRsvpIds,
        assignedShiftIds: newShiftIds,
      });

      if (shiftRef && shiftSnap?.exists) {
        const isAdminRegistration = callerUid !== volunteerId && (callerProfile?.isAdmin || REGISTRATION_MANAGEMENT_ROLES.includes(callerProfile?.role));
        transaction.update(shiftRef, {
          slotsFilled: admin.firestore.FieldValue.increment(1),
          assignedVolunteerIds: admin.firestore.FieldValue.arrayUnion(volunteerId),
        });
        // Store registration metadata for audit trail
        const regLogRef = db.collection('registration_log').doc(`${shiftId}_${volunteerId}`);
        transaction.set(regLogRef, {
          volunteerId,
          shiftId,
          eventId,
          registeredBy: callerUid,
          registeredByName: callerProfile?.name || callerProfile?.legalFirstName || 'Unknown',
          isAdminRegistration,
          trainingBypassed: isAdminRegistration && !volData.coreVolunteerStatus,
          status: registrationStatus || 'confirmed',
          registeredAt: new Date().toISOString(),
        });
      }

      if (oppRef && oppData && shiftData) {
        const roleType = shiftData.roleType || 'Core Volunteer';
        const updatedQuotas = (oppData.staffingQuotas || []).map((q: any) => {
          if (q.role === roleType) {
            return { ...q, filled: (q.filled || 0) + 1 };
          }
          return q;
        });
        transaction.update(oppRef, {
          staffingQuotas: updatedQuotas,
          slotsFilled: admin.firestore.FieldValue.increment(1),
        });
      }

      return { updatedRsvpIds: newRsvpIds, updatedShiftIds: newShiftIds, alreadyRegistered: false };
    });

    // If already registered, short-circuit before side-effects
    if (alreadyRegistered) {
      return res.json({ success: true, message: 'Already registered', alreadyRegistered: true,
        rsvpedEventIds: updatedRsvpIds, assignedShiftIds: updatedShiftIds });
    }

    // Send confirmation email (Stage 1 of event reminder cadence)
    if (volunteerEmail) {
      try {
        await EmailService.send('event_registration_confirmation', {
          toEmail: volunteerEmail,
          volunteerName: volunteerName || 'Volunteer',
          eventTitle: eventTitle || 'Community Event',
          eventDate: formatEventDate(eventDate || 'TBD'),
          eventLocation: eventLocation || 'TBD',
          eventType: eventType || '',
        });
        // Log Stage 1 in reminder_log to prevent duplicate confirmation sends
        try { await logReminderSent(volunteerId, eventId, 1); } catch (e) { console.error('[EVENTS] Failed to log reminder sent:', e); }
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
    // Only alert coordinators/leads and admins — not governance roles like Board Members
    try {
      const REGISTRATION_ALERT_ROLES = ['Events Lead', 'Events Coordinator', 'Outreach & Engagement Lead', 'Program Coordinator', 'General Operations Coordinator', 'Operations Coordinator', 'Volunteer Lead'];
      const coordinatorsSnap = await db.collection('volunteers')
        .where('role', 'in', REGISTRATION_ALERT_ROLES)
        .get();
      // Filter active in memory to avoid composite index requirement
      const activeCoordinators = coordinatorsSnap.docs.filter(d => d.data().status === 'active');

      const coordinatorNotifications = activeCoordinators.map(async (doc) => {
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
    if (error.message === 'SHIFT_FULL') {
      return res.status(409).json({ error: 'This shift is full' });
    }
    console.error('[EVENTS] Failed to register for event:', error);
    res.status(500).json({ error: 'Failed to register for event' });
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

            if (!twilioClient || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_PHONE_NUMBER)) {
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
                        const msgParams: any = { body: smsBody, to: vol.phone };
                        if (TWILIO_MESSAGING_SERVICE_SID) {
                            msgParams.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
                        } else {
                            msgParams.from = TWILIO_PHONE_NUMBER;
                        }
                        await twilioClient!.messages.create(msgParams);
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
        res.status(500).json({ error: 'Failed to send broadcast' });
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
                toEmail: EMAIL_CONFIG.TECH_EMAIL,
                ticketId: docRef.id,
                subject: ticket.subject || 'New Support Ticket',
                description: ticket.description || ticket.message || 'No description provided',
                category: ticket.category || 'General',
                priority: ticket.priority || 'Normal',
                submitterName: ticket.submitterName || 'Unknown',
                submitterEmail: ticket.submitterEmail || 'Unknown',
            });
            console.log(`[SUPPORT] Ticket ${docRef.id} created and notification sent to ${EMAIL_CONFIG.TECH_EMAIL}`);
        } catch (emailError) {
            console.error('[SUPPORT] Failed to send ticket notification email:', emailError);
            // Don't fail the ticket creation if email fails
        }

        res.json({ id: docRef.id, ...ticketWithTimestamp, success: true });
    } catch (error: any) {
        console.error('[SUPPORT] Failed to create support ticket:', error);
        res.status(500).json({ error: 'Failed to create support ticket' });
    }
});

// Update support ticket (for assignment, status changes, etc.)
app.put('/api/support_tickets/:ticketId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const updates = req.body;
        const reqUser = (req as any).user;
        const isAdmin = reqUser?.profile?.isAdmin === true;

        // Validate ticket exists
        const ticketRef = db.collection('support_tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        if (!ticketDoc.exists) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const ticketData = ticketDoc.data()!;
        const isSubmitter = ticketData.submittedBy === reqUser?.uid;

        // Permission check: must be admin or the ticket submitter
        if (!isAdmin && !isSubmitter) {
            return res.status(403).json({ error: 'Not authorized to update this ticket' });
        }

        // Non-admin submitters can only update limited fields
        const allowedFieldsForSubmitter = ['subject', 'description', 'notes', 'activity', 'updatedAt', 'attachments'];

        // Sanitize updates: remove undefined values (Firestore rejects them)
        // and use FieldValue.deleteField() for explicit field removal
        const sanitized: Record<string, any> = { updatedAt: new Date().toISOString() };
        for (const [key, value] of Object.entries(updates)) {
            if (!isAdmin && !allowedFieldsForSubmitter.includes(key)) continue;
            if (value === undefined) {
                sanitized[key] = admin.firestore.FieldValue.delete();
            } else {
                sanitized[key] = value;
            }
        }

        await ticketRef.update(sanitized);

        const updatedTicket = (await ticketRef.get()).data();
        console.log(`[SUPPORT] Ticket ${ticketId} updated by ${isAdmin ? 'admin' : 'submitter'}:`, Object.keys(updates).join(', '));
        res.json({ id: ticketId, ...updatedTicket });
    } catch (error: any) {
        console.error('[SUPPORT] Failed to update support ticket:', error);
        res.status(500).json({ error: 'Failed to update support ticket' });
    }
});

// Upload attachment to a support ticket
app.post('/api/support_tickets/:ticketId/attachments', verifyToken, async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const { fileName, fileData, contentType } = req.body;
        const reqUser = (req as any).user;
        const isAdmin = reqUser?.profile?.isAdmin === true;

        if (!fileName || !fileData || !contentType) {
            return res.status(400).json({ error: 'fileName, fileData, and contentType are required' });
        }

        // Validate file size (base64 is ~33% larger than binary, so 5MB binary = ~6.67MB base64)
        if (fileData.length > 6.67 * 1024 * 1024) {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }

        // Validate content type
        const allowedTypes = [
            'image/png', 'image/jpeg', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ];
        if (!allowedTypes.includes(contentType)) {
            return res.status(400).json({ error: 'File type not allowed.' });
        }

        // Validate ticket exists and check permissions
        const ticketRef = db.collection('support_tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        if (!ticketDoc.exists) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const ticketData = ticketDoc.data()!;
        const isSubmitter = ticketData.submittedBy === reqUser?.uid;
        if (!isAdmin && !isSubmitter) {
            return res.status(403).json({ error: 'Not authorized to add attachments to this ticket' });
        }

        // Sanitize filename
        const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestamp = Date.now();
        const storagePath = `support-tickets/${ticketId}/attachments/${timestamp}-${sanitizedName}`;

        // Upload to storage
        await uploadToStorage(fileData, storagePath, contentType);

        const buffer = Buffer.from(fileData, 'base64');
        const attachment = {
            id: `att-${timestamp}`,
            fileName: fileName,
            fileSize: buffer.length,
            contentType,
            storagePath,
            uploadedAt: new Date().toISOString(),
            uploadedBy: reqUser?.uid || 'unknown',
            uploadedByName: reqUser?.profile?.name || reqUser?.profile?.email || 'Unknown',
        };

        // Append to ticket's attachments array
        const existingAttachments = ticketData.attachments || [];
        await ticketRef.update({
            attachments: [...existingAttachments, attachment],
            updatedAt: new Date().toISOString(),
        });

        console.log(`[SUPPORT] Attachment uploaded for ticket ${ticketId}: ${fileName}`);
        res.json({ attachment, success: true });
    } catch (error: any) {
        console.error('[SUPPORT] Failed to upload attachment:', error);
        res.status(500).json({ error: 'Failed to upload attachment' });
    }
});

// Download attachment from a support ticket
app.get('/api/support_tickets/:ticketId/attachments/:attachmentId/download', verifyToken, async (req: Request, res: Response) => {
    try {
        const { ticketId, attachmentId } = req.params;

        const ticketRef = db.collection('support_tickets').doc(ticketId);
        const ticketDoc = await ticketRef.get();
        if (!ticketDoc.exists) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const ticketData = ticketDoc.data()!;
        const attachments = ticketData.attachments || [];
        const attachment = attachments.find((a: any) => a.id === attachmentId);
        if (!attachment) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        const { buffer, metadata } = await downloadFileBuffer(attachment.storagePath);
        res.set('Content-Type', attachment.contentType || metadata.contentType || 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${attachment.fileName || 'download'}"`);
        res.send(buffer);
    } catch (error: any) {
        console.error('[SUPPORT] Failed to download attachment:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
});

// ========================================
// IN-APP NOTIFICATIONS & @MENTIONS
// ========================================

// GET /api/notifications — Get current user's notifications
app.get('/api/notifications', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const snap = await db.collection('notifications')
            .where('recipientId', '==', user.uid)
            .get();
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        results.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        res.json(results.slice(0, 50));
    } catch (e: any) {
        console.error('[NOTIFICATIONS] GET failed:', e.message);
        res.json([]);
    }
});

// PUT /api/notifications/:id/read — Mark a notification as read
app.put('/api/notifications/:id/read', verifyToken, async (req: Request, res: Response) => {
    try {
        await db.collection('notifications').doc(req.params.id).update({ read: true });
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// PUT /api/notifications/read-all — Mark all notifications as read
app.put('/api/notifications/read-all', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        // Single where clause, filter read status in memory to avoid composite index
        const snap = await db.collection('notifications')
            .where('recipientId', '==', user.uid)
            .get();
        const unread = snap.docs.filter(d => d.data().read === false);
        const batch = db.batch();
        unread.forEach(d => batch.update(d.ref, { read: true }));
        await batch.commit();
        res.json({ success: true, count: snap.size });
    } catch (e: any) {
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// POST /api/mentions — Process @mentions and create notifications
app.post('/api/mentions', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const senderDoc = await db.collection('volunteers').doc(user.uid).get();
        const senderName = senderDoc.data()?.name || 'Someone';
        const { mentionedUserIds, message, context, contextId } = req.body;
        // context examples: "ticket: Bug Report", "chat: General", "event ops: Street Medicine"
        if (!mentionedUserIds || !Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) {
            return res.json({ success: true, notified: 0 });
        }

        const preview = (message || '').substring(0, 200);
        let notified = 0;

        for (const recipientId of mentionedUserIds) {
            if (recipientId === user.uid) continue; // Don't notify yourself
            try {
                // Create in-app notification
                await db.collection('notifications').add({
                    recipientId,
                    type: 'mention',
                    senderId: user.uid,
                    senderName,
                    context: context || '',
                    contextId: contextId || '',
                    messagePreview: preview,
                    read: false,
                    createdAt: new Date().toISOString(),
                });

                // Send email notification
                const recipientDoc = await db.collection('volunteers').doc(recipientId).get();
                const recipient = recipientDoc.data();
                if (recipient?.email) {
                    try {
                        await EmailService.send('mention_notification', {
                            toEmail: recipient.email,
                            volunteerName: recipient.name || recipient.legalFirstName || 'Team Member',
                            mentionedByName: senderName,
                            context: context || '',
                            messagePreview: preview,
                        });
                    } catch (emailErr) {
                        console.error(`[MENTIONS] Email to ${recipientId} failed:`, emailErr);
                    }
                }
                notified++;
            } catch (e) {
                console.error(`[MENTIONS] Failed to notify ${recipientId}:`, e);
            }
        }

        res.json({ success: true, notified });
    } catch (e: any) {
        console.error('[MENTIONS] POST failed:', e.message);
        res.status(500).json({ error: 'Failed to process mentions' });
    }
});

app.post('/api/admin/bulk-import', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        console.log(`[ADMIN] Bulk import initiated by ${(req as any).user?.profile?.email}`);
        const { csvData } = req.body;
        if (!csvData || typeof csvData !== 'string') return res.status(400).json({ error: 'csvData is required' });
        if (csvData.length > MAX_CSV_SIZE) return res.status(400).json({ error: `CSV too large (max ${MAX_CSV_SIZE / 1024 / 1024}MB)` });
        // Decode base64 CSV data
        const csvContent = Buffer.from(csvData, 'base64').toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length > MAX_CSV_ROWS) return res.status(400).json({ error: `Too many rows (max ${MAX_CSV_ROWS})` });
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
                    startDate: row.availability_startDate || getPacificDate()
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
        res.status(500).json({ error: 'Failed to import volunteers' });
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
        console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
                status: 'onboarding',
                isNewUser: true
            });
            finalUserId = docRef.id;
        }

        // Save volunteer data to Firestore with the correct ID
        // IMPORTANT: Admin-added volunteers MUST go through full onboarding — no bypasses
        const volunteerData = {
            ...volunteer,
            id: finalUserId,
            email: volunteer.email.toLowerCase(),
            status: 'onboarding',
            isNewUser: true,
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
        res.status(500).json({ error: 'Failed to add volunteer' });
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
    res.status(500).json({ error: 'Failed to delete volunteer' });
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
      const appliedRole = (await db.collection('volunteers').doc(volunteerId).get()).data()?.appliedRole || 'Core Volunteer';
      updates.status = 'active';
      updates.role = appliedRole;
      updates.volunteerRole = appliedRole;
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
    res.status(500).json({ error: 'Failed to review application' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTOMATED WORKFLOWS - Execution Functions + API + Scheduler
// ═══════════════════════════════════════════════════════════════

// Pacific timezone helper — prevents UTC date drift on Cloud Run
function getPacificDate(offsetDays = 0): string {
  const now = new Date();
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pacific.setDate(pacific.getDate() + offsetDays);
  return pacific.toISOString().split('T')[0]; // YYYY-MM-DD in Pacific time
}

const WORKFLOW_DEFAULTS: Record<string, { enabled: boolean }> = {
  w1: { enabled: true },
  w2: { enabled: true },
  w3: { enabled: true },
  w4: { enabled: true },
  w5: { enabled: true },
  w6: { enabled: true },
  w7: { enabled: true },
  w8: { enabled: true },
};

const WORKFLOW_NAMES: Record<string, string> = {
  w1: 'Shift Reminder',
  w2: 'Post-Shift Thank You',
  w3: 'New Opportunity Alert',
  w4: 'Birthday Recognition',
  w5: 'Compliance Expiry Warning',
  w6: 'Event Reminder Cadence',
  w7: 'SMO Monthly Cycle',
  w8: 'Post-Event Debrief',
};

interface WorkflowRunDetail {
  volunteerId: string;
  email?: string;
  status: 'sent' | 'failed' | 'skipped';
  timestamp: string;
  error?: string;
}

async function logWorkflowRun(
  workflowId: string,
  result: { sent: number; failed: number; skipped: number; details?: string },
  volunteerDetails?: WorkflowRunDetail[]
) {
  try {
    const runRef = await db.collection('workflow_runs').add({
      workflowId,
      workflowName: WORKFLOW_NAMES[workflowId] || workflowId,
      ...result,
      timestamp: new Date().toISOString(),
    });
    // Write per-volunteer detail records as subcollection
    if (volunteerDetails && volunteerDetails.length > 0) {
      const detailBatch = db.batch();
      for (const detail of volunteerDetails) {
        const detailRef = runRef.collection('workflow_run_details').doc();
        detailBatch.set(detailRef, detail);
      }
      await detailBatch.commit();
    }
    // Update last run info on the config doc
    await db.collection('workflow_configs').doc('default').set({
      [`workflows.${workflowId}.lastRun`]: new Date().toISOString(),
      [`workflows.${workflowId}.lastRunResult`]: result,
    }, { merge: true });
  } catch (e) {
    console.error(`[WORKFLOW] Failed to log run for ${workflowId}:`, e);
  }
}

async function executeShiftReminder(): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WORKFLOW] Running Shift Reminder (w1)');
  const result = { sent: 0, failed: 0, skipped: 0 };
  const volDetails: WorkflowRunDetail[] = [];
  try {
    // Dedup: skip if already ran today
    const todayStr = getPacificDate(0);
    const dedupSnapAll = await db.collection('workflow_runs')
      .where('workflowId', '==', 'w1')
      .get();
    // Filter by date range in memory to avoid composite index requirement
    const dedupDocs = dedupSnapAll.docs.filter(d => { const ts = d.data().timestamp; return ts && ts >= todayStr + 'T00:00:00' && ts <= todayStr + 'T23:59:59'; });
    const dedupSnap = { empty: dedupDocs.length === 0 };
    if (!dedupSnap.empty) {
      console.log(`[WORKFLOW] Shift Reminder already ran today (${todayStr}), skipping`);
      return result;
    }

    const tomorrowStr = getPacificDate(1); // Tomorrow in Pacific time

    const oppsSnap = await db.collection('opportunities').where('date', '==', tomorrowStr).get();
    if (oppsSnap.empty) {
      console.log(`[WORKFLOW] No opportunities found for ${tomorrowStr}`);
      return result;
    }

    for (const oppDoc of oppsSnap.docs) {
      const opp = oppDoc.data();
      const time = opp.time || opp.startTime || 'your scheduled time';
      const location = opp.serviceLocation || opp.location || 'the event location';

      // Collect volunteer IDs from shift assignments AND rsvpedEventIds
      const targetVolunteerIds = new Set<string>();

      // Source 1: Shift-assigned volunteers
      const shiftsSnap = await db.collection('shifts').where('opportunityId', '==', oppDoc.id).get();
      for (const shiftDoc of shiftsSnap.docs) {
        const shift = shiftDoc.data();
        for (const vid of (shift.assignedVolunteerIds || [])) targetVolunteerIds.add(vid);
      }

      // Source 2: RSVP'd volunteers (covers org calendar RSVPs and direct registrations)
      const rsvpSnap = await db.collection('volunteers')
        .where('rsvpedEventIds', 'array-contains', oppDoc.id)
        .get();
      for (const vDoc of rsvpSnap.docs) targetVolunteerIds.add(vDoc.id);

      for (const volId of targetVolunteerIds) {
        try {
          const volDoc = await db.collection('volunteers').doc(volId).get();
          const vol = volDoc.data();
          if (!vol) { result.skipped++; volDetails.push({ volunteerId: volId, status: 'skipped', timestamp: new Date().toISOString() }); continue; }

          const phone = normalizePhone(vol.phone);
          const msg = `HMC: Reminder — you're scheduled for ${opp.title} tomorrow at ${time}, ${location}.`;

          if (phone) {
            const smsResult = await sendSMS(volId, `+1${phone}`, msg);
            if (smsResult.sent) { result.sent++; volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: new Date().toISOString() }); }
            else if (smsResult.reason === 'opted_out' || smsResult.reason === 'not_configured') {
              if (vol.email) {
                await EmailService.send('shift_reminder_24h', {
                  toEmail: vol.email,
                  volunteerName: vol.name || vol.firstName || 'Volunteer',
                  eventName: opp.title,
                  eventDate: tomorrowStr,
                  eventTime: time,
                  location: location,
                  userId: volId,
                });
                result.sent++; volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: new Date().toISOString() });
              } else { result.failed++; volDetails.push({ volunteerId: volId, status: 'failed', timestamp: new Date().toISOString(), error: 'No email fallback' }); }
            } else { result.failed++; volDetails.push({ volunteerId: volId, email: vol.email, status: 'failed', timestamp: new Date().toISOString(), error: 'SMS send failed' }); }
          } else if (vol.email) {
            await EmailService.send('shift_reminder_24h', {
              toEmail: vol.email,
              volunteerName: vol.name || vol.firstName || 'Volunteer',
              eventName: opp.title,
              eventDate: tomorrowStr,
              eventTime: time,
              location: location,
              userId: volId,
            });
            result.sent++; volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: new Date().toISOString() });
          } else { result.skipped++; volDetails.push({ volunteerId: volId, status: 'skipped', timestamp: new Date().toISOString() }); }
        } catch (e) {
          console.error(`[WORKFLOW] Shift reminder failed for volunteer ${volId}:`, e);
          result.failed++; volDetails.push({ volunteerId: volId, status: 'failed', timestamp: new Date().toISOString(), error: (e as Error).message });
        }
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] executeShiftReminder error:', e);
  }
  await logWorkflowRun('w1', result, volDetails);
  console.log(`[WORKFLOW] Shift Reminder done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

async function executePostShiftThankYou(): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WORKFLOW] Running Post-Shift Thank You (w2)');
  const result = { sent: 0, failed: 0, skipped: 0 };
  const volDetails: WorkflowRunDetail[] = [];
  try {
    const yesterdayStr = getPacificDate(-1);

    const oppsSnap = await db.collection('opportunities').where('date', '==', yesterdayStr).get();
    if (oppsSnap.empty) return result;

    for (const oppDoc of oppsSnap.docs) {
      const opp = oppDoc.data();

      // Collect volunteer IDs from shift assignments AND rsvpedEventIds
      const targetVolunteerIds = new Set<string>();

      const shiftsSnap = await db.collection('shifts').where('opportunityId', '==', oppDoc.id).get();
      for (const shiftDoc of shiftsSnap.docs) {
        for (const vid of (shiftDoc.data().assignedVolunteerIds || [])) targetVolunteerIds.add(vid);
      }

      const rsvpSnap = await db.collection('volunteers')
        .where('rsvpedEventIds', 'array-contains', oppDoc.id)
        .get();
      for (const vDoc of rsvpSnap.docs) targetVolunteerIds.add(vDoc.id);

      for (const volId of targetVolunteerIds) {
        try {
          const volDoc = await db.collection('volunteers').doc(volId).get();
          const vol = volDoc.data();
          if (!vol) { result.skipped++; volDetails.push({ volunteerId: volId, status: 'skipped', timestamp: new Date().toISOString() }); continue; }

          const phone = normalizePhone(vol.phone);
          const msg = `HMC: Thank you for volunteering at ${opp.title} yesterday! Your service made a real difference.`;

          if (phone) {
            const smsResult = await sendSMS(volId, `+1${phone}`, msg);
            if (smsResult.sent) { result.sent++; volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: new Date().toISOString() }); }
            else if (vol.email) {
              await EmailService.send('post_shift_thank_you', {
                toEmail: vol.email,
                volunteerName: vol.name || vol.firstName || 'Volunteer',
                eventName: opp.title,
                eventDate: yesterdayStr,
                userId: volId,
              });
              result.sent++; volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: new Date().toISOString() });
            } else { result.failed++; volDetails.push({ volunteerId: volId, status: 'failed', timestamp: new Date().toISOString(), error: 'No contact method' }); }
          } else if (vol.email) {
            await EmailService.send('post_shift_thank_you', {
              toEmail: vol.email,
              volunteerName: vol.name || vol.firstName || 'Volunteer',
              eventName: opp.title,
              eventDate: yesterdayStr,
              userId: volId,
            });
            result.sent++; volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: new Date().toISOString() });
          } else { result.skipped++; volDetails.push({ volunteerId: volId, status: 'skipped', timestamp: new Date().toISOString() }); }
        } catch (e) {
          console.error(`[WORKFLOW] Thank you failed for volunteer ${volId}:`, e);
          result.failed++; volDetails.push({ volunteerId: volId, status: 'failed', timestamp: new Date().toISOString(), error: (e as Error).message });
        }
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] executePostShiftThankYou error:', e);
  }
  await logWorkflowRun('w2', result, volDetails);
  console.log(`[WORKFLOW] Post-Shift Thank You done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

// w8: Post-Event Debrief — runs every 10 minutes, texts volunteers 15 min after service hours end
async function executePostEventDebrief(): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WORKFLOW] Running Post-Event Debrief (w8)');
  const result = { sent: 0, failed: 0, skipped: 0 };
  const volDetails: WorkflowRunDetail[] = [];
  try {
    const now = new Date();
    const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const todayStr = getPacificDate(0);

    // Find today's events
    const oppsSnap = await db.collection('opportunities').where('date', '==', todayStr).get();
    if (oppsSnap.empty) return result;

    for (const oppDoc of oppsSnap.docs) {
      const opp = oppDoc.data();

      // Parse the event's end time
      let endHour = 14, endMinute = 0; // default 2:00 PM
      const endTimeRaw = opp.endTime || opp.time?.split?.(' - ')?.[1] || '';
      if (endTimeRaw) {
        // Handle ISO format "2026-02-21T14:00:00" or HH:MM format "14:00"
        const timePart = endTimeRaw.includes('T') ? endTimeRaw.split('T')[1] : endTimeRaw;
        const parts = timePart.split(':');
        if (parts.length >= 2) {
          endHour = parseInt(parts[0], 10);
          endMinute = parseInt(parts[1], 10);
        }
      }

      // Calculate when the debrief text should fire (15 min after end time)
      const debriefTime = new Date(pacificNow);
      debriefTime.setHours(endHour, endMinute + 15, 0, 0);

      // Check if we're within the 10-minute window after the debrief time
      // (window matches the cron interval to avoid double-sends)
      const diffMs = pacificNow.getTime() - debriefTime.getTime();
      if (diffMs < 0 || diffMs > 10 * 60 * 1000) continue; // Not in window

      // Check dedup — don't send twice for the same event
      const dedupRef = db.collection('workflow_dedup').doc(`w8_${oppDoc.id}_${todayStr}`);
      const dedupDoc = await dedupRef.get();
      if (dedupDoc.exists) continue;
      await dedupRef.set({ sentAt: now.toISOString() });

      console.log(`[WORKFLOW w8] Event "${opp.title}" ended at ${endHour}:${String(endMinute).padStart(2, '0')}, sending debrief texts`);

      // Get checked-in volunteers for this event
      const checkinsSnap = await db.collection('volunteer_checkins')
        .where('eventId', '==', oppDoc.id)
        .get();

      // Also get shift-assigned volunteers
      const assignedIds = new Set<string>();
      const shiftsSnap = await db.collection('shifts').where('opportunityId', '==', oppDoc.id).get();
      for (const shiftDoc of shiftsSnap.docs) {
        for (const vid of (shiftDoc.data().assignedVolunteerIds || [])) assignedIds.add(vid);
      }
      // Add checked-in volunteers
      for (const doc of checkinsSnap.docs) {
        const data = doc.data();
        if (data.volunteerId) assignedIds.add(data.volunteerId);
      }

      if (assignedIds.size === 0) continue;

      // Find next upcoming event for the "your next mission" teaser
      let nextEventTeaser = '';
      try {
        const upcomingSnap = await db.collection('opportunities')
          .where('date', '>', todayStr)
          .orderBy('date', 'asc')
          .limit(1)
          .get();
        if (!upcomingSnap.empty) {
          const nextEvent = upcomingSnap.docs[0].data();
          nextEventTeaser = `\n\nYour next mission is loading — ${nextEvent.title} is open for registration!`;
        }
      } catch (e) {
        // Non-fatal — skip the teaser if query fails
        console.warn('[WORKFLOW w8] Could not fetch next event:', (e as Error).message);
      }

      const surveyUrl = `${EMAIL_CONFIG.WEBSITE_URL}?survey=volunteer-debrief`;

      for (const volId of assignedIds) {
        try {
          const volDoc = await db.collection('volunteers').doc(volId).get();
          const vol = volDoc.data();
          if (!vol) { result.skipped++; volDetails.push({ volunteerId: volId, status: 'skipped', timestamp: now.toISOString() }); continue; }

          const volName = (vol.name || vol.firstName || 'Volunteer').split(' ')[0]; // First name only
          const phone = normalizePhone(vol.phone);
          const msg = `Mission Complete, ${volName}! Thank you for volunteering at ${opp.title} today. Be sure to complete your debrief survey before you check out: ${surveyUrl}${nextEventTeaser}`;

          if (phone) {
            const smsResult = await sendSMS(volId, `+1${phone}`, msg);
            if (smsResult.sent) {
              result.sent++;
              volDetails.push({ volunteerId: volId, status: 'sent', timestamp: now.toISOString() });
            } else if (vol.email) {
              // Fallback to email
              await EmailService.send('post_event_debrief', {
                toEmail: vol.email,
                volunteerName: volName,
                eventName: opp.title,
                surveyUrl,
                nextEventTeaser,
                userId: volId,
              });
              result.sent++;
              volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: now.toISOString() });
            } else {
              result.failed++;
              volDetails.push({ volunteerId: volId, status: 'failed', timestamp: now.toISOString(), error: 'No contact method' });
            }
          } else if (vol.email) {
            await EmailService.send('post_event_debrief', {
              toEmail: vol.email,
              volunteerName: volName,
              eventName: opp.title,
              surveyUrl,
              nextEventTeaser,
              userId: volId,
            });
            result.sent++;
            volDetails.push({ volunteerId: volId, email: vol.email, status: 'sent', timestamp: now.toISOString() });
          } else {
            result.skipped++;
            volDetails.push({ volunteerId: volId, status: 'skipped', timestamp: now.toISOString() });
          }
        } catch (e) {
          console.error(`[WORKFLOW w8] Debrief failed for volunteer ${volId}:`, e);
          result.failed++;
          volDetails.push({ volunteerId: volId, status: 'failed', timestamp: now.toISOString(), error: (e as Error).message });
        }
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] executePostEventDebrief error:', e);
  }
  await logWorkflowRun('w8', result, volDetails);
  console.log(`[WORKFLOW] Post-Event Debrief done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

async function executeNewOpportunityAlert(opportunity: { id: string; title: string; date: string; staffingQuotas?: { role: string; count: number; filled: number }[] }): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log(`[WORKFLOW] Running New Opportunity Alert (w3) for ${opportunity.title}`);
  const result = { sent: 0, failed: 0, skipped: 0 };
  try {
    // Check if w3 is enabled
    const configDoc = await db.collection('workflow_configs').doc('default').get();
    const config = configDoc.data();
    if (config?.workflows?.w3?.enabled === false) {
      console.log('[WORKFLOW] New Opportunity Alert is disabled, skipping');
      return result;
    }

    // Get roles from staffing quotas
    const roles = (opportunity.staffingQuotas || []).map(q => q.role);
    if (roles.length === 0) roles.push('Core Volunteer');

    // Query volunteers who match these roles
    const volsSnap = await db.collection('volunteers')
      .where('status', '==', 'active')
      .get();

    for (const volDoc of volsSnap.docs) {
      const vol = volDoc.data();
      const volRole = vol.selectedRole || vol.role || '';
      if (!roles.some(r => r.toLowerCase() === volRole.toLowerCase())) {
        result.skipped++;
        continue;
      }

      const phone = normalizePhone(vol.phone);
      const msg = `HMC: New opportunity — ${opportunity.title} on ${opportunity.date}. Log in to sign up!`;

      try {
        let sent = false;
        // Send email notification
        if (vol.email) {
          const emailResult = await EmailService.send('new_opportunity_alert', {
            toEmail: vol.email,
            volunteerName: vol.name || vol.legalFirstName || 'Volunteer',
            eventName: opportunity.title,
            eventDate: opportunity.date,
            userId: volDoc.id,
          });
          if (emailResult.sent) sent = true;
        }
        // Also send SMS if phone available
        if (phone) {
          const smsResult = await sendSMS(volDoc.id, `+1${phone}`, msg);
          if (smsResult.sent) sent = true;
        }
        if (sent) { result.sent++; } else { result.skipped++; }
      } catch (e) {
        result.failed++;
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] executeNewOpportunityAlert error:', e);
  }
  await logWorkflowRun('w3', result);
  console.log(`[WORKFLOW] New Opportunity Alert done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

async function executeBirthdayRecognition(): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WORKFLOW] Running Birthday Recognition (w4)');
  const result = { sent: 0, failed: 0, skipped: 0 };
  try {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const todayMonth = today.getMonth() + 1; // 1-based
    const todayDay = today.getDate();

    const volsSnap = await db.collection('volunteers').get();

    for (const volDoc of volsSnap.docs) {
      const vol = volDoc.data();
      if (!vol.dateOfBirth) { result.skipped++; continue; }

      // Parse dateOfBirth — could be "YYYY-MM-DD", "MM/DD/YYYY", or a Firestore timestamp
      let dobMonth: number, dobDay: number;
      if (typeof vol.dateOfBirth === 'string') {
        const parts = vol.dateOfBirth.includes('-')
          ? vol.dateOfBirth.split('-')
          : vol.dateOfBirth.split('/');
        if (vol.dateOfBirth.includes('-')) {
          // YYYY-MM-DD
          dobMonth = parseInt(parts[1]);
          dobDay = parseInt(parts[2]);
        } else {
          // MM/DD/YYYY
          dobMonth = parseInt(parts[0]);
          dobDay = parseInt(parts[1]);
        }
      } else if (vol.dateOfBirth.toDate) {
        const d = vol.dateOfBirth.toDate();
        dobMonth = d.getMonth() + 1;
        dobDay = d.getDate();
      } else {
        result.skipped++;
        continue;
      }

      if (dobMonth !== todayMonth || dobDay !== todayDay) continue;

      try {
        // Award 100 XP
        await GamificationService.addXP(volDoc.id, 'birthday', 100, { reason: 'birthday_recognition' });

        const phone = normalizePhone(vol.phone);
        const msg = `Happy Birthday from HMC! We've added 100 bonus XP to celebrate you. Thank you for being part of our team!`;

        if (phone) {
          const smsResult = await sendSMS(volDoc.id, `+1${phone}`, msg);
          if (smsResult.sent) { result.sent++; }
          else if (vol.email) {
            await EmailService.send('birthday_recognition', {
              toEmail: vol.email,
              volunteerName: vol.name || vol.firstName || 'Volunteer',
              userId: volDoc.id,
            });
            result.sent++;
          } else { result.sent++; } // XP was still awarded
        } else {
          result.sent++; // XP was still awarded even without notification
        }
      } catch (e) {
        console.error(`[WORKFLOW] Birthday recognition failed for ${volDoc.id}:`, e);
        result.failed++;
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] executeBirthdayRecognition error:', e);
  }
  await logWorkflowRun('w4', result);
  console.log(`[WORKFLOW] Birthday Recognition done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

async function executeComplianceExpiryWarning(): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WORKFLOW] Running Compliance Expiry Warning (w5)');
  const result = { sent: 0, failed: 0, skipped: 0 };
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const volsSnap = await db.collection('volunteers').get();

    for (const volDoc of volsSnap.docs) {
      const vol = volDoc.data();
      const compliance = vol.compliance;
      if (!compliance || typeof compliance !== 'object') { result.skipped++; continue; }

      // Iterate through compliance items (e.g., backgroundCheck, tbTest, etc.)
      const items = Array.isArray(compliance) ? compliance : Object.entries(compliance).map(([key, val]: [string, any]) => ({ name: key, ...val }));

      for (const item of items) {
        const dateCompleted = item.dateCompleted || item.completedDate;
        if (!dateCompleted) continue;

        // Calculate 1-year anniversary
        let completedDate: Date;
        if (typeof dateCompleted === 'string') {
          completedDate = new Date(dateCompleted);
        } else if (dateCompleted.toDate) {
          completedDate = dateCompleted.toDate();
        } else continue;

        const expiryDate = new Date(completedDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Check if expiry is within 30 days from now
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 0 || daysUntilExpiry > 30) continue;

        const itemName = item.name || item.type || 'compliance item';
        const phone = normalizePhone(vol.phone);
        const msg = `HMC: Your ${itemName} is expiring in ${daysUntilExpiry} days. Please contact your coordinator to renew.`;

        try {
          if (phone) {
            const smsResult = await sendSMS(volDoc.id, `+1${phone}`, msg);
            if (smsResult.sent) { result.sent++; }
            else if (vol.email) {
              await EmailService.send('compliance_expiry_warning', {
                toEmail: vol.email,
                volunteerName: vol.name || vol.firstName || 'Volunteer',
                eventName: `${itemName} Expiry Warning`,
                userId: volDoc.id,
              });
              result.sent++;
            } else { result.failed++; }
          } else if (vol.email) {
            await EmailService.send('compliance_expiry_warning', {
              toEmail: vol.email,
              volunteerName: vol.name || vol.firstName || 'Volunteer',
              eventName: `${itemName} Expiry Warning`,
              userId: volDoc.id,
            });
            result.sent++;
          } else { result.skipped++; }
        } catch (e) {
          result.failed++;
        }
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] executeComplianceExpiryWarning error:', e);
  }
  await logWorkflowRun('w5', result);
  console.log(`[WORKFLOW] Compliance Expiry Warning done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// EVENT REMINDER CADENCE - 5-Stage System (w6)
// ═══════════════════════════════════════════════════════════════
// Stage 1: Confirmation (on RSVP - triggered from register endpoint)
// Stage 2: 7-Day Reminder
// Stage 3: 72-Hour Reminder
// Stage 4: 24-Hour Reminder
// Stage 5: 3-Hour SMS

async function logReminderSent(volunteerId: string, eventId: string, stage: number): Promise<void> {
  const key = `${volunteerId}_${eventId}_s${stage}`;
  await db.collection('reminder_log').doc(key).set({
    volunteerId, eventId, stage, sentAt: new Date().toISOString(),
  });
}

async function wasReminderSent(volunteerId: string, eventId: string, stage: number): Promise<boolean> {
  const key = `${volunteerId}_${eventId}_s${stage}`;
  const doc = await db.collection('reminder_log').doc(key).get();
  return doc.exists;
}

async function executeEventReminderCadence(smsOnly = false): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WORKFLOW] Running Event Reminder Cadence (w6)');
  const result = { sent: 0, failed: 0, skipped: 0 };
  const volDetails: WorkflowRunDetail[] = [];
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const todayStr = getPacificDate(0);

    // Query all upcoming events from ALL collections in the next 8 days
    const eightDaysOut = getPacificDate(8);
    // Single where clause per query, filter upper bound in memory to avoid composite index
    const [oppsSnap, orgCalSnap] = await Promise.all([
      db.collection('opportunities')
        .where('date', '>=', todayStr)
        .get(),
      db.collection('org_calendar_events')
        .where('date', '>=', todayStr)
        .get(),
    ]);

    // Normalize all events into a unified list with their IDs, filter by upper bound
    const allEvents: { id: string; data: any; source: string }[] = [];
    for (const doc of oppsSnap.docs) {
      if (doc.data().date <= eightDaysOut) allEvents.push({ id: doc.id, data: doc.data(), source: 'opportunities' });
    }
    for (const doc of orgCalSnap.docs) {
      if (doc.data().date <= eightDaysOut) allEvents.push({ id: doc.id, data: doc.data(), source: 'org_calendar_events' });
    }

    if (allEvents.length === 0) {
      console.log('[WORKFLOW] No upcoming events in next 8 days for reminder cadence');
      return result;
    }

    for (const event of allEvents) {
      const opp = event.data;
      const eventDate = opp.date; // YYYY-MM-DD
      const eventDateTime = new Date(eventDate + 'T' + (opp.time || opp.startTime || '09:00'));
      const hoursUntil = (eventDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const daysUntil = hoursUntil / 24;

      // Determine the single most relevant stage for this event's time window
      // Stages are mutually exclusive — only the closest matching window sends
      const applicableStages: { stage: number; template: string }[] = [];
      if (!smsOnly) {
        if (daysUntil <= 7.5 && daysUntil > 3.5) { applicableStages.push({ stage: 2, template: 'event_reminder_7day' }); }
        else if (daysUntil <= 3.5 && daysUntil > 1.5) { applicableStages.push({ stage: 3, template: 'event_reminder_72h' }); }
        else if (daysUntil <= 1.5 && daysUntil > 0) { applicableStages.push({ stage: 4, template: 'event_reminder_24h' }); }
      }
      if (hoursUntil >= 1 && hoursUntil <= 4) { applicableStages.push({ stage: 5, template: 'sms_3h' }); }

      if (applicableStages.length === 0) continue;

      // Find all volunteers registered for this event from ALL sources:
      // 1. rsvpedEventIds on volunteer doc (public RSVP / Event Explorer signup)
      const volsSnap = await db.collection('volunteers')
        .where('rsvpedEventIds', 'array-contains', event.id)
        .get();
      const registeredIds = new Set(volsSnap.docs.map(d => d.id));
      const allVolDocs: admin.firestore.DocumentSnapshot[] = [...volsSnap.docs];

      // 2. Org calendar RSVPs stored on the event doc itself
      const eventRsvps = opp.rsvps || [];
      for (const rsvp of eventRsvps) {
        const odId = rsvp.odId || rsvp.userId;
        if (odId && rsvp.status === 'attending' && !registeredIds.has(odId)) {
          try {
            const vDoc = await db.collection('volunteers').doc(odId).get();
            if (vDoc.exists) { allVolDocs.push(vDoc); registeredIds.add(odId); }
          } catch {}
        }
      }

      // 3. Shift assignments — volunteers assigned to shifts for this event
      try {
        const shiftsSnap = await db.collection('shifts')
          .where('opportunityId', '==', event.id)
          .get();
        for (const shiftDoc of shiftsSnap.docs) {
          const assignedIds = shiftDoc.data().assignedVolunteerIds || [];
          for (const vid of assignedIds) {
            if (!registeredIds.has(vid)) {
              try {
                const vDoc = await db.collection('volunteers').doc(vid).get();
                if (vDoc.exists) { allVolDocs.push(vDoc); registeredIds.add(vid); }
              } catch {}
            }
          }
        }
      } catch {}

      // 4. Also include admin emails so event coordinators/admins get reminders too
      const adminSnap = await db.collection('volunteers').where('isAdmin', '==', true).get();
      for (const adminDoc of adminSnap.docs) {
        if (!registeredIds.has(adminDoc.id)) allVolDocs.push(adminDoc);
      }

      const location = opp.serviceLocation || opp.location || 'the event location';
      const time = opp.time || opp.startTime || 'your scheduled time';

      for (const volDoc of allVolDocs) {
        const vol = volDoc.data();
        if (!vol) continue;

        // Find the highest applicable stage not yet sent to this volunteer
        let stageToSend: { stage: number; template: string } | null = null;
        for (const s of applicableStages) {
          if (!(await wasReminderSent(volDoc.id, event.id, s.stage))) {
            stageToSend = s;
            break;
          }
        }

        if (!stageToSend) { result.skipped++; volDetails.push({ volunteerId: volDoc.id, email: vol.email, status: 'skipped', timestamp: new Date().toISOString() }); continue; }

        try {
          if (stageToSend.stage === 5) {
            const phone = normalizePhone(vol.phone);
            if (phone) {
              const msg = `HMC: ${opp.title} starts at ${time}. See you at ${location}!`;
              const smsResult = await sendSMS(volDoc.id, `+1${phone}`, msg);
              if (smsResult.sent) { result.sent++; volDetails.push({ volunteerId: volDoc.id, email: vol.email, status: 'sent', timestamp: new Date().toISOString() }); }
              else { result.skipped++; volDetails.push({ volunteerId: volDoc.id, status: 'skipped', timestamp: new Date().toISOString() }); }
            } else { result.skipped++; volDetails.push({ volunteerId: volDoc.id, status: 'skipped', timestamp: new Date().toISOString() }); }
          } else {
            if (vol.email) {
              await EmailService.send(stageToSend.template as any, {
                toEmail: vol.email,
                volunteerName: vol.name || vol.firstName || 'Volunteer',
                eventName: opp.title,
                eventDate: eventDate,
                eventTime: time,
                location: location,
                eventType: opp.category || opp.eventType || '',
              });
              result.sent++; volDetails.push({ volunteerId: volDoc.id, email: vol.email, status: 'sent', timestamp: new Date().toISOString() });
            } else { result.skipped++; volDetails.push({ volunteerId: volDoc.id, status: 'skipped', timestamp: new Date().toISOString() }); }
          }

          await logReminderSent(volDoc.id, event.id, stageToSend.stage);
        } catch (e) {
          console.error(`[WORKFLOW] Reminder stage ${stageToSend.stage} failed for vol ${volDoc.id} event ${event.id}:`, e);
          result.failed++; volDetails.push({ volunteerId: volDoc.id, email: vol.email, status: 'failed', timestamp: new Date().toISOString(), error: (e as Error).message });
        }
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] executeEventReminderCadence error:', e);
  }
  await logWorkflowRun('w6', result, volDetails);
  console.log(`[WORKFLOW] Event Reminder Cadence done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// SMO MONTHLY WORKFLOW (w7) - Street Medicine Outreach Cycle
// ═══════════════════════════════════════════════════════════════

function getThirdSaturday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay();
  const firstSaturday = dayOfWeek <= 6 ? (6 - dayOfWeek + 1) : 1;
  return new Date(year, month, firstSaturday + 14); // 3rd Saturday
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function manageSMOCycle(): Promise<{ sent: number; failed: number; skipped: number }> {
  console.log('[WORKFLOW] Running SMO Monthly Cycle Manager (w7)');
  const result = { sent: 0, failed: 0, skipped: 0 };
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const todayStr = getPacificDate(0);

    // Find or create the upcoming SMO cycle
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Check next 2 months for cycles to manage
    for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
      const targetMonth = (currentMonth + monthOffset) % 12;
      const targetYear = currentMonth + monthOffset > 11 ? currentYear + 1 : currentYear;
      const saturdayDate = getThirdSaturday(targetYear, targetMonth);
      const thursdayDate = new Date(saturdayDate);
      thursdayDate.setDate(thursdayDate.getDate() - 2); // Thursday before Saturday

      const satStr = formatDateStr(saturdayDate);
      const thuStr = formatDateStr(thursdayDate);
      const cycleId = `smo_${satStr}`;

      // Get or create cycle document
      const cycleRef = db.collection('smo_cycles').doc(cycleId);
      let cycleDoc = await cycleRef.get();

      const daysUntilSat = (saturdayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Phase 1: Auto-create cycle 30 days before
      if (!cycleDoc.exists && daysUntilSat <= 30 && daysUntilSat > 0) {
        console.log(`[SMO] Creating new cycle for ${satStr}`);

        // Create the Saturday SMO event in opportunities
        const satEventRef = await db.collection('opportunities').add({
          title: `Street Medicine Outreach — ${saturdayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          date: satStr,
          time: '9:00 AM',
          category: 'Street Medicine',
          serviceLocation: 'TBD — See coordinator',
          description: 'Monthly Street Medicine Outreach. Thursday pre-meet training is REQUIRED.',
          slotsTotal: 20,
          slotsFilled: 0,
          status: 'published',
          approvalStatus: 'approved',
          approvedBy: 'system',
          approvedAt: new Date().toISOString(),
          isPublic: true,
          isPublicFacing: false,
          tenantId: 'hmc-health',
          createdAt: new Date().toISOString(),
          smoManaged: true,
          requiredSkills: [],
          staffingQuotas: [],
          urgency: 'medium',
        });

        // Create a default shift for the Saturday SMO event so it appears in My Missions
        await db.collection('shifts').add({
          tenantId: 'hmc-health',
          opportunityId: satEventRef.id,
          roleType: 'Core Volunteer',
          slotsTotal: 20,
          slotsFilled: 0,
          assignedVolunteerIds: [],
          startTime: `${satStr}T09:00:00`,
          endTime: `${satStr}T14:00:00`,
        });

        // Create the Thursday training event
        const thuEventRef = await db.collection('opportunities').add({
          title: `SMO Pre-Meet Training — ${thursdayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          date: thuStr,
          time: '6:00 PM',
          category: 'Street Medicine',
          serviceLocation: 'Virtual — Google Meet',
          description: 'Mandatory pre-meet training for Saturday Street Medicine Outreach.',
          slotsTotal: 30,
          slotsFilled: 0,
          status: 'published',
          approvalStatus: 'approved',
          approvedBy: 'system',
          approvedAt: new Date().toISOString(),
          isPublic: true,
          isPublicFacing: false,
          tenantId: 'hmc-health',
          createdAt: new Date().toISOString(),
          smoManaged: true,
          isTrainingSession: true,
          requiredSkills: [],
          staffingQuotas: [],
          urgency: 'low',
        });

        // Create a default shift for the Thursday training event
        await db.collection('shifts').add({
          tenantId: 'hmc-health',
          opportunityId: thuEventRef.id,
          roleType: 'Core Volunteer',
          slotsTotal: 30,
          slotsFilled: 0,
          assignedVolunteerIds: [],
          startTime: `${thuStr}T18:00:00`,
          endTime: `${thuStr}T20:00:00`,
        });

        await cycleRef.set({
          saturdayDate: satStr,
          thursdayDate: thuStr,
          saturdayEventId: satEventRef.id,
          thursdayEventId: thuEventRef.id,
          googleMeetLink: '',
          registeredVolunteers: [],
          waitlist: [],
          thursdayAttendees: [],
          selfReported: [],
          leadConfirmed: [],
          status: 'registration_open',
          createdAt: new Date().toISOString(),
        });

        // Notify eligible volunteers — single where, filter eligibility in memory to avoid composite index
        const activeVolsSnap = await db.collection('volunteers')
          .where('status', '==', 'active')
          .get();
        const eligibleDocs = activeVolsSnap.docs.filter((d: any) => d.data().eventEligibility?.streetMedicineGate === true);

        for (const volDoc of eligibleDocs) {
          const vol = volDoc.data();
          if (vol.email) {
            try {
              await EmailService.send('smo_registration_open', {
                toEmail: vol.email,
                volunteerName: vol.name || vol.firstName || 'Volunteer',
                eventDate: satStr,
                trainingDate: thuStr,
              });
              result.sent++;
            } catch (e) { console.error('[SMO] Notification failed:', e); result.failed++; }
          }
        }
        continue; // Skip further processing for newly created cycle
      }

      if (!cycleDoc.exists) continue;
      const cycle = cycleDoc.data()!;

      // Phase 2: Thursday night — check attendance, remove no-shows, promote waitlist
      if (cycle.status === 'registration_open' && todayStr === thuStr) {
        const hourNow = now.getHours();

        // After 11 PM Thursday: enforce attendance
        if (hourNow >= 23) {
          console.log(`[SMO] Enforcing Thursday attendance for cycle ${cycleId}`);
          const attendees = new Set([...(cycle.leadConfirmed || []), ...(cycle.selfReported || [])]);
          const registered: string[] = cycle.registeredVolunteers || [];
          const waitlist: string[] = cycle.waitlist || [];
          const removed: string[] = [];
          const kept: string[] = [];

          for (const volId of registered) {
            if (attendees.has(volId)) {
              kept.push(volId);
            } else {
              removed.push(volId);
              // Remove Saturday event from rsvpedEventIds so they stop getting reminders
              if (cycle.saturdayEventId) {
                try {
                  await db.collection('volunteers').doc(volId).update({
                    rsvpedEventIds: admin.firestore.FieldValue.arrayRemove(cycle.saturdayEventId),
                  });
                } catch (e) { console.error(`[SMO] Failed to remove RSVP for ${volId}:`, e); }
              }
              // Notify removed volunteer
              const volDoc = await db.collection('volunteers').doc(volId).get();
              const vol = volDoc.data();
              if (vol?.email) {
                try {
                  await EmailService.send('smo_removed_no_training', {
                    toEmail: vol.email,
                    volunteerName: vol.name || vol.firstName || 'Volunteer',
                    eventDate: satStr,
                  });
                  result.sent++;
                } catch (e) { console.error('[SMO] Notification failed:', e); result.failed++; }
              }
            }
          }

          // Promote from waitlist to fill vacated spots
          const slotsAvailable = registered.length - kept.length;
          const promoted = waitlist.splice(0, slotsAvailable);

          for (const volId of promoted) {
            kept.push(volId);
            // Add Saturday event to promoted volunteer's rsvpedEventIds
            if (cycle.saturdayEventId) {
              try {
                await db.collection('volunteers').doc(volId).update({
                  rsvpedEventIds: admin.firestore.FieldValue.arrayUnion(cycle.saturdayEventId),
                });
              } catch (e) { console.error(`[SMO] Failed to add RSVP for ${volId}:`, e); }
            }
            const volDoc = await db.collection('volunteers').doc(volId).get();
            const vol = volDoc.data();
            if (vol?.email) {
              try {
                await EmailService.send('smo_waitlist_promoted', {
                  toEmail: vol.email,
                  volunteerName: vol.name || vol.firstName || 'Volunteer',
                  eventDate: satStr,
                  location: 'See event details',
                });
                result.sent++;
              } catch (e) { console.error('[SMO] Notification failed:', e); result.failed++; }
            }
          }

          await cycleRef.update({
            registeredVolunteers: kept,
            waitlist: waitlist,
            thursdayAttendees: Array.from(attendees),
            status: 'training_complete',
          });

          console.log(`[SMO] Attendance enforced: ${kept.length} kept, ${removed.length} removed, ${promoted.length} promoted from waitlist`);
        }
      }

      // Phase 3: Saturday — mark as event_day
      if (cycle.status === 'training_complete' && todayStr === satStr) {
        await cycleRef.update({ status: 'event_day' });
      }

      // Phase 4: Day after Saturday — mark as completed
      const dayAfterSat = new Date(saturdayDate);
      dayAfterSat.setDate(dayAfterSat.getDate() + 1);
      if (cycle.status === 'event_day' && todayStr === formatDateStr(dayAfterSat)) {
        await cycleRef.update({ status: 'completed' });
      }

      // Send Thursday training reminder (24h before Thursday)
      const dayBeforeThu = new Date(thursdayDate);
      dayBeforeThu.setDate(dayBeforeThu.getDate() - 1);
      if (todayStr === formatDateStr(dayBeforeThu) && cycle.status === 'registration_open') {
        const registered: string[] = cycle.registeredVolunteers || [];
        for (const volId of registered) {
          try {
            if (await wasReminderSent(volId, cycleId, 100)) continue; // stage 100 = SMO training reminder
            const volDoc = await db.collection('volunteers').doc(volId).get();
            const vol = volDoc.data();
            if (vol?.email) {
              await EmailService.send('smo_training_reminder', {
                toEmail: vol.email,
                volunteerName: vol.name || vol.firstName || 'Volunteer',
                trainingDate: thuStr,
                googleMeetLink: cycle.googleMeetLink || '',
              });
              await logReminderSent(volId, cycleId, 100);
              result.sent++;

              // Also send SMS if phone available
              const phone = normalizePhone(vol.phone);
              if (phone) {
                await sendSMS(volId, `+1${phone}`, `HMC: SMO training is tomorrow! ${cycle.googleMeetLink ? 'Join: ' + cycle.googleMeetLink : 'Check your email for details.'} Attendance required for Saturday.`);
              }
            }
          } catch (e) { console.error('[SMO] Notification failed:', e); result.failed++; }
        }
      }
    }
  } catch (e) {
    console.error('[WORKFLOW] manageSMOCycle error:', e);
  }
  await logWorkflowRun('w7', result);
  console.log(`[WORKFLOW] SMO Cycle Manager done: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

// Scheduler runner functions
async function runScheduledWorkflows() {
  console.log('[WORKFLOW] Running scheduled workflows (daily)');
  try {
    const configDoc = await db.collection('workflow_configs').doc('default').get();
    const config = configDoc.data();
    const workflows = config?.workflows || WORKFLOW_DEFAULTS;

    if (workflows.w1?.enabled !== false) await executeShiftReminder();
    if (workflows.w2?.enabled !== false) await executePostShiftThankYou();
    if (workflows.w6?.enabled !== false) await executeEventReminderCadence();
    if (workflows.w7?.enabled !== false) await manageSMOCycle();
  } catch (e) {
    console.error('[WORKFLOW] runScheduledWorkflows error:', e);
  }
}

// Runs every 3 hours for time-sensitive SMS (Stage 5: 3-hour reminder)
async function runSMSCheckWorkflows() {
  console.log('[WORKFLOW] Running SMS check workflows (every 3h)');
  try {
    const configDoc = await db.collection('workflow_configs').doc('default').get();
    const config = configDoc.data();
    const workflows = config?.workflows || WORKFLOW_DEFAULTS;
    if (workflows.w6?.enabled !== false) await executeEventReminderCadence(true);
  } catch (e) {
    console.error('[WORKFLOW] runSMSCheckWorkflows error:', e);
  }
}

async function runDailyWorkflows() {
  console.log('[WORKFLOW] Running daily workflows (8am)');
  try {
    const configDoc = await db.collection('workflow_configs').doc('default').get();
    const config = configDoc.data();
    const workflows = config?.workflows || WORKFLOW_DEFAULTS;

    if (workflows.w4?.enabled !== false) await executeBirthdayRecognition();
    if (workflows.w5?.enabled !== false) await executeComplianceExpiryWarning();
  } catch (e) {
    console.error('[WORKFLOW] runDailyWorkflows error:', e);
  }
}

// --- Workflow API Endpoints ---

app.get('/api/admin/workflows', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const configDoc = await db.collection('workflow_configs').doc('default').get();
    if (configDoc.exists) {
      res.json(configDoc.data());
    } else {
      // Return defaults
      const defaults = {
        workflows: Object.fromEntries(
          Object.entries(WORKFLOW_DEFAULTS).map(([id, val]) => [id, { ...val, lastRun: null, lastRunResult: null }])
        ),
        preferences: { primaryChannel: 'sms', fallbackToEmail: true },
      };
      res.json(defaults);
    }
  } catch (error: any) {
    console.error('[WORKFLOW] Failed to load config:', error);
    res.status(500).json({ error: 'Failed to load workflow config' });
  }
});

app.put('/api/admin/workflows', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { workflows, preferences } = req.body;
    await db.collection('workflow_configs').doc('default').set(
      { workflows, preferences, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log(`[WORKFLOW] Config updated by ${(req as any).user?.profile?.email}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[WORKFLOW] Failed to save config:', error);
    res.status(500).json({ error: 'Failed to save workflow config' });
  }
});

app.post('/api/admin/workflows/trigger/:workflowId', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    console.log(`[WORKFLOW] Manual trigger: ${workflowId} by ${(req as any).user?.profile?.email}`);

    let result: { sent: number; failed: number; skipped: number };
    switch (workflowId) {
      case 'w1': result = await executeShiftReminder(); break;
      case 'w2': result = await executePostShiftThankYou(); break;
      case 'w3': result = await executeNewOpportunityAlert({ id: 'manual', title: 'Manual Test', date: getPacificDate() }); break;
      case 'w4': result = await executeBirthdayRecognition(); break;
      case 'w5': result = await executeComplianceExpiryWarning(); break;
      case 'w6': result = await executeEventReminderCadence(); break;
      case 'w7': result = await manageSMOCycle(); break;
      case 'w8': result = await executePostEventDebrief(); break;
      default: return res.status(400).json({ error: `Unknown workflow: ${workflowId}` });
    }

    res.json({ success: true, workflowId, result });
  } catch (error: any) {
    console.error(`[WORKFLOW] Manual trigger failed:`, error);
    res.status(500).json({ error: 'Workflow execution failed' });
  }
});

// POST /api/admin/workflows/test-debrief — Send a test debrief SMS to a phone number
// Accepts either admin auth OR cron secret for CLI testing
app.post('/api/admin/workflows/test-debrief', async (req: Request, res: Response) => {
  try {
    // Allow access via cron secret, test key, OR admin auth
    const cronSecret = process.env.CRON_SECRET;
    const testKey = 'hmc-debrief-test-2026';
    const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
    if (providedSecret !== testKey && (!cronSecret || providedSecret !== cronSecret)) {
      // Fall back to admin auth check
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
        const token = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(token);
        const profile = (await db.collection('volunteers').doc(decoded.uid).get()).data();
        if (!profile?.isAdmin) return res.status(403).json({ error: 'Admin only' });
      } catch { return res.status(401).json({ error: 'Unauthorized' }); }
    }

    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return res.status(400).json({ error: 'Invalid phone number' });

    const volunteerName = (name || 'Volunteer').split(' ')[0];
    const surveyUrl = `${EMAIL_CONFIG.WEBSITE_URL}?survey=volunteer-debrief`;

    // Find next upcoming event for teaser
    let nextEventTeaser = '';
    try {
      const todayStr = getPacificDate(0);
      const upcomingSnap = await db.collection('opportunities')
        .where('date', '>', todayStr)
        .orderBy('date', 'asc')
        .limit(1)
        .get();
      if (!upcomingSnap.empty) {
        const nextEvent = upcomingSnap.docs[0].data();
        nextEventTeaser = `\n\nYour next mission is loading — ${nextEvent.title} is open for registration!`;
      }
    } catch {}

    const msg = `Mission Complete, ${volunteerName}! Thank you for volunteering today. Be sure to complete your debrief survey before you check out: ${surveyUrl}${nextEventTeaser}`;

    const smsResult = await sendSMS(null, `+1${normalizedPhone}`, msg);
    console.log(`[TEST DEBRIEF] SMS sent to +1${normalizedPhone}: ${smsResult.sent}`);
    res.json({ success: smsResult.sent, message: msg, reason: smsResult.reason });
  } catch (error: any) {
    console.error('[TEST DEBRIEF] Failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/workflows/runs', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const runsSnap = await db.collection('workflow_runs')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();
    const runs = runsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ runs });
  } catch (error: any) {
    console.error('[WORKFLOW] Failed to load runs:', error);
    res.status(500).json({ error: 'Failed to load workflow runs' });
  }
});

// Per-volunteer drill-down for a specific workflow run
app.get('/api/admin/workflow-runs/:runId/details', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const runDoc = await db.collection('workflow_runs').doc(runId).get();
    if (!runDoc.exists) return res.status(404).json({ error: 'Workflow run not found' });

    const detailsSnap = await runDoc.ref.collection('workflow_run_details')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();
    const details = detailsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ run: { id: runDoc.id, ...runDoc.data() }, details });
  } catch (error: any) {
    console.error('[WORKFLOW] Failed to load run details:', error);
    res.status(500).json({ error: 'Failed to load workflow run details' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SMO CYCLE API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Get all SMO cycles (admin)
app.get('/api/admin/smo/cycles', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('smo_cycles').orderBy('saturdayDate', 'desc').limit(12).get();
    const cycles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ cycles });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load SMO cycles' });
  }
});

// Get a single SMO cycle
app.get('/api/admin/smo/cycles/:cycleId', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('smo_cycles').doc(req.params.cycleId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Cycle not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load SMO cycle' });
  }
});

// Update SMO cycle (team lead: set Google Meet link, check in volunteers)
app.put('/api/admin/smo/cycles/:cycleId', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { googleMeetLink, leadConfirmed } = req.body;
    const updates: any = { updatedAt: new Date().toISOString() };
    if (googleMeetLink !== undefined) updates.googleMeetLink = googleMeetLink;
    if (leadConfirmed !== undefined) updates.leadConfirmed = leadConfirmed;

    await db.collection('smo_cycles').doc(req.params.cycleId).update(updates);
    const updated = await db.collection('smo_cycles').doc(req.params.cycleId).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update SMO cycle' });
  }
});

// Get active SMO cycles for the logged-in volunteer
app.get('/api/smo/cycles/my', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.uid;
    const snap = await db.collection('smo_cycles')
      .where('status', 'in', ['registration_open', 'training_complete', 'event_day'])
      .get();

    const myCycles = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((c: any) => (c.registeredVolunteers || []).includes(userId));

    res.json(myCycles.map((c: any) => ({
      id: c.id,
      saturdayDate: c.saturdayDate,
      thursdayDate: c.thursdayDate,
      status: c.status,
      selfReported: (c.selfReported || []).includes(userId),
      leadConfirmed: (c.leadConfirmed || []).includes(userId),
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch SMO cycles' });
  }
});

// Register for SMO cycle
app.post('/api/smo/cycles/:cycleId/register', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.uid;
    const cycleRef = db.collection('smo_cycles').doc(req.params.cycleId);
    const cycleDoc = await cycleRef.get();
    if (!cycleDoc.exists) return res.status(404).json({ error: 'Cycle not found' });
    const cycle = cycleDoc.data()!;

    if (cycle.status !== 'registration_open') {
      return res.status(400).json({ error: 'Registration is closed for this cycle' });
    }

    const registered: string[] = cycle.registeredVolunteers || [];
    const waitlist: string[] = cycle.waitlist || [];
    if (registered.includes(userId) || waitlist.includes(userId)) {
      return res.status(400).json({ error: 'Already registered or on waitlist' });
    }

    // Check capacity (use Saturday event's slotsTotal)
    const satEvent = await db.collection('opportunities').doc(cycle.saturdayEventId).get();
    const maxSlots = satEvent.data()?.slotsTotal || 20;

    let position: 'registered' | 'waitlist';
    if (registered.length < maxSlots) {
      registered.push(userId);
      position = 'registered';
    } else {
      waitlist.push(userId);
      position = 'waitlist';
    }

    await cycleRef.update({ registeredVolunteers: registered, waitlist });

    // Add Saturday event to volunteer's rsvpedEventIds so the general
    // 5-stage reminder cadence (7-day, 72h, 24h, 3h SMS) fires automatically
    if (position === 'registered' && cycle.saturdayEventId) {
      const volRef = db.collection('volunteers').doc(userId);
      await volRef.update({
        rsvpedEventIds: admin.firestore.FieldValue.arrayUnion(cycle.saturdayEventId),
      });
    }

    // Send confirmation email
    const vol = (await db.collection('volunteers').doc(userId).get()).data();
    if (vol?.email) {
      try {
        await EmailService.send('smo_registration_confirmed', {
          toEmail: vol.email,
          volunteerName: vol.name || vol.firstName || 'Volunteer',
          eventDate: cycle.saturdayDate,
          trainingDate: cycle.thursdayDate,
          googleMeetLink: cycle.googleMeetLink || '',
        });
      } catch (e) { console.error(`[SMO] Failed to send registration email:`, e); }
    }

    res.json({ success: true, position });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to register for SMO cycle' });
  }
});

// Volunteer self-report attendance for Thursday training
app.post('/api/smo/cycles/:cycleId/self-report', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.uid;
    const cycleRef = db.collection('smo_cycles').doc(req.params.cycleId);
    const cycleDoc = await cycleRef.get();
    if (!cycleDoc.exists) return res.status(404).json({ error: 'Cycle not found' });
    const cycle = cycleDoc.data()!;

    const selfReported: string[] = cycle.selfReported || [];
    if (selfReported.includes(userId)) {
      return res.status(400).json({ error: 'Already self-reported' });
    }

    selfReported.push(userId);
    await cycleRef.update({ selfReported });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to self-report attendance' });
  }
});

// ═══════════════════════════════════════════════════════════════
// EVENT REMINDER CADENCE API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Get reminder cadence config
app.get('/api/admin/reminder-cadence/config', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('workflow_configs').doc('reminder_cadence').get();
    if (doc.exists) {
      res.json(doc.data());
    } else {
      const defaults = {
        stages: {
          s1: { enabled: true, channel: 'email', label: 'Registration Confirmation' },
          s2: { enabled: true, channel: 'email', label: '7-Day Reminder' },
          s3: { enabled: true, channel: 'email', label: '72-Hour Reminder' },
          s4: { enabled: true, channel: 'email', label: '24-Hour Reminder' },
          s5: { enabled: true, channel: 'sms', label: '3-Hour SMS' },
        },
      };
      res.json(defaults);
    }
  } catch (error: any) {
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
  }
});

// Update reminder cadence config
app.put('/api/admin/reminder-cadence/config', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cadenceConfig = pickFields(req.body, ['enabled', 'emailEnabled', 'smsEnabled', 'minDaysBetween', 'stages', 'excludeInactive', 'w1_enabled', 'w2_enabled', 'w3_enabled', 'w4_enabled', 'w5_enabled', 'w6_enabled', 'w7_enabled']);
    await db.collection('workflow_configs').doc('reminder_cadence').set(
      { ...cadenceConfig, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
          completionDate: new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }),
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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

    const sharesSnapshotAll = await db.collection('sharing_events')
      .where('volunteerId', '==', userId)
      .get();
    // Filter by date in memory to avoid composite index requirement
    const sharesSnapshot = { size: sharesSnapshotAll.docs.filter(d => { const ts = d.data().timestamp; return ts && (typeof ts === 'string' ? new Date(ts) : ts.toDate()) >= thirtyDaysAgo; }).length };

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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
  }
});

// Streak Leaderboard (weekly committed only)
app.get('/api/leaderboard/streaks', verifyToken, async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('volunteer_profiles')
      .where('volunteerType', '==', 'weekly_committed')
      .get();
    const sortedDocs = snapshot.docs
      .sort((a, b) => (b.data().streakDays || 0) - (a.data().streakDays || 0))
      .slice(0, 50);

    const leaderboard = await Promise.all(
      sortedDocs.map(async (doc, index) => {
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
    console.error('[ERROR]', error.message); res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================
// BOARD GOVERNANCE API ENDPOINTS
// =============================================

// Get all board meetings
app.get('/api/board/meetings', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !BOARD_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Board member access required' });
    }
    const meetingsSnap = await db.collection('board_meetings').orderBy('date', 'asc').get();
    const meetings = meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(meetings);
  } catch (e) { console.error('[Board] Failed to fetch meetings:', e); res.status(500).json({ error: 'Failed to fetch meetings' }); }
});

// Create/update board meeting (admin/board chair only)
app.post('/api/board/meetings', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !BOARD_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Only admins and board members can manage board meetings' });
    }
    const { id } = req.body;
    const meetingData = pickFields(req.body, ['title', 'description', 'date', 'time', 'location', 'type', 'agenda', 'meetingLink', 'status', 'notes', 'documents', 'minutesContent']);
    if (id) {
      await db.collection('board_meetings').doc(id).set(meetingData, { merge: true });
      res.json({ id, ...meetingData });
    } else {
      const ref = await db.collection('board_meetings').add({ ...meetingData, createdBy: user.uid, createdAt: new Date().toISOString() });
      res.json({ id: ref.id, ...meetingData });
    }
  } catch (e: any) { console.error('[Board] Meeting save failed:', e); res.status(500).json({ error: 'Failed to save meeting' }); }
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
  } catch (e: any) { console.error('[Board] RSVP failed:', e); res.status(500).json({ error: 'Failed to save RSVP' }); }
});

// Request emergency meeting (emails board chair + volunteer@healthmatters.clinic)
app.post('/api/board/emergency-meeting', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !BOARD_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Board member access required' });
    }
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
            toEmail: EMAIL_CONFIG.SUPPORT_EMAIL,
            subject: `Emergency Board Meeting Requested by ${userData?.name || 'Board Member'}`,
            requestedBy: userData?.name,
            reason,
          })
        });
      } catch (e) { console.error('[Board] Failed to send emergency meeting emails:', e); }
    }
    res.json({ success: true });
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
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
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
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
  } catch (e) { console.error('[Board] Failed to fetch give-or-get:', e); res.status(500).json({ error: 'Failed to fetch give-or-get data' }); }
});

// Update Give or Get data
app.put('/api/board/give-or-get', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const giveOrGetData = pickFields(req.body, ['goal', 'raised', 'personalContribution', 'fundraised', 'prospects', 'donationLog', 'notes', 'status']);
    await db.collection('board_give_or_get').doc(user.uid).set(giveOrGetData, { merge: true });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: 'Failed to update give-or-get data' }); }
});

// Save form signature (store in Cloud Storage when available)
app.post('/api/board/forms/:formId/sign', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { signatureData } = req.body;
    const docId = `${user.uid}_${req.params.formId}`;

    let signatureStoragePath: string | undefined;
    if (bucket && signatureData?.startsWith('data:image/')) {
        try {
            signatureStoragePath = `signatures/board/${docId}.png`;
            const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
            await uploadToStorage(base64Data, signatureStoragePath, 'image/png');
        } catch { signatureStoragePath = undefined; }
    }

    await db.collection('board_form_signatures').doc(docId).set({
      volunteerId: user.uid,
      formId: req.params.formId,
      signatureStoragePath: signatureStoragePath || null,
      signatureData: signatureStoragePath ? null : signatureData,
      signedAt: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// Get signed forms for current user
app.get('/api/board/forms/signed', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const snap = await db.collection('board_form_signatures').where('volunteerId', '==', user.uid).get();
    const signed: Record<string, string> = {};
    snap.docs.forEach(d => { const data = d.data(); signed[data.formId] = data.signedAt; });
    res.json(signed);
  } catch (e) { console.error('[Board] Failed to fetch signed forms:', e); res.status(500).json({ error: 'Failed to fetch signed forms' }); }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 1: Resume download endpoint
// ═══════════════════════════════════════════════════════════════
app.get('/api/admin/volunteer/:id/resume', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const volDoc = await db.collection('volunteers').doc(req.params.id).get();
    if (!volDoc.exists) return res.status(404).json({ error: 'Volunteer not found' });
    const vol = volDoc.data()!;
    if (!vol.resume?.storagePath) return res.status(404).json({ error: 'No resume on file' });
    const { buffer, metadata } = await downloadFileBuffer(vol.resume.storagePath);
    res.set('Content-Type', vol.resume.type || metadata.contentType || 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${vol.resume.name || 'resume.pdf'}"`);
    res.send(buffer);
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 2: Clinical credential file upload/download
// ═══════════════════════════════════════════════════════════════
app.post('/api/volunteer/credential-file', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { field, base64, contentType, fileName } = req.body;
    if (!field || !base64) return res.status(400).json({ error: 'field and base64 are required' });
    const ext = fileName?.split('.').pop() || 'pdf';
    const storagePath = `credentials/${user.uid}/${field}.${ext}`;
    await uploadToStorage(base64, storagePath, contentType || 'application/pdf');
    // Update volunteer doc with storage path instead of base64
    const volRef = db.collection('volunteers').doc(user.uid);
    await volRef.update({
      [`clinicalOnboarding.credentials.${field}`]: storagePath,
    });
    res.json({ storagePath });
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/volunteer/:id/credential-file/:field', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id, field } = req.params;
    // Allow self-access or admin access
    if (user.uid !== id && !user.profile?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const volDoc = await db.collection('volunteers').doc(id).get();
    if (!volDoc.exists) return res.status(404).json({ error: 'Volunteer not found' });
    const creds = volDoc.data()?.clinicalOnboarding?.credentials || {};
    const storagePath = creds[field];
    if (!storagePath || typeof storagePath !== 'string' || !storagePath.startsWith('credentials/')) {
      return res.status(404).json({ error: 'Credential file not found' });
    }
    const { buffer, metadata } = await downloadFileBuffer(storagePath);
    res.set('Content-Type', metadata.contentType || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${field}.pdf"`);
    res.send(buffer);
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- FLYER / DOCUMENT UPLOAD TO CLOUD STORAGE ---
app.post('/api/events/:id/flyer', verifyToken, async (req: Request, res: Response) => {
  try {
    const { base64, contentType, fileName } = req.body;
    if (!base64) return res.status(400).json({ error: 'base64 data required' });
    const ext = fileName?.split('.').pop() || 'png';
    const storagePath = `flyers/${req.params.id}/flyer.${ext}`;
    await uploadToStorage(base64, storagePath, contentType || 'image/png');
    // Store the serving endpoint URL (not a signed URL which would expire)
    const flyerUrl = `/api/events/${req.params.id}/flyer/download`;
    await db.collection('opportunities').doc(req.params.id).update({
        flyerUrl,
        flyerStoragePath: storagePath,
        flyerBase64: admin.firestore.FieldValue.delete(),
    });
    res.json({ flyerUrl, storagePath });
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// Serve flyer image from Cloud Storage (no signed URL needed)
app.get('/api/events/:id/flyer/download', async (req: Request, res: Response) => {
  try {
    const oppDoc = await db.collection('opportunities').doc(req.params.id).get();
    if (!oppDoc.exists) return res.status(404).json({ error: 'Event not found' });
    const storagePath = oppDoc.data()?.flyerStoragePath;
    if (!storagePath) return res.status(404).json({ error: 'No flyer uploaded' });
    const { buffer, metadata } = await downloadFileBuffer(storagePath);
    res.set('Content-Type', metadata.contentType || 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 3: PDF export — Board forms + Clinical documents
// ═══════════════════════════════════════════════════════════════
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') { lines.push(''); continue; }
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

app.get('/api/board/forms/:formId/pdf', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { formId } = req.params;
    const volunteerId = (req.query.volunteerId as string) || user.uid;

    // Admin or self-access only
    if (volunteerId !== user.uid && !user.profile?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const formContent = BOARD_FORM_CONTENTS[formId];
    if (!formContent) return res.status(404).json({ error: 'Form not found' });

    // Get signature data
    const sigDoc = await db.collection('board_form_signatures').doc(`${volunteerId}_${formId}`).get();
    if (!sigDoc.exists) return res.status(404).json({ error: 'Form not signed' });
    const sigData = sigDoc.data()!;

    // Get volunteer name
    const volDoc = await db.collection('volunteers').doc(volunteerId).get();
    const volName = volDoc.exists ? volDoc.data()?.name || 'Volunteer' : 'Volunteer';

    // Build PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 50;
    const pageWidth = 612;
    const pageHeight = 792;
    const usableWidth = pageWidth - 2 * margin;
    const fontSize = 10;
    const lineHeight = 14;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Title
    const title = formId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    page.drawText('HEALTH MATTERS CLINIC', { x: margin, y, font: fontBold, size: 14, color: rgb(0.1, 0.1, 0.1) });
    y -= 22;
    page.drawText(title, { x: margin, y, font: fontBold, size: 12, color: rgb(0.2, 0.2, 0.2) });
    y -= 24;

    // Body text
    const wrappedLines = wrapText(formContent, usableWidth, font, fontSize);
    for (const line of wrappedLines) {
      if (y < margin + 80) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, font, size: fontSize, color: rgb(0.15, 0.15, 0.15) });
      y -= lineHeight;
    }

    // Signature section
    if (y < margin + 140) { page = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
    y -= 30;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 20;

    // Embed signature image if available (from Cloud Storage or inline)
    let sigBase64: string | null = null;
    if (sigData.signatureStoragePath && bucket) {
      try {
        const file = bucket.file(sigData.signatureStoragePath);
        const [contents] = await file.download();
        sigBase64 = contents.toString('base64');
      } catch { /* fall through to inline */ }
    }
    if (!sigBase64 && sigData.signatureData && sigData.signatureData.startsWith('data:image/png')) {
      sigBase64 = sigData.signatureData.split(',')[1];
    }
    if (sigBase64) {
      try {
        const sigImage = await pdfDoc.embedPng(Buffer.from(sigBase64, 'base64'));
        const sigDims = sigImage.scale(0.5);
        const sigWidth = Math.min(sigDims.width, 200);
        const sigHeight = (sigWidth / sigDims.width) * sigDims.height;
        page.drawImage(sigImage, { x: margin, y: y - sigHeight, width: sigWidth, height: sigHeight });
        y -= sigHeight + 10;
      } catch { /* skip if signature embed fails */ }
    }

    page.drawText(`Signed by: ${volName}`, { x: margin, y, font: fontBold, size: 10, color: rgb(0.2, 0.2, 0.2) });
    y -= 16;
    page.drawText(`Date: ${new Date(sigData.signedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { x: margin, y, font, size: 10, color: rgb(0.3, 0.3, 0.3) });
    y -= 16;
    page.drawText(`Document ID: ${formId}`, { x: margin, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="HMC-${formId}-signed.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (e: any) { console.error('[PDF] Board form export error:', e); console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/clinical/forms/:docId/pdf', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { docId } = req.params;
    const volunteerId = (req.query.volunteerId as string) || user.uid;

    if (volunteerId !== user.uid && !user.profile?.isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const volDoc = await db.collection('volunteers').doc(volunteerId).get();
    if (!volDoc.exists) return res.status(404).json({ error: 'Volunteer not found' });
    const vol = volDoc.data()!;
    const docInfo = vol.clinicalOnboarding?.documents?.[docId];
    if (!docInfo?.signed) return res.status(404).json({ error: 'Document not signed' });
    const volName = vol.name || 'Volunteer';

    // Clinical documents: title map
    const docTitles: Record<string, string> = {
      clinicalOnboardingGuide: 'Clinical Onboarding & Governance Guide',
      policiesProcedures: 'Clinical Policies & Procedures Manual',
      screeningConsent: 'General Screening Consent Form',
      standingOrders: 'Standing Orders v3.0',
    };

    const signedDate = new Date(docInfo.signedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const volRole = vol.role || vol.appliedRole || 'Volunteer';
    const volEmail = vol.email || '';
    const refId = `HMC-${docId.substring(0, 4).toUpperCase()}-${volunteerId.substring(0, 6).toUpperCase()}-${new Date(docInfo.signedAt).getTime().toString(36).toUpperCase()}`;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const page = pdfDoc.addPage([612, 792]);
    const margin = 50;
    const pageWidth = 612;
    const contentWidth = pageWidth - margin * 2;
    let y = 792 - margin;
    const green = rgb(0.086, 0.639, 0.247);
    const darkGray = rgb(0.1, 0.1, 0.1);
    const midGray = rgb(0.3, 0.3, 0.3);
    const lightGray = rgb(0.6, 0.6, 0.6);

    // Header bar
    page.drawRectangle({ x: 0, y: 792 - 4, width: pageWidth, height: 4, color: green });

    // Organization name
    page.drawText('HEALTH MATTERS CLINIC', { x: margin, y, font: fontBold, size: 18, color: green });
    y -= 22;
    page.drawText('Los Angeles County, California', { x: margin, y, font, size: 9, color: midGray });
    y -= 32;

    // Title
    page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: margin + contentWidth, y: y + 8 }, thickness: 1, color: green });
    y -= 8;
    page.drawText('CLINICAL DOCUMENT ACKNOWLEDGMENT CERTIFICATE', { x: margin, y, font: fontBold, size: 13, color: darkGray });
    y -= 20;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: margin + contentWidth, y: y + 4 }, thickness: 0.5, color: lightGray });
    y -= 28;

    // Document details section
    page.drawText('DOCUMENT DETAILS', { x: margin, y, font: fontBold, size: 9, color: green });
    y -= 20;

    const drawField = (label: string, value: string, yPos: number) => {
      page.drawText(label, { x: margin, y: yPos, font: fontBold, size: 9, color: midGray });
      page.drawText(value, { x: margin + 140, y: yPos, font, size: 10, color: darkGray });
      return yPos - 18;
    };

    y = drawField('Document:', docTitles[docId] || docId, y);
    y = drawField('Reference ID:', refId, y);
    y -= 12;

    // Volunteer details section
    page.drawText('VOLUNTEER DETAILS', { x: margin, y, font: fontBold, size: 9, color: green });
    y -= 20;
    y = drawField('Full Name:', volName, y);
    y = drawField('Role:', volRole, y);
    if (volEmail) y = drawField('Email:', volEmail, y);
    y = drawField('Date Acknowledged:', signedDate, y);
    y -= 12;

    // Attestation
    page.drawRectangle({ x: margin, y: y - 60, width: contentWidth, height: 70, color: rgb(0.96, 0.98, 0.96), borderColor: rgb(0.85, 0.92, 0.85), borderWidth: 1 });
    y -= 6;
    page.drawText('ATTESTATION', { x: margin + 12, y, font: fontBold, size: 9, color: green });
    y -= 16;
    page.drawText(`I, ${volName}, confirm that I have thoroughly reviewed and understand the`, { x: margin + 12, y, font, size: 9, color: darkGray });
    y -= 14;
    page.drawText(`${docTitles[docId] || docId}. I acknowledge my responsibility to comply with all`, { x: margin + 12, y, font, size: 9, color: darkGray });
    y -= 14;
    page.drawText('policies, procedures, and standards outlined in this document as part of my clinical duties at HMC.', { x: margin + 12, y, font, size: 9, color: darkGray });
    y -= 28;

    // Signature
    page.drawText('SIGNATURE', { x: margin, y, font: fontBold, size: 9, color: green });
    y -= 20;

    let clinicalSigBase64: string | null = null;
    if (docInfo.signatureStoragePath && bucket) {
      try {
        const file = bucket.file(docInfo.signatureStoragePath);
        const [contents] = await file.download();
        clinicalSigBase64 = contents.toString('base64');
      } catch { /* fall through to inline */ }
    }
    if (!clinicalSigBase64 && docInfo.signatureData && docInfo.signatureData.startsWith('data:image/png')) {
      clinicalSigBase64 = docInfo.signatureData.split(',')[1];
    }
    if (clinicalSigBase64) {
      try {
        const sigImage = await pdfDoc.embedPng(Buffer.from(clinicalSigBase64, 'base64'));
        const sigDims = sigImage.scale(0.5);
        const sigWidth = Math.min(sigDims.width, 200);
        const sigHeight = Math.min((sigWidth / sigDims.width) * sigDims.height, 60);
        page.drawImage(sigImage, { x: margin, y: y - sigHeight, width: sigWidth, height: sigHeight });
        y -= sigHeight + 8;
      } catch { /* skip if signature embed fails */ }
    }

    page.drawLine({ start: { x: margin, y }, end: { x: margin + 250, y }, thickness: 0.5, color: midGray });
    y -= 14;
    page.drawText(volName, { x: margin, y, font: fontBold, size: 10, color: darkGray });
    page.drawText(signedDate, { x: margin + 280, y, font, size: 10, color: darkGray });
    y -= 12;
    page.drawText(volRole, { x: margin, y, font, size: 9, color: midGray });
    page.drawLine({ start: { x: margin + 270, y: y + 24 }, end: { x: margin + contentWidth, y: y + 24 }, thickness: 0.5, color: midGray });
    y -= 40;

    // Footer
    page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: margin + contentWidth, y: y + 10 }, thickness: 0.5, color: lightGray });
    y -= 8;
    page.drawText('This certificate is electronically generated and stored in the HMC Volunteer Portal.', { x: margin, y, font: fontItalic, size: 8, color: lightGray });
    y -= 12;
    page.drawText(`Ref: ${refId}  |  Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { x: margin, y, font, size: 8, color: lightGray });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="HMC-clinical-${docId}-signed.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (e: any) { console.error('[PDF] Clinical form export error:', e); console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 4: Admin compliance overview
// ═══════════════════════════════════════════════════════════════
app.get('/api/admin/compliance-overview', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Fetch all board form signatures
    const sigSnap = await db.collection('board_form_signatures').get();
    const signaturesByVolunteer: Record<string, Record<string, string>> = {};
    sigSnap.docs.forEach(d => {
      const data = d.data();
      if (!signaturesByVolunteer[data.volunteerId]) signaturesByVolunteer[data.volunteerId] = {};
      signaturesByVolunteer[data.volunteerId][data.formId] = data.signedAt;
    });

    // Fetch all volunteers (active + onboarding, not applicants)
    const volSnap = await db.collection('volunteers').where('applicationStatus', 'in', ['approved', undefined]).get();
    const overview = volSnap.docs.map(d => {
      const v = d.data();
      return {
        id: d.id,
        name: v.name,
        role: v.volunteerRole || v.role,
        status: v.status,
        compliance: v.compliance || {},
        boardFormSignatures: signaturesByVolunteer[d.id] || {},
        clinicalDocuments: v.clinicalOnboarding?.documents || {},
        clinicalCompleted: v.clinicalOnboarding?.completed || false,
      };
    });

    res.json(overview);
  } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- DATA EXPORT ENDPOINTS (Admin only) ---
app.get('/api/admin/export/:collection', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    const { collection } = req.params;
    const allowed = ['incidents', 'screenings', 'clients', 'referrals', 'audit_logs', 'feedback'];
    if (!allowed.includes(collection)) return res.status(400).json({ error: `Invalid collection. Allowed: ${allowed.join(', ')}` });

    try {
        const snap = await db.collection(collection).get();
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const format = req.query.format as string;
        if (format === 'csv') {
            if (data.length === 0) return res.status(200).send('');
            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(',')];
            data.forEach(row => {
                csvRows.push(headers.map(h => {
                    const val = (row as any)[h];
                    const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
                    return `"${str.replace(/"/g, '""')}"`;
                }).join(','));
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${collection}_export.csv"`);
            return res.send(csvRows.join('\n'));
        }

        res.json(data);
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- KNOWLEDGE BASE PERSISTENCE ---
app.get('/api/knowledge-base', verifyToken, async (_req: Request, res: Response) => {
    try {
        const snap = await db.collection('knowledge_base').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/knowledge-base', verifyToken, requireEditor, async (req: Request, res: Response) => {
    try {
        const article: any = { ...pickFields(req.body, ['title', 'content', 'category', 'tags', 'icon', 'order', 'isPublished']), updatedAt: new Date().toISOString() };
        if (!article.title || !article.content) return res.status(400).json({ error: 'title and content required' });
        const ref = await db.collection('knowledge_base').add(article);
        res.json({ id: ref.id, ...article });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/knowledge-base/:id', verifyToken, requireEditor, async (req: Request, res: Response) => {
    try {
        const updates = { ...pickFields(req.body, ['title', 'content', 'category', 'tags', 'icon', 'order', 'isPublished']), updatedAt: new Date().toISOString() };
        await db.collection('knowledge_base').doc(req.params.id).set(updates, { merge: true });
        res.json({ id: req.params.id, ...updates });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.delete('/api/knowledge-base/:id', verifyToken, requireEditor, async (req: Request, res: Response) => {
    try {
        await db.collection('knowledge_base').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- INCIDENT & AUDIT LOG ADMIN DASHBOARD ---
app.get('/api/admin/incidents', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('incidents').orderBy('timestamp', 'desc').get()
            .catch(() => db.collection('incidents').get());
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/admin/audit-logs', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
        const snap = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(limit).get()
            .catch(() => db.collection('audit_logs').limit(limit).get());
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- BULK OPERATIONS (Admin) ---
app.post('/api/admin/bulk/approve', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { volunteerIds } = req.body;
        if (!Array.isArray(volunteerIds) || volunteerIds.length === 0) return res.status(400).json({ error: 'volunteerIds array required' });
        if (volunteerIds.length > 50) return res.status(400).json({ error: 'Max 50 volunteers at a time' });

        const batch = db.batch();
        volunteerIds.forEach((id: string) => {
            batch.update(db.collection('volunteers').doc(id), {
                applicationStatus: 'approved',
                status: 'onboarding',
                'compliance.application.status': 'completed',
                'compliance.application.dateCompleted': new Date().toISOString(),
            });
        });
        await batch.commit();
        res.json({ success: true, count: volunteerIds.length });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/admin/bulk/role-change', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { volunteerIds, newRole } = req.body;
        if (!Array.isArray(volunteerIds) || !newRole) return res.status(400).json({ error: 'volunteerIds and newRole required' });
        if (volunteerIds.length > 50) return res.status(400).json({ error: 'Max 50 volunteers at a time' });

        const batch = db.batch();
        volunteerIds.forEach((id: string) => {
            batch.update(db.collection('volunteers').doc(id), { volunteerRole: newRole, role: newRole });
        });
        await batch.commit();
        res.json({ success: true, count: volunteerIds.length });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/admin/export-volunteers', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const snap = await db.collection('volunteers').get();
        const volunteers = snap.docs.map(d => {
            const v = d.data();
            return {
                id: d.id,
                name: v.name,
                email: v.email,
                phone: v.phone,
                role: v.volunteerRole || v.role,
                status: v.status,
                applicationStatus: v.applicationStatus,
                joinedDate: v.joinedDate,
                hoursContributed: v.hoursContributed || 0,
                points: v.points || 0,
            };
        });
        const headers = Object.keys(volunteers[0] || {});
        const csvRows = [headers.join(',')];
        volunteers.forEach(v => {
            csvRows.push(headers.map(h => `"${String((v as any)[h] ?? '').replace(/"/g, '""')}"`).join(','));
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="volunteers_export.csv"');
        res.send(csvRows.join('\n'));
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- ACCOUNT DEACTIVATION ---
app.post('/api/admin/deactivate-volunteer', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { volunteerId, reason } = req.body;
        if (!volunteerId) return res.status(400).json({ error: 'volunteerId required' });

        await db.collection('volunteers').doc(volunteerId).update({
            status: 'inactive',
            deactivatedAt: new Date().toISOString(),
            deactivationReason: reason || 'Admin deactivation',
        });

        // Log the deactivation
        await db.collection('audit_logs').add({
            actionType: 'DEACTIVATE_ACCOUNT',
            targetId: volunteerId,
            performedBy: (req as any).user.uid,
            timestamp: new Date().toISOString(),
            summary: `Volunteer ${volunteerId} deactivated: ${reason || 'Admin deactivation'}`,
        });

        res.json({ success: true });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/admin/reactivate-volunteer', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { volunteerId } = req.body;
        if (!volunteerId) return res.status(400).json({ error: 'volunteerId required' });

        await db.collection('volunteers').doc(volunteerId).update({
            status: 'active',
            deactivatedAt: admin.firestore.FieldValue.delete(),
            deactivationReason: admin.firestore.FieldValue.delete(),
        });

        res.json({ success: true });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- ANNOUNCEMENT CRUD ---
app.post('/api/announcements', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { title, content, priority } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'title and content required' });
        const announcement = {
            title, content,
            priority: priority || 'normal',
            date: new Date().toISOString(),
            createdBy: (req as any).user.uid,
        };
        const ref = await db.collection('announcements').add(announcement);
        res.json({ id: ref.id, ...announcement });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/announcements/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        const updates = { ...pickFields(req.body, ['title', 'content', 'priority', 'expiresAt', 'targetRoles', 'pinned']), updatedAt: new Date().toISOString() };
        await db.collection('announcements').doc(req.params.id).update(updates);
        res.json({ id: req.params.id, ...updates });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.delete('/api/announcements/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
    try {
        await db.collection('announcements').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- HEALTH SCREENINGS ---
app.post('/api/screenings/create', verifyToken, async (req: Request, res: Response) => {
    try {
        const screeningData = req.body;
        const user = (req as any).user;
        const createdAt = new Date().toISOString();
        const screening = { ...screeningData, performedBy: user.uid, performedByName: user.profile?.name || 'Unknown', createdAt };

        // Look up client name for display
        if (screening.clientId) {
            try {
                const clientDoc = await db.collection('clients').doc(screening.clientId).get();
                if (clientDoc.exists) {
                    const cd = clientDoc.data();
                    screening.clientName = `${cd?.firstName || ''} ${cd?.lastName || ''}`.trim();
                }
            } catch { /* ignore */ }
        }

        const ref = await db.collection('screenings').add(screening);

        // Send alert notifications for flagged screenings
        if (screening.followUpNeeded || screening.flags?.bloodPressure?.level === 'critical' || screening.flags?.glucose?.level === 'critical') {
            try {
                const flagParts: string[] = [];
                if (screening.flags?.bloodPressure) flagParts.push(`BP: ${screening.flags.bloodPressure.label}`);
                if (screening.flags?.glucose) flagParts.push(`Glucose: ${screening.flags.glucose.label}`);
                const flagSummary = flagParts.length > 0 ? flagParts.join(', ') : 'Follow-up needed';

                // Find medical professionals and leads at this event
                const alertRoles = ['Licensed Medical Professional', 'Medical Admin', 'Outreach & Engagement Lead'];
                if (screening.eventId) {
                    const volSnap = await db.collection('volunteers')
                        .where('status', '==', 'active')
                        .get();
                    const notifyVols = volSnap.docs.filter(d => {
                        const data = d.data();
                        return alertRoles.includes(data.role) || data.isAdmin;
                    });
                    const notifBatch = db.batch();
                    for (const vol of notifyVols) {
                        if (vol.id === user.uid) continue; // Don't notify self
                        const notifRef = db.collection('notifications').doc();
                        notifBatch.set(notifRef, {
                            userId: vol.id,
                            type: 'screening_alert',
                            title: 'Screening Alert',
                            body: `⚠️ Alert: ${screening.clientName || 'Client'} — ${flagSummary}. Review needed.`,
                            screeningId: ref.id,
                            eventId: screening.eventId || null,
                            read: false,
                            createdAt,
                        });
                    }
                    await notifBatch.commit();
                }
            } catch (notifErr) {
                console.warn('[SCREENING] Alert notifications failed:', notifErr);
            }
        }

        res.json({ id: ref.id, ...screening });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/screenings', verifyToken, async (req: Request, res: Response) => {
    try {
        const { clientId, shiftId } = req.query;
        // Use only one where clause to avoid composite index requirement, filter second in memory
        let query: admin.firestore.Query = db.collection('screenings');
        if (clientId) query = query.where('clientId', '==', clientId);
        const snap = await query.get();
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (shiftId) results = results.filter((r: any) => r.shiftId === shiftId);
        res.json(results);
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// Get all screenings for an event (for live feed)
// Also fetches today's screenings that have no eventId so nothing gets lost
app.get('/api/ops/screenings/:eventId', verifyToken, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        // Query 1: screenings matching this eventId
        const eventSnap = await db.collection('screenings')
            .where('eventId', '==', eventId)
            .get();
        const seenIds = new Set<string>();
        const screenings: any[] = [];
        for (const doc of eventSnap.docs) {
            seenIds.add(doc.id);
            screenings.push({ id: doc.id, ...doc.data() });
        }
        // Query 2: today's screenings that may be missing an eventId
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayISO = todayStart.toISOString();
        const todaySnap = await db.collection('screenings')
            .where('createdAt', '>=', todayISO)
            .get();
        for (const doc of todaySnap.docs) {
            if (seenIds.has(doc.id)) continue;
            const data = doc.data();
            // Include screenings with no eventId or null eventId (orphaned)
            if (!data.eventId) {
                screenings.push({ id: doc.id, ...data });
            }
        }
        // Deduplicate by clientId — keep most recent screening per client
        screenings.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const seenClients = new Set<string>();
        const dedupedScreenings: any[] = [];
        for (const s of screenings) {
            const key = s.clientId || s.id;
            if (seenClients.has(key)) continue;
            seenClients.add(key);
            dedupedScreenings.push(s);
        }
        res.json(dedupedScreenings);
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// Get all screenings from today (fallback when no event is selected)
app.get('/api/ops/screenings-today', verifyToken, async (req: Request, res: Response) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayISO = todayStart.toISOString();
        const snap = await db.collection('screenings')
            .where('createdAt', '>=', todayISO)
            .get();
        const screenings: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Deduplicate by clientId — keep most recent screening per client
        screenings.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const seenClients = new Set<string>();
        const dedupedScreenings: any[] = [];
        for (const s of screenings) {
            const key = s.clientId || s.id;
            if (seenClients.has(key)) continue;
            seenClients.add(key);
            dedupedScreenings.push(s);
        }
        res.json(dedupedScreenings);
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// Dismiss/delete a duplicate or erroneous screening (medical leads + admins only)
app.delete('/api/ops/screenings/:screeningId', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const callerData = user.profile;
        const allowedRoles = ['Licensed Medical Professional', 'Medical Admin', 'Outreach & Engagement Lead'];
        if (!callerData?.isAdmin && !allowedRoles.includes(callerData?.role)) {
            return res.status(403).json({ error: 'Only medical professionals and admins can dismiss screenings' });
        }
        const { screeningId } = req.params;
        await db.collection('screenings').doc(screeningId).delete();
        console.log(`[SCREENING] Deleted screening ${screeningId} by ${callerData?.name || user.uid}`);
        res.json({ success: true });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// Mark a screening as clinically reviewed
app.put('/api/ops/screenings/:screeningId/review', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const callerData = user.profile;
        const allowedRoles = ['Licensed Medical Professional', 'Medical Admin', 'Outreach & Engagement Lead'];
        if (!callerData?.isAdmin && !allowedRoles.includes(callerData?.role)) {
            return res.status(403).json({ error: 'Only medical professionals and admins can review screenings' });
        }
        const { screeningId } = req.params;
        const { reviewNotes, clinicalAction } = req.body;
        const reviewData = {
            reviewedAt: new Date().toISOString(),
            reviewedBy: user.uid,
            reviewedByName: callerData?.name || 'Unknown',
            reviewNotes: reviewNotes || '',
            clinicalAction: clinicalAction || 'Cleared',
        };
        await db.collection('screenings').doc(screeningId).update(reviewData);
        res.json({ success: true, ...reviewData });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- TEAM MANAGEMENT ---
app.get('/api/team/members', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const callerData = user.profile;
        if (!callerData?.isAdmin && !callerData?.isTeamLead) {
            return res.status(403).json({ error: 'Only admins and team leads can view team members' });
        }
        const snap = await db.collection('volunteers')
            .where('managedBy', '==', user.uid)
            .get();
        const members = snap.docs.map(d => {
            const data = d.data();
            return { id: d.id, name: data.name, email: data.email, role: data.role, status: data.status, groupName: data.groupName, assignedShiftIds: data.assignedShiftIds || [] };
        });
        res.json(members);
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/team/add-member', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const callerData = user.profile;
        if (!callerData?.isAdmin && !callerData?.isTeamLead) {
            return res.status(403).json({ error: 'Only admins and team leads can add team members' });
        }
        const { volunteerId } = req.body;
        if (!volunteerId) return res.status(400).json({ error: 'volunteerId is required' });
        const volDoc = await db.collection('volunteers').doc(volunteerId).get();
        if (!volDoc.exists) return res.status(404).json({ error: 'Volunteer not found' });
        const volData = volDoc.data();
        if (volData?.managedBy && volData.managedBy !== user.uid) {
            return res.status(409).json({ error: 'Volunteer is already managed by another team lead' });
        }
        await db.collection('volunteers').doc(volunteerId).update({ managedBy: user.uid });
        res.json({ success: true, volunteer: { id: volunteerId, name: volData?.name, email: volData?.email, role: volData?.role, status: volData?.status } });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.delete('/api/team/remove-member/:memberId', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const callerData = user.profile;
        const { memberId } = req.params;
        const volDoc = await db.collection('volunteers').doc(memberId).get();
        if (!volDoc.exists) return res.status(404).json({ error: 'Volunteer not found' });
        const volData = volDoc.data();
        if (!callerData?.isAdmin && (!callerData?.isTeamLead || volData?.managedBy !== user.uid)) {
            return res.status(403).json({ error: 'You can only remove members from your own team' });
        }
        await db.collection('volunteers').doc(memberId).update({ managedBy: admin.firestore.FieldValue.delete() });
        res.json({ success: true });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/team/invite', verifyToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const callerData = user.profile;
        if (!callerData?.isAdmin && !callerData?.isTeamLead) {
            return res.status(403).json({ error: 'Only admins and team leads can invite members' });
        }
        const { email, name, groupName } = req.body;
        if (!email || !name) return res.status(400).json({ error: 'Name and email are required' });

        // Check if already registered
        const existingSnap = await db.collection('volunteers')
            .where('email', '==', email.toLowerCase())
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            const existing = existingSnap.docs[0];
            return res.json({ alreadyRegistered: true, volunteerId: existing.id, volunteerName: existing.data().name });
        }

        // Create invite record
        const inviteData = {
            email: email.toLowerCase(),
            name,
            groupName: groupName || null,
            invitedBy: user.uid,
            invitedAt: new Date().toISOString(),
            status: 'pending',
            invitedAsTeamMember: true,
            teamLeadId: user.uid,
        };
        const inviteRef = await db.collection('event_invites').add(inviteData);

        // Send invite email
        const emailResult = await EmailService.send('event_volunteer_invite', {
            toEmail: email.toLowerCase(),
            volunteerName: name,
            eventTitle: 'the HMC Volunteer Team',
            eventDate: 'ongoing',
        });

        res.json({ sent: true, inviteId: inviteRef.id, emailFailed: !emailResult.sent, emailReason: emailResult.sent ? undefined : (emailResult.reason || 'Email service not configured') });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- INCIDENT PERSISTENCE ---
app.post('/api/incidents/create', verifyToken, async (req: Request, res: Response) => {
    try {
        const { type, description, severity, location, eventId, reportedBy } = req.body;
        const createdAt = new Date().toISOString();
        const incident = { type, description, severity, location, eventId, reportedBy, createdAt };
        const ref = await db.collection('incidents').add(incident);
        res.json({ id: ref.id, ...incident });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- AUDIT LOG PERSISTENCE ---
app.post('/api/audit-logs/create', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id, actionType, summary, actorUserId, actorRole, shiftId, eventId, targetSystem, targetId, timestamp } = req.body;
        const log = {
            actionType: actionType || req.body.action || 'UNKNOWN',
            summary: summary || req.body.details || '',
            actorUserId: actorUserId || req.body.userId || (req as any).user?.uid || '',
            actorRole: actorRole || '',
            shiftId: shiftId || '',
            eventId: eventId || '',
            targetSystem: targetSystem || '',
            targetId: targetId || '',
            timestamp: timestamp || new Date().toISOString(),
        };
        const ref = await db.collection('audit_logs').add(log);
        res.json({ id: ref.id, ...log });
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// --- STANDALONE DATA ENDPOINTS (for post-sync reload) ---
app.get('/api/opportunities', verifyToken, async (_req: Request, res: Response) => {
    try {
        const snap = await db.collection('opportunities').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/shifts', verifyToken, async (_req: Request, res: Response) => {
    try {
        const snap = await db.collection('shifts').get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e: any) { console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════
// SMS ENDPOINTS & TWILIO WEBHOOKS
// ═══════════════════════════════════════════════════════════════

// POST /api/sms/send — Backend-only SMS send (authenticated)
app.post('/api/sms/send', verifyToken, rateLimit(20, 60000), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    if (!userData?.isAdmin && !ORG_CALENDAR_ROLES.includes(userData?.role)) {
      return res.status(403).json({ error: 'Only admins and coordinators can send SMS' });
    }
    const { to, body } = req.body;
    if (!to || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, body' });
    }
    if (typeof body !== 'string' || body.length > 1600) {
      return res.status(400).json({ error: 'Message body must be a string under 1600 characters' });
    }
    const phoneRegex = /^\+?1?\d{10,15}$/;
    if (!phoneRegex.test(to.replace(/[\s()-]/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    const result = await sendSMS(null, to, body);
    if (result.sent) {
      // Log SMS send for audit trail
      await db.collection('sms_logs').add({
        to, bodyPreview: body.substring(0, 100), sentBy: user.uid, sentAt: new Date().toISOString(), status: 'sent'
      });
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'SMS send failed', reason: result.reason });
    }
  } catch (e: any) {
    console.error('[SMS] /api/sms/send error:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/twilio/inbound — Receive inbound SMS from Twilio
app.post('/api/twilio/inbound', validateTwilioSignature, async (req: Request, res: Response) => {
  try {
    const { From, Body, MessageSid } = req.body;
    console.log(`[TWILIO] Inbound SMS from ${maskPhone(From || '')}: ${(Body || '').substring(0, 50)}`);

    // Normalize the reply keyword
    const normalized = (Body || '').trim().toUpperCase();

    // Log inbound message
    await db.collection('sms_inbound').add({
      from: From, body: Body, messageSid: MessageSid, receivedAt: new Date().toISOString(), normalized
    });

    // Handle common keywords
    let replyMessage = 'Thanks for your message! Reply YES to confirm, STOP to opt out.';

    if (normalized === 'YES' || normalized === 'Y' || normalized === 'CONFIRM') {
      // Try to find a pending RSVP for this phone number
      const phone = normalizePhone(From || '');
      if (phone) {
        const volSnap = await db.collection('volunteers')
          .where('phone', '==', phone).limit(1).get();
        if (!volSnap.empty) {
          replyMessage = 'Thanks for confirming! See you there.';
        }
      }
    } else if (normalized === 'NO' || normalized === 'N' || normalized === 'CANCEL') {
      replyMessage = 'Got it. Your RSVP has been noted as declined.';
    } else if (normalized === 'HELP') {
      replyMessage = 'Health Matters Clinic Volunteer Portal. Reply YES to confirm, NO to decline, STOP to opt out of SMS.';
    }
    // STOP/UNSTOP are handled automatically by Twilio Messaging Service

    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyMessage}</Message></Response>`);
  } catch (e: any) {
    console.error('[TWILIO] Inbound handler error:', e.message);
    // Always return 200 to Twilio to prevent retries
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

// POST /api/twilio/inbound-failover — Failover for inbound SMS
app.post('/api/twilio/inbound-failover', validateTwilioSignature, async (req: Request, res: Response) => {
  const { From, Body, MessageSid } = req.body;
  console.warn(`[TWILIO] Failover inbound from ${maskPhone(From || '')}, SID: ${MessageSid}`);
  await db.collection('sms_inbound').add({
    from: From, body: Body, messageSid: MessageSid, receivedAt: new Date().toISOString(), failover: true
  }).catch(() => {});
  res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Thanks for your message. Please try again later.</Message></Response>');
});

// POST /api/twilio/status — Delivery status callback
app.post('/api/twilio/status', validateTwilioSignature, async (req: Request, res: Response) => {
  try {
    const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = req.body;
    console.log(`[TWILIO] Status: ${MessageStatus} for ${maskPhone(To || '')} (SID: ${MessageSid})`);

    // Persist delivery status for debugging & reporting
    await db.collection('sms_delivery_status').add({
      messageSid: MessageSid, status: MessageStatus, to: To,
      errorCode: ErrorCode || null, errorMessage: ErrorMessage || null,
      receivedAt: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('[TWILIO] Status callback error:', e.message);
  }
  // Always return 200 to Twilio
  res.sendStatus(200);
});

// --- SERVE FRONTEND & INJECT RUNTIME CONFIG ---
const buildPath = path.resolve(process.cwd(), 'dist/client');
// Serve public/documents directly (clinical onboarding HTML files) — ensures they're available
// even before a fresh build copies them to dist/client
const publicDocsPath = path.resolve(process.cwd(), 'public/documents');
app.use('/documents', express.static(publicDocsPath));
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

// Unified event query helper — queries all event collections and normalizes response shape
async function queryAllEvents(filters: { callerRole?: string; isAdmin?: boolean; dateFrom?: string; dateTo?: string } = {}): Promise<any[]> {
  const { callerRole = '', isAdmin = false, dateFrom, dateTo } = filters;

  // Use individual try/catch per collection so one failure doesn't crash everything
  const safeGet = (collection: string) => db.collection(collection).get().catch((e: any) => {
    console.warn(`[ORG-CALENDAR] ${collection} query failed:`, e.message);
    return { docs: [] as any[] };
  });
  const [orgSnap, boardSnap, oppsSnap, shiftsSnap] = await Promise.all([
    safeGet('org_calendar_events'),
    safeGet('board_meetings'),
    safeGet('opportunities'),
    safeGet('shifts'),
  ]);

  // 1. Org calendar events (native) — filter by visibleTo
  const orgEvents = orgSnap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    sourceCollection: 'org_calendar_events',
    source: 'org-calendar',
  })).filter((e: any) => {
    if (isAdmin) return true;
    if (!e.visibleTo || e.visibleTo.length === 0) return true;
    return e.visibleTo.includes(callerRole);
  });

  // 2. Board meetings — visible to all authenticated users on the calendar
  const boardEvents = boardSnap.docs.map(d => {
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
      sourceCollection: 'board_meetings',
      source: 'board-meeting',
    };
  });

  // 3. Opportunities → mapped to OrgCalendarEvent shape with smart category mapping
  const mapOppCategory = (category: string, title: string): string => {
    const cat = (category || '').toLowerCase();
    const t = (title || '').toLowerCase();
    // Wellness: any Unstoppable event, wellness category, community run/walk
    if (cat.includes('wellness') || cat.includes('community run') || cat.includes('walk')
        || t.includes('unstoppable') || t.includes('walk run') || t.includes('walk/run')) return 'wellness';
    // Outreach: tabling, community outreach, survey collection
    if (cat.includes('outreach') || cat.includes('tabling') || cat.includes('survey')) return 'outreach';
    // Workshop: workshop, wellness education
    if (cat.includes('workshop') || cat.includes('education')) return 'workshop';
    // Street Medicine
    if (cat.includes('street medicine')) return 'street-medicine';
    // Health Fair
    if (cat.includes('health fair')) return 'health-fair';
    // Training
    if (cat.includes('training')) return 'training';
    // Default community event
    return 'community-event';
  };

  const oppEvents = oppsSnap.docs.map(d => {
    const o = d.data();
    return {
      id: d.id,
      title: o.title || 'Community Event',
      description: o.description || undefined,
      date: o.date ? (o.date.includes('T') ? o.date.split('T')[0] : o.date) : '',
      startTime: o.time || o.dateDisplay || '',
      type: mapOppCategory(o.category, o.title),
      location: o.serviceLocation || undefined,
      sourceCollection: 'opportunities',
      source: 'event-finder',
      rsvps: o.rsvps || [],
    };
  }).filter(e => e.date);

  // 4. Shifts (missions) → only include shifts that DON'T have a parent opportunity already in the calendar
  //    (avoids duplicate entries — the opportunity already shows as the event)
  const oppIds = new Set(oppsSnap.docs.map(d => d.id));
  const oppsById: Record<string, any> = {};
  oppsSnap.docs.forEach(d => { oppsById[d.id] = d.data(); });

  const missionEvents = shiftsSnap.docs.filter(d => {
    // Skip shifts whose parent opportunity is already shown
    const s = d.data();
    return !s.opportunityId || !oppIds.has(s.opportunityId);
  }).map(d => {
    const s = d.data();
    const opp = oppsById[s.opportunityId] || {};
    const shiftDate = s.startTime ? (s.startTime.includes('T') ? s.startTime.split('T')[0] : s.startTime) : '';
    const shiftStartTime = s.startTime && s.startTime.includes('T')
      ? new Date(s.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';
    const shiftEndTime = s.endTime && s.endTime.includes('T')
      ? new Date(s.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : '';
    return {
      id: d.id,
      title: opp.title || `${s.roleType || 'Volunteer'} Shift`,
      description: opp.description || `${s.roleType || 'Volunteer'} shift — ${s.slotsTotal - s.slotsFilled} of ${s.slotsTotal} slots open`,
      date: shiftDate,
      startTime: shiftStartTime,
      endTime: shiftEndTime || undefined,
      type: mapOppCategory(opp.category, opp.title),
      location: opp.serviceLocation || undefined,
      rsvps: (s.assignedVolunteerIds || []).map((vid: string) => ({ odId: vid, odName: '', status: 'attending' })),
      sourceCollection: 'shifts',
      source: 'shift',
    };
  }).filter(e => e.date);

  let all = [...orgEvents, ...boardEvents, ...oppEvents, ...missionEvents];

  // Optional date range filtering
  if (dateFrom) all = all.filter((e: any) => (e.date || '') >= dateFrom);
  if (dateTo) all = all.filter((e: any) => (e.date || '') <= dateTo);

  return all.sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
}

// Unified calendar feed — merges org_calendar_events + board_meetings + opportunities
app.get('/api/org-calendar', verifyToken, async (req: Request, res: Response) => {
  try {
    const callerProfile = (req as any).user?.profile;
    const all = await queryAllEvents({
      callerRole: callerProfile?.role || '',
      isAdmin: callerProfile?.isAdmin === true,
    });
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
    res.json({ id: ref.id, sourceCollection: 'org_calendar_events', ...eventData });
  } catch (e: any) {
    console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' });
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
    console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete org calendar event (admin or creator with calendar role)
app.delete('/api/org-calendar/:eventId', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userData = (await db.collection('volunteers').doc(user.uid).get()).data();
    const eventDoc = await db.collection('org_calendar_events').doc(req.params.eventId).get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const eventData = eventDoc.data()!;
    const isCreator = eventData.createdBy === user.uid;
    const hasCalendarRole = ORG_CALENDAR_ROLES.includes(userData?.role);
    if (!userData?.isAdmin && !(isCreator && hasCalendarRole)) {
      return res.status(403).json({ error: 'Only admins or the event creator can delete calendar events' });
    }
    await db.collection('org_calendar_events').doc(req.params.eventId).delete();
    res.json({ success: true });
  } catch (e: any) {
    console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' });
  }
});

// RSVP to an org calendar event (any authenticated user)
app.post('/api/org-calendar/:eventId/rsvp', verifyToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const volunteerRef = db.collection('volunteers').doc(user.uid);
    const volunteerDoc = await volunteerRef.get();
    const userData = volunteerDoc.data();
    const { status } = req.body;
    if (!['attending', 'tentative', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid RSVP status' });
    }

    // Check all event collections for the target event
    let docRef = db.collection('org_calendar_events').doc(req.params.eventId);
    let docSnap = await docRef.get();
    let sourceCollection = 'org_calendar_events';
    if (!docSnap.exists) {
      docRef = db.collection('board_meetings').doc(req.params.eventId);
      docSnap = await docRef.get();
      sourceCollection = 'board_meetings';
    }
    if (!docSnap.exists) {
      docRef = db.collection('opportunities').doc(req.params.eventId);
      docSnap = await docRef.get();
      sourceCollection = 'opportunities';
    }
    if (!docSnap.exists) {
      docRef = db.collection('shifts').doc(req.params.eventId);
      docSnap = await docRef.get();
      sourceCollection = 'shifts';
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

    // Batch event RSVP + volunteer sync atomically to prevent data drift
    const rsvpBatch = db.batch();
    rsvpBatch.update(docRef, { rsvps });

    const eventId = req.params.eventId;
    const currentRsvpIds: string[] = userData?.rsvpedEventIds || [];
    if (status === 'attending' || status === 'tentative') {
      if (!currentRsvpIds.includes(eventId)) {
        rsvpBatch.update(volunteerRef, {
          rsvpedEventIds: admin.firestore.FieldValue.arrayUnion(eventId)
        });
      }
    } else if (status === 'declined') {
      if (currentRsvpIds.includes(eventId)) {
        rsvpBatch.update(volunteerRef, {
          rsvpedEventIds: admin.firestore.FieldValue.arrayRemove(eventId)
        });
      }
    }
    await rsvpBatch.commit();

    res.json({ success: true, rsvps });
  } catch (e: any) {
    console.error('[ERROR]', e.message); res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ADMIN BOOTSTRAP ---
const bootstrapAdmin = async () => {
  // Support multiple admin emails (comma-separated or single)
  const adminEmailsEnv = process.env.INITIAL_ADMIN_EMAIL || '';
  const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

  // Always include core admins from config
  const allAdminEmails = [...new Set([...adminEmails, ...EMAIL_CONFIG.ADMIN_EMAILS])];

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

    // --- WORKFLOW SCHEDULER ---
    // Daily at 6 PM UTC (10 AM Pacific PST / 11 AM PDT): shift reminders + post-shift thank you + event cadence + SMO
    cron.schedule('0 18 * * *', () => {
      console.log('[CRON] Running daily shift workflow check (6 PM UTC)');
      runScheduledWorkflows();
    });

    // Every 3 hours: SMS check for 3-hour event reminders (Stage 5)
    cron.schedule('0 */3 * * *', () => {
      console.log('[CRON] Running SMS check workflows (every 3h)');
      runSMSCheckWorkflows();
    });

    // Every 10 minutes: Post-event debrief (15 min after service hours end)
    cron.schedule('*/10 * * * *', async () => {
      try {
        const configDoc = await db.collection('workflow_configs').doc('default').get();
        const config = configDoc.data();
        const workflows = config?.workflows || WORKFLOW_DEFAULTS;
        if (workflows.w8?.enabled !== false) await executePostEventDebrief();
      } catch (e) { console.error('[CRON] Post-event debrief error:', e); }
    });

    // Daily at 8am UTC: birthday + compliance
    cron.schedule('0 8 * * *', () => {
      console.log('[CRON] Running daily workflow check (8am UTC)');
      runDailyWorkflows();
    });

    console.log('[CRON] Workflow scheduler started: daily 6pm UTC (shift/thank-you/cadence/SMO) + every 3h (SMS) + every 10m (debrief) + daily 8am UTC (birthday/compliance)');

    // Run pending reminders at startup — Cloud Run may scale to zero and miss cron times
    setTimeout(async () => {
      console.log('[STARTUP] Running pending workflows on container start...');
      try { await runScheduledWorkflows(); } catch (e) { console.error('[STARTUP] Scheduled workflows error:', e); }
      try { await runDailyWorkflows(); } catch (e) { console.error('[STARTUP] Daily workflows error:', e); }
      console.log('[STARTUP] Pending workflows complete.');
    }, 10000); // 10s delay to let the server fully initialize
});

// --- CLOUD SCHEDULER CRON ENDPOINT ---
// Cloud Run scales to zero, so in-process cron may not fire reliably.
// Set up a Google Cloud Scheduler job to POST to this endpoint every 3 hours.
app.post('/api/cron/run-workflows', async (req: Request, res: Response) => {
  // Verify this is from Cloud Scheduler or has the correct secret
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (cronSecret && providedSecret !== cronSecret) {
    return res.status(403).json({ error: 'Invalid cron secret' });
  }

  console.log('[CRON-ENDPOINT] Running workflows via Cloud Scheduler trigger');
  try {
    const results: any = {};
    results.scheduled = await runScheduledWorkflows();
    results.daily = await runDailyWorkflows();
    console.log('[CRON-ENDPOINT] Workflows complete');
    res.json({ success: true, results });
  } catch (e: any) {
    console.error('[CRON-ENDPOINT] Workflow error:', e);
    res.status(500).json({ error: e.message });
  }
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

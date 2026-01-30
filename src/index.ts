
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

// --- CONFIGURATION ---
dotenv.config();

// --- FIREBASE ADMIN SDK ---
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } else {
    console.warn("Firebase credentials missing. DB features will fail in production.");
    admin.initializeApp();
  }
} catch (e) {
  console.error("Firebase Admin SDK initialization failed.", e);
}
const db = admin.firestore();
const auth = admin.auth();

// --- TWILIO ---
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, FIREBASE_WEB_API_KEY } = process.env;
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
if (process.env.API_KEY) {
    ai = new GoogleGenerativeAI(process.env.API_KEY);
    console.log("Gemini AI client initialized successfully.");
} else {
    console.warn("API_KEY environment variable not set. Gemini AI features will be disabled.");
}

// Helper for Gemini API calls
type GeminiPart = string | { inlineData: { mimeType: string; data: string } };
const generateAIContent = async (
  modelName: string,
  parts: GeminiPart | GeminiPart[],
  jsonMode: boolean = false
): Promise<string> => {
  if (!ai) throw new Error('AI not configured');
  const model = ai.getGenerativeModel({
    model: modelName,
    generationConfig: jsonMode ? { responseMimeType: 'application/json' } : undefined
  });
  const content = Array.isArray(parts) ? parts : [parts];
  const result = await model.generateContent(content);
  return result.response.text();
};

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: true,
  credentials: true,
}));
// FIX: Replace deprecated body-parser with express.json
app.use(express.json({ limit: '50mb' }));

// --- HEALTH CHECK ENDPOINT (no auth required) ---
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      emailConfigured: !!EMAIL_SERVICE_URL,
      smsConfigured: twilioClient !== null && !!TWILIO_PHONE_NUMBER,
      aiConfigured: ai !== null,
      firebaseConfigured: true // If we got here, Firebase is working
    }
  });
});

// --- HELPERS ---
const rateLimit = (limit: number, timeframe: number) => (req: Request, res: Response, next: NextFunction) => next();

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
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;
    const response = await fetch(verifyUrl, { method: 'POST' });
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
    subject: '✓ Verify Your Health Matters Clinic Account',
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
    subject: `🎉 Welcome to Health Matters Clinic, ${data.volunteerName}!`,
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

  // 3. Password Reset
  password_reset: (data: EmailTemplateData) => ({
    subject: '🔐 Reset Your Password',
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
    subject: '🔐 New Login to Your Account',
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
    subject: `📅 You're Assigned: ${data.eventName}`,
    html: `${emailHeader("You're Assigned to a Shift")}
      <p>Hi ${data.volunteerName},</p>
      <p>Great news! You've been assigned to an upcoming shift:</p>
      <div style="background: #f9fafb; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.eventName}</p>
        <p style="margin: 8px 0;"><strong>📅 Date:</strong> ${data.eventDate}</p>
        <p style="margin: 8px 0;"><strong>⏱️ Time:</strong> ${data.eventTime}</p>
        <p style="margin: 8px 0;"><strong>📍 Location:</strong> ${data.location}</p>
        <p style="margin: 8px 0;"><strong>⏳ Duration:</strong> ${data.duration}</p>
        <p style="margin: 8px 0;"><strong>👤 Your Role:</strong> <span style="color: ${EMAIL_CONFIG.BRAND_COLOR}; font-weight: 600;">${data.role}</span></p>
      </div>
      ${actionButton('Confirm Attendance', `${EMAIL_CONFIG.WEBSITE_URL}/shifts/confirm`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, You're assigned to ${data.eventName} on ${data.eventDate} at ${data.eventTime}. Location: ${data.location}. Role: ${data.role}.`
  }),

  // 6. Shift Reminder (24h)
  shift_reminder_24h: (data: EmailTemplateData) => ({
    subject: `⏰ Reminder: Your Shift Tomorrow at ${data.eventTime}`,
    html: `${emailHeader('Your Shift is Tomorrow!')}
      <p>Hi ${data.volunteerName},</p>
      <p>Just a friendly reminder—you have a shift <strong>tomorrow</strong>!</p>
      <div style="background: ${EMAIL_CONFIG.BRAND_COLOR}; color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 12px; text-transform: uppercase;">Tomorrow at</p>
        <p style="margin: 0 0 16px 0; font-size: 32px; font-weight: bold;">${data.eventTime}</p>
        <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${data.eventName}</p>
        <p style="margin: 0; opacity: 0.9;">📍 ${data.location}</p>
      </div>
      <p><strong>🕐 Arrive 15 minutes early</strong> to get oriented.</p>
      ${actionButton('View Shift Details', `${EMAIL_CONFIG.WEBSITE_URL}/shifts/upcoming`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, Reminder: ${data.eventName} tomorrow at ${data.eventTime}. Location: ${data.location}. Arrive 15 min early.`
  }),

  // 7. Shift Cancellation
  shift_cancellation: (data: EmailTemplateData) => ({
    subject: `❌ Shift Cancelled: ${data.eventName}`,
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
    subject: `📚 New Training: ${data.trainingName}`,
    html: `${emailHeader('New Training Module')}
      <p>Hi ${data.volunteerName},</p>
      <p>You've been assigned a new training module:</p>
      <div style="background: #f9fafb; border-left: 4px solid ${EMAIL_CONFIG.BRAND_COLOR}; padding: 20px; margin: 24px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: ${EMAIL_CONFIG.BRAND_COLOR};">${data.trainingName}</p>
        <p style="margin: 8px 0; color: #6b7280;">⏱️ Estimated time: ${data.estimatedMinutes} minutes</p>
        <p style="margin: 8px 0; color: #9ca3af;">📅 Complete by: ${data.deadline}</p>
      </div>
      <p>All modules are self-paced and mobile-friendly.</p>
      ${actionButton('Start Training', `${EMAIL_CONFIG.WEBSITE_URL}/training`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, New training: ${data.trainingName}. ${data.estimatedMinutes} min. Due: ${data.deadline}.`
  }),

  // 9. Training Reminder
  training_reminder: (data: EmailTemplateData) => ({
    subject: `⏰ ${data.daysRemaining} Days Left: ${data.trainingName}`,
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
    subject: '✓ HIPAA Training Complete',
    html: `${emailHeader('HIPAA Training Complete ✓')}
      <p>Hi ${data.volunteerName},</p>
      <p>Thank you for completing HIPAA training on ${data.completionDate}.</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 48px; color: #10b981;">✓</span>
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
    subject: '✓ We Received Your Application',
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

  // 12. Application Approved
  application_approved: (data: EmailTemplateData) => ({
    subject: '✓ Welcome! Your Application is Approved',
    html: `${emailHeader('Application Approved! 🎉')}
      <p>Congratulations, ${data.volunteerName}!</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 48px; color: #10b981;">✓</span>
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
    subject: `💙 Your Impact: ${data.hoursContributed} Hours, ${data.peopleHelped} Lives Touched`,
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
        <p style="margin: 0;"><strong>💙 You made a real difference</strong> for ${data.peopleHelped} people in our community. Thank you.</p>
      </div>
      ${actionButton('View Your Dashboard', `${EMAIL_CONFIG.WEBSITE_URL}/profile`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, This month: ${data.hoursContributed} hours, ${data.shiftsCompleted} shifts, ${data.peopleHelped} people helped. Thank you!`
  }),

  // Achievement Unlocked (for gamification)
  achievement_unlocked: (data: EmailTemplateData) => ({
    subject: `🏆 Achievement Unlocked: ${data.achievementName}`,
    html: `${emailHeader('Achievement Unlocked! 🏆')}
      <p>Hi ${data.volunteerName},</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 64px;">🏆</span>
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
    subject: `🎉 Your Referral Joined: ${data.referredName}`,
    html: `${emailHeader('Referral Success! 🎉')}
      <p>Hi ${data.volunteerName},</p>
      <p>Great news! <strong>${data.referredName}</strong> just joined Health Matters Clinic using your referral!</p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="font-size: 48px;">🎉</span>
      </div>
      <p style="text-align: center; font-weight: 600; color: #10b981;">+${data.referralBonus} XP earned!</p>
      <p>Keep sharing your referral link to earn more XP and help grow our volunteer community.</p>
      ${actionButton('View Referral Dashboard', `${EMAIL_CONFIG.WEBSITE_URL}/referrals`)}
    ${emailFooter()}`,
    text: `Hi ${data.volunteerName}, ${data.referredName} joined via your referral! +${data.referralBonus} XP.`
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
        console.log(`[EMAIL] ✅ Sent ${templateName} to ${data.toEmail}`);
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
  instagram: `🩺 Just completed [HOURS] hours volunteering with @healthmatters.clinic

Want to join me? Link in bio! 💙

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

const createSession = async (uid: string, isAdminRequest: boolean, res: Response) => {
    const userDoc = await db.collection('volunteers').doc(uid).get();
    const user = userDoc.data();
    
    if (isAdminRequest && user && !user.isAdmin) return res.status(403).json({ error: "Access denied." });
    
    const sessionToken = crypto.randomBytes(64).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.collection('sessions').doc(sessionToken).set({ uid, expires });
    res.json({ token: sessionToken, user: { ...user, id: uid } });
};

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
    console.log(`[SERVER] Attempting to send verification email to ${email}...`);
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

    console.log(`[SERVER] Verification email sent successfully to ${email}.`);
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

app.post('/auth/signup', rateLimit(5, 60000), verifyCaptcha, async (req: Request, res: Response) => {
    const { user, password, googleCredential, referralCode } = req.body;

    // Either password or googleCredential is required
    if (!password && !googleCredential) {
        return res.status(400).json({ error: 'Authentication method required.' });
    }

    try {
        user.role = user.appliedRole || 'HMC Champion';
        user.status = 'active';
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
            const userRecord = await auth.createUser({ email: user.email, password, displayName: user.name });
            finalUserId = userRecord.uid;
            user.authProvider = 'email';
        }

        const { resume, ...userDataToSave } = user;
        userDataToSave.id = finalUserId;

        // Check if this email is in the admin bootstrap list
        const bootstrapDoc = await db.collection('admin_bootstrap').doc('pending').get();
        if (bootstrapDoc.exists && bootstrapDoc.data()?.email === user.email.toLowerCase()) {
            userDataToSave.isAdmin = true;
            await db.collection('admin_bootstrap').doc('pending').delete();
            console.log(`[BOOTSTRAP] Auto-promoted new signup ${user.email} to admin`);
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

        // Process referral if provided
        if (referralCode) {
          await GamificationService.convertReferral(referralCode, finalUserId);
        }

        await createSession(finalUserId, false, res);
    } catch (error) {
        console.error("Signup error:", error);
        res.status(400).json({ error: (error as Error).message });
    }
});

app.post('/auth/login', rateLimit(10, 60000), async (req: Request, res: Response) => {
    const { email, password, isAdmin } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    try {
        const firebaseLoginUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
        const firebaseRes = await fetch(firebaseLoginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        });
        
        if (!firebaseRes.ok) {
             const err = await firebaseRes.json() as { error?: { message?: string } };
             return res.status(401).json({ error: err.error?.message || "Invalid credentials." });
        }

        const firebaseData = await firebaseRes.json() as { localId: string };
        await createSession(firebaseData.localId, isAdmin, res);
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

app.post('/auth/login/google', rateLimit(10, 60000), async (req: Request, res: Response) => {
    const { credential, isAdmin, referralCode } = req.body;
    if (!credential) return res.status(400).json({ error: "Google credential is required." });
    try {
        // Verify Google OAuth token
        const googleUser = await verifyGoogleToken(credential);
        if (!googleUser) {
            return res.status(401).json({ error: "Invalid Google token." });
        }

        // Use Google's sub (subject) as user ID, prefixed to avoid conflicts
        const userId = `google_${googleUser.sub}`;

        const userDoc = await db.collection('volunteers').doc(userId).get();
        const isNewUser = !userDoc.exists;

        if (isNewUser) {
             // Check if this email is in the admin bootstrap list
             let shouldBeAdmin = false;
             const bootstrapDoc = await db.collection('admin_bootstrap').doc('pending').get();
             if (bootstrapDoc.exists && bootstrapDoc.data()?.email === googleUser.email.toLowerCase()) {
                 shouldBeAdmin = true;
                 await db.collection('admin_bootstrap').doc('pending').delete();
                 console.log(`[BOOTSTRAP] Auto-promoted Google signup ${googleUser.email} to admin`);
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

        await createSession(userId, isAdmin, res);
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
        const [volunteersSnap, opportunitiesSnap, shiftsSnap, ticketsSnap, announcementsSnap, messagesSnap] = await Promise.all([
            db.collection('volunteers').get(),
            db.collection('opportunities').get(),
            db.collection('shifts').get(),
            db.collection('support_tickets').get(),
            db.collection('announcements').orderBy('date', 'desc').get(),
            db.collection('messages').orderBy('timestamp', 'desc').limit(50).get(),
        ]);
        
        res.json({
            user: userProfile,
            volunteers: volunteersSnap.docs.map(d => d.data()),
            opportunities: opportunitiesSnap.docs.map(d => ({...d.data(), id: d.id })),
            shifts: shiftsSnap.docs.map(d => ({...d.data(), id: d.id })),
            supportTickets: ticketsSnap.docs.map(d => ({...d.data(), id: d.id })),
            announcements: announcementsSnap.docs.map(d => ({...d.data(), id: d.id })),
            messages: messagesSnap.docs.map(d => ({...d.data(), id: d.id })),
        });
    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        res.status(500).json({ error: "Failed to load application data." });
    }
});

// --- AI & DATA ROUTES ---

app.post('/api/gemini/analyze-resume', async (req: Request, res: Response) => {
    try {
        const { base64Data, mimeType } = req.body;
        const text = await generateAIContent('gemini-1.5-pro', [
            { inlineData: { mimeType, data: base64Data } },
            "Analyze this resume. Extract skills. Recommend the top 3 roles from: Core Volunteer, Outreach Volunteer, Licensed Medical Professional, Events Coordinator, Volunteer Lead. Return JSON: { recommendations: [{roleName, matchPercentage, reasoning}], extractedSkills: [] }"
        ], true);
        res.send(text);
    } catch (e) {
        console.error(e);
        res.status(500).json({ recommendations: [], extractedSkills: [] });
    }
});

app.post('/api/gemini/generate-plan', async (req: Request, res: Response) => {
    if (!ai) return res.json(null);
    try {
        const { role } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Generate a short onboarding training plan JSON for a ${role} at a health clinic. Schema: { role, orientationModules: [{id, title, objective, estimatedMinutes}], completionGoal, coachSummary }`,
            true);
        res.send(text);
    } catch(e) { res.status(500).json({ error: 'AI failed' }); }
});

app.post('/api/gemini/generate-quiz', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ question: "Default Question?" });
        const { moduleTitle, role } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Generate a multiple choice quiz question for the module "${moduleTitle}" for a ${role}. JSON Schema: { question, learningObjective, keyConcepts: [{concept, description}] }`,
            true);
        res.send(text);
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/validate-answer', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ isCorrect: true });
        const { question, answer } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Question: "${question}". User Answer: "${answer}". Is this essentially correct? JSON: { isCorrect: boolean }`,
            true);
        res.send(text);
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/find-referral-match', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ recommendations: [] });
        const { clientNeed } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Suggest 3 generic types of resources for: "${clientNeed}". JSON: { recommendations: [{ "Resource Name": "Example", "reasoning": "Fits need" }] }`,
            true);
        res.send(text);
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/generate-supply-list', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ supplyList: "- Water\n- Pens" });
        const { serviceNames, attendeeCount } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Generate a checklist of supplies for a health fair with ${attendeeCount} attendees offering: ${serviceNames.join(', ')}. Plain text list.`);
        res.json({ supplyList: text });
    } catch(e) { res.status(500).json({error: "AI failed"}); }
});

app.post('/api/gemini/generate-summary', async (req: Request, res: Response) => {
    if (!ai) return res.json({ summary: "Thank you for your service!" });
    try {
        const { volunteerName, totalHours } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Write a 2 sentence impact summary for ${volunteerName} who contributed ${totalHours} hours.`);
        res.json({ summary: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/draft-fundraising-email', async (req: Request, res: Response) => {
    if (!ai) return res.json({ emailBody: "Please support HMC!" });
    try {
        const { volunteerName, volunteerRole } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Draft a short fundraising email for ${volunteerName}, a ${volunteerRole}, asking friends to support Health Matters Clinic.`);
        res.json({ emailBody: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/draft-social-post', async (req: Request, res: Response) => {
    if (!ai) return res.json({ postText: "#HealthMatters" });
    try {
        const { topic, platform } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Draft a ${platform} post about ${topic} for a nonprofit.`);
        res.json({ postText: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

app.post('/api/gemini/summarize-feedback', async (req: Request, res: Response) => {
    try {
        if (!ai) return res.json({ summary: "No feedback to summarize." });
        const { feedback } = req.body;
        const text = await generateAIContent('gemini-1.5-flash',
            `Summarize the following volunteer feedback into key themes and sentiment: ${feedback.join('\n')}`);
        res.json({ summary: text });
    } catch(e) { res.status(500).json({ error: "AI failed" }); }
});

// --- DATA & OPS ROUTES ---
app.get('/api/resources', async (req: Request, res: Response) => {
    const snap = await db.collection('referral_resources').get();
    res.json(snap.docs.map(d => d.data()));
});
app.post('/api/resources/create', verifyToken, async (req: Request, res: Response) => {
    const ref = await db.collection('referral_resources').add(req.body.resource);
    res.json({ success: true, id: ref.id });
});
app.get('/api/referrals', verifyToken, async (req: Request, res: Response) => {
    const snap = await db.collection('referrals').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
app.post('/api/referrals/create', verifyToken, async (req: Request, res: Response) => {
    const ref = await db.collection('referrals').add(req.body.referral);
    res.json({ id: ref.id, ...req.body.referral });
});
app.put('/api/referrals/:id', verifyToken, async (req: Request, res: Response) => {
    await db.collection('referrals').doc(req.params.id).update(req.body.referral);
    res.json({ id: req.params.id, ...req.body.referral });
});
app.post('/api/clients/search', verifyToken, async (req: Request, res: Response) => {
    const { phone, email } = req.body;
    let query: admin.firestore.Query = db.collection('clients');
    if (phone) query = query.where('phone', '==', phone);
    else if (email) query = query.where('email', '==', email);
    
    const snap = await query.get();
    if (snap.empty) return res.status(404).json({ error: "Not found" });
    res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
});
app.post('/api/clients/create', verifyToken, async (req: Request, res: Response) => {
    const ref = await db.collection('clients').add(req.body.client);
    res.json({ id: ref.id, ...req.body.client });
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
app.post('/api/opportunities', verifyToken, async (req: Request, res: Response) => {
    const { opportunity } = req.body;
    if (!opportunity.locationCoordinates) {
        opportunity.locationCoordinates = { lat: 34.0522 + (Math.random() - 0.5) * 0.1, lng: -118.2437 + (Math.random() - 0.5) * 0.1 };
    }
    const docRef = await db.collection('opportunities').add(opportunity);
    res.json({ id: docRef.id, ...opportunity });
});
app.post('/api/broadcasts/send', verifyToken, async (req: Request, res: Response) => {
    const { title, content, category = 'General' } = req.body;
    const announcement = { title, content, date: new Date().toISOString(), category, status: 'approved' };
    const docRef = await db.collection('announcements').add(announcement);
    res.json({ id: docRef.id, ...announcement });
});
app.post('/api/support_tickets', verifyToken, async (req: Request, res: Response) => {
    const { ticket } = req.body;
    const docRef = await db.collection('support_tickets').add(ticket);
    res.json({ id: docRef.id, ...ticket });
});
app.post('/api/admin/bulk-import', verifyToken, async (req: Request, res: Response) => {
    res.json({ importedCount: 0, newVolunteers: [] });
});
app.post('/api/admin/update-volunteer-profile', verifyToken, async (req: Request, res: Response) => {
    const { volunteer } = req.body;
    await db.collection('volunteers').doc(volunteer.id).update(volunteer);
    res.json({ success: true });
});
app.post('/api/admin/review-application', verifyToken, async (req: Request, res: Response) => {
    const { volunteerId, action, notes } = req.body;
    const updates: any = { applicationStatus: action === 'approve' ? 'approved' : 'rejected' };
    if (action === 'approve') { updates.status = 'active'; }
    await db.collection('volunteers').doc(volunteerId).update(updates);
    const updatedDoc = await db.collection('volunteers').doc(volunteerId).get();
    const volData = updatedDoc.data();

    // Send application decision email
    if (volData?.email) {
      if (action === 'approve') {
        await EmailService.send('application_approved', {
          toEmail: volData.email,
          volunteerName: volData.name || volData.firstName || 'Volunteer',
          approvedRole: volData.role || volData.appliedRole || 'Volunteer',
        });
        // Award XP for approval
        await GamificationService.addXP(volunteerId, 'signup_completed');
      } else {
        await EmailService.send('application_rejected', {
          toEmail: volData.email,
          volunteerName: volData.name || volData.firstName || 'Volunteer',
          reason: notes || 'Unfortunately, we are unable to move forward at this time.',
        });
      }
    }

    res.json({ volunteer: volData });
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
app.get('/api/leaderboard/xp', async (req: Request, res: Response) => {
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
app.get('/api/leaderboard/referrals', async (req: Request, res: Response) => {
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
app.get('/api/leaderboard/streaks', async (req: Request, res: Response) => {
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

// --- ADMIN BOOTSTRAP ---
const bootstrapAdmin = async () => {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  if (!adminEmail) return;

  console.log(`[BOOTSTRAP] Checking admin bootstrap for: ${adminEmail}`);

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
      console.log(`[BOOTSTRAP] Admin user not found. Will be promoted on signup.`);
      await db.collection('admin_bootstrap').doc('pending').set({
        email: adminEmail.toLowerCase(),
        createdAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[BOOTSTRAP] Admin bootstrap failed:', error);
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

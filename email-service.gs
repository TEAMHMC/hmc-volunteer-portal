/**
 * HMC Volunteer Portal - Email Service
 * Deploy as Web App:
 *  - Execute as: Me
 *  - Who has access: Anyone
 *
 * After deploying, copy the URL and set it as EMAIL_SERVICE_URL in your .env
 */

var CONFIG = {
  BRAND_COLOR: "#233DFF",
  CLINIC_NAME: "Health Matters Clinic",
  WEBSITE_URL: "https://hmc-volunteer-portal-172668994130.us-west2.run.app",
  SENDER_NAME: "Health Matters Clinic",
  REPLY_TO: "volunteer@healthmatters.clinic",
  CONTACT_EMAIL: "volunteer@healthmatters.clinic",
  LOGO_URL: "https://cdn.prod.website-files.com/67359e6040140078962e8a54/6912e29e5710650a4f45f53f_Untitled%20(256%20x%20256%20px).png"
};

function doGet() {
  return jsonResponse({
    status: "ok",
    service: "HMC Email Service"
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Missing request body" });
    }

    var data = JSON.parse(e.postData.contents);
    var type = (data.type || "").trim();
    var toEmail = (data.toEmail || "").trim();

    if (!type || !toEmail) {
      return jsonResponse({ success: false, error: "Missing type or toEmail" });
    }

    var email = buildEmail(type, data);
    if (!email) {
      return jsonResponse({ success: false, error: "Unknown template: " + type });
    }

    GmailApp.sendEmail(toEmail, email.subject, email.text, {
      name: CONFIG.SENDER_NAME,
      replyTo: CONFIG.REPLY_TO,
      htmlBody: email.html
    });

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ════════════════════════════════════════
// TEMPLATES — 25 total
// ════════════════════════════════════════

function buildEmail(type, data) {
  var name = safeText(data.volunteerName || data.rsvpName || data.coordinatorName || "there");

  // ─── 1. Email Verification ───
  if (type === "email_verification") {
    var code = String(data.verificationCode || "").trim();
    if (!code) return null;
    var minutes = Number(data.expiresIn || 15);
    return {
      subject: "Verify your Health Matters Clinic account",
      html:
        layoutStart("Verify Your Email") +
        greeting(name) +
        bodyText("Welcome to Health Matters Clinic! Please verify your email address using this code:") +
        codeBlock(code) +
        subtle("This code expires in " + minutes + " minutes.") +
        button("Verify Email Address", CONFIG.WEBSITE_URL + "/auth/verify?code=" + code) +
        layoutEnd(),
      text: "Your verification code is: " + code + ". Expires in " + minutes + " minutes."
    };
  }

  // ─── 2. Welcome Volunteer ───
  if (type === "welcome_volunteer") {
    var role = safeText(data.appliedRole || "HMC Champion");
    return {
      subject: "Welcome to Health Matters Clinic, " + name + "!",
      html:
        layoutStart("Welcome to the Team!") +
        greeting(name) +
        bodyText("We're excited to have you join our volunteer community! You've applied as a <strong>" + esc(role) + "</strong>.") +
        bodyText("<strong>Next steps:</strong>") +
        bulletList([
          "Complete your profile with availability",
          "Take our HIPAA Training (required)",
          "Await approval from our team (2\u20133 business days)"
        ]) +
        button("View Your Application", CONFIG.WEBSITE_URL + "/dashboard") +
        layoutEnd(),
      text: "Welcome " + name + "! You applied as " + role + ". Next: Complete profile, HIPAA training, await approval."
    };
  }

  // ─── 2b. Admin Added Volunteer ───
  if (type === "admin_added_volunteer") {
    var role2 = safeText(data.appliedRole || "HMC Champion");
    var pwSection = "";
    var pwText = "";
    if (data.hasPasswordReset && data.passwordResetLink) {
      pwSection =
        warningBox(
          "<p style='margin:0;font-weight:600;color:#92400e;'>Set Up Your Password</p>" +
          "<p style='margin:8px 0 0;color:#78350f;font-size:14px;'>Click the button below to set your password and activate your account.</p>"
        ) +
        button("Set Your Password", data.passwordResetLink);
      pwText = "Set your password: " + data.passwordResetLink;
    } else {
      pwSection = button("Log In to Your Account", CONFIG.WEBSITE_URL);
      pwText = "Log in at: " + CONFIG.WEBSITE_URL;
    }
    return {
      subject: "Welcome to Health Matters Clinic, " + name + "!",
      html:
        layoutStart("Welcome to the Team!") +
        greeting(name) +
        bodyText("An administrator has added you to our volunteer community as a <strong>" + esc(role2) + "</strong>.") +
        pwSection +
        bodyText("<strong>Next steps:</strong>") +
        bulletList([
          "Log in and complete your profile",
          "Take our HIPAA Training (required)",
          "Explore available volunteer opportunities"
        ]) +
        layoutEnd(),
      text: "Welcome " + name + "! You've been added as " + role2 + ". " + pwText
    };
  }

  // ─── 3. Password Reset ───
  if (type === "password_reset") {
    var link = String(data.resetLink || "").trim();
    if (!link) return null;
    var hours = Number(data.expiresInHours || 24);
    return {
      subject: "Reset your Health Matters Clinic password",
      html:
        layoutStart("Reset Your Password") +
        greeting(name) +
        bodyText("We received a request to reset your password. Click the button below to create a new password.") +
        subtle("This link expires in " + hours + " hours.") +
        button("Reset Password", link) +
        subtle("If you didn't request this, you can safely ignore this email.") +
        layoutEnd(),
      text: "Reset your password (expires in " + hours + " hours): " + link
    };
  }

  // ─── 4. Login Confirmation ───
  if (type === "login_confirmation") {
    return {
      subject: "New login to your account",
      html:
        layoutStart("New Login Detected") +
        greeting(name) +
        bodyText("We detected a new login to your account:") +
        infoBox(
          infoRow("Device", data.deviceInfo || "Unknown") +
          infoRow("Location", data.location || "Unknown")
        ) +
        bodyText("If this wasn't you, <a href='" + escAttr(CONFIG.WEBSITE_URL) + "/security' style='color:" + CONFIG.BRAND_COLOR + ";font-weight:600;'>secure your account</a> immediately.") +
        layoutEnd(),
      text: "New login from " + (data.deviceInfo || "unknown device") + " at " + (data.location || "unknown location") + "."
    };
  }

  // ─── 5. Shift Confirmation ───
  if (type === "shift_confirmation") {
    var evName = safeText(data.eventName || "an event");
    return {
      subject: "You're Assigned: " + evName,
      html:
        layoutStart("You're Assigned to a Shift") +
        greeting(name) +
        bodyText("Great news! You've been assigned to an upcoming shift:") +
        eventBox(
          evName,
          infoRow("Date", data.eventDate || "") +
          infoRow("Time", data.eventTime || "") +
          infoRow("Location", data.location || "") +
          infoRow("Duration", data.duration || "") +
          infoRow("Your Role", data.role || "")
        ) +
        button("Confirm Attendance", CONFIG.WEBSITE_URL + "/shifts/confirm") +
        layoutEnd(),
      text: "You're assigned to " + evName + " on " + (data.eventDate || "") + " at " + (data.eventTime || "") + ". Role: " + (data.role || "") + "."
    };
  }

  // ─── 6. Shift Reminder (24h) ───
  if (type === "shift_reminder_24h") {
    var evName2 = safeText(data.eventName || "your shift");
    return {
      subject: "Reminder: Your shift tomorrow at " + (data.eventTime || ""),
      html:
        layoutStart("Your Shift is Tomorrow!") +
        greeting(name) +
        bodyText("Just a friendly reminder \u2014 you have a shift <strong>tomorrow</strong>!") +
        highlightBlock(
          "<p style='margin:0 0 8px;opacity:0.9;font-size:12px;text-transform:uppercase;'>Tomorrow at</p>" +
          "<p style='margin:0 0 16px;font-size:32px;font-weight:bold;'>" + esc(data.eventTime || "") + "</p>" +
          "<p style='margin:0 0 8px;font-size:16px;font-weight:600;'>" + esc(evName2) + "</p>" +
          "<p style='margin:0;opacity:0.9;'>" + esc(data.location || "") + "</p>"
        ) +
        bodyText("<strong>Arrive 15 minutes early</strong> to get oriented.") +
        button("View Shift Details", CONFIG.WEBSITE_URL + "/shifts/upcoming") +
        layoutEnd(),
      text: "Reminder: " + evName2 + " tomorrow at " + (data.eventTime || "") + ". Location: " + (data.location || "") + ". Arrive 15 min early."
    };
  }

  // ─── 7. Shift Cancellation ───
  if (type === "shift_cancellation") {
    var evName3 = safeText(data.eventName || "your shift");
    return {
      subject: "Shift cancelled: " + evName3,
      html:
        layoutStart("Shift Cancelled") +
        greeting(name) +
        bodyText("Unfortunately, the following shift has been cancelled:") +
        errorBox(
          "<p style='margin:0 0 8px;font-weight:600;color:#1a1a1a;'>" + esc(evName3) + "</p>" +
          "<p style='margin:0;color:#6b7280;'>" + esc(data.eventDate || "") + "</p>"
        ) +
        bodyText("<strong>Reason:</strong> " + esc(data.reason || "No reason provided")) +
        bodyText("Your volunteer standing is unaffected. We'll reach out with new opportunities soon.") +
        button("View Other Shifts", CONFIG.WEBSITE_URL + "/shifts") +
        layoutEnd(),
      text: evName3 + " on " + (data.eventDate || "") + " has been cancelled. Reason: " + (data.reason || "N/A") + "."
    };
  }

  // ─── 8. Training Assigned ───
  if (type === "training_assigned") {
    var tName = safeText(data.trainingName || "a training module");
    return {
      subject: "New training assigned: " + tName,
      html:
        layoutStart("New Training Module") +
        greeting(name) +
        bodyText("You've been assigned a new training module:") +
        eventBox(
          tName,
          infoRow("Estimated time", (data.estimatedMinutes || "~30") + " minutes") +
          infoRow("Complete by", data.deadline || "As soon as possible")
        ) +
        bodyText("All modules are self-paced and mobile-friendly.") +
        button("Start Training", CONFIG.WEBSITE_URL + "/training") +
        layoutEnd(),
      text: "New training: " + tName + ". " + (data.estimatedMinutes || "~30") + " min. Due: " + (data.deadline || "ASAP") + "."
    };
  }

  // ─── 9. Training Reminder ───
  if (type === "training_reminder") {
    var tName2 = safeText(data.trainingName || "your training");
    var days = data.daysRemaining || "a few";
    return {
      subject: days + " days left: " + tName2,
      html:
        layoutStart("Training Deadline Approaching") +
        greeting(name) +
        bodyText("You have <strong>" + esc(String(days)) + " days left</strong> to complete your training:") +
        eventBox(tName2, "") +
        bodyText("Complete it now to stay eligible for upcoming shifts.") +
        button("Continue Training", CONFIG.WEBSITE_URL + "/training") +
        layoutEnd(),
      text: days + " days left to complete " + tName2 + "."
    };
  }

  // ─── 10. HIPAA Acknowledgment ───
  if (type === "hipaa_acknowledgment") {
    return {
      subject: "HIPAA training complete",
      html:
        layoutStart("HIPAA Training Complete") +
        greeting(name) +
        bodyText("Thank you for completing HIPAA training on " + esc(data.completionDate || "today") + ".") +
        checkmark() +
        "<p style='text-align:center;font-weight:600;color:#10b981;font-size:16px;margin:0 0 20px;'>You're now cleared to volunteer!</p>" +
        bodyText("<strong>Next steps:</strong>") +
        bulletList([
          "Set your availability preferences",
          "Browse and register for shifts"
        ]) +
        button("View Available Shifts", CONFIG.WEBSITE_URL + "/shifts") +
        layoutEnd(),
      text: "HIPAA training complete on " + (data.completionDate || "today") + ". You're cleared to volunteer!"
    };
  }

  // ─── 11. Application Received ───
  if (type === "application_received") {
    var role3 = safeText(data.appliedRole || "Volunteer");
    var appId = safeText(data.applicationId || "N/A");
    return {
      subject: "We received your volunteer application",
      html:
        layoutStart("Application Received") +
        greeting(name) +
        bodyText("Thank you for your interest in volunteering with " + CONFIG.CLINIC_NAME + ".") +
        infoBox(
          infoRow("Position", role3) +
          infoRow("Application ID", appId)
        ) +
        bodyText("Our team will review your application and get back to you within 2\u20133 business days.") +
        button("Check Application Status", CONFIG.WEBSITE_URL + "/dashboard") +
        layoutEnd(),
      text: "Application received. Position: " + role3 + ". Application ID: " + appId + "."
    };
  }

  // ─── 11b. Admin: New Applicant ───
  if (type === "admin_new_applicant") {
    return {
      subject: "New volunteer application: " + safeText(data.volunteerName || "") + " \u2014 " + safeText(data.appliedRole || ""),
      html:
        layoutStart("New Volunteer Application") +
        "<p style='font-size:15px;line-height:24px;margin:0 0 16px;'>Hi Team,</p>" +
        bodyText("A new volunteer application has been submitted and is awaiting review.") +
        infoBox(
          infoRow("Name", data.volunteerName || "") +
          infoRow("Email", data.volunteerEmail || "") +
          infoRow("Applied Role", data.appliedRole || "") +
          infoRow("Application ID", data.applicationId || "")
        ) +
        bodyText("Please review this application in the Volunteer Directory.") +
        button("Review Application", CONFIG.WEBSITE_URL + "/dashboard?tab=directory") +
        layoutEnd(),
      text: "New applicant: " + (data.volunteerName || "") + " (" + (data.volunteerEmail || "") + ") applied as " + (data.appliedRole || "") + "."
    };
  }

  // ─── 12. Application Approved ───
  if (type === "application_approved") {
    var approvedRole = safeText(data.approvedRole || "Volunteer");
    return {
      subject: "Your application has been approved!",
      html:
        layoutStart("Application Approved!") +
        "<p style='font-size:15px;line-height:24px;margin:0 0 16px;'>Congratulations, " + esc(name) + "!</p>" +
        checkmark() +
        "<p style='text-align:center;font-size:16px;margin:0 0 20px;'>Your application has been approved! You're now a <strong>" + esc(approvedRole) + "</strong>.</p>" +
        bodyText("<strong>Next steps:</strong>") +
        bulletList([
          "Complete required HIPAA training",
          "Set your availability preferences",
          "Start registering for shifts"
        ]) +
        button("Complete Training", CONFIG.WEBSITE_URL + "/training") +
        layoutEnd(),
      text: "Your application is approved. Approved role: " + approvedRole + "."
    };
  }

  // ─── 13. Application Rejected ───
  if (type === "application_rejected") {
    var reason = safeText(data.reason || "");
    return {
      subject: "Update on your volunteer application",
      html:
        layoutStart("Application Update") +
        greeting(name) +
        bodyText("Thank you for your interest in volunteering with " + CONFIG.CLINIC_NAME + ".") +
        bodyText("Unfortunately, we're unable to move forward at this time.") +
        (reason ? "<div style='background:#f9fafb;padding:16px;border-left:4px solid #9ca3af;margin:18px 0;border-radius:4px;color:#4b5563;font-size:14px;'>" + esc(reason) + "</div>" : "") +
        bodyText("We encourage you to reapply in the future or reach out to discuss other ways to get involved.") +
        layoutEnd(),
      text: "We are unable to move forward with your application." + (reason ? " Notes: " + reason : "")
    };
  }

  // ─── 14. Monthly Summary ───
  if (type === "monthly_summary") {
    return {
      subject: "Your impact: " + (data.hoursContributed || 0) + " hours, " + (data.peopleHelped || 0) + " lives touched",
      html:
        layoutStart("Your Impact This Month") +
        greeting(name) +
        bodyText("Thank you for your service this month. Here's the impact you've made:") +
        statCards(data.hoursContributed || 0, "Hours Served", data.peopleHelped || 0, "People Helped") +
        infoBox(
          "<p style='margin:0;font-size:14px;'><strong>You made a real difference</strong> for " + esc(String(data.peopleHelped || 0)) + " people in our community. Thank you.</p>"
        ) +
        button("View Your Dashboard", CONFIG.WEBSITE_URL + "/profile") +
        layoutEnd(),
      text: "This month: " + (data.hoursContributed || 0) + " hours, " + (data.shiftsCompleted || 0) + " shifts, " + (data.peopleHelped || 0) + " people helped."
    };
  }

  // ─── 15. Achievement Unlocked ───
  if (type === "achievement_unlocked") {
    return {
      subject: "Achievement unlocked: " + safeText(data.achievementName || ""),
      html:
        layoutStart("Achievement Unlocked!") +
        greeting(name) +
        "<div style='text-align:center;margin:24px 0;'><span style='font-size:48px;color:" + CONFIG.BRAND_COLOR + ";'>&#9733;</span></div>" +
        "<p style='text-align:center;font-size:20px;font-weight:600;color:" + CONFIG.BRAND_COLOR + ";margin:0 0 8px;'>" + esc(data.achievementName || "") + "</p>" +
        "<p style='text-align:center;color:#6b7280;font-size:14px;margin:0 0 16px;'>" + esc(data.achievementDescription || "") + "</p>" +
        "<p style='text-align:center;font-weight:600;color:#10b981;font-size:15px;margin:0 0 4px;'>+" + esc(String(data.xpReward || 0)) + " XP earned!</p>" +
        "<p style='text-align:center;color:#9ca3af;font-size:13px;margin:0;'>You're now Level " + esc(String(data.currentLevel || 1)) + "</p>" +
        button("View All Achievements", CONFIG.WEBSITE_URL + "/profile") +
        layoutEnd(),
      text: "Achievement unlocked: " + (data.achievementName || "") + "! +" + (data.xpReward || 0) + " XP. Level " + (data.currentLevel || 1) + "."
    };
  }

  // ─── 16. Referral Converted ───
  if (type === "referral_converted") {
    return {
      subject: "Your referral joined: " + safeText(data.referredName || ""),
      html:
        layoutStart("Referral Success!") +
        greeting(name) +
        bodyText("Great news! <strong>" + esc(data.referredName || "Someone") + "</strong> just joined Health Matters Clinic using your referral!") +
        "<p style='text-align:center;font-weight:600;color:#10b981;font-size:18px;margin:24px 0;'>+" + esc(String(data.referralBonus || 0)) + " XP earned!</p>" +
        bodyText("Keep sharing your referral link to earn more XP and help grow our volunteer community.") +
        button("View Referral Dashboard", CONFIG.WEBSITE_URL + "/referrals") +
        layoutEnd(),
      text: (data.referredName || "Someone") + " joined via your referral! +" + (data.referralBonus || 0) + " XP."
    };
  }

  // ─── 17. Event Registration Confirmation ───
  if (type === "event_registration_confirmation") {
    var evTitle = safeText(data.eventTitle || "a community event");
    return {
      subject: "You're signed up: " + evTitle,
      html:
        layoutStart("Registration Confirmed") +
        greeting(name) +
        bodyText("You're registered for the following event:") +
        eventBox(
          evTitle,
          infoRow("Date", data.eventDate || "") +
          infoRow("Location", data.eventLocation || "See event details")
        ) +
        bodyText("<strong>What to bring:</strong>") +
        bulletList([
          "Your HMC volunteer badge (if you have one)",
          "Comfortable closed-toe shoes",
          "Water bottle",
          "A positive attitude!"
        ]) +
        subtle("If you can no longer attend, please update your registration in the portal so another volunteer can take your spot.") +
        button("View My Schedule", CONFIG.WEBSITE_URL + "/missions") +
        layoutEnd(),
      text: "You're registered for " + evTitle + " on " + (data.eventDate || "") + " at " + (data.eventLocation || "") + "."
    };
  }

  // ─── 18. Coordinator Registration Alert ───
  if (type === "coordinator_registration_alert") {
    var coordName = safeText(data.coordinatorName || "Coordinator");
    return {
      subject: "New volunteer signup: " + safeText(data.eventTitle || ""),
      html:
        layoutStart("New Event Registration") +
        "<p style='font-size:15px;line-height:24px;margin:0 0 16px;'>Hi " + esc(coordName) + ",</p>" +
        bodyText("A volunteer has signed up for an upcoming event:") +
        successBox(
          infoRow("Volunteer", data.volunteerName || "") +
          infoRow("Event", data.eventTitle || "") +
          infoRow("Date", data.eventDate || "")
        ) +
        bodyText("You can view all registrations and manage staffing in the admin portal.") +
        button("View Event Dashboard", CONFIG.WEBSITE_URL + "/missions") +
        layoutEnd(),
      text: (data.volunteerName || "A volunteer") + " signed up for " + (data.eventTitle || "an event") + " on " + (data.eventDate || "") + "."
    };
  }

  // ─── 19. Public RSVP: Training Nudge ───
  if (type === "public_rsvp_training_nudge") {
    var evTitle2 = safeText(data.eventTitle || "an event");
    return {
      subject: "Complete your training to volunteer at " + evTitle2,
      html:
        layoutStart("Almost Ready to Volunteer!") +
        greeting(name) +
        bodyText("We noticed you RSVP'd for <strong>" + esc(evTitle2) + "</strong> on <strong>" + esc(data.eventDate || "") + "</strong> \u2014 that's awesome!") +
        bodyText("To volunteer at this event (not just attend), you'll need to complete your training first. It only takes a few minutes.") +
        warningBox(
          infoRow("Event", evTitle2) +
          infoRow("Date", data.eventDate || "")
        ) +
        button("Complete My Training", CONFIG.WEBSITE_URL + "/training") +
        subtle("You're already in our system \u2014 just finish your training and you'll be good to go!") +
        layoutEnd(),
      text: "Complete your training to volunteer at " + evTitle2 + " on " + (data.eventDate || "") + "."
    };
  }

  // ─── 20. Public RSVP: Volunteer Invite ───
  if (type === "public_rsvp_volunteer_invite") {
    var rsvpName = safeText(data.rsvpName || "there");
    var evTitle3 = safeText(data.eventTitle || "an event");
    return {
      subject: "Thanks for your RSVP \u2014 want to join our volunteer team?",
      html:
        layoutStart("Join Our Volunteer Team!") +
        "<p style='font-size:15px;line-height:24px;margin:0 0 16px;'>Hi " + esc(rsvpName) + ",</p>" +
        bodyText("Thanks for RSVPing to <strong>" + esc(evTitle3) + "</strong> on <strong>" + esc(data.eventDate || "") + "</strong>! We're excited to have you there.") +
        bodyText("Did you know you can also <strong>join our volunteer team</strong>? As a Health Matters Clinic volunteer, you'll get to:") +
        bulletList([
          "Make a direct impact in your community",
          "Gain valuable experience and skills",
          "Earn volunteer hours and recognition",
          "Connect with an amazing team"
        ]) +
        button("Apply to Volunteer", CONFIG.WEBSITE_URL + "/apply") +
        subtle("No pressure \u2014 we'd love to have you whether you attend as a guest or join the team!") +
        layoutEnd(),
      text: "Thanks for RSVPing to " + evTitle3 + "! Want to join our volunteer team? Apply: " + CONFIG.WEBSITE_URL + "/apply"
    };
  }

  // ─── 21. Event Volunteer Invite ───
  if (type === "event_volunteer_invite") {
    var evTitle4 = safeText(data.eventTitle || "a community event");
    return {
      subject: "You're invited to volunteer with Health Matters Clinic!",
      html:
        layoutStart("You're Invited to Volunteer!") +
        greeting(name) +
        bodyText("Thanks for your interest in volunteering with <strong>Health Matters Clinic</strong>! You've been invited to help at <strong>" + esc(evTitle4) + "</strong> on <strong>" + esc(data.eventDate || "an upcoming date") + "</strong>.") +
        bodyText("To get started, create your account on our volunteer portal. Once registered, you'll be able to:") +
        bulletList([
          "Sign up for upcoming community health events",
          "Complete required training modules",
          "Track your volunteer hours and impact",
          "Connect with the volunteer team"
        ]) +
        button("Create Your Account", CONFIG.WEBSITE_URL + "/apply") +
        subtle("We're excited to have you on the team!") +
        layoutEnd(),
      text: "You're invited to volunteer at " + evTitle4 + " on " + (data.eventDate || "") + ". Create your account: " + CONFIG.WEBSITE_URL + "/apply"
    };
  }

  // ─── 22. Coordinator: RSVP Name Match ───
  if (type === "coordinator_public_rsvp_name_match") {
    var coordName2 = safeText(data.coordinatorName || "Coordinator");
    return {
      subject: "Review needed: Possible volunteer match for RSVP",
      html:
        layoutStart("RSVP Volunteer Match \u2014 Review Needed") +
        "<p style='font-size:15px;line-height:24px;margin:0 0 16px;'>Hi " + esc(coordName2) + ",</p>" +
        bodyText("A public RSVP was submitted that matches a volunteer by <strong>name only</strong> (no email or phone match). Please review and confirm whether this is the same person.") +
        warningBox(
          "<p style='margin:0 0 12px;font-weight:700;color:#92400e;font-size:13px;'>RSVP Details</p>" +
          infoRow("Name", data.rsvpName || "") +
          infoRow("Email", data.rsvpEmail || "") +
          infoRow("Phone", data.rsvpPhone || "Not provided") +
          infoRow("Event", data.eventTitle || "") +
          infoRow("Date", data.eventDate || "")
        ) +
        infoBox(
          "<p style='margin:0 0 12px;font-weight:700;color:" + CONFIG.BRAND_COLOR + ";font-size:13px;'>Possible Volunteer Match</p>" +
          infoRow("Name", data.volunteerName || "") +
          infoRow("Email", data.volunteerEmail || "") +
          infoRow("Phone", data.volunteerPhone || "Not on file") +
          infoRow("Status", data.volunteerStatus || "")
        ) +
        bodyText("If this is the same person, you can manually register them for the event in the admin portal.") +
        button("Review in Admin Portal", CONFIG.WEBSITE_URL + "/admin/volunteers") +
        layoutEnd(),
      text: "RSVP from " + (data.rsvpName || "") + " may match volunteer " + (data.volunteerName || "") + ". Please verify."
    };
  }

  // ─── 23. Support Ticket Notification ───
  if (type === "support_ticket_notification") {
    return {
      subject: "New support ticket: " + safeText(data.subject || ""),
      html:
        layoutStart("New Support Ticket Received") +
        bodyText("A new support ticket has been submitted:") +
        warningBox(
          infoRow("Subject", data.subject || "") +
          infoRow("From", (data.submitterName || "Unknown") + " (" + (data.submitterEmail || "") + ")") +
          infoRow("Category", data.category || "General") +
          infoRow("Priority", data.priority || "Normal") +
          infoRow("Ticket ID", data.ticketId || "")
        ) +
        "<div style='background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;'>" +
        "<p style='margin:0;color:#374151;font-weight:600;font-size:14px;'>Description:</p>" +
        "<p style='margin:8px 0 0;color:#6b7280;font-size:14px;'>" + esc(data.description || "No description provided") + "</p></div>" +
        bodyText("Please respond to this ticket at your earliest convenience.") +
        button("View Ticket", CONFIG.WEBSITE_URL + "/admin/support") +
        layoutEnd(),
      text: "New support ticket from " + (data.submitterName || "Unknown") + ": " + (data.subject || "") + ". ID: " + (data.ticketId || "") + "."
    };
  }

  // Unknown template
  return null;
}


// ════════════════════════════════════════
// HTML HELPERS — Event Finder design
// ════════════════════════════════════════

function layoutStart(title) {
  return (
    "<!doctype html><html><head><meta charset='utf-8'/>" +
    "<meta name='viewport' content='width=device-width,initial-scale=1'/>" +
    "<link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap' rel='stylesheet'>" +
    "</head><body style='margin:0;padding:20px;background:#f5f3ef;font-family:Inter,Arial,sans-serif;color:#1a1a1a;'>" +
    "<table role='presentation' width='100%' cellspacing='0' cellpadding='0'>" +
    "<tr><td align='center'>" +
    "<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);border:1px solid #e5e5e5;'>" +
    // Header with logo
    "<tr><td style='padding:24px;background:" + CONFIG.BRAND_COLOR + ";text-align:center;'>" +
    "<img src='" + CONFIG.LOGO_URL + "' alt='HMC' width='48' height='48' style='width:48px;height:48px;border-radius:8px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;'>" +
    "<h1 style='margin:0;font-size:22px;font-weight:700;color:#ffffff;'>" + esc(CONFIG.CLINIC_NAME) + "</h1>" +
    "<p style='margin:8px 0 0;opacity:0.9;font-size:14px;color:#ffffff;'>" + esc(title) + "</p>" +
    "</td></tr>" +
    // Body
    "<tr><td style='padding:32px;'>"
  );
}

function layoutEnd() {
  return (
    "</td></tr>" +
    // Footer
    "<tr><td style='background:#f5f3ef;padding:20px;border-top:1px solid #e5e5e5;text-align:center;'>" +
    "<p style='color:#666;font-size:13px;margin:0;'>Questions? <a href='mailto:" + CONFIG.CONTACT_EMAIL + "' style='color:" + CONFIG.BRAND_COLOR + ";font-weight:600;'>" + CONFIG.CONTACT_EMAIL + "</a></p>" +
    "<p style='margin:12px 0 0;font-size:11px;color:#9ca3af;'>&copy; " + new Date().getFullYear() + " " + esc(CONFIG.CLINIC_NAME) + ". All rights reserved.</p>" +
    "</td></tr>" +
    "</table></td></tr></table></body></html>"
  );
}

function greeting(name) {
  return "<p style='font-size:18px;color:#1a1a1a;font-weight:600;margin:0 0 8px;'>Hi " + esc(name) + "!</p>";
}

function bodyText(html) {
  // bodyText allows inline HTML (bold, links), so no escaping here
  return "<p style='font-size:15px;line-height:24px;color:#555;margin:0 0 16px;'>" + html + "</p>";
}

function subtle(text) {
  return "<p style='font-size:13px;color:#9ca3af;margin:12px 0;'>" + esc(text) + "</p>";
}

function button(label, url) {
  return (
    "<div style='text-align:center;margin:28px 0;'>" +
    "<a href='" + escAttr(url) + "' style='display:inline-block;background:" + CONFIG.BRAND_COLOR + ";color:#ffffff;padding:16px 48px;border-radius:30px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(35,61,255,0.3);'>" + esc(label) + "</a></div>"
  );
}

function codeBlock(code) {
  return (
    "<div style='margin:24px 0;padding:20px;border-radius:14px;background:#f0f4ff;text-align:center;border:1.5px solid rgba(35,61,255,0.2);'>" +
    "<div style='font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:36px;letter-spacing:8px;font-weight:800;color:" + CONFIG.BRAND_COLOR + ";'>" +
    esc(code) + "</div></div>"
  );
}

function eventBox(title, contentHtml) {
  return (
    "<div style='background:#f0f4ff;padding:20px;border-radius:12px;margin:20px 0;border:1.5px solid rgba(35,61,255,0.2);'>" +
    "<h2 style='color:" + CONFIG.BRAND_COLOR + ";margin:0 0 12px;font-size:18px;font-weight:700;'>" + esc(title) + "</h2>" +
    contentHtml +
    "</div>"
  );
}

function infoBox(contentHtml) {
  return (
    "<div style='background:#f0f4ff;padding:20px;border-radius:12px;margin:20px 0;border:1.5px solid rgba(35,61,255,0.2);'>" +
    contentHtml +
    "</div>"
  );
}

function warningBox(contentHtml) {
  return (
    "<div style='background:#fef3c7;padding:20px;border-radius:12px;margin:20px 0;border-left:4px solid #f59e0b;'>" +
    contentHtml +
    "</div>"
  );
}

function successBox(contentHtml) {
  return (
    "<div style='background:#f0fdf4;padding:20px;border-radius:12px;margin:20px 0;border-left:4px solid #10b981;'>" +
    contentHtml +
    "</div>"
  );
}

function errorBox(contentHtml) {
  return (
    "<div style='background:#fef2f2;padding:20px;border-radius:12px;margin:20px 0;border-left:4px solid #ef4444;'>" +
    contentHtml +
    "</div>"
  );
}

function highlightBlock(contentHtml) {
  return (
    "<div style='background:" + CONFIG.BRAND_COLOR + ";color:white;padding:24px;border-radius:12px;text-align:center;margin:24px 0;'>" +
    contentHtml +
    "</div>"
  );
}

function checkmark() {
  return (
    "<div style='text-align:center;margin:24px 0;'>" +
    "<div style='display:inline-block;width:64px;height:64px;border-radius:50%;background:#10b981;text-align:center;line-height:64px;'>" +
    "<span style='font-size:32px;color:white;'>&#10003;</span></div></div>"
  );
}

function statCards(val1, label1, val2, label2) {
  return (
    "<table width='100%' cellpadding='0' cellspacing='0' style='margin:24px 0;border-collapse:separate;border-spacing:12px 0;'><tr>" +
    "<td style='background:" + CONFIG.BRAND_COLOR + ";color:white;padding:20px;border-radius:12px;text-align:center;width:50%;'>" +
    "<p style='margin:0;font-size:36px;font-weight:bold;'>" + esc(String(val1)) + "</p>" +
    "<p style='margin:8px 0 0;font-size:12px;opacity:0.9;'>" + esc(label1) + "</p></td>" +
    "<td style='background:" + CONFIG.BRAND_COLOR + ";color:white;padding:20px;border-radius:12px;text-align:center;width:50%;'>" +
    "<p style='margin:0;font-size:36px;font-weight:bold;'>" + esc(String(val2)) + "</p>" +
    "<p style='margin:8px 0 0;font-size:12px;opacity:0.9;'>" + esc(label2) + "</p></td>" +
    "</tr></table>"
  );
}

function infoRow(label, value) {
  return "<p style='margin:5px 0;color:#555;font-size:14px;'><strong>" + esc(label) + ":</strong> " + esc(value) + "</p>";
}

function bulletList(items) {
  var html = "<ul style='margin:12px 0;padding-left:20px;color:#4b5563;'>";
  for (var i = 0; i < items.length; i++) {
    html += "<li style='margin:8px 0;font-size:14px;'>" + esc(items[i]) + "</li>";
  }
  html += "</ul>";
  return html;
}


// ════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════

function safeText(x) {
  return String(x == null ? "" : x).replace(/\s+/g, " ").trim();
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escAttr(str) {
  return esc(str).replace(/"/g, "&quot;");
}


// ════════════════════════════════════════
// TEST — run manually in Apps Script editor
// ════════════════════════════════════════

function testEmailVerification() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        type: "email_verification",
        toEmail: "tech@healthmatters.clinic",
        volunteerName: "Test User",
        verificationCode: "123456",
        expiresIn: 15
      })
    }
  };

  var result = doPost(mockEvent);
  Logger.log(result.getContent());
}

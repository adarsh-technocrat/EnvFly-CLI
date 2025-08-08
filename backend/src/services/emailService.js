const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const config = require('../config');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.provider = config.email.provider;
    this.from = config.email.from;
    this.replyTo = config.email.replyTo;
    
    // Initialize email providers
    this.initializeProviders();
  }

  /**
   * Initialize email providers based on configuration
   */
  initializeProviders() {
    try {
      // Initialize Resend
      if (config.email.resend.enabled) {
        this.resend = new Resend(config.email.resend.apiKey);
        logger.info('Resend email provider initialized');
      }

      // Initialize SMTP
      if (config.email.smtp.auth.user && config.email.smtp.auth.pass) {
        this.smtpTransporter = nodemailer.createTransporter({
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          secure: config.email.smtp.secure,
          auth: config.email.smtp.auth
        });
        logger.info('SMTP email provider initialized');
      }

      // Validate provider selection
      if (this.provider === 'resend' && !config.email.resend.enabled) {
        logger.warn('Resend selected but not configured, falling back to SMTP');
        this.provider = 'smtp';
      }

      if (this.provider === 'smtp' && !this.smtpTransporter) {
        logger.warn('SMTP selected but not configured, falling back to Resend');
        this.provider = 'resend';
      }

    } catch (error) {
      logger.error('Failed to initialize email providers:', error);
      throw new Error('Email service initialization failed');
    }
  }

  /**
   * Send email using the configured provider
   */
  async sendEmail(options) {
    const { to, subject, html, text, attachments, template, templateData } = options;

    try {
      if (this.provider === 'resend' && this.resend) {
        return await this.sendWithResend({ to, subject, html, text, attachments, template, templateData });
      } else if (this.smtpTransporter) {
        return await this.sendWithSMTP({ to, subject, html, text, attachments });
      } else {
        throw new Error('No email provider configured');
      }
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send email using Resend
   */
  async sendWithResend(options) {
    const { to, subject, html, text, attachments, template, templateData } = options;

    const emailData = {
      from: config.email.resend.from || this.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      reply_to: this.replyTo
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }));
    }

    // Use template if provided
    if (template && templateData) {
      emailData.template = template;
      emailData.templateData = templateData;
    }

    const result = await this.resend.emails.send(emailData);
    
    logger.info('Email sent via Resend:', {
      messageId: result.data?.id,
      to: emailData.to,
      subject
    });

    return result;
  }

  /**
   * Send email using SMTP
   */
  async sendWithSMTP(options) {
    const { to, subject, html, text, attachments } = options;

    const mailOptions = {
      from: config.email.smtp.from || this.from,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html,
      text,
      replyTo: this.replyTo
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const result = await this.smtpTransporter.sendMail(mailOptions);
    
    logger.info('Email sent via SMTP:', {
      messageId: result.messageId,
      to: mailOptions.to,
      subject
    });

    return result;
  }

  /**
   * Send team invitation email
   */
  async sendTeamInvitation(invitationData) {
    const { 
      inviteeEmail, 
      inviterName, 
      teamName, 
      inviteCode, 
      expiresAt,
      role = 'member'
    } = invitationData;

    const subject = `You've been invited to join ${teamName} on EnvFly`;
    const inviteUrl = `${process.env.FRONTEND_URL || 'https://app.envfly.io'}/join?code=${inviteCode}`;
    const expiresDate = new Date(expiresAt).toLocaleDateString();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation - EnvFly</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .code { background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Welcome to EnvFly!</h1>
            <p>You've been invited to join a team</p>
          </div>
          <div class="content">
            <h2>Hello!</h2>
            <p><strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> on EnvFly.</p>
            
            <p>You'll be joining as a <strong>${role}</strong> with the following permissions:</p>
            <ul>
              <li>View and manage environment variables</li>
              <li>Collaborate with team members</li>
              <li>Access project resources</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Accept Invitation</a>
            </div>
            
            <p><strong>Or use this invite code:</strong></p>
            <div class="code">${inviteCode}</div>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This invitation expires on <strong>${expiresDate}</strong></li>
              <li>You can only use this invitation once</li>
              <li>If you don't have an EnvFly account, one will be created for you</li>
            </ul>
            
            <p>If you have any questions, please contact your team administrator or reply to this email.</p>
          </div>
          <div class="footer">
            <p>This invitation was sent by EnvFly - Secure Environment Variable Management</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Team Invitation - EnvFly

Hello!

${inviterName} has invited you to join the team ${teamName} on EnvFly.

You'll be joining as a ${role} with the following permissions:
- View and manage environment variables
- Collaborate with team members
- Access project resources

To accept this invitation, visit: ${inviteUrl}

Or use this invite code: ${inviteCode}

Important:
- This invitation expires on ${expiresDate}
- You can only use this invitation once
- If you don't have an EnvFly account, one will be created for you

If you have any questions, please contact your team administrator.

This invitation was sent by EnvFly - Secure Environment Variable Management
If you didn't expect this invitation, you can safely ignore this email.
    `;

    return await this.sendEmail({
      to: inviteeEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(userData) {
    const { email, name } = userData;

    const subject = 'Welcome to EnvFly! 🚀';
    const loginUrl = `${process.env.FRONTEND_URL || 'https://app.envfly.io'}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to EnvFly</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to EnvFly!</h1>
            <p>Your account has been created successfully</p>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Welcome to EnvFly - the secure way to manage environment variables across your team and projects.</p>
            
            <h3>What you can do with EnvFly:</h3>
            <ul>
              <li>🔐 Securely store and encrypt environment variables</li>
              <li>👥 Collaborate with your team members</li>
              <li>🔄 Sync environments across different projects</li>
              <li>📊 Track changes with audit logs</li>
              <li>☁️ Deploy to multiple cloud providers</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Get Started</a>
            </div>
            
            <h3>Quick Start Guide:</h3>
            <ol>
              <li>Log in to your account</li>
              <li>Create your first project</li>
              <li>Add environment variables</li>
              <li>Invite team members</li>
              <li>Start collaborating!</li>
            </ol>
            
            <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>Thank you for choosing EnvFly!</p>
            <p>Secure Environment Variable Management for Modern Teams</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to EnvFly! 🚀

Hello ${name}!

Welcome to EnvFly - the secure way to manage environment variables across your team and projects.

What you can do with EnvFly:
- 🔐 Securely store and encrypt environment variables
- 👥 Collaborate with your team members
- 🔄 Sync environments across different projects
- 📊 Track changes with audit logs
- ☁️ Deploy to multiple cloud providers

Get started: ${loginUrl}

Quick Start Guide:
1. Log in to your account
2. Create your first project
3. Add environment variables
4. Invite team members
5. Start collaborating!

If you have any questions or need help getting started, don't hesitate to reach out to our support team.

Thank you for choosing EnvFly!
Secure Environment Variable Management for Modern Teams
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userData, resetToken) {
    const { email, name } = userData;
    const resetUrl = `${process.env.FRONTEND_URL || 'https://app.envfly.io'}/reset-password?token=${resetToken}`;

    const subject = 'Reset Your EnvFly Password';
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toLocaleString(); // 1 hour

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - EnvFly</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
            <p>Reset your EnvFly account password</p>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>We received a request to reset your EnvFly account password.</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>Important:</strong>
              <ul>
                <li>This link will expire on <strong>${expiresAt}</strong></li>
                <li>If you didn't request this reset, you can safely ignore this email</li>
                <li>Your current password will remain unchanged until you complete the reset</li>
              </ul>
            </div>
            
            <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
          </div>
          <div class="footer">
            <p>This email was sent by EnvFly - Secure Environment Variable Management</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset - EnvFly

Hello ${name}!

We received a request to reset your EnvFly account password.

Reset your password: ${resetUrl}

Important:
- This link will expire on ${expiresAt}
- If you didn't request this reset, you can safely ignore this email
- Your current password will remain unchanged until you complete the reset

If the link above doesn't work, you can copy and paste this URL into your browser:
${resetUrl}

This email was sent by EnvFly - Secure Environment Variable Management
If you have any questions, please contact our support team.
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send environment change notification
   */
  async sendEnvironmentChangeNotification(notificationData) {
    const { 
      userEmail, 
      userName, 
      environmentName, 
      projectName, 
      changeType, 
      changedBy, 
      timestamp 
    } = notificationData;

    const subject = `Environment Update: ${environmentName} in ${projectName}`;
    const projectUrl = `${process.env.FRONTEND_URL || 'https://app.envfly.io'}/projects/${projectName}/environments/${environmentName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Environment Update - EnvFly</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .info { background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Environment Update</h1>
            <p>Changes made to your environment</p>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>An environment you have access to has been updated.</p>
            
            <div class="info">
              <strong>Project:</strong> ${projectName}<br>
              <strong>Environment:</strong> ${environmentName}<br>
              <strong>Change Type:</strong> ${changeType}<br>
              <strong>Updated By:</strong> ${changedBy}<br>
              <strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}
            </div>
            
            <div style="text-align: center;">
              <a href="${projectUrl}" class="button">View Changes</a>
            </div>
            
            <p>You can view the full details and history of changes by clicking the button above.</p>
          </div>
          <div class="footer">
            <p>This notification was sent by EnvFly - Secure Environment Variable Management</p>
            <p>You can manage your notification preferences in your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Environment Update - EnvFly

Hello ${userName}!

An environment you have access to has been updated.

Project: ${projectName}
Environment: ${environmentName}
Change Type: ${changeType}
Updated By: ${changedBy}
Timestamp: ${new Date(timestamp).toLocaleString()}

View changes: ${projectUrl}

You can view the full details and history of changes by visiting the link above.

This notification was sent by EnvFly - Secure Environment Variable Management
You can manage your notification preferences in your account settings.
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Get email provider status
   */
  getProviderStatus() {
    return {
      provider: this.provider,
      resend: {
        enabled: config.email.resend.enabled,
        configured: !!config.email.resend.apiKey
      },
      smtp: {
        enabled: !!this.smtpTransporter,
        configured: !!(config.email.smtp.auth.user && config.email.smtp.auth.pass)
      }
    };
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService; 
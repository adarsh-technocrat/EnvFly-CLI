require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/envfly',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  // Encryption configuration
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 64
  },
  
  // Email configuration (SMTP and Resend)
  email: {
    // SMTP configuration (legacy)
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: process.env.EMAIL_FROM || 'noreply@envfly.io'
    },
    // Resend configuration (recommended)
    resend: {
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM || 'noreply@envfly.io',
      domain: process.env.RESEND_DOMAIN,
      enabled: !!process.env.RESEND_API_KEY
    },
    // Email provider selection
    provider: process.env.EMAIL_PROVIDER || 'resend', // 'smtp' or 'resend'
    // Default settings
    from: process.env.EMAIL_FROM || 'noreply@envfly.io',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@envfly.io'
  },
  
  // CORS configuration
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100
  },
  
  // File upload limits
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['text/plain', 'application/json']
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      error: 'logs/error.log',
      combined: 'logs/combined.log'
    }
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // API configuration
  api: {
    version: 'v1',
    prefix: '/api/v1',
    timeout: parseInt(process.env.API_TIMEOUT) || 30000
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI'
];

if (process.env.NODE_ENV === 'production') {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    process.exit(1);
  }
}

module.exports = config; 
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'readonly'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: false
      }
    }
  },
  teams: [{
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'readonly'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ apiKey: 1 });
userSchema.index({ 'teams.team': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate API key if not exists
userSchema.pre('save', async function(next) {
  if (!this.isModified('apiKey') && !this.apiKey) {
    this.apiKey = this.generateApiKey();
  }
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateApiKey = function() {
  const crypto = require('crypto');
  return `envfly_${crypto.randomBytes(32).toString('hex')}`;
};

userSchema.methods.generateJWT = function() {
  return jwt.sign(
    { 
      userId: this._id, 
      email: this.email, 
      role: this.role 
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    { userId: this._id },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// Static methods
userSchema.statics.findByApiKey = function(apiKey) {
  return this.findOne({ apiKey, isActive: true });
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

module.exports = mongoose.model('User', userSchema); 
const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config');

const environmentSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  variables: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true
    },
    encrypted: {
      type: Boolean,
      default: false
    },
    encryptedValue: {
      type: String
    },
    description: {
      type: String,
      trim: true
    },
    isSecret: {
      type: Boolean,
      default: false
    },
    tags: [{
      type: String,
      trim: true
    }]
  }],
  version: {
    type: Number,
    default: 1
  },
  versionHistory: [{
    version: {
      type: Number,
      required: true
    },
    variables: [{
      key: String,
      value: String,
      encrypted: Boolean,
      encryptedValue: String,
      description: String,
      isSecret: Boolean,
      tags: [String]
    }],
    message: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    changeType: {
      type: String,
      enum: ['create', 'update', 'delete', 'merge'],
      required: true
    }
  }],
  auditLogs: [{
    action: {
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'sync', 'pull', 'push'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userEmail: {
      type: String,
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    details: {
      variablesChanged: [{
        key: String,
        oldValue: String,
        newValue: String,
        action: String
      }],
      version: Number,
      message: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    encryptionEnabled: {
      type: Boolean,
      default: true
    },
    autoBackup: {
      type: Boolean,
      default: true
    },
    conflictResolution: {
      type: String,
      enum: ['prompt', 'local', 'remote', 'merge'],
      default: 'prompt'
    }
  },
  lastSync: {
    type: Date
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
environmentSchema.index({ projectId: 1, name: 1 }, { unique: true });
environmentSchema.index({ 'variables.key': 1 });
environmentSchema.index({ 'auditLogs.timestamp': -1 });
environmentSchema.index({ 'versionHistory.version': -1 });

// Pre-save middleware to encrypt sensitive variables
environmentSchema.pre('save', async function(next) {
  if (this.isModified('variables')) {
    for (const variable of this.variables) {
      if (variable.isSecret && !variable.encrypted && variable.value) {
        variable.encryptedValue = await this.encryptValue(variable.value);
        variable.encrypted = true;
        variable.value = ''; // Clear plain text value
      }
    }
  }
  next();
});

// Instance methods
environmentSchema.methods.encryptValue = async function(value) {
  if (!config.encryption.algorithm) {
    return value;
  }
  
  const algorithm = config.encryption.algorithm;
  const key = crypto.scryptSync(config.jwt.secret, 'salt', config.encryption.keyLength);
  const iv = crypto.randomBytes(config.encryption.ivLength);
  
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
};

environmentSchema.methods.decryptValue = async function(encryptedValue) {
  if (!config.encryption.algorithm) {
    return encryptedValue;
  }
  
  try {
    const [ivHex, encrypted] = encryptedValue.split(':');
    const algorithm = config.encryption.algorithm;
    const key = crypto.scryptSync(config.jwt.secret, 'salt', config.encryption.keyLength);
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt value');
  }
};

environmentSchema.methods.getVariable = function(key) {
  const variable = this.variables.find(v => v.key === key);
  if (!variable) return null;
  
  if (variable.encrypted && variable.encryptedValue) {
    return this.decryptValue(variable.encryptedValue);
  }
  
  return variable.value;
};

environmentSchema.methods.setVariable = function(key, value, options = {}) {
  const existingIndex = this.variables.findIndex(v => v.key === key);
  const variableData = {
    key,
    value,
    description: options.description || '',
    isSecret: options.isSecret || false,
    tags: options.tags || []
  };
  
  if (existingIndex >= 0) {
    this.variables[existingIndex] = variableData;
  } else {
    this.variables.push(variableData);
  }
  
  this.lastModified = new Date();
  return this.save();
};

environmentSchema.methods.removeVariable = function(key) {
  const index = this.variables.findIndex(v => v.key === key);
  if (index >= 0) {
    this.variables.splice(index, 1);
    this.lastModified = new Date();
  }
  return this.save();
};

environmentSchema.methods.createVersion = function(message, userId, changeType = 'update') {
  const versionData = {
    version: this.version + 1,
    variables: JSON.parse(JSON.stringify(this.variables)),
    message,
    updatedBy: userId,
    changeType
  };
  
  this.versionHistory.push(versionData);
  this.version = versionData.version;
  
  return this.save();
};

environmentSchema.methods.addAuditLog = function(auditData) {
  this.auditLogs.push({
    ...auditData,
    timestamp: new Date()
  });
  
  // Keep only last 1000 audit logs
  if (this.auditLogs.length > 1000) {
    this.auditLogs = this.auditLogs.slice(-1000);
  }
  
  return this.save();
};

environmentSchema.methods.rollbackToVersion = function(version, userId) {
  const targetVersion = this.versionHistory.find(v => v.version === version);
  if (!targetVersion) {
    throw new Error(`Version ${version} not found`);
  }
  
  this.variables = JSON.parse(JSON.stringify(targetVersion.variables));
  this.version = this.version + 1;
  this.lastModified = new Date();
  
  // Add rollback to version history
  this.versionHistory.push({
    version: this.version,
    variables: this.variables,
    message: `Rollback to version ${version}`,
    updatedBy: userId,
    changeType: 'update'
  });
  
  return this.save();
};

// Static methods
environmentSchema.statics.findByProjectAndName = function(projectId, name) {
  return this.findOne({ projectId, name, isActive: true });
};

environmentSchema.statics.findProjectEnvironments = function(projectId) {
  return this.find({ projectId, isActive: true })
    .select('name description version lastSync lastModified variables')
    .sort({ name: 1 });
};

module.exports = mongoose.model('Environment', environmentSchema); 
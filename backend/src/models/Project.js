const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  storageProvider: {
    type: String,
    enum: ['git', 'aws', 'azure', 'google', 'envfly'],
    required: true
  },
  storageConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  environments: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    remoteId: {
      type: String,
      unique: true,
      sparse: true
    },
    file: {
      type: String,
      default: '.env'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastSync: {
      type: Date
    },
    version: {
      type: Number,
      default: 1
    },
    variables: {
      type: Number,
      default: 0
    },
    permissions: {
      read: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      write: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      admin: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }]
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
    },
    auditLogs: {
      type: Boolean,
      default: true
    },
    maxEnvironments: {
      type: Number,
      default: 20
    },
    maxVariablesPerEnv: {
      type: Number,
      default: 1000
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
projectSchema.index({ name: 1 });
projectSchema.index({ owner: 1 });
projectSchema.index({ team: 1 });
projectSchema.index({ 'environments.remoteId': 1 });

// Instance methods
projectSchema.methods.addEnvironment = function(name, description = '', file = '.env') {
  const existingEnv = this.environments.find(env => env.name === name);
  if (existingEnv) {
    throw new Error(`Environment '${name}' already exists`);
  }
  
  this.environments.push({
    name,
    description,
    file,
    isActive: true,
    version: 1,
    variables: 0
  });
  
  return this.save();
};

projectSchema.methods.removeEnvironment = function(name) {
  const envIndex = this.environments.findIndex(env => env.name === name);
  if (envIndex === -1) {
    throw new Error(`Environment '${name}' not found`);
  }
  
  this.environments[envIndex].isActive = false;
  return this.save();
};

projectSchema.methods.getEnvironment = function(name) {
  return this.environments.find(env => env.name === name && env.isActive);
};

projectSchema.methods.updateEnvironmentVersion = function(name, version, variableCount) {
  const env = this.environments.find(e => e.name === name);
  if (env) {
    env.version = version;
    env.variables = variableCount;
    env.lastSync = new Date();
  }
  return this.save();
};

projectSchema.methods.hasPermission = function(userId, environment, permission) {
  // Check if user is project owner
  if (this.owner.toString() === userId.toString()) {
    return true;
  }
  
  // Check team permissions
  const teamMember = this.team.members?.find(m => 
    m.user.toString() === userId.toString() && m.isActive
  );
  
  if (teamMember) {
    switch (permission) {
      case 'read':
        return ['owner', 'admin', 'member', 'readonly'].includes(teamMember.role);
      case 'write':
        return ['owner', 'admin', 'member'].includes(teamMember.role);
      case 'admin':
        return ['owner', 'admin'].includes(teamMember.role);
      default:
        return false;
    }
  }
  
  // Check environment-specific permissions
  const env = this.environments.find(e => e.name === environment);
  if (env) {
    switch (permission) {
      case 'read':
        return env.permissions.read.some(id => id.toString() === userId.toString());
      case 'write':
        return env.permissions.write.some(id => id.toString() === userId.toString());
      case 'admin':
        return env.permissions.admin.some(id => id.toString() === userId.toString());
      default:
        return false;
    }
  }
  
  return false;
};

// Static methods
projectSchema.statics.findUserProjects = function(userId) {
  return this.find({
    $or: [
      { owner: userId },
      { 'team.members.user': userId, 'team.members.isActive': true }
    ],
    isActive: true
  }).populate('owner', 'name email')
    .populate('team', 'name');
};

projectSchema.statics.findTeamProjects = function(teamId) {
  return this.find({
    team: teamId,
    isActive: true
  }).populate('owner', 'name email');
};

module.exports = mongoose.model('Project', projectSchema); 
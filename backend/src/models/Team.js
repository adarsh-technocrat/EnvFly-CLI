const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
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
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'readonly'],
      default: 'member'
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    joinedAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  inviteCodes: [{
    code: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'readonly'],
      default: 'member'
    },
    maxUses: {
      type: Number,
      default: 1
    },
    usedCount: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    encryptionEnabled: {
      type: Boolean,
      default: true
    },
    auditLogs: {
      type: Boolean,
      default: true
    },
    autoBackup: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    maxProjects: {
      type: Number,
      default: 10
    },
    maxMembers: {
      type: Number,
      default: 50
    }
  },
  projects: [{
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    permissions: {
      read: {
        type: Boolean,
        default: true
      },
      write: {
        type: Boolean,
        default: true
      },
      admin: {
        type: Boolean,
        default: false
      }
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
teamSchema.index({ name: 1 });
teamSchema.index({ owner: 1 });
teamSchema.index({ 'members.user': 1 });
teamSchema.index({ 'inviteCodes.code': 1 });

// Instance methods
teamSchema.methods.addMember = function(userId, role = 'member', invitedBy = null) {
  const existingMember = this.members.find(m => m.user.toString() === userId.toString());
  
  if (existingMember) {
    existingMember.role = role;
    existingMember.isActive = true;
    if (!existingMember.joinedAt) {
      existingMember.joinedAt = new Date();
    }
  } else {
    this.members.push({
      user: userId,
      role,
      invitedBy,
      invitedAt: new Date(),
      joinedAt: new Date(),
      isActive: true
    });
  }
  
  return this.save();
};

teamSchema.methods.removeMember = function(userId) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  if (member) {
    member.isActive = false;
  }
  return this.save();
};

teamSchema.methods.generateInviteCode = function(role = 'member', maxUses = 1, expiresInDays = 7) {
  const crypto = require('crypto');
  const code = crypto.randomBytes(16).toString('hex');
  
  const inviteCode = {
    code,
    role,
    maxUses,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    isActive: true
  };
  
  this.inviteCodes.push(inviteCode);
  return this.save().then(() => code);
};

teamSchema.methods.validateInviteCode = function(code) {
  const inviteCode = this.inviteCodes.find(ic => 
    ic.code === code && 
    ic.isActive && 
    ic.usedCount < ic.maxUses &&
    (!ic.expiresAt || ic.expiresAt > new Date())
  );
  
  return inviteCode;
};

teamSchema.methods.useInviteCode = function(code) {
  const inviteCode = this.inviteCodes.find(ic => ic.code === code);
  if (inviteCode) {
    inviteCode.usedCount += 1;
    if (inviteCode.usedCount >= inviteCode.maxUses) {
      inviteCode.isActive = false;
    }
  }
  return this.save();
};

teamSchema.methods.hasPermission = function(userId, permission) {
  const member = this.members.find(m => 
    m.user.toString() === userId.toString() && m.isActive
  );
  
  if (!member) return false;
  
  switch (permission) {
    case 'read':
      return ['owner', 'admin', 'member', 'readonly'].includes(member.role);
    case 'write':
      return ['owner', 'admin', 'member'].includes(member.role);
    case 'admin':
      return ['owner', 'admin'].includes(member.role);
    case 'owner':
      return member.role === 'owner';
    default:
      return false;
  }
};

// Static methods
teamSchema.statics.findByInviteCode = function(code) {
  return this.findOne({ 'inviteCodes.code': code, 'inviteCodes.isActive': true });
};

teamSchema.statics.findUserTeams = function(userId) {
  return this.find({
    $or: [
      { owner: userId },
      { 'members.user': userId, 'members.isActive': true }
    ],
    isActive: true
  }).populate('owner', 'name email');
};

module.exports = mongoose.model('Team', teamSchema); 
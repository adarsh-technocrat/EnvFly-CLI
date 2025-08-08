// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

// Create the envfly database
db = db.getSiblingDB('envfly');

// Create collections with proper indexes
db.createCollection('users');
db.createCollection('teams');
db.createCollection('projects');
db.createCollection('environments');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "apiKey": 1 }, { sparse: true });
db.users.createIndex({ "teams.team": 1 });

db.teams.createIndex({ "name": 1 });
db.teams.createIndex({ "owner": 1 });
db.teams.createIndex({ "members.user": 1 });
db.teams.createIndex({ "inviteCodes.code": 1 });

db.projects.createIndex({ "name": 1 });
db.projects.createIndex({ "owner": 1 });
db.projects.createIndex({ "team": 1 });
db.projects.createIndex({ "environments.remoteId": 1 });

db.environments.createIndex({ "projectId": 1, "name": 1 }, { unique: true });
db.environments.createIndex({ "variables.key": 1 });
db.environments.createIndex({ "auditLogs.timestamp": -1 });
db.environments.createIndex({ "versionHistory.version": -1 });

// Create a default admin user (optional)
// You can remove this if you want to create users through the API only
const adminUser = {
  email: "admin@envfly.io",
  name: "Admin User",
  password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK6e", // "admin123"
  role: "admin",
  isActive: true,
  isVerified: true,
  apiKey: "envfly_admin_default_key_change_this",
  createdAt: new Date(),
  updatedAt: new Date()
};

// Only create admin user if it doesn't exist
if (db.users.countDocuments({ email: adminUser.email }) === 0) {
  db.users.insertOne(adminUser);
  print("Default admin user created: admin@envfly.io / admin123");
  print("⚠️  IMPORTANT: Change the default password immediately!");
} else {
  print("Admin user already exists, skipping creation");
}

print("MongoDB initialization completed successfully!"); 
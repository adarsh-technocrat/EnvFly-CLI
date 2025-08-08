#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function runCommand(command) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error running command: ${command}`);
    process.exit(1);
  }
}

function updateChangelog(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  let changelog = fs.readFileSync(changelogPath, 'utf8');
  
  const today = new Date().toISOString().split('T')[0];
  const releaseEntry = `## [${version}] - ${today}\n\n### Added\n- Release ${version}\n\n### Changed\n\n### Deprecated\n\n### Removed\n\n### Fixed\n\n### Security\n\n`;
  
  // Replace [Unreleased] with the new version
  changelog = changelog.replace('## [Unreleased]', releaseEntry + '## [Unreleased]');
  
  fs.writeFileSync(changelogPath, changelog);
  console.log(`✅ Updated CHANGELOG.md for version ${version}`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log(`
Usage: node scripts/release.js <command>

Commands:
  patch    - Release a patch version (1.0.0 -> 1.0.1)
  minor    - Release a minor version (1.0.0 -> 1.1.0)
  major    - Release a major version (1.0.0 -> 2.0.0)
  version  - Show current version
  clean    - Clean build artifacts
    `);
    process.exit(1);
  }
  
  switch (command) {
    case 'patch':
    case 'minor':
    case 'major':
      console.log(`🚀 Starting ${command} release...`);
      
      // Run tests first
      console.log('🧪 Running tests...');
      runCommand('npm test');
      
      // Clean previous builds
      console.log('🧹 Cleaning previous builds...');
      runCommand('npm run clean');
      
      // Install dependencies
      console.log('📦 Installing dependencies...');
      runCommand('npm ci');
      
      // Update version
      console.log(`📈 Updating version (${command})...`);
      runCommand(`npm version ${command} --no-git-tag-version`);
      
      // Read new version
      const newPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const newVersion = newPackageJson.version;
      
      // Update changelog
      updateChangelog(newVersion);
      
      // Build package
      console.log('🔨 Building package...');
      runCommand('npm run build');
      
      // Commit changes
      console.log('💾 Committing changes...');
      runCommand('git add .');
      runCommand(`git commit -m "chore: release v${newVersion}"`);
      
      // Create and push tag
      console.log('🏷️  Creating and pushing tag...');
      runCommand(`git tag v${newVersion}`);
      runCommand('git push');
      runCommand('git push --tags');
      
      console.log(`✅ Release v${newVersion} completed!`);
      console.log('📦 The GitHub Action will now publish to npm automatically.');
      break;
      
    case 'version':
      console.log(`Current version: ${packageJson.version}`);
      break;
      
    case 'clean':
      console.log('🧹 Cleaning build artifacts...');
      runCommand('npm run clean');
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main();
} 
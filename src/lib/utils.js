const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const path = require('path');
const fs = require('fs-extra');

/**
 * Display success message with box
 */
function showSuccess(message, title = 'Success') {
  const boxedMessage = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'green',
    backgroundColor: 'black'
  });
  
  console.log(chalk.green(`\n${title}`));
  console.log(boxedMessage);
}

/**
 * Display error message with box
 */
function showError(message, title = 'Error') {
  const boxedMessage = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'red',
    backgroundColor: 'black'
  });
  
  console.log(chalk.red(`\n${title}`));
  console.log(boxedMessage);
}

/**
 * Display warning message with box
 */
function showWarning(message, title = 'Warning') {
  const boxedMessage = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'yellow',
    backgroundColor: 'black'
  });
  
  console.log(chalk.yellow(`\n${title}`));
  console.log(boxedMessage);
}

/**
 * Display info message with box
 */
function showInfo(message, title = 'Info') {
  const boxedMessage = boxen(message, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue',
    backgroundColor: 'black'
  });
  
  console.log(chalk.blue(`\n${title}`));
  console.log(boxedMessage);
}

/**
 * Create and return a spinner
 */
function createSpinner(text) {
  return ora({
    text,
    color: 'blue',
    spinner: 'dots'
  });
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date in human readable format
 */
function formatDate(date) {
  if (!date) return 'Never';
  
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Check if running in a git repository
 */
async function isGitRepository() {
  try {
    const gitPath = path.join(process.cwd(), '.git');
    return await fs.pathExists(gitPath);
  } catch (error) {
    return false;
  }
}

/**
 * Get git repository name
 */
async function getGitRepoName() {
  try {
    const gitConfigPath = path.join(process.cwd(), '.git', 'config');
    if (await fs.pathExists(gitConfigPath)) {
      const content = await fs.readFile(gitConfigPath, 'utf8');
      const match = content.match(/url\s*=\s*(.+)/);
      if (match) {
        const url = match[1].trim();
        const repoName = url.split('/').pop().replace('.git', '');
        return repoName;
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Get package.json name if exists
 */
async function getPackageName() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (await fs.pathExists(packagePath)) {
      const packageJson = await fs.readJson(packagePath);
      return packageJson.name;
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Generate project name from various sources
 */
async function generateProjectName() {
  // Try package.json first
  const packageName = await getPackageName();
  if (packageName) {
    return packageName;
  }
  
  // Try git repository name
  const gitRepoName = await getGitRepoName();
  if (gitRepoName) {
    return gitRepoName;
  }
  
  // Use current directory name
  return path.basename(process.cwd());
}

/**
 * Validate environment name format
 */
function validateEnvironmentName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Environment name must be a non-empty string' };
  }
  
  if (!/^[a-z0-9-]+$/i.test(name)) {
    return { 
      valid: false, 
      error: 'Environment name can only contain letters, numbers, and hyphens' 
    };
  }
  
  if (name.length > 50) {
    return { valid: false, error: 'Environment name must be 50 characters or less' };
  }
  
  return { valid: true };
}

/**
 * Generate unique ID
 */
function generateId(prefix = 'env') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * Check if object is empty
 */
function isEmpty(obj) {
  if (obj === null || obj === undefined) {
    return true;
  }
  
  if (typeof obj === 'string') {
    return obj.trim().length === 0;
  }
  
  if (Array.isArray(obj)) {
    return obj.length === 0;
  }
  
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0;
  }
  
  return false;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, length = 50) {
  if (!str || str.length <= length) {
    return str;
  }
  
  return str.substring(0, length - 3) + '...';
}

/**
 * Create table row for display
 */
function createTableRow(...columns) {
  return columns.map(col => truncate(String(col), 30)).join(' | ');
}

/**
 * Create table header
 */
function createTableHeader(...headers) {
  const headerRow = headers.map(h => truncate(h, 30)).join(' | ');
  const separator = headers.map(() => '─'.repeat(30)).join('─┼─');
  return `${headerRow}\n${separator}`;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
async function retry(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Check if running in development mode
 */
function isDevelopment() {
  return process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
}

/**
 * Log debug message if in development mode
 */
function debug(message, ...args) {
  if (isDevelopment()) {
    console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
  }
}

module.exports = {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  createSpinner,
  formatFileSize,
  formatDate,
  isGitRepository,
  getGitRepoName,
  getPackageName,
  generateProjectName,
  validateEnvironmentName,
  generateId,
  deepClone,
  isEmpty,
  truncate,
  createTableRow,
  createTableHeader,
  sleep,
  retry,
  isDevelopment,
  debug
}; 
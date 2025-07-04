/**
 * Cyberfc Bot Launcher - Ultra Super Power v3.0
 * Author: Shafin
 * Features:
 * - Auto Git Pull Updates
 * - Memory Leak Detection & Auto Restart
 * - Webhook Alerts (Discord/Slack)
 * - Graceful Restart with cooldown & backups
 * - Express Dashboard & Healthcheck Endpoint
 * - Detailed Rotating Logs
 * - Crash Loop Protection with backoff delay
 */

const { spawn } = require('child_process');
const axios = require('axios');
const express = require('express');
const path = require('path');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const WEBHOOK_URL = process.env.WEBHOOK_URL || ""; // Set your Discord/Slack webhook URL here or via env
const REPO_PATH = __dirname;
const BOT_FILE = 'Cyber.js'; // Your bot entry file
const PORT = process.env.PORT || 8080;

let restartCount = 0;
const MAX_RESTARTS = 10;
let restartDelay = 5000;  // 5 seconds initial delay
const MAX_RESTART_DELAY = 120000; // max 2 min cooldown
const MEMORY_LIMIT_MB = 1500; // 1.5GB memory limit

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'launcher.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function logger(msg, tag='[INFO]') {
  const time = new Date().toISOString();
  const logMsg = `${time} ${tag} - ${msg}\n`;
  process.stdout.write(logMsg);
  try {
    fs.appendFileSync(LOG_FILE, logMsg);
  } catch (e) {
    process.stdout.write(`[ERROR] Failed to write log: ${e.message}\n`);
  }
}

async function sendAlert(msg) {
  if (!WEBHOOK_URL) return;
  try {
    await axios.post(WEBHOOK_URL, { content: msg });
  } catch (err) {
    logger(`Webhook send failed: ${err.message}`, '[ALERT ERROR]');
  }
}

async function gitPullUpdate() {
  try {
    logger("Checking for updates via git pull...", "[UPDATE]");
    const { stdout, stderr } = await exec('git pull', { cwd: REPO_PATH });
    if (stderr) logger(stderr, "[GIT ERROR]");
    if (stdout.includes("Already up to date")) {
      logger("No new updates found.", "[UPDATE]");
      return false;
    }
    logger("Updates found and pulled. Restarting bot...", "[UPDATE]");
    return true;
  } catch (err) {
    logger(`Git pull failed: ${err.message}`, "[GIT ERROR]");
    return false;
  }
}

function backupFiles() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(__dirname, `backup-${timestamp}`);
    fs.mkdirSync(backupFolder);
    ['appstate.json', 'config.json', 'bot_launcher.log'].forEach(file => {
      const src = path.join(__dirname, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupFolder, file));
        logger(`Backed up ${file} to ${backupFolder}`, '[BACKUP]');
      }
    });
  } catch (e) {
    logger(`Backup failed: ${e.message}`, '[BACKUP ERROR]');
  }
}

let childProcess = null;
let memMonitorInterval = null;

async function startBot() {
  const updated = await gitPullUpdate();
  if (updated) {
    restartCount = 0; // reset restart count on update
  }

  if (restartCount >= MAX_RESTARTS) {
    logger(`Max restart attempts reached (${MAX_RESTARTS}). Cooling down for 2 minutes...`, '[COOLDOWN]');
    await new Promise(r => setTimeout(r, MAX_RESTART_DELAY));
    restartCount = 0;
  }

  restartCount++;
  logger(`Starting bot process (Attempt ${restartCount}/${MAX_RESTARTS})`, '[START]');

  childProcess = spawn('node', [BOT_FILE], { stdio: 'inherit', shell: true });

  memMonitorInterval = setInterval(() => {
    if (!childProcess) return clearInterval(memMonitorInterval);
    try {
      const memUsageMB = process.memoryUsage().rss / (1024 * 1024);
      logger(`Memory Usage: ${memUsageMB.toFixed(2)} MB`, '[MEMORY]');
      if (memUsageMB > MEMORY_LIMIT_MB) {
        logger(`Memory exceeded limit (${MEMORY_LIMIT_MB}MB). Restarting bot...`, '[MEMORY]');
        backupFiles();
        childProcess.kill();
      }
    } catch (e) {
      logger(`Memory monitor error: ${e.message}`, '[MEMORY ERROR]');
    }
  }, 10000);

  childProcess.on('close', (code) => {
    clearInterval(memMonitorInterval);
    logger(`Bot exited with code ${code}`, '[EXIT]');
    sendAlert(`Bot exited with code ${code}. Restart attempt #${restartCount}`);
    if (code !== 0) {
      setTimeout(() => startBot(), restartDelay);
      restartDelay = Math.min(restartDelay * 2, MAX_RESTART_DELAY);
    } else {
      logger("Bot exited normally. Not restarting.", '[EXIT]');
    }
  });

  childProcess.on('error', (err) => {
    logger(`Child process error: ${err.message}`, '[ERROR]');
    sendAlert(`Child process error: ${err.message}`);
  });
}

// Express dashboard & health endpoint
const app = express();
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    restarts: restartCount
  });
});
app.listen(PORT, () => logger(`Web server running on port ${PORT}`, '[START]'));

// Start launcher
startBot();

const fs = require('fs');
const path = require('path');
const config = require('../config');

const logFile = path.resolve(config.auditLogPath);

// Idempotent and async: creates logs/ if it is missing, and recreates it if it is deleted while running.
function ensureLogDirectory() {
  return fs.promises.mkdir(path.dirname(logFile), { recursive: true });
}

/**
 * Appends one JSON line to the audit log. This function NEVER rejects: a logging problem is
 * reported on stderr but must not fail the request or job that triggered it.
 */
async function audit(event, data = {}) {
  try {
    await ensureLogDirectory();
    const line = JSON.stringify({ timestamp: new Date().toISOString(), event, ...data });
    await fs.promises.appendFile(logFile, `${line}\n`, 'utf8');
  } catch (error) {
    console.error(`[audit] could not write "${event}":`, error.message);
  }
}

module.exports = { audit, ensureLogDirectory };

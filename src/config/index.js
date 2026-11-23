require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

// Business policy lives here, once. Nothing else in the codebase hard-codes these numbers.
const business = Object.freeze({
  DAILY_CAP: 12,
  WORK_START_HOUR: 9,
  WORK_END_HOUR: 17,
  SLOT_MINUTES: 30,
  BUSY_DAY_THRESHOLD_PERCENT: 80,
  STATS_WINDOW_DAYS: 7,
  REFUND_FULL_NOTICE_HOURS: 48,
  REFUND_PARTIAL_NOTICE_HOURS: 24,
  REFUND_FULL_PERCENT: 100,
  REFUND_PARTIAL_PERCENT: 50,
  REFUND_NONE_PERCENT: 0,
  WAITLIST_MAX_ATTEMPTS: 3,
});

module.exports = {
  port: toInt(process.env.PORT, 3000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medibook',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: toInt(process.env.REDIS_PORT, 6379),
  },
  auditLogPath: process.env.AUDIT_LOG_PATH || 'logs/audit.log',
  business,
};

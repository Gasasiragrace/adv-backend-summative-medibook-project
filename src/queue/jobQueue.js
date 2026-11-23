const { getClient } = require('./redis');

const JOBS_KEY = 'medibook:jobs';

const jobTypes = Object.freeze({
  CONFIRMATION: 'confirmation',
  SLOT_FREED: 'slot_freed',
});

async function enqueueJob(type, payload) {
  const job = JSON.stringify({ type, payload, enqueuedAt: new Date().toISOString() });
  await getClient().rpush(JOBS_KEY, job);
}

// Used only by the worker, with its own blocking connection. Returns null on timeout.
async function waitForJob(blockingClient, timeoutSeconds) {
  const result = await blockingClient.blpop(JOBS_KEY, timeoutSeconds);
  return result ? JSON.parse(result[1]) : null;
}

module.exports = { enqueueJob, waitForJob, jobTypes, JOBS_KEY };

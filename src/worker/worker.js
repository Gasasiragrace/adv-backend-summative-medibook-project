// Separate process: `npm run worker`. Consumes jobs from Redis; never serves HTTP.
const { createBlockingClient } = require('../queue/redis');
const { waitForJob, jobTypes } = require('../queue/jobQueue');
const waitlistQueue = require('../queue/waitlistQueue');
const waitlistService = require('../services/waitlistService');
const { audit, ensureLogDirectory } = require('../utils/auditLogger');

const POLL_TIMEOUT_SECONDS = 5;
let running = true;

async function handleJob(job) {
  switch (job.type) {
    case jobTypes.CONFIRMATION:
      // "Sending" a notification = writing it to the audit log.
      await audit('confirmation_sent', job.payload);
      break;
    case jobTypes.SLOT_FREED: {
      const outcome = await waitlistService.promoteFromWaitlist(job.payload);
      console.log(`[worker] slot_freed for doctor ${job.payload.doctorId} -> ${outcome.status}`);
      break;
    }
    default:
      console.warn(`[worker] ignoring unknown job type "${job.type}"`);
  }
}

async function main() {
  await ensureLogDirectory().catch((error) => console.error('[audit] could not create logs directory:', error.message));

  const recovered = await waitlistQueue.recoverInFlight();
  if (recovered > 0) console.log(`[worker] returned ${recovered} in-flight waitlist entries to their queues`);

  const blockingClient = createBlockingClient();
  const shutdown = () => {
    running = false;
    blockingClient.disconnect();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('[worker] started, waiting for jobs...');
  while (running) {
    try {
      const job = await waitForJob(blockingClient, POLL_TIMEOUT_SECONDS);
      if (job) await handleJob(job);
    } catch (error) {
      if (!running) break;
      console.error('[worker] job failed:', error.message);
    }
  }
  console.log('[worker] stopped');
  process.exit(0);
}

main().catch((error) => {
  console.error('[worker] fatal:', error);
  process.exit(1);
});

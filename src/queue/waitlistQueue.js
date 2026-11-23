const { getClient } = require('./redis');

/**
 * One FIFO Redis list per (doctor, day).  Reliable-queue pattern:
 *   waiting   medibook:waitlist:<doctor>:<date>             patients waiting (head = next)
 *   in flight medibook:waitlist:processing:<doctor>:<date>  claimed by the worker, booking in progress
 *   failed    medibook:waitlist:failed                      could not be booked for a permanent reason
 * A patient is always in exactly one of these places (or has an appointment), never nowhere.
 */
const PREFIX = 'medibook:waitlist';
const FAILED_KEY = `${PREFIX}:failed`;

const waitingKey = (doctorId, date) => `${PREFIX}:${doctorId}:${date}`;
const processingKey = (doctorId, date) => `${PREFIX}:processing:${doctorId}:${date}`;

async function join(entry) {
  const redis = getClient();
  const key = waitingKey(entry.doctorId, entry.date);
  const existing = await redis.lrange(key, 0, -1);
  if (existing.some((raw) => JSON.parse(raw).patientId === entry.patientId)) return { duplicate: true };
  const length = await redis.rpush(key, JSON.stringify(entry));
  return { duplicate: false, position: length };
}

async function list(doctorId, date) {
  const raws = await getClient().lrange(waitingKey(doctorId, date), 0, -1);
  return raws.map((raw, index) => ({ position: index + 1, ...JSON.parse(raw) }));
}

// Atomically moves the head of the waiting list into the in-flight list (nothing is ever popped and lost).
async function claimNext(doctorId, date) {
  const raw = await getClient().lmove(waitingKey(doctorId, date), processingKey(doctorId, date), 'LEFT', 'RIGHT');
  return raw ? { raw, entry: JSON.parse(raw) } : null;
}

async function confirm(doctorId, date, raw) {
  await getClient().lrem(processingKey(doctorId, date), 1, raw);
}

// Puts the patient back at the HEAD so they keep their place in line.
async function returnToFront(doctorId, date, raw) {
  await getClient().multi().lrem(processingKey(doctorId, date), 1, raw).lpush(waitingKey(doctorId, date), raw).exec();
}

async function deadLetter(doctorId, date, raw, reason) {
  const record = JSON.stringify({ entry: JSON.parse(raw), reason, failedAt: new Date().toISOString() });
  await getClient().multi().lrem(processingKey(doctorId, date), 1, raw).rpush(FAILED_KEY, record).exec();
}

// Crash recovery at worker start-up: anything left "in flight" goes back to the head of its waiting list.
async function recoverInFlight() {
  const redis = getClient();
  const keys = await redis.keys(`${PREFIX}:processing:*`);
  let recovered = 0;
  for (const key of keys) {
    const waiting = key.replace(`${PREFIX}:processing:`, `${PREFIX}:`);
    while (await redis.lmove(key, waiting, 'RIGHT', 'LEFT')) recovered += 1;
  }
  return recovered;
}

module.exports = { join, list, claimNext, confirm, returnToFront, deadLetter, recoverInFlight, FAILED_KEY };

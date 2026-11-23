const Redis = require('ioredis');
const config = require('../config');

// Short-lived command client for the web server: fail fast instead of hanging when Redis is down.
let sharedClient = null;
function getClient() {
  if (!sharedClient) {
    sharedClient = new Redis({ ...config.redis, maxRetriesPerRequest: 1, retryStrategy: (times) => Math.min(times * 200, 2000) });
    sharedClient.on('error', (error) => console.error('[redis] web client error:', error.message));
  }
  return sharedClient;
}

// Dedicated connection for the worker's blocking BLPOP (a blocked connection cannot run other commands).
function createBlockingClient() {
  const client = new Redis({ ...config.redis, maxRetriesPerRequest: null });
  client.on('error', (error) => console.error('[redis] worker client error:', error.message));
  return client;
}

module.exports = { getClient, createBlockingClient };

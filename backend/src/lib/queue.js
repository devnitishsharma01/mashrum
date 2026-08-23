"use strict";

const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const { env } = require("../config/env");

const handlers = new Map();
const queues = new Map();
const workers = [];

let mode = "memory";
let connection = null;
let initialized = false;

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 500,
  removeOnFail: 1000,
};

function getQueueMode() {
  return mode;
}

function registerJob(name, handler) {
  handlers.set(name, handler);
}

function enqueueInMemory(name, payload) {
  const handler = handlers.get(name);
  if (!handler) {
    console.error(`No handler registered for job: ${name}`);
    return;
  }
  setImmediate(() => {
    handler(payload).catch((error) => {
      console.error(`Job ${name} failed:`, error);
    });
  });
}

function getQueue(name) {
  let queue = queues.get(name);
  if (!queue) {
    if (!connection) {
      throw new Error("Redis connection is not ready");
    }
    queue = new Queue(name, {
      connection,
      defaultJobOptions,
    });
    queues.set(name, queue);
  }
  return queue;
}

async function initQueue() {
  if (initialized) return mode;
  initialized = true;

  if (env.QUEUE_DRIVER === "memory") {
    mode = "memory";
    console.log("[queue] Using in-process memory driver");
    return mode;
  }

  try {
    const redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.ping();
    connection = redis;
    mode = "redis";

    for (const [name, handler] of handlers.entries()) {
      getQueue(name);
      const worker = new Worker(
        name,
        async (job) => {
          await handler(job.data);
        },
        {
          connection: redis.duplicate(),
          concurrency: name === "whatsapp.webhook" ? 5 : 3,
        },
      );
      worker.on("failed", (job, error) => {
        console.error(
          `[queue] Job ${name}${job ? `:${job.id}` : ""} failed:`,
          error,
        );
      });
      workers.push(worker);
    }

    console.log(`[queue] Using Redis/BullMQ at ${env.REDIS_URL}`);
    return mode;
  } catch (error) {
    if (env.QUEUE_DRIVER === "redis") {
      throw error;
    }
    console.warn(
      "[queue] Redis unavailable, falling back to in-process memory driver:",
      error instanceof Error ? error.message : error,
    );
    mode = "memory";
    if (connection) {
      connection.disconnect();
      connection = null;
    }
    return mode;
  }
}

async function enqueue(name, payload) {
  if (!handlers.has(name)) {
    console.error(`No handler registered for job: ${name}`);
    return;
  }

  if (mode === "memory" || !connection) {
    enqueueInMemory(name, payload);
    return;
  }

  try {
    await getQueue(name).add(name, payload, {
      jobId:
        name === "whatsapp.webhook" &&
        payload &&
        typeof payload === "object" &&
        "providerEventId" in payload
          ? `wa-${String(payload.providerEventId).replaceAll(":", "-")}`
          : undefined,
    });
  } catch (error) {
    console.error(`[queue] Failed to enqueue ${name}, falling back to memory:`, error);
    enqueueInMemory(name, payload);
  }
}

async function shutdownQueue() {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}

module.exports = {
  getQueueMode,
  registerJob,
  initQueue,
  enqueue,
  shutdownQueue,
};

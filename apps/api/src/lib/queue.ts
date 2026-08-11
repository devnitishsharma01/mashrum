import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";

type JobHandler<T> = (payload: T) => Promise<void>;

const handlers = new Map<string, JobHandler<unknown>>();
const queues = new Map<string, Queue>();
const workers: Worker[] = [];

let mode: "redis" | "memory" = "memory";
let connection: IORedis | null = null;
let initialized = false;

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 500,
  removeOnFail: 1000,
};

export function getQueueMode(): "redis" | "memory" {
  return mode;
}

export function registerJob<T>(name: string, handler: JobHandler<T>): void {
  handlers.set(name, handler as JobHandler<unknown>);
}

function enqueueInMemory<T>(name: string, payload: T): void {
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

function getQueue(name: string): Queue {
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

export async function initQueue(): Promise<"redis" | "memory"> {
  if (initialized) return mode;
  initialized = true;

  if (env.QUEUE_DRIVER === "memory") {
    mode = "memory";
    console.log("[queue] Using in-process memory driver");
    return mode;
  }

  try {
    const redis = new IORedis(env.REDIS_URL, {
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

export async function enqueue<T>(name: string, payload: T): Promise<void> {
  if (!handlers.has(name)) {
    console.error(`No handler registered for job: ${name}`);
    return;
  }

  if (mode === "memory" || !connection) {
    enqueueInMemory(name, payload);
    return;
  }

  try {
    await getQueue(name).add(name, payload as object, {
      // BullMQ rejects custom IDs containing ':'
      jobId:
        name === "whatsapp.webhook" &&
        payload &&
        typeof payload === "object" &&
        "providerEventId" in payload
          ? `wa-${String(
              (payload as { providerEventId: string }).providerEventId,
            ).replaceAll(":", "-")}`
          : undefined,
    });
  } catch (error) {
    console.error(`[queue] Failed to enqueue ${name}, falling back to memory:`, error);
    enqueueInMemory(name, payload);
  }
}

export async function shutdownQueue(): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}

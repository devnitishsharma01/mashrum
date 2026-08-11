type JobHandler<T> = (payload: T) => Promise<void>;

const handlers = new Map<string, JobHandler<unknown>>();

export function registerJob<T>(name: string, handler: JobHandler<T>): void {
  handlers.set(name, handler as JobHandler<unknown>);
}

/** In-process async queue (BullMQ can replace this when Redis is available). */
export function enqueue<T>(name: string, payload: T): void {
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

import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import type { BaseClass } from '../../src/sim/party/partyDefs';
import type { Run } from './delveBotRun';

interface Job { id: number; seed: number; comp: BaseClass[]; resolve: (r: Run) => void; reject: (e: Error) => void }
export function botPool(size = 3) {
  const queue: Job[] = [];
  let next = 0;
  const slots = Array.from({ length: size }, () => {
    const worker = new Worker(resolve('tests/bot/delveBotWorker.mjs'));
    const slot: { worker: Worker; job?: Job } = { worker };
    worker.on('message', (message: { id: number; result?: Run; error?: string }) => {
      const job = slot.job;
      slot.job = undefined;
      if (message.error || !message.result) job?.reject(new Error(message.error ?? 'missing worker result'));
      else job?.resolve(message.result);
      pump();
    });
    worker.on('error', (error) => { slot.job?.reject(error); slot.job = undefined; });
    return slot;
  });
  function pump() {
    for (const slot of slots) if (!slot.job && queue.length) {
      const job = queue.shift()!;
      slot.job = job;
      slot.worker.postMessage({ id: job.id, seed: job.seed, comp: job.comp });
    }
  }
  return {
    run(seed: number, comp: BaseClass[]): Promise<Run> {
      return new Promise((resolve, reject) => { queue.push({ id: next++, seed, comp, resolve, reject }); pump(); });
    },
    async close() { await Promise.all(slots.map((s) => s.worker.terminate())); },
  };
}

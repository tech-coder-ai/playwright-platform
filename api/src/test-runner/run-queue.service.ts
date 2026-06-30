import { Injectable } from '@nestjs/common';

@Injectable()
export class RunQueueService {
  private readonly maxConcurrent = 2;
  private active = 0;
  private readonly queue: Array<() => Promise<void>> = [];

  enqueue(job: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await job();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      this.drain();
    });
  }

  getStats() {
    return { active: this.active, queued: this.queue.length, maxConcurrent: this.maxConcurrent };
  }

  private drain() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      this.active++;
      job()
        .catch(() => undefined)
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }
}

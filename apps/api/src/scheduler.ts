// Sincronizare programată. Cu REDIS_URL: BullMQ (joburi repetabile pe canal, reîncercări, un singur
// worker activ chiar dacă rulează mai multe instanțe). Fără Redis: temporizator intern, bun pentru dev.

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@adonis/database";
import { refreshAlerts, syncChannel } from "@adonis/core";

const QUEUE = "adonis-sync";

@Injectable()
export class Scheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Sincronizare");
  private queue?: Queue;
  private worker?: Worker;
  private timers: NodeJS.Timeout[] = [];
  mode: "bullmq" | "intern" | "oprit" = "oprit";

  async onModuleInit() {
    if (process.env.SYNC_DISABLED === "true") return;
    const channels = await prisma.channel.findMany({ where: { active: true, syncType: { not: "none" } } });
    if (process.env.REDIS_URL) {
      const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
      this.queue = new Queue(QUEUE, { connection });
      for (const c of channels) {
        await this.queue.upsertJobScheduler(`channel:${c.id}`, { every: c.syncIntervalMin * 60_000 }, { name: "sync", data: { channelId: c.id }, opts: { attempts: 3, backoff: { type: "exponential", delay: 30_000 } } });
      }
      await this.queue.upsertJobScheduler("daily-alerts", { pattern: "0 7 * * *", tz: "Europe/Bucharest" }, { name: "alerts", data: {} });
      this.worker = new Worker(
        QUEUE,
        async (job) => {
          if (job.name === "alerts") return refreshAlerts();
          const r = await syncChannel(job.data.channelId);
          await refreshAlerts();
          return r;
        },
        { connection, concurrency: 1 },
      );
      this.worker.on("failed", (job, err) => this.log.warn(`Job ${job?.id} eșuat: ${err.message}`));
      this.mode = "bullmq";
    } else {
      for (const c of channels) {
        this.timers.push(setInterval(() => void this.runNow(c.id), c.syncIntervalMin * 60_000));
      }
      this.timers.push(setInterval(() => void refreshAlerts(), 6 * 3600_000));
      this.mode = "intern";
    }
    this.log.log(`${channels.length} canale programate (${this.mode}).`);
    void refreshAlerts().catch((e) => this.log.warn(`Alerte: ${(e as Error).message}`));
  }

  async runNow(channelId: string) {
    if (this.queue) {
      const job = await this.queue.add("sync", { channelId }, { attempts: 3, backoff: { type: "exponential", delay: 30_000 } });
      return { queued: true, jobId: job.id };
    }
    try {
      const r = await syncChannel(channelId);
      await refreshAlerts();
      return { queued: false, ...r };
    } catch (e) {
      this.log.error((e as Error).message);
      return { queued: false, error: (e as Error).message };
    }
  }

  async onModuleDestroy() {
    this.timers.forEach(clearInterval);
    await this.worker?.close();
    await this.queue?.close();
  }
}

import crypto from 'crypto';

// In-memory job store - in production, this would use a database
const jobStore = new Map();

class JobManager {
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredJobs();
    }, 30 * 60 * 1000); // Clean up every 30 minutes
  }

  createJob(jobId, payload, status = 'pending', progress = 0) {
    const job = {
      id: jobId,
      status,
      progress,
      payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null,
      error: null
    };

    jobStore.set(jobId, job);
    return job;
  }

  getJob(jobId) {
    return jobStore.get(jobId) || null;
  }

  updateJob(jobId, updates) {
    const job = jobStore.get(jobId);
    if (!job) return null;

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    jobStore.set(jobId, updatedJob);
    return updatedJob;
  }

  deleteJob(jobId) {
    return jobStore.delete(jobId);
  }

  cleanupExpiredJobs() {
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    for (const [jobId, job] of jobStore) {
      const jobAge = now - new Date(job.createdAt).getTime();
      if (jobAge > THIRTY_DAYS_MS) {
        this.deleteJob(jobId);
      }
    }
  }

  // Method to trigger webhook when job completes
  async triggerWebhook(jobId, webhookUrl, jobData) {
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          status: jobData.status,
          result: jobData.result,
          error: jobData.error,
          completedAt: new Date().toISOString()
        })
      });

      console.log(`Webhook triggered for job ${jobId}, status: ${response.status}`);
    } catch (error) {
      console.error(`Failed to trigger webhook for job ${jobId}:`, error);
    }
  }
}

export const jobManager = new JobManager();

// Generate a unique job ID
export function generateJobId() {
  return `job_${crypto.randomUUID()}`;
}
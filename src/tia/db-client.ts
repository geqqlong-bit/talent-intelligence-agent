// @ts-nocheck
export async function createPgExecutor(config = {}) {
  const { pgUrl, max = 8, idleTimeoutMillis = 30000 } = config;
  if (!pgUrl) {
    throw new Error('PostgreSQL URL is required.');
  }

  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: pgUrl,
    max,
    idleTimeoutMillis
  });

  return {
    async query(text, params = []) {
      return pool.query(text, params);
    },
    async close() {
      await pool.end();
    }
  };
}

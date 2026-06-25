import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Return DATE and TIMESTAMP as plain strings instead of JS Date objects
pg.types.setTypeParser(1082, (val) => val); // DATE
pg.types.setTypeParser(1114, (val) => val); // TIMESTAMP
pg.types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  onConnect: async (client) => {
    await client.query(`SET statement_timeout = '5s'`)
  },
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client:', err.message);
});

export default pool;

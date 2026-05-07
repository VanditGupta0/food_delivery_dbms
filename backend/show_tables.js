require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  .then(res => {
    console.log('\n--- Tables in your Database ---\n');
    res.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });
    console.log(`\n  Total: ${res.rows.length} tables\n`);
    pool.end();
  })
  .catch(err => {
    console.error('Error:', err.message);
    pool.end();
  });

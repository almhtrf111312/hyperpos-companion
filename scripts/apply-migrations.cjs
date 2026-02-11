const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('Missing SUPABASE_DB_URL');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

async function main() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  const parsed = new URL(DB_URL);
  const password = process.env.SUPABASE_DB_PASSWORD || decodeURIComponent(parsed.password);
  const config = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432'),
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  };

  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log(`User: ${config.user}`);
  console.log(`Database: ${config.database}`);
  console.log(`Password length: ${config.password.length}`);

  console.log('\nConnecting...');
  const client = new Client(config);

  try {
    await client.connect();
    const res = await client.query('SELECT current_database()');
    console.log(`Connected! (db: ${res.rows[0].current_database})\n`);
  } catch (err) {
    console.error(`Connection failed: ${err.message}`);
    console.error('\nPlease verify:');
    console.error('1. The database password is correct');
    console.error('2. You are using the Session pooler or Transaction pooler URL');
    console.error('3. The Supabase project is active (not paused)');
    process.exit(1);
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8').trim();

    if (!sql) {
      console.log(`[SKIP] ${file} - empty`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`[RUN] ${file}... `);
      await client.query(sql);
      console.log('OK');
      success++;
    } catch (error) {
      const shortErr = error.message.split('\n')[0];
      console.log(`ERROR: ${shortErr}`);
      errors.push({ file, error: shortErr });
      failed++;
    }
  }

  console.log('\n---');
  console.log(`Results: ${success} success, ${failed} failed, ${skipped} skipped`);

  if (errors.length > 0) {
    console.log('\nError details:');
    errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
  }

  await client.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

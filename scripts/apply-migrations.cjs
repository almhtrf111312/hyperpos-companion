const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PROJECT_REF = 'vdoncnrhtqxnxtftefod';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!DB_PASSWORD) {
  console.error('Missing SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const regions = [
  'us-east-1', 'eu-central-1', 'eu-west-1', 'us-west-1', 
  'ap-southeast-1', 'ca-central-1', 'ap-northeast-1',
  'ap-south-1', 'sa-east-1', 'eu-west-2', 'us-east-2',
  'ap-northeast-2', 'eu-west-3', 'ap-southeast-2',
];

async function tryConnect(config, name) {
  const client = new Client(config);
  await client.connect();
  const res = await client.query('SELECT current_database()');
  console.log(`CONNECTED! (db: ${res.rows[0].current_database})`);
  return client;
}

async function main() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);
  console.log(`Password length: ${DB_PASSWORD.length} chars`);
  console.log('Trying to connect to Supabase PostgreSQL...\n');

  let connectedClient = null;

  for (const region of regions) {
    if (connectedClient) break;

    const configs = [
      {
        name: `Session ${region} (5432)`,
        config: {
          host: `aws-0-${region}.pooler.supabase.com`,
          port: 5432,
          database: 'postgres',
          user: `postgres.${PROJECT_REF}`,
          password: DB_PASSWORD,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 8000,
        }
      },
      {
        name: `Transaction ${region} (6543)`,
        config: {
          host: `aws-0-${region}.pooler.supabase.com`,
          port: 6543,
          database: 'postgres',
          user: `postgres.${PROJECT_REF}`,
          password: DB_PASSWORD,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 8000,
        }
      },
    ];

    for (const c of configs) {
      try {
        process.stdout.write(`Trying ${c.name}... `);
        connectedClient = await tryConnect(c.config, c.name);
        break;
      } catch (e) {
        console.log(`Failed (${e.message.substring(0, 60)})`);
      }
    }
  }

  if (!connectedClient) {
    console.error('\nAll connection methods failed.');
    console.error('The database password might be incorrect.');
    console.error('Please check: Supabase Dashboard > Settings > Database > Database password');
    process.exit(1);
  }

  console.log('---');
  await runMigrations(connectedClient, files);
  await connectedClient.end();
}

async function runMigrations(client, files) {
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

  console.log('---');
  console.log(`Results: ${success} success, ${failed} failed, ${skipped} skipped`);

  if (errors.length > 0) {
    console.log('\nError details:');
    errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

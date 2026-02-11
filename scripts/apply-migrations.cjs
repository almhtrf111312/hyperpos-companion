const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error('Missing SUPABASE_DB_URL');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

function extractFromUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432'),
      database: parsed.pathname.slice(1),
    };
  } catch (e) {
    return null;
  }
}

function extractProjectRef(url) {
  const hostMatch = url.match(/db\.([^.]+)\.supabase\.co/);
  if (hostMatch) return hostMatch[1];
  const userMatch = url.match(/postgres\.([^:@]+)/);
  if (userMatch) return userMatch[1];
  return null;
}

async function main() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  const parsed = extractFromUrl(DB_URL);
  if (!parsed) {
    console.error('Could not parse DB URL');
    process.exit(1);
  }

  const projectRef = extractProjectRef(DB_URL);
  console.log(`Project ref: ${projectRef}`);
  console.log(`User: ${parsed.user}`);
  console.log(`Host: ${parsed.host}`);
  console.log(`Port: ${parsed.port}`);
  console.log(`Password length: ${parsed.password.length}`);

  let connectedClient = null;

  console.log('\n1. Trying direct connection...');
  try {
    const client = new Client({
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      password: parsed.password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    await client.connect();
    const res = await client.query('SELECT current_database()');
    console.log(`Connected! (db: ${res.rows[0].current_database})`);
    connectedClient = client;
  } catch (err) {
    console.log(`Failed: ${err.message}`);
  }

  if (!connectedClient && projectRef) {
    console.log('\n2. Trying pooler connections...');
    const regions = [
      'us-east-1', 'eu-central-1', 'eu-west-1', 'us-west-1',
      'ap-southeast-1', 'ca-central-1', 'ap-northeast-1',
      'ap-south-1', 'sa-east-1', 'eu-west-2', 'us-east-2',
      'ap-northeast-2',
    ];

    for (const region of regions) {
      if (connectedClient) break;
      for (const port of [5432, 6543]) {
        try {
          process.stdout.write(`  ${region}:${port}... `);
          const client = new Client({
            host: `aws-0-${region}.pooler.supabase.com`,
            port,
            database: 'postgres',
            user: `postgres.${projectRef}`,
            password: parsed.password,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 8000,
          });
          await client.connect();
          console.log('CONNECTED!');
          connectedClient = client;
          break;
        } catch (e) {
          console.log(`Failed`);
        }
      }
    }
  }

  if (!connectedClient) {
    console.log('\n3. Trying with raw connection string...');
    try {
      const client = new Client({
        connectionString: DB_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
      await client.connect();
      console.log('Connected with raw string!');
      connectedClient = client;
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }

  if (!connectedClient) {
    console.error('\nAll connection methods failed.');
    console.error('Please make sure the connection string from Supabase Dashboard > Connect is correct.');
    console.error('Try using the "Session pooler" connection string (not Direct).');
    process.exit(1);
  }

  console.log('\n---');
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
  console.log(`\nResults: ${success} success, ${failed} failed, ${skipped} skipped`);

  if (errors.length > 0) {
    console.log('\nError details:');
    errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function executeSqlDirect(sql) {
  const response = await fetch(`${SUPABASE_URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function executeViaSqlEndpoint(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: sql,
  });
  return response;
}

async function runMigration(sql, filename) {
  const pgMeta = `${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/pg/query`;
  
  const response = await fetch(pgMeta, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'X-Connection-Encrypted': 'true',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result;
}

async function main() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('---');

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8').trim();
    
    if (!sql) {
      console.log(`[SKIP] ${file} - empty`);
      skipped++;
      continue;
    }

    try {
      console.log(`[RUN] ${file}...`);
      const result = await runMigration(sql, file);
      console.log(`[OK] ${file}`);
      success++;
    } catch (error) {
      console.error(`[ERROR] ${file}: ${error.message}`);
      failed++;
    }
  }

  console.log('---');
  console.log(`Results: ${success} success, ${failed} failed, ${skipped} skipped`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

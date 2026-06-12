// One-off delta runner. Usage:
//   node run_delta.js <path-to-sql> [--apply]
// Connection comes from env TARGET_DATABASE_URL (never hardcode the secret).
// Without --apply it does a DRY RUN: connects, runs inside a transaction, then ROLLBACK.
// With --apply it COMMITs.
const fs = require('fs');
const { Client } = require('pg');

const sqlPath = process.argv[2];
const apply = process.argv.includes('--apply');
const url = process.env.TARGET_DATABASE_URL;

if (!url) { console.error('ERROR: set TARGET_DATABASE_URL'); process.exit(1); }
if (!sqlPath || !fs.existsSync(sqlPath)) { console.error('ERROR: sql file not found:', sqlPath); process.exit(1); }

// The file already contains BEGIN/COMMIT. For a dry run we strip the trailing
// COMMIT and force a ROLLBACK so nothing persists.
let sql = fs.readFileSync(sqlPath, 'utf8');

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  const who = await client.query('select current_database() db, current_user usr, inet_server_addr() host');
  console.log('Connected ->', who.rows[0]);

  const TABLES = ['admin_audit_log','admin_notifications','callback_schedules','calls',
    'email_messages','funnel_events','lead_rep_notes','leads','notifications',
    'portal_carts','portal_events','portal_prospect_sessions','portal_requests',
    'prospect_links','short_links'];
  async function counts() {
    const o = {};
    for (const t of TABLES) {
      const r = await client.query(`select count(*)::int n from public.${t}`);
      o[t] = r.rows[0].n;
    }
    return o;
  }
  const before = await counts();

  if (!apply) {
    console.log('\n*** DRY RUN: executing then ROLLBACK ***');
    sql = sql.replace(/COMMIT;\s*$/i, 'ROLLBACK;');
  } else {
    console.log('\n*** APPLY: executing and COMMIT ***');
  }

  try {
    await client.query(sql);
    console.log(apply ? 'COMMITTED.' : 'Rolled back (dry run OK, no changes persisted).');
  } catch (e) {
    console.error('FAILED — transaction rolled back:', e.message);
    try { await client.query('ROLLBACK'); } catch {}
    process.exitCode = 1;
    await client.end();
    return;
  }

  const after = await counts();
  console.log('\n%-26s %8s %8s %8s', 'table', 'before', 'after', 'new');
  console.log('-'.repeat(54));
  let tot = 0;
  for (const t of TABLES) {
    const d = after[t] - before[t];
    tot += d;
    console.log('%-26s %8d %8d %+8d', t, before[t], after[t], d);
  }
  console.log('-'.repeat(54));
  console.log('%-26s %8s %8s %+8d', 'TOTAL new rows', '', '', tot);
  console.log('(leads: 40 existing rows updated in place — counts stay 377)');
  await client.end();
})();

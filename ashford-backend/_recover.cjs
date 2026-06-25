const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:jeiAVGkKzJAGeVhfyZIiYdwxvoBEakLA@acela.proxy.rlwy.net:27719/railway', ssl: { rejectUnauthorized: false } });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ptUrl = (lead) => {
  const m = (lead.notes||'').match(/PsychologyToday:\s*(https?:\/\/\S+)/i);
  if (m) return m[1].replace(/[)\s]+$/,'');
  if ((lead.current_website||'').includes('psychologytoday.com')) return lead.current_website;
  return null;
};
const extract = (meta) => {
  if (!meta) return null;
  let m = meta.match(/\(\d{3}\)\s*\d{3}-\d{4},?\s*([\s\S]+)$/);
  if (m) return m[1].trim();
  m = meta.match(/\b\d{5}(?:-\d{4})?,\s*([\s\S]+)$/);
  return m ? m[1].trim() : null;
};
const decode = (s) => s.replace(/&amp;/g,'&').replace(/&#39;|&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&rsquo;/g,'’').replace(/&nbsp;/g,' ');
(async () => {
  await c.connect();
  const r = await c.query("select id, name, notes, current_website from leads where profile_blurb='' order by id");
  const leads = r.rows;
  let recovered=0, nourl=0, fetchfail=0, extractfail=0;
  for (const lead of leads) {
    const url = ptUrl(lead);
    if (!url) { nourl++; continue; }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept':'text/html' } });
      if (!res.ok) { fetchfail++; await new Promise(r=>setTimeout(r,300)); continue; }
      const html = await res.text();
      const md = (html.match(/<meta name="description" content="([^"]*)"/i)||[])[1];
      let stmt = extract(md);
      if (stmt) stmt = decode(stmt).slice(0,4000).trim();
      if (!stmt || stmt.length < 40) { extractfail++; await new Promise(r=>setTimeout(r,300)); continue; }
      await c.query("update leads set profile_blurb=$1, updated_at=now() where id=$2 and profile_blurb=''", [stmt, lead.id]);
      recovered++;
      if (recovered % 25 === 0) console.log('...recovered', recovered);
    } catch(e) { fetchfail++; }
    await new Promise(r=>setTimeout(r,300));
  }
  console.log('=== DONE === total', leads.length, '| recovered', recovered, '| no-url', nourl, '| fetch-fail', fetchfail, '| extract-fail', extractfail);
  await c.end();
})().catch(e=>{console.error('FATAL', e.message);process.exit(1);});

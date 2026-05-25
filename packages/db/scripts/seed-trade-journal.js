'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CSV_PATH = path.resolve(__dirname, '../../../reference/trade-history.csv');

const METHODS = ['GEM', 'MISC', '3*3', 'AK47', 'A40', 'MIM1', 'MIM2', 'MM', 'SWING', 'GROW', 'VIM', 'POS'];

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse DD-MM-YY date string to YYYY-MM-DD
function parseDate(str) {
  if (!str || !str.trim()) return null;
  const parts = str.trim().split('-');
  if (parts.length !== 3) return null;
  const [dd, mm, yy] = parts;
  const year = parseInt(yy, 10) < 50 ? 2000 + parseInt(yy, 10) : 1900 + parseInt(yy, 10);
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// Parse Indian number format (e.g., "2,45,167" or "14,989.00") to float
function parseNumber(str) {
  if (!str || !str.trim()) return null;
  const n = parseFloat(str.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const records = [];

  // Skip header row (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 6) continue;

    if (isNaN(parseInt(cols[0], 10))) continue;

    records.push({
      method:     cols[1] || '',
      account:    cols[2] || '',
      instrument: cols[3] || '',
      qty:        parseNumber(cols[4]),
      buy_price:  parseNumber(cols[5]),
      sell_price: parseNumber(cols[6]),
      stop_loss:  parseNumber(cols[7]),
      buy_date:   parseDate(cols[8]),
      sell_date:  parseDate(cols[9]),
    });
  }
  return records;
}

async function main() {
  const client = new Client({
    host:     process.env.DB_HOST     || process.env.POSTGRES_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.DB_NAME     || process.env.POSTGRES_DB       || 'ascend',
    user:     process.env.DB_USER     || process.env.POSTGRES_USER     || 'anand',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'password',
  });

  await client.connect();
  console.log('Connected to database');

  try {
    // Truncate existing data (idempotent)
    await client.query('TRUNCATE TABLE trade_journal RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE trade_methods RESTART IDENTITY CASCADE');
    console.log('Cleared existing trade data');

    // Insert methods
    const now = new Date().toISOString();
    for (const method of METHODS) {
      await client.query(
        'INSERT INTO trade_methods (name, "createdAt", "updatedAt") VALUES ($1, $2, $3)',
        [method, now, now]
      );
    }
    console.log(`Inserted ${METHODS.length} trade methods`);

    // Parse CSV
    const records = parseCSV(CSV_PATH);
    console.log(`Parsed ${records.length} trade records from CSV`);

    // Batch insert trade journal (100 rows at a time)
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      for (const r of batch) {
        await client.query(
          `INSERT INTO trade_journal
            (method, account, instrument, qty, buy_price, sell_price, stop_loss, buy_date, sell_date, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [r.method, r.account, r.instrument, r.qty, r.buy_price, r.sell_price, r.stop_loss, r.buy_date, r.sell_date, now, now]
        );
      }
      inserted += batch.length;
      process.stdout.write(`\rInserted ${inserted}/${records.length} rows...`);
    }
    console.log(`\nDone! Inserted ${inserted} trade journal records.`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

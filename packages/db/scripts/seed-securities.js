'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CSV_PATH = path.resolve(__dirname, '../../../securities.csv');

const MONTH_MAP = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function parseDate(str) {
  if (!str) return null;
  const s = str.trim();
  if (!s) return null;
  // Expected format: DD-MMM-YYYY e.g. 06-OCT-2008
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const [dd, mon, yyyy] = parts;
  const mm = MONTH_MAP[mon.toUpperCase()];
  if (!mm) return null;
  return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
}

function parseNumber(str) {
  if (!str) return null;
  const s = str.trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    if (cols.length < 8) continue;

    const symbol       = cols[0].trim();
    const nameOfCompany = cols[1].trim();
    const series       = cols[2].trim();
    const dateOfListing = parseDate(cols[3]);
    const paidUpValue  = parseNumber(cols[4]);
    const marketLot    = parseNumber(cols[5]);
    const isinNumber   = cols[6].trim();
    const faceValue    = parseNumber(cols[7]);

    if (!symbol || !nameOfCompany || !series || !isinNumber) continue;

    records.push({ symbol, nameOfCompany, series, dateOfListing, paidUpValue, marketLot, isinNumber, faceValue });
  }

  return records;
}

async function main() {
  const client = new Client({
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'ascend',
    user:     process.env.DB_USER     || 'anand',
    password: process.env.DB_PASSWORD || 'password',
  });

  await client.connect();
  console.log('Connected to database');

  const records = parseCSV(CSV_PATH);
  console.log(`Parsed ${records.length} records from CSV`);

  let inserted = 0;
  let skipped  = 0;

  for (const r of records) {
    const res = await client.query(
      `INSERT INTO securities
         (symbol, name_of_company, series, date_of_listing, paid_up_value, market_lot, isin_number, face_value, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [r.symbol, r.nameOfCompany, r.series, r.dateOfListing, r.paidUpValue, r.marketLot, r.isinNumber, r.faceValue]
    );
    if (res.rowCount > 0) inserted++;
    else skipped++;
  }

  await client.end();
  console.log(`Done — inserted: ${inserted}, skipped (duplicates): ${skipped}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

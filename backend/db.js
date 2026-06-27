import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbType = 'sqlite';
let pool = null;
let sqliteDb = null;

const dbUrl = process.env.DATABASE_URL;

if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
  dbType = 'postgres';
  // Normalize postgres:// to postgresql:// for pg client compatibility
  const connectionString = dbUrl.startsWith('postgres://') 
    ? dbUrl.replace('postgres://', 'postgresql://') 
    : dbUrl;
    
  pool = new pg.Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('Database connected: PostgreSQL Pool');
} else {
  dbType = 'sqlite';
  const dbPath = path.resolve(__dirname, '../newspulse.db');
  
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('SQLite connection error:', err);
    } else {
      console.log(`Database connected: SQLite (${dbPath})`);
      sqliteDb.run('PRAGMA foreign_keys = ON;');
    }
  });
}

/**
 * Unified Query interface.
 * Converts PostgreSQL parameter placeholders ($1, $2...) to SQLite placeholders (?)
 * and returns results in a consistent format: { rows: [...] }
 */
export async function query(text, params = []) {
  if (dbType === 'postgres') {
    const res = await pool.query(text, params);
    return res;
  } else {
    return new Promise((resolve, reject) => {
      // Convert Postgres-style placeholder ($1, $2, ...) to SQLite-style (?)
      const normalizedQuery = text.replace(/\$[0-9]+/g, '?');
      
      // Heuristic: If it's a SELECT query, use .all, otherwise .run
      const isSelect = normalizedQuery.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        sqliteDb.all(normalizedQuery, params, (err, rows) => {
          if (err) {
            console.error('SQLite SELECT Error:', err, 'Query:', normalizedQuery);
            return reject(err);
          }
          resolve({ rows: rows || [] });
        });
      } else {
        sqliteDb.run(normalizedQuery, params, function (err) {
          if (err) {
            console.error('SQLite RUN Error:', err, 'Query:', normalizedQuery);
            return reject(err);
          }
          // Match PostgreSQL return structure
          resolve({ 
            rows: [], 
            rowCount: this.changes,
            lastID: this.lastID 
          });
        });
      }
    });
  }
}

export function getDbType() {
  return dbType;
}

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { createClient } = require("@libsql/client");

let db;

function getDb() {
  if (db) return db;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL environment variable");
  }

  if (!authToken) {
    throw new Error("Missing TURSO_AUTH_TOKEN environment variable");
  }

  db = createClient({ url, authToken });
  return db;
}

async function get(sql, args = []) {
  const result = await getDb().execute({ sql, args });
  return result.rows[0];
}

async function all(sql, args = []) {
  const result = await getDb().execute({ sql, args });
  return result.rows;
}

async function run(sql, args = []) {
  const result = await getDb().execute({ sql, args });
  return {
    // Turso returns this as a BigInt — JSON.stringify cannot
    // serialize BigInt, so convert it to a plain Number here.
    lastInsertRowid:
      result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
    changes: result.rowsAffected,
  };
}

async function init() {
  // A single Turso batch avoids five separate network round trips whenever a
  // Vercel function starts. Each statement remains idempotent and therefore
  // safe for both existing and new databases.
  await getDb().batch([
    { sql: `
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    ` },
    { sql: `
      CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          supplier TEXT,
          price REAL,
          quantity INTEGER,
          category TEXT,
          description TEXT,
          image TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    ` },
    { sql: `
      CREATE TABLE IF NOT EXISTS suppliers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          image TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    ` },
    { sql: `
      CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          store_name TEXT,
          email TEXT,
          phone TEXT
      )
    ` },
    {
      sql: `
        INSERT INTO settings (store_name, email, phone)
        SELECT ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM settings)
      `,
      args: ["Grocery IMS", "admin@gmail.com", "9812345678"]
    }
  ]);

  console.log("✅ Database connected successfully (Turso)");
}

module.exports = { getDb, get, all, run, init };

require("dotenv").config();
const { createClient } = require("@libsql/client");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function get(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows[0];
}

async function all(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows;
}

async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return {
    // Turso returns this as a BigInt — JSON.stringify cannot
    // serialize BigInt, so convert it to a plain Number here.
    lastInsertRowid:
      result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
    changes: result.rowsAffected,
  };
}

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
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
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_name TEXT,
        email TEXT,
        phone TEXT
    );
  `);

  // Seed default settings row if none exists yet
  const settings = await get("SELECT * FROM settings LIMIT 1");

  if (!settings) {
    await run(
      `INSERT INTO settings (store_name, email, phone) VALUES (?, ?, ?)`,
      ["Grocery IMS", "admin@gmail.com", "9812345678"]
    );
  }

  console.log("✅ Database connected successfully (Turso)");
}

module.exports = { db, get, all, run, init };
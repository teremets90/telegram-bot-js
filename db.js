import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

console.log('Файл bot.js запущен');

// Открытие базы и экспорт функций
export async function openDb() {
  return open({
    filename: './users.db',
    driver: sqlite3.Database
  });
}

// Создание таблицы (один раз при старте)
export async function initDb() {
  const db = await openDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      name TEXT,
      phone TEXT,
      menu_link TEXT,
      agreed INTEGER,
      payment_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.close();
}

// Сохранить пользователя
export async function saveUser(user) {
  const db = await openDb();
  await db.run(
    `INSERT INTO users (telegram_id, name, phone, menu_link, agreed, payment_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    user.telegram_id, user.name, user.phone, user.menu_link, user.agreed ? 1 : 0, user.payment_status || 'pending'
  );
  await db.close();
}

console.log('Бот запускается...');

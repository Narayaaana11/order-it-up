const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbFiles = ['./order-it-up.db', './oiu.db'];

const accounts = [
  { name: 'Store Owner', email: 'admin@orderitup.com', role: 'owner', password: 'admin12345', pin: '1234' },
  { name: 'Store Manager', email: 'manager@orderitup.com', role: 'manager', password: 'manager12345', pin: '2345' },
  { name: 'Front Cashier', email: 'cashier@orderitup.com', role: 'cashier', password: 'cashier12345', pin: '3456' },
  { name: 'Head Waiter', email: 'waiter@orderitup.com', role: 'server', password: 'waiter12345', pin: '4567' },
  { name: 'Kitchen Chef', email: 'chef@orderitup.com', role: 'chef', password: 'chef12345', pin: '5678' },
  { name: 'Whitefield Branch Manager', email: 'whitefield_wht349@orderitup.test', role: 'manager', password: 'manager12345', pin: '5678' }
];

for (const dbFile of dbFiles) {
  try {
    const fullPath = path.resolve(dbFile);
    if (!require('fs').existsSync(fullPath)) continue;
    console.log(`Seeding users in ${fullPath}...`);
    const db = new Database(fullPath);

    const checkStmt = db.prepare("SELECT id, email FROM users WHERE email = ?");
    const updateStmt = db.prepare("UPDATE users SET name = ?, password = ?, role = ?, pin = ?, pin_hash = ?, is_active = 1, updated_at = ? WHERE email = ?");
    const insertStmt = db.prepare("INSERT INTO users (id, name, email, password, role, pin, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)");

    const now = new Date().toISOString();

    for (const acc of accounts) {
      const existing = checkStmt.get(acc.email);
      const hashedPassword = bcrypt.hashSync(acc.password, 10);
      const hashedPin = bcrypt.hashSync(acc.pin, 10);

      if (existing) {
        updateStmt.run(acc.name, hashedPassword, acc.role, acc.pin, hashedPin, now, acc.email);
        console.log(`Updated ${acc.email} (${acc.role})`);
      } else {
        const id = require('crypto').randomUUID();
        insertStmt.run(id, acc.name, acc.email, hashedPassword, acc.role, acc.pin, hashedPin, now, now);
        console.log(`Created ${acc.email} (${acc.role})`);
      }
    }

    db.close();
    console.log(`Done seeding ${dbFile}`);
  } catch (err) {
    console.error(`Error processing ${dbFile}:`, err);
  }
}

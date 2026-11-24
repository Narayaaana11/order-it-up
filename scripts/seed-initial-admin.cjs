const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const db = new Database('order-it-up.db');

const now = new Date().toISOString();

// Check if admin already exists
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@orderitup.com');

if (!existingAdmin) {
  const usersToSeed = [
    {
      id: randomUUID(),
      name: 'Store Owner',
      email: 'admin@orderitup.com',
      password: bcrypt.hashSync('Admin@1234', 10),
      role: 'owner',
      pin: '1234',
      pin_hash: bcrypt.hashSync('1234', 10),
    },
    {
      id: randomUUID(),
      name: 'Store Manager',
      email: 'manager@orderitup.com',
      password: bcrypt.hashSync('Manager@1234', 10),
      role: 'manager',
      pin: '2345',
      pin_hash: bcrypt.hashSync('2345', 10),
    },
    {
      id: randomUUID(),
      name: 'Front Cashier',
      email: 'cashier@orderitup.com',
      password: bcrypt.hashSync('Cashier@1234', 10),
      role: 'cashier',
      pin: '5678',
      pin_hash: bcrypt.hashSync('5678', 10),
    },
    {
      id: randomUUID(),
      name: 'Head Waiter',
      email: 'waiter@orderitup.com',
      password: bcrypt.hashSync('Waiter@1234', 10),
      role: 'server',
      pin: '9012',
      pin_hash: bcrypt.hashSync('9012', 10),
    },
    {
      id: randomUUID(),
      name: 'Kitchen Chef',
      email: 'chef@orderitup.com',
      password: bcrypt.hashSync('Chef@1234', 10),
      role: 'chef',
      pin: '3456',
      pin_hash: bcrypt.hashSync('3456', 10),
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, role, pin, pin_hash, is_active, terms_accepted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);

  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    for (const u of usersToSeed) {
      insertUser.run(u.id, u.name, u.email, u.password, u.role, u.pin, u.pin_hash, now, now, now);
      console.log(`Seeded user: ${u.email} (${u.role})`);
    }

    const settings = {
      business_name: 'Order It Up Demo Restaurant',
      business_type: 'restaurant',
      country: 'IN',
      currency: 'INR',
      currency_symbol: '₹',
      timezone: 'Asia/Kolkata',
      language: 'en',
      onboarding_completed: 'true',
      service_model: 'qsr',
      setup_profile: 'express',
      email: 'admin@orderitup.com',
    };

    for (const [k, v] of Object.entries(settings)) {
      insertSetting.run(k, String(v), now);
    }
    console.log('Seeded settings successfully.');
  })();
} else {
  console.log('Admin user already exists.');
}

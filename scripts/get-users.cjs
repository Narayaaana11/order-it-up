const Database = require('better-sqlite3');
const db = new Database('order-it-up.db');

try {
  const users = db.prepare('SELECT id, name, email, role, pin, password FROM users').all();
  console.log('USERS FOUND:', users.length);
  console.log(JSON.stringify(users, null, 2));
} catch (e) {
  console.error('Error querying users:', e.message);
}

try {
  const settings = db.prepare('SELECT * FROM settings').all();
  console.log('SETTINGS FOUND:');
  settings.forEach(s => {
    if (s.key && (s.key.includes('admin') || s.key.includes('user') || s.key.includes('email') || s.key.includes('auth') || s.key.includes('pin'))) {
      console.log(`  ${s.key}: ${s.value}`);
    }
  });
} catch (e) {
  console.error('Error querying settings:', e.message);
}

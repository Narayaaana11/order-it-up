const Database = require('better-sqlite3');
const db = new Database('order-it-up.db');

const info = db.prepare("PRAGMA table_info(users)").all();
console.log('Columns in users:');
info.forEach(col => console.log(`  ${col.name} (${col.type}, notnull=${col.notnull}, dflt=${col.dflt_value})`));

import Database from 'better-sqlite3';
import path from 'node:path';

const db = new Database(path.join('prisma', 'sqlite.db'));
try {
  const rows = db
    .prepare("select route, key, count, lastSeenAt from RuntimeKeyAggregate where key = 'demo.hello' order by lastSeenAt desc limit 5")
    .all();
  process.stdout.write(JSON.stringify(rows) + '\n');
} finally {
  db.close();
}

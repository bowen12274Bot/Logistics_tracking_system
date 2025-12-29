import pathlib
import sqlite3

migrations_dir = pathlib.Path("migrations")
migrations = sorted(migrations_dir.glob("*.sql"))

if not migrations:
    raise SystemExit(f"No migrations found under {migrations_dir}")

db_root = pathlib.Path(".wrangler/state/v3/d1/miniflare-D1DatabaseObject")
dbs = sorted(db_root.glob("*.sqlite"))

if not dbs:
    raise SystemExit(f"No local Miniflare D1 sqlite databases found under {db_root}")

def ensure_migration_table(cur: sqlite3.Cursor) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS d1_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )


for db in dbs:
    print("Applying to", db)
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    ensure_migration_table(cur)
    applied = {row[0] for row in cur.execute("SELECT name FROM d1_migrations").fetchall()}
    for migration in migrations:
        if migration.name in applied:
            continue
        sql = migration.read_text(encoding="utf-8")
        cur.executescript(sql)
        cur.execute("INSERT INTO d1_migrations (name) VALUES (?)", (migration.name,))
    conn.commit()
    tables = cur.execute("select name from sqlite_master where type='table'").fetchall()
    print("Tables now:", tables)
    conn.close()

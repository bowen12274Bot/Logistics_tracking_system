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

for db in dbs:
    print("Applying to", db)
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    for migration in migrations:
        sql = migration.read_text(encoding="utf-8")
        cur.executescript(sql)
    conn.commit()
    tables = cur.execute("select name from sqlite_master where type='table'").fetchall()
    print("Tables now:", tables)
    conn.close()

import sqlite3, pathlib
migrations = [pathlib.Path('migrations/0001_init.sql'), pathlib.Path('migrations/0002_users.sql')]
dbs = list(pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite'))
for db in dbs:
    print('Applying to', db)
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    for mig in migrations:
        sql = mig.read_text(encoding='utf-8')
        cur.executescript(sql)
    conn.commit()
    tables = cur.execute("select name from sqlite_master where type='table'").fetchall()
    print('Tables now:', tables)
    users = cur.execute("select email,user_class from users").fetchall()
    print('Sample users:', users)
    conn.close()

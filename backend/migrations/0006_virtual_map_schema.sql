-- Auto-generated Map Migration File
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS nodes;

CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT, level INTEGER, subtype TEXT, x INTEGER, y INTEGER);
CREATE TABLE edges (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, target TEXT, distance REAL, road_multiple INTEGER, cost INTEGER, FOREIGN KEY(source) REFERENCES nodes(id), FOREIGN KEY(target) REFERENCES nodes(id));
CREATE INDEX idx_edges_source ON edges(source);

import random
import math
from pathlib import Path
import argparse

# ================= 設定區 =================
SEED = 2025
MAP_SIZE = 10000
# Default output SQL file (can be overridden by CLI --out).
PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_SQL_FILE = str(PROJECT_ROOT / "backend" / "migrations" / "0007_virtual_map_seed.sql")

# 設定各層級
CONFIG = {
    1: {
        "count": 4,
        "name": "HUB",
        "speed_factor": 0.5,
        "parent_dist_min": 0,
        "parent_dist_max": 0,
        "spacing": 4000,
    },
    2: {
        "count": 12,
        "name": "REG",
        "speed_factor": 1.0,
        "parent_dist_min": 1500,
        "parent_dist_max": 2500,
        "spacing": 1500,
    },
    3: {
        "count": 30,
        "name": "LOC",
        "speed_factor": 2.0,
        "parent_dist_min": 800,
        "parent_dist_max": 1500,
        "spacing": 600,
    },
    4: {
        "count": 300,
        "name": "END",
        "speed_factor": 5.0,
        "parent_dist_min": 200,
        "parent_dist_max": 600,
        "spacing": 100,
    },
}
# =========================================

random.seed(SEED)


class Node:
    def __init__(self, uid, level, parent_id, x, y):
        self.id = str(uid)
        self.level = level
        self.parent_id = str(parent_id) if parent_id is not None else None
        self.x = x
        self.y = y
        self.name = f"{CONFIG[level]['name']}_{uid}"


def distance_sq(x1, y1, x2, y2):
    return (x1 - x2) ** 2 + (y1 - y2) ** 2


def is_valid_position(x, y, existing_nodes, min_spacing):
    if x < 0 or x > MAP_SIZE or y < 0 or y > MAP_SIZE:
        return False
    min_dist_sq = min_spacing**2
    for node in existing_nodes:
        if distance_sq(x, y, node.x, node.y) < min_dist_sq:
            return False
    return True


def generate_data():
    nodes = []
    edges = []
    nodes_by_level = {1: [], 2: [], 3: [], 4: []}
    node_counter = 0

    print("正在生成節點...")

    # Level 1 Generation
    attempts = 0
    while len(nodes_by_level[1]) < CONFIG[1]["count"] and attempts < 1000:
        x = random.randint(0, MAP_SIZE)
        y = random.randint(0, MAP_SIZE)
        if is_valid_position(x, y, nodes, CONFIG[1]["spacing"]):
            node = Node(node_counter, 1, None, x, y)
            nodes.append(node)
            nodes_by_level[1].append(node)
            node_counter += 1
        attempts += 1

    # Level 2-4 Generation
    for lvl in [2, 3, 4]:
        target_count = CONFIG[lvl]["count"]
        parent_candidates = nodes_by_level[lvl - 1]
        failures = 0
        current_count = 0

        while current_count < target_count and failures < 2000:
            parent = random.choice(parent_candidates)
            dist_range = random.uniform(
                CONFIG[lvl]["parent_dist_min"], CONFIG[lvl]["parent_dist_max"]
            )
            angle = random.uniform(0, 2 * math.pi)
            new_x = int(parent.x + dist_range * math.cos(angle))
            new_y = int(parent.y + dist_range * math.sin(angle))

            if is_valid_position(new_x, new_y, nodes, CONFIG[lvl]["spacing"]):
                node = Node(node_counter, lvl, parent.id, new_x, new_y)
                nodes.append(node)
                nodes_by_level[lvl].append(node)
                node_counter += 1
                current_count += 1

                # Create Edge Logic
                dist_val = math.sqrt(distance_sq(node.x, node.y, parent.x, parent.y))
                speed = (
                    CONFIG[lvl - 1]["speed_factor"] + CONFIG[lvl]["speed_factor"]
                ) / 2
                cost = int(dist_val * speed)
                # Road Level 取決於較低等級的那一方 (瓶頸)
                road_multiple = (
                    CONFIG[lvl - 1]["speed_factor"] + CONFIG[lvl]["speed_factor"]
                ) / 2

                edges.append(
                    {
                        "source": parent.id,
                        "target": node.id,
                        "distance": int(dist_val),
                        "road_multiple": road_multiple,
                        "cost": cost,
                    }
                )
            else:
                failures += 1

    print("正在生成骨幹連接...")
    l1_nodes = nodes_by_level[1]
    for i in range(len(l1_nodes)):
        for j in range(i + 1, len(l1_nodes)):
            n1 = l1_nodes[i]
            n2 = l1_nodes[j]
            dist_val = math.sqrt(distance_sq(n1.x, n1.y, n2.x, n2.y))
            cost = int(dist_val * CONFIG[1]["speed_factor"])
            edges.append(
                {
                    "source": n1.id,
                    "target": n2.id,
                    "distance": int(dist_val),
                    "road_multiple": 0.5,
                    "cost": cost,
                }
            )

    print("正在生成橫向連接...")
    for lvl in [2, 3]:
        curr_nodes = nodes_by_level[lvl]
        try_limit = len(curr_nodes) * 2
        for _ in range(try_limit):
            n1 = random.choice(curr_nodes)
            n2 = random.choice(curr_nodes)
            if n1.id == n2.id:
                continue

            d_sq = distance_sq(n1.x, n1.y, n2.x, n2.y)
            limit_dist = CONFIG[lvl]["parent_dist_max"] * 1.5

            if d_sq < limit_dist**2:
                exists = any(
                    (e["source"] == n1.id and e["target"] == n2.id)
                    or (e["source"] == n2.id and e["target"] == n1.id)
                    for e in edges
                )
                if not exists:
                    dist_val = math.sqrt(d_sq)
                    cost = int(dist_val * CONFIG[lvl]["speed_factor"])
                    edges.append(
                        {
                            "source": n1.id,
                            "target": n2.id,
                            "distance": int(dist_val),
                            "road_multiple": CONFIG[lvl]["speed_factor"],
                            "cost": cost,
                        }
                    )

    return nodes, edges


def generate_sql_file(nodes, edges):
    print(f"正在寫入 SQL 檔案: {OUTPUT_SQL_FILE} ...")

    out_path = Path(OUTPUT_SQL_FILE)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        # 1. 寫入 Schema
        f.write("-- Auto-generated Map Migration File\n")
        f.write("DROP TABLE IF EXISTS edges;\n")
        f.write("DROP TABLE IF EXISTS nodes;\n\n")

        f.write(
            "CREATE TABLE nodes (id TEXT PRIMARY KEY, name TEXT, level INTEGER, x INTEGER, y INTEGER);\n"
        )
        f.write(
            "CREATE TABLE edges (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, target TEXT, distance REAL, road_multiple INTEGER, cost INTEGER, FOREIGN KEY(source) REFERENCES nodes(id), FOREIGN KEY(target) REFERENCES nodes(id));\n"
        )
        f.write("CREATE INDEX idx_edges_source ON edges(source);\n\n")

        # 2. 寫入 Nodes 數據
        f.write("-- Seed Nodes\n")
        for n in nodes:
            # 使用 SQL 轉義防止錯誤 (雖然這裡ID都是數字)
            f.write(
                f"INSERT INTO nodes (id, name, level, x, y) VALUES ('{n.id}', '{n.name}', {n.level}, {n.x}, {n.y});\n"
            )

        # 3. 寫入 Edges 數據 (雙向寫入)
        f.write("\n-- Seed Edges (Bidirectional)\n")
        for e in edges:
            # 正向 A -> B
            f.write(
                f"INSERT INTO edges (source, target, distance, road_multiple, cost) VALUES ('{e['source']}', '{e['target']}', {e['distance']}, {e['road_multiple']}, {e['cost']});\n"
            )
            # 反向 B -> A (方便演算法查詢)
            f.write(
                f"INSERT INTO edges (source, target, distance, road_multiple, cost) VALUES ('{e['target']}', '{e['source']}', {e['distance']}, {e['road_multiple']}, {e['cost']});\n"
            )

    print("完成！")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate virtual map SQL seed file.")
    parser.add_argument(
        "--out",
        help="Output SQL file path.",
        default=OUTPUT_SQL_FILE,
    )
    args = parser.parse_args()
    OUTPUT_SQL_FILE = args.out

    nodes, edges = generate_data()
    generate_sql_file(nodes, edges)

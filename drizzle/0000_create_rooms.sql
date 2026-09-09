CREATE TABLE IF NOT EXISTS dubipoly_rooms (
  room_code TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

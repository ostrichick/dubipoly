CREATE TABLE IF NOT EXISTS dubipoly_presence (
  room_code TEXT NOT NULL,
  token TEXT NOT NULL,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (room_code, token)
);

-- Neon serverless Postgres migration
-- Run this against your Neon database before first deploy

CREATE TABLE IF NOT EXISTS creatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname VARCHAR(100),
  image_url TEXT NOT NULL,
  original_url TEXT,
  color_palette JSONB DEFAULT '[]'::jsonb,
  swim_speed REAL NOT NULL DEFAULT 1.0,
  depth_layer INTEGER NOT NULL DEFAULT 1,
  start_x REAL NOT NULL DEFAULT 0.5,
  start_y REAL NOT NULL DEFAULT 0.5,
  wiggle_amplitude REAL NOT NULL DEFAULT 1.0,
  direction INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_creatures_created_at ON creatures (created_at DESC);

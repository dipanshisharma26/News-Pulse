-- Setup script for News Pulse PostgreSQL Database

-- Create clusters table
CREATE TABLE IF NOT EXISTS clusters (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    url TEXT UNIQUE NOT NULL,
    published_at TIMESTAMP NOT NULL,
    source TEXT NOT NULL,
    cluster_id TEXT REFERENCES clusters(id) ON DELETE SET NULL
);

-- Create ingest_jobs table
CREATE TABLE IF NOT EXISTS ingest_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

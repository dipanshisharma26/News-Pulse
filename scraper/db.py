import os
import sqlite3
import urllib.parse as urlparse
from dotenv import load_dotenv

# Load env variables if available (mostly for local development)
load_dotenv()

def get_db_connection():
    db_url = os.getenv("DATABASE_URL")
    if db_url and (db_url.startswith("postgres://") or db_url.startswith("postgresql://")):
        import psycopg2
        # Normalize postgres:// to postgresql:// for compatibility with psycopg2
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(db_url)
        return conn, "postgres"
    else:
        # Fallback to local SQLite file
        # Resolve path to project root to avoid running from different dirs
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(project_root, "newspulse.db")
        conn = sqlite3.connect(db_path)
        # Enable foreign key constraint enforcement in SQLite
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn, "sqlite"

def init_db():
    conn, db_type = get_db_connection()
    cursor = conn.cursor()
    
    # Create clusters table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clusters (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    # Create articles table
    cursor.execute("""
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
    """)
    
    # Create ingest_jobs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ingest_jobs (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );
    """)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    print("Initializing Database...")
    init_db()
    print("Database Initialized Successfully.")

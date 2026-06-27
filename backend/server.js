import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getDbType } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper to format ISO timestamp differences
const formatTimestamp = (ts) => {
  if (!ts) return null;
  // If it's a string, SQLite returns it as-is. PostgreSQL returns a Date object.
  return typeof ts === 'string' ? ts : ts.toISOString();
};

/**
 * GET /clusters
 * List of topic clusters — label, article count, time range
 */
app.get('/clusters', async (req, res) => {
  try {
    const sql = `
      SELECT 
        c.id,
        c.label,
        c.created_at,
        COUNT(a.id) AS article_count,
        MIN(a.published_at) AS earliest_article,
        MAX(a.published_at) AS latest_article
      FROM clusters c
      LEFT JOIN articles a ON c.id = a.cluster_id
      GROUP BY c.id, c.label, c.created_at
      ORDER BY earliest_article DESC
    `;
    const result = await query(sql);
    
    // Normalize timestamps
    const clusters = result.rows.map(row => ({
      id: row.id,
      label: row.label,
      created_at: formatTimestamp(row.created_at),
      article_count: parseInt(row.article_count || 0, 10),
      earliest_article: formatTimestamp(row.earliest_article),
      latest_article: formatTimestamp(row.latest_article)
    }));
    
    res.json(clusters);
  } catch (error) {
    console.error('Error fetching clusters:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /clusters/:id
 * Full cluster detail with all articles, sorted chronologically
 */
app.get('/clusters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch cluster info
    const clusterSql = `SELECT id, label, created_at FROM clusters WHERE id = $1`;
    const clusterRes = await query(clusterSql, [id]);
    
    if (clusterRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cluster not found' });
    }
    
    const cluster = clusterRes.rows[0];
    
    // Fetch articles in cluster
    const articlesSql = `
      SELECT id, title, summary, body, url, published_at, source 
      FROM articles 
      WHERE cluster_id = $1 
      ORDER BY published_at ASC
    `;
    const articlesRes = await query(articlesSql, [id]);
    
    const articles = articlesRes.rows.map(row => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      body: row.body,
      url: row.url,
      published_at: formatTimestamp(row.published_at),
      source: row.source
    }));
    
    res.json({
      id: cluster.id,
      label: cluster.label,
      created_at: formatTimestamp(cluster.created_at),
      articles
    });
  } catch (error) {
    console.error('Error fetching cluster detail:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /timeline
 * Clusters formatted for plotting: label, start/end time, article count, size/intensity metric
 */
app.get('/timeline', async (req, res) => {
  try {
    // We fetch clusters that have at least one article
    const dbType = getDbType();
    const sourcesSql = dbType === 'postgres' 
      ? "STRING_AGG(DISTINCT a.source, ',') AS sources"
      : "GROUP_CONCAT(DISTINCT a.source) AS sources";

    const sql = `
      SELECT 
        c.id,
        c.label,
        COUNT(a.id) AS article_count,
        MIN(a.published_at) AS start_time,
        MAX(a.published_at) AS end_time,
        COUNT(DISTINCT a.source) AS source_count,
        ${sourcesSql}
      FROM clusters c
      JOIN articles a ON c.id = a.cluster_id
      GROUP BY c.id, c.label
      HAVING COUNT(a.id) > 0
      ORDER BY start_time ASC
    `;
    const result = await query(sql);
    
    const timelineData = result.rows.map(row => ({
      id: row.id,
      label: row.label,
      article_count: parseInt(row.article_count, 10),
      start_time: formatTimestamp(row.start_time),
      end_time: formatTimestamp(row.end_time),
      source_count: parseInt(row.source_count, 10),
      sources: row.sources ? row.sources.split(',') : [],
      // Sizing metric: log-based scaling or direct counts
      intensity: parseInt(row.source_count, 10) * 1.5 + parseInt(row.article_count, 10) * 0.5
    }));
    
    res.json(timelineData);
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /ingest/trigger
 * Triggers the Python pipeline as a subprocess; returns a job ID
 */
app.post('/ingest/trigger', async (req, res) => {
  try {
    const jobId = uuidv4();
    
    // Write job initialization to database
    // The Python script will also try to write or update this,
    // but initializing it here ensures GET /ingest/status/:jobId works immediately.
    const sql = `
      INSERT INTO ingest_jobs (id, status, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
    `;
    await query(sql, [jobId, 'running']);
    
    // Spawn Python subprocess
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const scraperPath = path.resolve(__dirname, '../scraper/ingest.py');
    
    console.log(`Spawning scraper process: ${pythonCmd} ${scraperPath} --job ${jobId}`);
    
    const child = spawn(pythonCmd, [scraperPath, '--job', jobId]);
    
    child.stdout.on('data', (data) => {
      console.log(`[Job ${jobId} Stdout]: ${data.toString().trim()}`);
    });
    
    child.stderr.on('data', (data) => {
      console.error(`[Job ${jobId} Stderr]: ${data.toString().trim()}`);
    });
    
    child.on('close', async (code) => {
      console.log(`[Job ${jobId}] Python scraper process exited with code ${code}`);
      
      // Safety net: if process exited with non-zero but database was not updated
      if (code !== 0) {
        try {
          const checkSql = `SELECT status FROM ingest_jobs WHERE id = $1`;
          const checkRes = await query(checkSql, [jobId]);
          if (checkRes.rows.length > 0 && checkRes.rows[0].status === 'running') {
            const failSql = `
              UPDATE ingest_jobs 
              SET status = $1, error = $2, completed_at = CURRENT_TIMESTAMP 
              WHERE id = $3
            `;
            await query(failSql, ['failed', `Scraper exited with code ${code}`, jobId]);
            console.log(`[Job ${jobId}] Marked as failed in safety net.`);
          }
        } catch (dbErr) {
          console.error(`Failed to update crash status in DB for Job ${jobId}:`, dbErr);
        }
      }
    });
    
    res.json({ jobId });
  } catch (error) {
    console.error('Error triggering ingestion:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /ingest/status/:jobId
 * Lets the frontend poll job status
 */
app.get('/ingest/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const sql = `
      SELECT id, status, error, created_at, completed_at 
      FROM ingest_jobs 
      WHERE id = $1
    `;
    const result = await query(sql, [jobId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = result.rows[0];
    res.json({
      id: job.id,
      status: job.status,
      error: job.error,
      created_at: formatTimestamp(job.created_at),
      completed_at: formatTimestamp(job.completed_at)
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`News Pulse API server running on http://localhost:${PORT}`);
});

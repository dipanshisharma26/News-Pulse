import os
import sys
import argparse
import uuid
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone
import email.utils
from db import get_db_connection, init_db

# Reconfigure stdout/stderr to UTF-8 for Windows console support
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Common English Stop Words
STOP_WORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
    'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for',
    'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes',
    'her', 'here', 'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im',
    'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my',
    'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
    'ourselves', 'out', 'over', 'own', 'same', 'shannt', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt',
    'so', 'some', 'such', 'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
    'there', 'theres', 'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through',
    'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent',
    'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom', 'why', 'whys',
    'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself',
    'yourselves', 'us', 'also', 'new', 'news', 'say', 'says', 'said', 'one', 'two', 'three', 'first', 'last',
    'will', 'can', 'may', 'should', 'would', 'like', 'many', 'just', 'get', 'make', 'go', 'time', 'year', 'years',
    'bbc', 'npr', 'guardian', 'world', 'us', 'uk', 'news', 'people', 'home', 'report'
}

FEEDS = {
    'BBC News': 'http://feeds.bbci.co.uk/news/rss.xml',
    'NPR': 'https://feeds.npr.org/1001/rss.xml',
    'The Guardian': 'https://www.theguardian.com/world/rss'
}

def tokenize(text):
    if not text:
        return set()
    # Lowercase and find words of length >= 3
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    return {w for w in words if w not in STOP_WORDS}

def extract_body(url):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return ""
        
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # Decompose styling, script, and structural layouts
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'button', 'noscript']):
            tag.decompose()
            
        paragraphs = []
        # Find paragraphs and pull text
        for p in soup.find_all('p'):
            text = p.get_text().strip()
            # Heuristic: Real article body paragraphs are typically > 40 chars
            if len(text) > 40 and not text.startswith("©") and not text.startswith("Read more"):
                paragraphs.append(text)
                
        body = "\n\n".join(paragraphs)
        return body
    except Exception as e:
        print(f"Error fetching full body for {url}: {e}")
        return ""

def parse_date(date_str):
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        # RFC 822/1123 date parsing
        return email.utils.parsedate_to_datetime(date_str)
    except Exception:
        try:
            # ISO 8601 formatting fallback
            clean_date = date_str.replace("Z", "+00:00")
            return datetime.fromisoformat(clean_date)
        except Exception:
            return datetime.now(timezone.utc)

def fetch_rss_feeds():
    articles = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    for source_name, url in FEEDS.items():
        print(f"Fetching RSS feed from: {source_name} ({url})")
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                print(f"Failed to fetch {source_name} feed: {resp.status_code}")
                continue
                
            soup = BeautifulSoup(resp.content, 'html.parser', from_encoding='utf-8')
            items = soup.find_all('item')
            if not items:
                items = soup.find_all('entry') # Atom fallback
                
            print(f"Found {len(items)} items in {source_name} feed.")
            for item in items:
                try:
                    title_tag = item.find('title')
                    title = title_tag.get_text().strip() if title_tag else ""
                    
                    link = ""
                    link_tag = item.find('link')
                    if link_tag:
                        if link_tag.get('href'):
                            link = link_tag.get('href').strip()
                        elif link_tag.next_sibling and isinstance(link_tag.next_sibling, str):
                            link = link_tag.next_sibling.strip()
                        else:
                            link = link_tag.get_text().strip()
                            
                    if not title or not link:
                        continue
                        
                    summary = ""
                    desc_tag = item.find('description') or item.find('summary') or item.find('content:encoded')
                    if desc_tag:
                        summary = BeautifulSoup(desc_tag.get_text(), 'html.parser').get_text().strip()
                        
                    pub_date_str = ""
                    date_tag = item.find('pubdate') or item.find('pubDate') or item.find('dc:date') or item.find('published') or item.find('updated')
                    if date_tag:
                        pub_date_str = date_tag.get_text().strip()
                        
                    published_at = parse_date(pub_date_str)
                    
                    articles.append({
                        'title': title,
                        'summary': summary,
                        'url': link,
                        'published_at': published_at,
                        'source': source_name
                    })
                except Exception as ex:
                    print(f"Error parsing RSS item from {source_name}: {ex}")
        except Exception as e:
            print(f"Error downloading feed {source_name}: {e}")
            
    return articles

def run_clustering(conn, db_type):
    cursor = conn.cursor()
    
    # 1. Fetch all articles from the database
    # In order to cluster everything, let's select articles from DB
    if db_type == "postgres":
        cursor.execute("SELECT id, title, summary, body, url, published_at, source FROM articles")
        rows = cursor.fetchall()
    else:
        cursor.execute("SELECT id, title, summary, body, url, published_at, source FROM articles")
        rows = cursor.fetchall()
        
    articles = []
    for row in rows:
        # Convert pubdate string back to datetime in SQLite
        pub_at = row[5]
        if isinstance(pub_at, str):
            try:
                # Remove milliseconds/microsecond differences if any and parse
                clean_date = pub_at.replace("Z", "+00:00")
                pub_dt = datetime.fromisoformat(clean_date)
            except Exception:
                pub_dt = datetime.now(timezone.utc)
        else:
            pub_dt = pub_at
            
        articles.append({
            'id': row[0],
            'title': row[1],
            'summary': row[2],
            'body': row[3],
            'url': row[4],
            'published_at': pub_dt,
            'source': row[6]
        })
        
    if not articles:
        print("No articles in database to cluster.")
        return
        
    # 2. Tokenize text for all articles
    article_tokens = {}
    for art in articles:
        # Combine title, summary, and a portion of full body
        combined_text = f"{art['title']} {art['summary'] or ''} {art['body'][:500] if art['body'] else ''}"
        article_tokens[art['id']] = tokenize(combined_text)
        
    # 3. Build overlap graph (Time window <= 3 days, shared keywords >= 4)
    adj = {art['id']: [] for art in articles}
    n = len(articles)
    for i in range(n):
        for j in range(i + 1, n):
            art1 = articles[i]
            art2 = articles[j]
            
            # Check time window (within 3 days)
            time_diff = abs((art1['published_at'] - art2['published_at']).total_seconds())
            if time_diff > (3 * 24 * 60 * 60):
                continue
                
            tokens1 = article_tokens[art1['id']]
            tokens2 = article_tokens[art2['id']]
            
            intersection = tokens1.intersection(tokens2)
            if len(intersection) >= 4:
                adj[art1['id']].append(art2['id'])
                adj[art2['id']].append(art1['id'])
                
    # 4. Connected components via DFS/BFS
    visited = set()
    clusters = []
    
    for art in articles:
        art_id = art['id']
        if art_id not in visited:
            cluster_members = []
            queue = [art_id]
            visited.add(art_id)
            while queue:
                curr = queue.pop(0)
                cluster_members.append(curr)
                for neighbor in adj[curr]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
            clusters.append(cluster_members)
            
    print(f"Generated {len(clusters)} clusters from {len(articles)} articles.")
    
    # 5. Clear old clusters
    cursor.execute("DELETE FROM clusters")
    # For SQLite/Postgres we can set cluster_id of articles to NULL
    cursor.execute("UPDATE articles SET cluster_id = NULL")
    
    # 6. Save new clusters and update articles
    articles_dict = {art['id']: art for art in articles}
    for cluster_members in clusters:
        cluster_id = str(uuid.uuid4())
        
        # Label generation: top 3 most frequent tokens in the cluster
        word_counts = {}
        for art_id in cluster_members:
            for t in article_tokens[art_id]:
                word_counts[t] = word_counts.get(t, 0) + 1
                
        # Sort word counts
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        top_words = [w[0] for w in sorted_words[:3]]
        
        label = " • ".join([w.upper() for w in top_words])
        if not label:
            # Fallback
            rep_art_title = articles_dict[cluster_members[0]]['title']
            label = rep_art_title[:45] + "..." if len(rep_art_title) > 45 else rep_art_title
            
        # Insert cluster
        cursor.execute(
            "INSERT INTO clusters (id, label) VALUES (%s, %s)" if db_type == "postgres"
            else "INSERT INTO clusters (id, label) VALUES (?, ?)",
            (cluster_id, label)
        )
        
        # Update articles belonging to this cluster
        for art_id in cluster_members:
            cursor.execute(
                "UPDATE articles SET cluster_id = %s WHERE id = %s" if db_type == "postgres"
                else "UPDATE articles SET cluster_id = ? WHERE id = ?",
                (cluster_id, art_id)
            )
            
    conn.commit()

def ingest_pipeline(job_id=None):
    conn = None
    db_type = None
    try:
        # Initialize Database Tables
        init_db()
        
        conn, db_type = get_db_connection()
        cursor = conn.cursor()
        
        # Update job status in database to 'running'
        if job_id:
            cursor.execute(
                "INSERT INTO ingest_jobs (id, status, created_at) VALUES (%s, %s, %s) "
                "ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status" if db_type == "postgres"
                else "INSERT OR REPLACE INTO ingest_jobs (id, status, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (job_id, 'running', datetime.now(timezone.utc)) if db_type == "postgres" else (job_id, 'running')
            )
            conn.commit()
            
        print("Fetching RSS feeds...")
        scraped_articles = fetch_rss_feeds()
        
        new_count = 0
        skip_count = 0
        
        for art in scraped_articles:
            # Check for duplicate url
            cursor.execute(
                "SELECT id FROM articles WHERE url = %s" if db_type == "postgres"
                else "SELECT id FROM articles WHERE url = ?",
                (art['url'],)
            )
            exists = cursor.fetchone()
            if exists:
                skip_count += 1
                continue
                
            # Fetch full text
            print(f"Scraping full text for: {art['title'][:50]} ({art['url']})")
            full_body = extract_body(art['url'])
            
            # Generate UUID for the article
            art_id = str(uuid.uuid4())
            
            # Format datetime for database insertion (ISO string)
            pub_str = art['published_at'].isoformat()
            
            # Save article
            cursor.execute(
                "INSERT INTO articles (id, title, summary, body, url, published_at, source) VALUES (%s, %s, %s, %s, %s, %s, %s)" if db_type == "postgres"
                else "INSERT INTO articles (id, title, summary, body, url, published_at, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (art_id, art['title'], art['summary'], full_body, art['url'], pub_str, art['source'])
            )
            new_count += 1
            
        conn.commit()
        print(f"Ingested {new_count} new articles. Skipped {skip_count} duplicates.")
        
        # Run Clustering
        print("Running Clustering...")
        run_clustering(conn, db_type)
        print("Clustering completed.")
        
        # Mark job as completed
        if job_id:
            cursor.execute(
                "UPDATE ingest_jobs SET status = %s, completed_at = %s WHERE id = %s" if db_type == "postgres"
                else "UPDATE ingest_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                ('completed', datetime.now(timezone.utc), job_id) if db_type == "postgres" else ('completed', job_id)
            )
            conn.commit()
            
    except Exception as e:
        print(f"Error running ingestion pipeline: {e}")
        if conn:
            try:
                cursor = conn.cursor()
                if job_id:
                    cursor.execute(
                        "UPDATE ingest_jobs SET status = %s, error = %s, completed_at = %s WHERE id = %s" if db_type == "postgres"
                        else "UPDATE ingest_jobs SET status = ?, error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                        ('failed', str(e), datetime.now(timezone.utc), job_id) if db_type == "postgres" else ('failed', str(e), job_id)
                    )
                    conn.commit()
            except Exception as rollback_err:
                print(f"Rollback status update failed: {rollback_err}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest articles and group them by topic.")
    parser.add_argument("--job", help="The Job ID of the trigger request")
    args = parser.parse_args()
    
    print("Starting pipeline run...")
    ingest_pipeline(args.job)
    print("Pipeline run finished.")

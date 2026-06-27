import { useState, useEffect } from 'react';
import { 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  Filter, 
  Database, 
  TrendingUp, 
  Newspaper, 
  ExternalLink, 
  X, 
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const SOURCES = ['BBC News', 'NPR', 'The Guardian'];

function App() {
  // State variables
  const [timelineData, setTimelineData] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState(SOURCES);

  // Active Selection
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [clusterDetails, setClusterDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Ingestion Job Polling
  const [currentJob, setCurrentJob] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const handleLoadDemoData = async () => {
    try {
      setSeeding(true);
      setError(null);
      const res = await fetch(`${API_BASE}/seed`);
      if (!res.ok) {
        throw new Error('Failed to seed database');
      }
      await fetchData(); // refresh data
    } catch (err) {
      console.error(err);
      setError('Could not seed database. Please check backend connection.');
    } finally {
      setSeeding(false);
    }
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [timelineRes, clustersRes] = await Promise.all([
        fetch(`${API_BASE}/timeline`),
        fetch(`${API_BASE}/clusters`)
      ]);

      if (!timelineRes.ok || !clustersRes.ok) {
        throw new Error('Failed to fetch data from API server');
      }

      const timeline = await timelineRes.json();
      const clusterList = await clustersRes.json();

      setTimelineData(timeline);
      setClusters(clusterList);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the backend server. Make sure it is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch cluster details when selection changes
  useEffect(() => {
    if (!selectedClusterId) {
      setClusterDetails(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        setDetailsLoading(true);
        const res = await fetch(`${API_BASE}/clusters/${selectedClusterId}`);
        if (!res.ok) throw new Error('Failed to fetch cluster details');
        const data = await res.json();
        setClusterDetails(data);
      } catch (err) {
        console.error(err);
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedClusterId]);

  // Job Polling Effect
  useEffect(() => {
    if (!currentJob || currentJob.status !== 'running') return;

    let pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/ingest/status/${currentJob.id}`);
        if (!res.ok) return;
        const job = await res.json();
        
        setCurrentJob(job);
        
        if (job.status === 'completed') {
          clearInterval(pollInterval);
          fetchData(); // reload timeline data
        } else if (job.status === 'failed') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentJob]);

  // Source toggle helper
  const toggleSource = (source) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source) 
        : [...prev, source]
    );
  };

  // Trigger ingestion job
  const handleTriggerIngest = async () => {
    if (currentJob && currentJob.status === 'running') return;
    try {
      setCurrentJob({ status: 'running', id: 'starting...' });
      const res = await fetch(`${API_BASE}/ingest/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to trigger ingestion');
      const data = await res.json();
      setCurrentJob({ id: data.jobId, status: 'running' });
    } catch (err) {
      console.error(err);
      setCurrentJob({ status: 'failed', error: err.message });
    }
  };

  // Dismiss status banner
  const dismissJobBanner = () => {
    setCurrentJob(null);
  };

  // Filter in-memory timeline and clusters
  const filteredTimeline = timelineData.filter(c => {
    const matchesSearch = c.label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSources = c.sources.some(src => selectedSources.includes(src));
    return matchesSearch && matchesSources;
  });

  // Calculate stats based on all loaded data
  const totalArticlesCount = clusters.reduce((acc, c) => acc + (c.article_count || 0), 0);
  const activeClustersCount = filteredTimeline.length;

  // Timeline Range calculations
  const { startTimeBound, endTimeBound, totalDuration } = (() => {
    if (filteredTimeline.length === 0) {
      return { startTimeBound: 0, endTimeBound: 0, totalDuration: 0 };
    }
    let minTime = Math.min(...filteredTimeline.map(c => new Date(c.start_time).getTime()));
    let maxTime = Math.max(...filteredTimeline.map(c => new Date(c.end_time).getTime()));
    
    // Add visual padding (5% or 6 hours minimum)
    const padding = Math.max((maxTime - minTime) * 0.05, 6 * 3600 * 1000);
    const startTimeBound = minTime - padding;
    const endTimeBound = maxTime + padding;
    
    return {
      startTimeBound,
      endTimeBound,
      totalDuration: endTimeBound - startTimeBound
    };
  })();

  // Generate 5 grid ticks
  const timelineTicks = [];
  if (totalDuration > 0) {
    const ticksCount = 5;
    for (let i = 0; i < ticksCount; i++) {
      const time = startTimeBound + (totalDuration * i) / (ticksCount - 1);
      timelineTicks.push(new Date(time));
    }
  }

  const formatTickLabel = (date) => {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Allocate rows statically/dynamically to avoid overlapping pills
  const allocateRows = (items) => {
    const sorted = [...items].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const rows = [];
    const rowEndTimes = [];
    
    // 1-hour visual buffer between capsules
    const buffer = 1 * 60 * 60 * 1000;

    sorted.forEach(item => {
      const start = new Date(item.start_time).getTime();
      const end = new Date(item.end_time).getTime();
      let placed = false;

      for (let r = 0; r < rowEndTimes.length; r++) {
        if (rowEndTimes[r] + buffer < start) {
          rows[r].push(item);
          rowEndTimes[r] = Math.max(rowEndTimes[r], end);
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([item]);
        rowEndTimes.push(end);
      }
    });

    return rows;
  };

  const timelineRows = allocateRows(filteredTimeline);

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="header glass-panel">
        <div className="brand-section">
          <div className="logo-icon">
            <Newspaper size={24} color="white" />
          </div>
          <div className="logo-text">
            <h1>News Pulse</h1>
            <p>Topic-Clustered News Timeline</p>
          </div>
        </div>

        <div className="controls-section">
          {/* Keyword Search */}
          <div className="search-wrapper">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search topic keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Source Badges */}
          <div className="filter-container">
            {SOURCES.map(source => {
              const cleanClass = source.toLowerCase().replace(' ', '');
              const active = selectedSources.includes(source);
              return (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={`filter-badge ${active ? `active ${cleanClass}` : ''}`}
                >
                  <span className={`dot ${cleanClass}`}></span>
                  {source}
                </button>
              );
            })}
          </div>

          {/* Trigger Refresh */}
          <button 
            className="btn-primary"
            onClick={handleTriggerIngest}
            disabled={currentJob?.status === 'running' || loading}
          >
            <RefreshCw size={16} className={currentJob?.status === 'running' ? 'spin' : ''} />
            {currentJob?.status === 'running' ? 'Scraping...' : 'Fetch Feed'}
          </button>
        </div>
      </header>

      {/* JOB INGESTION STATUS BANNER */}
      {currentJob && (
        <div className={`status-indicator glass-panel ${currentJob.status === 'failed' ? 'failed' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {currentJob.status === 'running' && <Clock size={18} className="spin" style={{ color: 'var(--accent-primary)' }} />}
            {currentJob.status === 'completed' && <CheckCircle size={18} style={{ color: 'var(--source-guardian)' }} />}
            {currentJob.status === 'failed' && <AlertTriangle size={18} style={{ color: 'var(--source-bbc)' }} />}
            
            <div style={{ fontSize: '0.9rem' }}>
              <strong>Scrape Job Status: </strong> 
              <span style={{ textTransform: 'capitalize' }}>{currentJob.status}</span>
              {currentJob.id && ` (ID: ${currentJob.id.substring(0, 8)})`}
              {currentJob.error && ` — Error: ${currentJob.error}`}
            </div>
          </div>
          <button className="close-btn" onClick={dismissJobBanner}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="dashboard-grid">
        {error ? (
          <div className="glass-panel empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <AlertTriangle size={48} style={{ color: 'var(--source-bbc)' }} />
            <h3>Server Connection Error</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={fetchData}>Retry Connection</button>
          </div>
        ) : loading ? (
          <div className="glass-panel empty-state">
            <RefreshCw size={48} className="spin" style={{ color: 'var(--accent-primary)' }} />
            <h3>Loading news clusters...</h3>
            <p>Parsing dataset and building timeline layout.</p>
          </div>
        ) : clusters.length === 0 ? (
          <div className="glass-panel empty-state" style={{ maxWidth: '600px', margin: '2rem auto' }}>
            <Database size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
            <h3>Database is Empty</h3>
            <p>No news articles or clusters are currently in your database.</p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                onClick={handleLoadDemoData}
                disabled={seeding}
              >
                {seeding ? 'Seeding...' : 'Load Demo News Data'}
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleTriggerIngest}
                disabled={currentJob?.status === 'running'}
              >
                {currentJob?.status === 'running' ? 'Running Scraper...' : 'Run Real Scraper'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* STATS BANNER */}
            <div className="stats-container">
              <div className="stat-card">
                <span className="val">{totalArticlesCount}</span>
                <span className="lbl">Total Articles</span>
              </div>
              <div className="stat-card">
                <span className="val">{activeClustersCount}</span>
                <span className="lbl">Matching Clusters</span>
              </div>
              <div className="stat-card">
                <span className="val">{selectedSources.length} / {SOURCES.length}</span>
                <span className="lbl">Active Sources</span>
              </div>
            </div>

            {/* TIMELINE SECTION */}
            <div className="timeline-section glass-panel">
              <div className="timeline-header-info">
                <h3 className="timeline-title">Topic Clustered Timeline</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Showing {filteredTimeline.length} active event windows
                </div>
              </div>

              <div className="timeline-canvas-container">
                {filteredTimeline.length === 0 ? (
                  <div className="empty-state">
                    <Filter size={36} style={{ color: 'var(--text-muted)' }} />
                    <h3>No active clusters match filters</h3>
                    <p>Try enabling more news sources or clearing search keywords.</p>
                  </div>
                ) : (
                  <div className="timeline-canvas">
                    {/* Time Grid Lines */}
                    <div className="timeline-grid-lines">
                      {timelineTicks.map((tick, idx) => (
                        <div key={idx} className="timeline-grid-line">
                          <span className="timeline-grid-line-label">
                            {formatTickLabel(tick)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline Rows */}
                    {timelineRows.map((row, rowIdx) => (
                      <div key={rowIdx} className="timeline-row">
                        {row.map(cluster => {
                          const start = new Date(cluster.start_time).getTime();
                          const end = new Date(cluster.end_time).getTime();
                          
                          const left = ((start - startTimeBound) / totalDuration) * 100;
                          const width = ((end - start) / totalDuration) * 100;
                          
                          const isSingle = start === end || width < 1.0;
                          const active = selectedClusterId === cluster.id;

                          if (isSingle) {
                            return (
                              <button
                                key={cluster.id}
                                className={`cluster-pulse-dot ${active ? 'active' : ''}`}
                                style={{ left: `${left}%` }}
                                onClick={() => setSelectedClusterId(cluster.id)}
                                title={`${cluster.label} (${cluster.article_count} articles)`}
                              />
                            );
                          } else {
                            return (
                              <button
                                key={cluster.id}
                                className={`cluster-capsule ${active ? 'active' : ''}`}
                                style={{ 
                                  left: `${left}%`, 
                                  width: `${Math.max(width, 2.5)}%` 
                                }}
                                onClick={() => setSelectedClusterId(cluster.id)}
                              >
                                <span className="cluster-label-text">
                                  {cluster.label}
                                </span>
                              </button>
                            );
                          }
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SPLIT LAYOUT FOR LIST AND DRAWER */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem', flexWrap: 'wrap' }} className="responsive-split">
              {/* Clusters List sidebar */}
              <div className="glass-panel" style={{ maxHeight: '600px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 className="timeline-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} />
                  Topic Clusters
                </h3>
                
                <div className="cluster-list">
                  {filteredTimeline.map(c => {
                    const active = selectedClusterId === c.id;
                    const dateStr = new Date(c.start_time).toLocaleDateString(undefined, { 
                      month: 'short', 
                      day: 'numeric' 
                    });
                    
                    return (
                      <div 
                        key={c.id} 
                        className={`cluster-card ${active ? 'active' : ''}`}
                        onClick={() => setSelectedClusterId(c.id)}
                      >
                        <h4>
                          <span>{c.label}</span>
                          <span className="article-count-badge">{c.article_count}</span>
                        </h4>
                        <div className="meta">
                          <span>{dateStr}</span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {c.sources.map(s => (
                              <span key={s} className={`dot ${s.toLowerCase().replace(' ', '')}`} title={s} />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cluster Detail Panel / Drawer */}
              <div className="glass-panel" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                {!selectedClusterId ? (
                  <div className="empty-state" style={{ flexGrow: 1 }}>
                    <Layers size={48} style={{ color: 'var(--text-muted)' }} />
                    <h3>No Topic Selected</h3>
                    <p>Click on a timeline block or cluster card to inspect related articles.</p>
                  </div>
                ) : detailsLoading ? (
                  <div className="empty-state" style={{ flexGrow: 1 }}>
                    <RefreshCw size={48} className="spin" style={{ color: 'var(--accent-primary)' }} />
                    <h3>Fetching Articles...</h3>
                    <p>Retrieving full scraped headlines from selected sources.</p>
                  </div>
                ) : clusterDetails ? (
                  <div className="detail-drawer" style={{ flexGrow: 1 }}>
                    <div className="drawer-header">
                      <div className="drawer-title-group">
                        <h3>{clusterDetails.label}</h3>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} />
                          Cluster created on {new Date(clusterDetails.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button className="close-btn" onClick={() => setSelectedClusterId(null)}>
                        <X size={16} />
                      </button>
                    </div>

                    <div className="articles-grid">
                      {clusterDetails.articles.map(article => {
                        const sourceClass = article.source.toLowerCase().replace(' ', '');
                        return (
                          <div key={article.id} className="article-item">
                            <div className="article-header">
                              <span className={`article-source-tag ${sourceClass}`}>
                                {article.source}
                              </span>
                              <span className="article-time">
                                {new Date(article.published_at).toLocaleString()}
                              </span>
                            </div>
                            
                            <a 
                              href={article.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="article-title-link"
                            >
                              {article.title}
                              <ExternalLink size={14} />
                            </a>

                            <p className="article-summary">
                              {article.summary}
                            </p>

                            {article.body ? (
                              <div className="article-body-details">
                                <strong>Extracted Main Content:</strong>
                                <p style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                                  {article.body.length > 500 
                                    ? article.body.substring(0, 500) + '...' 
                                    : article.body}
                                </p>
                              </div>
                            ) : (
                              <span className="article-time" style={{ fontStyle: 'italic' }}>
                                Full text extraction was skipped or empty.
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state" style={{ flexGrow: 1 }}>
                    <AlertTriangle size={48} style={{ color: 'var(--source-bbc)' }} />
                    <h3>Error Loading Details</h3>
                    <p>The cluster details could not be parsed.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="footer">
        <p>News Pulse Timelines. Aggregated from BBC, NPR, and The Guardian RSS feeds.</p>
      </footer>
    </div>
  );
}

export default App;

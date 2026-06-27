import { query } from './db.js';

export async function seedDatabase() {
  try {
    console.log('Starting database seeding with dummy data...');

    // 1. Clear existing data to avoid primary key/unique conflicts
    await query('DELETE FROM articles');
    await query('DELETE FROM clusters');
    await query('DELETE FROM ingest_jobs');

    const now = new Date();
    
    // Helper to subtract hours from current time
    const hoursAgo = (h) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

    // 2. Define Mock Clusters
    const clusters = [
      {
        id: 'c-ai-tech',
        label: 'AI • GEMINI • TECH',
        created_at: hoursAgo(24)
      },
      {
        id: 'c-space-artemis',
        label: 'SPACE • ARTEMIS • MOON',
        created_at: hoursAgo(48)
      },
      {
        id: 'c-climate-green',
        label: 'CLIMATE • RENEWABLE • ENERGY',
        created_at: hoursAgo(72)
      },
      {
        id: 'c-sports-cup',
        label: 'SPORTS • CHAMPIONSHIP • WIN',
        created_at: hoursAgo(36)
      }
    ];

    // Insert Clusters
    for (const cluster of clusters) {
      await query(
        'INSERT INTO clusters (id, label, created_at) VALUES ($1, $2, $3)',
        [cluster.id, cluster.label, cluster.created_at]
      );
    }
    console.log('Inserted 4 dummy clusters.');

    // 3. Define Mock Articles
    const articles = [
      // AI & Tech Articles
      {
        id: 'a-ai-1',
        title: 'Google Launches Gemini 1.5 Pro with Massive Context Window',
        summary: 'Google has unveiled its latest AI model, Gemini 1.5 Pro, featuring a breakthrough context window of up to 1 million tokens, allowing it to process massive datasets in a single prompt.',
        body: 'In a significant leap forward for artificial intelligence, Google today announced the release of Gemini 1.5 Pro. The model introduces an experimental feature that allows it to run up to 1 million tokens of context. This means the model can process 1 hour of video, 11 hours of audio, codebases with over 30,000 lines of code, or upwards of 700,000 words in a single request. Analysts say this gives Google a major competitive edge in developer tooling and enterprise workflows.',
        url: 'https://www.bbc.com/news/technology-gemini-1-5',
        published_at: hoursAgo(10),
        source: 'BBC News',
        cluster_id: 'c-ai-tech'
      },
      {
        id: 'a-ai-2',
        title: 'Gemini 1.5 Pro Transforms Developer Workflows and Coding Speed',
        summary: 'Software engineers report massive productivity gains after testing Google\'s Gemini 1.5 Pro, citing its capability to ingest entire project codebases and answer architectural questions.',
        body: 'Early access users of Gemini 1.5 Pro are sharing developer workflows that were previously impossible. By uploading entire codebases directly into the AI prompt, developers are finding bugs, generating comprehensive documentation, and getting explanations of complex legacy code in seconds. "It feels like having a senior engineer who knows every line of our 50,000-line repo sitting next to you," said one startup founder. The model represents a paradigm shift in how human programmers interact with code.',
        url: 'https://feeds.npr.org/tech/gemini-developers-workflow',
        published_at: hoursAgo(8),
        source: 'NPR',
        cluster_id: 'c-ai-tech'
      },
      {
        id: 'a-ai-3',
        title: 'Tech Giants Race for Larger AI Context Windows After Google Launch',
        summary: 'Competitors are scrambling to expand their models\' context capabilities following the launch of Google\'s 1-million-token Gemini 1.5 Pro.',
        body: 'The AI arms race has entered a new phase centered around context window capacity. Google\'s release of Gemini 1.5 Pro has forced rival labs to re-evaluate their roadmap. Context window length determines how much information an AI can hold in its active memory during a conversation. Previously, standard limits hovered around 128,000 tokens. With Google expanding this to a million, applications in legal document analysis, video processing, and large-scale software engineering have suddenly become viable.',
        url: 'https://www.theguardian.com/technology/ai-context-windows-race',
        published_at: hoursAgo(6),
        source: 'The Guardian',
        cluster_id: 'c-ai-tech'
      },

      // Space Exploration Articles
      {
        id: 'a-space-1',
        title: 'Artemis Moon Mission Prepares for Next Major Launch Window',
        summary: 'NASA engineers are conducting final tests on the Space Launch System (SLS) rocket as the agency prepares for its next crewed mission around the Moon.',
        body: 'NASA is entering the final phases of integration testing for the SLS rocket and Orion spacecraft at the Kennedy Space Center. The upcoming Artemis II mission will send four astronauts around the Moon and back, marking the first time humans have left low-Earth orbit since Apollo 17 in 1972. Mission controllers are running simulations to test emergency abort procedures and deep-space communications systems ahead of the official launch announcement.',
        url: 'https://www.bbc.com/news/science-space-artemis-prep',
        published_at: hoursAgo(30),
        source: 'BBC News',
        cluster_id: 'c-space-artemis'
      },
      {
        id: 'a-space-2',
        title: 'NASA Tests Core Stage Propulsion for Artemis Lunar Rocket',
        summary: 'NASA successfully completed a series of engine test fires for the Artemis lunar rocket, validating upgrades to the RS-25 engines.',
        body: 'Engineers at Stennis Space Center completed a hot fire test of the SLS core stage engine cluster. The four RS-25 engines fired for a full 500 seconds, generating over 2 million pounds of thrust. The test validated new flight controllers and combustion chambers designed to handle higher throttling capabilities needed for lunar insertion burns. NASA officials declared the test a major success, paving the way for the vehicle transport to Florida.',
        url: 'https://feeds.npr.org/science/nasa-sls-rocket-engine-tests',
        published_at: hoursAgo(24),
        source: 'NPR',
        cluster_id: 'c-space-artemis'
      },
      {
        id: 'a-space-3',
        title: 'Europe Signs Key Deal for Artemis Lunar Gateway Modules',
        summary: 'The European Space Agency (ESA) has finalized contracts to construct habitat and refueling components for the Moon-orbiting Space Station.',
        body: 'The Lunar Gateway, a critical component of the long-term Artemis program, took a major step forward today. ESA signed contracts with European aerospace consortiums to begin construction on the I-HAB (International Habitat) and ESPRIT refueling modules. The Gateway will serve as a science lab, communication hub, and short-term habitat for astronauts descending to the lunar surface. Construction is slated to begin next year, with the first modules launching on commercial heavy-lift rockets.',
        url: 'https://www.theguardian.com/science/europe-artemis-lunar-gateway',
        published_at: hoursAgo(18),
        source: 'The Guardian',
        cluster_id: 'c-space-artemis'
      },

      // Climate & Green Energy Articles
      {
        id: 'a-climate-1',
        title: 'Global Renewable Energy Capacity Hits Record High in 2026',
        summary: 'A new international report reveals that global renewable power capacity grew at its fastest pace in decades, driven by solar installations.',
        body: 'The transition to clean energy is accelerating at an unprecedented pace. According to the International Energy Agency (IEA), global renewable capacity additions increased by 50% compared to last year. Solar photovoltaics accounted for three-quarters of this growth, particularly driven by residential and utility-scale installations in Asia and Europe. Experts suggest that if this rate of growth is sustained, the world is on track to meet the tripling goal set at the recent climate summit.',
        url: 'https://www.bbc.com/news/world-climate-record-renewables',
        published_at: hoursAgo(55),
        source: 'BBC News',
        cluster_id: 'c-climate-green'
      },
      {
        id: 'a-climate-2',
        title: 'Solar and Wind Power Lead Global Green Energy Transition',
        summary: 'Declining production costs and favorable policies make wind and solar energy the cheapest sources of new electricity generation in most countries.',
        body: 'Wind and solar energy are no longer just environmental choices; they are now the most economically competitive options for power generation globally. Over the last decade, solar module costs have fallen by nearly 90%, and wind turbine costs have halved. Governments implementing carbon taxes and tax credits have further accelerated corporate investment, making clean energy projects highly profitable for developers and utility companies alike.',
        url: 'https://feeds.npr.org/environment/solar-wind-lead-transition',
        published_at: hoursAgo(48),
        source: 'NPR',
        cluster_id: 'c-climate-green'
      },
      {
        id: 'a-climate-3',
        title: 'Governments Pledge Deeper Carbon Cuts at Climate Summit',
        summary: 'Delegates from over 190 countries have agreed on a draft treaty committing to accelerated fossil fuel transition timelines.',
        body: 'In an unexpected breakthrough, negotiators at the Global Climate Action Summit finalized a draft treaty that establishes legally binding timelines for phasing down fossil fuel subsidies. The agreement also pledges a combined $100 billion fund to assist developing nations in transitioning their power grids to renewable sources. Environmental advocates welcomed the treaty but warned that implementation monitoring remains weak.',
        url: 'https://www.theguardian.com/environment/summit-deeper-carbon-cuts',
        published_at: hoursAgo(42),
        source: 'The Guardian',
        cluster_id: 'c-climate-green'
      },

      // Sports Championship Articles
      {
        id: 'a-sports-1',
        title: 'National Team Claims Historic World Cup Victory',
        summary: 'In a thrilling final that went to extra time, the national team secured the championship trophy with a spectacular late goal.',
        body: 'The national stadium erupted in celebration as the referee blew the final whistle, sealing a historic 3-2 victory for the home team. The match will go down as one of the greatest finals in tournament history. After conceding an early goal, the team fought back to equalize, eventually scoring the winning goal in the 118th minute of extra time. Fans across the nation poured into the streets to celebrate the country\'s first major international title in over two decades.',
        url: 'https://www.bbc.com/sport/football-world-cup-victory',
        published_at: hoursAgo(15),
        source: 'BBC News',
        cluster_id: 'c-sports-cup'
      },
      {
        id: 'a-sports-2',
        title: 'Emotional Celebrations Sweep the Nation After Championship Win',
        summary: 'Victory parades and fan parks draw millions of citizens celebrating the national team\'s dramatic sporting triumph.',
        body: 'From major metropolitan squares to small rural towns, the country was united in celebration today following the team\'s sporting triumph. City municipalities organized emergency victory parades, with open-top buses carrying the players through packed streets. "This win brings hope and unity when we need it most," said the team captain, holding the gold trophy aloft. Government officials have declared a national holiday tomorrow to commemorate the achievement.',
        url: 'https://feeds.npr.org/sports/celebrations-sweep-nation-win',
        published_at: hoursAgo(12),
        source: 'NPR',
        cluster_id: 'c-sports-cup'
      }
    ];

    // Insert Articles
    for (const article of articles) {
      await query(
        'INSERT INTO articles (id, title, summary, body, url, published_at, source, cluster_id) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          article.id,
          article.title,
          article.summary,
          article.body,
          article.url,
          article.published_at,
          article.source,
          article.cluster_id
        ]
      );
    }
    console.log('Inserted 11 dummy articles.');
    console.log('Database seeding finished successfully.');
    return { success: true, message: 'Database seeded successfully with dummy data' };
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

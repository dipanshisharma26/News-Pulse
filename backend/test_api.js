import http from 'http';

const checkEndpoint = (path) => {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve({ 
              path, 
              ok: true, 
              count: Array.isArray(json) ? json.length : Object.keys(json).length 
            });
          } catch (e) {
            reject(new Error(`Failed to parse JSON for ${path}: ${e.message}`));
          }
        } else {
          reject(new Error(`Endpoint ${path} returned status ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

console.log("Starting API endpoint verification...");
Promise.all([
  checkEndpoint('/timeline'),
  checkEndpoint('/clusters')
]).then((results) => {
  console.log("API check results:");
  results.forEach((res) => {
    console.log(`- ${res.path}: OK (Returned ${res.count} records)`);
  });
  console.log("All API checks passed successfully!");
  process.exit(0);
}).catch((err) => {
  console.error("API check failed:", err.message);
  console.log("Make sure the backend API server is running on port 3001 before running this check.");
  process.exit(1);
});

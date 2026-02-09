/**
 * Daily Trendz - Home Page
 * Simple status page for the API
 */

module.exports = (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Trendz - Affiliate Auto Poster</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      background: linear-gradient(90deg, #f39c12, #e74c3c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .emoji { font-size: 4rem; margin-bottom: 1rem; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(46, 204, 113, 0.2);
      border: 1px solid #2ecc71;
      padding: 0.5rem 1rem;
      border-radius: 50px;
      margin: 1rem 0;
    }
    .dot {
      width: 10px;
      height: 10px;
      background: #2ecc71;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .info {
      color: #8e9aaf;
      margin-top: 2rem;
      font-size: 0.9rem;
    }
    .features {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 2rem;
    }
    .feature {
      background: rgba(255,255,255,0.05);
      padding: 1rem 1.5rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    a { color: #3498db; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🛍️</div>
    <h1>Daily Trendz</h1>
    <p>Automated Affiliate Posting System</p>
    
    <div class="status">
      <span class="dot"></span>
      <span>API Running</span>
    </div>
    
    <div class="features">
      <div class="feature">🛒 Flipkart</div>
      <div class="feature">📦 Amazon</div>
      <div class="feature">📱 Telegram</div>
    </div>
    
    <div class="info">
      <p>API Endpoint: <code>/api/run</code></p>
      <p style="margin-top: 0.5rem;">Scheduled: 4x daily via GitHub Actions</p>
    </div>
  </div>
</body>
</html>
  `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
};

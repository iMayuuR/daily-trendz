# Daily Trendz 🛍️

> Automated affiliate posting system for Telegram channels using Flipkart & Amazon APIs.

## Features

- ✅ **Flipkart Affiliate API** - Product feeds with embedded affiliate links
- ✅ **Amazon PA-API 5.0** - Product search with rate limiting
- ✅ **Telegram Bot** - Formatted deal posts with images
- ✅ **GitHub Actions** - 4 daily time slots (IST)
- ✅ **Config-driven** - JSON configs for categories, limits, filters
- ✅ **Duplicate Prevention** - TTL-based tracking
- ✅ **Sale Mode** - Higher limits during sales

## Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js (Serverless) |
| Hosting | Vercel (Free tier) |
| Scheduler | GitHub Actions |
| APIs | Flipkart Affiliate, Amazon PA-API 5.0 |
| Telegram | Bot API (sendMessage) |

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd pro-affiliate
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
```env
FLIPKART_AFFILIATE_ID=your_id
FLIPKART_AFFILIATE_TOKEN=your_token
AMAZON_ACCESS_KEY=your_key
AMAZON_SECRET_KEY=your_secret
AMAZON_ASSOCIATE_TAG=your_tag
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=@your_channel
CRON_SECRET=random_secret
```

### 3. Test Locally

```bash
npm run test:dry
```

### 4. Deploy to Vercel

```bash
npm run deploy
```

Or connect your GitHub repo to Vercel for auto-deployments.

### 5. Configure GitHub Actions

Add these secrets to your GitHub repository:

- `VERCEL_URL` - Your Vercel deployment URL (e.g., `https://daily-trendz.vercel.app`)
- `CRON_SECRET` - Same secret as in Vercel env

## Project Structure

```
├── api/
│   └── run.js          # Main serverless endpoint
├── lib/
│   ├── flipkart.js     # Flipkart API
│   ├── amazon.js       # Amazon PA-API
│   ├── telegram.js     # Telegram Bot
│   ├── formatter.js    # Message formatting
│   ├── dedupe.js       # Duplicate tracking
│   └── scheduler.js    # Category rotation
├── config/
│   ├── categories.json # Category definitions
│   ├── limits.json     # Posting caps
│   └── settings.json   # App settings
├── scripts/
│   └── dry-run.js      # Local testing
└── .github/workflows/
    └── cron.yml        # Scheduler
```

## Posting Limits

| Limit | Normal | Sale Mode |
|-------|--------|-----------|
| Total/day | 15 | 30 |
| Flipkart/day | 8 | 8 |
| Amazon/day | 7 | 7 |
| Per category | 4 | 4 |

Enable sale mode: Set `SALE_MODE=true` in environment.

## Time Slots (IST)

| Slot | IST | UTC |
|------|-----|-----|
| Morning | 08:00 | 02:30 |
| Afternoon | 12:00 | 06:30 |
| Evening | 17:00 | 11:30 |
| Night | 21:00 | 15:30 |

## API Endpoints

### GET /api/run

Triggers the posting workflow. Requires authentication.

**Headers:**
```
x-cron-secret: YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "message": "Posted 4 deals",
  "results": {
    "posted": 4,
    "skipped": 2,
    "flipkart": 3,
    "amazon": 1
  }
}
```

## Manual Trigger

Test the API:
```bash
curl -X GET "https://your-app.vercel.app/api/run" \
  -H "x-cron-secret: YOUR_SECRET"
```

## Adding Categories

Edit `config/categories.json`:

```json
{
  "newcategory": {
    "name": "New Category",
    "flipkartId": "xxx",
    "amazonNode": "123456",
    "weight": 2,
    "hashtags": ["#NewCategory", "#Deals"]
  }
}
```

## Troubleshooting

### "No products found"
- Check API credentials
- Verify category IDs are valid
- Increase `minDiscountPercent` filter

### "Rate limited"
- Amazon: New accounts have 1 TPS limit
- Telegram: 30 messages/second limit
- Increase delays in `config/limits.json`

### "Unauthorized"
- Verify `CRON_SECRET` matches in GitHub secrets and Vercel env

## Security

- ✅ All credentials in environment variables
- ✅ No secrets in code or logs
- ✅ CRON_SECRET header validation
- ✅ `.env` files in `.gitignore`

## License

MIT

/**
 * Dry Run Script
 * 
 * Tests the posting flow without actually posting to Telegram.
 * Useful for local development and debugging.
 * 
 * Usage: npm run test:dry
 */

require('dotenv').config({ path: '.env.local' });

const flipkart = require('../lib/flipkart');
const amazon = require('../lib/amazon');
const formatter = require('../lib/formatter');
const dedupe = require('../lib/dedupe');
const scheduler = require('../lib/scheduler');

async function dryRun() {
    console.log('🧪 Daily Trendz Dry Run\n');
    console.log('='.repeat(50));

    // 1. Check environment
    console.log('\n📋 Environment Check:');
    const envVars = [
        'FLIPKART_AFFILIATE_ID',
        'FLIPKART_AFFILIATE_TOKEN',
        'AMAZON_ACCESS_KEY',
        'AMAZON_SECRET_KEY',
        'AMAZON_ASSOCIATE_TAG',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHANNEL_ID'
    ];

    let missingVars = 0;
    for (const varName of envVars) {
        const value = process.env[varName];
        if (value) {
            console.log(`  ✅ ${varName}: ${value.substring(0, 4)}****`);
        } else {
            console.log(`  ❌ ${varName}: NOT SET`);
            missingVars++;
        }
    }

    if (missingVars > 0) {
        console.log(`\n⚠️  ${missingVars} environment variables missing`);
    }

    // 2. Initialize modules
    console.log('\n📦 Initializing modules...');
    dedupe.initialize();
    scheduler.initCounters();

    // 3. Check limits
    console.log('\n📊 Posting Limits:');
    console.log(`  Total: ${scheduler.getTotalLimit()}`);
    console.log(`  Sale Mode: ${scheduler.isSaleMode()}`);
    console.log(`  Current Stats:`, scheduler.getStats());

    // 4. Select categories
    const categories = scheduler.selectCategories(3);
    console.log(`\n📂 Selected Categories: ${categories.join(', ')}`);

    // 5. Test Flipkart API (if configured)
    if (process.env.FLIPKART_AFFILIATE_ID) {
        console.log('\n🛒 Testing Flipkart API...');
        try {
            const feeds = await flipkart.fetchCategoryFeeds();
            console.log(`  Found ${feeds.length} category feeds`);

            if (feeds.length > 0) {
                const sample = feeds[0];
                console.log(`  Sample feed: ${sample.apiName || 'N/A'}`);
            }
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
    }

    // 6. Test Amazon API (if configured)
    if (process.env.AMAZON_ACCESS_KEY) {
        console.log('\n📦 Testing Amazon PA-API...');
        try {
            const products = await amazon.searchProducts('smartphones', null, {
                minDiscountPercent: 5
            });
            console.log(`  Found ${products.length} products`);

            if (products.length > 0) {
                const sample = products[0];
                console.log(`  Sample: ${sample.name?.substring(0, 50)}...`);
                console.log(`  Price: ₹${sample.price} (${sample.discount}% off)`);
            }
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
    }

    // 7. Test formatter
    console.log('\n🎨 Testing Formatter...');
    const sampleProduct = {
        id: 'test-123',
        name: 'Sample Product for Testing',
        price: 12999,
        originalPrice: 15999,
        discount: 19,
        affiliateUrl: 'https://example.com/product',
        source: 'flipkart'
    };

    const formatted = formatter.formatProduct(sampleProduct, 'mobiles');
    console.log('  Sample formatted message:');
    console.log('  ' + formatted.replace(/\n/g, '\n  '));

    // 8. Test dedupe
    console.log('\n🔍 Testing Dedupe...');
    console.log(`  Tracked products: ${dedupe.getTrackedCount()}`);
    console.log(`  Is 'test-123' posted? ${dedupe.isPosted('test-123')}`);

    console.log('\n' + '='.repeat(50));
    console.log('🧪 Dry run complete!');
    console.log('\nTo run the actual posting, deploy to Vercel and trigger via:');
    console.log('  curl -X GET "https://your-app.vercel.app/api/run" -H "x-cron-secret: YOUR_SECRET"');
}

dryRun().catch(console.error);

/**
 * Daily Trendz - Main API Endpoint
 * 
 * Vercel serverless function that orchestrates the posting workflow:
 * 1. Validate request authentication
 * 2. Check daily limits
 * 3. Fetch products from Flipkart/Amazon
 * 4. Filter duplicates
 * 5. Post to Telegram
 * 
 * @module api/run
 */

// Load environment from .env in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: '.env.local' });
}

const flipkart = require('../lib/flipkart');
const amazon = require('../lib/amazon');
const telegram = require('../lib/telegram');
const formatter = require('../lib/formatter');
const dedupe = require('../lib/dedupe');
const scheduler = require('../lib/scheduler');

/**
 * Validate request authentication
 * @param {Object} req - Request object
 * @returns {boolean} True if authenticated
 */
function validateAuth(req) {
    const cronSecret = process.env.CRON_SECRET;

    // If no secret configured, allow all (for testing)
    if (!cronSecret) {
        console.warn('[Auth] No CRON_SECRET configured, allowing request');
        return true;
    }

    // Check header
    const headerSecret = req.headers['x-cron-secret'] || req.headers['authorization'];

    if (headerSecret === cronSecret || headerSecret === `Bearer ${cronSecret}`) {
        return true;
    }

    // Check query param (for GitHub Actions)
    if (req.query?.secret === cronSecret) {
        return true;
    }

    return false;
}

/**
 * Fetch products from configured sources
 * @param {Array} selectedCategories - Categories to fetch
 * @param {Object} filters - Product filters
 * @returns {Promise<Array>} Products from all sources
 */
async function fetchProducts(selectedCategories, filters) {
    const allProducts = [];
    const sources = scheduler.getSourcePriority();

    for (const categoryKey of selectedCategories) {
        const categoryInfo = scheduler.getCategoryInfo(categoryKey);
        if (!categoryInfo) continue;

        // Try Flipkart first if available
        if (sources.includes('flipkart') && categoryInfo.flipkartId) {
            try {
                const products = await flipkart.getProductsByCategory(
                    categoryInfo.flipkartId,
                    filters
                );

                products.forEach(p => {
                    p.categoryKey = categoryKey;
                    allProducts.push(p);
                });
            } catch (error) {
                console.error(`[Fetch] Flipkart error for ${categoryKey}:`, error.message);
            }
        }

        // Try Amazon if available and under limit
        if (sources.includes('amazon') && categoryInfo.amazonNode) {
            const { allowed } = scheduler.canPost('amazon', categoryKey);

            if (allowed) {
                try {
                    const products = await amazon.getProductsByCategory(
                        categoryInfo.amazonNode,
                        categoryInfo.name,
                        filters
                    );

                    products.forEach(p => {
                        p.categoryKey = categoryKey;
                        allProducts.push(p);
                    });
                } catch (error) {
                    console.error(`[Fetch] Amazon error for ${categoryKey}:`, error.message);
                }
            }
        }
    }

    return allProducts;
}

/**
 * Post products to Telegram channel
 * @param {Array} products - Products to post
 * @returns {Promise<Object>} Posting results
 */
async function postProducts(products) {
    const results = {
        posted: 0,
        skipped: 0,
        failed: 0,
        flipkart: 0,
        amazon: 0,
        errors: []
    };

    const postsTarget = scheduler.getPostsForSession();

    for (const product of products) {
        // Check if we've reached session limit
        if (results.posted >= postsTarget) {
            console.log('[Post] Session post limit reached');
            break;
        }

        // Check daily limits
        const { allowed, reason } = scheduler.canPost(product.source, product.categoryKey);
        if (!allowed) {
            console.log(`[Post] Skipping: ${reason}`);
            results.skipped++;
            continue;
        }

        // Check for duplicate
        if (dedupe.isDuplicate(product.id, product.source)) {
            console.log(`[Post] Duplicate: ${product.id}`);
            results.skipped++;
            continue;
        }

        // Format message
        const message = formatter.formatProduct(product, product.categoryKey);

        // Post to Telegram
        try {
            const success = await telegram.postDeal(message, product.imageUrl);

            if (success) {
                results.posted++;
                results[product.source]++;

                // Mark as posted
                dedupe.markPosted(product.id, product.source);
                scheduler.incrementCounters(product.source, product.categoryKey);

                console.log(`[Post] Success: ${product.name.substring(0, 50)}...`);

                // Delay between posts
                await telegram.postDelay();
            } else {
                results.failed++;
                results.errors.push(`Failed to post: ${product.id}`);
            }
        } catch (error) {
            results.failed++;
            results.errors.push(error.message);
            console.error(`[Post] Error:`, error.message);

            // Stop on rate limit
            if (error.message?.includes('Too Many Requests')) {
                console.error('[Post] Rate limited, stopping');
                break;
            }
        }
    }

    return results;
}

/**
 * Main handler function
 * @param {Object} req - Vercel request
 * @param {Object} res - Vercel response
 */
async function handler(req, res) {
    const startTime = Date.now();

    console.log('[Run] Daily Trendz posting started');
    console.log(`[Run] Sale mode: ${scheduler.isSaleMode()}`);

    try {
        // 1. Validate authentication
        if (!validateAuth(req)) {
            console.warn('[Run] Unauthorized request');
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        // 2. Initialize modules
        dedupe.initialize();
        scheduler.initCounters();

        // 3. Check if we have room for more posts
        const stats = scheduler.getStats();
        const totalLimit = scheduler.getTotalLimit();

        if (stats.total >= totalLimit) {
            console.log('[Run] Daily limit already reached');
            return res.status(200).json({
                success: true,
                message: 'Daily limit reached',
                stats: stats
            });
        }

        // 4. Select categories for this session
        const selectedCategories = scheduler.selectCategories(3);
        console.log(`[Run] Selected categories: ${selectedCategories.join(', ')}`);

        // 5. Get filter settings
        const filters = scheduler.getFilters();

        // 6. Fetch products
        console.log('[Run] Fetching products...');
        const products = await fetchProducts(selectedCategories, filters);
        console.log(`[Run] Fetched ${products.length} products`);

        if (products.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No products found matching criteria',
                stats: stats
            });
        }

        // 7. Filter duplicates
        const uniqueProducts = dedupe.filterDuplicates(products);
        console.log(`[Run] After dedupe: ${uniqueProducts.length} products`);

        // 8. Sort by discount (best deals first)
        uniqueProducts.sort((a, b) => b.discount - a.discount);

        // 9. Post to Telegram
        console.log('[Run] Posting to Telegram...');
        const results = await postProducts(uniqueProducts);

        // 10. Save dedupe data
        dedupe.flush();

        // 11. Calculate duration
        const duration = Date.now() - startTime;

        console.log(`[Run] Completed in ${duration}ms`);
        console.log(`[Run] Results: ${JSON.stringify(results)}`);

        return res.status(200).json({
            success: true,
            message: `Posted ${results.posted} deals`,
            results: results,
            stats: scheduler.getStats(),
            duration: `${duration}ms`
        });

    } catch (error) {
        console.error('[Run] Fatal error:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}

module.exports = handler;

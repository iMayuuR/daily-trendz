/**
 * Flipkart Affiliate API Integration
 * 
 * Uses Flipkart Affiliate API v1.0 to fetch product feeds.
 * Products include affiliate links directly in the feed.
 * 
 * @module lib/flipkart
 */

const fetch = require('node-fetch');
const settings = require('../config/settings.json');

// API base URL from settings
const API_BASE = settings.sources.flipkart.apiBaseUrl;

/**
 * Create headers for Flipkart API requests
 * @returns {Object} Headers object with auth credentials
 */
function getHeaders() {
    const affiliateId = process.env.FLIPKART_AFFILIATE_ID;
    const token = process.env.FLIPKART_AFFILIATE_TOKEN;

    if (!affiliateId || !token) {
        throw new Error('Flipkart credentials not configured');
    }

    return {
        'Fk-Affiliate-Id': affiliateId,
        'Fk-Affiliate-Token': token,
        'Accept': 'application/json'
    };
}

/**
 * Fetch available category feeds from Flipkart
 * @returns {Promise<Array>} List of available category feeds
 */
async function fetchCategoryFeeds() {
    try {
        const response = await fetch(`${API_BASE}/api/${process.env.FLIPKART_AFFILIATE_ID}.json`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Flipkart API error: ${response.status}`);
        }

        const data = await response.json();
        return data.apiGroups?.affiliate?.apiListings || [];
    } catch (error) {
        console.error('[Flipkart] Failed to fetch category feeds:', error.message);
        return [];
    }
}

/**
 * Fetch products from a specific category feed
 * @param {string} categoryUrl - The feed URL for the category
 * @param {Object} filters - Filter options (minDiscount, inStock)
 * @returns {Promise<Array>} Filtered list of products
 */
async function fetchCategoryProducts(categoryUrl, filters = {}) {
    try {
        const response = await fetch(categoryUrl, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Flipkart feed error: ${response.status}`);
        }

        const data = await response.json();
        const products = data.products || data.productInfoList || [];

        // Transform and filter products
        return products
            .map(item => {
                const product = item.productBaseInfoV1 || item.productBaseInfo?.v1 || item;
                const prices = product.flipkartSpecialPrice || product.flipkartSellingPrice || {};
                const mrp = product.maximumRetailPrice || {};

                const sellingPrice = prices.amount || 0;
                const originalPrice = mrp.amount || sellingPrice;
                const discount = originalPrice > 0
                    ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100)
                    : 0;

                return {
                    id: product.productId,
                    name: product.title || product.productName,
                    price: sellingPrice,
                    originalPrice: originalPrice,
                    discount: discount,
                    currency: prices.currency || 'INR',
                    inStock: product.inStock !== false,
                    imageUrl: (product.imageUrls?.['200x200'] || product.imageUrls?.['400x400'] || ''),
                    affiliateUrl: product.productUrl, // Affiliate link from feed
                    source: 'flipkart',
                    category: product.categoryPath || ''
                };
            })
            .filter(product => {
                // Apply filters
                if (!product.id || !product.name || !product.affiliateUrl) return false;
                if (filters.requireInStock && !product.inStock) return false;
                if (filters.minDiscountPercent && product.discount < filters.minDiscountPercent) return false;
                if (filters.minPriceDrop && (product.originalPrice - product.price) < filters.minPriceDrop) return false;
                return true;
            })
            .slice(0, 20); // Limit results per category
    } catch (error) {
        console.error('[Flipkart] Failed to fetch products:', error.message);
        return [];
    }
}

/**
 * Get products for a specific category by ID
 * @param {string} categoryId - Flipkart category ID from config
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} List of products
 */
async function getProductsByCategory(categoryId, filters = {}) {
    try {
        // First, get the feed URL for this category
        const feeds = await fetchCategoryFeeds();

        // Find matching feed by category ID or name
        const categoryFeed = feeds.find(feed =>
            feed.apiName?.toLowerCase().includes(categoryId.toLowerCase()) ||
            feed.resourceName?.toLowerCase().includes(categoryId.toLowerCase())
        );

        if (!categoryFeed || !categoryFeed.get) {
            console.warn(`[Flipkart] No feed found for category: ${categoryId}`);
            return [];
        }

        return await fetchCategoryProducts(categoryFeed.get, filters);
    } catch (error) {
        console.error('[Flipkart] getProductsByCategory error:', error.message);
        return [];
    }
}

/**
 * Get best deals across all categories
 * @param {Object} filters - Filter options
 * @param {number} limit - Maximum number of products
 * @returns {Promise<Array>} Top deals sorted by discount
 */
async function getBestDeals(filters = {}, limit = 10) {
    try {
        const feeds = await fetchCategoryFeeds();
        let allProducts = [];

        // Fetch from multiple feeds
        const feedPromises = feeds.slice(0, 5).map(feed =>
            feed.get ? fetchCategoryProducts(feed.get, filters) : Promise.resolve([])
        );

        const results = await Promise.allSettled(feedPromises);

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                allProducts = allProducts.concat(result.value);
            }
        });

        // Sort by discount and return top deals
        return allProducts
            .sort((a, b) => b.discount - a.discount)
            .slice(0, limit);
    } catch (error) {
        console.error('[Flipkart] getBestDeals error:', error.message);
        return [];
    }
}

module.exports = {
    fetchCategoryFeeds,
    fetchCategoryProducts,
    getProductsByCategory,
    getBestDeals
};

/**
 * Amazon Product Advertising API 5.0 Integration
 * 
 * Uses amazon-paapi npm package for PA-API 5.0.
 * Strict rate limiting enforced (1 TPS for new accounts).
 * 
 * @module lib/amazon
 */

const amazonPaapi = require('amazon-paapi');
const settings = require('../config/settings.json');

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds (safe buffer for 1 TPS)

/**
 * Get Amazon PA-API common parameters
 * @returns {Object} Common parameters for all requests
 */
function getCommonParams() {
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    const partnerTag = process.env.AMAZON_ASSOCIATE_TAG;

    if (!accessKey || !secretKey || !partnerTag) {
        throw new Error('Amazon PA-API credentials not configured');
    }

    return {
        AccessKey: accessKey,
        SecretKey: secretKey,
        PartnerTag: partnerTag,
        PartnerType: 'Associates',
        Marketplace: settings.sources.amazon.marketplace
    };
}

/**
 * Enforce rate limiting (1 request per second)
 */
async function enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();
}

/**
 * Transform Amazon API response to standard product format
 * @param {Object} item - Amazon product item
 * @param {string} category - Category name
 * @returns {Object} Standardized product object
 */
function transformProduct(item, category = '') {
    const listing = item.Offers?.Listings?.[0];
    const price = listing?.Price?.Amount || 0;
    const savingsPercent = listing?.Price?.Savings?.Percentage || 0;
    const originalPrice = savingsPercent > 0
        ? Math.round(price / (1 - savingsPercent / 100))
        : price;

    return {
        id: item.ASIN,
        name: item.ItemInfo?.Title?.DisplayValue || 'Unknown Product',
        price: price,
        originalPrice: originalPrice,
        discount: savingsPercent,
        currency: listing?.Price?.Currency || 'INR',
        inStock: listing?.Availability?.Type === 'Now',
        imageUrl: item.Images?.Primary?.Medium?.URL || '',
        affiliateUrl: item.DetailPageURL, // Affiliate link with tag
        source: 'amazon',
        category: category,
        rating: item.CustomerReviews?.StarRating?.Value || null
    };
}

/**
 * Search products by keywords
 * @param {string} keywords - Search keywords
 * @param {string} browseNodeId - Optional category node ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} List of products
 */
async function searchProducts(keywords, browseNodeId = null, filters = {}) {
    try {
        await enforceRateLimit();

        const requestParams = {
            Keywords: keywords,
            Resources: [
                'ItemInfo.Title',
                'ItemInfo.Features',
                'Offers.Listings.Price',
                'Offers.Listings.Availability.Type',
                'Images.Primary.Medium',
                'CustomerReviews.StarRating'
            ],
            ItemCount: 10
        };

        if (browseNodeId) {
            requestParams.BrowseNodeId = browseNodeId;
        }

        // Apply price filters if provided
        if (filters.minPrice) {
            requestParams.MinPrice = filters.minPrice * 100; // Convert to paise
        }
        if (filters.maxPrice) {
            requestParams.MaxPrice = filters.maxPrice * 100;
        }

        const response = await amazonPaapi.SearchItems(getCommonParams(), requestParams);

        if (!response.SearchResult?.Items) {
            return [];
        }

        return response.SearchResult.Items
            .map(item => transformProduct(item, keywords))
            .filter(product => {
                if (filters.minDiscountPercent && product.discount < filters.minDiscountPercent) return false;
                if (filters.requireInStock && !product.inStock) return false;
                return true;
            });
    } catch (error) {
        console.error('[Amazon] Search error:', error.message);
        return [];
    }
}

/**
 * Get products by category node
 * @param {string} nodeId - Amazon browse node ID
 * @param {string} categoryName - Category name for display
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} List of products
 */
async function getProductsByCategory(nodeId, categoryName, filters = {}) {
    try {
        await enforceRateLimit();

        const requestParams = {
            BrowseNodeId: nodeId,
            Resources: [
                'ItemInfo.Title',
                'Offers.Listings.Price',
                'Offers.Listings.Availability.Type',
                'Images.Primary.Medium',
                'CustomerReviews.StarRating'
            ],
            ItemCount: 10
        };

        const response = await amazonPaapi.SearchItems(getCommonParams(), {
            ...requestParams,
            Keywords: categoryName // Fallback for node-based search
        });

        if (!response.SearchResult?.Items) {
            return [];
        }

        return response.SearchResult.Items
            .map(item => transformProduct(item, categoryName))
            .filter(product => {
                if (filters.minDiscountPercent && product.discount < filters.minDiscountPercent) return false;
                if (filters.requireInStock && !product.inStock) return false;
                return true;
            });
    } catch (error) {
        console.error('[Amazon] Category fetch error:', error.message);
        return [];
    }
}

/**
 * Get deals and offers (searches for deal-related keywords)
 * @param {Object} filters - Filter options
 * @param {number} limit - Maximum products
 * @returns {Promise<Array>} List of deals
 */
async function getDeals(filters = {}, limit = 5) {
    try {
        // Search for deals using common deal keywords
        const dealKeywords = ['deals', 'offers', 'sale'];
        let allDeals = [];

        for (const keyword of dealKeywords) {
            if (allDeals.length >= limit) break;

            const products = await searchProducts(keyword, null, {
                ...filters,
                minDiscountPercent: filters.minDiscountPercent || 15
            });

            allDeals = allDeals.concat(products);
        }

        // Sort by discount and dedupe by ID
        const seen = new Set();
        return allDeals
            .filter(product => {
                if (seen.has(product.id)) return false;
                seen.add(product.id);
                return true;
            })
            .sort((a, b) => b.discount - a.discount)
            .slice(0, limit);
    } catch (error) {
        console.error('[Amazon] getDeals error:', error.message);
        return [];
    }
}

/**
 * Get product details by ASIN
 * @param {string} asin - Amazon ASIN
 * @returns {Promise<Object|null>} Product details or null
 */
async function getProductByAsin(asin) {
    try {
        await enforceRateLimit();

        const response = await amazonPaapi.GetItems(getCommonParams(), {
            ItemIds: [asin],
            Resources: [
                'ItemInfo.Title',
                'ItemInfo.Features',
                'Offers.Listings.Price',
                'Offers.Listings.Availability.Type',
                'Images.Primary.Medium',
                'CustomerReviews.StarRating'
            ]
        });

        if (!response.ItemsResult?.Items?.[0]) {
            return null;
        }

        return transformProduct(response.ItemsResult.Items[0]);
    } catch (error) {
        console.error('[Amazon] ASIN lookup error:', error.message);
        return null;
    }
}

module.exports = {
    searchProducts,
    getProductsByCategory,
    getDeals,
    getProductByAsin
};

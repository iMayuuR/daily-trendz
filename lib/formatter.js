/**
 * Message Formatter
 * 
 * Formats product data into Telegram-friendly messages
 * with emojis, pricing, and hashtags.
 * 
 * @module lib/formatter
 */

const categories = require('../config/categories.json');

/**
 * Format price with Indian rupee symbol and commas
 * @param {number} price - Price in rupees
 * @returns {string} Formatted price string
 */
function formatPrice(price) {
    if (!price || isNaN(price)) return '₹0';
    return '₹' + price.toLocaleString('en-IN');
}

/**
 * Get discount badge text
 * @param {number} discount - Discount percentage
 * @param {number} priceDrop - Price drop amount
 * @returns {string} Discount badge or empty string
 */
function getDiscountBadge(discount, priceDrop) {
    if (discount >= 50) return '🔥 MEGA DEAL';
    if (discount >= 30) return '💥 HOT DEAL';
    if (discount >= 15) return '✨ GREAT PRICE';
    if (priceDrop >= 2000) return '📉 PRICE DROP';
    return '';
}

/**
 * Get source emoji
 * @param {string} source - Product source (flipkart/amazon)
 * @returns {string} Emoji for source
 */
function getSourceEmoji(source) {
    const emojis = {
        flipkart: '🛒',
        amazon: '📦'
    };
    return emojis[source?.toLowerCase()] || '🛍️';
}

/**
 * Get source label
 * @param {string} source - Product source
 * @returns {string} Display label
 */
function getSourceLabel(source) {
    const labels = {
        flipkart: 'Flipkart Deal',
        amazon: 'Amazon Deal'
    };
    return labels[source?.toLowerCase()] || 'Deal';
}

/**
 * Get hashtags for a category
 * @param {string} categoryKey - Category key from config
 * @returns {string} Hashtags string
 */
function getCategoryHashtags(categoryKey) {
    const category = categories[categoryKey];
    if (category?.hashtags) {
        return category.hashtags.join(' ');
    }
    return '#Deals #Offers';
}

/**
 * Escape HTML special characters for Telegram
 * @param {string} text - Raw text
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format a product into a Telegram message
 * @param {Object} product - Product object
 * @param {string} categoryKey - Category key for hashtags
 * @returns {string} Formatted HTML message
 */
function formatProduct(product, categoryKey = null) {
    const {
        name,
        price,
        originalPrice,
        discount,
        affiliateUrl,
        source
    } = product;

    const sourceEmoji = getSourceEmoji(source);
    const sourceLabel = getSourceLabel(source);
    const priceDrop = originalPrice - price;
    const discountBadge = getDiscountBadge(discount, priceDrop);
    const hashtags = getCategoryHashtags(categoryKey);
    const productName = escapeHtml(truncate(name, 80));

    // Build message parts
    const lines = [];

    // Header with badge if applicable
    if (discountBadge) {
        lines.push(discountBadge);
        lines.push('');
    }

    lines.push(`${sourceEmoji} <b>${sourceLabel}</b>`);
    lines.push('');
    lines.push(`📱 ${productName}`);
    lines.push('');

    // Pricing section
    if (discount > 0 && originalPrice > price) {
        lines.push(`💰 <b>${formatPrice(price)}</b> <s>${formatPrice(originalPrice)}</s>`);
        lines.push(`🏷️ ${discount}% OFF (Save ${formatPrice(priceDrop)})`);
    } else {
        lines.push(`💰 <b>${formatPrice(price)}</b>`);
    }

    lines.push('');
    lines.push(`👉 <a href="${affiliateUrl}">Buy Now</a>`);
    lines.push('');
    lines.push(hashtags);

    return lines.join('\n');
}

/**
 * Format a simple deal alert (for flash sales)
 * @param {Object} product - Product object
 * @returns {string} Formatted HTML message
 */
function formatFlashDeal(product) {
    const { name, price, discount, affiliateUrl, source } = product;
    const productName = escapeHtml(truncate(name, 60));
    const sourceLabel = getSourceLabel(source);

    return `⚡ <b>FLASH DEAL</b> ⚡

${productName}

💰 ${formatPrice(price)} (${discount}% OFF)

🔗 <a href="${affiliateUrl}">${sourceLabel}</a>

#FlashDeal #LimitedTime`;
}

/**
 * Format daily summary message
 * @param {Object} stats - Posting statistics
 * @returns {string} Formatted summary
 */
function formatDailySummary(stats) {
    return `📊 <b>Daily Trendz Summary</b>

✅ Posted: ${stats.posted || 0} deals
📦 Amazon: ${stats.amazon || 0}
🛒 Flipkart: ${stats.flipkart || 0}
❌ Skipped: ${stats.skipped || 0} (duplicates)

Stay tuned for more deals! 🔔`;
}

module.exports = {
    formatPrice,
    getDiscountBadge,
    getCategoryHashtags,
    escapeHtml,
    truncate,
    formatProduct,
    formatFlashDeal,
    formatDailySummary
};

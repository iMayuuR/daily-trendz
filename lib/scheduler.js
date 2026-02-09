/**
 * Scheduler & Category Rotation Logic
 * 
 * Manages category rotation, posting caps, and time slot validation.
 * Config-driven approach for all limits and settings.
 * 
 * @module lib/scheduler
 */

const categories = require('../config/categories.json');
const limits = require('../config/limits.json');

// Daily posting counters (reset on each run for serverless)
// In production, consider persisting these to a file or KV store
let dailyCounters = {
    flipkart: 0,
    amazon: 0,
    total: 0,
    byCategory: {},
    date: null
};

/**
 * Initialize or reset daily counters
 * @param {boolean} force - Force reset even if same day
 */
function initCounters(force = false) {
    const today = new Date().toISOString().split('T')[0];

    if (force || dailyCounters.date !== today) {
        dailyCounters = {
            flipkart: 0,
            amazon: 0,
            total: 0,
            byCategory: {},
            date: today
        };
    }
}

/**
 * Check if sale mode is enabled
 * @returns {boolean} True if sale mode is active
 */
function isSaleMode() {
    return process.env.SALE_MODE?.toLowerCase() === 'true';
}

/**
 * Get the current daily limit for total posts
 * @returns {number} Maximum posts allowed today
 */
function getTotalLimit() {
    // Check for override
    if (process.env.OVERRIDE_TOTAL_LIMIT) {
        return parseInt(process.env.OVERRIDE_TOTAL_LIMIT, 10);
    }

    // Sale mode has higher limit
    if (isSaleMode()) {
        return limits.dailyLimits.saleMode;
    }

    return limits.dailyLimits.total;
}

/**
 * Check if we can post more (under daily limits)
 * @param {string} source - Product source (flipkart/amazon)
 * @param {string} categoryKey - Category key
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canPost(source, categoryKey) {
    initCounters();

    const totalLimit = getTotalLimit();
    const sourceLimit = limits.dailyLimits[source] || 10;
    const categoryLimit = limits.dailyLimits.perCategory || 4;

    // Check total limit
    if (dailyCounters.total >= totalLimit) {
        return { allowed: false, reason: 'Daily total limit reached' };
    }

    // Check source limit
    if (dailyCounters[source] >= sourceLimit) {
        return { allowed: false, reason: `Daily ${source} limit reached` };
    }

    // Check category limit
    const categoryCount = dailyCounters.byCategory[categoryKey] || 0;
    if (categoryCount >= categoryLimit) {
        return { allowed: false, reason: `Category ${categoryKey} limit reached` };
    }

    return { allowed: true, reason: 'OK' };
}

/**
 * Increment counters after successful post
 * @param {string} source - Product source
 * @param {string} categoryKey - Category key
 */
function incrementCounters(source, categoryKey) {
    initCounters();

    dailyCounters.total++;
    dailyCounters[source] = (dailyCounters[source] || 0) + 1;
    dailyCounters.byCategory[categoryKey] = (dailyCounters.byCategory[categoryKey] || 0) + 1;
}

/**
 * Get current posting statistics
 * @returns {Object} Current counters
 */
function getStats() {
    initCounters();
    return { ...dailyCounters };
}

/**
 * Select categories for this posting session using weighted random
 * @param {number} count - Number of categories to select
 * @returns {Array} Array of category keys
 */
function selectCategories(count = 3) {
    const categoryKeys = Object.keys(categories);
    const selected = [];

    // Build weighted array
    const weighted = [];
    for (const key of categoryKeys) {
        const weight = categories[key].weight || 1;
        for (let i = 0; i < weight; i++) {
            weighted.push(key);
        }
    }

    // Random selection without duplicates
    while (selected.length < count && weighted.length > 0) {
        const index = Math.floor(Math.random() * weighted.length);
        const category = weighted[index];

        if (!selected.includes(category)) {
            selected.push(category);
        }

        // Remove all instances of selected category
        for (let i = weighted.length - 1; i >= 0; i--) {
            if (weighted[i] === category) {
                weighted.splice(i, 1);
            }
        }
    }

    return selected;
}

/**
 * Determine source priority for this session
 * Flipkart has priority, Amazon is secondary
 * @returns {Array} Ordered array of sources
 */
function getSourcePriority() {
    initCounters();

    const sources = [];

    // Check if Flipkart has room
    if (dailyCounters.flipkart < limits.dailyLimits.flipkart) {
        sources.push('flipkart');
    }

    // Check if Amazon has room
    if (dailyCounters.amazon < limits.dailyLimits.amazon) {
        sources.push('amazon');
    }

    return sources;
}

/**
 * Calculate posts to make this session
 * @returns {number} Number of posts for this time slot
 */
function getPostsForSession() {
    initCounters();

    const postsPerSlot = limits.posting?.postsPerSlot || 4;
    const totalLimit = getTotalLimit();
    const remaining = totalLimit - dailyCounters.total;

    return Math.min(postsPerSlot, remaining);
}

/**
 * Get filter settings from config
 * @returns {Object} Filter options
 */
function getFilters() {
    return {
        minDiscountPercent: limits.filters?.minDiscountPercent || 10,
        minPriceDrop: limits.filters?.minPriceDrop || 500,
        requireInStock: limits.filters?.requireInStock !== false
    };
}

/**
 * Get category info by key
 * @param {string} categoryKey - Category key
 * @returns {Object|null} Category info or null
 */
function getCategoryInfo(categoryKey) {
    return categories[categoryKey] || null;
}

/**
 * Get all category keys
 * @returns {Array} List of category keys
 */
function getAllCategories() {
    return Object.keys(categories);
}

/**
 * Reset all counters (for testing)
 */
function resetCounters() {
    dailyCounters = {
        flipkart: 0,
        amazon: 0,
        total: 0,
        byCategory: {},
        date: null
    };
}

module.exports = {
    initCounters,
    isSaleMode,
    getTotalLimit,
    canPost,
    incrementCounters,
    getStats,
    selectCategories,
    getSourcePriority,
    getPostsForSession,
    getFilters,
    getCategoryInfo,
    getAllCategories,
    resetCounters
};

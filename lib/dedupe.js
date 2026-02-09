/**
 * Duplicate Prevention Module
 * 
 * Tracks posted product IDs to prevent duplicate posts.
 * Uses in-memory cache with JSON file persistence.
 * 
 * @module lib/dedupe
 */

const fs = require('fs');
const path = require('path');
const limits = require('../config/limits.json');

// Data file path
const DATA_DIR = path.join(__dirname, '..', 'data');
const POSTED_FILE = path.join(DATA_DIR, 'posted.json');

// In-memory cache
let postedProducts = new Map();

// Deduplication settings
const TTL_DAYS = limits.deduplication?.ttlDays || 7;
const MAX_TRACKED = limits.deduplication?.maxTrackedProducts || 1000;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Load posted products from file
 */
function loadFromFile() {
    try {
        ensureDataDir();

        if (fs.existsSync(POSTED_FILE)) {
            const data = JSON.parse(fs.readFileSync(POSTED_FILE, 'utf8'));
            const now = Date.now();

            // Convert to Map and filter expired entries
            postedProducts = new Map(
                Object.entries(data)
                    .filter(([_, timestamp]) => (now - timestamp) < TTL_MS)
            );

            console.log(`[Dedupe] Loaded ${postedProducts.size} tracked products`);
        }
    } catch (error) {
        console.error('[Dedupe] Failed to load posted file:', error.message);
        postedProducts = new Map();
    }
}

/**
 * Save posted products to file
 */
function saveToFile() {
    try {
        ensureDataDir();

        // Clean up expired entries before saving
        cleanupExpired();

        // Enforce max tracked limit
        if (postedProducts.size > MAX_TRACKED) {
            const entries = Array.from(postedProducts.entries());
            entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp, oldest first

            // Keep only the newest entries
            postedProducts = new Map(entries.slice(-MAX_TRACKED));
        }

        // Convert Map to object and save
        const data = Object.fromEntries(postedProducts);
        fs.writeFileSync(POSTED_FILE, JSON.stringify(data, null, 2));

        console.log(`[Dedupe] Saved ${postedProducts.size} tracked products`);
    } catch (error) {
        console.error('[Dedupe] Failed to save posted file:', error.message);
    }
}

/**
 * Remove expired entries from cache
 */
function cleanupExpired() {
    const now = Date.now();
    let removed = 0;

    for (const [id, timestamp] of postedProducts.entries()) {
        if ((now - timestamp) >= TTL_MS) {
            postedProducts.delete(id);
            removed++;
        }
    }

    if (removed > 0) {
        console.log(`[Dedupe] Cleaned up ${removed} expired entries`);
    }
}

/**
 * Initialize the dedupe module (load from file)
 */
function initialize() {
    loadFromFile();
}

/**
 * Check if a product has already been posted
 * @param {string} productId - Product ID
 * @returns {boolean} True if already posted
 */
function isPosted(productId) {
    if (!productId) return false;

    // Normalize ID (combine source + id for uniqueness)
    const normalizedId = String(productId).toLowerCase();

    if (postedProducts.has(normalizedId)) {
        const timestamp = postedProducts.get(normalizedId);
        const age = Date.now() - timestamp;

        // Check if still within TTL
        if (age < TTL_MS) {
            return true;
        }

        // Expired, remove it
        postedProducts.delete(normalizedId);
    }

    return false;
}

/**
 * Mark a product as posted
 * @param {string} productId - Product ID
 * @param {string} source - Product source (flipkart/amazon)
 */
function markPosted(productId, source = '') {
    if (!productId) return;

    // Create unique key: source_id
    const uniqueKey = source
        ? `${source.toLowerCase()}_${productId}`.toLowerCase()
        : String(productId).toLowerCase();

    postedProducts.set(uniqueKey, Date.now());
}

/**
 * Check if product is posted using combined key
 * @param {string} productId - Product ID
 * @param {string} source - Product source
 * @returns {boolean} True if already posted
 */
function isDuplicate(productId, source = '') {
    const uniqueKey = source
        ? `${source.toLowerCase()}_${productId}`.toLowerCase()
        : String(productId).toLowerCase();

    return isPosted(uniqueKey);
}

/**
 * Filter out duplicate products from a list
 * @param {Array} products - List of products
 * @returns {Array} Filtered list without duplicates
 */
function filterDuplicates(products) {
    return products.filter(product => {
        if (!product?.id) return false;
        return !isDuplicate(product.id, product.source);
    });
}

/**
 * Get count of tracked products
 * @returns {number} Number of tracked products
 */
function getTrackedCount() {
    return postedProducts.size;
}

/**
 * Clear all tracked products (for testing)
 */
function clear() {
    postedProducts.clear();
}

/**
 * Flush changes to disk
 */
function flush() {
    saveToFile();
}

module.exports = {
    initialize,
    isPosted,
    markPosted,
    isDuplicate,
    filterDuplicates,
    getTrackedCount,
    saveToFile,
    loadFromFile,
    clear,
    flush
};

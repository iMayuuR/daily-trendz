/**
 * Telegram Bot API Integration
 * 
 * Posts formatted messages to Telegram channels.
 * Uses Bot API sendMessage endpoint (no webhooks needed).
 * 
 * @module lib/telegram
 */

const fetch = require('node-fetch');
const settings = require('../config/settings.json');
const limits = require('../config/limits.json');

const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Get Telegram bot credentials
 * @returns {Object} Bot token and channel ID
 */
function getCredentials() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!botToken || !channelId) {
        throw new Error('Telegram credentials not configured');
    }

    return { botToken, channelId };
}

/**
 * Send a message to the Telegram channel
 * @param {string} text - Message text (HTML format)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Telegram API response
 */
async function sendMessage(text, options = {}) {
    const { botToken, channelId } = getCredentials();
    const telegramSettings = settings.telegram;

    const payload = {
        chat_id: channelId,
        text: text,
        parse_mode: telegramSettings.parseMode || 'HTML',
        disable_web_page_preview: telegramSettings.disableWebPagePreview || false,
        disable_notification: telegramSettings.disableNotification || false,
        ...options
    };

    try {
        const response = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.ok) {
            throw new Error(data.description || 'Telegram API error');
        }

        return data;
    } catch (error) {
        console.error('[Telegram] Send error:', error.message);
        throw error;
    }
}

/**
 * Send a message with retry logic
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} Response or null on failure
 */
async function sendMessageWithRetry(text, options = {}) {
    const maxRetries = limits.posting.retryOnFailure ? limits.posting.maxRetries : 0;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await sendMessage(text, options);
        } catch (error) {
            lastError = error;

            // Check for rate limit error
            if (error.message?.includes('Too Many Requests')) {
                console.warn('[Telegram] Rate limited, aborting');
                break;
            }

            // Wait before retry
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    console.error('[Telegram] All retries failed:', lastError?.message);
    return null;
}

/**
 * Send a photo with caption to the channel
 * @param {string} photoUrl - URL of the image
 * @param {string} caption - Caption text (HTML format)
 * @returns {Promise<Object|null>} Response or null on failure
 */
async function sendPhoto(photoUrl, caption) {
    const { botToken, channelId } = getCredentials();

    const payload = {
        chat_id: channelId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML'
    };

    try {
        const response = await fetch(`${TELEGRAM_API}${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.ok) {
            throw new Error(data.description || 'Telegram photo send error');
        }

        return data;
    } catch (error) {
        console.error('[Telegram] Photo send error:', error.message);
        return null;
    }
}

/**
 * Post a product deal to the channel
 * @param {string} formattedMessage - Pre-formatted message
 * @param {string} imageUrl - Optional product image URL
 * @returns {Promise<boolean>} Success status
 */
async function postDeal(formattedMessage, imageUrl = null) {
    try {
        // If image URL provided and valid, send as photo
        if (imageUrl && imageUrl.startsWith('http')) {
            const result = await sendPhoto(imageUrl, formattedMessage);
            if (result) return true;
            // Fallback to text-only if photo fails
        }

        // Send as text message
        const result = await sendMessageWithRetry(formattedMessage);
        return result !== null;
    } catch (error) {
        console.error('[Telegram] postDeal error:', error.message);
        return false;
    }
}

/**
 * Delay between posts to avoid flooding
 * @returns {Promise<void>}
 */
async function postDelay() {
    const delayMs = limits.posting.delayBetweenPostsMs || 2000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Verify bot connection and permissions
 * @returns {Promise<boolean>} True if bot is working
 */
async function verifyConnection() {
    try {
        const { botToken } = getCredentials();

        const response = await fetch(`${TELEGRAM_API}${botToken}/getMe`);
        const data = await response.json();

        if (!data.ok) {
            throw new Error('Bot verification failed');
        }

        console.log(`[Telegram] Bot connected: @${data.result.username}`);
        return true;
    } catch (error) {
        console.error('[Telegram] Connection verification failed:', error.message);
        return false;
    }
}

module.exports = {
    sendMessage,
    sendMessageWithRetry,
    sendPhoto,
    postDeal,
    postDelay,
    verifyConnection
};

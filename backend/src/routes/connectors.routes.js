const express = require('express');
const { auth } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// Check if OAuth is enabled for each connector
const GOOGLE_DRIVE_ENABLED = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const GMAIL_ENABLED = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
const SLACK_ENABLED = !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);

/**
 * GET /api/connectors/status
 * Get status of all available connectors
 */
router.get('/status', auth(), (req, res) => {
    res.json({
        googleDrive: {
            enabled: GOOGLE_DRIVE_ENABLED,
            connected: false, // TODO: Check user's OAuth tokens
            name: 'Google Drive',
        },
        gmail: {
            enabled: GMAIL_ENABLED,
            connected: false,
            name: 'Gmail',
        },
        slack: {
            enabled: SLACK_ENABLED,
            connected: false,
            name: 'Slack',
        },
    });
});

/**
 * Google Drive OAuth endpoints
 */
if (GOOGLE_DRIVE_ENABLED) {
    router.get('/google-drive/auth', auth(), (req, res) => {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
            `redirect_uri=${process.env.BACKEND_URL}/api/connectors/google-drive/callback&` +
            `response_type=code&` +
            `scope=https://www.googleapis.com/auth/drive.readonly&` +
            `access_type=offline&` +
            `state=${req.user._id}`;

        res.json({ authUrl });
    });

    router.get('/google-drive/callback', async (req, res) => {
        const { code, state } = req.query;

        try {
            // TODO: Exchange code for tokens
            // TODO: Store tokens in database
            // TODO: Redirect to frontend with success message

            res.redirect(`${process.env.FRONTEND_URL}/settings?connector=google-drive&status=success`);
        } catch (error) {
            logger.error('Google Drive OAuth error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/settings?connector=google-drive&status=error`);
        }
    });

    router.post('/google-drive/import', auth(), async (req, res, next) => {
        try {
            const { fileId } = req.body;

            if (!fileId) {
                return res.status(400).json({ error: 'File ID is required' });
            }

            // TODO: Fetch file from Google Drive using stored OAuth tokens
            // TODO: Process file and create Source/Fragments

            res.json({
                success: true,
                message: 'Google Drive connector is a stub. Implement OAuth flow and Drive API calls.',
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/google-drive/disconnect', auth(), async (req, res, next) => {
        try {
            // TODO: Revoke OAuth tokens
            // TODO: Remove tokens from database

            res.json({ success: true, message: 'Disconnected from Google Drive' });
        } catch (error) {
            next(error);
        }
    });
}

/**
 * Gmail OAuth endpoints
 */
if (GMAIL_ENABLED) {
    router.get('/gmail/auth', auth(), (req, res) => {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${process.env.GMAIL_CLIENT_ID}&` +
            `redirect_uri=${process.env.BACKEND_URL}/api/connectors/gmail/callback&` +
            `response_type=code&` +
            `scope=https://www.googleapis.com/auth/gmail.readonly&` +
            `access_type=offline&` +
            `state=${req.user._id}`;

        res.json({ authUrl });
    });

    router.get('/gmail/callback', async (req, res) => {
        const { code, state } = req.query;

        try {
            // TODO: Exchange code for tokens
            res.redirect(`${process.env.FRONTEND_URL}/settings?connector=gmail&status=success`);
        } catch (error) {
            logger.error('Gmail OAuth error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/settings?connector=gmail&status=error`);
        }
    });

    router.post('/gmail/import', auth(), async (req, res, next) => {
        try {
            const { threadId, query } = req.body;

            // TODO: Fetch emails from Gmail using stored OAuth tokens
            // TODO: Process emails and create Source/Fragments

            res.json({
                success: true,
                message: 'Gmail connector is a stub. Implement OAuth flow and Gmail API calls.',
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/gmail/disconnect', auth(), async (req, res, next) => {
        try {
            // TODO: Revoke OAuth tokens
            res.json({ success: true, message: 'Disconnected from Gmail' });
        } catch (error) {
            next(error);
        }
    });
}

/**
 * Slack OAuth endpoints
 */
if (SLACK_ENABLED) {
    router.get('/slack/auth', auth(), (req, res) => {
        const authUrl = `https://slack.com/oauth/v2/authorize?` +
            `client_id=${process.env.SLACK_CLIENT_ID}&` +
            `scope=channels:history,channels:read,users:read&` +
            `redirect_uri=${process.env.BACKEND_URL}/api/connectors/slack/callback&` +
            `state=${req.user._id}`;

        res.json({ authUrl });
    });

    router.get('/slack/callback', async (req, res) => {
        const { code, state } = req.query;

        try {
            // TODO: Exchange code for tokens
            res.redirect(`${process.env.FRONTEND_URL}/settings?connector=slack&status=success`);
        } catch (error) {
            logger.error('Slack OAuth error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/settings?connector=slack&status=error`);
        }
    });

    router.post('/slack/import', auth(), async (req, res, next) => {
        try {
            const { channelId } = req.body;

            // TODO: Fetch messages from Slack using stored OAuth tokens
            // TODO: Process messages and create Source/Fragments

            res.json({
                success: true,
                message: 'Slack connector is a stub. Implement OAuth flow and Slack API calls.',
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/slack/disconnect', auth(), async (req, res, next) => {
        try {
            // TODO: Revoke OAuth tokens
            res.json({ success: true, message: 'Disconnected from Slack' });
        } catch (error) {
            next(error);
        }
    });
}

module.exports = router;

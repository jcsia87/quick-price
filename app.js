const express = require('express');
const session = require('express-session');
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = express();
const port = 3001;
const dbPath = path.join(__dirname, '.cache', 'judsondb.db');
const tursoUrl = process.env.TURSO_DATABASE_URL || 'libsql://judsondb-jcsia87.aws-ap-southeast-1.turso.io';
const hideMaterialCost =
    String(process.env.RENDER || '').toLowerCase() === 'true' ||
    Boolean(process.env.RENDER_SERVICE_ID);

// Middleware for parsing JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
    secret: 'your-strong-secret', // Change this to a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 400 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

function formatFriendlyDate(date) {
    const month = date.toLocaleString('en-US', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month} ${day}, ${year} ${hours}:${minutes}${suffix}`;
}

let db;

app.use('/vendor/fontawesome', express.static(path.join(__dirname, 'node_modules', '@fortawesome', 'fontawesome-free')));
app.use('/vendor/tanstack-table-core', express.static(path.join(__dirname, 'node_modules', '@tanstack', 'table-core', 'dist')));
app.use('/vendor/tanstack-store', express.static(path.join(__dirname, 'node_modules', '@tanstack', 'store', 'dist')));

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Simple password (change this in production)
const PASSWORD = 'judson2025';

// Login endpoint
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true, hideMaterialCost });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// Check authentication status endpoint
app.get('/check-auth', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({ authenticated: true, hideMaterialCost });
    } else {
        res.json({ authenticated: false, hideMaterialCost });
    }
});

app.get('/db-info', (req, res) => {
    try {
        const stats = fs.statSync(dbPath);
        const createdAt = stats.birthtime || stats.ctime || stats.mtime;
        res.json({ createdAt: formatFriendlyDate(createdAt) });
    } catch (error) {
        console.error('Unable to read database file info:', error.message);
        res.status(500).json({ error: 'Unable to read database info.' });
    }
});

// Middleware to protect routes
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// API endpoint to fetch filtered columns from "pricelist" (protected)
app.get('/data', requireAuth, async (req, res) => {
    const search = (req.query.search || '').trim();
    const columns = hideMaterialCost
        ? 'Description, Wholesale, Retail'
        : 'Description, "Material Cost", Wholesale, Retail';
    let sql = `SELECT ${columns} FROM pricelist`;
    let params = [];
    if (search) {
        sql += ` WHERE Description LIKE ?`;
        params.push(`%${search}%`);
    }
    try {
        const result = await db.execute({ sql, args: params });
        res.json(result.rows);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Turso query error:', message);
        res.status(500).json({ error: message });
    }
});

async function start() {
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!authToken) {
        throw new Error('TURSO_AUTH_TOKEN must be set to connect to the Turso database.');
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = createClient({
        url: pathToFileURL(dbPath).href,
        syncUrl: tursoUrl,
        authToken
    });
    await db.sync();
    console.log('Synchronized local database with Turso.');

    app.listen(port, () => {
        console.log(`App is listening at http://localhost:${port}`);
    });
}

start().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Unable to initialize Turso database:', message);
    if (db) {
        db.close();
    }
    process.exitCode = 1;
});

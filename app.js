const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3001;
const dbPath = path.join(__dirname, '.cache', 'judsondb.db');
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

let db = null;
let dbLastModified = null;

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
        if (dbLastModified) {
            return res.json({ createdAt: formatFriendlyDate(dbLastModified) });
        }
        const stats = fs.statSync(dbPath);
        const createdAt = stats.mtime || stats.ctime || stats.birthtime;
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
app.get('/data', requireAuth, (req, res) => {
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
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('SQLite error:', err.message);
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

function getR2Config() {
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET;
    const key = process.env.R2_OBJECT_KEY || 'judsondb.db';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    const missing = [];
    if (!endpoint) missing.push('R2_ENDPOINT');
    if (!bucket) missing.push('R2_BUCKET');
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');

    if (missing.length > 0) {
        throw new Error(`Missing required R2 environment variables: ${missing.join(', ')}`);
    }

    return {
        endpoint: new URL(endpoint).origin,
        bucket,
        key,
        accessKeyId,
        secretAccessKey
    };
}

async function downloadDatabaseFromR2() {
    const { endpoint, bucket, key, accessKeyId, secretAccessKey } = getR2Config();
    const s3 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const tempDbPath = `${dbPath}.tmp`;

    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) {
        throw new Error(`R2 object "${key}" returned an empty body.`);
    }

    const bodyStream =
        typeof response.Body.pipe === 'function'
            ? response.Body
            : Readable.fromWeb(response.Body.transformToWebStream());

    try {
        await pipeline(bodyStream, fs.createWriteStream(tempDbPath));
    } catch (error) {
        fs.rmSync(tempDbPath, { force: true });
        throw error;
    }

    // Remove any stale SQLite journal files before swapping in the new DB
    for (const suffix of ['-wal', '-shm', '-journal']) {
        fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
    fs.renameSync(tempDbPath, dbPath);

    if (response.LastModified) {
        dbLastModified = new Date(response.LastModified);
        fs.utimesSync(dbPath, dbLastModified, dbLastModified);
    } else {
        dbLastModified = null;
    }

    console.log(`Downloaded database from R2 (${bucket}/${key}).`);
}

function openLocalDatabase() {
    return new Promise((resolve, reject) => {
        const connection = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Connected to local SQLite database.');
                resolve(connection);
            }
        });
    });
}

async function start() {
    await downloadDatabaseFromR2();
    db = await openLocalDatabase();

    app.listen(port, () => {
        console.log(`App is listening at http://localhost:${port}`);
    });
}

start().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Unable to initialize database:', message);
    if (db) {
        db.close();
    }
    process.exitCode = 1;
});

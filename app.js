const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001;
const dbPath = path.join(__dirname, 'judsondb.db');

// Middleware for parsing JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
    secret: 'your-strong-secret', // Change this to a strong secret in production
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 4 * 60 * 60 * 1000 } // 4 hours
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

// Connect to SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite DB:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Simple password (change this in production)
const PASSWORD = 'judson2025';

// Login endpoint
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// Check authentication status endpoint
app.get('/check-auth', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
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
app.get('/data', requireAuth, (req, res) => {
    const search = (req.query.search || '').trim();
    let sql = `SELECT Description, "Material Cost", Wholesale, Retail FROM pricelist`;
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

app.listen(port, () => {
    console.log(`App is listening at http://localhost:${port}`);
});

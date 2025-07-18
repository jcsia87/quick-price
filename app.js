const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3001;

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

// Connect to SQLite database
const db = new sqlite3.Database('judsondb.db', (err) => {
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

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3001;

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

// API endpoint to fetch filtered columns from "pricelist"
app.get('/data', (req, res) => {
    const query = `SELECT Description, "Material Cost", Wholesale, Retail FROM pricelist`;

    db.all(query, [], (err, rows) => {
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

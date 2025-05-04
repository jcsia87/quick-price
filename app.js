const express = require('express');
const xlsx = require('xlsx');
const path = require('path');
const app = express();
const port = 3001;

// Read and parse the Excel file
const workbook = xlsx.readFile("C:\\Users\\sia_j\\OneDrive\\Desktop\\Judson Pricelist.xlsx");
const sheet_name_list = workbook.SheetNames;
const sheet = workbook.Sheets[sheet_name_list[0]];
const data = xlsx.utils.sheet_to_json(sheet);

// Serve static files
// app.use(express.static('public'));
app.use(express.static(__dirname + '/public'));

app.get('/data', (req, res) => {
    res.json(data);
});

app.listen(port, () => {
    console.log(`App is listening at http://localhost:${port}`);
});

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup - use in-memory for free hosting
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Database error:', err);
    } else {
        console.log('Connected to SQLite database');
        // Create table
        db.run(`CREATE TABLE IF NOT EXISTS calculations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            loan_amount REAL NOT NULL,
            interest_rate REAL NOT NULL,
            tenure_years INTEGER NOT NULL,
            tenure_months INTEGER NOT NULL,
            emi REAL NOT NULL,
            total_interest REAL NOT NULL,
            total_payment REAL NOT NULL,
            loan_type TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Add some sample data
        db.run(`INSERT INTO calculations (loan_amount, interest_rate, tenure_years, tenure_months, emi, total_interest, total_payment, loan_type) 
                VALUES (5000000, 8.5, 20, 240, 43406, 5417440, 10417440, 'home')`);
    }
});

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'EMI Calculator API is running!',
        endpoints: {
            calculate: 'POST /api/calculate-emi',
            history: 'GET /api/calculation-history',
            stats: 'GET /api/stats'
        }
    });
});

// Calculate EMI API
app.post('/api/calculate-emi', (req, res) => {
    const { loanAmount, interestRate, tenureYears, loanType } = req.body;
    
    // Validation
    if (!loanAmount || !interestRate || !tenureYears) {
        return res.status(400).json({ 
            success: false, 
            message: 'All fields are required' 
        });
    }

    const p = parseFloat(loanAmount);
    const r = parseFloat(interestRate);
    const n = parseFloat(tenureYears) * 12;

    if (p <= 0 || r <= 0 || n <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid input values' 
        });
    }

    // EMI Calculation
    const monthlyRate = r / 12 / 100;
    const emi = (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - p;

    // Save to database
    const stmt = db.prepare(`INSERT INTO calculations 
        (loan_amount, interest_rate, tenure_years, tenure_months, emi, total_interest, total_payment, loan_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    
    stmt.run([p, r, tenureYears, n, emi, totalInterest, totalPayment, loanType], function(err) {
        if (err) {
            console.error('Database save error:', err);
        }
    });
    stmt.finalize();

    // Response
    res.json({
        success: true,
        data: {
            emi: emi.toFixed(2),
            totalPayment: totalPayment.toFixed(2),
            totalInterest: totalInterest.toFixed(2),
            principalAmount: p.toFixed(2),
            calculationId: this.lastID
        }
    });
});

// Get calculation history
app.get('/api/calculation-history', (req, res) => {
    db.all(`SELECT * FROM calculations ORDER BY timestamp DESC LIMIT 10`, (err, rows) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Database error' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

// Server stats
app.get('/api/stats', (req, res) => {
    db.get(`SELECT COUNT(*) as totalCalculations FROM calculations`, (err, countRow) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Database error' 
            });
        }

        db.get(`SELECT SUM(loan_amount) as totalLoanAmount FROM calculations`, (err, sumRow) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Database error' 
                });
            }

            res.json({
                success: true,
                data: {
                    totalCalculations: countRow.totalCalculations,
                    totalLoanAmount: sumRow.totalLoanAmount || 0,
                    serverUptime: process.uptime()
                }
            });
        });
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 EMI Calculator Backend running on port ${PORT}`);
    console.log(`📊 API Base URL: http://localhost:${PORT}`);
});

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage (No database errors)
let calculations = [{
    id: 1,
    loan_amount: 5000000,
    interest_rate: 8.5,
    tenure_years: 20,
    emi: 43406,
    total_interest: 5417440,
    total_payment: 10417440,
    loan_type: 'home',
    timestamp: new Date().toISOString()
}];

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'EMI Calculator API is running! 🚀',
        status: 'OK',
        version: '1.0',
        endpoints: {
            calculate: 'POST /api/calculate-emi',
            history: 'GET /api/calculation-history',
            health: 'GET /health'
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

    // Save to memory
    const calculation = {
        id: calculations.length + 1,
        loan_amount: p,
        interest_rate: r,
        tenure_years: tenureYears,
        emi: parseFloat(emi.toFixed(2)),
        total_interest: parseFloat(totalInterest.toFixed(2)),
        total_payment: parseFloat(totalPayment.toFixed(2)),
        loan_type: loanType,
        timestamp: new Date().toISOString()
    };

    calculations.unshift(calculation);
    calculations = calculations.slice(0, 10); // Keep only last 10

    res.json({
        success: true,
        data: {
            emi: emi.toFixed(2),
            totalPayment: totalPayment.toFixed(2),
            totalInterest: totalInterest.toFixed(2),
            principalAmount: p.toFixed(2),
            calculationId: calculation.id
        }
    });
});

// Get calculation history
app.get('/api/calculation-history', (req, res) => {
    res.json({
        success: true,
        data: calculations
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK 🟢',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        calculations: calculations.length,
        version: '1.0.0'
    });
});

// Server stats
app.get('/api/stats', (req, res) => {
    const totalCalculations = calculations.length;
    const totalLoanAmount = calculations.reduce((sum, calc) => sum + calc.loan_amount, 0);
    
    res.json({
        success: true,
        data: {
            totalCalculations: totalCalculations,
            totalLoanAmount: totalLoanAmount,
            serverUptime: process.uptime()
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 EMI Calculator Backend running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🩺 Health: http://localhost:${PORT}/health`);
});

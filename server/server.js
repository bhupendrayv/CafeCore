const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initializeDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', authRoutes);

// Serve Static Files
const staticPath = path.join(__dirname, '../client');
app.use(express.static(staticPath));

// Fallback to signup page if accessing root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/signup.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/login.html'));
});

// Port
const PORT = process.env.PORT || 5000;

// Initialize Database and Start Server
const startServer = async () => {
    try {
        await initializeDB();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
    }
};

startServer();

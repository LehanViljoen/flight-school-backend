require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// CORS
app.use(cors({
  origin: [
    'https://flight-school-frontend.onrender.com',
    'http://localhost:3000'
  ]
}));

// Middleware
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// DB Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Health check
app.get('/', (req, res) => res.sendStatus(200));

// ... your routes ...

app.listen(port, () => console.log(`Server on port ${port}`));

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

// Middleware
app.use(cors({
  origin: ['https://flight-school-frontend.onrender.com', 'http://localhost:3000']
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// DB
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

// Auth
app.post('/auth/register', upload.single('profile_picture'), async (req, res) => {
  const { name, surname, pilot_license_number, role, email, password } = req.body;
  const profile_picture_url = req.file ? `/uploads/${req.file.filename}` : null;
  const password_hash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      'INSERT INTO users (name, surname, pilot_license_number, profile_picture_url, role, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, surname, pilot_license_number, profile_picture_url, role, email, password_hash]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user.rows[0] || !(await bcrypt.compare(password, user.rows[0].password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.rows[0].id, role: user.rows[0].role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: user.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Users
app.get('/users/:id', async (req, res) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start
app.listen(port, () => console.log(`Server running on port ${port}`));
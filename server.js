require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));  // Serve profile pics

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Middleware to verify JWT
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Auth Routes
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

// User Routes
app.get('/users/:id', authenticate, async (req, res) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/users/:id', authenticate, upload.single('profile_picture'), async (req, res) => {
  const { name, surname, pilot_license_number } = req.body;
  const profile_picture_url = req.file ? `/uploads/${req.file.filename}` : req.body.profile_picture_url;
  try {
    await pool.query(
      'UPDATE users SET name = $1, surname = $2, pilot_license_number = $3, profile_picture_url = $4 WHERE id = $5',
      [name, surname, pilot_license_number, profile_picture_url, req.params.id]
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Instructor Criteria
app.post('/instructors/:id/criteria', authenticate, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { criteria } = req.body;  // Array of criteria
  try {
    for (let crit of criteria) {
      await pool.query('INSERT INTO instructor_criteria (instructor_id, criteria) VALUES ($1, $2)', [req.params.id, crit]);
    }
    res.status(201).json({ message: 'Criteria added' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/instructors/search', authenticate, async (req, res) => {
  const { criteria, available_from, available_to } = req.query;
  let query = 'SELECT u.* FROM users u JOIN instructor_criteria ic ON u.id = ic.instructor_id WHERE u.role = \'instructor\'';
  const params = [];
  if (criteria) {
    query += ' AND ic.criteria = $1';
    params.push(criteria);
  }
  // Availability: No bookings in range
  if (available_from && available_to) {
    query += ` AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.instructor_id = u.id AND b.status = 'confirmed' AND NOT (b.end_time <= '${available_from}' OR b.start_time >= '${available_to}'))`;
  }
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Aircraft Routes
app.post('/aircraft', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { make, model, last_serviced, current_hours, max_hours } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO aircraft (make, model, last_serviced, current_hours, max_hours) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [make, model, last_serviced, current_hours || 0, max_hours || 100]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/aircraft/:id', authenticate, async (req, res) => {
  try {
    const aircraft = await pool.query('SELECT * FROM aircraft WHERE id = $1', [req.params.id]);
    res.json(aircraft.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/aircraft/:id/service', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    await pool.query('UPDATE aircraft SET current_hours = 0, last_serviced = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.json({ message: 'Serviced' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Simulator Routes (similar to aircraft, omitting for brevity; add POST/GET similar to aircraft)

// Booking Routes
async function isAvailable(resourceType, resourceId, start, end) {
  const overlapping = await pool.query(
    `SELECT * FROM bookings WHERE ${resourceType}_id = $1 AND status = 'confirmed' AND NOT (end_time <= $2 OR start_time >= $3)`,
    [resourceId, start, end]
  );
  return overlapping.rows.length === 0;
}

app.post('/bookings', authenticate, async (req, res) => {
  if (req.user.role !== 'student' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { instructor_id, aircraft_id, simulator_id, start_time, end_time, estimated_hours } = req.body;
  const student_id = req.user.id;
  const resourceType = aircraft_id ? 'aircraft' : 'simulator';
  const resourceId = aircraft_id || simulator_id;

  try {
    // Check instructor availability
    if (!(await isAvailable('instructor', instructor_id, start_time, end_time))) {
      return res.status(400).json({ message: 'Instructor not available' });
    }
    // Check resource availability
    if (!(await isAvailable(resourceType, resourceId, start_time, end_time))) {
      return res.status(400).json({ message: `${resourceType} not available` });
    }
    // Aircraft service check
    if (aircraft_id) {
      const aircraft = (await pool.query('SELECT * FROM aircraft WHERE id = $1', [aircraft_id])).rows[0];
      if (aircraft.current_hours + parseFloat(estimated_hours) > aircraft.max_hours) {
        return res.status(400).json({ message: 'Exceeds service limit' });
      }
    }
    // Create booking
    const result = await pool.query(
      `INSERT INTO bookings (student_id, instructor_id, ${resourceType}_id, start_time, end_time, estimated_hours, status) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed') RETURNING id`,
      [student_id, instructor_id, resourceId, start_time, end_time, estimated_hours]
    );
    // Update aircraft hours (assuming booking confirms flight)
    if (aircraft_id) {
      await pool.query('UPDATE aircraft SET current_hours = current_hours + $1 WHERE id = $2', [estimated_hours, aircraft_id]);
    }
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/bookings/dashboard', authenticate, async (req, res) => {
  const { month } = req.query;  // e.g., '2025-11'
  let query = 'SELECT * FROM bookings';
  if (month) {
    query += ` WHERE start_time >= '${month}-01' AND start_time < '${month}-01'::date + INTERVAL '1 MONTH'`;
  }
  try {
    const bookings = await pool.query(query);
    res.json(bookings.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/bookings/:id', authenticate, async (req, res) => {
  try {
    await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [req.params.id]);
    res.json({ message: 'Cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start server
app.listen(port, () => console.log(`Server running on port ${port}`));

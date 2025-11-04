CREATE DATABASE flight_school;

\c flight_school;

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    pilot_license_number VARCHAR(50) UNIQUE,
    profile_picture_url VARCHAR(255),
    role ENUM('student', 'instructor', 'admin') NOT NULL,  -- Added admin for management
    email VARCHAR(100) UNIQUE NOT NULL,  -- For login
    password_hash VARCHAR(255) NOT NULL,  -- Hashed password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Instructors Criteria
CREATE TABLE instructor_criteria (
    id SERIAL PRIMARY KEY,
    instructor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    criteria ENUM('Grade 3', 'Grade 2', 'Grade 1', 'DFE', 'Night Rating', 'Instrument Rating', 'CPL Ground School', 'ATPL Ground School') NOT NULL,
    UNIQUE(instructor_id, criteria)
);

-- Aircraft Table
CREATE TABLE aircraft (
    id SERIAL PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    last_serviced TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_hours DECIMAL(10,2) DEFAULT 0.0,
    max_hours DECIMAL(10,2) DEFAULT 100.0
);

-- Simulators Table
CREATE TABLE simulators (
    id SERIAL PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL
);

-- Bookings Table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    aircraft_id INTEGER REFERENCES aircraft(id) ON DELETE SET NULL,
    simulator_id INTEGER REFERENCES simulators(id) ON DELETE SET NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    estimated_hours DECIMAL(5,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (aircraft_id IS NOT NULL AND simulator_id IS NULL) OR 
        (aircraft_id IS NULL AND simulator_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_bookings_start_end ON bookings(start_time, end_time);
CREATE INDEX idx_bookings_instructor ON bookings(instructor_id);
CREATE INDEX idx_bookings_aircraft ON bookings(aircraft_id);
CREATE INDEX idx_bookings_simulator ON bookings(simulator_id);
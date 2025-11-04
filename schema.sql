-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    pilot_license_number VARCHAR(50) UNIQUE,
    profile_picture_url VARCHAR(255),
    role TEXT NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Instructors Criteria
CREATE TABLE instructor_criteria (
    id SERIAL PRIMARY KEY,
    instructor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    criteria TEXT NOT NULL,
    UNIQUE(instructor_id, criteria)
);

-- Aircraft
CREATE TABLE aircraft (
    id SERIAL PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    last_serviced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_hours DECIMAL(10,2) DEFAULT 0.0,
    max_hours DECIMAL(10,2) DEFAULT 100.0
);

-- Simulators
CREATE TABLE simulators (
    id SERIAL PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL
);

-- Bookings
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id),
    instructor_id INTEGER REFERENCES users(id),
    aircraft_id INTEGER REFERENCES aircraft(id),
    simulator_id INTEGER REFERENCES simulators(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    estimated_hours DECIMAL(5,2) NOT NULL,
    status TEXT DEFAULT 'confirmed',
    CHECK ((aircraft_id IS NOT NULL AND simulator_id IS NULL) OR (aircraft_id IS NULL AND simulator_id IS NOT NULL))
);
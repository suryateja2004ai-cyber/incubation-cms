-- 1. Passwords Table for Authentication
CREATE TABLE IF NOT EXISTS public.passwords (
    id SERIAL PRIMARY KEY,
    roll_number VARCHAR(50) UNIQUE NOT NULL, -- Student Roll (e.g. 238W1A0477) or Username (e.g. admin)
    password VARCHAR(255) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) DEFAULT 'student',      -- 'student', 'admin', 'substitute_admin'
    department VARCHAR(100),
    phone_number VARCHAR(25),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passwords_roll ON public.passwords(LOWER(roll_number));

-- Seed default accounts if not present
INSERT INTO public.passwords (roll_number, password, student_name, role, department, phone_number)
VALUES 
    ('admin', 'admin123', 'Administrator', 'admin', 'Incubation Management', '9876543210'),
    ('subadmin', 'subadmin123', 'Sub-Administrator', 'substitute_admin', 'Lab Operations', '9876543211'),
    ('238W1A0477', 'student123', 'hemadri', 'student', 'ECE', '9876543210'),
    ('238W1A0401', 'student123', 'Aravind Kumar', 'student', 'CSE', '9876543212')
ON CONFLICT (roll_number) DO NOTHING;

-- 2. Projects Showcase Shared Table
CREATE TABLE IF NOT EXISTS public.projects (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    domain VARCHAR(100) DEFAULT 'IoT & Embedded',
    status VARCHAR(50) DEFAULT 'showcase', -- 'ongoing', 'completed', 'showcase'
    student_roll VARCHAR(50) NOT NULL,     -- Creator roll number
    student_name VARCHAR(150) NOT NULL,    -- Creator full name
    team_members JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    github_url TEXT,
    demo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_roll ON public.projects(student_roll);
CREATE INDEX IF NOT EXISTS idx_projects_created ON public.projects(created_at DESC);

-- Seed initial showcase projects
INSERT INTO public.projects (id, title, description, domain, status, student_roll, student_name, tags, github_url)
VALUES
    ('PROJ-IOT-001', 'Smart Incubation Gesture & Energy Controller', 'Automated energy tracking and PIR sensor control with ESP32 microcontrollers.', 'IoT & Embedded', 'showcase', '238W1A0477', 'hemadri', '["ESP32", "IoT", "Sensors"]'::jsonb, 'https://github.com/vrsec/smart-lab-iot'),
    ('PROJ-AI-002', 'Computer Vision ID Scanner & OCR Pipeline', 'High-accuracy student ID card barcode and roll number extraction engine.', 'AI & ML', 'showcase', '238W1A0401', 'Aravind Kumar', '["Python", "OpenCV", "Vision"]'::jsonb, 'https://github.com/vrsec/ocr-pipeline')
ON CONFLICT (id) DO NOTHING;

-- 3. Research Publications Shared Table
CREATE TABLE IF NOT EXISTS public.research_publications (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    abstract TEXT,
    paper_type VARCHAR(100) DEFAULT 'Conference Paper', -- Journal, Conference, Patent
    domain VARCHAR(100) DEFAULT 'Computer Science',
    journal_conference_name VARCHAR(255),
    student_roll VARCHAR(50) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    authors JSONB DEFAULT '[]'::jsonb,
    doi VARCHAR(150),
    external_url TEXT,
    publication_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publications_roll ON public.research_publications(student_roll);
CREATE INDEX IF NOT EXISTS idx_publications_created ON public.research_publications(created_at DESC);

-- Seed initial publications
INSERT INTO public.research_publications (id, title, abstract, paper_type, domain, journal_conference_name, student_roll, student_name, doi, external_url)
VALUES
    ('PUB-2026-001', 'Autonomous IoT Energy Monitoring and Grid Power Minimization in Academic Incubators', 'Explores edge IoT optimization techniques for distributed university hardware laboratories.', 'Conference Paper', 'IoT & Embedded Systems', 'IEEE International Smart Hardware Conference 2026', '238W1A0477', 'hemadri', '10.1109/ISHC.2026.1042', 'https://doi.org/10.1109/ISHC.2026.1042'),
    ('PUB-2026-002', 'Edge Deep Learning for Offline Biometric Verification under Variable Illuminations', 'Presents a lightweight neural pipeline for facial landmark alignment on local edge hardware.', 'Journal Paper', 'Artificial Intelligence', 'Journal of Machine Vision & Robotics', '238W1A0401', 'Aravind Kumar', '10.1016/j.jmvr.2026.04.015', 'https://doi.org/10.1016/j.jmvr.2026.04.015')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- backend/neon_additional_features.sql
-- Additional Feature Tables for Incubation-CMS on Neon PostgreSQL:
-- 1. Events & Innovation Day Showcase (events)
-- 2. Student Innovations & Permanent Achievements (achievements)
-- 3. Lab Notices & Event Announcements (announcements)
-- 4. Equipment & Shortage Complaints System (complaints)
-- 5. Full Component & Hardware Inventory (components)
-- 6. Student Project & Innovation Teams (teams)
-- 7. Cloud Biometrics Vector Storage (student_face_embeddings)
-- ==============================================================================

-- 1. EVENTS & INNOVATION DAY TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id text PRIMARY KEY,
  title text NOT NULL,
  theme text,
  event_date date NOT NULL,
  prizes text,
  winners jsonb DEFAULT '[]'::jsonb,
  is_innovation_day boolean DEFAULT false,
  year integer,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_is_innovation_day ON public.events (is_innovation_day);

-- Seed Initial Innovation Day Events
INSERT INTO public.events (id, title, theme, event_date, prizes, winners, is_innovation_day, year, description, created_at)
VALUES 
  ('EVT-001', 'VRSEC Innovation Day 2026', 'AI-Driven Embedded Systems & Sustainable Technology', '2026-11-20', '₹1,50,000 Total Prize Pool + Incubation Seed Grants', '[{"team": "Team IoT Nexus", "project": "Smart Lab IoT Environmental Controller", "rank": "1st Place"}, {"team": "AeroVision Labs", "project": "Edge AI Drone", "rank": "Runner Up"}]'::jsonb, true, 2026, 'Annual flagship innovation festival showcasing hardware prototypes, IoT devices, and research demonstrations.', '2026-01-10 10:00:00+05:30'),
  ('EVT-002', 'VRSEC Innovation Day 2025 Archive', 'Industry 4.0 & Smart Sensor Networks', '2025-11-18', '₹1,00,000 Total Prize Pool', '[{"team": "Silicon Edge Innovators", "project": "RISC-V Micro-Node", "rank": "Grand Champion"}]'::jsonb, true, 2025, 'Previous year innovation day archive celebrating top student inventors.', '2025-01-15 10:00:00+05:30')
ON CONFLICT (id) DO NOTHING;


-- 2. PERMANENT ACHIEVEMENTS & INNOVATIONS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  awarded_to_roll text NOT NULL,
  student_name text NOT NULL,
  prize_money numeric(10, 2) DEFAULT 0,
  awarded_by text NOT NULL,
  date_awarded date DEFAULT CURRENT_DATE,
  is_permanent boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_student ON public.achievements (awarded_to_roll);

-- Seed Initial Honors & Hackathon Wins
INSERT INTO public.achievements (id, title, description, awarded_to_roll, student_name, prize_money, awarded_by, date_awarded, is_permanent, created_at)
VALUES
  ('ACH-001', 'Smart India Hackathon (SIH) - Grand Prize', 'Winner of national SIH Hardware Edition for Smart Industrial IoT Power Management System.', '238W1A0477', 'Anwar Bajarinti', 100000.00, 'Ministry of Education & Dr. K. Venkatesh (Lab Incharge / Sir)', '2026-03-20', true, '2026-03-20 10:00:00+05:30'),
  ('ACH-002', '1st Place - National Drone Innovation Challenge', 'Awarded first place for autonomous edge AI disease detection in aerial drones.', '238W1A0412', 'Kavya Sharma', 50000.00, 'IEEE Robotics & Automation Society', '2026-02-15', true, '2026-02-15 10:00:00+05:30')
ON CONFLICT (id) DO NOTHING;


-- 3. ANNOUNCEMENTS & NOTICE BOARD TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
  id text PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  category text DEFAULT 'General',
  active boolean DEFAULT true,
  expires_at timestamptz NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements (active, expires_at);

-- Seed Initial Notice
INSERT INTO public.announcements (id, title, message, category, active, expires_at, created_by, created_at)
VALUES
  ('ANN-001', 'VRSEC Innovation Day 2026 Prototype Registrations Open', 'All student teams are invited to register prototypes and research papers for VRSEC Innovation Day. Grant funding available.', 'Innovation Day', true, (now() + interval '30 days'), 'Sir / Faculty Mentor', now()),
  ('ANN-002', 'New Hardware In Stock: ESP32-S3 and STM32 Nucleo Boards', 'Fresh batch of 50 ESP32-S3 and STM32 Development boards arrived in Component Storage Section A.', 'Inventory Update', true, (now() + interval '14 days'), 'Admin', now())
ON CONFLICT (id) DO NOTHING;


-- 4. COMPLAINTS & DEFECTIVE EQUIPMENT TRACKER
CREATE TABLE IF NOT EXISTS public.complaints (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('equipment_environment', 'component_availability')),
  item_name text NOT NULL,
  description text NOT NULL,
  reported_by_roll text NOT NULL,
  reported_by_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);
CREATE INDEX IF NOT EXISTS idx_complaints_reported_by ON public.complaints (reported_by_roll);


-- 5. COMPONENT & HARDWARE INVENTORY (7-Category Taxonomy)
CREATE TABLE IF NOT EXISTS public.components (
  id text PRIMARY KEY,
  name text NOT NULL,
  component_number text,
  category text DEFAULT 'Other electronic components',
  parent_category text,
  description text,
  total_quantity integer DEFAULT 0,
  available_quantity integer DEFAULT 0,
  issued_quantity integer DEFAULT 0,
  damaged_quantity integer DEFAULT 0,
  lost_quantity integer DEFAULT 0,
  low_stock_threshold integer DEFAULT 3,
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_components_category ON public.components (category);

-- Seed Core Hardware Components
INSERT INTO public.components (id, name, component_number, category, parent_category, description, total_quantity, available_quantity, issued_quantity, low_stock_threshold, location)
VALUES
  ('COMP-001', 'ESP32-WROOM-32 DevKit V1', 'VRSEC-MC-001', 'Microcontrollers & Processors', 'Development Boards', 'Dual-core 240MHz Wi-Fi and Bluetooth MCU board with USB-C.', 45, 41, 4, 5, 'Cabinet 1 - Drawer A1'),
  ('COMP-002', 'Arduino Uno R3 (ATmega328P)', 'VRSEC-MC-002', 'Microcontrollers & Processors', 'Development Boards', 'Standard 16MHz 5V ATmega328P prototyping board.', 60, 52, 8, 10, 'Cabinet 1 - Drawer A2'),
  ('COMP-003', 'Raspberry Pi 4 Model B (4GB)', 'VRSEC-SBC-001', 'Microcontrollers & Processors', 'Single Board Computers (SBC)', 'Quad-core Cortex-A72 64-bit SoC with 4GB LPDDR4.', 15, 12, 3, 3, 'Cabinet 1 - Shelf B'),
  ('COMP-004', 'DHT22 Digital Temperature & Humidity Sensor', 'VRSEC-SN-001', 'Sensors & Transducers', 'Environmental Sensors', 'High-accuracy capacitive humidity and thermistor sensor.', 30, 26, 4, 5, 'Cabinet 2 - Drawer C1'),
  ('COMP-005', 'HC-SR04 Ultrasonic Distance Sensor', 'VRSEC-SN-002', 'Sensors & Transducers', 'Proximity & Motion Sensors', 'Contactless distance measurement module (2cm - 400cm).', 40, 35, 5, 8, 'Cabinet 2 - Drawer C2'),
  ('COMP-006', 'SG90 Micro Servo Motor 9g', 'VRSEC-ACT-001', 'Motors, Drivers & Actuators', 'Servo Motors', '180-degree rotation miniature servo motor.', 50, 42, 8, 10, 'Cabinet 3 - Drawer D1'),
  ('COMP-007', 'L298N Dual H-Bridge Motor Driver', 'VRSEC-DRV-001', 'Motors, Drivers & Actuators', 'Motor Driver Modules', 'Dual motor controller board for DC and stepper motors.', 25, 20, 5, 4, 'Cabinet 3 - Drawer D2'),
  ('COMP-008', '0.96 inch I2C OLED Display (SSD1306)', 'VRSEC-DSP-001', 'Displays & Indicators', 'OLED Displays', '128x64 blue/yellow dual color OLED screen.', 35, 30, 5, 5, 'Cabinet 4 - Drawer E1'),
  ('COMP-009', 'LM2596 DC-DC Buck Converter', 'VRSEC-PWR-001', 'Power & Protection', 'Step-Down Converters', 'Adjustable 3A step-down voltage regulator module.', 40, 34, 6, 6, 'Cabinet 4 - Drawer E2'),
  ('COMP-010', 'ESP32-CAM Camera Module with OV2640', 'VRSEC-CAM-001', 'Communication & Wireless Modules', 'Camera & Vision Modules', 'Wi-Fi + Bluetooth SoC with 2MP OV2640 camera sensor.', 20, 16, 4, 3, 'Cabinet 2 - Shelf B')
ON CONFLICT (id) DO NOTHING;


-- 6. STUDENT TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  leader_roll text NOT NULL,
  member_rolls jsonb DEFAULT '[]'::jsonb,
  domain text,
  project_id text,
  budget numeric(10, 2) DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_leader_roll ON public.teams (leader_roll);


-- 7. CLOUD BIOMETRIC FACE EMBEDDINGS (EMPTY & READY FOR FUTURE ENROLLMENT)
-- Note: All 130 face embeddings were purged as per requirement.
-- This table is ready with strict constraints whenever someone registers.
CREATE TABLE IF NOT EXISTS public.student_face_embeddings (
  id text PRIMARY KEY,
  roll_number text NOT NULL,
  student_name text NOT NULL,
  embedding_vector jsonb NOT NULL,
  capture_quality numeric(4, 3) DEFAULT 1.000,
  source_device text DEFAULT 'web_station',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_roll ON public.student_face_embeddings (roll_number);

-- ==============================================================================
-- 005_component_category_hierarchy.sql
-- Safe Non-Destructive Migration: Multi-Level Component Category Hierarchy
--
-- Persists arbitrary parent-child category tree in Supabase PostgreSQL.
-- Preserves 100% of existing components, categories, and inventory associations.
-- ==============================================================================

-- 1. COMPONENT CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.component_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  parent_id text REFERENCES public.component_categories(id) ON DELETE RESTRICT,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for high-performance child lookups
CREATE INDEX IF NOT EXISTS idx_component_categories_parent_id 
  ON public.component_categories(parent_id);

-- 2. EXTEND COMPONENTS TABLE (SAFE COLUMN ADDITIONS)
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS category_id text 
  REFERENCES public.component_categories(id) ON DELETE SET NULL;

ALTER TABLE public.components ADD COLUMN IF NOT EXISTS location_photo_url text;
ALTER TABLE public.components ADD COLUMN IF NOT EXISTS location_photo_ref text;

-- 3. INITIAL SEED CATEGORIES (SAFE: ONLY INSERT IF MISSING)
INSERT INTO public.component_categories (id, name, parent_id, description)
VALUES 
  -- Root Categories
  ('CAT-ROOT-ELECTRONICS', 'Electronics', NULL, 'Electronic components, boards, and modules'),
  ('CAT-ROOT-DISPLAYS', 'Displays', NULL, 'Display panels, screens, and indicators'),
  ('CAT-ROOT-MOTORS', 'Motors & Actuators', NULL, 'Electric motors, servos, and drive mechanisms'),
  ('CAT-ROOT-TOOLS', 'Tools & Lab Equipment', NULL, 'Laboratory test equipment, soldering, and hand tools'),
  ('CAT-ROOT-OTHER', 'Other electronic components', NULL, 'Passives, hardware, and miscellaneous lab supplies'),

  -- Level 2: Under Electronics
  ('CAT-MICROCONTROLLERS', 'Microcontrollers', 'CAT-ROOT-ELECTRONICS', 'Microcontroller development boards and ICs'),
  ('CAT-SENSORS', 'Sensors', 'CAT-ROOT-ELECTRONICS', 'Environmental, optical, and physical sensors'),
  ('CAT-COMM-MODULES', 'Communication Modules', 'CAT-ROOT-ELECTRONICS', 'Wireless and wired transceivers'),
  ('CAT-POWER-MODULES', 'Power Modules', 'CAT-ROOT-ELECTRONICS', 'Voltage regulators, buck/boost converters, and batteries'),

  -- Level 3: Under Microcontrollers
  ('CAT-ESP32', 'ESP32', 'CAT-MICROCONTROLLERS', 'Espressif ESP32 series'),
  ('CAT-ARDUINO', 'Arduino', 'CAT-MICROCONTROLLERS', 'Arduino compatible boards'),
  ('CAT-STM32', 'STM32', 'CAT-MICROCONTROLLERS', 'ARM Cortex-M development boards'),
  ('CAT-RASPBERRY-PI', 'Raspberry Pi', 'CAT-MICROCONTROLLERS', 'Single-board computers and RP2040 microcontrollers'),

  -- Level 4: Under ESP32
  ('CAT-ESP32-WROOM', 'ESP32-WROOM', 'CAT-ESP32', 'ESP32-WROOM series'),
  ('CAT-ESP32-WROVER', 'ESP32-WROVER', 'CAT-ESP32', 'ESP32-WROVER series with PSRAM'),
  ('CAT-ESP32-C3', 'ESP32-C3', 'CAT-ESP32', 'ESP32-C3 RISC-V series'),

  -- Level 5: Under ESP32-WROOM
  ('CAT-ESP32-WROOM-32', 'ESP32-WROOM-32', 'CAT-ESP32-WROOM', 'Standard dual-core ESP32-WROOM-32 modules'),
  ('CAT-ESP32-WROOM-32E', 'ESP32-WROOM-32E', 'CAT-ESP32-WROOM', 'Enhanced PCB antenna ESP32-WROOM-32E modules'),

  -- Level 3: Under Sensors
  ('CAT-TEMP-SENSORS', 'Temperature Sensors', 'CAT-SENSORS', 'Temperature and humidity sensing ICs'),
  ('CAT-ULTRASONIC', 'Ultrasonic Sensors', 'CAT-SENSORS', 'Distance and sonar rangefinder modules'),
  ('CAT-GAS-SENSORS', 'Gas Sensors', 'CAT-SENSORS', 'Air quality and gas detection probes'),
  ('CAT-OPTICAL-SENSORS', 'Optical & Light Sensors', 'CAT-SENSORS', 'Photodiodes, LDRs, and colour sensors'),

  -- Level 4: Under Temperature Sensors
  ('CAT-LM35', 'LM35 Precision Centigrade', 'CAT-TEMP-SENSORS', 'Analog precision temperature sensors'),
  ('CAT-DS18B20', 'DS18B20 1-Wire Digital', 'CAT-TEMP-SENSORS', 'Digital 1-wire waterproof temperature probes'),

  -- Level 4: Under Ultrasonic
  ('CAT-HCSR04', 'HC-SR04 Rangefinder', 'CAT-ULTRASONIC', 'Ultrasonic distance measuring modules'),

  -- Level 4: Under Gas Sensors
  ('CAT-MQ135', 'MQ-135 Air Quality Probe', 'CAT-GAS-SENSORS', 'Hazardous gas and air quality sensor modules'),

  -- Level 3: Under Communication Modules
  ('CAT-WIFI', 'Wi-Fi Modules', 'CAT-COMM-MODULES', 'Wi-Fi transceivers and adapters'),
  ('CAT-BLUETOOTH', 'Bluetooth Modules', 'CAT-COMM-MODULES', 'BLE and Classic Bluetooth transceivers'),
  ('CAT-LORA', 'LoRa Transceivers', 'CAT-COMM-MODULES', 'Long-range low-power RF modules'),

  -- Level 4: Under Bluetooth
  ('CAT-HC05', 'HC-05 Classic Bluetooth', 'CAT-BLUETOOTH', 'UART serial Bluetooth modules'),
  ('CAT-HC06', 'HC-06 Bluetooth Slave', 'CAT-BLUETOOTH', 'UART slave Bluetooth modules')
ON CONFLICT (id) DO NOTHING;

-- 4. ROW LEVEL SECURITY (RLS) FOR COMPONENT CATEGORIES
ALTER TABLE public.component_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.component_categories;
CREATE POLICY "Authenticated users can view categories" ON public.component_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage categories" ON public.component_categories;
CREATE POLICY "Admins manage categories" ON public.component_categories
  FOR ALL TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'substitute_admin', 'sir'));


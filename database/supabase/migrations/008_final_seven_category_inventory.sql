-- ==============================================================================
-- 008_final_seven_category_inventory.sql
-- Safe Non-Destructive Migration: Final 7-Category Inventory Classification
--
-- Reorganizes the Component & Lab Inventory taxonomy in Supabase PostgreSQL
-- into strictly seven approved main categories and recommended subcategories.
--
-- STRICT PRESERVATION GUARANTEES:
-- - 100% preserves existing components (COMP-001 through COMP-010 and custom records).
-- - Zero stock quantities reset (total_quantity, available_quantity, issued_quantity,
--   damaged_quantity, lost_quantity remain completely untouched).
-- - Preserves component numbers, physical barcodes, RFID tags, and storage locations.
-- - Preserves loan durations, active checkouts, return transactions, and audit logs.
-- ==============================================================================

BEGIN;

-- 1. UPSERT THE 7 APPROVED ROOT CATEGORIES
INSERT INTO public.component_categories (id, name, parent_id, description, updated_at)
VALUES
  ('CAT-ROOT-SENSORS-MODULES', 'Sensors & Electronic Modules', NULL, 'Sensors, detectors, and wireless communication modules', now()),
  ('CAT-ROOT-DEV-BOARDS', 'Development Boards', NULL, 'Microcontroller prototyping boards, SBCs, and evaluation kits', now()),
  ('CAT-ROOT-ICS-COMPONENTS', 'ICs & Electronic Components', NULL, 'Integrated circuits, semiconductors, and passive discrete components', now()),
  ('CAT-ROOT-DISPLAYS-INDICATORS', 'Displays & Indicators', NULL, 'Visual display panels, LED screens, and visual indicators', now()),
  ('CAT-ROOT-MOTORS-DRIVERS', 'Motors & Drivers', NULL, 'Electric motors, servos, steppers, and motor driver modules', now()),
  ('CAT-ROOT-POWER-PROTECTION', 'Power & Protection', NULL, 'Power supplies, batteries, converters, and electrical protection modules', now()),
  ('CAT-ROOT-LAB-EQUIPMENT', 'Lab Equipment & Accessories', NULL, 'Laboratory instruments, prototyping aids, soldering, and hand tools', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  updated_at = now();

-- 2. UPSERT ALL APPROVED SUBCATEGORIES UNDER THE 7 ROOT CATEGORIES
INSERT INTO public.component_categories (id, name, parent_id, description, updated_at)
VALUES
  -- 1. Under Sensors & Electronic Modules
  ('CAT-SUB-MOTION-SENSORS', 'Motion Sensors', 'CAT-ROOT-SENSORS-MODULES', 'PIR motion sensors (HC-SR501, RCWL-0516), microwave radar, and motion detectors', now()),
  ('CAT-SUB-DISTANCE-SENSORS', 'Distance Sensors', 'CAT-ROOT-SENSORS-MODULES', 'Ultrasonic (HC-SR04), ToF laser (VL53L0X), and optical distance sensors', now()),
  ('CAT-SUB-TEMP-HUMIDITY-SENSORS', 'Temperature & Humidity Sensors', 'CAT-ROOT-SENSORS-MODULES', 'DHT11, DHT22, LM35, DS18B20, and environmental probes', now()),
  ('CAT-SUB-LIGHT-IR-SENSORS', 'Light & IR Sensors', 'CAT-ROOT-SENSORS-MODULES', 'Photodiodes, LDRs, optical, infrared, and obstacle avoidance sensors', now()),
  ('CAT-SUB-GAS-AIR-QUALITY-SENSORS', 'Gas & Air Quality Sensors', 'CAT-ROOT-SENSORS-MODULES', 'MQ-2, MQ-135, smoke, air quality, and hazardous gas detectors', now()),
  ('CAT-SUB-PRESSURE-SENSORS', 'Pressure Sensors', 'CAT-ROOT-SENSORS-MODULES', 'BMP180, BMP280, barometric, and atmospheric pressure sensors', now()),
  ('CAT-SUB-WIRELESS-COMM-MODULES', 'Wireless Communication Modules', 'CAT-ROOT-SENSORS-MODULES', 'NRF24L01+, ESP-NOW, LoRa SX1278, Bluetooth HC-05, and GSM modules', now()),
  ('CAT-SUB-GPS-NAV-MODULES', 'GPS & Navigation Modules', 'CAT-ROOT-SENSORS-MODULES', 'NEO-6M GPS modules, compass, and navigation accessories', now()),
  ('CAT-SUB-OTHER-SENSOR-MODULES', 'Other Sensor Modules', 'CAT-ROOT-SENSORS-MODULES', 'Rain, soil moisture, sound/microphone, and specialized sensing modules', now()),

  -- 2. Under Development Boards
  ('CAT-SUB-ESP-DEV-BOARDS', 'ESP Development Boards', 'CAT-ROOT-DEV-BOARDS', 'ESP32 NodeMCU, ESP8266 Wemos D1 Mini, and Espressif boards', now()),
  ('CAT-SUB-ARDUINO-BOARDS', 'Arduino Boards', 'CAT-ROOT-DEV-BOARDS', 'Arduino Uno R3, Mega 2560, Nano V3.0, and compatible boards', now()),
  ('CAT-SUB-RASPBERRY-PI-SBC', 'Raspberry Pi & Single Board Computers', 'CAT-ROOT-DEV-BOARDS', 'Raspberry Pi 4, Pi Zero, Raspberry Pi Pico RP2040, and SBCs', now()),
  ('CAT-SUB-STM32-ARM-BOARDS', 'STM32 & ARM Development Boards', 'CAT-ROOT-DEV-BOARDS', 'STM32 Blue Pill, Nucleo-64, Discovery, and ARM Cortex boards', now()),
  ('CAT-SUB-SPECIALIZED-IOT-BOARDS', 'Specialized & IoT Development Boards', 'CAT-ROOT-DEV-BOARDS', 'FPGA dev boards, cellular IoT boards, and AI/edge kits', now()),
  ('CAT-SUB-PROGRAMMER-DEBUGGER-BOARDS', 'Programmer & Debugger Boards', 'CAT-ROOT-DEV-BOARDS', 'ST-Link V2, USB-to-TTL CP2102/CH340, and ICSP programmers', now()),
  -- Granular compatibility children
  ('CAT-ESP32', 'ESP32', 'CAT-SUB-ESP-DEV-BOARDS', 'Espressif ESP32 development boards', now()),
  ('CAT-ARDUINO', 'Arduino', 'CAT-SUB-ARDUINO-BOARDS', 'Standard Arduino boards', now()),

  -- 3. Under ICs & Electronic Components
  ('CAT-SUB-MICROCONTROLLERS-PROCESSORS', 'Microcontrollers & Processors (Bare ICs)', 'CAT-ROOT-ICS-COMPONENTS', 'ATmega328P-PU, ATTiny85, and bare MCU chips', now()),
  ('CAT-SUB-OP-AMPS-LINEAR-ICS', 'Operational Amplifiers & Linear ICs', 'CAT-ROOT-ICS-COMPONENTS', 'LM358, LM741, NE555 timers, and analog operational amplifiers', now()),
  ('CAT-SUB-DIGITAL-LOGIC-ICS', 'Digital Logic ICs', 'CAT-ROOT-ICS-COMPONENTS', '74HC595 shift registers, 7400 NAND, 7408 AND, and logic series', now()),
  ('CAT-SUB-INTERFACE-DRIVER-ICS', 'Interface & Driver ICs', 'CAT-ROOT-ICS-COMPONENTS', 'MAX232, MAX485, ULN2003, and motor/bus driver ICs', now()),
  ('CAT-SUB-DISCRETE-SEMICONDUCTORS', 'Discrete Semiconductors (Diodes, Transistors, MOSFETs)', 'CAT-ROOT-ICS-COMPONENTS', '2N2222, BC547, IRF540N MOSFETs, 1N4007 diodes, and Zeners', now()),
  ('CAT-SUB-PASSIVE-COMPONENTS', 'Passive Components (Resistors, Capacitors, Inductors)', 'CAT-ROOT-ICS-COMPONENTS', 'Resistor assortments, ceramic & electrolytic capacitors, inductors', now()),
  ('CAT-SUB-ELECTROMECHANICAL-COMPONENTS', 'Electromechanical Components (Relays, Switches, Buttons)', 'CAT-ROOT-ICS-COMPONENTS', '5V relays, tactile push buttons, slide switches, and buzzers', now()),

  -- 4. Under Displays & Indicators
  ('CAT-SUB-OLED-DISPLAYS', 'OLED Displays', 'CAT-ROOT-DISPLAYS-INDICATORS', '0.96-inch SSD1306, 1.3-inch I2C/SPI monochrome & color OLEDs', now()),
  ('CAT-SUB-LCD-DISPLAYS', 'LCD Displays', 'CAT-ROOT-DISPLAYS-INDICATORS', '16x2 I2C character LCDs, 20x4 LCDs, and graphic displays', now()),
  ('CAT-SUB-TFT-GRAPHIC-DISPLAYS', 'TFT & Graphic Displays', 'CAT-ROOT-DISPLAYS-INDICATORS', 'ST7735 1.8-inch, ILI9341 2.8-inch TFT LCD with touch', now()),
  ('CAT-SUB-7-SEGMENT-DISPLAYS', '7-Segment Displays', 'CAT-ROOT-DISPLAYS-INDICATORS', 'TM1637 4-digit displays, single-digit 7-segment LED modules', now()),
  ('CAT-SUB-LED-INDICATORS-MATRIX', 'LED Indicators & Matrix Modules', 'CAT-ROOT-DISPLAYS-INDICATORS', '5mm diffused LEDs, RGB LEDs, WS2812B NeoPixel rings, MAX7219 8x8 dot matrix', now()),

  -- 5. Under Motors & Drivers
  ('CAT-SUB-DC-MOTORS', 'DC Motors', 'CAT-ROOT-MOTORS-DRIVERS', 'TT geared dual-shaft motors, coreless DC motors, and hobby motors', now()),
  ('CAT-SUB-SERVO-MOTORS', 'Servo Motors', 'CAT-ROOT-MOTORS-DRIVERS', 'SG90 9g micro servos, MG996R high-torque metal gear servos', now()),
  ('CAT-SUB-STEPPER-MOTORS', 'Stepper Motors', 'CAT-ROOT-MOTORS-DRIVERS', '28BYJ-48 5V steppers, NEMA 17 precision stepper motors', now()),
  ('CAT-SUB-MOTOR-DRIVER-SHIELDS', 'Motor Driver Modules & Shields', 'CAT-ROOT-MOTORS-DRIVERS', 'L298N dual H-bridge, L293D shields, A4988, DRV8825 drivers', now()),
  ('CAT-SUB-SOLENOIDS-ACTUATORS', 'Solenoids & Actuators', 'CAT-ROOT-MOTORS-DRIVERS', '12V push-pull electromagnet solenoids, linear electric actuators', now()),

  -- 6. Under Power & Protection
  ('CAT-SUB-POWER-SUPPLIES-REGULATORS', 'Power Supplies & Regulators', 'CAT-ROOT-POWER-PROTECTION', '9V/12V DC power adapters, MB102 breadboard power modules', now()),
  ('CAT-SUB-BATTERIES-BMS', 'Batteries & Battery Management (BMS)', 'CAT-ROOT-POWER-PROTECTION', '18650 3.7V Li-ion cells, 1S/2S/3S BMS balance protection boards', now()),
  ('CAT-SUB-BUCK-BOOST-CONVERTERS', 'Step-Up / Step-Down (Buck / Boost) Converters', 'CAT-ROOT-POWER-PROTECTION', 'LM2596 buck converter, MT3608 boost converter, XL6009 modules', now()),
  ('CAT-SUB-CHARGING-MODULES', 'Charging Modules', 'CAT-ROOT-POWER-PROTECTION', 'TP4056 USB-C/micro-USB lithium battery charging modules', now()),
  ('CAT-SUB-PROTECTION-CIRCUITS-FUSES', 'Protection Circuits & Fuses', 'CAT-ROOT-POWER-PROTECTION', 'Glass tube fuses, resettable PPTC polyfuses, reverse polarity protection', now()),

  -- 7. Under Lab Equipment & Accessories
  ('CAT-SUB-BREADBOARDS-PROTOTYPING', 'Breadboards & Prototyping', 'CAT-ROOT-LAB-EQUIPMENT', '830-point & 400-point solderless breadboards, double-sided perfboards', now()),
  ('CAT-SUB-CONNECTING-WIRES-JUMPER', 'Connecting Wires & Jumper Cables', 'CAT-ROOT-LAB-EQUIPMENT', 'M-M, M-F, F-F jumper wires (10cm/20cm), 22AWG solid hookup wire', now()),
  ('CAT-SUB-CONNECTORS-HEADERS', 'Connectors & Headers', 'CAT-ROOT-LAB-EQUIPMENT', '40-pin male/female 2.54mm berg strips, screw terminals, JST-XH kits', now()),
  ('CAT-SUB-FASTENERS-HARDWARE', 'Fasteners, Hardware & Spacers', 'CAT-ROOT-LAB-EQUIPMENT', 'M2/M3 nylon and brass hex standoff kits, screws, nuts, cable ties', now()),
  ('CAT-SUB-TOOLS-SOLDERING', 'Tools & Soldering Equipment', 'CAT-ROOT-LAB-EQUIPMENT', '60W temperature-controlled soldering irons, solder wire, pumps, wire strippers', now()),
  ('CAT-SUB-MEASURING-TESTING-TOOLS', 'Measuring Instruments & Testing Tools', 'CAT-ROOT-LAB-EQUIPMENT', 'Digital multimeters, logic analyzers (8-channel 24MHz), oscilloscope probes', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  updated_at = now();

-- 3. RECLASSIFY KNOWN INVENTORY COMPONENTS (NON-DESTRUCTIVE)
-- Note: stock quantities (total_quantity, available_quantity, issued_quantity) are NOT modified.

-- COMP-001: PIR Motion Sensor (HC-SR501)
UPDATE public.components
SET category = 'Sensors & Electronic Modules',
    category_id = 'CAT-SUB-MOTION-SENSORS',
    parent_category = 'Motion Sensors'
WHERE id = 'COMP-001' OR component_number = 'COMP-PIR-001';

-- COMP-002: ESP32 Wi-Fi + Bluetooth Dev Board
UPDATE public.components
SET category = 'Development Boards',
    category_id = 'CAT-SUB-ESP-DEV-BOARDS',
    parent_category = 'ESP Development Boards'
WHERE id = 'COMP-002' OR component_number = 'COMP-ESP-002';

-- COMP-003: Ultrasonic Distance Sensor (HC-SR04)
UPDATE public.components
SET category = 'Sensors & Electronic Modules',
    category_id = 'CAT-SUB-DISTANCE-SENSORS',
    parent_category = 'Distance Sensors'
WHERE id = 'COMP-003' OR component_number = 'COMP-ULT-003';

-- COMP-004: Arduino Uno R3 Compatible
UPDATE public.components
SET category = 'Development Boards',
    category_id = 'CAT-SUB-ARDUINO-BOARDS',
    parent_category = 'Arduino Boards'
WHERE id = 'COMP-004' OR component_number = 'COMP-ARD-004';

-- COMP-005: Raspberry Pi Pico RP2040
UPDATE public.components
SET category = 'Development Boards',
    category_id = 'CAT-SUB-RASPBERRY-PI-SBC',
    parent_category = 'Raspberry Pi & Single Board Computers'
WHERE id = 'COMP-005' OR component_number = 'COMP-PICO-005';

-- COMP-006: 0.96 inch I2C OLED Display
UPDATE public.components
SET category = 'Displays & Indicators',
    category_id = 'CAT-SUB-OLED-DISPLAYS',
    parent_category = 'OLED Displays'
WHERE id = 'COMP-006' OR component_number = 'COMP-OLED-006';

-- COMP-007: L298N Dual H-Bridge Motor Driver
UPDATE public.components
SET category = 'Motors & Drivers',
    category_id = 'CAT-SUB-MOTOR-DRIVER-SHIELDS',
    parent_category = 'Motor Driver Modules & Shields'
WHERE id = 'COMP-007' OR component_number = 'COMP-L298-007';

-- COMP-008: SG90 Micro Servo Motor 9g
UPDATE public.components
SET category = 'Motors & Drivers',
    category_id = 'CAT-SUB-SERVO-MOTORS',
    parent_category = 'Servo Motors'
WHERE id = 'COMP-008' OR component_number = 'COMP-SERVO-008';

-- COMP-009: NRF24L01+ 2.4GHz Wireless Transceiver
UPDATE public.components
SET category = 'Sensors & Electronic Modules',
    category_id = 'CAT-SUB-WIRELESS-COMM-MODULES',
    parent_category = 'Wireless Communication Modules'
WHERE id = 'COMP-009' OR component_number = 'COMP-NRF-009';

-- COMP-010: DHT11 Temperature & Humidity Sensor
UPDATE public.components
SET category = 'Sensors & Electronic Modules',
    category_id = 'CAT-SUB-TEMP-HUMIDITY-SENSORS',
    parent_category = 'Temperature & Humidity Sensors'
WHERE id = 'COMP-010' OR component_number = 'COMP-DHT-010';

-- 4. REASSIGN ANY LEGACY CATEGORY ASSOCIATIONS
-- Point legacy children under 'CAT-MICROCONTROLLERS' to 'CAT-ROOT-DEV-BOARDS'
UPDATE public.component_categories
SET parent_id = 'CAT-ROOT-DEV-BOARDS'
WHERE parent_id = 'CAT-MICROCONTROLLERS' AND id NOT IN ('CAT-ESP32', 'CAT-ARDUINO');

-- Reassign components referencing deprecated root IDs
UPDATE public.components
SET category_id = 'CAT-ROOT-ICS-COMPONENTS'
WHERE category_id IN ('CAT-ROOT-ELECTRONICS', 'CAT-ROOT-OTHER');

UPDATE public.components
SET category_id = 'CAT-ROOT-DISPLAYS-INDICATORS'
WHERE category_id = 'CAT-ROOT-DISPLAYS';

UPDATE public.components
SET category_id = 'CAT-ROOT-MOTORS-DRIVERS'
WHERE category_id = 'CAT-ROOT-MOTORS';

UPDATE public.components
SET category_id = 'CAT-ROOT-LAB-EQUIPMENT'
WHERE category_id = 'CAT-ROOT-TOOLS';

-- 5. SAFELY CLEAN UP OBSOLETE ROOT CATEGORIES (ONLY IF NO COMPONENTS OR CHILDREN REMAIN)
DELETE FROM public.component_categories
WHERE id IN ('CAT-ROOT-ELECTRONICS', 'CAT-ROOT-DISPLAYS', 'CAT-ROOT-MOTORS', 'CAT-ROOT-TOOLS', 'CAT-ROOT-OTHER', 'CAT-MICROCONTROLLERS', 'CAT-SENSORS', 'CAT-COMM-MODULES', 'CAT-POWER-MODULES')
  AND NOT EXISTS (SELECT 1 FROM public.components WHERE category_id = component_categories.id)
  AND NOT EXISTS (SELECT 1 FROM public.component_categories c2 WHERE c2.parent_id = component_categories.id);

COMMIT;

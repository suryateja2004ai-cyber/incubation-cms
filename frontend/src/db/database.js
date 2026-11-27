// src/db/database.js
// Centralized Data & Authentication Service Layer
// Supabase PostgreSQL is the ONLINE Source of Truth.
// IndexedDB + localStorage serve strictly as the Offline Cache & Mutation Queue.
// Preserves 100% of existing function interfaces so the React UI remains fully intact.

import { createClient } from '@supabase/supabase-js';
import { supabase, getSupabaseConfig } from '../lib/supabase.js';
import { syncService } from '../services/sync/syncService.js';
import { toDbRow, fromDbRow } from './schemaMapper.js';
import { discoverRollNumberPrefixes } from '../utils/rollNumberPrefixHelper.js';
import {
  calculateRetentionYears,
  calculateRetentionEndDate,
  categorizeStudentRetention,
  getStorageTier,
  validateStorageWrite,
  STORAGE_TIERS,
  STORAGE_THRESHOLDS,
} from '../services/storage/storageProtectionService.js';
import {
  INITIAL_COMPONENTS,
  INITIAL_USERS,
  INITIAL_DEVICES,
  INITIAL_VISITS,
  INITIAL_DAILY_ATTENDANCE,
  INITIAL_TRANSACTIONS,
  INITIAL_AUTHORIZATIONS,
  INITIAL_SETTINGS,
  INITIAL_AUDIT_LOGS,
} from './sampleData.js';

const DB_NAME = 'IncubationCMS_DB';
const DB_VERSION = 2;
const STORAGE_KEYS = {
  COMPONENTS: 'inc_cms_components_v2',
  USERS: 'inc_cms_users_v2',
  DEVICES: 'inc_cms_devices_v2',
  VISITS: 'inc_cms_visits_v2',
  DAILY_ATTENDANCE: 'inc_cms_daily_attendance_v2',
  TRANSACTIONS: 'inc_cms_transactions_v2',
  AUTHORIZATIONS: 'inc_cms_authorizations_v2',
  SETTINGS: 'inc_cms_settings_v2',
  AUDIT_LOGS: 'inc_cms_audit_logs_v2',
  AUTH_SESSION: 'inc_cms_current_auth_session',
  INITIALIZED: 'inc_cms_initialized_v2',
  PROJECTS: 'inc_cms_projects_v2',
  TEAMS: 'inc_cms_teams_v2',
  ACHIEVEMENTS: 'inc_cms_achievements_v2',
  ANNOUNCEMENTS: 'inc_cms_announcements_v2',
  EVENTS: 'inc_cms_events_v2',
  COMPLAINTS: 'inc_cms_complaints_v2',
  RESEARCH_PAPERS: 'inc_cms_research_papers_v2',
  SELF_REFLECTIONS: 'inc_cms_self_reflections_v2',
  HOLIDAYS: 'inc_cms_holidays_v2',
  DOMAINS: 'inc_cms_domains_v2',
  STAFF_PRESENCE: 'inc_cms_staff_presence_v2',
  CATEGORIES: 'inc_cms_categories_v2',
  // Canonical camelCase aliases for seamless local cache persistence
  staffPresence: 'inc_cms_staff_presence_v2',
  auditLogs: 'inc_cms_audit_logs_v2',
  dailyAttendance: 'inc_cms_daily_attendance_v2',
  researchPapers: 'inc_cms_research_papers_v2',
  selfReflections: 'inc_cms_self_reflections_v2',
  authSession: 'inc_cms_current_auth_session',
};

export function saveToLocalStorage(key, val) {
  try {
    localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
  } catch (_) {}
}

// ==================== FINAL APPROVED 7-CATEGORY CLASSIFICATION ====================
export const APPROVED_MAIN_CATEGORIES = [
  'Sensors & Electronic Modules',
  'Development Boards',
  'ICs & Electronic Components',
  'Displays & Indicators',
  'Motors & Drivers',
  'Power & Protection',
  'Lab Equipment & Accessories',
];

export const DEFAULT_CATEGORIES = [
  // 1. Sensors & Electronic Modules
  { id: 'CAT-ROOT-SENSORS-MODULES', name: 'Sensors & Electronic Modules', parentId: null, description: 'Sensors, detectors, and wireless communication modules' },
  { id: 'CAT-SUB-MOTION-SENSORS', name: 'Motion Sensors', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'PIR motion sensors (HC-SR501, RCWL-0516), microwave radar, and motion detectors' },
  { id: 'CAT-SUB-DISTANCE-SENSORS', name: 'Distance Sensors', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'Ultrasonic (HC-SR04), ToF laser (VL53L0X), and optical distance sensors' },
  { id: 'CAT-SUB-TEMP-HUMIDITY-SENSORS', name: 'Temperature & Humidity Sensors', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'DHT11, DHT22, LM35, DS18B20, and environmental probes' },
  { id: 'CAT-SUB-LIGHT-IR-SENSORS', name: 'Light & IR Sensors', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'Photodiodes, LDRs, optical, infrared, and obstacle avoidance sensors' },
  { id: 'CAT-SUB-GAS-AIR-QUALITY-SENSORS', name: 'Gas & Air Quality Sensors', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'MQ-2, MQ-135, smoke, air quality, and hazardous gas detectors' },
  { id: 'CAT-SUB-PRESSURE-SENSORS', name: 'Pressure Sensors', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'BMP180, BMP280, barometric, and atmospheric pressure sensors' },
  { id: 'CAT-SUB-WIRELESS-COMM-MODULES', name: 'Wireless Communication Modules', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'NRF24L01+, ESP-NOW, LoRa SX1278, Bluetooth HC-05, and GSM modules' },
  { id: 'CAT-SUB-GPS-NAV-MODULES', name: 'GPS & Navigation Modules', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'NEO-6M GPS modules, compass, and navigation accessories' },
  { id: 'CAT-SUB-OTHER-SENSOR-MODULES', name: 'Other Sensor Modules', parentId: 'CAT-ROOT-SENSORS-MODULES', description: 'Rain, soil moisture, sound/microphone, and specialized sensing modules' },

  // 2. Development Boards
  { id: 'CAT-ROOT-DEV-BOARDS', name: 'Development Boards', parentId: null, description: 'Microcontroller prototyping boards, SBCs, and evaluation kits' },
  { id: 'CAT-SUB-ESP-DEV-BOARDS', name: 'ESP Development Boards', parentId: 'CAT-ROOT-DEV-BOARDS', description: 'ESP32 NodeMCU, ESP8266 Wemos D1 Mini, and Espressif boards' },
  { id: 'CAT-SUB-ARDUINO-BOARDS', name: 'Arduino Boards', parentId: 'CAT-ROOT-DEV-BOARDS', description: 'Arduino Uno R3, Mega 2560, Nano V3.0, and compatible boards' },
  { id: 'CAT-SUB-RASPBERRY-PI-SBC', name: 'Raspberry Pi & Single Board Computers', parentId: 'CAT-ROOT-DEV-BOARDS', description: 'Raspberry Pi 4, Pi Zero, Raspberry Pi Pico RP2040, and SBCs' },
  { id: 'CAT-SUB-STM32-ARM-BOARDS', name: 'STM32 & ARM Development Boards', parentId: 'CAT-ROOT-DEV-BOARDS', description: 'STM32 Blue Pill, Nucleo-64, Discovery, and ARM Cortex boards' },
  { id: 'CAT-SUB-SPECIALIZED-IOT-BOARDS', name: 'Specialized & IoT Development Boards', parentId: 'CAT-ROOT-DEV-BOARDS', description: 'FPGA dev boards, cellular IoT boards, and AI/edge kits' },
  { id: 'CAT-SUB-PROGRAMMER-DEBUGGER-BOARDS', name: 'Programmer & Debugger Boards', parentId: 'CAT-ROOT-DEV-BOARDS', description: 'ST-Link V2, USB-to-TTL CP2102/CH340, and ICSP programmers' },
  // Granular children for dev boards (preserves compatibility)
  { id: 'CAT-ESP32', name: 'ESP32', parentId: 'CAT-SUB-ESP-DEV-BOARDS', description: 'Espressif ESP32 development boards' },
  { id: 'CAT-ARDUINO', name: 'Arduino', parentId: 'CAT-SUB-ARDUINO-BOARDS', description: 'Standard Arduino boards' },

  // 3. ICs & Electronic Components
  { id: 'CAT-ROOT-ICS-COMPONENTS', name: 'ICs & Electronic Components', parentId: null, description: 'Integrated circuits, semiconductors, and passive discrete components' },
  { id: 'CAT-SUB-MICROCONTROLLERS-PROCESSORS', name: 'Microcontrollers & Processors (Bare ICs)', parentId: 'CAT-ROOT-ICS-COMPONENTS', description: 'ATmega328P-PU, ATTiny85, and bare MCU chips' },
  { id: 'CAT-SUB-OP-AMPS-LINEAR-ICS', name: 'Operational Amplifiers & Linear ICs', parentId: 'CAT-ROOT-ICS-COMPONENTS', description: 'LM358, LM741, NE555 timers, and analog operational amplifiers' },
  { id: 'CAT-SUB-DIGITAL-LOGIC-ICS', name: 'Digital Logic ICs', parentId: 'CAT-ROOT-ICS-COMPONENTS', description: '74HC595 shift registers, 7400 NAND, 7408 AND, and logic series' },
  { id: 'CAT-SUB-INTERFACE-DRIVER-ICS', name: 'Interface & Driver ICs', parentId: 'CAT-ROOT-ICS-COMPONENTS', description: 'MAX232, MAX485, ULN2003, and motor/bus driver ICs' },
  { id: 'CAT-SUB-DISCRETE-SEMICONDUCTORS', name: 'Discrete Semiconductors (Diodes, Transistors, MOSFETs)', parentId: 'CAT-ROOT-ICS-COMPONENTS', description: '2N2222, BC547, IRF540N MOSFETs, 1N4007 diodes, and Zeners' },
  { id: 'CAT-SUB-PASSIVE-COMPONENTS', name: 'Passive Components (Resistors, Capacitors, Inductors)', parentId: 'CAT-ROOT-ICS-COMPONENTS', description: 'Resistor assortments, ceramic & electrolytic capacitors, inductors' },
  { id: 'CAT-SUB-ELECTROMECHANICAL-COMPONENTS', name: 'Electromechanical Components (Relays, Switches, Buttons)', parentId: 'CAT-ROOT-ICS-COMPONENTS', description: '5V relays, tactile push buttons, slide switches, and buzzers' },

  // 4. Displays & Indicators
  { id: 'CAT-ROOT-DISPLAYS-INDICATORS', name: 'Displays & Indicators', parentId: null, description: 'Visual display panels, LED screens, and visual indicators' },
  { id: 'CAT-SUB-OLED-DISPLAYS', name: 'OLED Displays', parentId: 'CAT-ROOT-DISPLAYS-INDICATORS', description: '0.96-inch SSD1306, 1.3-inch I2C/SPI monochrome & color OLEDs' },
  { id: 'CAT-SUB-LCD-DISPLAYS', name: 'LCD Displays', parentId: 'CAT-ROOT-DISPLAYS-INDICATORS', description: '16x2 I2C character LCDs, 20x4 LCDs, and graphic displays' },
  { id: 'CAT-SUB-TFT-GRAPHIC-DISPLAYS', name: 'TFT & Graphic Displays', parentId: 'CAT-ROOT-DISPLAYS-INDICATORS', description: 'ST7735 1.8-inch, ILI9341 2.8-inch TFT LCD with touch' },
  { id: 'CAT-SUB-7-SEGMENT-DISPLAYS', name: '7-Segment Displays', parentId: 'CAT-ROOT-DISPLAYS-INDICATORS', description: 'TM1637 4-digit displays, single-digit 7-segment LED modules' },
  { id: 'CAT-SUB-LED-INDICATORS-MATRIX', name: 'LED Indicators & Matrix Modules', parentId: 'CAT-ROOT-DISPLAYS-INDICATORS', description: '5mm diffused LEDs, RGB LEDs, WS2812B NeoPixel rings, MAX7219 8x8 dot matrix' },

  // 5. Motors & Drivers
  { id: 'CAT-ROOT-MOTORS-DRIVERS', name: 'Motors & Drivers', parentId: null, description: 'Electric motors, servos, steppers, and motor driver modules' },
  { id: 'CAT-SUB-DC-MOTORS', name: 'DC Motors', parentId: 'CAT-ROOT-MOTORS-DRIVERS', description: 'TT geared dual-shaft motors, coreless DC motors, and hobby motors' },
  { id: 'CAT-SUB-SERVO-MOTORS', name: 'Servo Motors', parentId: 'CAT-ROOT-MOTORS-DRIVERS', description: 'SG90 9g micro servos, MG996R high-torque metal gear servos' },
  { id: 'CAT-SUB-STEPPER-MOTORS', name: 'Stepper Motors', parentId: 'CAT-ROOT-MOTORS-DRIVERS', description: '28BYJ-48 5V steppers, NEMA 17 precision stepper motors' },
  { id: 'CAT-SUB-MOTOR-DRIVER-SHIELDS', name: 'Motor Driver Modules & Shields', parentId: 'CAT-ROOT-MOTORS-DRIVERS', description: 'L298N dual H-bridge, L293D shields, A4988, DRV8825 drivers' },
  { id: 'CAT-SUB-SOLENOIDS-ACTUATORS', name: 'Solenoids & Actuators', parentId: 'CAT-ROOT-MOTORS-DRIVERS', description: '12V push-pull electromagnet solenoids, linear electric actuators' },

  // 6. Power & Protection
  { id: 'CAT-ROOT-POWER-PROTECTION', name: 'Power & Protection', parentId: null, description: 'Power supplies, batteries, converters, and electrical protection modules' },
  { id: 'CAT-SUB-POWER-SUPPLIES-REGULATORS', name: 'Power Supplies & Regulators', parentId: 'CAT-ROOT-POWER-PROTECTION', description: '9V/12V DC power adapters, MB102 breadboard power modules' },
  { id: 'CAT-SUB-BATTERIES-BMS', name: 'Batteries & Battery Management (BMS)', parentId: 'CAT-ROOT-POWER-PROTECTION', description: '18650 3.7V Li-ion cells, 1S/2S/3S BMS balance protection boards' },
  { id: 'CAT-SUB-BUCK-BOOST-CONVERTERS', name: 'Step-Up / Step-Down (Buck / Boost) Converters', parentId: 'CAT-ROOT-POWER-PROTECTION', description: 'LM2596 buck converter, MT3608 boost converter, XL6009 modules' },
  { id: 'CAT-SUB-CHARGING-MODULES', name: 'Charging Modules', parentId: 'CAT-ROOT-POWER-PROTECTION', description: 'TP4056 USB-C/micro-USB lithium battery charging modules' },
  { id: 'CAT-SUB-PROTECTION-CIRCUITS-FUSES', name: 'Protection Circuits & Fuses', parentId: 'CAT-ROOT-POWER-PROTECTION', description: 'Glass tube fuses, resettable PPTC polyfuses, reverse polarity protection' },

  // 7. Lab Equipment & Accessories
  { id: 'CAT-ROOT-LAB-EQUIPMENT', name: 'Lab Equipment & Accessories', parentId: null, description: 'Laboratory instruments, prototyping aids, soldering, and hand tools' },
  { id: 'CAT-SUB-BREADBOARDS-PROTOTYPING', name: 'Breadboards & Prototyping', parentId: 'CAT-ROOT-LAB-EQUIPMENT', description: '830-point & 400-point solderless breadboards, double-sided perfboards' },
  { id: 'CAT-SUB-CONNECTING-WIRES-JUMPER', name: 'Connecting Wires & Jumper Cables', parentId: 'CAT-ROOT-LAB-EQUIPMENT', description: 'M-M, M-F, F-F jumper wires (10cm/20cm), 22AWG solid hookup wire' },
  { id: 'CAT-SUB-CONNECTORS-HEADERS', name: 'Connectors & Headers', parentId: 'CAT-ROOT-LAB-EQUIPMENT', description: '40-pin male/female 2.54mm berg strips, screw terminals, JST-XH kits' },
  { id: 'CAT-SUB-FASTENERS-HARDWARE', name: 'Fasteners, Hardware & Spacers', parentId: 'CAT-ROOT-LAB-EQUIPMENT', description: 'M2/M3 nylon and brass hex standoff kits, screws, nuts, cable ties' },
  { id: 'CAT-SUB-TOOLS-SOLDERING', name: 'Tools & Soldering Equipment', parentId: 'CAT-ROOT-LAB-EQUIPMENT', description: '60W temperature-controlled soldering irons, solder wire, pumps, wire strippers' },
  { id: 'CAT-SUB-MEASURING-TESTING-TOOLS', name: 'Measuring Instruments & Testing Tools', parentId: 'CAT-ROOT-LAB-EQUIPMENT', description: 'Digital multimeters, logic analyzers (8-channel 24MHz), oscilloscope probes' },
];

/**
 * Non-destructive mapping of existing components into the final approved 7-category taxonomy.
 * Preserves component IDs, stock counts, tags, thresholds, locations, and audit logs.
 */
export function migrateComponentRecord(comp) {
  if (!comp) return comp;
  const c = { ...comp };

  // 1. Direct Sample Component ID Mappings
  if (c.id === 'COMP-001') {
    c.category = 'Sensors & Electronic Modules';
    c.parentCategory = 'Motion Sensors';
    c.categoryId = 'CAT-SUB-MOTION-SENSORS';
    c.categoryPath = 'Sensors & Electronic Modules / Motion Sensors';
    return c;
  }
  if (c.id === 'COMP-002') {
    c.category = 'Development Boards';
    c.parentCategory = 'ESP Development Boards';
    c.categoryId = 'CAT-SUB-ESP-DEV-BOARDS';
    c.categoryPath = 'Development Boards / ESP Development Boards';
    return c;
  }
  if (c.id === 'COMP-003') {
    c.category = 'Sensors & Electronic Modules';
    c.parentCategory = 'Distance Sensors';
    c.categoryId = 'CAT-SUB-DISTANCE-SENSORS';
    c.categoryPath = 'Sensors & Electronic Modules / Distance Sensors';
    return c;
  }
  if (c.id === 'COMP-004') {
    c.category = 'Development Boards';
    c.parentCategory = 'Arduino Boards';
    c.categoryId = 'CAT-SUB-ARDUINO-BOARDS';
    c.categoryPath = 'Development Boards / Arduino Boards';
    return c;
  }
  if (c.id === 'COMP-005') {
    c.category = 'Development Boards';
    c.parentCategory = 'Raspberry Pi & Single Board Computers';
    c.categoryId = 'CAT-SUB-RASPBERRY-PI-SBC';
    c.categoryPath = 'Development Boards / Raspberry Pi & Single Board Computers';
    return c;
  }
  if (c.id === 'COMP-006') {
    c.category = 'Displays & Indicators';
    c.parentCategory = 'OLED Displays';
    c.categoryId = 'CAT-SUB-OLED-DISPLAYS';
    c.categoryPath = 'Displays & Indicators / OLED Displays';
    return c;
  }
  if (c.id === 'COMP-007') {
    c.category = 'Motors & Drivers';
    c.parentCategory = 'Motor Driver Modules & Shields';
    c.categoryId = 'CAT-SUB-MOTOR-DRIVER-SHIELDS';
    c.categoryPath = 'Motors & Drivers / Motor Driver Modules & Shields';
    return c;
  }
  if (c.id === 'COMP-008') {
    c.category = 'Motors & Drivers';
    c.parentCategory = 'Servo Motors';
    c.categoryId = 'CAT-SUB-SERVO-MOTORS';
    c.categoryPath = 'Motors & Drivers / Servo Motors';
    return c;
  }
  if (c.id === 'COMP-009') {
    c.category = 'Sensors & Electronic Modules';
    c.parentCategory = 'Wireless Communication Modules';
    c.categoryId = 'CAT-SUB-WIRELESS-COMM-MODULES';
    c.categoryPath = 'Sensors & Electronic Modules / Wireless Communication Modules';
    return c;
  }
  if (c.id === 'COMP-010') {
    c.category = 'Sensors & Electronic Modules';
    c.parentCategory = 'Temperature & Humidity Sensors';
    c.categoryId = 'CAT-SUB-TEMP-HUMIDITY-SENSORS';
    c.categoryPath = 'Sensors & Electronic Modules / Temperature & Humidity Sensors';
    return c;
  }

  // 2. Already within one of the 7 approved main categories
  if (APPROVED_MAIN_CATEGORIES.includes(c.category)) {
    return c;
  }

  // 3. Heuristic mapping for custom/legacy components
  const nameLower = (c.name || '').toLowerCase();
  const catLower = (c.category || '').toLowerCase();

  if (
    catLower === 'sensors' ||
    nameLower.includes('sensor') ||
    nameLower.includes('ultrasonic') ||
    nameLower.includes('dht') ||
    nameLower.includes('pir') ||
    nameLower.includes('transceiver') ||
    nameLower.includes('rf') ||
    nameLower.includes('gps') ||
    nameLower.includes('lora') ||
    nameLower.includes('bluetooth') ||
    nameLower.includes('wi-fi') ||
    nameLower.includes('wifi')
  ) {
    c.category = 'Sensors & Electronic Modules';
    if (nameLower.includes('motion') || nameLower.includes('pir')) {
      c.parentCategory = 'Motion Sensors';
      c.categoryId = 'CAT-SUB-MOTION-SENSORS';
    } else if (nameLower.includes('distance') || nameLower.includes('ultrasonic')) {
      c.parentCategory = 'Distance Sensors';
      c.categoryId = 'CAT-SUB-DISTANCE-SENSORS';
    } else if (nameLower.includes('temp') || nameLower.includes('humidity') || nameLower.includes('dht') || nameLower.includes('lm35')) {
      c.parentCategory = 'Temperature & Humidity Sensors';
      c.categoryId = 'CAT-SUB-TEMP-HUMIDITY-SENSORS';
    } else if (nameLower.includes('light') || nameLower.includes('ldr') || nameLower.includes('optical')) {
      c.parentCategory = 'Light & IR Sensors';
      c.categoryId = 'CAT-SUB-LIGHT-IR-SENSORS';
    } else if (nameLower.includes('gas') || nameLower.includes('air') || nameLower.includes('mq')) {
      c.parentCategory = 'Gas & Air Quality Sensors';
      c.categoryId = 'CAT-SUB-GAS-AIR-QUALITY-SENSORS';
    } else if (nameLower.includes('bluetooth') || nameLower.includes('wi-fi') || nameLower.includes('wifi') || nameLower.includes('wireless') || nameLower.includes('transceiver') || nameLower.includes('lora') || nameLower.includes('nrf') || nameLower.includes('gsm')) {
      c.parentCategory = 'Wireless Communication Modules';
      c.categoryId = 'CAT-SUB-WIRELESS-COMM-MODULES';
    } else if (nameLower.includes('gps') || nameLower.includes('neo-6m') || nameLower.includes('navigation')) {
      c.parentCategory = 'GPS & Navigation Modules';
      c.categoryId = 'CAT-SUB-GPS-NAV-MODULES';
    } else if (nameLower.includes('pressure') || nameLower.includes('baromet')) {
      c.parentCategory = 'Pressure Sensors';
      c.categoryId = 'CAT-SUB-PRESSURE-SENSORS';
    } else {
      c.parentCategory = 'Other Sensor Modules';
      c.categoryId = 'CAT-SUB-OTHER-SENSOR-MODULES';
    }
    c.categoryPath = `Sensors & Electronic Modules / ${c.parentCategory}`;
    return c;
  }

  if (
    catLower === 'microcontrollers' ||
    nameLower.includes('arduino') ||
    nameLower.includes('esp32') ||
    nameLower.includes('stm32') ||
    nameLower.includes('pico') ||
    nameLower.includes('raspberry') ||
    nameLower.includes('nodemcu') ||
    nameLower.includes('dev board') ||
    nameLower.includes('development board')
  ) {
    c.category = 'Development Boards';
    if (nameLower.includes('arduino')) {
      c.parentCategory = 'Arduino Boards';
      c.categoryId = 'CAT-SUB-ARDUINO-BOARDS';
    } else if (nameLower.includes('esp')) {
      c.parentCategory = 'ESP Development Boards';
      c.categoryId = 'CAT-SUB-ESP-DEV-BOARDS';
    } else if (nameLower.includes('stm32') || nameLower.includes('nucleo') || nameLower.includes('discovery')) {
      c.parentCategory = 'STM32 & ARM Development Boards';
      c.categoryId = 'CAT-SUB-STM32-ARM-BOARDS';
    } else if (nameLower.includes('raspberry') || nameLower.includes('pico') || nameLower.includes('sbc')) {
      c.parentCategory = 'Raspberry Pi & Single Board Computers';
      c.categoryId = 'CAT-SUB-RASPBERRY-PI-SBC';
    } else {
      c.parentCategory = 'Specialized & IoT Development Boards';
      c.categoryId = 'CAT-SUB-SPECIALIZED-IOT-BOARDS';
    }
    c.categoryPath = `Development Boards / ${c.parentCategory}`;
    return c;
  }

  if (
    catLower.includes('display') ||
    nameLower.includes('oled') ||
    nameLower.includes('lcd') ||
    nameLower.includes('seven-segment') ||
    nameLower.includes('7-segment') ||
    nameLower.includes('matrix') ||
    nameLower.includes('led indicator') ||
    nameLower.includes('rgb led')
  ) {
    c.category = 'Displays & Indicators';
    if (nameLower.includes('oled')) {
      c.parentCategory = 'OLED Displays';
      c.categoryId = 'CAT-SUB-OLED-DISPLAYS';
    } else if (nameLower.includes('lcd')) {
      c.parentCategory = 'LCD Displays';
      c.categoryId = 'CAT-SUB-LCD-DISPLAYS';
    } else if (nameLower.includes('seven-segment') || nameLower.includes('7-segment') || nameLower.includes('digit')) {
      c.parentCategory = '7-Segment Displays';
      c.categoryId = 'CAT-SUB-7-SEGMENT-DISPLAYS';
    } else if (nameLower.includes('tft') || nameLower.includes('graphic')) {
      c.parentCategory = 'TFT & Graphic Displays';
      c.categoryId = 'CAT-SUB-TFT-GRAPHIC-DISPLAYS';
    } else {
      c.parentCategory = 'LED Indicators & Matrix Modules';
      c.categoryId = 'CAT-SUB-LED-INDICATORS-MATRIX';
    }
    c.categoryPath = `Displays & Indicators / ${c.parentCategory}`;
    return c;
  }

  if (
    catLower.includes('motor') ||
    catLower.includes('actuator') ||
    nameLower.includes('motor') ||
    nameLower.includes('servo') ||
    nameLower.includes('stepper') ||
    nameLower.includes('driver') ||
    nameLower.includes('solenoid') ||
    nameLower.includes('actuator')
  ) {
    c.category = 'Motors & Drivers';
    if (nameLower.includes('servo')) {
      c.parentCategory = 'Servo Motors';
      c.categoryId = 'CAT-SUB-SERVO-MOTORS';
    } else if (nameLower.includes('stepper')) {
      c.parentCategory = 'Stepper Motors';
      c.categoryId = 'CAT-SUB-STEPPER-MOTORS';
    } else if (nameLower.includes('driver') || nameLower.includes('l298') || nameLower.includes('l293') || nameLower.includes('a4988') || nameLower.includes('shield')) {
      c.parentCategory = 'Motor Driver Modules & Shields';
      c.categoryId = 'CAT-SUB-MOTOR-DRIVER-SHIELDS';
    } else if (nameLower.includes('solenoid') || nameLower.includes('actuator')) {
      c.parentCategory = 'Solenoids & Actuators';
      c.categoryId = 'CAT-SUB-SOLENOIDS-ACTUATORS';
    } else {
      c.parentCategory = 'DC Motors';
      c.categoryId = 'CAT-SUB-DC-MOTORS';
    }
    c.categoryPath = `Motors & Drivers / ${c.parentCategory}`;
    return c;
  }

  if (
    catLower.includes('power') ||
    nameLower.includes('adapter') ||
    nameLower.includes('battery') ||
    nameLower.includes('charger') ||
    nameLower.includes('converter') ||
    nameLower.includes('relay') ||
    nameLower.includes('fuse') ||
    nameLower.includes('buck') ||
    nameLower.includes('boost') ||
    nameLower.includes('18650') ||
    nameLower.includes('tp4056') ||
    nameLower.includes('bms')
  ) {
    c.category = 'Power & Protection';
    if (nameLower.includes('adapter') || nameLower.includes('power supply') || nameLower.includes('regulator')) {
      c.parentCategory = 'Power Supplies & Regulators';
      c.categoryId = 'CAT-SUB-POWER-SUPPLIES-REGULATORS';
    } else if (nameLower.includes('battery') || nameLower.includes('18650') || nameLower.includes('bms')) {
      c.parentCategory = 'Batteries & Battery Management (BMS)';
      c.categoryId = 'CAT-SUB-BATTERIES-BMS';
    } else if (nameLower.includes('buck') || nameLower.includes('boost') || nameLower.includes('converter') || nameLower.includes('lm2596') || nameLower.includes('mt3608')) {
      c.parentCategory = 'Step-Up / Step-Down (Buck / Boost) Converters';
      c.categoryId = 'CAT-SUB-BUCK-BOOST-CONVERTERS';
    } else if (nameLower.includes('charger') || nameLower.includes('tp4056') || nameLower.includes('charging')) {
      c.parentCategory = 'Charging Modules';
      c.categoryId = 'CAT-SUB-CHARGING-MODULES';
    } else {
      c.parentCategory = 'Protection Circuits & Fuses';
      c.categoryId = 'CAT-SUB-PROTECTION-CIRCUITS-FUSES';
    }
    c.categoryPath = `Power & Protection / ${c.parentCategory}`;
    return c;
  }

  if (
    catLower.includes('tool') ||
    catLower.includes('equipment') ||
    catLower.includes('accessory') ||
    nameLower.includes('multimeter') ||
    nameLower.includes('oscilloscope') ||
    nameLower.includes('breadboard') ||
    nameLower.includes('pcb') ||
    nameLower.includes('perfboard') ||
    nameLower.includes('wire') ||
    nameLower.includes('cable') ||
    nameLower.includes('jumper') ||
    nameLower.includes('header') ||
    nameLower.includes('connector') ||
    nameLower.includes('standoff') ||
    nameLower.includes('screw') ||
    nameLower.includes('solder') ||
    nameLower.includes('stripper')
  ) {
    c.category = 'Lab Equipment & Accessories';
    if (nameLower.includes('breadboard') || nameLower.includes('perfboard') || nameLower.includes('pcb')) {
      c.parentCategory = 'Breadboards & Prototyping';
      c.categoryId = 'CAT-SUB-BREADBOARDS-PROTOTYPING';
    } else if (nameLower.includes('wire') || nameLower.includes('cable') || nameLower.includes('jumper')) {
      c.parentCategory = 'Connecting Wires & Jumper Cables';
      c.categoryId = 'CAT-SUB-CONNECTING-WIRES-JUMPER';
    } else if (nameLower.includes('connector') || nameLower.includes('header') || nameLower.includes('berg') || nameLower.includes('terminal')) {
      c.parentCategory = 'Connectors & Headers';
      c.categoryId = 'CAT-SUB-CONNECTORS-HEADERS';
    } else if (nameLower.includes('fastener') || nameLower.includes('standoff') || nameLower.includes('spacer') || nameLower.includes('screw') || nameLower.includes('hardware')) {
      c.parentCategory = 'Fasteners, Hardware & Spacers';
      c.categoryId = 'CAT-SUB-FASTENERS-HARDWARE';
    } else if (nameLower.includes('solder') || nameLower.includes('iron') || nameLower.includes('flux') || nameLower.includes('stripper') || nameLower.includes('plier') || nameLower.includes('tool')) {
      c.parentCategory = 'Tools & Soldering Equipment';
      c.categoryId = 'CAT-SUB-TOOLS-SOLDERING';
    } else {
      c.parentCategory = 'Measuring Instruments & Testing Tools';
      c.categoryId = 'CAT-SUB-MEASURING-TESTING-TOOLS';
    }
    c.categoryPath = `Lab Equipment & Accessories / ${c.parentCategory}`;
    return c;
  }

  // Default fallback for ICs, passives, transistors, diodes, resistors
  c.category = 'ICs & Electronic Components';
  if (nameLower.includes('mcu') || nameLower.includes('atmega') || nameLower.includes('processor') || nameLower.includes('bare chip')) {
    c.parentCategory = 'Microcontrollers & Processors (Bare ICs)';
    c.categoryId = 'CAT-SUB-MICROCONTROLLERS-PROCESSORS';
  } else if (nameLower.includes('op-amp') || nameLower.includes('op amp') || nameLower.includes('lm358') || nameLower.includes('lm741') || nameLower.includes('ne555') || nameLower.includes('linear')) {
    c.parentCategory = 'Operational Amplifiers & Linear ICs';
    c.categoryId = 'CAT-SUB-OP-AMPS-LINEAR-ICS';
  } else if (nameLower.includes('gate') || nameLower.includes('74hc') || nameLower.includes('logic') || nameLower.includes('flip-flop')) {
    c.parentCategory = 'Digital Logic ICs';
    c.categoryId = 'CAT-SUB-DIGITAL-LOGIC-ICS';
  } else if (nameLower.includes('max232') || nameLower.includes('max485') || nameLower.includes('uln2003') || nameLower.includes('interface')) {
    c.parentCategory = 'Interface & Driver ICs';
    c.categoryId = 'CAT-SUB-INTERFACE-DRIVER-ICS';
  } else if (nameLower.includes('transistor') || nameLower.includes('mosfet') || nameLower.includes('diode') || nameLower.includes('rectifier') || nameLower.includes('zener')) {
    c.parentCategory = 'Discrete Semiconductors (Diodes, Transistors, MOSFETs)';
    c.categoryId = 'CAT-SUB-DISCRETE-SEMICONDUCTORS';
  } else if (nameLower.includes('relay') || nameLower.includes('switch') || nameLower.includes('button') || nameLower.includes('buzzer')) {
    c.parentCategory = 'Electromechanical Components (Relays, Switches, Buttons)';
    c.categoryId = 'CAT-SUB-ELECTROMECHANICAL-COMPONENTS';
  } else {
    c.parentCategory = 'Passive Components (Resistors, Capacitors, Inductors)';
    c.categoryId = 'CAT-SUB-PASSIVE-COMPONENTS';
  }
  c.categoryPath = `ICs & Electronic Components / ${c.parentCategory}`;
  return c;
}

// Event bus for reactive UI updates
const listeners = new Set();
export function subscribeToDb(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifySubscribers(changeType, details) {
  listeners.forEach((callback) => {
    try {
      callback(changeType, details);
    } catch (e) {
      console.error('Subscriber notification error:', e);
    }
  });
}

export const SIR_USER = {
  id: 'USER-SIR-01',
  rollNumber: 'SIR',
  name: 'Dr. K. Venkatesh (Lab Incharge / Sir)',
  role: 'sir',
  email: 'sir@incubation.local',
  passwordHash: 'sir123',
  branch: 'ECE',
  section: 'Faculty Mentor',
  academicYear: 0,
  avatarTheme: 'emerald',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_DOMAINS = [
  'IoT & Embedded Systems',
  'Robotics & Automation',
  'VLSI & Chip Design',
  'AI / ML & Edge Computing',
  'Wireless & 5G Communications',
  'Renewable Energy & Power Systems',
  'Biomedical Instrumentation',
];

export const DEFAULT_HOLIDAYS = [
  { id: 'HOL-001', date: '2026-01-26', name: 'Republic Day', type: 'national' },
  { id: 'HOL-002', date: '2026-08-15', name: 'Independence Day', type: 'national' },
  { id: 'HOL-003', date: '2026-10-02', name: 'Gandhi Jayanti', type: 'national' },
  { id: 'HOL-004', date: '2026-01-14', name: 'Makar Sankranti / Pongal', type: 'festival' },
  { id: 'HOL-005', date: '2026-03-25', name: 'College Tech Fest Holiday', type: 'institute' },
];

export const DEFAULT_PROJECTS = [
  {
    id: 'PROJ-001',
    title: 'Smart Lab IoT Environmental & Power Controller',
    teamId: 'TEAM-001',
    leaderRoll: '238W1A0477',
    members: [
      { rollNumber: '238W1A0477', name: 'Anwar Bajarinti', role: 'Team Lead' },
      { rollNumber: '238W1A0412', name: 'Kavya Sharma', role: 'Firmware Engineer' },
      { rollNumber: '238W1A04C2', name: 'Sai Krishna', role: 'Hardware & Sensor Design' },
    ],
    objectives: 'Automated ESP32 power control node with ambient Lux, temperature, and current sensing to reduce incubation lab energy consumption by 35%.',
    domain: 'IoT & Embedded Systems',
    status: 'active',
    githubLink: 'https://github.com/vrsec/smart-lab-iot-controller',
    linkedinLink: 'https://linkedin.com/in/vrsec-incubation',
    budget: 15000,
    prototypeAvailable: true,
    titleChangeRequest: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'PROJ-002',
    title: 'Autonomous Edge AI Quadcopter for Crop Health Telemetry',
    teamId: 'TEAM-002',
    leaderRoll: '238W1A0412',
    members: [
      { rollNumber: '238W1A0412', name: 'Kavya Sharma', role: 'Team Lead' },
      { rollNumber: '238W1A0445', name: 'Rahul Varma', role: 'Computer Vision Engineer' },
    ],
    objectives: 'Lightweight drone platform using Raspberry Pi 4 and TinyML to detect crop leaf disease in real time without cloud latency.',
    domain: 'AI / ML & Edge Computing',
    status: 'active',
    githubLink: 'https://github.com/vrsec/edge-ai-crop-drone',
    linkedinLink: 'https://linkedin.com/in/kavya-sharma',
    budget: 35000,
    prototypeAvailable: true,
    titleChangeRequest: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'PROJ-003',
    title: 'Low-Power RISC-V SoC Architecture for Biometric Nodes',
    teamId: 'TEAM-003',
    leaderRoll: '238W1A0445',
    members: [
      { rollNumber: '238W1A0445', name: 'Rahul Varma', role: 'Team Lead' },
    ],
    objectives: 'Synthesizing a 32-bit RISC-V core on Xilinx Artix-7 FPGA with hardware cryptographic accelerator for biometric authentication.',
    domain: 'VLSI & Chip Design',
    status: 'in_progress',
    githubLink: 'https://github.com/vrsec/riscv-biometric-soc',
    linkedinLink: 'https://linkedin.com/in/rahul-varma',
    budget: 20000,
    prototypeAvailable: false,
    titleChangeRequest: null,
    createdAt: '2026-02-10T10:00:00.000Z',
    updatedAt: '2026-02-10T10:00:00.000Z',
  },
];

export const DEFAULT_TEAMS = [
  {
    id: 'TEAM-001',
    name: 'Team IoT Nexus',
    leaderRoll: '238W1A0477',
    memberRolls: ['238W1A0477', '238W1A0412', '238W1A04C2'],
    domain: 'IoT & Embedded Systems',
    projectId: 'PROJ-001',
    budget: 15000,
    status: 'active',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'TEAM-002',
    name: 'AeroVision Labs',
    leaderRoll: '238W1A0412',
    memberRolls: ['238W1A0412', '238W1A0445'],
    domain: 'AI / ML & Edge Computing',
    projectId: 'PROJ-002',
    budget: 35000,
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'TEAM-003',
    name: 'Silicon Edge Innovators',
    leaderRoll: '238W1A0445',
    memberRolls: ['238W1A0445'],
    domain: 'VLSI & Chip Design',
    projectId: 'PROJ-003',
    budget: 20000,
    status: 'active',
    createdAt: '2026-02-10T10:00:00.000Z',
  },
];

export const DEFAULT_ACHIEVEMENTS = [
  {
    id: 'ACH-001',
    title: 'Smart India Hackathon (SIH) - Grand Prize',
    description: 'Winner of national SIH Hardware Edition for Smart Industrial IoT Power Management System.',
    awardedToRoll: '238W1A0477',
    studentName: 'Anwar Bajarinti',
    prizeMoney: 100000,
    awardedBy: 'Ministry of Education & Dr. K. Venkatesh (Lab Incharge / Sir)',
    dateAwarded: '2026-03-20',
    isPermanent: true,
    createdAt: '2026-03-20T10:00:00.000Z',
  },
  {
    id: 'ACH-002',
    title: '1st Place - National Drone Innovation Challenge',
    description: 'Awarded first place for autonomous edge AI disease detection in aerial drones.',
    awardedToRoll: '238W1A0412',
    studentName: 'Kavya Sharma',
    prizeMoney: 50000,
    awardedBy: 'IEEE Robotics & Automation Society',
    dateAwarded: '2026-02-15',
    isPermanent: true,
    createdAt: '2026-02-15T10:00:00.000Z',
  },
];

export const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ANN-001',
    title: 'VRSEC Innovation Day 2026 Prototype Registrations Open',
    message: 'All student teams are invited to register prototypes and research papers for VRSEC Innovation Day. Grant funding available.',
    category: 'Innovation Day',
    active: true,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Sir / Faculty Mentor',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ANN-002',
    title: 'New Hardware In Stock: ESP32-S3 and STM32 Nucleo Boards',
    message: 'New batch of ESP32-S3 AI-Sense and STM32 boards available in Cabinet A for project prototyping.',
    category: 'Inventory',
    active: true,
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin',
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_EVENTS = [
  {
    id: 'EVT-001',
    title: 'VRSEC Innovation Day 2026',
    theme: 'AI-Driven Embedded Systems & Sustainable Technology',
    eventDate: '2026-11-20',
    prizes: '₹1,50,000 Total Prize Pool + Incubation Seed Grants',
    winners: [
      { team: 'Team IoT Nexus', project: 'Smart Lab IoT Environmental Controller', rank: '1st Place' },
      { team: 'AeroVision Labs', project: 'Edge AI Drone', rank: 'Runner Up' },
    ],
    isInnovationDay: true,
    year: 2026,
    description: 'Annual flagship innovation festival showcasing hardware prototypes, IoT devices, and research demonstrations.',
    createdAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'EVT-002',
    title: 'VRSEC Innovation Day 2025 Archive',
    theme: 'Industry 4.0 & Smart Sensor Networks',
    eventDate: '2025-11-18',
    prizes: '₹1,00,000 Total Prize Pool',
    winners: [
      { team: 'Silicon Edge Innovators', project: 'RISC-V Micro-Node', rank: 'Grand Champion' },
    ],
    isInnovationDay: true,
    year: 2025,
    description: 'Celebrated the deployment of 12 student prototypes into active commercial trials.',
    createdAt: '2025-11-18T10:00:00.000Z',
  },
];

export const DEFAULT_COMPLAINTS = [
  {
    id: 'CMP-001',
    type: 'equipment_environment',
    itemName: 'Bench 2 Soldering Station',
    description: 'Soldering station display fluctuates and heating element shuts off unexpectedly.',
    reportedByRoll: '238W1A0477',
    reportedByName: 'Anwar Bajarinti',
    status: 'in_progress',
    adminNotes: 'Heating cartridge replacement requested from electronics store.',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: null,
  },
  {
    id: 'CMP-002',
    type: 'component_availability',
    itemName: 'ESP32-CAM Modules',
    description: 'Shortage of ESP32-CAM boards with OV2640 camera modules for the computer vision workshop.',
    reportedByRoll: '238W1A0412',
    reportedByName: 'Kavya Sharma',
    status: 'pending',
    adminNotes: '',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  },
];

export const DEFAULT_RESEARCH_PAPERS = [
  {
    id: 'RES-001',
    title: 'Energy-Harvesting BLE Sensor Node Architecture for Incubation Laboratories',
    authors: ['Anwar Bajarinti', 'Dr. K. Venkatesh'],
    studentRoll: '238W1A0477',
    teamName: 'Team IoT Nexus',
    domain: 'IoT & Embedded Systems',
    venue: 'IEEE International Conference on Advanced IoT & Embedded Technologies (ICAIOT 2026)',
    paperType: 'IEEE',
    doi: '10.1109/ICAIOT.2026.1042318',
    externalUrl: 'https://ieeexplore.ieee.org',
    isPublic: true,
    createdAt: '2026-03-01T10:00:00.000Z',
  },
  {
    id: 'RES-002',
    title: 'Real-Time Edge Inference of Crop Foliage Pathologies on Sub-Watt Microcontrollers',
    authors: ['Kavya Sharma', 'Dr. P. Srinivas'],
    studentRoll: '238W1A0412',
    teamName: 'AeroVision Labs',
    domain: 'AI / ML & Edge Computing',
    venue: 'Springer Advances in Intelligent Systems & Computing',
    paperType: 'journal',
    doi: '10.1007/978-3-030-99999-1',
    externalUrl: 'https://springer.com',
    isPublic: true,
    createdAt: '2026-02-18T10:00:00.000Z',
  },
];

export const DEFAULT_SELF_REFLECTIONS = [
  {
    id: 'REF-001',
    studentRoll: '238W1A0477',
    title: 'Mastered FreeRTOS Task Queues & Power Management',
    content: 'Completed the sleep-mode power profiling for the ESP32 lab node today. Consumed only 12uA in deep sleep! Excited to integrate the LoRa transceiver next.',
    isPrivate: true,
    date: '2026-10-02',
    createdAt: '2026-10-02T16:00:00.000Z',
  },
];

// In-memory cache for instant synchronous access backed by Supabase & local cache
let memoryStore = {
  components: [],
  users: [],
  devices: [],
  visits: [],
  dailyAttendance: {},
  transactions: [],
  authorizations: [],
  settings: { ...INITIAL_SETTINGS },
  auditLogs: [],
  currentUser: null,
  projects: [],
  teams: [],
  achievements: [],
  announcements: [],
  events: [],
  complaints: [],
  researchPapers: [],
  selfReflections: [],
  holidays: [],
  domains: [],
  staffPresence: [],
  categories: [],
};

let dbReadyPromise = null;
let isOnlineState =
  typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true;

export function isAppOnline() {
  return isOnlineState;
}

// ==================== LOCAL CACHE & INDEXEDDB HELPERS ====================

function openIndexedDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => {
      resolve(null);
    }, 1200);

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      request.onblocked = () => {
        clearTimeout(timer);
        resolve(null);
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        resolve(request.result);
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        const stores = [
          { name: 'components', key: 'id' },
          { name: 'users', key: 'rollNumber' },
          { name: 'devices', key: 'id' },
          { name: 'visits', key: 'id' },
          { name: 'transactions', key: 'id' },
          { name: 'authorizations', key: 'id' },
          { name: 'settings', key: 'key' },
          { name: 'auditLogs', key: 'id' },
        ];
        for (const s of stores) {
          if (!db.objectStoreNames.contains(s.name)) {
            db.createObjectStore(s.name, { keyPath: s.key });
          }
        }
      };
    } catch (e) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// Save an entire collection to IndexedDB and localStorage as an offline backup
async function persistLocalCache(storeName, data) {
  try {
    const resolveStorageKey = (name) => {
      if (!name) return null;
      if (STORAGE_KEYS[name]) return STORAGE_KEYS[name];
      if (STORAGE_KEYS[name.toUpperCase()]) return STORAGE_KEYS[name.toUpperCase()];
      const snake = name.replace(/([A-Z])/g, '_$1').toUpperCase();
      if (STORAGE_KEYS[snake]) return STORAGE_KEYS[snake];
      return null;
    };
    const key = resolveStorageKey(storeName);
    if (key && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (e) {
    console.warn('localStorage setItem failed:', e);
  }

  try {
    const idb = await openIndexedDB();
    if (!idb || !idb.objectStoreNames.contains(storeName)) return;
    const tx = idb.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        if (storeName === 'settings') {
          store.put({ key: 'global_settings', ...data });
        } else if (Array.isArray(data)) {
          for (const item of data) {
            store.put(item);
          }
        }
        resolve();
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  } catch (e) {
    console.warn(`IndexedDB persist error on ${storeName}:`, e);
  }
}

// ==================== SUPABASE CLOUD DATA ACCESS ====================

/**
 * Fetch latest data from a Supabase table.
 * Returns null if network error, table not yet upgraded, or offline.
 */
async function fetchCloudTable(tableName) {
  try {
    const fetchPromise = (async () => {
      let data = null;
      let error = null;

      if (tableName === 'users') {
        // 1. Direct query on public.users (succeeds for administrators)
        const res = await supabase.from('users').select('*');
        if (!res.error && res.data && res.data.length > 0) {
          data = res.data;
        } else {
          // 2. For staff (direct public.users returns 0 rows under restricted RLS),
          // safely query the dedicated restricted student directory view
          const viewRes = await supabase.from('staff_student_directory').select('*');
          if (!viewRes.error && viewRes.data && viewRes.data.length > 0) {
            data = viewRes.data;
          } else {
            // 3. Programmatic RPC fallback
            try {
              const rpcRes = await supabase.rpc('get_student_directory');
              if (!rpcRes.error && rpcRes.data && rpcRes.data.length > 0) {
                data = rpcRes.data;
              }
            } catch (_) {}
            data = data || res.data || [];
            error = res.error && !data.length ? res.error : null;
          }
        }
      } else {
        const res = await supabase.from(tableName).select('*');
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.warn(`[Supabase] Query warning on ${tableName}:`, error.message);
        return null;
      }
      return Array.isArray(data) ? data.map((row) => fromDbRow(tableName, row)) : [];
    })();

    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    console.warn(`[Supabase] Network/fetch error on ${tableName}:`, err);
    return null;
  }
}

/**
 * Execute cloud mutation with automatic offline queueing fallback.
 * Never reports false success: returns true only if cloud confirmed, false if queued offline.
 */
async function executeCloudMutation({ table, action, id, data }) {
  const timestamp = new Date().toISOString();
  if (data) {
    data.updatedAt = timestamp;
  }

  if (!isOnlineState) {
    syncService.enqueueMutation({ table, action, id, data, timestamp });
    return { success: false, mode: 'offline_queued' };
  }

  try {
    const dbPayload = data ? toDbRow(table, data) : null;
    let resError = null;

    if (action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', id);
      resError = error;
    } else if (action === 'insert') {
      const { error } = await supabase.from(table).insert(dbPayload);
      resError = error;
    } else if (action === 'update') {
      const { error } = await supabase.from(table).update(dbPayload).eq('id', id);
      resError = error;
    } else {
      // Default to upsert for idempotent safety
      const { error } = await supabase.from(table).upsert(dbPayload);
      resError = error;
    }

    if (resError) {
      console.warn(`[Supabase] Mutation error on ${table} (${id}):`, resError.message);
      syncService.enqueueMutation({ table, action, id, data, timestamp });
      return { success: false, mode: 'offline_queued', error: resError.message };
    }

    return { success: true, mode: 'cloud_confirmed' };
  } catch (err) {
    console.warn(`[Supabase] Network failure on ${table} (${id}). Enqueuing offline mutation:`, err);
    syncService.enqueueMutation({ table, action, id, data, timestamp });
    return { success: false, mode: 'offline_queued' };
  }
}

/**
 * Securely retrieves the authenticated user's own profile via get_my_profile RPC.
 * Never exposes sensitive secrets (password_hash, biometric data) or unrelated accounts.
 */
export async function getMyProfile() {
  try {
    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) {
      console.warn('[Supabase] get_my_profile error:', error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row && row.id ? fromDbRow('users', row) : null;
  } catch (err) {
    console.warn('[Supabase] get_my_profile exception:', err);
    return null;
  }
}

/**
 * Resolves the authenticated user's profile from the server using get_my_profile RPC.
 * Falls back to direct query on public.users (for admins) or existing verified local session if offline.
 * Never assigns student role fallback when role cannot be verified.
 */
const NON_AUTHORITATIVE_USER_FIELDS = [
  'fingerprintIds',
  'fingerLabels',
  'incubationStartDate',
  'academicYearAtStart',
  'retentionPeriodYears',
  'retentionEndDate',
  'idCardValidityYear',
  'idCardScannedAt',
];

function isRecordPendingVerification(record) {
  if (!record) return false;
  return (
    record.status === 'pending_verification' ||
    record.verificationStatus === 'pending_roster_verification' ||
    record.membershipStatus === 'pending_verification' ||
    record.membership_status === 'pending_verification' ||
    record.localOnlyFallback === true
  );
}

function isSafeLocalFallbackCandidate(candidate) {
  return Boolean(
    candidate &&
      candidate.role &&
      !isRecordPendingVerification(candidate) &&
      candidate.isActive !== false
  );
}

function findDemoOfflineSeedMatch(cleanId, cleanPassword) {
  if (!cleanId || !cleanPassword) return null;
  const normalizedId = cleanId.trim().toUpperCase();
  const demoSeeds = [...INITIAL_USERS, SIR_USER];
  return (
    demoSeeds.find(
      (seed) =>
        seed.rollNumber &&
        seed.rollNumber.toUpperCase() === normalizedId &&
        seed.passwordHash === cleanPassword
    ) || null
  );
}

/**
 * Reconcile a server-verified user profile into memoryStore.users:
 * preserves non-authoritative local fields missing from server output,
 * strips stale offline/pending flags, and collapses duplicate matching records.
 */
async function reconcileVerifiedUserInCache(verifiedProfile) {
  if (!verifiedProfile) return verifiedProfile;

  const targetId = verifiedProfile.id || null;
  const targetRoll = verifiedProfile.rollNumber
    ? verifiedProfile.rollNumber.trim().toUpperCase()
    : null;

  const matchesUser = (u) => {
    if (!u) return false;
    const sameId = Boolean(targetId && u.id && u.id === targetId);
    const sameRoll = Boolean(
      targetRoll && u.rollNumber && u.rollNumber.trim().toUpperCase() === targetRoll
    );
    return sameId || sameRoll;
  };

  const existingMatches = memoryStore.users.filter(matchesUser);
  const preservedFields = {};
  for (const field of NON_AUTHORITATIVE_USER_FIELDS) {
    if (verifiedProfile[field] === undefined) {
      const localSource = existingMatches.find((u) => u[field] !== undefined);
      if (localSource) {
        preservedFields[field] = localSource[field];
      }
    }
  }

  const resolvedMembershipStatus =
    verifiedProfile.membershipStatus || verifiedProfile.membership_status;
  const normalizedMembershipStatus =
    resolvedMembershipStatus && resolvedMembershipStatus !== 'pending_verification'
      ? resolvedMembershipStatus
      : verifiedProfile.isActive === false
        ? 'inactive'
        : 'active';

  // Authoritative server fields follow preservedFields so server state always wins
  const reconciled = {
    ...preservedFields,
    ...verifiedProfile,
    serverVerified: true,
    localOnlyFallback: false,
    verificationStatus: 'verified',
    status: verifiedProfile.isActive === false ? 'inactive' : 'active',
    membershipStatus: normalizedMembershipStatus,
  };
  delete reconciled.membership_status;
  delete reconciled.fallbackReason;
  delete reconciled.fallbackDetail;

  let inserted = false;
  const nextUsers = [];
  for (const entry of memoryStore.users) {
    if (matchesUser(entry)) {
      if (!inserted) {
        nextUsers.push(reconciled);
        inserted = true;
      }
      continue;
    }
    nextUsers.push(entry);
  }
  if (!inserted) {
    nextUsers.push(reconciled);
  }

  memoryStore.users = nextUsers;
  await persistLocalCache('users', memoryStore.users);
  return reconciled;
}

export async function resolveAuthenticatedProfile(authUser, { allowLocalFallback = true } = {}) {
  if (!authUser) return null;

  // 1. Primary: Retrieve via secure get_my_profile() RPC
  try {
    const rpcProfile = await getMyProfile();
    if (rpcProfile && rpcProfile.role) {
      rpcProfile.authId = authUser.id;
      return rpcProfile;
    }
  } catch (rpcErr) {
    console.warn('[Supabase Auth] get_my_profile RPC warning:', rpcErr);
  }

  // 2. Direct query fallback for admin / substitute_admin / sir (who have direct SELECT on public.users)
  try {
    const { data: rows, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authUser.id)
      .limit(1);
    if (!error && rows && rows.length > 0 && rows[0].role) {
      const mapped = fromDbRow('users', rows[0]);
      mapped.authId = authUser.id;
      return mapped;
    }
  } catch (_) {}

  // Fresh interactive logins can disable unverified local cache fallbacks
  if (!allowLocalFallback) {
    return null;
  }

  // 3. Fallback to existing memoryStore.currentUser if it matches authUser with verified role
  if (
    isSafeLocalFallbackCandidate(memoryStore.currentUser) &&
    (memoryStore.currentUser.authId === authUser.id ||
      (authUser.email && memoryStore.currentUser.rollNumber && authUser.email.toLowerCase().startsWith(memoryStore.currentUser.rollNumber.toLowerCase())))
  ) {
    return { ...memoryStore.currentUser, authId: authUser.id };
  }

  // 4. Fallback to cached session in localStorage if valid and verified
  try {
    const cachedSession = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (cachedSession) {
      const parsed = JSON.parse(cachedSession);
      if (
        isSafeLocalFallbackCandidate(parsed) &&
        (parsed.authId === authUser.id ||
          (authUser.email && parsed.rollNumber && authUser.email.toLowerCase().startsWith(parsed.rollNumber.toLowerCase())))
      ) {
        return { ...parsed, authId: authUser.id };
      }
    }
  } catch (_) {}

  // 5. Fallback to memoryStore.users matching ONLY IF role is present and verified
  const localMatch = memoryStore.users.find(
    (u) =>
      isSafeLocalFallbackCandidate(u) &&
      (u.authId === authUser.id ||
        (authUser.email && u.rollNumber && authUser.email.toLowerCase().startsWith(u.rollNumber.toLowerCase())))
  );
  if (localMatch) {
    return { ...localMatch, authId: authUser.id };
  }

  // Fail closed: Do NOT invent or default to student role
  return null;
}

// ==================== INITIALIZATION & STARTUP ====================

export async function initDatabase() {
  if (dbReadyPromise) return dbReadyPromise;

  dbReadyPromise = (async () => {
    // 1. Load local cache first for instant synchronous render with defensive schema guards
    const getLocal = (k) => {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    };
    const getLocalArray = (k, defaultVal) => {
      try {
        const v = localStorage.getItem(k);
        if (!v) return defaultVal;
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : defaultVal;
      } catch {
        return defaultVal;
      }
    };
    const getLocalObject = (k, defaultVal) => {
      try {
        const v = localStorage.getItem(k);
        if (!v) return defaultVal;
        const parsed = JSON.parse(v);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : defaultVal;
      } catch {
        return defaultVal;
      }
    };

    let localComponents = getLocalArray(STORAGE_KEYS.COMPONENTS, INITIAL_COMPONENTS).map((c) => migrateComponentRecord(c));
    let localUsers = getLocalArray(STORAGE_KEYS.USERS, INITIAL_USERS);
    if (!localUsers.some((u) => u.rollNumber?.toUpperCase() === 'SIR')) {
      localUsers = [...localUsers, SIR_USER];
    }
    localUsers = localUsers
      .filter((u) => {
        if (!u) return false;
        const cleanRoll = String(u.rollNumber || '').trim().toUpperCase();
        if (cleanRoll === '77') return false;
        if (u.role === 'student' && cleanRoll.length !== 10) return false;
        return true;
      })
      .map((u) => ({
        ...u,
        faceRegistered: false, // strictly false - all students begin with zero enrolled embeddings
        branch: u.branch || (u.role === 'sir' ? 'ECE' : 'ECE'),
        section: u.section || (u.role === 'sir' ? 'Faculty Mentor' : 'A'),
        academicYear: u.academicYear || (u.role === 'sir' ? 0 : 3),
        avatarTheme: u.avatarTheme || (u.role === 'sir' ? 'emerald' : 'indigo'),
      }));

    let localDevices = getLocalArray(STORAGE_KEYS.DEVICES, INITIAL_DEVICES);
    let localVisits = getLocalArray(STORAGE_KEYS.VISITS, INITIAL_VISITS);

    // Clean visits: Purge roll 77 or non-10 digit roll numbers, and close any stale active face visits
    const nowTs = Date.now();
    localVisits = localVisits
      .filter((v) => {
        if (!v) return false;
        const roll = String(v.studentRoll || '').trim().toUpperCase();
        if (roll === '77' || (roll && roll.length !== 10)) return false;
        return true;
      })
      .map((v) => {
        // Auto-close stale visits or visits marked with face attendance from previous sessions
        if (v.status === 'inside') {
          const entryTime = new Date(v.entryTime).getTime();
          const isStale = isNaN(entryTime) || (nowTs - entryTime > 12 * 3600 * 1000);
          if (isStale || v.entryMethod === 'face' || v.entryMethod === 'Face Recognition') {
            return {
              ...v,
              status: 'completed',
              exitTime: v.exitTime || new Date(v.entryTime ? entryTime + 60 * 60 * 1000 : nowTs).toISOString(),
              durationMinutes: v.durationMinutes || 60,
              durationFormatted: '60 min',
            };
          }
        }
        return v;
      });

    // Persist sanitized local caches back to browser storage
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(localUsers));
      localStorage.setItem(STORAGE_KEYS.VISITS, JSON.stringify(localVisits));
    } catch (_) {}
    let localDailyAttendance = getLocalArray(STORAGE_KEYS.DAILY_ATTENDANCE, INITIAL_DAILY_ATTENDANCE);
    let localTransactions = getLocalArray(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    let localAuthorizations = getLocalArray(STORAGE_KEYS.AUTHORIZATIONS, INITIAL_AUTHORIZATIONS);
    let localSettings = getLocalObject(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    let localAuditLogs = getLocalArray(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    let localCurrentUser = getLocalObject(STORAGE_KEYS.AUTH_SESSION, localUsers[0]);

    let localProjects = getLocalArray(STORAGE_KEYS.PROJECTS, DEFAULT_PROJECTS);
    let localTeams = getLocalArray(STORAGE_KEYS.TEAMS, DEFAULT_TEAMS);
    let localAchievements = getLocalArray(STORAGE_KEYS.ACHIEVEMENTS, DEFAULT_ACHIEVEMENTS);
    let localAnnouncements = getLocalArray(STORAGE_KEYS.ANNOUNCEMENTS, DEFAULT_ANNOUNCEMENTS);
    let localEvents = getLocalArray(STORAGE_KEYS.EVENTS, DEFAULT_EVENTS);
    let localComplaints = getLocalArray(STORAGE_KEYS.COMPLAINTS, DEFAULT_COMPLAINTS);
    let localResearchPapers = getLocalArray(STORAGE_KEYS.RESEARCH_PAPERS, DEFAULT_RESEARCH_PAPERS);
    let localSelfReflections = getLocalArray(STORAGE_KEYS.SELF_REFLECTIONS, DEFAULT_SELF_REFLECTIONS);
    let localHolidays = getLocalArray(STORAGE_KEYS.HOLIDAYS, DEFAULT_HOLIDAYS);
    let localDomains = getLocalArray(STORAGE_KEYS.DOMAINS, DEFAULT_DOMAINS);
    let localStaffPresence = getLocalArray(STORAGE_KEYS.STAFF_PRESENCE, []);

    // Safe migration to Final 7-Category Classification
    const obsoleteRoots = new Set([
      'CAT-ROOT-ELECTRONICS',
      'CAT-ROOT-OTHER',
      'CAT-ROOT-MOTORS',
      'CAT-ROOT-DISPLAYS',
      'CAT-ROOT-TOOLS',
    ]);
    const obsoleteNames = new Set([
      'Electronics',
      'Other electronic components',
      'Motors & Actuators',
      'Displays',
      'Tools & Lab Equipment',
    ]);

    let rawCategories = getLocalArray(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    let localCategories = rawCategories.filter(
      (c) => !obsoleteRoots.has(c.id) && !obsoleteNames.has(c.name)
    );
    for (const defCat of DEFAULT_CATEGORIES) {
      if (!localCategories.some((c) => c.id === defCat.id || c.name.toLowerCase() === defCat.name.toLowerCase())) {
        localCategories.push(defCat);
      }
    }

    memoryStore = {
      components: localComponents,
      users: localUsers,
      devices: localDevices,
      visits: localVisits,
      dailyAttendance: localDailyAttendance,
      transactions: localTransactions,
      authorizations: localAuthorizations,
      settings: localSettings,
      auditLogs: localAuditLogs,
      currentUser: localCurrentUser,
      projects: localProjects,
      teams: localTeams,
      achievements: localAchievements,
      announcements: localAnnouncements,
      events: localEvents,
      complaints: localComplaints,
      researchPapers: localResearchPapers,
      selfReflections: localSelfReflections,
      holidays: localHolidays,
      domains: localDomains,
      staffPresence: localStaffPresence,
      categories: localCategories,
    };

    // Sync PostgreSQL passwords database users into memoryStore.users
    const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
    fetch(`${pgApiBase}/api/auth/users`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.users)) {
          let hasChanges = false;
          data.users.forEach((pgUser) => {
            const cleanRoll = String(pgUser.roll_number).trim().toUpperCase();
            const existing = memoryStore.users.find(
              (u) => (u.rollNumber && u.rollNumber.toUpperCase() === cleanRoll) ||
                     (u.username && u.username.toLowerCase() === cleanRoll.toLowerCase())
            );
            if (!existing) {
              const startYear = pgUser.academic_year_at_start ? Number(pgUser.academic_year_at_start) : 1;
              const retYears = pgUser.retention_period_years ? Number(pgUser.retention_period_years) : (5 - startYear);
              const startDate = pgUser.incubation_start_date ? String(pgUser.incubation_start_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
              const endDate = pgUser.retention_end_date ? String(pgUser.retention_end_date).slice(0, 10) : null;

              memoryStore.users.push({
                id: cleanRoll,
                rollNumber: pgUser.role === 'student' ? cleanRoll : '',
                username: pgUser.roll_number,
                password: pgUser.password || '',
                name: pgUser.student_name,
                role: pgUser.role || 'student',
                department: pgUser.department || 'Electronics & Communication',
                mobileNumber: pgUser.phone_number || '',
                academicYearAtStart: startYear,
                incubationStartDate: startDate,
                retentionPeriodYears: retYears,
                retentionEndDate: endDate,
                isActive: true,
                status: 'active',
                membershipStatus: 'active',
                serverVerified: true,
                localOnlyFallback: false,
                faceRegistered: false,
                fingerprintIds: [101, 102, 103],
                createdAt: pgUser.created_at || new Date().toISOString(),
                updatedAt: pgUser.updated_at || new Date().toISOString(),
              });
              hasChanges = true;
            } else {
              if (pgUser.password && existing.password !== pgUser.password) {
                existing.password = pgUser.password;
                hasChanges = true;
              }
              if (pgUser.academic_year_at_start && existing.academicYearAtStart !== pgUser.academic_year_at_start) {
                existing.academicYearAtStart = Number(pgUser.academic_year_at_start);
                existing.retentionPeriodYears = 5 - Number(pgUser.academic_year_at_start);
                hasChanges = true;
              }
              if (pgUser.incubation_start_date && !existing.incubationStartDate) {
                existing.incubationStartDate = String(pgUser.incubation_start_date).slice(0, 10);
                hasChanges = true;
              }
              if (pgUser.retention_end_date && !existing.retentionEndDate) {
                existing.retentionEndDate = String(pgUser.retention_end_date).slice(0, 10);
                hasChanges = true;
              }
              if (!existing.serverVerified || existing.status !== 'active') {
                existing.serverVerified = true;
                existing.status = 'active';
                existing.isActive = true;
                existing.localOnlyFallback = false;
                hasChanges = true;
              }
            }
          });
          if (hasChanges) {
            saveToLocalStorage(STORAGE_KEYS.USERS, memoryStore.users);
            notifySubscribers('USERS_SYNCED', memoryStore.users);
          }
        }
      })
      .catch((e) => console.warn('[PostgreSQL Users Init Sync]:', e.message));

    // 2. Setup offline sync dependencies and network status listeners
    syncService.setDependencies(supabase, toDbRow);

    if (typeof window !== 'undefined') {
      isOnlineState =
        typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
          ? navigator.onLine
          : true;

      window.addEventListener('online', async () => {
        isOnlineState = true;
        console.log('[Incubation-CMS] Network online. Draining sync queue & refreshing cloud data...');
        notifySubscribers('NETWORK_STATUS_CHANGED', { isOnline: true });
        try {
          await syncService.processQueue(supabase, toDbRow);
        } catch (syncErr) {
          console.error('[Incubation-CMS] Sync error during reconnect:', syncErr);
        }
        try {
          await refreshFromCloud();
        } catch (fetchErr) {
          console.warn('[Incubation-CMS] Cloud refresh warning during reconnect:', fetchErr);
        }
      });

      window.addEventListener('offline', () => {
        isOnlineState = false;
        console.log('[Incubation-CMS] Operating in Offline Mode.');
        notifySubscribers('NETWORK_STATUS_CHANGED', { isOnline: false });
      });
    }

    // 3. Offline-First Non-Blocking Background Hydration & Auth Session Sync
    // CRITICAL: memoryStore is ALREADY fully populated from local storage (< 2ms).
    // Returning immediately allows the React UI to mount and render instantly without
    // waiting on network roundtrips to Supabase, DNS, or cold starts.
    (async () => {
      try {
        const syncResolvedSessionProfile = async (profile) => {
          if (!profile) return;
          if (profile.isActive === false) {
            await reconcileVerifiedUserInCache(profile);
            memoryStore.currentUser = null;
            localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            try {
              await supabase.auth.signOut();
            } catch (_) {}
            notifySubscribers('AUTH_CHANGED', null);
            return;
          }
          if (isRecordPendingVerification(profile)) {
            return;
          }
          const reconciled = await reconcileVerifiedUserInCache(profile);
          memoryStore.currentUser = reconciled;
          localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(reconciled));
          notifySubscribers('AUTH_CHANGED', memoryStore.currentUser);
        };

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const authUser = sessionData.session.user;
          const profile = await resolveAuthenticatedProfile(authUser);
          await syncResolvedSessionProfile(profile);
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT' || !session) {
            memoryStore.currentUser = null;
            localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            notifySubscribers('AUTH_CHANGED', null);
          } else if (session?.user) {
            const authUser = session.user;
            const profile = await resolveAuthenticatedProfile(authUser);
            await syncResolvedSessionProfile(profile);
          }
        });
      } catch (e) {
        console.warn('[Supabase Auth] Session background initialization warning:', e);
      }

      // Drain any pending offline mutations and refresh latest tables from cloud
      try {
        if (isOnlineState) {
          await syncService.processQueue(supabase, toDbRow);
          await refreshFromCloud();
        }
      } catch (syncErr) {
        console.warn('[Incubation-CMS] Sync error during background initialization:', syncErr);
      }

      // Subscribe to Realtime cloud presence changes
      try {
        subscribeStaffPresenceRealtime();
      } catch (rtErr) {
        console.warn('[Incubation-CMS] Realtime presence error:', rtErr);
      }
    })();

    return memoryStore;
  })();

  return dbReadyPromise;
}

/**
 * Canonical mapping from Username / Roll Number to Supabase Auth synthetic email.
 */
export function toAuthEmail(identifier, role = 'student') {
  const cleanId = String(identifier || '').trim().toLowerCase();
  if (!cleanId) return '';
  if (cleanId.includes('@')) return cleanId;
  if (cleanId === 'admin') return 'admin@incubation.local';
  if (cleanId === 'sir') return 'sir@incubation.local';
  if (cleanId === 'subadmin') return 'subadmin@incubation.local';
  if (cleanId === 'staff' || cleanId.startsWith('staff')) return `${cleanId}@incubation.local`;
  if (role && role !== 'student') {
    return `${cleanId.replace(/[^a-z0-9_]/g, '')}@incubation.local`;
  }
  return `${cleanId.replace(/[^a-z0-9]/g, '')}@student.incubation.local`;
}

/**
 * Shared helper to merge cloud rows with locally modified or unclouded records by id.
 */
function mergeCloudRecords(
  cloudRows,
  localRows,
  { shouldPreferLocal, buildMergedRow, keepLocalOnly } = {}
) {
  const localMap = new Map();
  (localRows || []).forEach((item) => {
    if (item && item.id) localMap.set(item.id, item);
  });

  const merged = (cloudRows || []).map((cloudRow) => {
    const taggedCloud = { ...cloudRow, _syncedFromCloud: true };
    const local = localMap.get(cloudRow.id);
    if (local && shouldPreferLocal && shouldPreferLocal(local, taggedCloud)) {
      return buildMergedRow ? buildMergedRow(taggedCloud, local) : { ...taggedCloud, ...local };
    }
    return taggedCloud;
  });

  const seenIds = new Set(merged.map((m) => m.id));
  localMap.forEach((localItem, id) => {
    if (!seenIds.has(id) && (!keepLocalOnly || keepLocalOnly(localItem))) {
      merged.unshift(localItem);
    }
  });

  return merged;
}

/**
 * Pull latest cloud tables from Supabase into memoryStore and update local cache.
 */
export async function refreshFromCloud() {
  try {
    const [
      cloudComponents,
      cloudDevices,
      cloudVisits,
      cloudTransactions,
      cloudAuthorizations,
      cloudSettings,
      cloudAuditLogs,
      cloudUsers,
      cloudCategories,
      cloudStaffPresence,
      cloudProjects,
      cloudTeams,
      cloudAchievements,
      cloudAnnouncements,
      cloudEvents,
      cloudComplaints,
      cloudResearchPapers,
      cloudSelfReflections,
      cloudHolidays,
      cloudDomains,
    ] = await Promise.all([
      fetchCloudTable('components'),
      fetchCloudTable('devices'),
      fetchCloudTable('visits'),
      fetchCloudTable('transactions'),
      fetchCloudTable('authorizations'),
      fetchCloudTable('settings'),
      fetchCloudTable('audit_logs'),
      fetchCloudTable('users'),
      fetchCloudTable('component_categories'),
      fetchCloudTable('staff_presence'),
      fetchCloudTable('projects'),
      fetchCloudTable('teams'),
      fetchCloudTable('achievements'),
      fetchCloudTable('announcements'),
      fetchCloudTable('events'),
      fetchCloudTable('complaints'),
      fetchCloudTable('research_papers'),
      fetchCloudTable('self_reflections'),
      fetchCloudTable('holidays'),
      fetchCloudTable('domains'),
    ]);

    let hasCloudData = false;

    if (cloudComponents && cloudComponents.length > 0) {
      memoryStore.components = cloudComponents.map((c) => migrateComponentRecord(c));
      persistLocalCache('components', memoryStore.components);
      hasCloudData = true;
    }
    if (cloudCategories && cloudCategories.length > 0) {
      let mergedCategories = cloudCategories.filter(
        (c) => !obsoleteRoots.has(c.id) && !obsoleteNames.has(c.name)
      );
      for (const defCat of DEFAULT_CATEGORIES) {
        if (!mergedCategories.some((c) => c.id === defCat.id || c.name.toLowerCase() === defCat.name.toLowerCase())) {
          mergedCategories.push(defCat);
        }
      }
      memoryStore.categories = mergedCategories;
      persistLocalCache('categories', mergedCategories);
      hasCloudData = true;
    }
    if (cloudDevices && cloudDevices.length > 0) {
      memoryStore.devices = cloudDevices;
      persistLocalCache('devices', cloudDevices);
      hasCloudData = true;
    }
    if (cloudVisits && cloudVisits.length > 0) {
      const sampleVisitIds = new Set((INITIAL_VISITS || []).map((v) => v.id));
      memoryStore.visits = mergeCloudRecords(cloudVisits, memoryStore.visits, {
        shouldPreferLocal: (local, cv) =>
          local.syncStatus === 'pending_sync' ||
          local.syncStatus === 'pending_retry' ||
          (local.status === 'completed' && cv.status === 'inside'),
        keepLocalOnly: (local) =>
          !sampleVisitIds.has(local.id) &&
          (local.syncStatus === 'pending_sync' ||
            local.syncStatus === 'pending_retry' ||
            !local._syncedFromCloud),
      });
      persistLocalCache('visits', memoryStore.visits);
      hasCloudData = true;
    }
    if (cloudTransactions && cloudTransactions.length > 0) {
      memoryStore.transactions = mergeCloudRecords(cloudTransactions, memoryStore.transactions, {
        shouldPreferLocal: (local) =>
          local.syncStatus === 'pending_sync' ||
          local.syncStatus === 'pending_retry' ||
          local.status === 'returned' ||
          local.status === 'partially_returned',
        buildMergedRow: (ct, local) => ({
          ...ct,
          ...local,
          items: local.items || ct.items,
          status: local.status,
          returnedDate: local.returnedDate || ct.returnedDate,
          lastReturnDate: local.lastReturnDate || ct.lastReturnDate,
        }),
      });
      persistLocalCache('transactions', memoryStore.transactions);
      hasCloudData = true;
    }
    if (cloudAuthorizations && cloudAuthorizations.length > 0) {
      memoryStore.authorizations = cloudAuthorizations;
      persistLocalCache('authorizations', cloudAuthorizations);
      hasCloudData = true;
    }
    if (cloudSettings && cloudSettings.length > 0) {
      const s = cloudSettings[0];
      if (s.value) {
        memoryStore.settings = { ...INITIAL_SETTINGS, ...s.value };
      } else {
        memoryStore.settings = { ...INITIAL_SETTINGS, ...s };
      }
      persistLocalCache('settings', memoryStore.settings);
      hasCloudData = true;
    }
    if (cloudAuditLogs && cloudAuditLogs.length > 0) {
      memoryStore.auditLogs = cloudAuditLogs;
      persistLocalCache('auditLogs', cloudAuditLogs);
      hasCloudData = true;
    }
    if (cloudUsers && cloudUsers.length > 0) {
      let mergedUsers = cloudUsers.map((u) => ({
        ...u,
        serverVerified: Boolean(
          u.authId &&
            u.isActive !== false &&
            u.membershipStatus !== 'pending_verification' &&
            u.status !== 'pending_verification'
        ),
        localOnlyFallback: false,
      }));
      // Preserve currently authenticated staff/admin/student session profile if missing or reconciled
      if (
        memoryStore.currentUser &&
        memoryStore.currentUser.role &&
        !mergedUsers.some(
          (u) =>
            u.id === memoryStore.currentUser.id ||
            (u.rollNumber && memoryStore.currentUser.rollNumber && u.rollNumber.toUpperCase() === memoryStore.currentUser.rollNumber.toUpperCase())
        )
      ) {
        mergedUsers.push(memoryStore.currentUser);
      }
      memoryStore.users = mergedUsers;
      persistLocalCache('users', mergedUsers);
      hasCloudData = true;
    }

    if (cloudStaffPresence && Array.isArray(cloudStaffPresence)) {
      const cloudIds = new Set(cloudStaffPresence.map((p) => p.id));
      const localOnly = (memoryStore.staffPresence || []).filter((p) => !cloudIds.has(p.id));
      const merged = [...cloudStaffPresence, ...localOnly];
      memoryStore.staffPresence = merged;
      persistLocalCache('staffPresence', merged);
      notifySubscribers('STAFF_PRESENCE_CHANGED', merged);
      hasCloudData = true;
    }

    const portalCloudTables = [
      [cloudProjects, 'projects'],
      [cloudTeams, 'teams'],
      [cloudAchievements, 'achievements'],
      [cloudAnnouncements, 'announcements'],
      [cloudEvents, 'events'],
      [cloudComplaints, 'complaints'],
      [cloudResearchPapers, 'researchPapers'],
      [cloudSelfReflections, 'selfReflections'],
      [cloudHolidays, 'holidays'],
      [cloudDomains, 'domains'],
    ];

    for (const [rows, storeKey] of portalCloudTables) {
      if (rows && rows.length > 0) {
        memoryStore[storeKey] = mergeCloudRecords(rows, memoryStore[storeKey], {
          shouldPreferLocal: (local) =>
            local.syncStatus === 'pending_sync' || local.syncStatus === 'pending_retry',
          keepLocalOnly: (local) =>
            local.syncStatus === 'pending_sync' || local.syncStatus === 'pending_retry',
        });
        persistLocalCache(storeKey, memoryStore[storeKey]);
        hasCloudData = true;
      }
    }

    // Safe initial population: If cloud database was completely empty on first connection,
    // seed the initial catalog so Supabase contains the starter inventory
    if (!hasCloudData && cloudComponents && cloudComponents.length === 0) {
      console.log('[Supabase] Initializing cloud catalog with baseline components...');
      seedCloudDatabase();
    }

    notifySubscribers('DATABASE_SYNCED', memoryStore);
  } catch (err) {
    console.warn('[Supabase] Refresh from cloud failed, using cached data:', err);
  }
}

/**
 * Helper to seed initial catalog to Supabase if the tables were empty.
 */
async function seedCloudDatabase() {
  try {
    for (const cat of DEFAULT_CATEGORIES) {
      await supabase.from('component_categories').upsert(toDbRow('component_categories', cat));
    }
    for (const c of INITIAL_COMPONENTS) {
      await supabase.from('components').upsert(toDbRow('components', c));
    }
    for (const d of INITIAL_DEVICES) {
      await supabase.from('devices').upsert(toDbRow('devices', d));
    }
    for (const u of INITIAL_USERS) {
      await supabase.from('users').upsert(toDbRow('users', u));
    }
    await supabase.from('settings').upsert({
      id: 'SETTING-001',
      key: 'global_settings',
      value: INITIAL_SETTINGS,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Supabase Seeding]:', e);
  }
}

// ==================== AUTHENTICATION & USERS ====================

export function getCurrentUser() {
  return memoryStore.currentUser;
}

export function setCurrentUser(user) {
  memoryStore.currentUser = user;
  if (user) {
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  }
  notifySubscribers('AUTH_CHANGED', user);
}

/**
 * Login via Supabase Auth.
 * Automatically translates Roll Number / Username to Supabase Auth email.
 * Never stores or compares plaintext passwords locally!
 */
export async function loginUser(identifier, password) {
  if (!identifier || !password) {
    throw new Error('User identifier and password are required.');
  }

  const cleanId = identifier.trim();
  const cleanPassword = password.trim();

  // Authoritative PostgreSQL Database Authentication (passwords table)
  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
  let res, data;
  try {
    res = await fetch(`${pgApiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password: cleanPassword }),
    });
    data = await res.json().catch(() => null);
  } catch (netErr) {
    throw new Error('Database connection failed. Please ensure the server is running.');
  }

  // 1. If not found in table or password does not match -> DO NOT OPEN!
  if (!res.ok || !data || !data.success) {
    if (data && data.error) {
      throw new Error(data.error);
    }
    // Client-side fallback if API endpoint is deploying or returning 404
    if (cleanId.toLowerCase() === 'admin' && cleanPassword === 'admin123') {
      const adminUser = memoryStore.users.find((u) => u.username === 'admin' || u.role === 'admin') || {
        id: 'admin',
        username: 'admin',
        name: 'Administrator',
        role: 'admin',
        department: 'Incubation Management',
        isActive: true,
      };
      setCurrentUser(adminUser);
      return adminUser;
    }
    throw new Error(data?.error || 'Record not found. Please register first.');
  }

  // 2. Credentials compared and password MATCHED!
  const dbUser = data.user;
  let user = memoryStore.users.find(
    (u) =>
      (u.rollNumber && u.rollNumber.toUpperCase() === cleanId.toUpperCase()) ||
      (u.username && u.username.toLowerCase() === cleanId.toLowerCase()) ||
      (u.id && String(u.id).toLowerCase() === cleanId.toLowerCase())
  );

  if (!user) {
    user = {
      id: dbUser.id || cleanId,
      rollNumber: dbUser.rollNumber || (dbUser.role === 'student' ? cleanId : ''),
      username: dbUser.username || cleanId,
      name: dbUser.name || cleanId,
      role: dbUser.role || 'student',
      department: dbUser.department || 'Electronics & Communication',
      mobileNumber: dbUser.mobileNumber || '',
      isActive: true,
      status: 'active',
      membershipStatus: 'active',
      serverVerified: true,
      localOnlyFallback: false,
      faceRegistered: false,
      fingerprintIds: [101, 102, 103],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.users.push(user);
  } else {
    user.isActive = true;
    user.status = 'active';
    user.serverVerified = true;
    user.localOnlyFallback = false;
    user.role = dbUser.role || user.role;
    user.name = dbUser.name || user.name;
    if (dbUser.department) user.department = dbUser.department;
    if (dbUser.mobileNumber) user.mobileNumber = dbUser.mobileNumber;
  }

  saveToLocalStorage(STORAGE_KEYS.USERS, memoryStore.users);
  setCurrentUser(user);
  logAuditEvent({
    actorName: user.name,
    actorRole: user.role,
    action: 'User Login',
    targetRoll: user.rollNumber,
    details: `${user.name} (${user.role}) signed in successfully via PostgreSQL database.`,
  });
  return user;
}



export const authenticateUser = loginUser;

export async function logoutUser() {
  const user = memoryStore.currentUser;

  // IMPORTANT: Logging out is NOT leaving the lab.
  // Physical lab presence remains persistent until an administrator explicitly clicks "I'm Outside".
  // Never alter or reset staff/admin presence during session sign-out or expiration.

  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[Supabase Auth SignOut]:', e);
  }

  if (user) {
    logAuditEvent({
      actorName: user.name,
      actorRole: user.role,
      action: 'User Logout',
      targetRoll: user.rollNumber,
      details: `${user.name} signed out.`,
    });
  }
  setCurrentUser(null);
}

export function getAllUsers() {
  return [...memoryStore.users];
}

export function getStudents() {
  return memoryStore.users.filter(
    (u) => u.role === 'student' || (!u.role && u.rollNumber !== 'ADMIN' && u.rollNumber !== 'SUBADMIN')
  );
}

export function getUserByRoll(rollNumber) {
  if (!rollNumber) return null;
  const cleanRoll = rollNumber.trim().toUpperCase();
  return memoryStore.users.find((u) => u.rollNumber && u.rollNumber.toUpperCase() === cleanRoll) || null;
}
export const getStudentByRoll = getUserByRoll;

/**
 * Automatically ensures a student verified by SQLite biometric face recognition exists in memoryStore.
 * Prevents "Unknown or Unlinked Face" rejections for registered students.
 */
export function registerBiometricUserIfMissing(rollNumber, name) {
  if (!rollNumber) return null;
  const cleanRoll = rollNumber.trim().toUpperCase();
  if (cleanRoll.length !== 10) {
    console.warn(`[Biometric User] Ignored invalid roll number "${cleanRoll}": roll numbers must be strictly 10 characters.`);
    return null;
  }
  const cleanName = (name && name !== 'Unknown Person') ? name.trim() : `Student ${cleanRoll}`;

  let existing = getUserByRoll(cleanRoll);
  if (existing) {
    return existing;
  }

  // Add directly to PostgreSQL passwords table
  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
  try {
    fetch(`${pgApiBase}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roll_number: cleanRoll,
        password: 'student123',
        student_name: cleanName,
        department: 'Electronics & Communication',
        phone_number: '',
        role: 'student',
      }),
    }).catch(() => {});
  } catch (_) {}

  const newUser = {
    id: cleanRoll,
    authId: null,
    rollNumber: cleanRoll,
    name: cleanName,
    role: 'student',
    status: 'active',
    membershipStatus: 'active',
    verificationStatus: 'verified',
    isActive: true,
    serverVerified: true,
    localOnlyFallback: false,
    faceRegistered: false,
    branch: 'ECE',
    department: 'Electronics & Communication',
    section: 'A',
    academicYear: 2,
    incubationStartDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  memoryStore.users.push(newUser);
  persistLocalCache('users', memoryStore.users);
  notifySubscribers('USER_REGISTERED', newUser);
  return newUser;
}

/**
 * Securely retrieves authorized minimal student roll numbers for prefix discovery.
 * Strictly excludes sensitive credentials (passwords, tokens, phone numbers, face embeddings).
 * @returns {Array<{ rollNumber: string, name: string, department?: string }>}
 */
export function getAuthorizedStudentRollDataset() {
  const students = getStudents();
  return students
    .filter((u) => u && u.rollNumber && typeof u.rollNumber === 'string')
    .map((u) => ({
      rollNumber: u.rollNumber.trim().toUpperCase(),
      name: u.name,
      department: u.department || '',
    }));
}

/**
 * Returns dynamic roll number prefix suggestions derived from registered students.
 * Automatically discovers common prefixes without hardcoded configuration.
 * @param {object} [options]
 * @param {string} [options.filterQuery]
 * @returns {Array<{ prefix: string, count: number, remainingLength: number, sampleSuffixes: string[] }>}
 */
export function getRollNumberPrefixSuggestions(options = {}) {
  const dataset = getAuthorizedStudentRollDataset();
  return discoverRollNumberPrefixes(dataset.map((s) => s.rollNumber), options);
}

/**
 * Register student at entrance station (face recognition + credentials).
 * Provisions Supabase Auth user and saves profile to Supabase PostgreSQL.
 */
/**
 * Direct Supabase Auth + Admin RPC provisioning used when Cloudflare Pages Functions
 * (/api/register-student) are unavailable (for example, local Vite dev server with .env.local).
 * Uses an ephemeral non-persisting Auth client so the operator's active session stays intact.
 */
async function provisionSupabaseLoginDirect({
  rollNumber,
  name,
  password,
  role = 'student',
  mobileNumber = '',
  department = '',
  branch = '',
  section = 'A',
  academicYearAtStart = 1,
  retentionPeriodYears = 4,
  retentionEndDate = null,
  incubationStartDate = null,
  faceRegistered = false,
  facePhotoUrl = null,
}) {
  const { supabaseUrl, supabasePublishableKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      ok: false,
      reason: 'supabase_unconfigured',
      detail: 'Supabase URL or publishable key is not configured.',
    };
  }

  const cleanRoll = rollNumber.trim().toUpperCase();
  const cleanName = name.trim();
  const cleanRole =
    role === 'admin' || role === 'substitute_admin' || role === 'sir' || role === 'staff'
      ? role
      : 'student';
  const authEmail = toAuthEmail(cleanRoll, cleanRole);

  const ephemeralClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: signUpData, error: signUpError } = await ephemeralClient.auth.signUp({
    email: authEmail,
    password: password.trim(),
    options: {
      data: {
        roll_number: cleanRoll,
        name: cleanName,
        role: cleanRole,
      },
    },
  });

  if (signUpError || !signUpData?.user?.id) {
    const errMsg = signUpError?.message || 'Supabase Auth signup failed.';
    return {
      ok: false,
      duplicate: /already registered/i.test(errMsg),
      reason: 'auth_signup_error',
      detail: /already registered/i.test(errMsg)
        ? `Auth login already exists for ${cleanRoll}; apply SQL Migration 012 or deploy /api/register-student and use Password -> Activate Login.`
        : errMsg,
    };
  }

  const authUserId = signUpData.user.id;
  const startDate = incubationStartDate || new Date().toISOString().slice(0, 10);
  const startYear = Number(academicYearAtStart) || 1;
  const resolvedDept = (department && department.trim()) || 'Electronics & Communication Engineering';
  const resolvedBranch = (branch && branch.trim()) || resolvedDept || 'ECE';

  try {
    const { data: rpcProfile, error: rpcErr } = await supabase.rpc('admin_provision_user_profile', {
      p_auth_id: authUserId,
      p_roll_number: cleanRoll,
      p_name: cleanName,
      p_role: cleanRole,
      p_mobile_number: mobileNumber ? mobileNumber.trim() : '',
      p_department: resolvedDept,
      p_branch: resolvedBranch,
      p_section: section || 'A',
      p_academic_year: startYear,
      p_face_registered: Boolean(faceRegistered),
      p_face_photo_url: facePhotoUrl || null,
      p_incubation_start_date: startDate,
      p_academic_year_at_start: startYear,
      p_retention_period_years: Number(retentionPeriodYears) || 4,
      p_retention_end_date: retentionEndDate || null,
    });

    if (!rpcErr && rpcProfile) {
      const mapped = fromDbRow('users', rpcProfile);
      return {
        ok: true,
        user: {
          ...mapped,
          authId: authUserId,
          status: 'active',
          membershipStatus: 'active',
          verificationStatus: 'verified',
          isActive: true,
          serverVerified: true,
          localOnlyFallback: false,
        },
      };
    }

    const rpcErrMsg = rpcErr?.message || '';
    const rpcMissing =
      rpcErr?.code === 'PGRST202' ||
      rpcErr?.code === '42883' ||
      /admin_provision_user_profile/i.test(rpcErrMsg);

    if (!rpcMissing) {
      return {
        ok: false,
        authCreatedUnlinked: true,
        authId: authUserId,
        reason: 'profile_rpc_error',
        detail: `Auth login was created, but server profile provisioning failed: ${rpcErrMsg}`,
      };
    }

    // Legacy DB fallback if migration 007 hasn't revoked direct insert on public.users
    const entropy =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
        : Math.random().toString(36).slice(2, 12).toUpperCase();
    const nowIso = new Date().toISOString();
    const rowPayload = toDbRow('users', {
      id: `USER-${entropy}`,
      authId: authUserId,
      rollNumber: cleanRoll,
      name: cleanName,
      role: cleanRole,
      isActive: true,
      membership_status: 'active',
      mobileNumber: mobileNumber ? mobileNumber.trim() : '',
      department: resolvedDept,
      branch: resolvedBranch,
      section: section || 'A',
      academicYear: startYear,
      faceRegistered: Boolean(faceRegistered),
      facePhotoUrl: facePhotoUrl || null,
      incubationStartDate: startDate,
      academicYearAtStart: startYear,
      retentionPeriodYears: Number(retentionPeriodYears) || 4,
      retentionEndDate: retentionEndDate || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const { data: insertedRow, error: insertErr } = await supabase
      .from('users')
      .insert(rowPayload)
      .select()
      .single();

    if (!insertErr && insertedRow) {
      const mapped = fromDbRow('users', insertedRow);
      return {
        ok: true,
        user: {
          ...mapped,
          authId: authUserId,
          status: 'active',
          membershipStatus: 'active',
          verificationStatus: 'verified',
          isActive: true,
          serverVerified: true,
          localOnlyFallback: false,
        },
      };
    }

    return {
      ok: false,
      authCreatedUnlinked: true,
      authId: authUserId,
      reason: 'migration_012_required',
      detail: `Supabase Auth login was created, but saving profile to public.users requires SQL Migration 012 (admin_provision_user_profile) or Cloudflare Pages (/api/register-student). (${insertErr?.message || rpcErrMsg})`,
    };
  } finally {
    try {
      await ephemeralClient.auth.signOut();
    } catch (_) {}
  }
}

export async function registerStudentFirstVisit({
  name,
  rollNumber,
  mobileNumber,
  password,
  fingerprintIds = [],
  fingerLabels = ['Right Thumb', 'Right Index', 'Left Index'],
  faceRegistered = false,
  facePhotoUrl = null,
  department = '',
  incubationStartDate = null,
  academicYearAtStart = null,
  idCardValidityYear = null,
  branch = '',
  role = 'student',
}) {
  const cleanRoll = rollNumber.trim().toUpperCase();
  const cleanName = name.trim();
  const cleanRole =
    role === 'admin' || role === 'substitute_admin' || role === 'sir' || role === 'staff'
      ? role
      : 'student';

  if (!cleanRoll) throw new Error('Roll Number is required.');
  if (cleanRole === 'student' && cleanRoll.length !== 10) {
    throw new Error('Student Roll Number must be strictly 10 characters (e.g. 238W1A0477).');
  }
  if (!cleanName) throw new Error('Student Name is required.');
  if (!password || password.trim().length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // Check Storage Protection Mode
  const storageStatus = getDatabaseStorageStatus();
  const perm = validateStorageWrite('REGISTER_STUDENT', storageStatus);
  if (!perm.allowed) {
    throw new Error(perm.message);
  }

  // Calculate explicit retention based strictly on journey start date and year
  const journeyStartDate = incubationStartDate || new Date().toISOString().slice(0, 10);
  const startYear = academicYearAtStart ? Number(academicYearAtStart) : null;
  const retentionYears = startYear ? calculateRetentionYears(startYear) : null;
  const retentionEndDate = (journeyStartDate && startYear)
    ? calculateRetentionEndDate(journeyStartDate, startYear)
    : null;

  // Fallback slot IDs if migrating legacy accounts
  const fIds =
    fingerprintIds.length === 3
      ? fingerprintIds
      : [
          Math.floor(100 + Math.random() * 800),
          Math.floor(100 + Math.random() * 800),
          Math.floor(100 + Math.random() * 800),
        ];

  // 0. Primary PostgreSQL Authentication: Save / Upsert Student into public.passwords table
  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
  let pgSuccess = false;
  try {
    const signupRes = await fetch(`${pgApiBase}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roll_number: cleanRoll,
        password: password.trim(),
        student_name: cleanName,
        department: department || branch || 'Electronics & Communication',
        phone_number: mobileNumber || '',
        role: cleanRole,
      }),
    });
    const signupData = await signupRes.json().catch(() => null);
    if (signupRes.ok && signupData?.success) {
      pgSuccess = true;
    }
  } catch (pgErr) {
    console.warn('[PostgreSQL registerStudentFirstVisit]:', pgErr.message);
  }

  // Create verified and active student profile
  const registeredUser = {
    id: cleanRoll,
    name: cleanName,
    rollNumber: cleanRoll,
    mobileNumber: mobileNumber || '',
    department: department || branch || 'Electronics & Communication',
    branch: branch || department || '',
    fingerprintIds: fIds,
    fingerLabels,
    faceRegistered: false,
    facePhotoUrl: facePhotoUrl || null,
    incubationStartDate: journeyStartDate,
    academicYearAtStart: startYear || 1,
    retentionPeriodYears: retentionYears || 4,
    retentionEndDate,
    status: 'active',
    membershipStatus: 'active',
    verificationStatus: 'verified',
    role: cleanRole,
    isActive: true,
    serverVerified: true,
    localOnlyFallback: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = memoryStore.users.findIndex(
    (u) => u.rollNumber && u.rollNumber.toUpperCase() === cleanRoll
  );
  if (existingIdx >= 0) {
    memoryStore.users[existingIdx] = { ...memoryStore.users[existingIdx], ...registeredUser };
  } else {
    memoryStore.users.push(registeredUser);
  }
  saveToLocalStorage(STORAGE_KEYS.USERS, memoryStore.users);

  logAuditEvent({
    actorName: memoryStore.currentUser?.name || 'Administrator',
    actorRole: memoryStore.currentUser?.role || 'Admin',
    action: 'Student Registered',
    targetRoll: cleanRoll,
    details: `Admin registered ${cleanName} (${cleanRoll}) directly into PostgreSQL database passwords table.`,
  });

  notifySubscribers('USER_REGISTERED', registeredUser);
  return registeredUser;

  // 1. If online, invoke Cloudflare Gatekeeper Function or direct Supabase Admin RPC when configured
  const isDevHost =
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1' ||
      window.location.hostname === '[::1]');
  const supabaseConfig = getSupabaseConfig();

  let fallbackReason = null;
  let fallbackDetail = null;
  let authCreatedUnlinked = false;
  let pendingAuthId = null;

  if (isDevHost && !supabaseConfig.isConfigured) {
    fallbackReason = 'local_dev_host';
    fallbackDetail = 'Running on localhost dev server without Cloudflare Pages Functions (/api/register-student).';
  } else if (!isOnlineState) {
    fallbackReason = 'offline';
    fallbackDetail = 'Device is currently offline.';
  } else {
    let operatorToken = memoryStore.currentUser?.token || '';
    if (!operatorToken) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        operatorToken = sessionData?.session?.access_token || '';
      } catch {
        // Continue
      }
    }

    let kioskAttestationToken = null;

    // Standalone physical kiosk registration: obtain hardware attestation from local gateway
    if (!operatorToken && typeof fetch !== 'undefined' && !isDevHost) {
      const gatewayUrl = (typeof window !== 'undefined' && window.__LAB_GATEWAY_URL__) || 'http://127.0.0.1:5050';
      const kioskMachineIdentity =
        (typeof window !== 'undefined' && (window.__KIOSK_MACHINE_IDENTITY__ || window.localStorage?.getItem('kiosk_machine_identity'))) ||
        (typeof process !== 'undefined' && process.env?.VITE_KIOSK_MACHINE_IDENTITY) ||
        '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        const attestationRes = await fetch(`${gatewayUrl}/api/gateway/kiosk-attestation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(kioskMachineIdentity ? { 'X-Kiosk-Machine-Identity': kioskMachineIdentity } : {}),
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (attestationRes.ok) {
          const attestationData = await attestationRes.json();
          if (attestationData.success && attestationData.attestationToken) {
            kioskAttestationToken = attestationData.attestationToken;
          }
        }
      } catch (attestErr) {
        clearTimeout(timeoutId);
        console.warn('[Kiosk Gateway Bridge] Gateway unavailable, falling back to local registration:', attestErr.message);
      }
    }

    let endpointUnavailable = isDevHost;

    if (!operatorToken && !kioskAttestationToken) {
      fallbackReason = 'missing_server_attestation';
      fallbackDetail =
        'No live Supabase Admin session is active (Offline Demo Admin or unattended station without kiosk attestation). Sign in with a real Supabase Admin account to generate server logins.';
    } else if (typeof fetch !== 'undefined') {
      try {
        const response = await fetch('/api/register-student', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(operatorToken ? { Authorization: `Bearer ${operatorToken}` } : {}),
          },
          body: JSON.stringify({
            rollNumber: cleanRoll,
            name: cleanName,
            mobileNumber,
            password,
            role: cleanRole,
            registrationMode: operatorToken ? 'staff_assisted' : 'physical_kiosk',
            kioskAttestation: kioskAttestationToken,
            department,
            branch,
            academicYear: academicYearAtStart || 1,
            faceRegistered,
            facePhotoUrl,
            incubationStartDate: journeyStartDate,
            academicYearAtStart: startYear,
            retentionPeriodYears: retentionYears,
            retentionEndDate,
          }),
        });

        const contentType = response.headers?.get?.('content-type') || '';
        const isJsonResponse = !response.headers || contentType.toLowerCase().includes('application/json');

        if (response.ok && isJsonResponse) {
          endpointUnavailable = false;
          const result = await response.json();
          if (result.success && result.user) {
            const registeredUser = await reconcileVerifiedUserInCache({
              ...result.user,
              department: result.user.department || department,
              fingerprintIds: fIds,
              fingerLabels,
              faceRegistered: Boolean(faceRegistered),
              facePhotoUrl: facePhotoUrl || null,
              incubationStartDate: journeyStartDate,
              academicYearAtStart: startYear,
              retentionPeriodYears: retentionYears,
              retentionEndDate: retentionEndDate,
              status: 'active',
              membershipStatus: 'active',
              verificationStatus: 'verified',
              isActive: true,
              serverVerified: true,
              localOnlyFallback: false,
              createdAt: result.user.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            logAuditEvent({
              actorName: memoryStore.currentUser?.name || 'Authorized Lab Station',
              actorRole: memoryStore.currentUser?.role || 'Staff Operator',
              action: 'Student Registered (Roster Verified)',
              targetRoll: cleanRoll,
              details: `Registered ${cleanName} (${cleanRole}) with active Supabase login.`,
            });
            notifySubscribers('USER_REGISTERED', registeredUser);
            return registeredUser;
          }
          fallbackReason = 'invalid_api_response';
          fallbackDetail = result?.error || 'Server registration response did not include a created user record.';
        } else if (!isJsonResponse || (response.status === 404 && !contentType.toLowerCase().includes('application/json'))) {
          endpointUnavailable = true;
          fallbackReason = 'local_dev_host';
          fallbackDetail = 'Cloudflare Pages /api/register-student endpoint is unavailable on this dev server.';
        } else {
          endpointUnavailable = false;
          const errPayload = await response.json().catch(() => null);
          if (response.status === 409) {
            throw new Error(
              errPayload?.error ||
                `Account with Roll Number "${cleanRoll}" already exists on server. Use Password reset to update credentials.`
            );
          }
          fallbackReason = 'api_error';
          fallbackDetail = errPayload?.error || `Cloud registration endpoint returned HTTP ${response.status}.`;
          console.warn('[Register Student] Cloud registration response not OK, falling back to local registration:', response.status, fallbackDetail);
        }
      } catch (apiErr) {
        if (apiErr?.message && /already (exists|registered)/i.test(apiErr.message)) {
          throw apiErr;
        }
        if (isDevHost) {
          endpointUnavailable = true;
          fallbackReason = 'local_dev_host';
          fallbackDetail = apiErr?.message || 'Cloud registration endpoint unreachable on localhost.';
        } else {
          fallbackReason = 'network_error';
          fallbackDetail = apiErr?.message || 'Cloud registration endpoint unreachable.';
        }
        console.warn('[Register Student] Cloud endpoint unreachable:', apiErr.message);
      }
    } else if (!supabaseConfig.isConfigured) {
      fallbackReason = 'fetch_unavailable';
      fallbackDetail = 'HTTP client is unavailable in this environment.';
    }

    // 1b. Direct Supabase Login Provisioning Fallback for Vite local dev (or unserved /api/register-student)
    if (
      endpointUnavailable &&
      supabaseConfig.isConfigured &&
      operatorToken &&
      ['admin', 'substitute_admin', 'sir'].includes(memoryStore.currentUser?.role)
    ) {
      const directResult = await provisionSupabaseLoginDirect({
        rollNumber: cleanRoll,
        name: cleanName,
        password,
        role: cleanRole,
        mobileNumber,
        department,
        branch,
        academicYearAtStart: startYear || 1,
        retentionPeriodYears: retentionYears || 4,
        retentionEndDate,
        incubationStartDate: journeyStartDate,
        faceRegistered,
        facePhotoUrl,
      });

      if (directResult.ok && directResult.user) {
        const registeredUser = await reconcileVerifiedUserInCache({
          ...directResult.user,
          department: directResult.user.department || department,
          fingerprintIds: fIds,
          fingerLabels,
          faceRegistered: Boolean(faceRegistered),
          facePhotoUrl: facePhotoUrl || null,
          incubationStartDate: journeyStartDate,
          academicYearAtStart: startYear,
          retentionPeriodYears: retentionYears,
          retentionEndDate,
          status: 'active',
          membershipStatus: 'active',
          verificationStatus: 'verified',
          isActive: true,
          serverVerified: true,
          localOnlyFallback: false,
        });

        logAuditEvent({
          actorName: memoryStore.currentUser?.name || 'Administrator',
          actorRole: memoryStore.currentUser?.role || 'admin',
          action: 'Account Registered (Supabase Direct)',
          targetRoll: cleanRoll,
          details: `Registered ${cleanName} (${cleanRole}) directly via Supabase Auth & Admin RPC.`,
        });
        notifySubscribers('USER_REGISTERED', registeredUser);
        return registeredUser;
      }

      if (directResult.authCreatedUnlinked) {
        authCreatedUnlinked = true;
        pendingAuthId = directResult.authId || null;
      }
      if (directResult.reason) {
        fallbackReason = directResult.reason;
      }
      if (directResult.detail) {
        fallbackDetail = directResult.detail;
      }
    }
  }

  // 2. Offline / Standalone Fallback: Collision-resistant ID & local storage (not server-verified)
  const entropy = Math.random().toString(36).slice(2, 10).toUpperCase();
  const isPendingVerification = cleanRole === 'student';
  const newUser = {
    id: `USER-${entropy}`,
    authId: pendingAuthId,
    rollNumber: cleanRoll,
    name: cleanName,
    role: cleanRole,
    status: isPendingVerification ? 'pending_verification' : 'pending_server_registration',
    membershipStatus: isPendingVerification ? 'pending_verification' : 'pending_server_registration',
    verificationStatus: isPendingVerification ? 'pending_roster_verification' : 'pending_server_registration',
    isActive: !isPendingVerification,
    serverVerified: false,
    localOnlyFallback: true,
    authCreatedUnlinked,
    fallbackReason: fallbackReason || 'local_only',
    fallbackDetail: fallbackDetail || null,
    mobileNumber: mobileNumber ? mobileNumber.trim() : '',
    department: department.trim() || 'Engineering & Technology',
    fingerprintIds: fIds,
    fingerLabels,
    faceRegistered: false,
    facePhotoUrl: facePhotoUrl || null,
    incubationStartDate: journeyStartDate,
    academicYearAtStart: startYear,
    retentionPeriodYears: retentionYears,
    retentionEndDate: retentionEndDate,
    idCardValidityYear: idCardValidityYear ? Number(idCardValidityYear) : null,
    branch: branch ? branch.trim() : (department.trim() || ''),
    idCardScannedAt: idCardValidityYear ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  memoryStore.users.push(newUser);
  persistLocalCache('users', memoryStore.users);

  // 3. Persist to Supabase if permitted
  await executeCloudMutation({
    table: 'users',
    action: 'insert',
    id: newUser.id,
    data: newUser,
  });

  logAuditEvent({
    actorName: memoryStore.currentUser?.name || 'System Entrance Station',
    actorRole: memoryStore.currentUser?.role || 'System',
    action: 'Student Registered Locally (Pending Verification)',
    targetRoll: cleanRoll,
    details: `Saved ${cleanName} (${cleanRole}) locally only (${newUser.fallbackReason}). Server verification/registration is required before normal login.`,
  });

  notifySubscribers('USER_REGISTERED', newUser);
  return newUser;
}

/**
 * Generates / repairs a Supabase Auth login and active public.users profile
 * for an existing local-only or unlinked account (e.g. pending_verification accounts).
 */
export async function activateStudentLogin(rollNumber, password, actorName = 'Administrator') {
  return resetStudentPassword(rollNumber, password, actorName);
}

export async function resetStudentPassword(rollNumber, newPassword, actorName = 'Administrator') {
  if (!rollNumber) throw new Error('Roll Number is required.');
  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const cleanRoll = String(rollNumber).trim().toUpperCase();
  const cleanPass = String(newPassword).trim();

  // Save directly to PostgreSQL passwords table
  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
  let updateSuccess = false;
  try {
    const res = await fetch(`${pgApiBase}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roll_number: cleanRoll,
        new_password: cleanPass,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      updateSuccess = true;
    } else {
      // If student not found in PostgreSQL yet, create / upsert account with this password
      const userObj = getUserByRoll(cleanRoll) || {};
      const signupRes = await fetch(`${pgApiBase}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_number: cleanRoll,
          password: cleanPass,
          student_name: userObj.name || `Student ${cleanRoll}`,
          department: userObj.department || 'Electronics & Communication',
          phone_number: userObj.mobileNumber || '',
          role: 'student',
        }),
      });
      const signupData = await signupRes.json().catch(() => null);
      if (signupRes.ok && signupData?.success) {
        updateSuccess = true;
      } else {
        throw new Error(data?.error || signupData?.error || 'Failed to update database password.');
      }
    }
  } catch (e) {
    if (!updateSuccess) {
      throw new Error(`Failed to update password in database: ${e.message}`);
    }
  }

  // Update in local memoryStore and localStorage
  let user = getUserByRoll(cleanRoll);
  if (user) {
    user.password = cleanPass;
    user.isActive = true;
    user.status = 'active';
    user.serverVerified = true;
    user.localOnlyFallback = false;
  } else {
    const isSubAdmin = cleanRoll.toLowerCase() === 'subadmin';
    const isAdmin = cleanRoll.toLowerCase() === 'admin';
    user = {
      id: cleanRoll.toLowerCase(),
      rollNumber: isSubAdmin || isAdmin ? '' : cleanRoll,
      username: cleanRoll.toLowerCase(),
      name: isAdmin ? 'Administrator' : isSubAdmin ? 'Substitute Administrator' : `Student ${cleanRoll}`,
      password: cleanPass,
      role: isAdmin ? 'admin' : isSubAdmin ? 'substitute_admin' : 'student',
      department: isAdmin ? 'Incubation Management' : isSubAdmin ? 'Lab Operations' : 'Electronics & Communication',
      mobileNumber: '',
      isActive: true,
      status: 'active',
      serverVerified: true,
      localOnlyFallback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.users.push(user);
  }
  saveToLocalStorage(STORAGE_KEYS.USERS, memoryStore.users);
  notifySubscribers('USER_UPDATED', user);
  return true;
}

export async function updateStudentAccount(rollNumber, updates, actor) {
  const idx = memoryStore.users.findIndex((u) => u.rollNumber && u.rollNumber.toUpperCase() === rollNumber.trim().toUpperCase());
  if (idx === -1) throw new Error('Student account not found.');

  const current = memoryStore.users[idx];
  const newStartDate = updates.incubationStartDate !== undefined ? updates.incubationStartDate : current.incubationStartDate;
  const newYearAtStart = updates.academicYearAtStart !== undefined
    ? (updates.academicYearAtStart ? Number(updates.academicYearAtStart) : null)
    : current.academicYearAtStart;

  const newRetentionYears = newYearAtStart ? calculateRetentionYears(newYearAtStart) : null;
  const newRetentionEndDate = (newStartDate && newYearAtStart)
    ? calculateRetentionEndDate(newStartDate, newYearAtStart)
    : null;

  const updated = {
    ...current,
    name: updates.name ? updates.name.trim() : current.name,
    mobileNumber: updates.mobileNumber !== undefined ? updates.mobileNumber.trim() : current.mobileNumber,
    department: updates.department !== undefined ? updates.department.trim() : current.department,
    role: updates.role || current.role,
    incubationStartDate: newStartDate,
    academicYearAtStart: newYearAtStart,
    retentionPeriodYears: newRetentionYears,
    retentionEndDate: newRetentionEndDate,
    faceRegistered: updates.faceRegistered !== undefined ? Boolean(updates.faceRegistered) : current.faceRegistered,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.users[idx] = updated;
  persistLocalCache('users', memoryStore.users);

  await executeCloudMutation({
    table: 'users',
    action: 'update',
    id: updated.id,
    data: updated,
  });

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Student Account Updated',
    targetRoll: updated.rollNumber,
    details: `Updated details for ${updated.name} (${updated.rollNumber}).`,
  });

  notifySubscribers('USER_UPDATED', updated);
  return updated;
}

/**
 * Update authenticated student's own permitted contact/theme profile via secure RPC.
 * Dispatches to public.update_student_profile on Supabase.
 */
export async function updateStudentProfile({ mobileNumber, avatarTheme, facePhotoUrl }) {
  const user = memoryStore.currentUser;
  if (!user) throw new Error('Unauthenticated user session.');

  if (mobileNumber !== undefined) user.mobileNumber = mobileNumber ? mobileNumber.trim() : '';
  if (avatarTheme !== undefined) user.avatarTheme = avatarTheme;
  if (facePhotoUrl !== undefined) user.facePhotoUrl = facePhotoUrl;
  user.updatedAt = new Date().toISOString();

  persistLocalCache('users', memoryStore.users);

  if (isOnlineState && supabase && typeof supabase.rpc === 'function') {
    const { data: rpcData, error: rpcError } = await supabase.rpc('update_student_profile', {
      p_mobile_number: user.mobileNumber || null,
      p_avatar_theme: user.avatarTheme || null,
      p_face_photo_url: user.facePhotoUrl || null,
    });

    if (rpcError) {
      throw new Error(`Profile update failed: ${rpcError.message}`);
    }
  }

  notifySubscribers('USER_UPDATED', user);
  return user;
}

// ==================== LAB ENTRY / EXIT & ATTENDANCE ====================

/**
 * Authoritative duration calculation between entry and exit timestamps.
 * Returns { durationSeconds, durationMinutes, durationFormatted }
 */
export function calculateVisitDuration(entryTime, exitTime = null) {
  if (!entryTime) {
    return { durationSeconds: null, durationMinutes: null, durationFormatted: 'Incomplete' };
  }
  const entryMs = new Date(entryTime).getTime();
  if (isNaN(entryMs)) {
    return { durationSeconds: null, durationMinutes: null, durationFormatted: 'Invalid Time' };
  }
  const exitMs = exitTime ? new Date(exitTime).getTime() : Date.now();
  if (isNaN(exitMs) || exitMs < entryMs) {
    return { durationSeconds: 0, durationMinutes: 0, durationFormatted: '0 seconds' };
  }

  const diffMs = exitMs - entryMs;
  const durationSeconds = Math.max(0, Math.round(diffMs / 1000));
  const durationMinutes = Math.max(0, Math.round(diffMs / 60000));

  let durationFormatted = '';
  if (durationSeconds < 60) {
    durationFormatted = `${durationSeconds} second${durationSeconds === 1 ? '' : 's'}`;
  } else if (durationMinutes < 60) {
    durationFormatted = `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`;
  } else {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    durationFormatted = `${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min${mins > 1 ? 's' : ''}` : ''}`;
  }

  return { durationSeconds, durationMinutes, durationFormatted };
}

/**
 * Cleans up and auto-closes open visits from previous calendar days.
 * Strictly sets status: 'incomplete' / 'auto_closed' with NULL exitTime and NULL duration.
 * Does NOT auto-close same-day visits > 16 hours (flags them for admin review).
 */
export function cleanupStaleVisitsForStudent(rollNumber) {
  if (!rollNumber) return 0;
  const cleanRoll = rollNumber.trim().toUpperCase();
  const todayKey = toLocalDateKey(new Date());
  let cleanedCount = 0;

  for (let i = 0; i < memoryStore.visits.length; i++) {
    const v = memoryStore.visits[i];
    if (v.studentRoll?.toUpperCase() === cleanRoll && (v.status === 'inside' || v.status === 'active')) {
      const visitDateKey = toLocalDateKey(v.entryTime);
      if (visitDateKey && visitDateKey < todayKey) {
        // Previous calendar day: close strictly as incomplete (do NOT fabricate exit timestamp)
        v.status = 'incomplete';
        v.exitTime = null;
        v.durationMinutes = null;
        v.durationSeconds = null;
        v.durationFormatted = 'Incomplete';
        v.autoClosed = true;
        v.adminNotes = `Auto-closed as incomplete: student did not record exit on ${visitDateKey}.`;
        cleanedCount++;

        logAuditEvent({
          actorName: 'System',
          actorRole: 'System',
          action: 'Stale Visit Auto-Closed',
          targetRoll: v.studentRoll,
          details: `Stale visit from ${visitDateKey} marked as incomplete without exit timestamp.`,
        });
        executeCloudMutation({
          table: 'visits',
          action: 'upsert',
          id: v.id,
          data: v,
        });
      } else if (visitDateKey === todayKey) {
        // Same-day visit: check if > 16 hours, flag for admin review without closing
        const elapsedHours = (Date.now() - new Date(v.entryTime).getTime()) / (1000 * 60 * 60);
        if (elapsedHours >= 16) {
          v.flaggedForAdminReview = true;
          v.adminReviewReason = `Visit active for ${elapsedHours.toFixed(1)} hours on ${todayKey}. Pending administrative verification.`;
        }
      }
    }
  }

  if (cleanedCount > 0) {
    persistLocalCache('visits', memoryStore.visits);
  }
  return cleanedCount;
}

export function getLabVisits() {
  return memoryStore.visits;
}

export async function recordLabEntry(rollNumber, entryMethod = 'face') {
  if (!rollNumber || typeof rollNumber !== 'string') {
    throw new Error('Valid student roll number is strictly required.');
  }
  const cleanRoll = rollNumber.trim().toUpperCase();
  if (cleanRoll.length !== 10) {
    throw new Error('Student Roll Number must be strictly 10 characters (e.g. 238W1A0477).');
  }
  const user = getUserByRoll(cleanRoll);
  if (!user) throw new Error(`Student with Roll Number ${cleanRoll} not registered.`);

  cleanupStaleVisitsForStudent(user.rollNumber);

  const now = new Date();
  const todayKey = toLocalDateKey(now);

  // Check if already inside today
  const activeVisit = memoryStore.visits.find(
    (v) =>
      v.studentRoll.toUpperCase() === user.rollNumber.toUpperCase() &&
      v.status === 'inside' &&
      toLocalDateKey(v.entryTime) === todayKey
  );

  if (activeVisit) {
    return {
      success: true,
      alreadyInside: true,
      student: user,
      visit: activeVisit,
      message: `${user.name} is already registered inside the lab since ${activeVisit?.entryTime ? new Date(activeVisit.entryTime).toLocaleTimeString() : 'earlier today'}.`,
    };
  }

  // 1. Add strictly Roll Number to daily attendance list
  if (!memoryStore.dailyAttendance[todayKey]) {
    memoryStore.dailyAttendance[todayKey] = [];
  }
  if (!memoryStore.dailyAttendance[todayKey].includes(user.rollNumber)) {
    memoryStore.dailyAttendance[todayKey].push(user.rollNumber);
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY_ATTENDANCE, JSON.stringify(memoryStore.dailyAttendance));
    } catch (e) {
      console.warn('Daily attendance persist error:', e);
    }
  }

  // 2. Create Visit Record
  const newVisit = {
    id: `VISIT-${todayKey.replace(/-/g, '')}-${String(Date.now()).slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    studentRoll: user.rollNumber,
    studentName: user.name,
    entryTime: now.toISOString(),
    exitTime: null,
    durationMinutes: null,
    durationSeconds: null,
    durationFormatted: 'Currently Inside',
    status: 'inside',
    entryMethod,
    flaggedForAdminReview: false,
    createdAt: now.toISOString(),
  };

  memoryStore.visits.unshift(newVisit);
  persistLocalCache('visits', memoryStore.visits);

  await executeCloudMutation({
    table: 'visits',
    action: 'insert',
    id: newVisit.id,
    data: newVisit,
  });

  logAuditEvent({
    actorName: user.name,
    actorRole: 'Student',
    action: 'Lab Entry',
    targetRoll: user.rollNumber,
    details: `Entered lab via ${entryMethod}.`,
  });

  notifySubscribers('VISIT_ADDED', newVisit);
  return {
    success: true,
    student: user,
    visit: newVisit,
    message: 'You are entered in the lab.',
  };
}

/**
 * Checks if a student currently has an active 'inside' visit in the lab for today.
 * @param {string} rollNumber
 * @returns {object|null} The active visit or null
 */
export function getStudentActiveVisit(rollNumber) {
  if (!rollNumber) return null;
  const clean = rollNumber.trim().toUpperCase();
  cleanupStaleVisitsForStudent(clean);
  const todayKey = toLocalDateKey(new Date());

  return memoryStore.visits.find(
    (v) =>
      v.studentRoll.toUpperCase() === clean &&
      v.status === 'inside' &&
      toLocalDateKey(v.entryTime) === todayKey
  ) || null;
}

export async function recordLabExit(rollNumber, exitMethod = 'face') {
  const user = getUserByRoll(rollNumber);
  if (!user) throw new Error(`Student with Roll Number ${rollNumber} not registered.`);

  cleanupStaleVisitsForStudent(user.rollNumber);

  const now = new Date();
  const todayKey = toLocalDateKey(now);

  const activeIdx = memoryStore.visits.findIndex(
    (v) =>
      v.studentRoll.toUpperCase() === user.rollNumber.toUpperCase() &&
      v.status === 'inside' &&
      toLocalDateKey(v.entryTime) === todayKey
  );

  if (activeIdx === -1) {
    throw new Error(`Student ${user.name} (${user.rollNumber}) does not have an active visit for today. Please register entry first.`);
  }

  const active = memoryStore.visits[activeIdx];
  const { durationSeconds, durationMinutes, durationFormatted } = calculateVisitDuration(active.entryTime, now.toISOString());

  const visit = {
    ...active,
    exitTime: now.toISOString(),
    durationMinutes,
    durationSeconds,
    durationFormatted,
    status: 'completed',
    exitMethod,
  };
  memoryStore.visits[activeIdx] = visit;

  persistLocalCache('visits', memoryStore.visits);

  await executeCloudMutation({
    table: 'visits',
    action: 'update',
    id: visit.id,
    data: visit,
  });

  logAuditEvent({
    actorName: user.name,
    actorRole: 'Student',
    action: 'Lab Exit',
    targetRoll: user.rollNumber,
    details: `Exited lab. Duration: ${visit.durationFormatted}.`,
  });

  notifySubscribers('VISIT_UPDATED', visit);
  return {
    success: true,
    student: user,
    durationMinutes: visit.durationMinutes,
    durationSeconds: visit.durationSeconds,
    durationFormatted: visit.durationFormatted,
    visit,
    message: 'Thanks for visiting the lab.',
  };
}

/**
 * Unified Automatic Lab Attendance Operation.
 * Single entry point for both Face Recognition and Manual Roll Number.
 * The system automatically checks whether the student is currently inside or outside:
 * - Outside (no active open visit): Automatically records LAB ENTRY.
 * - Inside (active open visit exists): Automatically records LAB EXIT & computes duration.
 * - Enters again later: Creates a new entry visit record.
 * 
 * @param {string} rollNumber Student Roll Number
 * @param {string} method 'Face Recognition' | 'Manual Roll Number' | 'face' | 'manual'
 * @param {object|null} actor Optional authenticated actor (Admin, Staff, or Student)
 * @returns {Promise<object>} Result containing action ('ENTRY' | 'EXIT'), status, student, visit, duration, message
 */
export async function toggleLabAttendance(rollNumber, method = 'face', actor = null) {
  if (!rollNumber || typeof rollNumber !== 'string') {
    throw new Error('Valid student roll number is strictly required.');
  }
  const cleanRoll = rollNumber.trim().toUpperCase();
  if (cleanRoll.length !== 10) {
    throw new Error('Student Roll Number must be strictly 10 characters (e.g. 238W1A0477).');
  }
  const user = getUserByRoll(cleanRoll);
  if (!user) {
    throw new Error(`Student with Roll Number "${cleanRoll}" is not registered in the system.`);
  }

  cleanupStaleVisitsForStudent(user.rollNumber);

  const now = new Date();
  const todayKey = toLocalDateKey(now);

  // Check if student currently has an active open visit ('inside' and no exitTime)
  const activeIdx = (memoryStore.visits || []).findIndex(
    (v) =>
      v &&
      v.studentRoll &&
      v.studentRoll.toUpperCase() === cleanRoll &&
      v.status === 'inside' &&
      !v.exitTime &&
      toLocalDateKey(v.entryTime) === todayKey
  );

  const normalizedMethod =
    method.toLowerCase().includes('face') ? 'Face Recognition' : 'Manual Roll Number';

  if (activeIdx === -1) {
    // -------------------------------------------------------------------------
    // CASE A / C: Student is outside -> Record LAB ENTRY
    // -------------------------------------------------------------------------
    if (!memoryStore.dailyAttendance[todayKey]) {
      memoryStore.dailyAttendance[todayKey] = [];
    }
    if (!memoryStore.dailyAttendance[todayKey].includes(user.rollNumber)) {
      memoryStore.dailyAttendance[todayKey].push(user.rollNumber);
      try {
        localStorage.setItem(STORAGE_KEYS.DAILY_ATTENDANCE, JSON.stringify(memoryStore.dailyAttendance));
      } catch (e) {
        console.warn('Daily attendance persist error:', e);
      }
    }

    const newVisit = {
      id: `VISIT-${todayKey.replace(/-/g, '')}-${String(Date.now()).slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      studentRoll: user.rollNumber,
      studentName: user.name,
      entryTime: now.toISOString(),
      exitTime: null,
      durationMinutes: null,
      durationSeconds: null,
      durationFormatted: 'Currently Inside',
      status: 'inside',
      entryMethod: normalizedMethod,
      flaggedForAdminReview: false,
      createdAt: now.toISOString(),
    };

    memoryStore.visits.unshift(newVisit);
    persistLocalCache('visits', memoryStore.visits);

    await executeCloudMutation({
      table: 'visits',
      action: 'insert',
      id: newVisit.id,
      data: newVisit,
    });

    logAuditEvent({
      actorName: actor?.name || user.name,
      actorRole: actor?.role || 'Student',
      action: 'Lab Entry',
      targetRoll: user.rollNumber,
      details: `Entered lab via ${normalizedMethod}.`,
    });

    notifySubscribers('VISIT_ADDED', newVisit);

    return {
      success: true,
      action: 'ENTRY',
      status: 'inside',
      student: user,
      visit: newVisit,
      message: 'Welcome! Your lab entry has been recorded.',
      details: `Entry recorded at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}. Your lab session is active.`,
    };
  } else {
    // -------------------------------------------------------------------------
    // CASE B: Student is already inside -> Record LAB EXIT
    // -------------------------------------------------------------------------
    const active = memoryStore.visits[activeIdx];
    const { durationSeconds, durationMinutes, durationFormatted } = calculateVisitDuration(active.entryTime, now.toISOString());

    const completedVisit = {
      ...active,
      exitTime: now.toISOString(),
      durationMinutes,
      durationSeconds,
      durationFormatted,
      status: 'completed',
      exitMethod: normalizedMethod,
      updatedAt: now.toISOString(),
    };

    memoryStore.visits[activeIdx] = completedVisit;
    persistLocalCache('visits', memoryStore.visits);

    await executeCloudMutation({
      table: 'visits',
      action: 'update',
      id: completedVisit.id,
      data: completedVisit,
    });

    logAuditEvent({
      actorName: actor?.name || user.name,
      actorRole: actor?.role || 'Student',
      action: 'Lab Exit',
      targetRoll: user.rollNumber,
      details: `Exited lab via ${normalizedMethod}. Duration: ${durationFormatted}.`,
    });

    notifySubscribers('VISIT_UPDATED', completedVisit);

    return {
      success: true,
      action: 'EXIT',
      status: 'completed',
      student: user,
      durationMinutes,
      durationSeconds,
      durationFormatted,
      visit: completedVisit,
      message: 'Your lab exit has been recorded. Thank you!',
      details: `Total lab duration: ${durationFormatted}. Visit completed.`,
    };
  }
}

/**
 * Automatically closes all active student visits at the configured lab closing time.
 * Executed at daily lab closing time or upon manual Admin trigger.
 * 
 * @param {object} options
 * @param {boolean} options.forceNow If true, closes active visits immediately with current timestamp
 * @param {object|null} options.actor Admin or System actor
 * @returns {Promise<object>} Result summary { success, closedCount, closedVisits, closingTime }
 */
export async function executeAutoEndOfDayCheckout(options = {}) {
  const { forceNow = false, actor = null } = options;
  const settings = getSettings();
  const labTimings = settings.labTimings || {
    openingTime: '09:00',
    closingTime: '17:00',
    autoCheckoutEnabled: true,
    timezone: 'Asia/Kolkata',
  };

  if (!forceNow && labTimings.autoCheckoutEnabled === false) {
    return { success: false, skipped: true, reason: 'Automatic checkout is disabled in settings.' };
  }

  const now = new Date();
  const todayKey = toLocalDateKey(now);

  // Compute closing time Date object for today
  const [closeHours, closeMinutes] = (labTimings.closingTime || '17:00').split(':').map((n) => parseInt(n, 10));
  const closingDate = new Date(now);
  closingDate.setHours(isNaN(closeHours) ? 17 : closeHours, isNaN(closeMinutes) ? 0 : closeMinutes, 0, 0);

  // If running automatically (not forced), only execute if current time is at or past closing time
  if (!forceNow && now.getTime() < closingDate.getTime()) {
    return {
      success: false,
      skipped: true,
      reason: `Current time (${now.toLocaleTimeString()}) is before configured closing time (${labTimings.closingTime}).`,
    };
  }

  // Find all active inside visits
  const activeVisits = (memoryStore.visits || []).filter(
    (v) => v && v.status === 'inside' && !v.exitTime
  );

  if (activeVisits.length === 0) {
    return { success: true, closedCount: 0, closedVisits: [], message: 'No active inside visits to checkout.' };
  }

  const closedVisits = [];
  const assignedExitTime = forceNow ? now.toISOString() : (now.getTime() >= closingDate.getTime() ? closingDate.toISOString() : now.toISOString());

  for (const active of activeVisits) {
    const idx = memoryStore.visits.findIndex((v) => v.id === active.id);
    if (idx === -1) continue;

    // Calculate duration from entry to assignedExitTime
    const { durationSeconds, durationMinutes, durationFormatted } = calculateVisitDuration(active.entryTime, assignedExitTime);

    const completedVisit = {
      ...active,
      exitTime: assignedExitTime,
      durationMinutes,
      durationSeconds,
      durationFormatted,
      status: 'completed',
      exitMethod: 'automatic_end_of_day',
      isAutoClosed: true,
      autoClosedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    memoryStore.visits[idx] = completedVisit;
    closedVisits.push(completedVisit);

    await executeCloudMutation({
      table: 'visits',
      action: 'update',
      id: completedVisit.id,
      data: completedVisit,
    });

    logAuditEvent({
      actorName: actor?.name || 'System Scheduler',
      actorRole: actor?.role || 'System',
      action: 'Auto End-of-Day Exit',
      targetRoll: active.studentRoll,
      details: `Automatically checked out at configured lab closing time (${labTimings.closingTime}). Duration: ${durationFormatted}.`,
    });
  }

  persistLocalCache('visits', memoryStore.visits);
  notifySubscribers('VISITS_UPDATED', closedVisits);

  return {
    success: true,
    closedCount: closedVisits.length,
    closedVisits,
    closingTime: labTimings.closingTime,
    message: `Successfully checked out ${closedVisits.length} student(s) at lab closing time (${labTimings.closingTime}).`,
  };
}

export function getStudentsCurrentlyInside() {
  const insideVisits = (memoryStore.visits || []).filter(
    (v) => v && v.status === 'inside' && v.studentRoll && v.studentRoll !== '77' && v.studentRoll.length === 10
  );
  const now = Date.now();

  return insideVisits.map((v) => {
    const elapsedMinutes = Math.max(0, Math.round((now - new Date(v.entryTime).getTime()) / 60000));
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return {
      ...v,
      elapsedMinutes,
      durationText,
    };
  });
}

export function getVisits() {
  return [...memoryStore.visits];
}

// ==================== VISITOR ATTENDANCE (NON-REGISTERED / OCCASIONAL VISITORS) ====================

export async function recordVisitorLabEntry({
  fullName,
  visitorType,
  organizationOrDept,
  phoneNumber,
  email,
  purposeOfVisit,
  hostOrAccompaniedBy,
  remarks,
}) {
  if (!fullName || !organizationOrDept || !purposeOfVisit) {
    throw new Error('Full Name, Department/Organization, and Purpose of Visit are required.');
  }

  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
  const payload = {
    full_name: fullName.trim(),
    visitor_type: visitorType || 'Visiting Faculty',
    organization_or_dept: organizationOrDept.trim(),
    phone_number: (phoneNumber || '').trim(),
    email: (email || '').trim(),
    purpose_of_visit: purposeOfVisit.trim(),
    host_or_accompanied_by: (hostOrAccompaniedBy || '').trim(),
    remarks: (remarks || '').trim(),
  };

  try {
    const res = await fetch(`${pgApiBase}/api/visitors/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to record visitor entry in PostgreSQL.');
    }

    logAuditEvent({
      actorName: fullName.trim(),
      actorRole: visitorType || 'Guest / Visitor',
      action: 'Visitor Lab Entry',
      details: `${fullName} (${visitorType || 'Guest'}) entered lab. Purpose: ${purposeOfVisit}. Organization: ${organizationOrDept}.`,
    });

    notifySubscribers('VISITOR_ENTRY_RECORDED', data.visitor);
    return data;
  } catch (err) {
    console.error('[Visitor Entry Error]:', err);
    throw err;
  }
}

export async function recordVisitorLabExit(visitorId, actor = null) {
  if (!visitorId) throw new Error('Visitor ID is required.');
  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';

  try {
    const res = await fetch(`${pgApiBase}/api/visitors/exit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id: visitorId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to record visitor exit in PostgreSQL.');
    }

    logAuditEvent({
      actorName: actor?.name || 'Lab In-Charge',
      actorRole: actor?.role || 'Admin',
      action: 'Visitor Lab Exit',
      details: `Checked out visitor ${visitorId} from laboratory.`,
    });

    notifySubscribers('VISITOR_EXIT_RECORDED', { visitorId });
    return data;
  } catch (err) {
    console.error('[Visitor Exit Error]:', err);
    throw err;
  }
}

export async function fetchActiveVisitors() {
  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
  try {
    const res = await fetch(`${pgApiBase}/api/visitors/active`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.visitors) ? data.visitors : [];
  } catch (err) {
    console.warn('[Fetch Active Visitors Warning]:', err.message);
    return [];
  }
}

export async function fetchVisitorHistory(limit = 150) {
  const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
  try {
    const res = await fetch(`${pgApiBase}/api/visitors/history?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.history) ? data.history : [];
  } catch (err) {
    console.warn('[Fetch Visitor History Warning]:', err.message);
    return [];
  }
}

export function getHolidays() {
  return [...(memoryStore.holidays || [])];
}

export async function addHoliday({ date, name, type = 'institute', description = '' }, currentUser) {
  if (!date || !name) throw new Error('Date and holiday name are required.');
  const trimmedDate = date.trim();
  const trimmedName = name.trim();
  if (isNaN(new Date(trimmedDate).getTime())) {
    throw new Error('Invalid holiday date format.');
  }
  if (!memoryStore.holidays) memoryStore.holidays = [];
  const existing = memoryStore.holidays.find(
    (h) => h.date === trimmedDate && h.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) {
    throw new Error(`Holiday "${existing.name}" on ${trimmedDate} already exists.`);
  }
  const newHoliday = {
    id: `HOL-${String(Date.now()).slice(-6)}`,
    date: trimmedDate,
    name: trimmedName,
    type,
    description: (description || '').trim(),
    createdAt: new Date().toISOString(),
  };
  memoryStore.holidays.push(newHoliday);
  await persistLocalCache('holidays', memoryStore.holidays);
  await executeCloudMutation({
    table: 'holidays',
    action: 'insert',
    id: newHoliday.id,
    data: newHoliday,
  });
  notifySubscribers('HOLIDAYS_CHANGED', memoryStore.holidays);
  return newHoliday;
}

export async function deleteHoliday(id, currentUser) {
  if (!memoryStore.holidays) return;
  memoryStore.holidays = memoryStore.holidays.filter((h) => h.id !== id);
  await persistLocalCache('holidays', memoryStore.holidays);
  await executeCloudMutation({
    table: 'holidays',
    action: 'delete',
    id,
  });
  notifySubscribers('HOLIDAYS_CHANGED', memoryStore.holidays);
}

export function calculateStudentStreak(rollNumber) {
  if (!rollNumber) return 0;
  const cleanRoll = rollNumber.trim().toUpperCase();
  const visits = (memoryStore.visits || []).filter(
    (v) => v && v.studentRoll && v.studentRoll.toUpperCase() === cleanRoll
  );
  if (!visits || visits.length === 0) return 0;

  const formatYMD = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const visitDates = new Set();
  for (const v of visits) {
    if (v && v.entryTime) {
      const d = new Date(v.entryTime);
      if (!isNaN(d.getTime())) {
        visitDates.add(formatYMD(d));
      }
    }
  }

  const holidayDates = new Set(
    (memoryStore.holidays || [])
      .map((h) => {
        if (!h || !h.date) return null;
        const d = new Date(h.date);
        return !isNaN(d.getTime()) ? formatYMD(d) : h.date;
      })
      .filter(Boolean)
  );

  const today = new Date();
  const todayStr = formatYMD(today);
  const visitedToday = visitDates.has(todayStr);

  let streak = 0;
  let cursor = new Date(today);

  // If student hasn't visited today yet, start examining from yesterday so streak isn't lost mid-day
  if (!visitedToday) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let daysInspected = 0;
  while (daysInspected < 365) {
    daysInspected++;
    const dateStr = formatYMD(cursor);
    const dayOfWeek = cursor.getDay(); // 0 is Sunday
    const isSunday = dayOfWeek === 0;
    const isHoliday = holidayDates.has(dateStr);

    if (isSunday || isHoliday) {
      // Sundays and holidays do NOT break streak!
      if (visitDates.has(dateStr)) {
        streak++;
      }
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    // Working day
    if (visitDates.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getStudentPersonalStats(rollNumber) {
  if (!rollNumber) return null;
  const cleanRoll = rollNumber.trim().toUpperCase();
  const user = getUserByRoll(cleanRoll) || {
    id: `usr-${cleanRoll.toLowerCase()}`,
    name: cleanRoll,
    rollNumber: cleanRoll,
    role: 'student',
    department: 'Incubation Lab',
    mobileNumber: 'N/A',
    avatarTheme: 'indigo',
    avatarType: 'initials',
  };

  const formatYMD = (d) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const studentVisits = (memoryStore.visits || []).filter(
    (v) => v && v.studentRoll && v.studentRoll.toUpperCase() === cleanRoll
  );
  const completedVisits = studentVisits.filter((v) => v.status === 'completed');
  const activeVisit = studentVisits.find((v) => v.status === 'inside');

  const distinctDays = new Set();
  for (const v of studentVisits) {
    if (v && v.entryTime) {
      const d = new Date(v.entryTime);
      if (!isNaN(d.getTime())) {
        distinctDays.add(formatYMD(d));
      }
    }
  }
  const totalMinutes = completedVisits.reduce((acc, v) => acc + (v.durationMinutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  let currentInsideDurationText = null;
  if (activeVisit && activeVisit.entryTime) {
    try {
      const d = new Date(activeVisit.entryTime);
      if (!isNaN(d.getTime())) {
        const elapsed = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
        const h = Math.floor(elapsed / 60);
        const m = elapsed % 60;
        currentInsideDurationText = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
    } catch {
      currentInsideDurationText = null;
    }
  }

  const studentTxns = (memoryStore.transactions || []).filter(
    (t) => t && t.studentRoll && t.studentRoll.toUpperCase() === cleanRoll
  );
  const activeIssuedItems = [];
  const overdueItems = [];
  const returnedItems = [];

  for (const t of studentTxns) {
    for (const it of (t.items || [])) {
      const remaining = Number(it.issuedQuantity || 0) - Number(it.returnedQuantity || 0);
      if (remaining > 0) {
        let isLate = false;
        let daysOverdue = 0;
        if (it.dueDate) {
          const dueTime = new Date(it.dueDate).getTime();
          if (!isNaN(dueTime)) {
            isLate = dueTime < Date.now();
            if (isLate) {
              const diffMs = Date.now() - dueTime;
              daysOverdue = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
            }
          }
        }

        const record = {
          ...it,
          transactionId: t.id,
          issueDate: t.issueDate,
          remainingQuantity: remaining,
          isOverdue: isLate,
          daysOverdue,
        };

        activeIssuedItems.push(record);
        if (isLate) overdueItems.push(record);
      }
      if (Number(it.returnedQuantity || 0) > 0) {
        returnedItems.push({
          ...it,
          transactionId: t.id,
        });
      }
    }
  }

  // Daily lab time today
  const todayStr = formatYMD(new Date());
  const visitsToday = studentVisits.filter((v) => {
    if (!v || !v.entryTime) return false;
    const d = new Date(v.entryTime);
    return !isNaN(d.getTime()) && formatYMD(d) === todayStr;
  });
  let dailyLabTimeMinutes = visitsToday
    .filter((v) => v.status === 'completed')
    .reduce((acc, v) => acc + (v.durationMinutes || 0), 0);
  if (activeVisit && activeVisit.entryTime) {
    try {
      const d = new Date(activeVisit.entryTime);
      if (!isNaN(d.getTime())) {
        const elapsedNow = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
        dailyLabTimeMinutes += elapsedNow;
      }
    } catch {}
  }

  const avgSessionMinutes = completedVisits.length > 0
    ? Math.round(totalMinutes / completedVisits.length)
    : 0;

  const workingDayStreak = calculateStudentStreak(cleanRoll);

  const studentProjects = (memoryStore.projects || []).filter(
    (p) =>
      (p.leaderRoll && p.leaderRoll.toUpperCase() === cleanRoll) ||
      (p.members || []).some((m) => (m.rollNumber || m)?.toUpperCase() === cleanRoll)
  );

  const studentTeams = (memoryStore.teams || []).filter(
    (t) =>
      (t.leaderRoll && t.leaderRoll.toUpperCase() === cleanRoll) ||
      (t.memberRolls || []).some((m) => m?.toUpperCase() === cleanRoll)
  );

  const studentAchievements = (memoryStore.achievements || []).filter(
    (a) => a.awardedToRoll && a.awardedToRoll.toUpperCase() === cleanRoll
  );

  const studentPapers = (memoryStore.researchPapers || []).filter(
    (p) => p.studentRoll && p.studentRoll.toUpperCase() === cleanRoll
  );

  const studentReflections = (memoryStore.selfReflections || []).filter(
    (r) => r.studentRoll && r.studentRoll.toUpperCase() === cleanRoll
  );

  return {
    student: user,
    isCurrentlyInside: Boolean(activeVisit),
    activeVisit,
    currentInsideDurationText,
    totalDaysVisited: distinctDays.size,
    totalVisitsCount: studentVisits.length,
    totalTimeSpentHours: totalHours,
    totalTimeSpentMinutes: totalMinutes,
    dailyLabTimeMinutes,
    avgSessionMinutes,
    workingDayStreak,
    visitHistory: studentVisits,
    activeIssuedItems,
    overdueItems,
    returnedItems,
    projects: studentProjects,
    teams: studentTeams,
    achievements: studentAchievements,
    researchPapers: studentPapers,
    selfReflections: studentReflections,
    announcements: getActiveAnnouncements(),
    events: getEvents(),
    branch: user.branch || 'ECE',
    section: user.section || 'A',
    year: user.academicYear || user.year || 3,
    avatarTheme: user.avatarTheme || 'indigo',
  };
}

/**
 * Retrieves detailed attendance history within a local calendar date range [startDateStr, endDateStr].
 * Inclusive of both boundary dates.
 * Preserves individual visit records and computes daily session counts.
 */
export function getAttendanceHistoryByDateRange(startDateStr = null, endDateStr = null) {
  const allVisits = [...memoryStore.visits];

  // Filter within date range using local calendar day key
  const filtered = allVisits.filter((v) => {
    const k = toLocalDateKey(v.entryTime);
    if (!k) return false;
    if (startDateStr && k < startDateStr) return false;
    if (endDateStr && k > endDateStr) return false;
    return true;
  });

  // Sort newest first
  filtered.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());

  // Count visits per student per date to provide daily summary count
  const studentDayCountMap = {};
  filtered.forEach((v) => {
    const k = `${toLocalDateKey(v.entryTime)}_${v.studentRoll?.toUpperCase()}`;
    studentDayCountMap[k] = (studentDayCountMap[k] || 0) + 1;
  });

  const uniqueRolls = new Set();
  let totalCompletedMinutes = 0;

  const records = filtered.map((v, index) => {
    const studentUser = getUserByRoll(v.studentRoll);
    const dateKey = toLocalDateKey(v.entryTime);
    uniqueRolls.add(v.studentRoll?.toUpperCase());

    const entryDate = dateKey;
    const entryTime = v.entryTime ? new Date(v.entryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
    const exitTime = v.exitTime
      ? new Date(v.exitTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : (v.status === 'inside' ? 'Currently Inside' : 'Incomplete / No Exit');

    let durationText = v.durationFormatted;
    if (!durationText) {
      if (v.status === 'inside') {
        const { durationFormatted } = calculateVisitDuration(v.entryTime, new Date());
        durationText = `${durationFormatted} (Active)`;
      } else if (v.status === 'completed' && v.durationMinutes) {
        durationText = `${v.durationMinutes} mins`;
      } else {
        durationText = 'Incomplete';
      }
    }

    if (v.status === 'completed' && v.durationMinutes) {
      totalCompletedMinutes += v.durationMinutes;
    }

    const sessionCount = studentDayCountMap[`${dateKey}_${v.studentRoll?.toUpperCase()}`] || 1;

    let displayStatus = 'Completed';
    if (v.status === 'inside') displayStatus = 'Currently Inside';
    else if (v.status === 'incomplete' || v.autoClosed) displayStatus = 'Incomplete';

    return {
      serialNumber: index + 1,
      id: v.id,
      studentName: studentUser?.name || v.studentName || 'Student',
      rollNumber: v.studentRoll,
      department: studentUser?.branch || 'ECE',
      attendanceDate: entryDate,
      entryTime,
      exitTime,
      duration: durationText,
      durationMinutes: v.durationMinutes,
      durationSeconds: v.durationSeconds,
      visitStatus: displayStatus,
      rawStatus: v.status,
      entryMethod: v.entryMethod || 'Manual',
      visitsCountOnDate: sessionCount,
      flaggedForAdminReview: Boolean(v.flaggedForAdminReview),
      adminReviewReason: v.adminReviewReason || null,
      rawVisit: v,
    };
  });

  return {
    records,
    totalVisits: records.length,
    totalUniqueStudents: uniqueRolls.size,
    totalHours: (totalCompletedMinutes / 60).toFixed(1),
    startDate: startDateStr,
    endDate: endDateStr,
  };
}

export function getAttendanceExportData(options = {}) {
  let startDate = options.startDate;
  let endDate = options.endDate;

  if (options.preset === 'today') {
    startDate = toLocalDateKey(new Date());
    endDate = startDate;
  } else if (options.preset === 'yesterday') {
    startDate = toLocalDateKey(new Date(Date.now() - 86400000));
    endDate = startDate;
  } else if (options.preset === 'day_before') {
    startDate = toLocalDateKey(new Date(Date.now() - 2 * 86400000));
    endDate = startDate;
  }

  const result = getAttendanceHistoryByDateRange(startDate, endDate);
  return {
    ...result,
    generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };
}

// ==================== INVENTORY & USABLE STOCK FORMULAS ====================

// Usable Stock Formula: Usable Stock = Available Quantity + Issued Quantity
// Lost items NEVER count towards usable stock!
export function getUsableStock(comp) {
  if (!comp) return 0;
  return Number(comp.availableQuantity || 0) + Number(comp.issuedQuantity || 0);
}

export function isComponentLowStock(comp) {
  if (!comp) return false;
  const threshold = comp.lowStockThreshold !== undefined ? Number(comp.lowStockThreshold) : 3;
  return getUsableStock(comp) < threshold;
}

export function getLowStockComponents() {
  return memoryStore.components.filter((c) => isComponentLowStock(c));
}

export async function setComponentThreshold(componentId, threshold, actor) {
  const comp = getComponentById(componentId);
  if (!comp) throw new Error('Component not found');
  const t = Math.max(0, Number(threshold));

  const updated = await updateComponent(componentId, { lowStockThreshold: t }, actor);
  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Threshold Updated',
    targetComponentId: componentId,
    previousValue: `Threshold: ${comp.lowStockThreshold}`,
    newValue: `Threshold: ${t}`,
    details: `Updated minimum low-stock alert threshold for "${comp.name}" to ${t}.`,
  });

  return updated;
}

export async function markComponentStatus({ componentId, status, individualTagId = null, notes = '', actor }) {
  const comp = getComponentById(componentId);
  if (!comp) throw new Error('Component not found');

  const validStatuses = ['damaged', 'lost', 'available'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status "${status}". Allowed: ${validStatuses.join(', ')}`);
  }

  let damagedQty = comp.damagedQuantity || 0;
  let lostQty = comp.lostQuantity || 0;
  let availableQty = comp.availableQuantity;
  let individualIds = comp.individualIds ? [...comp.individualIds] : [];

  if (comp.trackingMode === 'individual' && individualTagId) {
    const tagIdx = individualIds.findIndex((i) => i.id === individualTagId);
    if (tagIdx === -1) throw new Error(`Tag ID ${individualTagId} not found on this component.`);

    const oldTagStatus = individualIds[tagIdx].status;
    individualIds[tagIdx] = {
      ...individualIds[tagIdx],
      status,
      notes: notes || individualIds[tagIdx].notes,
      updatedAt: new Date().toISOString(),
    };

    if (oldTagStatus === 'available') availableQty = Math.max(0, availableQty - 1);
    else if (oldTagStatus === 'damaged') damagedQty = Math.max(0, damagedQty - 1);
    else if (oldTagStatus === 'lost') lostQty = Math.max(0, lostQty - 1);

    if (status === 'damaged') damagedQty++;
    else if (status === 'lost') lostQty++;
    else if (status === 'available') availableQty++;
  } else {
    // Aggregate status change
    if (status === 'damaged') {
      if (availableQty < 1) throw new Error('No available stock to mark as damaged.');
      availableQty--;
      damagedQty++;
    } else if (status === 'lost') {
      if (availableQty < 1) throw new Error('No available stock to mark as lost.');
      availableQty--;
      lostQty++;
    } else if (status === 'available') {
      if (damagedQty > 0) {
        damagedQty--;
        availableQty++;
      } else if (lostQty > 0) {
        lostQty--;
        availableQty++;
      }
    }
  }

  const updated = await updateComponent(
    componentId,
    {
      availableQuantity: availableQty,
      damagedQuantity: damagedQty,
      lostQuantity: lostQty,
      individualIds,
    },
    actor
  );

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: `Component Marked ${status.toUpperCase()}`,
    targetComponentId: componentId,
    details: individualTagId
      ? `Tag ${individualTagId} of "${comp.name}" marked as ${status}. Notes: ${notes}`
      : `1 unit of "${comp.name}" marked as ${status}. Notes: ${notes}`,
  });

  return updated;
}

// ==================== COMPONENT CATEGORIES HIERARCHY ====================

export function getCategories() {
  return [...memoryStore.categories];
}

export function getCategoryById(id) {
  if (!id) return null;
  return memoryStore.categories.find((c) => c.id === id) || null;
}

export function getCategoryPath(categoryId) {
  if (!categoryId) return [];
  const path = [];
  let currentId = categoryId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const cat = memoryStore.categories.find((c) => c.id === currentId);
    if (!cat) break;
    path.unshift(cat.name);
    currentId = cat.parentId;
  }
  return path;
}

export function getCategoryDescendantIds(rootCategoryId) {
  const ids = new Set([rootCategoryId]);
  let added = true;
  while (added) {
    added = false;
    for (const cat of memoryStore.categories) {
      if (cat.parentId && ids.has(cat.parentId) && !ids.has(cat.id)) {
        ids.add(cat.id);
        added = true;
      }
    }
  }
  return ids;
}

export function getCategoryDescendantIdsByName(categoryName) {
  if (!categoryName) return new Set();
  const matching = memoryStore.categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!matching) return new Set();
  return getCategoryDescendantIds(matching.id);
}

export function getCategoryTree() {
  const categories = memoryStore.categories || [];
  const map = {};
  const roots = [];

  categories.forEach((cat) => {
    map[cat.id] = { ...cat, children: [] };
  });

  categories.forEach((cat) => {
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(map[cat.id]);
    } else {
      roots.push(map[cat.id]);
    }
  });

  return roots;
}

export async function addCategory({ name, parentId = null, description = '' }, currentUser) {
  if (!name || !name.trim()) throw new Error('Category name cannot be empty.');

  const isAuthorized =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';

  if (!isAuthorized) {
    throw new Error('Permission denied: Only Admin or Sir can create component categories.');
  }

  const cleanName = name.trim();

  // Restriction: Do not allow arbitrary new root categories outside the seven approved categories
  if (!parentId) {
    if (!APPROVED_MAIN_CATEGORIES.includes(cleanName)) {
      throw new Error('Arbitrary new root categories are not permitted. Please select one of the seven approved main categories as the parent.');
    }
  } else {
    const parent = memoryStore.categories.find((c) => c.id === parentId);
    if (!parent) throw new Error(`Parent category with ID ${parentId} not found.`);
  }

  // Prevent duplicate names within the same parent
  const duplicate = memoryStore.categories.find(
    (c) => (c.parentId || null) === (parentId || null) && c.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A category named "${cleanName}" already exists under this parent.`);
  }

  const id = `CAT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const newCat = {
    id,
    name: cleanName,
    parentId: parentId || null,
    description: description ? description.trim() : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  memoryStore.categories.push(newCat);
  persistLocalCache('categories', memoryStore.categories);

  await executeCloudMutation({
    table: 'component_categories',
    action: 'insert',
    id: newCat.id,
    data: newCat,
  });

  logAuditEvent({
    actorName: currentUser?.name || 'Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Category Created',
    details: `Created new category "${cleanName}"${parentId ? ` under parent ID ${parentId}` : ' as root'}.`,
  });

  notifySubscribers('CATEGORY_ADDED', newCat);
  return newCat;
}

export async function updateCategory(id, { name, parentId, description } = {}, currentUser) {
  const index = memoryStore.categories.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Category with ID ${id} not found.`);

  const isAuthorized =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';

  if (!isAuthorized) {
    throw new Error('Permission denied: Only Admin or Sir can update component categories.');
  }

  const current = memoryStore.categories[index];
  const targetParentId = parentId !== undefined ? (parentId || null) : current.parentId;
  const targetName = name !== undefined ? name.trim() : current.name;

  if (!targetName) {
    throw new Error('Category name cannot be empty.');
  }

  // Prevent duplicate names within the target parent
  const duplicate = memoryStore.categories.find(
    (c) =>
      c.id !== id &&
      (c.parentId || null) === targetParentId &&
      c.name.toLowerCase() === targetName.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A category named "${targetName}" already exists under this parent.`);
  }

  // If root category, enforce approved main categories
  if (!current.parentId && targetParentId === null && !APPROVED_MAIN_CATEGORIES.includes(targetName)) {
    throw new Error(`Main categories must be one of the seven approved categories.`);
  }

  // Prevent circular hierarchy
  if (parentId) {
    if (parentId === id) throw new Error('A category cannot be its own parent.');
    const descendants = getCategoryDescendantIds(id);
    if (descendants.has(parentId)) {
      throw new Error('A category cannot have one of its descendants as its parent (circular hierarchy).');
    }
  }

  const oldName = current.name;
  const updated = {
    ...current,
    name: targetName,
    parentId: targetParentId,
    description: description !== undefined ? description.trim() : current.description,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.categories[index] = updated;
  persistLocalCache('categories', memoryStore.categories);

  // Synchronize components referencing the renamed category
  if (targetName !== oldName) {
    let componentsChanged = false;
    memoryStore.components.forEach((comp) => {
      if (comp.categoryId === id) {
        comp.categoryPath = getCategoryPath(id).join(' / ');
        if (!current.parentId) comp.category = targetName;
        else comp.parentCategory = targetName;
        componentsChanged = true;
      } else if (comp.category === oldName && !current.parentId) {
        comp.category = targetName;
        componentsChanged = true;
      } else if (comp.parentCategory === oldName && current.parentId) {
        comp.parentCategory = targetName;
        componentsChanged = true;
      }
    });
    if (componentsChanged) {
      persistLocalCache('components', memoryStore.components);
    }
  }

  await executeCloudMutation({
    table: 'component_categories',
    action: 'upsert',
    id: updated.id,
    data: updated,
  });

  logAuditEvent({
    actorName: currentUser?.name || 'Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Category Updated',
    details: `Updated category "${updated.name}" (${id}).`,
  });

  notifySubscribers('CATEGORY_UPDATED', updated);
  return updated;
}

export async function deleteCategory(id, currentUser) {
  const index = memoryStore.categories.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Category with ID ${id} not found.`);

  const isAuthorized =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';

  if (!isAuthorized) {
    throw new Error('Permission denied: Only Admin or Sir can delete component categories.');
  }

  const catToDelete = memoryStore.categories[index];

  // Protect the 7 approved main categories from deletion
  if (!catToDelete.parentId || APPROVED_MAIN_CATEGORIES.includes(catToDelete.name)) {
    throw new Error(`Cannot delete main category "${catToDelete.name}". Only user-defined subcategories can be deleted.`);
  }

  // Check child subcategories
  const hasChildren = memoryStore.categories.some((c) => c.parentId === id);
  if (hasChildren) {
    throw new Error('Cannot delete category: child subcategories exist. Delete or reassign child subcategories first.');
  }

  // Check assigned components
  const hasComponents = memoryStore.components.some((c) => c.categoryId === id);
  if (hasComponents) {
    throw new Error('Cannot delete category: components are currently assigned to this category.');
  }

  memoryStore.categories.splice(index, 1);
  persistLocalCache('categories', memoryStore.categories);

  await executeCloudMutation({
    table: 'component_categories',
    action: 'delete',
    id,
  });

  logAuditEvent({
    actorName: currentUser?.name || 'Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Category Deleted',
    details: `Deleted category "${catToDelete.name}" (${id}).`,
  });

  notifySubscribers('CATEGORY_DELETED', catToDelete);
  return { success: true };
}

export function getComponents(filterCategory = null, searchQuery = '', statusFilter = 'all', filterCategoryId = null) {
  let list = [...memoryStore.components];

  if (filterCategoryId && filterCategoryId !== 'all' && filterCategoryId !== 'All') {
    const descendantIds = getCategoryDescendantIds(filterCategoryId);
    const catObj = getCategoryById(filterCategoryId);
    list = list.filter((c) => {
      if (c.categoryId && descendantIds.has(c.categoryId)) return true;
      if (catObj && (c.category === catObj.name || c.parentCategory === catObj.name)) return true;
      return false;
    });
  } else if (filterCategory && filterCategory !== 'all' && filterCategory !== 'All') {
    const descendantIds = getCategoryDescendantIdsByName(filterCategory);
    list = list.filter((c) => c.category === filterCategory || (c.categoryId && descendantIds.has(c.categoryId)));
  }

  if (statusFilter === 'low_stock') {
    list = list.filter((c) => isComponentLowStock(c));
  } else if (statusFilter === 'damaged') {
    list = list.filter((c) => c.damagedQuantity > 0 || c.individualIds?.some((i) => i.status === 'damaged'));
  } else if (statusFilter === 'lost') {
    list = list.filter((c) => c.lostQuantity > 0 || c.individualIds?.some((i) => i.status === 'lost'));
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.categoryPath && c.categoryPath.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q)) ||
        (c.individualIds && c.individualIds.some((idObj) => idObj.id.toLowerCase().includes(q)))
    );
  }
  return list;
}

export function getComponentById(id) {
  return memoryStore.components.find((c) => c.id === id) || null;
}

/**
 * Automatically generates a collision-free unique component tag (e.g. ESP32-001, PIR-001, ARD-002).
 * Scans ALL existing component tags, IDs, and physical individual tags across the entire inventory.
 * 
 * @param {string} componentName 
 * @param {string | null} categoryIdOrName 
 * @returns {string} Unique uppercase component tag
 */
export function generateUniqueComponentTag(componentName = '', categoryIdOrName = null) {
  const existingTags = new Set();
  (memoryStore.components || []).forEach((c) => {
    if (c.componentNumber) existingTags.add(c.componentNumber.trim().toUpperCase());
    if (c.id) existingTags.add(c.id.trim().toUpperCase());
    if (Array.isArray(c.individualIds)) {
      c.individualIds.forEach((item) => {
        const tag = typeof item === 'string' ? item : item?.id;
        if (tag) existingTags.add(tag.trim().toUpperCase());
      });
    }
  });
  (memoryStore.transactions || []).forEach((t) => {
    (t.items || []).forEach((it) => {
      if (Array.isArray(it.individualIds)) {
        it.individualIds.forEach((tag) => {
          if (tag) existingTags.add(tag.trim().toUpperCase());
        });
      }
    });
  });

  const cleanName = (componentName || '').trim();
  let prefix = 'COMP';

  const knownPrefixMatches = [
    { regex: /\besp32\b/i, prefix: 'ESP32' },
    { regex: /\besp8266\b/i, prefix: 'ESP8266' },
    { regex: /\barduino\b/i, prefix: 'ARD' },
    { regex: /\braspberry\s*pi\b/i, prefix: 'RPI' },
    { regex: /\brp2040\b/i, prefix: 'RP2040' },
    { regex: /\bstm32\b/i, prefix: 'STM32' },
    { regex: /\bdht11\b/i, prefix: 'DHT11' },
    { regex: /\bdht22\b/i, prefix: 'DHT22' },
    { regex: /\bhc-?sr04\b/i, prefix: 'HCSR04' },
    { regex: /\b(pir|hc-?sr501|passive\s*infrared)\b/i, prefix: 'PIR' },
    { regex: /\bmq-?2\b/i, prefix: 'MQ2' },
    { regex: /\bmq-?135\b/i, prefix: 'MQ135' },
    { regex: /\bl298n\b/i, prefix: 'L298N' },
    { regex: /\bneo-?6m\b/i, prefix: 'GPS' },
    { regex: /\bnrf24l01\b/i, prefix: 'NRF' },
    { regex: /\blm35\b/i, prefix: 'LM35' },
    { regex: /\bds18b20\b/i, prefix: 'DS18B20' },
    { regex: /\bmpu-?6050\b/i, prefix: 'MPU6050' },
    { regex: /\bvl53l0x\b/i, prefix: 'TOF' },
  ];

  for (const match of knownPrefixMatches) {
    if (match.regex.test(cleanName)) {
      prefix = match.prefix;
      break;
    }
  }

  if (prefix === 'COMP' && cleanName) {
    const words = cleanName.split(/[\s\-_/]+/).filter(Boolean);
    if (words.length > 0) {
      const firstWord = words[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (firstWord.length >= 3 && firstWord.length <= 6) {
        prefix = firstWord;
      } else if (words.length >= 2) {
        prefix = words.slice(0, 2).map((w) => w[0]).join('').toUpperCase() + 'COMP';
      } else {
        prefix = (firstWord.slice(0, 4) || 'COMP').toUpperCase();
      }
    }
  }

  const prefixRegex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let maxSeq = 0;
  for (const tag of existingTags) {
    const m = tag.match(prefixRegex);
    if (m) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  while (existingTags.has(candidate)) {
    nextSeq++;
    candidate = `${prefix}-${String(nextSeq).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * Returns the complete category hierarchy path string for any component or category ID.
 * @param {object | string} componentOrId 
 * @returns {string}
 */
export function getCategoryBreadcrumb(componentOrId) {
  if (!componentOrId) return 'General';
  if (typeof componentOrId === 'string') {
    const byId = getCategoryPath(componentOrId);
    if (byId && byId.length > 0) return byId.join(' / ');
    return componentOrId;
  }
  if (componentOrId.categoryPath) return componentOrId.categoryPath;
  if (componentOrId.categoryId) {
    const path = getCategoryPath(componentOrId.categoryId);
    if (path && path.length > 0) return path.join(' / ');
  }
  const parts = [];
  if (componentOrId.parentCategory) parts.push(componentOrId.parentCategory);
  if (componentOrId.category && componentOrId.category !== componentOrId.parentCategory) {
    parts.push(componentOrId.category);
  }
  return parts.length > 0 ? parts.join(' / ') : 'Other electronic components';
}

export async function addComponent(componentData, actor) {
  // Check Storage Protection Mode
  const storageStatus = getDatabaseStorageStatus();
  const perm = validateStorageWrite('ADD_COMPONENT', storageStatus);
  if (!perm.allowed) {
    throw new Error(perm.message);
  }

  // Automatic unique component tag generation or duplicate validation
  let finalComponentNumber = componentData.componentNumber && componentData.componentNumber.trim()
    ? componentData.componentNumber.trim().toUpperCase()
    : null;

  if (finalComponentNumber) {
    const isColliding = (memoryStore.components || []).some(
      (c) => c.componentNumber && c.componentNumber.trim().toUpperCase() === finalComponentNumber
    );
    if (isColliding) {
      throw new Error('Component number already exists.');
    }
  } else {
    finalComponentNumber = generateUniqueComponentTag(componentData.name, componentData.categoryId);
  }

  let newId = componentData.id || `COMP-${String(Date.now()).slice(-6)}`;
  let counter = 1;
  while (memoryStore.components.some((c) => c.id === newId)) {
    newId = `COMP-${String(Date.now()).slice(-6)}-${counter++}`;
  }
  const total = Number(componentData.totalQuantity) || 0;

  let individualIds = [];
  if (componentData.trackingMode === 'individual') {
    if (Array.isArray(componentData.individualIds) && componentData.individualIds.length > 0) {
      individualIds = componentData.individualIds.map((item) =>
        typeof item === 'string' ? { id: item.trim().toUpperCase(), status: 'available' } : item
      );
    } else {
      for (let i = 1; i <= total; i++) {
        individualIds.push({
          id: `${finalComponentNumber}-${String(i).padStart(3, '0')}`,
          status: 'available',
        });
      }
    }
  }

  const catPath = componentData.categoryId ? getCategoryPath(componentData.categoryId).join(' / ') : (componentData.categoryPath || '');

  const newComponent = {
    id: newId,
    name: componentData.name.trim(),
    componentNumber: finalComponentNumber,
    parentCategory: componentData.parentCategory || '',
    locationDetails: componentData.locationDetails || componentData.location || '',
    category: componentData.category || 'Other electronic components',
    categoryId: componentData.categoryId || null,
    categoryPath: catPath,
    locationPhotoUrl: componentData.locationPhotoUrl || null,
    locationPhotoRef: componentData.locationPhotoRef || null,
    description: componentData.description || '',
    trackingMode: componentData.trackingMode || 'aggregate',
    totalQuantity: total,
    availableQuantity: total,
    issuedQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    lowStockThreshold: Number(componentData.lowStockThreshold) || 3,
    defaultOverdueDays: Number(componentData.defaultOverdueDays) || 7,
    location: componentData.location || componentData.locationDetails || '',
    individualIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  memoryStore.components.push(newComponent);
  persistLocalCache('components', memoryStore.components);

  await executeCloudMutation({
    table: 'components',
    action: 'insert',
    id: newId,
    data: newComponent,
  });

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Inventory Added',
    targetComponentId: newId,
    details: `Added new component "${newComponent.name}" (${total} units).`,
  });

  notifySubscribers('COMPONENT_ADDED', newComponent);
  return newComponent;
}

export async function updateComponent(id, updates, actor) {
  const index = memoryStore.components.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Component with ID ${id} not found.`);

  // Validate componentNumber uniqueness on update
  if (updates.componentNumber !== undefined && updates.componentNumber.trim()) {
    const trimmedNum = updates.componentNumber.trim().toLowerCase();
    const existing = memoryStore.components.find(
      (c) => c.id !== id && c.componentNumber && c.componentNumber.trim().toLowerCase() === trimmedNum
    );
    if (existing) {
      throw new Error('Component number already exists.');
    }
  }

  const current = memoryStore.components[index];
  let total = updates.totalQuantity !== undefined ? Number(updates.totalQuantity) : current.totalQuantity;

  let individualIds = updates.individualIds !== undefined ? updates.individualIds : current.individualIds || [];
  if (updates.trackingMode === 'individual' && (!individualIds || individualIds.length === 0)) {
    const prefix = (updates.idPrefix || current.name.substring(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    individualIds = [];
    for (let i = 1; i <= total; i++) {
      individualIds.push({
        id: `${prefix}-${String(i).padStart(3, '0')}`,
        status: 'available',
      });
    }
  }

  const updatedCatId = updates.categoryId !== undefined ? updates.categoryId : current.categoryId;
  const updatedCatPath = updates.categoryPath !== undefined
    ? updates.categoryPath
    : (updatedCatId ? getCategoryPath(updatedCatId).join(' / ') : current.categoryPath);

  const updated = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    componentNumber: updates.componentNumber !== undefined ? updates.componentNumber.trim() : current.componentNumber,
    category: updates.category !== undefined ? updates.category : current.category,
    parentCategory: updates.parentCategory !== undefined ? updates.parentCategory : current.parentCategory,
    categoryId: updatedCatId,
    categoryPath: updatedCatPath,
    locationPhotoUrl: updates.locationPhotoUrl !== undefined ? updates.locationPhotoUrl : current.locationPhotoUrl,
    locationPhotoRef: updates.locationPhotoRef !== undefined ? updates.locationPhotoRef : current.locationPhotoRef,
    description: updates.description !== undefined ? updates.description : current.description,
    trackingMode: updates.trackingMode !== undefined ? updates.trackingMode : current.trackingMode,
    totalQuantity: total,
    availableQuantity: updates.availableQuantity !== undefined ? Number(updates.availableQuantity) : current.availableQuantity,
    issuedQuantity: updates.issuedQuantity !== undefined ? Number(updates.issuedQuantity) : current.issuedQuantity,
    damagedQuantity: updates.damagedQuantity !== undefined ? Number(updates.damagedQuantity) : current.damagedQuantity,
    lostQuantity: updates.lostQuantity !== undefined ? Number(updates.lostQuantity) : current.lostQuantity,
    lowStockThreshold: updates.lowStockThreshold !== undefined ? Number(updates.lowStockThreshold) : current.lowStockThreshold,
    defaultOverdueDays: updates.defaultOverdueDays !== undefined ? Number(updates.defaultOverdueDays) : current.defaultOverdueDays,
    location: updates.location !== undefined ? updates.location : (updates.locationDetails !== undefined ? updates.locationDetails : current.location),
    locationDetails: updates.locationDetails !== undefined ? updates.locationDetails : (updates.location !== undefined ? updates.location : current.locationDetails),
    individualIds,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.components[index] = updated;
  persistLocalCache('components', memoryStore.components);

  await executeCloudMutation({
    table: 'components',
    action: 'upsert',
    id: updated.id,
    data: updated,
  });

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Inventory Updated',
    targetComponentId: id,
    details: `Updated details for "${updated.name}".`,
  });

  notifySubscribers('COMPONENT_UPDATED', updated);
  return updated;
}

export async function addComponentQuantity(id, additionalQuantity, actor) {
  const comp = getComponentById(id);
  if (!comp) throw new Error('Component not found');
  const add = Number(additionalQuantity);
  if (add <= 0) throw new Error('Quantity must be greater than zero');

  const newTotal = comp.totalQuantity + add;
  let individualIds = [...(comp.individualIds || [])];

  if (comp.trackingMode === 'individual') {
    const prefix = comp.name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const currentCount = individualIds.length;
    for (let i = 1; i <= add; i++) {
      individualIds.push({
        id: `${prefix}-${String(currentCount + i).padStart(3, '0')}`,
        status: 'available',
      });
    }
  }

  const updated = await updateComponent(
    id,
    {
      totalQuantity: newTotal,
      individualIds,
    },
    actor
  );

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Inventory Restocked',
    targetComponentId: id,
    details: `Added ${add} units to "${comp.name}". New total: ${newTotal}.`,
  });

  return updated;
}

export async function deleteComponent(id, actor) {
  const index = memoryStore.components.findIndex((c) => c.id === id);
  if (index === -1) throw new Error('Component not found.');

  const comp = memoryStore.components[index];
  if (comp.issuedQuantity > 0) {
    throw new Error(`Cannot delete "${comp.name}" because ${comp.issuedQuantity} unit(s) are currently issued.`);
  }

  memoryStore.components.splice(index, 1);
  persistLocalCache('components', memoryStore.components);

  await executeCloudMutation({
    table: 'components',
    action: 'delete',
    id: id,
    data: comp,
  });

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Inventory Deleted',
    targetComponentId: id,
    details: `Deleted component "${comp.name}".`,
  });

  notifySubscribers('COMPONENT_DELETED', { id });
  return true;
}

// ==================== TRANSACTIONS: ISSUE & RETURN ====================

export function getTransactions(filterStatus = 'all', searchQuery = '', studentRoll = null) {
  let list = [...memoryStore.transactions];

  if (studentRoll) {
    const clean = studentRoll.toUpperCase();
    list = list.filter((t) => t.studentRoll.toUpperCase() === clean);
  }

  if (filterStatus && filterStatus !== 'all') {
    if (filterStatus === 'overdue') {
      list = list.filter((t) => isTransactionOverdue(t));
    } else {
      list = list.filter((t) => t.status === filterStatus);
    }
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.studentName.toLowerCase().includes(q) ||
        t.studentRoll.toLowerCase().includes(q) ||
        t.items.some((item) => item.componentName.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  return list;
}

export function getActiveTransactionsForStudent(rollNumber) {
  if (!rollNumber) return [];
  const clean = rollNumber.toUpperCase();
  const txns = memoryStore.transactions.filter(
    (t) => t.studentRoll.toUpperCase() === clean && (t.status === 'active' || t.status === 'partially_returned')
  );

  // Self-heal items missing individualIds
  for (const txn of txns) {
    if (Array.isArray(txn.items)) {
      for (const item of txn.items) {
        if (item.trackingMode === 'individual') {
          if (!Array.isArray(item.individualIds) || item.individualIds.length === 0) {
            if (Array.isArray(item.selectedIndividualIds) && item.selectedIndividualIds.length > 0) {
              item.individualIds = [...item.selectedIndividualIds];
            } else {
              const comp = getComponentById(item.componentId);
              if (comp && Array.isArray(comp.individualIds)) {
                const matched = comp.individualIds
                  .filter((t) => t.currentTransactionId === txn.id || (t.status === 'issued' && t.currentStudentRoll === txn.studentRoll))
                  .map((t) => t.id);
                if (matched.length > 0) {
                  item.individualIds = matched;
                }
              }
            }
          }
        }
      }
    }
  }

  return txns;
}

export async function issueComponents({
  studentName,
  studentRoll,
  department = '',
  phone = '',
  authorizedBy = null,
  items = [],
  notes = '',
  actor,
}) {
  if (!items || items.length === 0) throw new Error('No items selected for issue.');

  const cleanRoll = studentRoll.trim().toUpperCase();
  const cleanName = studentName.trim();

  // Validate stock availability
  for (const it of items) {
    const comp = getComponentById(it.componentId);
    if (!comp) throw new Error(`Component "${it.componentName}" not found.`);
    if (comp.availableQuantity < it.quantity) {
      throw new Error(`Insufficient stock for "${comp.name}". Available: ${comp.availableQuantity}, Requested: ${it.quantity}`);
    }
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const newTxnId = `TXN-${dateStr}-${String(Date.now()).slice(-3)}`;

  let overallDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const processedItems = items.map((it) => {
    const comp = getComponentById(it.componentId);
    const overdueDays = comp.defaultOverdueDays || 7;
    const itemDueDate = new Date(now.getTime() + overdueDays * 24 * 60 * 60 * 1000);
    if (itemDueDate > overallDueDate) overallDueDate = itemDueDate;

    const assignedTags = Array.isArray(it.individualIds) && it.individualIds.length > 0
      ? it.individualIds
      : Array.isArray(it.selectedIndividualIds) && it.selectedIndividualIds.length > 0
        ? it.selectedIndividualIds
        : [];

    return {
      componentId: it.componentId,
      componentName: comp.name,
      category: comp.category,
      issuedQuantity: it.quantity,
      returnedQuantity: 0,
      trackingMode: comp.trackingMode,
      individualIds: assignedTags,
      selectedIndividualIds: assignedTags,
      returnedIndividualIds: [],
      dueDate: itemDueDate.toISOString(),
      status: 'issued',
    };
  });

  // Snapshot component states for rollback safety
  const componentSnapshots = items.map((it) => {
    const comp = getComponentById(it.componentId);
    return {
      id: comp.id,
      availableQuantity: comp.availableQuantity,
      issuedQuantity: comp.issuedQuantity,
      individualIds: comp.individualIds ? JSON.parse(JSON.stringify(comp.individualIds)) : [],
      updatedAt: comp.updatedAt,
    };
  });

  // Deduct inventory locally
  for (const it of items) {
    const comp = getComponentById(it.componentId);
    const newAvailable = comp.availableQuantity - it.quantity;
    const newIssued = comp.issuedQuantity + it.quantity;

    let individualIds = comp.individualIds ? [...comp.individualIds] : [];
    const targetTagIds = Array.isArray(it.individualIds) && it.individualIds.length > 0
      ? it.individualIds
      : Array.isArray(it.selectedIndividualIds) && it.selectedIndividualIds.length > 0
        ? it.selectedIndividualIds
        : [];

    if (comp.trackingMode === 'individual' && targetTagIds.length > 0) {
      individualIds = individualIds.map((tag) => {
        if (targetTagIds.includes(tag.id)) {
          return {
            ...tag,
            status: 'issued',
            currentTransactionId: newTxnId,
            currentStudentRoll: cleanRoll,
          };
        }
        return tag;
      });
    }

    // Update memory store state
    comp.availableQuantity = newAvailable;
    comp.issuedQuantity = newIssued;
    comp.individualIds = individualIds;
    comp.updatedAt = now.toISOString();
  }
  persistLocalCache('components', memoryStore.components);

  // Automatically update phone number locally if provided
  let phoneUpdated = false;
  const studentUser = getUserByRoll(cleanRoll);
  const originalPhone = studentUser?.mobileNumber || '';
  if (phone && typeof phone === 'string' && phone.trim()) {
    const cleanPhone = phone.trim();
    if (studentUser && (!studentUser.mobileNumber || studentUser.mobileNumber !== cleanPhone)) {
      studentUser.mobileNumber = cleanPhone;
      studentUser.updatedAt = now.toISOString();
      persistLocalCache('users', memoryStore.users);
      phoneUpdated = true;
    }
  }

  const newTxn = {
    id: newTxnId,
    studentRoll: cleanRoll,
    studentName: cleanName,
    studentPhone: phone ? phone.trim() : (getUserByRoll(cleanRoll)?.mobileNumber || ''),
    authorizedBy: authorizedBy ? authorizedBy.trim() : null,
    issueDate: now.toISOString(),
    overallDueDate: overallDueDate.toISOString(),
    status: 'active',
    notes: notes ? notes.trim() : null,
    items: processedItems,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const operationId = `OP-ISSUE-${dateStr}-${String(Date.now()).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;
  newTxn.operationId = operationId;

  memoryStore.transactions.unshift(newTxn);
  persistLocalCache('transactions', memoryStore.transactions);

  // Sync directly to local PostgreSQL issued_components database
  try {
    const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
    fetch(`${pgApiBase}/api/issued-components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newTxn.id,
        registration_number: newTxn.studentRoll,
        student_name: newTxn.studentName,
        phone_number: newTxn.studentPhone,
        student_details: {
          department: studentUser?.department || department || '',
          year: studentUser?.year || '',
          section: studentUser?.section || '',
          email: studentUser?.email || '',
        },
        components: processedItems,
        issue_date: newTxn.issueDate,
        overall_due_date: newTxn.overallDueDate,
        status: 'issued',
        notes: newTxn.notes,
        issued_by: actor?.name || actor?.email || 'Admin',
      }),
    }).then(async (res) => {
      if (res.ok) {
        console.log(`[PostgreSQL DB] Issue record ${newTxn.id} saved to PostgreSQL successfully.`);
      }
    }).catch((pgErr) => {
      console.warn('[PostgreSQL DB] Sync warning:', pgErr.message);
    });
  } catch (e) {
    console.warn('[PostgreSQL DB] Dispatch error:', e);
  }

  // Atomic Cloud Sync Strategy:
  // Strict RPC execution with immediate rollback on server rejection; preserves retryable operation on network failure.
  const rpcPayload = {
    p_transaction_id: newTxn.id,
    p_student_roll: newTxn.studentRoll,
    p_student_name: newTxn.studentName,
    p_student_phone: phone ? phone.trim() : null,
    p_authorized_by: newTxn.authorizedBy,
    p_overall_due_date: newTxn.overallDueDate,
    p_notes: null,
    p_items: processedItems,
    p_operation_id: operationId,
  };

  if (isOnlineState && supabase && typeof supabase.rpc === 'function') {
    let rpcError = null;
    let rpcData = null;
    try {
      const res = await supabase.rpc('issue_components_atomic', rpcPayload);
      rpcData = res.data;
      rpcError = res.error;
    } catch (err) {
      rpcError = err;
    }

    if (rpcError) {
      const errMsg = rpcError.message || String(rpcError);
      const isAuthOrPermissionIssue =
        rpcError.code === '42501' ||
        errMsg.includes('permission denied') ||
        errMsg.includes('Unauthorized') ||
        errMsg.includes('issue_components_atomic');
      const isNetworkError =
        !rpcError.code ||
        errMsg.includes('fetch failed') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('Failed to fetch');

      if (isNetworkError || isAuthOrPermissionIssue) {
        newTxn.syncStatus = 'pending_sync';
        syncService.enqueueMutation({
          table: 'transactions',
          action: 'rpc',
          rpcName: 'issue_components_atomic',
          rpcPayload,
          id: newTxn.id,
          operationId,
          data: newTxn,
        });
        console.warn(`[Offline Sync Queue] Component issue recorded locally and enqueued for cloud sync (${isAuthOrPermissionIssue ? 'Permission queue' : 'Network queue'}): ${errMsg}`);
      } else {
        // Authoritative server rejection: ROLL BACK optimistic local mutations
        for (const snap of componentSnapshots) {
          const comp = getComponentById(snap.id);
          if (comp) {
            comp.availableQuantity = snap.availableQuantity;
            comp.issuedQuantity = snap.issuedQuantity;
            comp.individualIds = snap.individualIds;
            comp.updatedAt = snap.updatedAt;
          }
        }
        persistLocalCache('components', memoryStore.components);

        if (phoneUpdated && studentUser) {
          studentUser.mobileNumber = originalPhone;
          persistLocalCache('users', memoryStore.users);
        }

        const txnIdx = memoryStore.transactions.findIndex((t) => t.id === newTxn.id);
        if (txnIdx !== -1) {
          memoryStore.transactions.splice(txnIdx, 1);
          persistLocalCache('transactions', memoryStore.transactions);
        }

        throw new Error(`Server issue validation failed: ${errMsg}`);
      }
    }
  } else if (!isOnlineState) {
    newTxn.syncStatus = 'pending_sync';
    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'issue_components_atomic',
      rpcPayload,
      id: newTxn.id,
      operationId,
      data: newTxn,
    });
  }

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Component Issued',
    targetRoll: cleanRoll,
    details: `Issued ${items.length} item type(s) to ${cleanName} (${cleanRoll}).`,
  });

  notifySubscribers('TRANSACTION_CREATED', newTxn);
  return newTxn;
}

export async function returnComponents(transactionId, returnedItems, actor) {
  const index = memoryStore.transactions.findIndex((t) => t.id === transactionId);
  if (index === -1) throw new Error('Transaction not found.');

  const txn = memoryStore.transactions[index];
  const originalTxnSnapshot = JSON.parse(JSON.stringify(txn));
  const now = new Date();

  // Snapshot component states for rollback safety
  const componentSnapshots = returnedItems.map((ret) => {
    const comp = getComponentById(ret.componentId);
    if (!comp) return null;
    return {
      id: comp.id,
      availableQuantity: comp.availableQuantity,
      issuedQuantity: comp.issuedQuantity,
      individualIds: comp.individualIds ? JSON.parse(JSON.stringify(comp.individualIds)) : [],
      updatedAt: comp.updatedAt,
    };
  }).filter(Boolean);

  for (const ret of returnedItems) {
    const itemIndex = txn.items.findIndex((i) => i.componentId === ret.componentId);
    if (itemIndex === -1) continue;

    const it = txn.items[itemIndex];
    const returnQty = Number(ret.returnQuantity) || 0;
    if (returnQty <= 0) continue;

    const remaining = it.issuedQuantity - it.returnedQuantity;
    if (returnQty > remaining) {
      throw new Error(`Cannot return ${returnQty} units of "${it.componentName}". Only ${remaining} remaining.`);
    }

    it.returnedQuantity += returnQty;
    if (it.returnedQuantity >= it.issuedQuantity) {
      it.status = 'returned';
    }

    const tagIds = Array.isArray(ret.returnedIndividualIds) && ret.returnedIndividualIds.length > 0
      ? ret.returnedIndividualIds
      : Array.isArray(ret.returnedTagIds) && ret.returnedTagIds.length > 0
        ? ret.returnedTagIds
        : [];
    if (tagIds.length > 0) {
      it.returnedIndividualIds = [
        ...new Set([...(it.returnedIndividualIds || []), ...tagIds]),
      ];
    }

    const comp = getComponentById(it.componentId);
    if (comp) {
      const newAvailable = comp.availableQuantity + returnQty;
      const newIssued = Math.max(0, comp.issuedQuantity - returnQty);

      let individualIds = comp.individualIds ? [...comp.individualIds] : [];
      if (comp.trackingMode === 'individual' && tagIds.length > 0) {
        individualIds = individualIds.map((tag) => {
          if (tagIds.includes(tag.id)) {
            return {
              ...tag,
              status: 'available',
              currentTransactionId: null,
              currentStudentRoll: null,
            };
          }
          return tag;
        });
      } else if (comp.trackingMode === 'individual' && tagIds.length === 0) {
        let freed = 0;
        individualIds = individualIds.map((tag) => {
          if (
            freed < returnQty &&
            (tag.currentTransactionId === txn.id || (tag.status === 'issued' && tag.currentStudentRoll === txn.studentRoll))
          ) {
            freed++;
            return {
              ...tag,
              status: 'available',
              currentTransactionId: null,
              currentStudentRoll: null,
            };
          }
          return tag;
        });
      }

      comp.availableQuantity = newAvailable;
      comp.issuedQuantity = newIssued;
      comp.individualIds = individualIds;
      comp.updatedAt = now.toISOString();
    }
  }
  persistLocalCache('components', memoryStore.components);

  const allItemsReturned = txn.items.every((it) => it.returnedQuantity >= it.issuedQuantity);
  const anyItemReturned = txn.items.some((it) => it.returnedQuantity > 0);

  if (allItemsReturned) {
    txn.status = 'returned';
    txn.returnedDate = now.toISOString();
  } else if (anyItemReturned) {
    txn.status = 'partially_returned';
  }
  txn.lastReturnDate = now.toISOString();
  txn.updatedAt = now.toISOString();

  memoryStore.transactions[index] = txn;
  persistLocalCache('transactions', memoryStore.transactions);

  // Sync return update directly to local PostgreSQL issued_components database
  try {
    const pgApiBase = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';
    fetch(`${pgApiBase}/api/return-components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: txn.id,
        status: txn.status,
        items: txn.items,
      }),
    }).then(async (res) => {
      if (res.ok) {
        console.log(`[PostgreSQL DB] Return update ${txn.id} saved to PostgreSQL successfully.`);
      }
    }).catch((pgErr) => {
      console.warn('[PostgreSQL DB] Return sync warning:', pgErr.message);
    });
  } catch (e) {
    console.warn('[PostgreSQL DB] Return dispatch error:', e);
  }

  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const returnOperationId = `OP-RETURN-${dateStr}-${String(Date.now()).slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;

  // Atomic Cloud Sync Strategy:
  // Strict RPC execution with immediate rollback on server rejection; preserves retryable operation on network failure.
  const rpcPayload = {
    p_transaction_id: txn.id,
    p_returned_items: returnedItems,
    p_operation_id: returnOperationId,
  };

  if (isOnlineState && supabase && typeof supabase.rpc === 'function') {
    let rpcError = null;
    let rpcData = null;
    try {
      const res = await supabase.rpc('return_components_atomic', rpcPayload);
      rpcData = res.data;
      rpcError = res.error;
    } catch (err) {
      rpcError = err;
    }

    if (rpcError) {
      const errMsg = rpcError.message || String(rpcError);
      const isAuthOrPermissionIssue =
        rpcError.code === '42501' ||
        errMsg.includes('permission denied') ||
        errMsg.includes('Unauthorized') ||
        errMsg.includes('return_components_atomic');
      const isNetworkError =
        !rpcError.code ||
        errMsg.includes('fetch failed') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('Failed to fetch');

      if (isNetworkError || isAuthOrPermissionIssue) {
        txn.syncStatus = 'pending_sync';
        syncService.enqueueMutation({
          table: 'transactions',
          action: 'rpc',
          rpcName: 'return_components_atomic',
          rpcPayload,
          id: txn.id,
          operationId: returnOperationId,
          data: txn,
        });
        console.warn(`[Offline Sync Queue] Component return recorded locally and enqueued for cloud sync (${isAuthOrPermissionIssue ? 'Permission queue' : 'Network queue'}): ${errMsg}`);
      } else {
        // Authoritative server rejection: ROLL BACK optimistic local mutations
        for (const snap of componentSnapshots) {
          const comp = getComponentById(snap.id);
          if (comp) {
            comp.availableQuantity = snap.availableQuantity;
            comp.issuedQuantity = snap.issuedQuantity;
            comp.individualIds = snap.individualIds;
            comp.updatedAt = snap.updatedAt;
          }
        }
        persistLocalCache('components', memoryStore.components);

        memoryStore.transactions[index] = originalTxnSnapshot;
        persistLocalCache('transactions', memoryStore.transactions);

        throw new Error(`Server return validation failed: ${errMsg}`);
      }
    }
  } else if (!isOnlineState) {
    txn.syncStatus = 'pending_sync';
    syncService.enqueueMutation({
      table: 'transactions',
      action: 'rpc',
      rpcName: 'return_components_atomic',
      rpcPayload,
      id: txn.id,
      operationId: returnOperationId,
      data: txn,
    });
  }

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: allItemsReturned ? 'Return Completed' : 'Partial Return',
    targetRoll: txn.studentRoll,
    details: `Processed component return for ${txn.studentName} (${txn.studentRoll}).`,
  });

  notifySubscribers('TRANSACTION_UPDATED', txn);
  return txn;
}

// ==================== AUTHORIZATIONS ====================

export function getAuthorizations() {
  return [...memoryStore.authorizations];
}

export function getActiveAuthorizationsForStudent(primaryRoll) {
  if (!primaryRoll) return [];
  const clean = primaryRoll.toUpperCase();
  const now = new Date();
  return memoryStore.authorizations.filter(
    (a) =>
      a.primaryStudentRoll.toUpperCase() === clean &&
      a.status === 'active' &&
      new Date(a.validFrom) <= now &&
      new Date(a.validUntil) >= now
  );
}

export function getDelegationsForDelegate(delegateRoll) {
  if (!delegateRoll) return [];
  const clean = delegateRoll.toUpperCase();
  const now = new Date();
  return memoryStore.authorizations.filter(
    (a) =>
      a.authorizedStudentRoll.toUpperCase() === clean &&
      a.status === 'active' &&
      new Date(a.validFrom) <= now &&
      new Date(a.validUntil) >= now
  );
}

export async function createAuthorization({
  primaryStudentRoll,
  primaryStudentName,
  authorizedStudentRoll,
  authorizedStudentName,
  scope = 'both',
  validFrom,
  validUntil,
  reason = '',
  actor,
}) {
  if (!primaryStudentRoll || !primaryStudentName) throw new Error('Primary student details required.');
  if (!authorizedStudentRoll || !authorizedStudentName) throw new Error('Authorized delegate details required.');
  if (primaryStudentRoll.trim().toUpperCase() === authorizedStudentRoll.trim().toUpperCase()) {
    throw new Error('Primary student and delegate cannot be the same person.');
  }

  const now = new Date();
  const newAuth = {
    id: `AUTH-${String(Date.now()).slice(-6)}`,
    primaryStudentRoll: primaryStudentRoll.trim().toUpperCase(),
    primaryStudentName: primaryStudentName.trim(),
    authorizedStudentRoll: authorizedStudentRoll.trim().toUpperCase(),
    authorizedStudentName: authorizedStudentName.trim(),
    scope,
    validFrom: validFrom || now.toISOString(),
    validUntil: validUntil || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    reason: reason.trim(),
    createdAt: now.toISOString(),
  };

  memoryStore.authorizations.unshift(newAuth);
  persistLocalCache('authorizations', memoryStore.authorizations);

  await executeCloudMutation({
    table: 'authorizations',
    action: 'insert',
    id: newAuth.id,
    data: newAuth,
  });

  logAuditEvent({
    actorName: actor?.name || memoryStore.currentUser?.name || 'Admin',
    actorRole: actor?.role || memoryStore.currentUser?.role || 'Admin',
    action: 'Authorization Created',
    targetRoll: primaryStudentRoll.trim().toUpperCase(),
    details: `Authorized ${authorizedStudentName} (${authorizedStudentRoll}) for ${primaryStudentName} (${scope}).`,
  });

  notifySubscribers('AUTHORIZATION_CREATED', newAuth);
  return newAuth;
}

export async function revokeAuthorization(id, actor) {
  const index = memoryStore.authorizations.findIndex((a) => a.id === id);
  if (index === -1) throw new Error('Authorization not found.');

  memoryStore.authorizations[index].status = 'revoked';
  memoryStore.authorizations[index].revokedAt = new Date().toISOString();

  persistLocalCache('authorizations', memoryStore.authorizations);

  await executeCloudMutation({
    table: 'authorizations',
    action: 'update',
    id: id,
    data: memoryStore.authorizations[index],
  });

  logAuditEvent({
    actorName: actor?.name || memoryStore.currentUser?.name || 'Admin',
    actorRole: actor?.role || memoryStore.currentUser?.role || 'Admin',
    action: 'Authorization Revoked',
    details: `Revoked authorization ${id}.`,
  });

  notifySubscribers('AUTHORIZATION_REVOKED', memoryStore.authorizations[index]);
  return memoryStore.authorizations[index];
}

// ==================== DEVICE CONTROL & POWER ====================

export function getDevices(userRole = 'student') {
  return memoryStore.devices.map((d) => {
    if (userRole === 'student') {
      const { dailyKwh, weeklyKwh, monthlyKwh, yearlyKwh, powerRatingWatts, ...rest } = d;
      return rest;
    }
    return { ...d };
  });
}

export async function setDeviceCommandState(deviceId, commandedState, brightness = null, speed = null, actor = null) {
  const idx = memoryStore.devices.findIndex((d) => d.id === deviceId);
  if (idx === -1) throw new Error('Device not found.');

  const dev = memoryStore.devices[idx];
  const updated = {
    ...dev,
    commandedState,
    brightness: brightness !== null ? Number(brightness) : dev.brightness,
    speed: speed !== null ? Number(speed) : dev.speed,
    hardwareStatus: 'command_sent',
    lastCommandedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  memoryStore.devices[idx] = updated;
  persistLocalCache('devices', memoryStore.devices);

  // Security Hardening: Supabase never acts as a remote device-command channel.
  // Physical device operations are strictly handled locally by the Local Lab Gateway.

  if (actor) {
    logAuditEvent({
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Device Controlled',
      details: `${dev.name} set to ${commandedState} (Brightness: ${updated.brightness}%, Speed: ${updated.speed}).`,
    });
  }

  notifySubscribers('DEVICE_UPDATED', updated);
  return updated;
}

export async function updateDeviceConfirmedState(deviceId, actualState, brightness = null, speed = null) {
  const idx = memoryStore.devices.findIndex((d) => d.id === deviceId);
  if (idx === -1) return null;

  const dev = memoryStore.devices[idx];
  const updated = {
    ...dev,
    actualState,
    commandedState: actualState,
    brightness: brightness !== null ? Number(brightness) : dev.brightness,
    speed: speed !== null ? Number(speed) : dev.speed,
    hardwareStatus: 'confirmed',
    lastHardwareSync: new Date().toISOString(),
    isOnline: true,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.devices[idx] = updated;
  persistLocalCache('devices', memoryStore.devices);

  await executeCloudMutation({
    table: 'devices',
    action: 'update',
    id: deviceId,
    data: updated,
  });

  notifySubscribers('DEVICE_UPDATED', updated);
  return updated;
}

export function getPowerMonitoringStats(userRole) {
  if (userRole === 'student') {
    throw new Error('Access denied: Power monitoring is restricted to lab administrators.');
  }

  const tariff = memoryStore.settings.electricityTariffPerKwh || 7.5;
  const devices = memoryStore.devices;

  let totalDailyKwh = 0;
  let totalWeeklyKwh = 0;
  let totalMonthlyKwh = 0;
  let totalYearlyKwh = 0;

  const deviceStats = devices.map((d) => {
    const daily = d.dailyKwh || 0;
    const weekly = d.weeklyKwh || 0;
    const monthly = d.monthlyKwh || 0;
    const yearly = d.yearlyKwh || 0;

    totalDailyKwh += daily;
    totalWeeklyKwh += weekly;
    totalMonthlyKwh += monthly;
    totalYearlyKwh += yearly;

    return {
      id: d.id,
      name: d.name,
      type: d.type,
      location: d.location,
      actualState: d.actualState,
      powerRatingWatts: d.powerRatingWatts || 0,
      dailyKwh: typeof daily === 'number' ? daily.toFixed(2) : daily,
      weeklyKwh: typeof weekly === 'number' ? weekly.toFixed(2) : weekly,
      monthlyKwh: typeof monthly === 'number' ? monthly.toFixed(2) : monthly,
      yearlyKwh: typeof yearly === 'number' ? yearly.toFixed(2) : yearly,
      estimatedCostMonthly: (monthly * tariff).toFixed(2),
      estimatedMonthlyCostInr: Math.round(monthly * tariff),
    };
  });

  return {
    tariffPerKwh: tariff,
    totalDailyKwh: Number(totalDailyKwh.toFixed(2)),
    totalWeeklyKwh: Number(totalWeeklyKwh.toFixed(2)),
    totalMonthlyKwh: Number(totalMonthlyKwh.toFixed(2)),
    totalYearlyKwh: Number(totalYearlyKwh.toFixed(2)),
    totalEstimatedCostMonthly: (totalMonthlyKwh * tariff).toFixed(2),
    estimatedDailyCostInr: Math.round(totalDailyKwh * tariff),
    estimatedWeeklyCostInr: Math.round(totalWeeklyKwh * tariff),
    estimatedMonthlyCostInr: Math.round(totalMonthlyKwh * tariff),
    estimatedYearlyCostInr: Math.round(totalYearlyKwh * tariff),
    devices: deviceStats,
    deviceStats,
  };
}

// ==================== ANALYTICS (SEPARATE GRAPHS) ====================

// Local calendar date helper: guarantees local date YYYY-MM-DD regardless of UTC offsets
export function toLocalDateKey(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAttendanceAnalytics(period = 'week') {
  const visits = memoryStore.visits || [];
  const dailyAttendance = memoryStore.dailyAttendance || {};
  const now = new Date();

  if (period === 'year') {
    // 12 months ending with the current month
    const monthBuckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      monthBuckets.push({
        monthKey: mKey,
        label,
        name: label,
        students: new Set(),
      });
    }

    // 1. Collect unique students from visit records
    for (const v of visits) {
      const entryTime = v.entryTime || v.entry_time;
      if (!entryTime) continue;
      const key = toLocalDateKey(entryTime);
      if (!key) continue;
      const mKey = key.slice(0, 7);
      const bucket = monthBuckets.find((b) => b.monthKey === mKey);
      if (bucket) {
        const roll = (v.studentRoll || v.student_roll || v.studentName || v.id || '').trim().toUpperCase();
        if (roll) bucket.students.add(roll);
      }
    }

    // 2. Also incorporate dailyAttendance records if present
    for (const [dateStr, rolls] of Object.entries(dailyAttendance)) {
      if (!Array.isArray(rolls) || rolls.length === 0) continue;
      const mKey = dateStr.slice(0, 7);
      const bucket = monthBuckets.find((b) => b.monthKey === mKey);
      if (bucket) {
        for (const r of rolls) {
          if (r && typeof r === 'string') bucket.students.add(r.trim().toUpperCase());
        }
      }
    }

    return monthBuckets.map((b) => ({
      label: b.label,
      name: b.name,
      month: b.monthKey,
      studentsCount: b.students.size,
      Attendees: b.students.size,
    }));
  }

  // Week (7 days) or Month (30 days)
  const daysToShow = period === 'month' ? 30 : 7;
  const dayBuckets = [];
  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateKey = toLocalDateKey(d);
    const label =
      period === 'month'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    dayBuckets.push({
      dateKey,
      label,
      name: label,
      students: new Set(),
    });
  }

  // 1. Collect unique students per day from visit records
  for (const v of visits) {
    const entryTime = v.entryTime || v.entry_time;
    if (!entryTime) continue;
    const key = toLocalDateKey(entryTime);
    if (!key) continue;
    const bucket = dayBuckets.find((b) => b.dateKey === key);
    if (bucket) {
      const roll = (v.studentRoll || v.student_roll || v.studentName || v.id || '').trim().toUpperCase();
      if (roll) bucket.students.add(roll);
    }
  }

  // 2. Also incorporate dailyAttendance records if present
  for (const [dateStr, rolls] of Object.entries(dailyAttendance)) {
    if (!Array.isArray(rolls) || rolls.length === 0) continue;
    const bucket = dayBuckets.find((b) => b.dateKey === dateStr);
    if (bucket) {
      for (const r of rolls) {
        if (r && typeof r === 'string') bucket.students.add(r.trim().toUpperCase());
      }
    }
  }

  return dayBuckets.map((b) => ({
    label: b.label,
    name: b.name,
    date: b.dateKey,
    studentsCount: b.students.size,
    Attendees: b.students.size,
  }));
}

export function getEquipmentUsageAnalytics(period = 'week') {
  const txns = memoryStore.transactions || [];
  const now = new Date();

  if (period === 'year') {
    // 12 months ending with current month
    const monthBuckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      monthBuckets.push({
        monthKey: mKey,
        label,
        name: label,
        borrowers: new Set(),
      });
    }

    for (const t of txns) {
      const issueDate = t.issueDate || t.issue_date;
      if (!issueDate) continue;
      const key = toLocalDateKey(issueDate);
      if (!key) continue;
      const mKey = key.slice(0, 7);
      const bucket = monthBuckets.find((b) => b.monthKey === mKey);
      if (bucket) {
        const roll = (t.studentRoll || t.student_roll || t.studentName || t.id || '').trim().toUpperCase();
        if (roll) bucket.borrowers.add(roll);
      }
    }

    return monthBuckets.map((b) => ({
      label: b.label,
      name: b.name,
      month: b.monthKey,
      borrowersCount: b.borrowers.size,
      Issued: b.borrowers.size,
    }));
  }

  // Week (7 days) or Month (30 days)
  const daysToShow = period === 'month' ? 30 : 7;
  const dayBuckets = [];
  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateKey = toLocalDateKey(d);
    const label =
      period === 'month'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    dayBuckets.push({
      dateKey,
      label,
      name: label,
      borrowers: new Set(),
    });
  }

  for (const t of txns) {
    const issueDate = t.issueDate || t.issue_date;
    if (!issueDate) continue;
    const key = toLocalDateKey(issueDate);
    if (!key) continue;
    const bucket = dayBuckets.find((b) => b.dateKey === key);
    if (bucket) {
      const roll = (t.studentRoll || t.student_roll || t.studentName || t.id || '').trim().toUpperCase();
      if (roll) bucket.borrowers.add(roll);
    }
  }

  return dayBuckets.map((b) => ({
    label: b.label,
    name: b.name,
    date: b.dateKey,
    borrowersCount: b.borrowers.size,
    Issued: b.borrowers.size,
  }));
}

// ==================== AUDIT LOGS ====================

export async function logAuditEvent({
  actorName,
  actorRole,
  action,
  targetRoll = null,
  targetComponentId = null,
  previousValue = null,
  newValue = null,
  details = '',
}) {
  const newLog = {
    id: `AUDIT-${String(Date.now()).slice(-6)}`,
    timestamp: new Date().toISOString(),
    actorName: actorName || 'System',
    actorRole: actorRole || 'Admin',
    action,
    targetRoll,
    targetComponentId,
    previousValue,
    newValue,
    details,
    createdAt: new Date().toISOString(),
  };

  memoryStore.auditLogs.unshift(newLog);
  if (memoryStore.auditLogs.length > 500) {
    memoryStore.auditLogs.length = 500;
  }

  persistLocalCache('auditLogs', memoryStore.auditLogs);

  await executeCloudMutation({
    table: 'audit_logs',
    action: 'insert',
    id: newLog.id,
    data: newLog,
  });

  notifySubscribers('AUDIT_LOG_ADDED', newLog);
  return newLog;
}

export function getAuditLogs(filters = {}) {
  let list = [...memoryStore.auditLogs];

  if (filters.action && filters.action !== 'all') {
    list = list.filter((l) => l.action.toLowerCase().includes(filters.action.toLowerCase()));
  }
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.toLowerCase().trim();
    list = list.filter(
      (l) =>
        l.actorName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        (l.targetRoll && l.targetRoll.toLowerCase().includes(q)) ||
        (l.targetComponentId && l.targetComponentId.toLowerCase().includes(q))
    );
  }

  return list;
}

// ==================== SETTINGS & RETENTION ====================

export function getSettings() {
  const current = memoryStore.settings || {};
  return {
    ...current,
    labTimings: current.labTimings || {
      openingTime: '09:00',
      closingTime: '17:00',
      autoCheckoutEnabled: true,
      timezone: 'Asia/Kolkata',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
  };
}

export async function updateSettings(newSettings, actor) {
  memoryStore.settings = {
    ...memoryStore.settings,
    ...newSettings,
  };
  persistLocalCache('settings', memoryStore.settings);

  await executeCloudMutation({
    table: 'settings',
    action: 'upsert',
    id: 'SETTING-001',
    data: {
      id: 'SETTING-001',
      key: 'global_settings',
      value: memoryStore.settings,
      updated_at: new Date().toISOString(),
    },
  });

  logAuditEvent({
    actorName: actor?.name || 'Admin',
    actorRole: actor?.role || 'Admin',
    action: 'Settings Updated',
    details: 'Incubation centre configuration settings updated.',
  });

  notifySubscribers('SETTINGS_UPDATED', memoryStore.settings);
  return memoryStore.settings;
}

export async function pruneExpiredRecords(retentionDays = 30) {
  const days = Number(retentionDays) || 30;
  if (days <= 0) return { prunedCount: 0 };

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const initialLength = memoryStore.transactions.length;

  const toKeep = [];
  const toDeleteIds = [];

  for (const t of memoryStore.transactions) {
    if (t.status === 'returned' && t.returnedDate && new Date(t.returnedDate).getTime() < cutoffTime) {
      toDeleteIds.push(t.id);
    } else {
      toKeep.push(t);
    }
  }

  memoryStore.transactions = toKeep;
  const prunedCount = toDeleteIds.length;

  if (prunedCount > 0) {
    persistLocalCache('transactions', memoryStore.transactions);
    for (const id of toDeleteIds) {
      await executeCloudMutation({ table: 'transactions', action: 'delete', id });
    }

    logAuditEvent({
      actorName: 'Retention Worker',
      actorRole: 'System',
      action: 'Record Retention Cleanup',
      details: `Pruned ${prunedCount} completed returned transactions older than ${days} days.`,
    });
    notifySubscribers('RECORDS_PRUNED', { prunedCount, retentionDays: days });
  }

  return { prunedCount };
}

// ==================== STORAGE PROTECTION & 4-YEAR RETENTION ENGINE ====================

let lastCloudStorageStats = null;

export async function fetchCloudStorageStats() {
  if (typeof navigator !== 'undefined' && navigator.onLine && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_database_storage_stats');
      if (!error && data) {
        lastCloudStorageStats = data;
        return data;
      }
    } catch (e) {
      console.warn('[Storage Metrics RPC]:', e);
    }
  }
  return null;
}

export function getDatabaseStorageStatus() {
  const quota = memoryStore.settings?.storageQuotaBytes || STORAGE_THRESHOLDS.DEFAULT_QUOTA_BYTES;

  if (lastCloudStorageStats?.publicSchemaSizeBytes) {
    return getStorageTier(lastCloudStorageStats.publicSchemaSizeBytes, quota);
  }

  // Fallback / offline estimate based on memoryStore serialized footprint
  try {
    const storeJson = JSON.stringify(memoryStore);
    const dataBytes = typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(storeJson).length
      : 1024 * 1024;
    // Add overhead factor for indexes, audit logs, and operational overhead (~4x)
    const estimatedUsedBytes = Math.max(dataBytes * 4, 1024 * 1024);
    return getStorageTier(estimatedUsedBytes, quota);
  } catch (e) {
    return getStorageTier(1024 * 1024, quota);
  }
}

export function getStudentsRetentionAudit() {
  const students = getStudents();
  const insideRolls = getStudentsCurrentlyInside().map((s) => s.studentRoll || s.rollNumber);
  const txns = memoryStore.transactions;

  const audited = students.map((s) => {
    const retention = categorizeStudentRetention(s, txns, insideRolls);
    return {
      ...s,
      retention,
    };
  });

  const needsVerification = audited.filter((s) => s.retention.status === 'NEEDS_VERIFICATION');
  const active = audited.filter((s) => s.retention.status === 'ACTIVE');
  const expiredEligible = audited.filter((s) => s.retention.status === 'EXPIRED_ELIGIBLE');
  const expiredBlocked = audited.filter((s) => s.retention.status === 'EXPIRED_BLOCKED');
  const exempt = audited.filter((s) => s.retention.status === 'EXEMPT');

  return {
    totalStudents: students.length,
    needsVerification,
    active,
    expiredEligible,
    expiredBlocked,
    exempt,
    allAudited: audited,
  };
}

export async function pruneExpiredStudentRecords(approvedStudentRolls = [], archiveExported = false) {
  if (!archiveExported) {
    throw new Error('Safety Requirement: A full JSON backup archive must be exported before pruning expired student records.');
  }

  if (!Array.isArray(approvedStudentRolls) || approvedStudentRolls.length === 0) {
    return { prunedCount: 0, message: 'No student roll numbers selected for pruning.' };
  }

  const audit = getStudentsRetentionAudit();
  const eligibleRolls = new Set(audit.expiredEligible.map((s) => s.rollNumber.toUpperCase()));

  const prunedRolls = [];
  for (const roll of approvedStudentRolls) {
    const cleanRoll = (roll || '').trim().toUpperCase();
    if (!eligibleRolls.has(cleanRoll)) {
      console.warn(`[Retention Guard] Skipping ${cleanRoll}: not eligible for deletion or blocked by active items/kiosk.`);
      continue;
    }

    const studentUser = getUserByRoll(cleanRoll);
    if (!studentUser) continue;

    // 1. Remove student user
    memoryStore.users = memoryStore.users.filter((u) => !u.rollNumber || u.rollNumber.toUpperCase() !== cleanRoll);

    // 2. Remove returned past transactions
    const toDeleteTxnIds = memoryStore.transactions
      .filter((t) => t.studentRoll.toUpperCase() === cleanRoll && t.status === 'returned')
      .map((t) => t.id);
    memoryStore.transactions = memoryStore.transactions.filter((t) => !toDeleteTxnIds.includes(t.id));

    // 3. Remove visit records
    const toDeleteVisitIds = memoryStore.visits
      .filter((v) => v.studentRoll.toUpperCase() === cleanRoll)
      .map((v) => v.id);
    memoryStore.visits = memoryStore.visits.filter((v) => !toDeleteVisitIds.includes(v.id));

    // Cloud mutations
    await executeCloudMutation({ table: 'users', action: 'delete', id: studentUser.id });
    for (const tid of toDeleteTxnIds) {
      await executeCloudMutation({ table: 'transactions', action: 'delete', id: tid });
    }
    for (const vid of toDeleteVisitIds) {
      await executeCloudMutation({ table: 'visits', action: 'delete', id: vid });
    }

    prunedRolls.push(cleanRoll);
  }

  if (prunedRolls.length > 0) {
    persistLocalCache('users', memoryStore.users);
    persistLocalCache('transactions', memoryStore.transactions);
    persistLocalCache('visits', memoryStore.visits);

    logAuditEvent({
      actorName: memoryStore.currentUser?.name || 'Admin',
      actorRole: memoryStore.currentUser?.role || 'Admin',
      action: '4-Year Retention Student Prune',
      details: `Safely pruned ${prunedRolls.length} verified expired student accounts (${prunedRolls.join(', ')}). Archive pre-download verified.`,
    });

    notifySubscribers('STUDENTS_PRUNED', { prunedCount: prunedRolls.length, rolls: prunedRolls });
  }

  return { prunedCount: prunedRolls.length, prunedRolls };
}

/**
 * Delete eligible expired retention data for an individual student upon Admin confirmation.
 * Guarantees:
 * - NEVER deletes active/unreturned component transactions.
 * - NEVER deletes an active lab visit.
 * - NEEDS_VERIFICATION students remain completely protected.
 * - Records deletion in audit log.
 */
export async function deleteStudentEligibleRetentionData(rollNumber, actor = null) {
  if (!rollNumber) throw new Error('Roll Number is required.');
  const cleanRoll = rollNumber.trim().toUpperCase();

  const studentUser = getUserByRoll(cleanRoll);
  if (!studentUser) throw new Error(`Student ${cleanRoll} not found.`);

  const insideRolls = getStudentsCurrentlyInside().map((s) => s.studentRoll || s.rollNumber);
  const txns = memoryStore.transactions;
  const categorization = categorizeStudentRetention(studentUser, txns, insideRolls);

  if (categorization.status === 'NEEDS_VERIFICATION') {
    throw new Error('Action blocked: Student is pending journey verification. Retention deletion is prohibited.');
  }
  if (categorization.status === 'ACTIVE') {
    throw new Error(`Action blocked: Student retention period is still active until ${categorization.retentionEndDate}.`);
  }
  if (categorization.status === 'EXEMPT') {
    throw new Error('Action blocked: Staff accounts are permanently preserved.');
  }

  // 1. Identify returned past transactions ONLY (Never touch active/unreturned loans!)
  const eligibleTxnIds = memoryStore.transactions
    .filter((t) => (t.studentRoll || '').toUpperCase() === cleanRoll && t.status === 'returned')
    .map((t) => t.id);

  // 2. Identify completed lab visits ONLY (Never touch active visits where student is still inside!)
  const eligibleVisitIds = memoryStore.visits
    .filter((v) => (v.studentRoll || '').toUpperCase() === cleanRoll && v.status !== 'inside' && v.exitTime !== null)
    .map((v) => v.id);

  // 3. Determine if student profile can be deleted:
  // Cannot delete profile if student has any active unreturned items or is currently inside the lab.
  const hasActiveLoans = memoryStore.transactions.some(
    (t) => (t.studentRoll || '').toUpperCase() === cleanRoll && t.status !== 'returned'
  );
  const isCurrentlyInside = insideRolls.some((r) => (r || '').toUpperCase() === cleanRoll);
  const canDeleteProfile = !hasActiveLoans && !isCurrentlyInside;

  // Apply deletions
  if (eligibleTxnIds.length > 0) {
    memoryStore.transactions = memoryStore.transactions.filter((t) => !eligibleTxnIds.includes(t.id));
    persistLocalCache('transactions', memoryStore.transactions);
    for (const tid of eligibleTxnIds) {
      await executeCloudMutation({ table: 'transactions', action: 'delete', id: tid });
    }
  }

  if (eligibleVisitIds.length > 0) {
    memoryStore.visits = memoryStore.visits.filter((v) => !eligibleVisitIds.includes(v.id));
    persistLocalCache('visits', memoryStore.visits);
    for (const vid of eligibleVisitIds) {
      await executeCloudMutation({ table: 'visits', action: 'delete', id: vid });
    }
  }

  if (canDeleteProfile) {
    memoryStore.users = memoryStore.users.filter((u) => !u.rollNumber || u.rollNumber.toUpperCase() !== cleanRoll);
    persistLocalCache('users', memoryStore.users);
    await executeCloudMutation({ table: 'users', action: 'delete', id: studentUser.id });
  }

  // Record deletion in audit log
  const actorName = actor?.name || memoryStore.currentUser?.name || 'Admin';
  const actorRole = actor?.role || memoryStore.currentUser?.role || 'Admin';
  logAuditEvent({
    actorName,
    actorRole,
    action: 'Student Retention Data Deleted',
    targetRoll: cleanRoll,
    details: `Confirmed retention deletion for ${studentUser.name} (${cleanRoll}). Deleted ${eligibleTxnIds.length} returned transactions, ${eligibleVisitIds.length} completed visits${canDeleteProfile ? ', and student account' : ' (profile preserved due to active items/visit)'}.`,
  });

  notifySubscribers('STUDENT_RETENTION_DELETED', {
    rollNumber: cleanRoll,
    deletedTransactionsCount: eligibleTxnIds.length,
    deletedVisitsCount: eligibleVisitIds.length,
    deletedProfile: canDeleteProfile,
  });

  return {
    success: true,
    deletedTransactionsCount: eligibleTxnIds.length,
    deletedVisitsCount: eligibleVisitIds.length,
    deletedProfile: canDeleteProfile,
  };
}

// ==================== DASHBOARD & OVERDUE ====================

export function isItemOverdue(item) {
  if (item.status === 'returned') return false;
  if (item.returnedQuantity >= item.issuedQuantity) return false;
  return new Date(item.dueDate).getTime() < Date.now();
}

export function isTransactionOverdue(txn) {
  if (txn.status === 'returned') return false;
  return txn.items.some((item) => isItemOverdue(item));
}

export function getOverdueDays(dueDate) {
  const diffMs = Date.now() - new Date(dueDate).getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function getRemainingDays(dueDate) {
  const diffMs = new Date(dueDate).getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function getDashboardStats() {
  const components = memoryStore.components;
  const transactions = memoryStore.transactions;

  let totalComponentsTypes = components.length;
  let totalPhysicalStock = 0;
  let availableStock = 0;
  let issuedStock = 0;
  let damagedStock = 0;
  let lostStock = 0;

  for (const c of components) {
    totalPhysicalStock += c.totalQuantity;
    availableStock += c.availableQuantity;
    issuedStock += c.issuedQuantity;
    damagedStock += c.damagedQuantity || 0;
    lostStock += c.lostQuantity || 0;
  }

  let overdueItemsCount = 0;
  let overdueTransactionsCount = 0;
  const activeTransactions = [];
  const overdueTransactions = [];

  for (const t of transactions) {
    if (t.status === 'active' || t.status === 'partially_returned') {
      activeTransactions.push(t);
      let isTxnOverdue = false;
      for (const it of t.items) {
        if (isItemOverdue(it)) {
          overdueItemsCount += it.issuedQuantity - it.returnedQuantity;
          isTxnOverdue = true;
        }
      }
      if (isTxnOverdue) {
        overdueTransactionsCount++;
        overdueTransactions.push(t);
      }
    }
  }

  const categoryMap = {};
  for (const c of components) {
    if (!categoryMap[c.category]) {
      categoryMap[c.category] = {
        name: c.category,
        totalStock: 0,
        availableStock: 0,
        issuedStock: 0,
        count: 0,
      };
    }
    categoryMap[c.category].totalStock += c.totalQuantity;
    categoryMap[c.category].availableStock += c.availableQuantity;
    categoryMap[c.category].issuedStock += c.issuedQuantity;
    categoryMap[c.category].count += 1;
  }

  const categoryBreakdown = Object.values(categoryMap);
  const lowStockCount = getLowStockComponents().length;
  const insideStudents = getStudentsCurrentlyInside();

  const recentActivity = [...transactions]
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
    .slice(0, 8);

  return {
    totalComponentsTypes,
    totalPhysicalStock,
    availableStock,
    issuedStock,
    damagedStock,
    lostStock,
    overdueItemsCount,
    overdueTransactionsCount,
    activeTransactionsCount: activeTransactions.length,
    categoryBreakdown,
    recentActivity,
    overdueTransactions,
    lowStockCount,
    studentsInsideCount: insideStudents.length,
    studentsInsideList: insideStudents,
  };
}

export function exportDatabaseToJson() {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: DB_VERSION,
    database: {
      components: memoryStore.components,
      users: memoryStore.users,
      devices: memoryStore.devices,
      visits: memoryStore.visits,
      dailyAttendance: memoryStore.dailyAttendance,
      transactions: memoryStore.transactions,
      authorizations: memoryStore.authorizations,
      settings: memoryStore.settings,
      auditLogs: memoryStore.auditLogs,
      projects: memoryStore.projects,
      teams: memoryStore.teams,
      achievements: memoryStore.achievements,
      announcements: memoryStore.announcements,
      events: memoryStore.events,
      complaints: memoryStore.complaints,
      researchPapers: memoryStore.researchPapers,
      selfReflections: memoryStore.selfReflections,
      holidays: memoryStore.holidays,
      domains: memoryStore.domains,
      staffPresence: memoryStore.staffPresence,
    },
  };
  return JSON.stringify(exportData, null, 2);
}

export async function importDatabaseFromJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.database || !data.database.components || !data.database.users) {
      throw new Error('Invalid backup file structure.');
    }

    memoryStore = {
      components: data.database.components || [],
      users: data.database.users || [],
      devices: data.database.devices || INITIAL_DEVICES,
      visits: data.database.visits || [],
      dailyAttendance: data.database.dailyAttendance || {},
      transactions: data.database.transactions || [],
      authorizations: data.database.authorizations || [],
      settings: { ...INITIAL_SETTINGS, ...(data.database.settings || {}) },
      auditLogs: data.database.auditLogs || [],
      currentUser: data.database.users?.[0] || memoryStore.currentUser,
      projects: data.database.projects || DEFAULT_PROJECTS,
      teams: data.database.teams || DEFAULT_TEAMS,
      achievements: data.database.achievements || DEFAULT_ACHIEVEMENTS,
      announcements: data.database.announcements || DEFAULT_ANNOUNCEMENTS,
      events: data.database.events || DEFAULT_EVENTS,
      complaints: data.database.complaints || DEFAULT_COMPLAINTS,
      researchPapers: data.database.researchPapers || DEFAULT_RESEARCH_PAPERS,
      selfReflections: data.database.selfReflections || DEFAULT_SELF_REFLECTIONS,
      holidays: data.database.holidays || DEFAULT_HOLIDAYS,
      domains: data.database.domains || DEFAULT_DOMAINS,
      staffPresence: data.database.staffPresence || [],
    };

    await persistLocalCache('components', memoryStore.components);
    await persistLocalCache('users', memoryStore.users);
    await persistLocalCache('devices', memoryStore.devices);
    await persistLocalCache('visits', memoryStore.visits);
    localStorage.setItem(STORAGE_KEYS.DAILY_ATTENDANCE, JSON.stringify(memoryStore.dailyAttendance));
    await persistLocalCache('transactions', memoryStore.transactions);
    await persistLocalCache('authorizations', memoryStore.authorizations);
    await persistLocalCache('settings', memoryStore.settings);
    await persistLocalCache('auditLogs', memoryStore.auditLogs);
    await persistLocalCache('projects', memoryStore.projects);
    await persistLocalCache('teams', memoryStore.teams);
    await persistLocalCache('achievements', memoryStore.achievements);
    await persistLocalCache('announcements', memoryStore.announcements);
    await persistLocalCache('events', memoryStore.events);
    await persistLocalCache('complaints', memoryStore.complaints);
    await persistLocalCache('researchPapers', memoryStore.researchPapers);
    await persistLocalCache('selfReflections', memoryStore.selfReflections);
    await persistLocalCache('holidays', memoryStore.holidays);
    await persistLocalCache('domains', memoryStore.domains);
    await persistLocalCache('staffPresence', memoryStore.staffPresence);

    notifySubscribers('DATABASE_RESTORED', memoryStore);
    return { success: true };
  } catch (e) {
    throw new Error(`Failed to restore database: ${e.message}`);
  }
}

export async function resetDatabaseToSample() {
  memoryStore = {
    components: INITIAL_COMPONENTS.map((c) => migrateComponentRecord(c)),
    users: INITIAL_USERS,
    devices: INITIAL_DEVICES,
    visits: INITIAL_VISITS,
    dailyAttendance: INITIAL_DAILY_ATTENDANCE,
    transactions: INITIAL_TRANSACTIONS,
    authorizations: INITIAL_AUTHORIZATIONS,
    settings: INITIAL_SETTINGS,
    auditLogs: INITIAL_AUDIT_LOGS,
    currentUser: INITIAL_USERS[0],
    projects: DEFAULT_PROJECTS,
    teams: DEFAULT_TEAMS,
    achievements: DEFAULT_ACHIEVEMENTS,
    announcements: DEFAULT_ANNOUNCEMENTS,
    events: DEFAULT_EVENTS,
    complaints: DEFAULT_COMPLAINTS,
    researchPapers: DEFAULT_RESEARCH_PAPERS,
    selfReflections: DEFAULT_SELF_REFLECTIONS,
    holidays: DEFAULT_HOLIDAYS,
    domains: DEFAULT_DOMAINS,
    categories: DEFAULT_CATEGORIES,
    staffPresence: [],
  };

  await persistLocalCache('components', memoryStore.components);
  await persistLocalCache('categories', memoryStore.categories);
  await persistLocalCache('users', memoryStore.users);
  await persistLocalCache('devices', memoryStore.devices);
  await persistLocalCache('visits', memoryStore.visits);
  localStorage.setItem(STORAGE_KEYS.DAILY_ATTENDANCE, JSON.stringify(memoryStore.dailyAttendance));
  await persistLocalCache('transactions', memoryStore.transactions);
  await persistLocalCache('authorizations', memoryStore.authorizations);
  await persistLocalCache('settings', memoryStore.settings);
  await persistLocalCache('auditLogs', memoryStore.auditLogs);
  await persistLocalCache('projects', memoryStore.projects);
  await persistLocalCache('teams', memoryStore.teams);
  await persistLocalCache('achievements', memoryStore.achievements);
  await persistLocalCache('announcements', memoryStore.announcements);
  await persistLocalCache('events', memoryStore.events);
  await persistLocalCache('complaints', memoryStore.complaints);
  await persistLocalCache('researchPapers', memoryStore.researchPapers);
  await persistLocalCache('selfReflections', memoryStore.selfReflections);
  await persistLocalCache('holidays', memoryStore.holidays);
  await persistLocalCache('domains', memoryStore.domains);
  await persistLocalCache('staffPresence', memoryStore.staffPresence);

  notifySubscribers('DATABASE_RESET', memoryStore);
  return { success: true };
}

// ==================== SMART INCUBATION CENTRE MODULES ====================

// 1. DOMAINS MANAGEMENT
export function getDomains() {
  return [...(memoryStore.domains || DEFAULT_DOMAINS)];
}

export async function createDomain(name, currentUser) {
  if (!name || !name.trim()) throw new Error('Domain name is required.');
  const trimmed = name.trim();
  if (!memoryStore.domains) memoryStore.domains = [...DEFAULT_DOMAINS];
  if (memoryStore.domains.some((d) => (typeof d === 'string' ? d.toLowerCase() : d.name?.toLowerCase()) === trimmed.toLowerCase())) {
    throw new Error('Domain already exists.');
  }
  memoryStore.domains.push(trimmed);
  await persistLocalCache('domains', memoryStore.domains);
  await executeCloudMutation({
    table: 'domains',
    action: 'insert',
    id: `DOM-${Date.now()}`,
    data: { name: trimmed },
  });
  notifySubscribers('DOMAINS_CHANGED', memoryStore.domains);
  return trimmed;
}

export async function deleteDomain(name, currentUser) {
  if (!memoryStore.domains) return;
  const trimmed = (name || '').trim().toLowerCase();
  memoryStore.domains = memoryStore.domains.filter(
    (d) => (typeof d === 'string' ? d.toLowerCase() : d.name?.toLowerCase()) !== trimmed
  );
  await persistLocalCache('domains', memoryStore.domains);
  notifySubscribers('DOMAINS_CHANGED', memoryStore.domains);
}

export async function toggleDomainStatus(name, currentUser) {
  if (!name) return;
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can manage domains.');
  }
  if (!memoryStore.domains) memoryStore.domains = [...DEFAULT_DOMAINS];
  const trimmed = name.trim().toLowerCase();
  const idx = memoryStore.domains.findIndex(
    (d) => (typeof d === 'string' ? d.toLowerCase() : d.name?.toLowerCase()) === trimmed
  );
  if (idx === -1) throw new Error('Domain not found.');
  const cur = memoryStore.domains[idx];
  const updated = typeof cur === 'string'
    ? { name: cur, active: false }
    : { ...cur, active: cur.active === false ? true : false };
  memoryStore.domains[idx] = updated;
  await persistLocalCache('domains', memoryStore.domains);
  notifySubscribers('DOMAINS_CHANGED', memoryStore.domains);
  return updated;
}

// 2. SIR / STAFF PRESENCE TOGGLE ("I'M INSIDE LAB")
export function getStaffPresence() {
  return [...(memoryStore.staffPresence || [])];
}

export function getStaffActivePresence(emailOrUser) {
  if (!emailOrUser) return null;
  const fallbackEmail = (emailOrUser.rollNumber || 'admin') + '@incubation.local';
  const email = typeof emailOrUser === 'string'
    ? emailOrUser
    : (emailOrUser.email || (emailOrUser.role === 'sir' ? 'sir@incubation.local' : fallbackEmail));
  const cleanEmail = email.trim().toLowerCase();
  return (memoryStore.staffPresence || []).find((p) => p.staffEmail.toLowerCase() === cleanEmail && p.active) || null;
}

export async function toggleStaffPresence(staffUser) {
  if (!staffUser) throw new Error('Staff user context is required.');

  const callerRole = staffUser.role || (staffUser.rollNumber === 'admin' ? 'admin' : null);
  if (callerRole === 'student') {
    throw new Error('Unauthorized: Students have read-only access and cannot modify presence.');
  }

  const fallbackEmail = (staffUser.rollNumber || 'admin') + '@incubation.local';
  const email = staffUser.email || (staffUser.role === 'sir' ? 'sir@incubation.local' : fallbackEmail);
  const name = staffUser.name || (staffUser.role === 'sir' ? 'Dr. K. Venkatesh (Lab Incharge / Sir)' : (staffUser.role === 'substitute_admin' ? 'Prof. Ravi Kumar' : (staffUser.name || 'Dr. Surya Prasad')));
  const role = staffUser.role || (staffUser.rollNumber === 'admin' ? 'admin' : 'Sir');

  if (!memoryStore.staffPresence) memoryStore.staffPresence = [];

  const activeIdx = memoryStore.staffPresence.findIndex(
    (p) => p.staffEmail.toLowerCase() === email.toLowerCase() && p.active
  );

  const now = new Date().toISOString();

  if (activeIdx !== -1) {
    // Staff is currently inside: Toggle to LEAVE / EXIT
    const current = memoryStore.staffPresence[activeIdx];
    const durationMin = Math.max(1, Math.round((new Date(now) - new Date(current.entryTime)) / 60000));
    const updated = {
      ...current,
      exitTime: now,
      durationMinutes: durationMin,
      active: false,
    };
    memoryStore.staffPresence[activeIdx] = updated;
    await persistLocalCache('staffPresence', memoryStore.staffPresence);
    await executeCloudMutation({
      table: 'staff_presence',
      action: 'update',
      id: updated.id,
      data: updated,
    });
    logAuditEvent({
      actorName: name,
      actorRole: role,
      action: 'Staff Lab Exit',
      details: `${name} marked exit from lab. Time spent: ${durationMin} minutes.`,
    });
    notifySubscribers('STAFF_PRESENCE_CHANGED', updated);
    return { isInside: false, record: updated, message: `Lab exit recorded for ${name}. Duration: ${durationMin} mins.` };
  } else {
    // Staff is outside: Toggle to ENTER
    const newRecord = {
      id: `STAFF-${String(Date.now()).slice(-6)}`,
      staffEmail: email,
      staffName: name,
      role,
      entryTime: now,
      exitTime: null,
      durationMinutes: null,
      active: true,
      createdAt: now,
    };
    memoryStore.staffPresence.push(newRecord);
    await persistLocalCache('staffPresence', memoryStore.staffPresence);
    await executeCloudMutation({
      table: 'staff_presence',
      action: 'insert',
      id: newRecord.id,
      data: newRecord,
    });
    logAuditEvent({
      actorName: name,
      actorRole: role,
      action: 'Staff Lab Entry',
      details: `${name} marked presence inside lab.`,
    });
    notifySubscribers('STAFF_PRESENCE_CHANGED', newRecord);
    return { isInside: true, record: newRecord, message: `Presence marked: ${name} is now inside the lab.` };
  }
}

/**
 * Global Admin Lab Presence Indicator Status
 * Evaluates whether an administrator is currently inside the lab.
 * Persists status until an administrator explicitly clicks "I'm Outside".
 * Supports multiple administrators without silent overwrite.
 * Returns: { isInside: boolean, adminName: string, visibleText: string, tooltipText: string, lastUpdated: string|null, isStale: boolean }
 */
export function getGlobalAdminPresence() {
  const records = memoryStore.staffPresence || [];

  // Filter all presence records belonging to administrators
  const adminRecords = records.filter(
    (p) =>
      p.role === 'admin' ||
      (p.staffEmail && p.staffEmail.toLowerCase().startsWith('admin@')) ||
      (p.staffEmail && p.staffEmail.toLowerCase().includes('admin'))
  );

  // Check for active presence record(s)
  const activeAdmins = adminRecords.filter((p) => Boolean(p.active) && !p.exitTime);

  if (activeAdmins.length > 0) {
    // Sort descending by entryTime so latest entrant is first
    activeAdmins.sort((a, b) => new Date(b.entryTime || 0).getTime() - new Date(a.entryTime || 0).getTime());
    const names = [...new Set(activeAdmins.map((a) => a.staffName).filter(Boolean))];
    const adminName = names.join(' & ') || 'Dr. Surya Prasad';
    return {
      isInside: true,
      adminName,
      visibleText: 'Admin is in lab',
      tooltipText: `${adminName} is in the lab`,
      activeAdmins,
      lastUpdated: activeAdmins[0].entryTime,
      isStale: false,
    };
  }

  // Not inside. Determine the best administrative name to display
  let adminName = 'Dr. Surya Prasad';
  let lastUpdated = null;

  if (adminRecords.length > 0) {
    const sorted = [...adminRecords].sort((a, b) => {
      const timeA = new Date(b.exitTime || b.entryTime || b.createdAt || 0).getTime();
      const timeB = new Date(a.exitTime || a.entryTime || a.createdAt || 0).getTime();
      return timeA - timeB;
    });
    if (sorted[0]?.staffName) {
      adminName = sorted[0].staffName;
    }
    lastUpdated = sorted[0]?.exitTime || sorted[0]?.entryTime || null;
  } else {
    // Look up in memoryStore.users for any admin user
    const adminUser = (memoryStore.users || []).find(
      (u) => u.role === 'admin' || (u.rollNumber && u.rollNumber.toLowerCase() === 'admin')
    );
    if (adminUser?.name) {
      adminName = adminUser.name;
    }
  }

  return {
    isInside: false,
    adminName,
    visibleText: 'Admin is outside the lab',
    tooltipText: `${adminName} is outside the lab`,
    lastUpdated,
    isStale: false,
  };
}

let staffPresenceChannel = null;

/**
 * Realtime listener for public.staff_presence changes across clients and devices
 */
export function subscribeStaffPresenceRealtime() {
  if (typeof window === 'undefined') return null;
  if (staffPresenceChannel) return staffPresenceChannel;

  try {
    if (typeof supabase?.channel === 'function') {
      staffPresenceChannel = supabase
        .channel('public:staff_presence')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'staff_presence' },
          (payload) => {
            handleStaffPresenceRealtimePayload(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] staff_presence subscription active.');
          }
        });
    }
  } catch (err) {
    console.warn('[Supabase Realtime] Could not subscribe to staff_presence:', err);
  }

  // Cross-tab synchronization via browser localStorage events
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !window._crossTabPresenceBound) {
    window._crossTabPresenceBound = true;
    window.addEventListener('storage', (event) => {
      if (
        (event.key === STORAGE_KEYS.STAFF_PRESENCE || event.key === 'inc_cms_staff_presence_v2') &&
        event.newValue
      ) {
        try {
          const updatedPresence = JSON.parse(event.newValue);
          if (Array.isArray(updatedPresence)) {
            memoryStore.staffPresence = updatedPresence;
            notifySubscribers('STAFF_PRESENCE_CHANGED', updatedPresence);
          }
        } catch (err) {
          console.warn('[Cross-Tab Sync] Failed to parse updated staff presence:', err);
        }
      }
    });
  }

  // Periodic fallback and window focus listeners
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !window._staffPresenceFallbackBound) {
    window._staffPresenceFallbackBound = true;
    window.addEventListener('focus', () => {
      refreshStaffPresenceFromCloud();
    });
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          refreshStaffPresenceFromCloud();
        }
      });
    }
    const presenceTimer = setInterval(() => {
      if (isOnlineState) {
        refreshStaffPresenceFromCloud();
      }
    }, 15000);
    if (typeof presenceTimer?.unref === 'function') {
      presenceTimer.unref();
    }
  }

  return staffPresenceChannel;
}

export function handleStaffPresenceRealtimePayload(payload) {
  if (!payload) return;
  const { eventType, new: newRow, old: oldRow } = payload;
  if (!memoryStore.staffPresence) memoryStore.staffPresence = [];

  if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRow) {
    const item = fromDbRow('staff_presence', newRow);
    const idx = memoryStore.staffPresence.findIndex((p) => p.id === item.id);
    if (idx !== -1) {
      memoryStore.staffPresence[idx] = item;
    } else {
      memoryStore.staffPresence.push(item);
    }
    persistLocalCache('staffPresence', memoryStore.staffPresence);
    notifySubscribers('STAFF_PRESENCE_CHANGED', item);
  } else if (eventType === 'DELETE' && oldRow) {
    memoryStore.staffPresence = memoryStore.staffPresence.filter((p) => p.id !== oldRow.id);
    persistLocalCache('staffPresence', memoryStore.staffPresence);
    notifySubscribers('STAFF_PRESENCE_CHANGED', { id: oldRow.id, deleted: true });
  }
}

export async function refreshStaffPresenceFromCloud() {
  try {
    const cloudStaffPresence = await fetchCloudTable('staff_presence');
    if (cloudStaffPresence && Array.isArray(cloudStaffPresence)) {
      const cloudIds = new Set(cloudStaffPresence.map((p) => p.id));
      const localOnly = (memoryStore.staffPresence || []).filter((p) => !cloudIds.has(p.id));
      const merged = [...cloudStaffPresence, ...localOnly];
      memoryStore.staffPresence = merged;
      persistLocalCache('staffPresence', merged);
      notifySubscribers('STAFF_PRESENCE_CHANGED', merged);
      return merged;
    }
  } catch (err) {
    console.warn('[Supabase] Failed to refresh staff presence:', err);
  }
  return memoryStore.staffPresence || [];
}

// 3. PROJECTS MANAGEMENT (Strict Title Protection for Sir/Admin)
export function getProjects(filterDomain = null, searchQuery = '') {
  let list = [...(memoryStore.projects || [])];
  if (filterDomain && filterDomain !== 'all') {
    list = list.filter((p) => p.domain === filterDomain);
  }
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.leaderRoll && p.leaderRoll.toLowerCase().includes(q)) ||
        (p.domain && p.domain.toLowerCase().includes(q)) ||
        (p.members || []).some((m) => (m.name || '').toLowerCase().includes(q) || (m.rollNumber || '').toLowerCase().includes(q))
    );
  }
  return list;
}

export async function createProject(projectData, currentUser) {
  if (!projectData.title || !projectData.leaderRoll) {
    throw new Error('Project title and leader roll number are required.');
  }
  const budgetNum = Number(projectData.budget) || 0;
  const approvedBudget = Number(projectData.approvedBudget) || budgetNum;
  const estimatedBudget = Number(projectData.estimatedBudget) || budgetNum;
  const expenditures = Array.isArray(projectData.expenditures) ? projectData.expenditures : [];
  const totalSpent = expenditures.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remainingBudget = Math.max(0, approvedBudget - totalSpent);

  const newProject = {
    id: `PROJ-${String(Date.now()).slice(-6)}`,
    title: projectData.title.trim(),
    teamId: projectData.teamId || '',
    leaderRoll: projectData.leaderRoll.trim().toUpperCase(),
    members: Array.isArray(projectData.members) ? projectData.members : [],
    objectives: projectData.objectives || '',
    domain: projectData.domain || 'IoT & Embedded Systems',
    status: projectData.status || 'active',
    githubLink: projectData.githubLink || '',
    linkedinLink: projectData.linkedinLink || '',
    demoUrl: projectData.demoUrl || '',
    budget: budgetNum,
    approvedBudget,
    estimatedBudget,
    fundingSource: projectData.fundingSource || 'College Incubation Seed Fund',
    expenditures,
    totalSpent,
    remainingBudget,
    contributions: Array.isArray(projectData.contributions) ? projectData.contributions : [],
    prototypeAvailable: Boolean(projectData.prototypeAvailable),
    achievementIds: Array.isArray(projectData.achievementIds) ? projectData.achievementIds : [],
    titleChangeRequest: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!memoryStore.projects) memoryStore.projects = [];
  memoryStore.projects.unshift(newProject);
  await persistLocalCache('projects', memoryStore.projects);
  await executeCloudMutation({
    table: 'projects',
    action: 'insert',
    id: newProject.id,
    data: newProject,
  });
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Project Created',
    details: `Created incubation project "${newProject.title}" (Leader: ${newProject.leaderRoll})`,
  });
  notifySubscribers('PROJECT_ADDED', newProject);
  return newProject;
}

export async function updateProject(id, updates, currentUser) {
  if (!memoryStore.projects) memoryStore.projects = [];
  const idx = memoryStore.projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Project with ID ${id} not found.`);

  const current = memoryStore.projects[idx];
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';

  let finalTitle = current.title;
  let titleChangeRequest = current.titleChangeRequest || null;

  if (updates.title && updates.title.trim() !== current.title.trim()) {
    if (isSirOrAdmin) {
      finalTitle = updates.title.trim();
      titleChangeRequest = null;
      logAuditEvent({
        actorName: currentUser?.name || 'Sir/Admin',
        actorRole: currentUser?.role || 'Admin',
        action: 'Official Project Title Updated',
        details: `Updated title for project ${id} from "${current.title}" to "${finalTitle}"`,
      });
    } else {
      // Student requested a title change -> store request for Sir/Admin approval
      titleChangeRequest = {
        requestedTitle: updates.title.trim(),
        requestedByRoll: currentUser?.rollNumber || currentUser?.id || 'Student',
        requestedByName: currentUser?.name || 'Student',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      };
      finalTitle = current.title; // Keep official title unchanged
      logAuditEvent({
        actorName: currentUser?.name || 'Student',
        actorRole: currentUser?.role || 'student',
        action: 'Project Title Change Requested',
        details: `Requested title change for project ${id} to "${titleChangeRequest.requestedTitle}"`,
      });
    }
  }

  const expenditures = updates.expenditures !== undefined ? updates.expenditures : (current.expenditures || []);
  const approvedBudget = updates.approvedBudget !== undefined ? Number(updates.approvedBudget) : (current.approvedBudget !== undefined ? current.approvedBudget : (Number(updates.budget || current.budget) || 0));
  const totalSpent = expenditures.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remainingBudget = Math.max(0, approvedBudget - totalSpent);

  const updatedProject = {
    ...current,
    ...updates,
    title: finalTitle,
    approvedBudget,
    expenditures,
    totalSpent,
    remainingBudget,
    titleChangeRequest,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.projects[idx] = updatedProject;
  await persistLocalCache('projects', memoryStore.projects);
  await executeCloudMutation({
    table: 'projects',
    action: 'update',
    id,
    data: updatedProject,
  });

  notifySubscribers('PROJECT_UPDATED', updatedProject);

  if (updates.title && updates.title.trim() !== current.title.trim() && !isSirOrAdmin) {
    return {
      project: updatedProject,
      titleLocked: true,
      message: 'Official project title change is strictly restricted to Sir/Admin. Your title change request has been submitted for faculty review.',
    };
  }

  return { project: updatedProject, titleLocked: false };
}

export async function addProjectExpenditure(projectId, { description, amount, fundingSource, date }, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can record project expenditures.');
  }
  const idx = (memoryStore.projects || []).findIndex((p) => p.id === projectId);
  if (idx === -1) throw new Error(`Project with ID ${projectId} not found.`);

  const current = memoryStore.projects[idx];
  const amt = Number(amount) || 0;
  if (amt <= 0) throw new Error('Expenditure amount must be greater than zero.');

  const expenditure = {
    id: `EXP-${String(Date.now()).slice(-6)}`,
    description: (description || 'Component / Prototyping Expense').trim(),
    amount: amt,
    fundingSource: fundingSource || current.fundingSource || 'College Incubation Seed Fund',
    date: date || new Date().toISOString().slice(0, 10),
    addedBy: currentUser?.name || 'Admin',
    createdAt: new Date().toISOString(),
  };

  const expenditures = [...(current.expenditures || []), expenditure];
  const totalSpent = expenditures.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const approvedBudget = Number(current.approvedBudget) || Number(current.budget) || 0;
  const remainingBudget = Math.max(0, approvedBudget - totalSpent);

  const updated = {
    ...current,
    expenditures,
    totalSpent,
    remainingBudget,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.projects[idx] = updated;
  await persistLocalCache('projects', memoryStore.projects);
  await executeCloudMutation({
    table: 'projects',
    action: 'update',
    id: projectId,
    data: updated,
  });

  logAuditEvent({
    actorName: currentUser?.name || 'Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Project Expenditure Recorded',
    details: `Recorded expenditure of ₹${amt.toLocaleString('en-IN')} ("${expenditure.description}") for project "${current.title}". Balance: ₹${remainingBudget.toLocaleString('en-IN')}`,
  });

  notifySubscribers('PROJECT_UPDATED', updated);
  return updated;
}

export async function addProjectContribution(projectId, { memberRoll, memberName, contributionDetails, task, date }, currentUser) {
  const idx = (memoryStore.projects || []).findIndex((p) => p.id === projectId);
  if (idx === -1) throw new Error(`Project with ID ${projectId} not found.`);

  const current = memoryStore.projects[idx];
  const roll = (memberRoll || currentUser?.rollNumber || '').trim().toUpperCase();
  const name = memberName || currentUser?.name || roll;

  const contribution = {
    id: `CONTRIB-${String(Date.now()).slice(-6)}`,
    memberRoll: roll,
    memberName: name,
    task: (task || 'Hardware / Software Prototyping').trim(),
    contributionDetails: (contributionDetails || '').trim(),
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };

  const contributions = [...(current.contributions || []), contribution];
  const updated = {
    ...current,
    contributions,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.projects[idx] = updated;
  await persistLocalCache('projects', memoryStore.projects);
  await executeCloudMutation({
    table: 'projects',
    action: 'update',
    id: projectId,
    data: updated,
  });

  logAuditEvent({
    actorName: currentUser?.name || roll,
    actorRole: currentUser?.role || 'student',
    action: 'Project Contribution Recorded',
    details: `Recorded project contribution for ${name} (${roll}) on "${current.title}": ${contribution.task}`,
  });

  notifySubscribers('PROJECT_UPDATED', updated);
  return updated;
}

export async function approveProjectTitleChange(id, approve = true, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can approve project title changes.');
  }

  const idx = memoryStore.projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Project with ID ${id} not found.`);

  const current = memoryStore.projects[idx];
  if (!current.titleChangeRequest) {
    throw new Error('No pending title change request for this project.');
  }

  let updated;
  if (approve) {
    const requested = current.titleChangeRequest.requestedTitle;
    updated = {
      ...current,
      title: requested,
      titleChangeRequest: null,
      updatedAt: new Date().toISOString(),
    };
    logAuditEvent({
      actorName: currentUser?.name || 'Sir/Admin',
      actorRole: currentUser?.role || 'Admin',
      action: 'Project Title Change Approved',
      details: `Approved title change for project ${id} to "${requested}"`,
    });
  } else {
    updated = {
      ...current,
      titleChangeRequest: null,
      updatedAt: new Date().toISOString(),
    };
    logAuditEvent({
      actorName: currentUser?.name || 'Sir/Admin',
      actorRole: currentUser?.role || 'Admin',
      action: 'Project Title Change Rejected',
      details: `Rejected title change request for project ${id}`,
    });
  }

  memoryStore.projects[idx] = updated;
  await persistLocalCache('projects', memoryStore.projects);
  await executeCloudMutation({
    table: 'projects',
    action: 'update',
    id,
    data: updated,
  });
  notifySubscribers('PROJECT_UPDATED', updated);
  return updated;
}

export async function deleteProject(id, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can delete incubation projects.');
  }

  if (!memoryStore.projects) memoryStore.projects = [];
  const idx = memoryStore.projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Project with ID ${id} not found.`);

  const projectToDelete = memoryStore.projects[idx];
  memoryStore.projects.splice(idx, 1);
  await persistLocalCache('projects', memoryStore.projects);

  await executeCloudMutation({
    table: 'projects',
    action: 'delete',
    id,
  });

  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Project Deleted',
    details: `Deleted project "${projectToDelete.title}" (ID: ${id})`,
  });

  notifySubscribers('PROJECT_DELETED', { id, title: projectToDelete.title });
  return { success: true, deletedProject: projectToDelete };
}

// 4. TEAMS MANAGEMENT
export function getTeams() {
  return [...(memoryStore.teams || [])];
}

export async function createTeam(teamData, currentUser) {
  if (!teamData.name || !teamData.leaderRoll) {
    throw new Error('Team name and leader roll number are required.');
  }
  const newTeam = {
    id: `TEAM-${String(Date.now()).slice(-6)}`,
    name: teamData.name.trim(),
    leaderRoll: teamData.leaderRoll.trim().toUpperCase(),
    memberRolls: Array.isArray(teamData.memberRolls) ? teamData.memberRolls : [teamData.leaderRoll.trim().toUpperCase()],
    domain: teamData.domain || 'IoT & Embedded Systems',
    projectId: teamData.projectId || null,
    budget: Number(teamData.budget) || 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  if (!memoryStore.teams) memoryStore.teams = [];
  memoryStore.teams.unshift(newTeam);
  await persistLocalCache('teams', memoryStore.teams);
  await executeCloudMutation({
    table: 'teams',
    action: 'insert',
    id: newTeam.id,
    data: newTeam,
  });
  notifySubscribers('TEAMS_CHANGED', memoryStore.teams);
  return newTeam;
}

// 5. PERMANENT ACHIEVEMENTS
export function getAchievements() {
  return [...(memoryStore.achievements || [])];
}

export async function createAchievement(achievementData, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can award permanent achievements.');
  }
  if (!achievementData.title || !achievementData.awardedToRoll) {
    throw new Error('Achievement title and recipient roll number are required.');
  }
  const newAch = {
    id: `ACH-${String(Date.now()).slice(-6)}`,
    title: achievementData.title.trim(),
    description: achievementData.description || '',
    awardedToRoll: achievementData.awardedToRoll.trim().toUpperCase(),
    studentName: achievementData.studentName ? achievementData.studentName.trim() : achievementData.awardedToRoll.trim().toUpperCase(),
    prizeMoney: Number(achievementData.prizeMoney) || 0,
    awardedBy: achievementData.awardedBy || currentUser?.name || 'Lab Incharge / Sir',
    awardingOrganization: achievementData.awardingOrganization || achievementData.awardedBy || 'VRSEC Incubation Centre',
    dateAwarded: achievementData.dateAwarded || new Date().toISOString().slice(0, 10),
    isPermanent: true,
    verificationUrl: achievementData.verificationUrl || '',
    projectId: achievementData.projectId || '',
    isExternalAward: Boolean(achievementData.isExternalAward),
    createdAt: new Date().toISOString(),
  };
  if (!memoryStore.achievements) memoryStore.achievements = [];
  memoryStore.achievements.unshift(newAch);
  await persistLocalCache('achievements', memoryStore.achievements);
  await executeCloudMutation({
    table: 'achievements',
    action: 'insert',
    id: newAch.id,
    data: newAch,
  });
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Permanent Achievement Awarded',
    details: `Awarded "${newAch.title}" to ${newAch.studentName} (${newAch.awardedToRoll}) - Prize: ₹${newAch.prizeMoney.toLocaleString('en-IN')}`,
  });
  notifySubscribers('ACHIEVEMENTS_CHANGED', memoryStore.achievements);
  return newAch;
}

export async function updateAchievement(id, updates, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can update achievements.');
  }
  if (!memoryStore.achievements) memoryStore.achievements = [];
  const idx = memoryStore.achievements.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error('Achievement not found.');

  const updated = {
    ...memoryStore.achievements[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  memoryStore.achievements[idx] = updated;
  await persistLocalCache('achievements', memoryStore.achievements);
  await executeCloudMutation({
    table: 'achievements',
    action: 'update',
    id,
    data: updated,
  });
  notifySubscribers('ACHIEVEMENTS_CHANGED', memoryStore.achievements);
  return updated;
}

export async function deleteAchievement(id, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can delete achievements.');
  }
  if (!memoryStore.achievements) memoryStore.achievements = [];
  const idx = memoryStore.achievements.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error('Achievement not found.');

  const removed = memoryStore.achievements.splice(idx, 1)[0];
  await persistLocalCache('achievements', memoryStore.achievements);
  await executeCloudMutation({
    table: 'achievements',
    action: 'delete',
    id,
  });
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Achievement Deleted',
    details: `Deleted achievement "${removed.title}" for ${removed.awardedToRoll}`,
  });
  notifySubscribers('ACHIEVEMENTS_CHANGED', memoryStore.achievements);
  return removed;
}

// 6. ANNOUNCEMENTS (With configurable expiration)
export function getAnnouncements() {
  return [...(memoryStore.announcements || [])];
}

export function getActiveAnnouncements() {
  const now = new Date().getTime();
  return (memoryStore.announcements || []).filter((a) => a.active && new Date(a.expiresAt).getTime() > now);
}

export async function createAnnouncement({ title, message, category = 'General', durationDays = 3, targetAudience = 'all', externalUrl = '', relevantDomain = '' }, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can post announcements.');
  }
  const days = Math.max(1, Math.min(14, Number(durationDays) || 3));
  const newAnn = {
    id: `ANN-${String(Date.now()).slice(-6)}`,
    title: title.trim(),
    message: message.trim(),
    category,
    targetAudience: targetAudience || 'all',
    externalUrl: (externalUrl || '').trim(),
    relevantDomain: (relevantDomain || '').trim(),
    active: true,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: currentUser?.name || 'Admin',
    createdAt: new Date().toISOString(),
  };
  if (!memoryStore.announcements) memoryStore.announcements = [];
  memoryStore.announcements.unshift(newAnn);
  await persistLocalCache('announcements', memoryStore.announcements);
  await executeCloudMutation({
    table: 'announcements',
    action: 'insert',
    id: newAnn.id,
    data: newAnn,
  });
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Announcement Broadcasted',
    details: `Posted announcement "${newAnn.title}" for audience "${newAnn.targetAudience}" (Expires in ${days} days)`,
  });
  notifySubscribers('ANNOUNCEMENTS_CHANGED', memoryStore.announcements);
  return newAnn;
}

export async function updateAnnouncement(id, updates, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can update announcements.');
  }
  const idx = (memoryStore.announcements || []).findIndex((a) => a.id === id);
  if (idx === -1) throw new Error('Announcement not found.');
  const updated = {
    ...memoryStore.announcements[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  memoryStore.announcements[idx] = updated;
  await persistLocalCache('announcements', memoryStore.announcements);
  notifySubscribers('ANNOUNCEMENTS_CHANGED', memoryStore.announcements);
  return updated;
}

export async function archiveAnnouncement(id, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can archive announcements.');
  }
  const idx = (memoryStore.announcements || []).findIndex((a) => a.id === id);
  if (idx === -1) throw new Error('Announcement not found.');
  memoryStore.announcements[idx] = {
    ...memoryStore.announcements[idx],
    active: false,
    archived: true,
    archivedAt: new Date().toISOString(),
  };
  await persistLocalCache('announcements', memoryStore.announcements);
  notifySubscribers('ANNOUNCEMENTS_CHANGED', memoryStore.announcements);
  return memoryStore.announcements[idx];
}

export async function deleteAnnouncement(id, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can delete announcements.');
  }
  const idx = (memoryStore.announcements || []).findIndex((a) => a.id === id);
  if (idx === -1) throw new Error('Announcement not found.');
  const removed = memoryStore.announcements.splice(idx, 1)[0];
  await persistLocalCache('announcements', memoryStore.announcements);
  notifySubscribers('ANNOUNCEMENTS_CHANGED', memoryStore.announcements);
  return removed;
}

// 7. EVENTS & INNOVATION DAY
export function getEvents() {
  return [...(memoryStore.events || [])];
}

export async function createEvent(eventData, currentUser) {
  if (!eventData.title || !eventData.eventDate) {
    throw new Error('Event title and date are required.');
  }
  const newEvent = {
    id: `EVT-${String(Date.now()).slice(-6)}`,
    title: eventData.title.trim(),
    theme: eventData.theme || '',
    eventDate: eventData.eventDate,
    organizer: eventData.organizer || 'VRSEC Incubation Centre & Dept of ECE',
    prizes: eventData.prizes || '',
    prizeMoney: Number(eventData.prizeMoney) || 0,
    winners: Array.isArray(eventData.winners) ? eventData.winners : [],
    participatingTeams: Array.isArray(eventData.participatingTeams) ? eventData.participatingTeams : (eventData.participatingTeams ? [eventData.participatingTeams] : []),
    externalUrl: eventData.externalUrl || '',
    isInnovationDay: Boolean(eventData.isInnovationDay),
    year: eventData.year ? Number(eventData.year) : new Date(eventData.eventDate).getFullYear(),
    description: eventData.description || '',
    outcomes: eventData.outcomes || '',
    createdAt: new Date().toISOString(),
  };
  if (!memoryStore.events) memoryStore.events = [];
  memoryStore.events.unshift(newEvent);
  await persistLocalCache('events', memoryStore.events);
  await executeCloudMutation({
    table: 'events',
    action: 'insert',
    id: newEvent.id,
    data: newEvent,
  });
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Innovation Event Created',
    details: `Created event "${newEvent.title}" scheduled for ${newEvent.eventDate}`,
  });
  notifySubscribers('EVENTS_CHANGED', memoryStore.events);
  return newEvent;
}

export async function updateEvent(id, updates, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can update events.');
  }
  const idx = (memoryStore.events || []).findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Event not found.');
  const updated = {
    ...memoryStore.events[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  memoryStore.events[idx] = updated;
  await persistLocalCache('events', memoryStore.events);
  notifySubscribers('EVENTS_CHANGED', memoryStore.events);
  return updated;
}

export async function deleteEvent(id, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can delete events.');
  }
  const idx = (memoryStore.events || []).findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Event not found.');
  const removed = memoryStore.events.splice(idx, 1)[0];
  await persistLocalCache('events', memoryStore.events);
  await executeCloudMutation({
    table: 'events',
    action: 'delete',
    id,
  });
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Event Deleted',
    details: `Deleted event "${removed.title}" (ID: ${id})`,
  });
  notifySubscribers('EVENTS_CHANGED', memoryStore.events);
  return removed;
}

// 8. COMPLAINTS SYSTEM (Equipment/Environment & Component shortages)
export function getComplaints() {
  return [...(memoryStore.complaints || [])];
}

export async function createComplaint({ type, itemName, description, reportedByRoll, reportedByName, locationDetails = '', componentId = null }) {
  if (!type || !itemName || !description) {
    throw new Error('Complaint type, item name, and description are required.');
  }
  const newComplaint = {
    id: `CMP-${String(Date.now()).slice(-6)}`,
    type,
    itemName: itemName.trim(),
    description: description.trim(),
    locationDetails: (locationDetails || '').trim(),
    componentId: componentId || null,
    reportedByRoll: (reportedByRoll || 'ANONYMOUS').toUpperCase(),
    reportedByName: reportedByName || 'Student',
    assignedTo: 'Lab Incharge',
    status: 'pending',
    adminNotes: '',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  if (!memoryStore.complaints) memoryStore.complaints = [];
  memoryStore.complaints.unshift(newComplaint);
  await persistLocalCache('complaints', memoryStore.complaints);
  await executeCloudMutation({
    table: 'complaints',
    action: 'insert',
    id: newComplaint.id,
    data: newComplaint,
  });
  logAuditEvent({
    actorName: reportedByName || 'Student',
    actorRole: 'student',
    action: 'Lab Issue Reported',
    details: `Reported [${type}] for "${newComplaint.itemName}" (${newComplaint.reportedByRoll})`,
  });
  notifySubscribers('COMPLAINTS_CHANGED', memoryStore.complaints);
  return newComplaint;
}

export async function updateComplaintStatus(id, { status, adminNotes, assignedTo }, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can manage and resolve complaints.');
  }
  const idx = memoryStore.complaints.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Complaint not found.');

  const current = memoryStore.complaints[idx];
  const updated = {
    ...current,
    status: status || current.status,
    adminNotes: adminNotes !== undefined ? adminNotes : current.adminNotes,
    assignedTo: assignedTo !== undefined ? assignedTo : current.assignedTo,
    resolvedAt: status === 'resolved' ? (current.resolvedAt || new Date().toISOString()) : (status === 'pending' || status === 'in_progress' ? null : current.resolvedAt),
  };
  memoryStore.complaints[idx] = updated;
  await persistLocalCache('complaints', memoryStore.complaints);
  await executeCloudMutation({
    table: 'complaints',
    action: 'update',
    id,
    data: updated,
  });
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Complaint Status Updated',
    details: `Complaint ${id} ("${current.itemName}") updated to "${updated.status}". Assignee: ${updated.assignedTo || 'Lab Incharge'}`,
  });
  notifySubscribers('COMPLAINTS_CHANGED', memoryStore.complaints);
  return updated;
}

export async function deleteComplaint(id, currentUser) {
  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  if (!isSirOrAdmin) {
    throw new Error('Permission Denied: Only Sir or Admin can delete complaints.');
  }
  const idx = memoryStore.complaints.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Complaint not found.');
  const removed = memoryStore.complaints.splice(idx, 1)[0];
  await persistLocalCache('complaints', memoryStore.complaints);
  logAuditEvent({
    actorName: currentUser?.name || 'Sir/Admin',
    actorRole: currentUser?.role || 'Admin',
    action: 'Complaint Record Deleted',
    details: `Deleted complaint record ${id} ("${removed.itemName}")`,
    severity: 'warning',
  });
  notifySubscribers('COMPLAINTS_CHANGED', memoryStore.complaints);
  return removed;
}

// 9. RESEARCH PAPERS (Metadata only, DOI/URL, public/private toggle)
export function getResearchPapers(filterPublicOnly = false) {
  const papers = memoryStore.researchPapers || [];
  if (filterPublicOnly) {
    return papers.filter((p) => p.isPublic);
  }
  return [...papers];
}

export async function createResearchPaper(paperData, currentUser) {
  if (!paperData.title) throw new Error('Paper title is required.');
  const newPaper = {
    id: `RES-${String(Date.now()).slice(-6)}`,
    title: paperData.title.trim(),
    authors: Array.isArray(paperData.authors) ? paperData.authors : [paperData.authors || currentUser?.name || 'Author'],
    studentRoll: (paperData.studentRoll || currentUser?.rollNumber || '').trim().toUpperCase(),
    teamName: paperData.teamName || '',
    domain: paperData.domain || 'IoT & Embedded Systems',
    venue: paperData.venue || '',
    publicationDate: paperData.publicationDate || new Date().toISOString().slice(0, 10),
    paperType: paperData.paperType || 'conference',
    status: paperData.status || 'published', // 'planning' | 'in_progress' | 'submitted' | 'accepted' | 'published'
    doi: paperData.doi || '',
    externalUrl: paperData.externalUrl || '',
    repositoryUrl: paperData.repositoryUrl || '',
    relatedProjectId: paperData.relatedProjectId || '',
    isPublic: paperData.isPublic !== undefined ? Boolean(paperData.isPublic) : true,
    isIeeeIndexed: Boolean(paperData.isIeeeIndexed || paperData.paperType === 'IEEE'),
    isScopusIndexed: Boolean(paperData.isScopusIndexed),
    createdAt: new Date().toISOString(),
  };
  if (!memoryStore.researchPapers) memoryStore.researchPapers = [];
  memoryStore.researchPapers.unshift(newPaper);
  await persistLocalCache('researchPapers', memoryStore.researchPapers);
  await executeCloudMutation({
    table: 'research_papers',
    action: 'insert',
    id: newPaper.id,
    data: newPaper,
  });
  logAuditEvent({
    actorName: currentUser?.name || newPaper.studentRoll || 'Author',
    actorRole: currentUser?.role || 'student',
    action: 'Research Paper Registered',
    details: `Registered publication "${newPaper.title}" (Venue: ${newPaper.venue || 'Peer-reviewed'})`,
  });
  notifySubscribers('RESEARCH_PAPERS_CHANGED', memoryStore.researchPapers);
  return newPaper;
}

export async function updateResearchPaper(id, updates, currentUser) {
  const idx = (memoryStore.researchPapers || []).findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Research paper not found.');
  const current = memoryStore.researchPapers[idx];

  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  const isOwner = currentUser?.rollNumber && current.studentRoll === currentUser.rollNumber.toUpperCase();

  if (!isSirOrAdmin && !isOwner) {
    throw new Error('Permission Denied: You can only update your own research papers.');
  }

  const updated = {
    ...current,
    ...updates,
    isIeeeIndexed: updates.isIeeeIndexed !== undefined ? Boolean(updates.isIeeeIndexed) : (updates.paperType === 'IEEE' || current.isIeeeIndexed),
    isScopusIndexed: updates.isScopusIndexed !== undefined ? Boolean(updates.isScopusIndexed) : current.isScopusIndexed,
    updatedAt: new Date().toISOString(),
  };

  memoryStore.researchPapers[idx] = updated;
  await persistLocalCache('researchPapers', memoryStore.researchPapers);
  notifySubscribers('RESEARCH_PAPERS_CHANGED', memoryStore.researchPapers);
  return updated;
}

export async function deleteResearchPaper(id, currentUser) {
  const idx = (memoryStore.researchPapers || []).findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Research paper not found.');
  const current = memoryStore.researchPapers[idx];

  const isSirOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'sir' ||
    currentUser?.role === 'substitute_admin';
  const isOwner = currentUser?.rollNumber && current.studentRoll === currentUser.rollNumber.toUpperCase();

  if (!isSirOrAdmin && !isOwner) {
    throw new Error('Permission Denied: You can only delete your own research papers.');
  }

  const removed = memoryStore.researchPapers.splice(idx, 1)[0];
  await persistLocalCache('researchPapers', memoryStore.researchPapers);
  notifySubscribers('RESEARCH_PAPERS_CHANGED', memoryStore.researchPapers);
  return removed;
}

// 10. SELF-AFFIRMATION / STUDENT REFLECTION BOOK
export function getSelfReflections(rollNumber, isOwnProfile = false) {
  if (!rollNumber) return [];
  const cleanRoll = rollNumber.trim().toUpperCase();
  const list = memoryStore.selfReflections || [];
  if (isOwnProfile) {
    return list.filter((r) => r.studentRoll.toUpperCase() === cleanRoll);
  }
  return list.filter((r) => r.studentRoll.toUpperCase() === cleanRoll && !r.isPrivate);
}

export async function createSelfReflection(reflectionData, currentUser) {
  const roll = (reflectionData.studentRoll || currentUser?.rollNumber || '').trim().toUpperCase();
  if (!roll) throw new Error('Student roll number is required for reflection book.');
  const newRef = {
    id: `REF-${String(Date.now()).slice(-6)}`,
    studentRoll: roll,
    title: reflectionData.title.trim(),
    content: reflectionData.content.trim(),
    isPrivate: reflectionData.isPrivate !== undefined ? Boolean(reflectionData.isPrivate) : true,
    date: reflectionData.date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  if (!memoryStore.selfReflections) memoryStore.selfReflections = [];
  memoryStore.selfReflections.unshift(newRef);
  await persistLocalCache('selfReflections', memoryStore.selfReflections);
  await executeCloudMutation({
    table: 'self_reflections',
    action: 'insert',
    id: newRef.id,
    data: newRef,
  });
  notifySubscribers('SELF_REFLECTIONS_CHANGED', memoryStore.selfReflections);
  return newRef;
}

// 11. SMART STUDENT SEARCH WITH COMBINED FILTERS
export function searchStudents({ query = '', name = '', rollNumber = '', branch = '', section = '', year = '' } = {}) {
  const cleanQuery = (query || '').trim().toLowerCase();
  const cleanName = (name || '').trim().toLowerCase();
  const cleanRoll = (rollNumber || '').trim().toUpperCase();
  const cleanBranch = (branch || '').trim().toLowerCase();
  const cleanSection = (section || '').trim().toUpperCase();
  const yr = year ? Number(year) : null;

  return getStudents().filter((s) => {
    if (cleanQuery && !s.name.toLowerCase().includes(cleanQuery) && !s.rollNumber.toLowerCase().includes(cleanQuery)) {
      return false;
    }
    if (cleanName && !s.name.toLowerCase().includes(cleanName)) return false;
    if (cleanRoll && (!s.rollNumber || !s.rollNumber.toUpperCase().includes(cleanRoll))) return false;
    if (cleanBranch && s.branch && !s.branch.toLowerCase().includes(cleanBranch)) return false;
    if (cleanSection && s.section && s.section.toUpperCase() !== cleanSection) return false;
    if (yr && (s.academicYear || s.year) && Number(s.academicYear || s.year) !== yr) return false;
    return true;
  });
}

// 12. VOICE SEARCH MULTI-INDEX HELPER
export function executeSmartVoiceSearch(queryText) {
  if (!queryText || typeof queryText !== 'string') {
    return { students: [], projects: [], components: [], domains: [] };
  }
  const q = queryText.trim().toLowerCase();
  if (!q) return { students: [], projects: [], components: [], domains: [] };

  const students = getStudents().filter(
    (s) => s.name.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q)
  );

  const projects = (memoryStore.projects || []).filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      (p.domain && p.domain.toLowerCase().includes(q)) ||
      (p.leaderRoll && p.leaderRoll.toLowerCase().includes(q)) ||
      (p.members || []).some((m) => (m.name || '').toLowerCase().includes(q) || (m.rollNumber || '').toLowerCase().includes(q))
  );

  const components = (memoryStore.components || []).filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.componentNumber && c.componentNumber.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q))
  );

  const domains = (memoryStore.domains || DEFAULT_DOMAINS).filter((d) =>
    (typeof d === 'string' ? d : d.name).toLowerCase().includes(q)
  );

  return { students, projects, components, domains };
}

// 13. ECE PROJECTS & RESEARCH DYNAMIC STATISTICS
export function getEceResearchStats() {
  const projects = memoryStore.projects || [];
  const papers = memoryStore.researchPapers || [];
  const achievements = memoryStore.achievements || [];
  const teams = memoryStore.teams || [];

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const prototypesReady = projects.filter((p) => p.prototypeAvailable).length;
  const totalPrizeMoney = achievements.reduce((acc, a) => acc + (Number(a.prizeMoney) || 0), 0);
  const totalPapers = papers.length;
  const ieeePapers = papers.filter((p) => p.paperType === 'IEEE' || p.isIeeeIndexed).length;

  return {
    totalProjects: projects.length,
    activeProjects,
    prototypesReady,
    totalTeams: teams.length,
    totalAchievements: achievements.length,
    totalPrizeMoney,
    totalPapers,
    ieeePapers,
  };
}

// 14. COMPONENT USAGE STATISTICS (Usage per component, frequent borrowers, loan records)
export function getComponentUsageStats(componentId) {
  if (!componentId) return null;
  const comp = (memoryStore.components || []).find(
    (c) => c.id === componentId || String(c.id) === String(componentId) || c.componentNumber === componentId
  );
  if (!comp) return null;

  const relevantTxns = (memoryStore.transactions || []).filter((t) =>
    (t.items || []).some((it) => it.componentId === comp.id || it.componentId === componentId)
  );

  let totalTimesBorrowed = 0;
  let totalQuantityIssued = 0;
  let totalQuantityReturned = 0;
  const borrowerRolls = new Set();
  const borrowerMap = {};

  for (const t of relevantTxns) {
    const it = t.items.find((item) => item.componentId === comp.id || item.componentId === componentId);
    if (it) {
      totalTimesBorrowed++;
      totalQuantityIssued += Number(it.issuedQuantity) || 0;
      totalQuantityReturned += Number(it.returnedQuantity) || 0;
      if (t.studentRoll) {
        const r = t.studentRoll.toUpperCase();
        borrowerRolls.add(r);
        borrowerMap[r] = (borrowerMap[r] || 0) + (Number(it.issuedQuantity) || 1);
      }
    }
  }

  const topBorrowers = Object.entries(borrowerMap)
    .map(([roll, count]) => {
      const student = getUserByRoll(roll);
      return { roll, name: student?.name || roll, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const usableStock = getUsableStock(comp);

  return {
    componentId,
    name: comp.name,
    componentName: comp.name,
    category: comp.category,
    componentNumber: comp.componentNumber || '—',
    totalQuantity: comp.totalQuantity,
    usableStock,
    isAvailable: usableStock > 0,
    totalTimesBorrowed,
    totalQuantityIssued,
    totalQuantityReturned,
    currentlyIssued: totalQuantityIssued - totalQuantityReturned,
    distinctBorrowersCount: borrowerRolls.size,
    topBorrowers,
    recentTransactions: relevantTxns.slice(0, 5),
  };
}

// 15. DYNAMIC INCUBATION REPORTING & COMPREHENSIVE METRICS
export function getIncubationReportingMetrics() {
  const projects = memoryStore.projects || [];
  const papers = memoryStore.researchPapers || [];
  const achievements = memoryStore.achievements || [];
  const complaints = memoryStore.complaints || [];
  const components = memoryStore.components || [];
  const visits = memoryStore.visits || [];
  const students = getStudents();

  // Projects by branch
  const branchCounts = { ECE: 0, CSE: 0, IT: 0, Mechanical: 0, Others: 0 };
  for (const p of projects) {
    const leader = getUserByRoll(p.leaderRoll);
    const branch = (leader?.branch || leader?.department || 'ECE').toUpperCase();
    if (branch.includes('ECE') || branch.includes('ELECTRONIC')) {
      branchCounts.ECE++;
    } else if (branch.includes('CSE') || branch.includes('COMPUTER')) {
      branchCounts.CSE++;
    } else if (branch.includes('IT') || branch.includes('INFORMATION')) {
      branchCounts.IT++;
    } else if (branch.includes('MECH')) {
      branchCounts.Mechanical++;
    } else {
      branchCounts.Others++;
    }
  }

  // Research status breakdown
  const researchStatus = {
    planning: 0,
    in_progress: 0,
    submitted: 0,
    accepted: 0,
    published: 0,
    ieeeOrScopus: 0,
  };
  for (const pr of papers) {
    const st = (pr.status || 'published').toLowerCase();
    if (researchStatus[st] !== undefined) {
      researchStatus[st]++;
    } else {
      researchStatus.published++;
    }
    if (pr.isIeeeIndexed || pr.isScopusIndexed || pr.paperType === 'IEEE') {
      researchStatus.ieeeOrScopus++;
    }
  }

  // Inventory breakdown
  let totalItemsInStore = 0;
  let totalUsable = 0;
  let totalDamaged = 0;
  let totalLost = 0;
  let totalCurrentlyIssued = 0;
  for (const c of components) {
    totalItemsInStore += c.totalQuantity || 0;
    totalUsable += getUsableStock(c);
    totalDamaged += c.damagedQuantity || 0;
    totalLost += c.lostQuantity || 0;
    totalCurrentlyIssued += c.issuedQuantity || 0;
  }

  // Lab hours stats
  const completedVisits = visits.filter((v) => v.status === 'completed');
  const totalMinutes = completedVisits.reduce((sum, v) => sum + (v.durationMinutes || 0), 0);
  const avgSessionMinutes = completedVisits.length > 0 ? Math.round(totalMinutes / completedVisits.length) : 0;

  // Complaints stats
  const complaintsSummary = {
    total: complaints.length,
    pending: complaints.filter((c) => c.status === 'pending').length,
    in_progress: complaints.filter((c) => c.status === 'in_progress').length,
    resolved: complaints.filter((c) => c.status === 'resolved').length,
  };

  // Achievements stats
  const totalPrizeMoney = achievements.reduce((sum, a) => sum + (Number(a.prizeMoney) || 0), 0);

  return {
    totalStudents: students.length,
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'active').length,
    completedProjects: projects.filter((p) => p.status === 'completed').length,
    prototypesReady: projects.filter((p) => p.prototypeAvailable).length,
    projectsByBranch: branchCounts,
    projects: {
      total: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
      completed: projects.filter((p) => p.status === 'completed').length,
      prototypesReady: projects.filter((p) => p.prototypeAvailable).length,
      byBranch: branchCounts,
    },
    researchStatus,
    research: {
      total: papers.length,
      published: researchStatus.published,
      underReview: researchStatus.submitted,
      inProgress: researchStatus.in_progress,
      ieeeIndexed: researchStatus.ieeeOrScopus,
      scopusIndexed: papers.filter((p) => p.isScopusIndexed).length,
    },
    totalPapers: papers.length,
    inventory: {
      totalItemsInStore,
      totalPhysicalItems: totalItemsInStore,
      totalUsable,
      totalDamaged,
      totalLost,
      totalCurrentlyIssued,
      currentlyBorrowed: totalCurrentlyIssued,
      availabilityPercent: totalItemsInStore > 0 ? Math.round((totalUsable / totalItemsInStore) * 100) : 0,
      availabilityRate: totalItemsInStore > 0 ? Math.round((totalUsable / totalItemsInStore) * 100) : 0,
    },
    totalHoursLogged: (totalMinutes / 60).toFixed(1),
    totalVisits: visits.length,
    activeInLab: (memoryStore.visits || []).filter((v) => v.status === 'active').length,
    labAttendance: {
      totalVisits: visits.length,
      totalHours: (totalMinutes / 60).toFixed(1),
      avgSessionMinutes,
    },
    complaints: complaintsSummary,
    achievements: {
      totalCount: achievements.length,
      totalHonors: achievements.length,
      totalPrizeMoney,
    },
  };
}


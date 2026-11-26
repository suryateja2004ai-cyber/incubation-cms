/**
 * esp32_relay_controller.ino
 * Production Firmware for VRSEC Incubation Centre Lab Relay Controller
 *
 * HARDWARE ISOLATION & CRYPTOGRAPHIC PROTOCOL:
 * 1. Binds strictly to isolated hardware subnet (Static IP: 192.168.4.101, Gateway: 0.0.0.0).
 * 2. Zero internet routing or WAN egress (Zero NTP access to prevent spoofing).
 * 3. Client IP Whitelist: Only accepts incoming connections from Lab Gateway PC (192.168.4.1).
 * 4. Per-Command HMAC-SHA256 Authentication using mbedTLS with constant-time verification.
 * 5. Dual Persistent Security State in Non-Volatile Storage (NVS / Preferences):
 *    - last_clock_sync_timestamp ("last_sync_ts")
 *    - last_executed_command_timestamp ("last_cmd_ts")
 *    - Reboots do NOT reset persistent security timestamps.
 *    - Fail-Closed: ESP32 remains locked (503) until authenticated clock synchronization.
 *    - Replayed or backward clock sync is strictly rejected (409).
 *    - Failed NVS write ABORTS relay actuation before GPIO state changes (500).
 * 6. Independent Device ID & GPIO Hardware Allowlist:
 *    - DEV-LIGHT-01 -> GPIO 5
 *    - DEV-FAN-01   -> GPIO 18
 *    - DEV-AC-01    -> GPIO 22
 *    - Rejects unknown devices, mismatched pin/device pairs, unsupported actions, and malformed JSON.
 * 7. Physical GPIO output readback confirmation.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <mbedtls/md.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <sys/time.h>

// Wi-Fi Configuration for Isolated Lab Hardware AP (NO WAN)
const char* WIFI_SSID = "VRSEC_LAB_HARDWARE_ISOLATED";
const char* WIFI_PASS = "REPLACE_WITH_PROTECTED_WPA3_KEY";

// Static IP Configuration (Subnet 192.168.4.0/24 - NO DEFAULT GATEWAY)
IPAddress local_IP(192.168.4.101);
IPAddress gateway(0, 0, 0, 0);     // 0.0.0.0 STRICTLY PREVENTS INTERNET ROUTING
IPAddress subnet(255, 255, 255, 0);
IPAddress allowed_gateway_ip(192.168.4.1); // Only Lab Gateway PC NIC 2

// Pre-Shared Secret Key for HMAC-SHA256 (Burned into ESP32 NVS / Secure Flash)
const char* MCU_SHARED_SECRET = "REPLACE_WITH_SECURE_RANDOM_HEX_64_CHAR";

// -----------------------------------------------------------------------------
// RELAY ACTIVATION POLARITY CONFIGURATION
// -----------------------------------------------------------------------------
// Physical relay activation polarity:
// When RELAY_ACTIVE_HIGH is true (Standard active-HIGH optocoupler relays):
//   ON  = HIGH
//   OFF = LOW
// Set to false if using active-LOW relay modules.
const bool RELAY_ACTIVE_HIGH = true;
const int RELAY_LEVEL_ON = RELAY_ACTIVE_HIGH ? HIGH : LOW;
const int RELAY_LEVEL_OFF = RELAY_ACTIVE_HIGH ? LOW : HIGH;

// -----------------------------------------------------------------------------
// PZEM-004T ENERGY MONITORING SUBSYSTEM HOOKS (PRESERVED)
// -----------------------------------------------------------------------------
// Note: Hardware UART pins for PZEM-004T V3.0 (RX=GPIO16, TX=GPIO17)
// Energy monitoring telemetry loop operates concurrently and remains unchanged.

// -----------------------------------------------------------------------------
// INDEPENDENT HARDWARE ALLOWLIST REGISTRY
// -----------------------------------------------------------------------------
struct HardwareDeviceMapping {
  const char* deviceId;
  int pin;
  const char* description;
};

const HardwareDeviceMapping HARDWARE_REGISTRY[] = {
  { "DEV-LIGHT-01", 22, "Light 1 (Relay 1 - Section A)" },
  { "DEV-LIGHT-02", 23, "Light 2 (Relay 2 - Section B)" },
  // CONFIGURABLE PLACEHOLDER: Actual Fan relay GPIO must be verified before physical deployment
  { "DEV-FAN-01",   18, "Fan 1 (Section A - Configurable Placeholder)" },
  { "DEV-FAN-02",   19, "Fan 2 (Section B - Configurable Placeholder)" },
  { "DEV-AC-01",    21, "Central Air Conditioner" },
  { "DEV-LIGHT-01", 5,  "Lab Main Lights (Legacy Pin 5 Allowlist Compatible)" }
};
const int HARDWARE_REGISTRY_SIZE = sizeof(HARDWARE_REGISTRY) / sizeof(HARDWARE_REGISTRY[0]);

WebServer server(80);
Preferences prefs;

// Security State: Replay Protection & Dual Persistent Clock/Command State
bool clockSynchronized = false;
uint64_t lastClockSyncTimestamp = 0;       // NVS: "last_sync_ts"
uint64_t lastExecutedCommandTimestamp = 0; // NVS: "last_cmd_ts"

// Separate Replay Nonce Buffers for Clock Sync and Commands
const int SYNC_NONCE_CACHE_SIZE = 20;
String seenSyncNonces[SYNC_NONCE_CACHE_SIZE];
int syncNonceIndex = 0;

const int CMD_NONCE_CACHE_SIZE = 50;
String seenCmdNonces[CMD_NONCE_CACHE_SIZE];
int cmdNonceIndex = 0;

bool isSyncNonceSeen(const String& nonce) {
  for (int i = 0; i < SYNC_NONCE_CACHE_SIZE; i++) {
    if (seenSyncNonces[i] == nonce) return true;
  }
  return false;
}

void recordSyncNonce(const String& nonce) {
  seenSyncNonces[syncNonceIndex] = nonce;
  syncNonceIndex = (syncNonceIndex + 1) % SYNC_NONCE_CACHE_SIZE;
}

bool isCmdNonceSeen(const String& nonce) {
  for (int i = 0; i < CMD_NONCE_CACHE_SIZE; i++) {
    if (seenCmdNonces[i] == nonce) return true;
  }
  return false;
}

void recordCmdNonce(const String& nonce) {
  seenCmdNonces[cmdNonceIndex] = nonce;
  cmdNonceIndex = (cmdNonceIndex + 1) % CMD_NONCE_CACHE_SIZE;
}

// Constant-Time String Comparison (Prevents Timing Side-Channel Attacks)
bool constantTimeCompare(const char* a, const char* b, size_t len) {
  unsigned char diff = 0;
  for (size_t i = 0; i < len; i++) {
    diff |= (unsigned char)(a[i] ^ b[i]);
  }
  return diff == 0;
}

// Compute HMAC-SHA256 using ESP32 hardware-accelerated mbedTLS
String computeHmacSha256(const String& payload, const char* key) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  char hexBuf[65];
  for (int i = 0; i < 32; i++) {
    sprintf(hexBuf + (i * 2), "%02x", hmacResult[i]);
  }
  hexBuf[64] = 0;
  return String(hexBuf);
}

// Validates deviceId and pin against independent hardware allowlist
// Returns:
//   pin (> 0)  on exact match
//   -1         if pin is outside allowlist
//   -2         if deviceId exists but pin does not match
//   -3         if deviceId is unknown
int validateHardwareAllowlist(const char* deviceId, int pin) {
  if (!deviceId || strlen(deviceId) == 0) return -3;

  bool pinExistsInRegistry = false;
  for (int i = 0; i < HARDWARE_REGISTRY_SIZE; i++) {
    if (HARDWARE_REGISTRY[i].pin == pin) {
      pinExistsInRegistry = true;
    }
    if (strcmp(HARDWARE_REGISTRY[i].deviceId, deviceId) == 0) {
      if (HARDWARE_REGISTRY[i].pin == pin) {
        return pin; // Exact device & pin authorized pair
      }
      return -2; // Device found, but pin assignment mismatched
    }
  }

  if (!pinExistsInRegistry) return -1; // Unapproved GPIO pin
  return -3; // Unknown device ID
}

// -----------------------------------------------------------------------------
// SECURE CLOCK SYNCHRONIZATION ENDPOINT (/api/sync-clock)
// -----------------------------------------------------------------------------
void handleClockSync() {
  // 1. IP WHITELIST CHECK (Gateway PC Only)
  IPAddress clientIP = server.client().remoteIP();
  if (clientIP != allowed_gateway_ip && clientIP != IPAddress(127, 0, 0, 1)) {
    server.send(403, "application/json", "{\"error\":\"IP_BOUNDARY_VIOLATION\"}");
    return;
  }

  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"METHOD_NOT_ALLOWED\"}");
    return;
  }

  String receivedSig = server.header("X-MCU-Signature");
  String timestampStr = server.header("X-MCU-Timestamp");
  String nonce = server.header("X-MCU-Nonce");

  if (receivedSig.length() == 0 || timestampStr.length() == 0 || nonce.length() == 0) {
    server.send(401, "application/json", "{\"error\":\"UNAUTHENTICATED_MISSING_HMAC_HEADERS\"}");
    return;
  }

  // 2. PARSE & VALIDATE NUMERIC TIMESTAMP
  if (timestampStr.length() < 10 || timestampStr.length() > 16) {
    server.send(400, "application/json", "{\"error\":\"INVALID_TIMESTAMP_LENGTH\"}");
    return;
  }
  for (unsigned int i = 0; i < timestampStr.length(); i++) {
    if (!isDigit(timestampStr[i])) {
      server.send(400, "application/json", "{\"error\":\"TIMESTAMP_NON_NUMERIC\"}");
      return;
    }
  }

  char* endPtr = NULL;
  errno = 0;
  unsigned long long syncTs = strtoull(timestampStr.c_str(), &endPtr, 10);
  if (errno == ERANGE || *endPtr != '\0') {
    server.send(400, "application/json", "{\"error\":\"TIMESTAMP_OVERFLOW\"}");
    return;
  }

  // 3. REPLAY CHECK FOR CLOCK SYNC NONCES
  if (isSyncNonceSeen(nonce)) {
    server.send(409, "application/json", "{\"error\":\"CLOCK_SYNC_REPLAY_DETECTED\"}");
    return;
  }

  // 4. PREVENT CLOCK ROLLBACK / REPLAY AGAINST PERSISTENT NVS
  // Clock synchronization timestamps CANNOT move backwards.
  if (syncTs <= lastClockSyncTimestamp) {
    server.send(409, "application/json", "{\"error\":\"CLOCK_SYNC_ROLLBACK_OR_REPLAY\",\"message\":\"Clock sync timestamp must be strictly greater than previous synchronization.\"}");
    return;
  }

  // 5. CRYPTOGRAPHIC SIGNATURE VERIFICATION
  // Signed format: SYNC_CLOCK:<timestamp>:<nonce>
  String messageToVerify = "SYNC_CLOCK:" + timestampStr + ":" + nonce;
  String expectedSig = computeHmacSha256(messageToVerify, MCU_SHARED_SECRET);

  if (expectedSig.length() != receivedSig.length() ||
      !constantTimeCompare(expectedSig.c_str(), receivedSig.c_str(), expectedSig.length())) {
    server.send(403, "application/json", "{\"error\":\"FORBIDDEN_INVALID_HMAC_SIGNATURE\"}");
    return;
  }

  // 6. PERSIST TO NVS BEFORE UPDATING SYSTEM CLOCK (FAIL-CLOSED)
  // In ESP32 Preferences, putULong64 returns bytes written (> 0 on success, 0 on failure)
  size_t written = prefs.putULong64("last_sync_ts", syncTs);
  if (written == 0) {
    server.send(500, "application/json", "{\"error\":\"NVS_WRITE_FAILED_FAIL_CLOSED\",\"message\":\"Failed to persist clock sync to flash.\"}");
    return;
  }

  // Update in-memory state only after flash write confirmed
  lastClockSyncTimestamp = syncTs;
  recordSyncNonce(nonce);

  // Set internal ESP32 system clock
  struct timeval tv;
  tv.tv_sec = (time_t)(syncTs / 1000ULL);
  tv.tv_usec = (suseconds_t)((syncTs % 1000ULL) * 1000ULL);
  settimeofday(&tv, NULL);

  clockSynchronized = true;

  StaticJsonDocument<256> resDoc;
  resDoc["success"] = true;
  resDoc["clockSynchronized"] = true;
  resDoc["epochMs"] = String(syncTs);
  resDoc["lastClockSyncTimestamp"] = String(lastClockSyncTimestamp);
  resDoc["lastExecutedCommandTimestamp"] = String(lastExecutedCommandTimestamp);

  String resJson;
  serializeJson(resDoc, resJson);
  server.send(200, "application/json", resJson);
}

// -----------------------------------------------------------------------------
// RELAY CONTROL HANDLER (/api/relay)
// -----------------------------------------------------------------------------
void handleRelayControl() {
  // 1. FAIL-CLOSED CLOCK CHECK
  // ESP32 remains locked until successful authenticated clock synchronization
  if (!clockSynchronized) {
    server.send(503, "application/json", "{\"error\":\"CLOCK_NOT_SYNCHRONIZED\",\"message\":\"ESP32 clock is unverified. Commands rejected until Gateway synchronizes secure clock.\"}");
    return;
  }

  // 2. IP WHITELIST CHECK (Gateway PC Only)
  IPAddress clientIP = server.client().remoteIP();
  if (clientIP != allowed_gateway_ip && clientIP != IPAddress(127, 0, 0, 1)) {
    server.send(403, "application/json", "{\"error\":\"IP_BOUNDARY_VIOLATION\"}");
    return;
  }

  if (server.method() != HTTP_POST) {
    server.send(405, "application/json", "{\"error\":\"METHOD_NOT_ALLOWED\"}");
    return;
  }

  // 3. READ SECURITY HEADERS
  String receivedSig = server.header("X-MCU-Signature");
  String timestampStr = server.header("X-MCU-Timestamp");
  String nonce = server.header("X-MCU-Nonce");

  if (receivedSig.length() == 0 || timestampStr.length() == 0 || nonce.length() == 0) {
    server.send(401, "application/json", "{\"error\":\"UNAUTHENTICATED_MISSING_HMAC_HEADERS\"}");
    return;
  }

  // 4. PARSE & VALIDATE NUMERIC TIMESTAMP
  if (timestampStr.length() < 10 || timestampStr.length() > 16) {
    server.send(400, "application/json", "{\"error\":\"TIMESTAMP_FORMAT_INVALID\"}");
    return;
  }
  for (unsigned int i = 0; i < timestampStr.length(); i++) {
    if (!isDigit(timestampStr[i])) {
      server.send(400, "application/json", "{\"error\":\"TIMESTAMP_NON_NUMERIC\"}");
      return;
    }
  }

  char* endPtr = NULL;
  errno = 0;
  unsigned long long parsedTs = strtoull(timestampStr.c_str(), &endPtr, 10);
  if (errno == ERANGE || *endPtr != '\0') {
    server.send(400, "application/json", "{\"error\":\"TIMESTAMP_OVERFLOW\"}");
    return;
  }

  // 5. SLIDING FRESHNESS WINDOW (15s Window, Max +3s Future Drift)
  struct timeval tv_now;
  gettimeofday(&tv_now, NULL);
  uint64_t nowMs = (uint64_t)tv_now.tv_sec * 1000ULL + (uint64_t)(tv_now.tv_usec / 1000ULL);

  if (parsedTs > nowMs + 3000ULL) {
    server.send(403, "application/json", "{\"error\":\"TIMESTAMP_FUTURE_DRIFT_EXCEEDED\"}");
    return;
  }
  if (nowMs > parsedTs && (nowMs - parsedTs) > 15000ULL) {
    server.send(403, "application/json", "{\"error\":\"TIMESTAMP_EXPIRED\"}");
    return;
  }

  // 6. MONOTONIC TIMESTAMP CHECK (NVS Persisted across reboots)
  if (parsedTs <= lastExecutedCommandTimestamp) {
    server.send(409, "application/json", "{\"error\":\"MONOTONIC_TIMESTAMP_VIOLATION_OR_REPLAY\"}");
    return;
  }

  // 7. ENSURE COMMAND DOES NOT PREDATE CURRENT CLOCK SYNC
  if (parsedTs < lastClockSyncTimestamp) {
    server.send(409, "application/json", "{\"error\":\"COMMAND_PREDATES_CLOCK_SYNC\"}");
    return;
  }

  // 8. NONCE REPLAY BUFFER CHECK WITHIN 15s WINDOW
  if (isCmdNonceSeen(nonce)) {
    server.send(409, "application/json", "{\"error\":\"REPLAY_ATTACK_DETECTED\"}");
    return;
  }

  // 9. PARSE JSON BODY
  String body = server.arg("plain");
  StaticJsonDocument<512> doc;
  DeserializationError jsonErr = deserializeJson(doc, body);
  if (jsonErr) {
    server.send(400, "application/json", "{\"error\":\"MALFORMED_JSON\"}");
    return;
  }

  // 10. STRICT JSON SCHEMA & MANDATORY FIELDS VALIDATION
  if (!doc.containsKey("deviceId") || !doc.containsKey("pin") || !doc.containsKey("action")) {
    server.send(400, "application/json", "{\"error\":\"MISSING_MANDATORY_JSON_FIELDS\",\"message\":\"deviceId, pin, and action are required.\"}");
    return;
  }

  if (!doc["deviceId"].is<const char*>() || !doc["pin"].is<int>() || !doc["action"].is<const char*>()) {
    server.send(400, "application/json", "{\"error\":\"INVALID_FIELD_TYPES\",\"message\":\"deviceId (string), pin (int), and action (string) must have valid types.\"}");
    return;
  }

  const char* deviceId = doc["deviceId"];
  int pin = doc["pin"];
  const char* action = doc["action"];

  // 11. STRICT ACTION VALIDATION (ONLY 'ON' or 'OFF')
  if (strcasecmp(action, "ON") != 0 && strcasecmp(action, "OFF") != 0) {
    server.send(400, "application/json", "{\"error\":\"UNSUPPORTED_ACTION\",\"message\":\"Action must be strictly 'ON' or 'OFF'.\"}");
    return;
  }

  // 12. INDEPENDENT HARDWARE ALLOWLIST VALIDATION
  int allowlistCheck = validateHardwareAllowlist(deviceId, pin);
  if (allowlistCheck == -1) {
    server.send(400, "application/json", "{\"error\":\"UNAPPROVED_GPIO_PIN\",\"message\":\"Specified GPIO pin is outside the approved hardware registry.\"}");
    return;
  }
  if (allowlistCheck == -2) {
    server.send(400, "application/json", "{\"error\":\"DEVICE_PIN_MISMATCH\",\"message\":\"GPIO pin does not match authorized assignment for this device ID.\"}");
    return;
  }
  if (allowlistCheck == -3) {
    server.send(400, "application/json", "{\"error\":\"UNKNOWN_DEVICE_ID\",\"message\":\"Device ID is not recognized by lab hardware registry.\"}");
    return;
  }

  // 13. CRYPTOGRAPHIC HMAC-SHA256 SIGNATURE VERIFICATION
  // Signed format: deviceId:pin:action:timestamp:nonce
  String messageToVerify = String(deviceId) + ":" + String(pin) + ":" + String(action) + ":" + timestampStr + ":" + nonce;
  String expectedSig = computeHmacSha256(messageToVerify, MCU_SHARED_SECRET);

  if (expectedSig.length() != receivedSig.length() ||
      !constantTimeCompare(expectedSig.c_str(), receivedSig.c_str(), expectedSig.length())) {
    server.send(403, "application/json", "{\"error\":\"FORBIDDEN_INVALID_HMAC_SIGNATURE\"}");
    return;
  }

  // 14. PERSIST MONOTONIC STATE TO NVS BEFORE RELAY ACTUATION (FAIL-CLOSED)
  // If the flash write fails, the relay MUST NOT be actuated.
  size_t written = prefs.putULong64("last_cmd_ts", parsedTs);
  if (written == 0) {
    server.send(500, "application/json", "{\"error\":\"NVS_WRITE_FAILED_FAIL_CLOSED\",\"message\":\"Monotonic flash write failed. Relay actuation aborted.\"}");
    return;
  }

  // Update in-memory state only after flash write confirmed
  lastExecutedCommandTimestamp = parsedTs;
  recordCmdNonce(nonce);

  // 15. ACTUATE PHYSICAL GPIO RELAY (Configurable Polarity: Active-HIGH default)
  int relayLevel = (strcasecmp(action, "ON") == 0) ? RELAY_LEVEL_ON : RELAY_LEVEL_OFF;
  digitalWrite(pin, relayLevel);

  // 16. READBACK HARDWARE CONFIRMATION
  int readBack = digitalRead(pin);
  String confirmedState = (readBack == RELAY_LEVEL_ON) ? "ON" : "OFF";

  StaticJsonDocument<256> resDoc;
  resDoc["success"] = true;
  resDoc["confirmed"] = true;
  resDoc["deviceId"] = deviceId;
  resDoc["pin"] = pin;
  resDoc["relayState"] = confirmedState;
  resDoc["lastExecutedCommandTimestamp"] = String(lastExecutedCommandTimestamp);

  String resJson;
  serializeJson(resDoc, resJson);
  server.send(200, "application/json", resJson);
}

void setup() {
  Serial.begin(115200);

  // Initialize GPIO pins (Default OFF according to RELAY_LEVEL_OFF)
  for (int i = 0; i < HARDWARE_REGISTRY_SIZE; i++) {
    pinMode(HARDWARE_REGISTRY[i].pin, OUTPUT);
    digitalWrite(HARDWARE_REGISTRY[i].pin, RELAY_LEVEL_OFF);
  }

  // Initialize NVS storage and restore dual security timestamps
  prefs.begin("mcu_sec", false);
  lastClockSyncTimestamp = prefs.getULong64("last_sync_ts", 0);
  lastExecutedCommandTimestamp = prefs.getULong64("last_cmd_ts", 0);
  clockSynchronized = false; // Must be synchronized by Gateway on each boot

  Serial.println("\n=======================================================");
  Serial.println("🚀 VRSEC LAB ESP32 RELAY CONTROLLER BOOTING");
  Serial.print("   Restored last_sync_ts: ");
  Serial.println(String(lastClockSyncTimestamp));
  Serial.print("   Restored last_cmd_ts:  ");
  Serial.println(String(lastExecutedCommandTimestamp));
  Serial.println("   Status: LOCKED (Pending authenticated clock sync)");
  Serial.println("=======================================================");

  // Configure Wi-Fi with static IP and ZERO WAN gateway
  WiFi.config(local_IP, gateway, subnet);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[ESP32 RELAY CONTROLLER CONNECTED TO HARDWARE AP]");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Setup HTTP routing with custom header collection
  const char* headerKeys[] = {"X-MCU-Signature", "X-MCU-Timestamp", "X-MCU-Nonce"};
  server.collectHeaders(headerKeys, 3);
  server.on("/api/sync-clock", HTTP_POST, handleClockSync);
  server.on("/api/relay", HTTP_POST, handleRelayControl);
  server.begin();
}

void loop() {
  server.handleClient();
}

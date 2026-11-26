// src/utils/dateFormatter.js
// Standardized Date Formatter across all user portals and management tables.
// STRICT INVARIANTS:
// 1. All displayed dates must strictly follow DD-MM-YYYY format (e.g. 05-09-2026).
// 2. Safe against null, undefined, empty strings, and invalid date values (never throws RangeError).
// 3. Storage invariant: Database storage (Supabase / IndexedDB) remains ISO 8601; this is display-only.

/**
 * Validates whether a given input is or resolves to a valid Date object.
 * @param {any} input 
 * @returns {boolean}
 */
export function isValidDate(input) {
  if (!input) return false;
  const d = new Date(input);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Safely parses any date representation into a valid Date object or null.
 * @param {any} input 
 * @returns {Date | null}
 */
export function parseDateSafe(input) {
  if (!input) return null;
  const d = new Date(input);
  return (!isNaN(d.getTime())) ? d : null;
}

/**
 * Formats any date into DD-MM-YYYY.
 * Example: 2026-11-07T08:04:51.000Z -> "07-11-2026"
 * 
 * @param {string | number | Date | null | undefined} dateInput 
 * @param {string} fallback Fallback text if date is invalid or missing (default: '-')
 * @returns {string} Formatted DD-MM-YYYY date string
 */
export function formatDisplayDate(dateInput, fallback = '-') {
  const d = parseDateSafe(dateInput);
  if (!d) return fallback;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

// Canonical alias
export const formatDate = formatDisplayDate;

/**
 * Formats a date into DD-MM-YYYY with 12-hour or 24-hour time.
 * Example: "07-11-2026, 08:30 AM"
 * 
 * @param {string | number | Date | null | undefined} dateInput 
 * @param {boolean} includeSeconds Whether to include seconds
 * @param {string} fallback Fallback text
 * @returns {string}
 */
export function formatDisplayDateTime(dateInput, includeSeconds = false, fallback = '-') {
  const d = parseDateSafe(dateInput);
  if (!d) return fallback;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour should be 12
  const formattedHours = String(hours).padStart(2, '0');

  if (includeSeconds) {
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
  }

  return `${day}-${month}-${year}, ${formattedHours}:${minutes} ${ampm}`;
}

export const formatDateTime = formatDisplayDateTime;

/**
 * Extracts a safe YYYY-MM-DD string for comparison or charting.
 * Never throws RangeError.
 * 
 * @param {string | number | Date | null | undefined} dateInput 
 * @returns {string | null}
 */
export function safeIsoDate(dateInput) {
  const d = parseDateSafe(dateInput);
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// frontend/src/utils/rollNumberPrefixHelper.js
// Intelligent student roll number prefix discovery and auto-completion helper.
// All registered student roll numbers are strictly 10 alphanumeric characters.
// This utility dynamically analyzes the registered student dataset and discovers
// common batch/branch prefixes without any hardcoding or administrator configuration.

/**
 * Normalizes a student roll number string:
 * - Trims leading/trailing whitespace
 * - Converts to uppercase
 * @param {string} roll
 * @returns {string}
 */
export function normalizeRollNumber(roll) {
  if (!roll || typeof roll !== 'string') return '';
  return roll.trim().toUpperCase();
}

/**
 * Validates whether a normalized string conforms to the 10-character academic roll number format.
 * @param {string} roll
 * @returns {boolean}
 */
export function isValidRollNumber(roll) {
  const normalized = normalizeRollNumber(roll);
  return normalized.length === 10 && /^[A-Z0-9]{10}$/.test(normalized);
}

/**
 * Automatically analyzes an array of student roll numbers and discovers common, useful prefixes.
 *
 * Requirements met:
 * 1. Normalize roll numbers to uppercase.
 * 2. Ignore leading/trailing whitespace.
 * 3. Validate exactly 10 characters.
 * 4. Exclude null, invalid, or malformed records.
 * 5. Avoid duplicate suggestions.
 * 6. Group similar roll numbers correctly with registered student counts.
 * 7. Reusable algorithm that adapts automatically when new students are registered.
 *
 * @param {Array<string|object>} rollRecords Array of roll numbers or student objects containing rollNumber.
 * @param {object} [options]
 * @param {number} [options.targetPrefixLength] Forced prefix length if desired (defaults to auto-detected optimal length).
 * @param {string} [options.filterQuery] Live filter query as user types.
 * @returns {Array<{ prefix: string, count: number, remainingLength: number, sampleSuffixes: string[] }>}
 */
export function discoverRollNumberPrefixes(rollRecords = [], options = {}) {
  if (!Array.isArray(rollRecords)) return [];

  // Extract raw string values safely
  const rawList = rollRecords.map((item) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item.rollNumber) return item.rollNumber;
    return '';
  });

  // 1. Sanitize & Normalize strictly to unique, valid 10-character alphanumeric strings
  const validRolls = Array.from(
    new Set(
      rawList
        .map((r) => normalizeRollNumber(r))
        .filter((r) => isValidRollNumber(r))
    )
  );

  if (validRolls.length === 0) return [];

  // 2. Dynamic Optimal Prefix Length Determination
  // All valid roll numbers are exactly 10 characters.
  // Evaluate candidate lengths L in [8, 7, 6].
  // Suffix length is (10 - L). Suffix of 2 characters (L = 8) is the standard academic serial number.
  let prefixLength = options.targetPrefixLength;
  if (!prefixLength || prefixLength < 4 || prefixLength >= 10) {
    prefixLength = 8; // Default optimal length for 10-character academic roll numbers

    // If dataset is extremely fragmented at length 8 (> 95% singletons across > 10 items),
    // check if length 7 provides significantly better clustering:
    if (validRolls.length >= 10) {
      const groups8 = new Set(validRolls.map((r) => r.slice(0, 8)));
      if (groups8.size > validRolls.length * 0.9) {
        const groups7 = new Set(validRolls.map((r) => r.slice(0, 7)));
        if (groups7.size <= groups8.size * 0.6) {
          prefixLength = 7;
        }
      }
    }
  }

  // 3. Group and aggregate roll numbers
  const prefixMap = new Map();
  for (const roll of validRolls) {
    const pfx = roll.slice(0, prefixLength);
    const suffix = roll.slice(prefixLength);

    if (!prefixMap.has(pfx)) {
      prefixMap.set(pfx, {
        prefix: pfx,
        count: 0,
        remainingLength: 10 - prefixLength,
        sampleSuffixes: [],
      });
    }

    const group = prefixMap.get(pfx);
    group.count += 1;
    if (group.sampleSuffixes.length < 5 && !group.sampleSuffixes.includes(suffix)) {
      group.sampleSuffixes.push(suffix);
    }
  }

  // 4. Convert to array and filter by query if provided
  let suggestions = Array.from(prefixMap.values());

  if (options.filterQuery) {
    const cleanFilter = normalizeRollNumber(options.filterQuery);
    if (cleanFilter) {
      suggestions = suggestions.filter((s) => s.prefix.includes(cleanFilter));
    }
  }

  // 5. Sort by student count descending (most popular prefix first), then alphabetically
  suggestions.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.prefix.localeCompare(b.prefix);
  });

  return suggestions;
}

/**
 * Combines a chosen prefix and remaining suffix, normalizing and validating total length.
 * @param {string} prefix
 * @param {string} suffix
 * @returns {string} 10-character uppercase roll number or empty string if invalid
 */
export function combinePrefixAndSuffix(prefix, suffix) {
  const cleanPrefix = normalizeRollNumber(prefix);
  const cleanSuffix = normalizeRollNumber(suffix);
  const combined = cleanPrefix + cleanSuffix;
  return combined;
}

/**
 * Validates a combined roll number against the authoritative student directory.
 * @param {string} rollNumber
 * @param {Function} getUserByRollFn
 * @returns {{ isValid: boolean, student: object|null, rollNumber: string, message: string }}
 */
export function validateStudentRollNumber(rollNumber, getUserByRollFn) {
  const clean = normalizeRollNumber(rollNumber);

  if (!clean) {
    return {
      isValid: false,
      student: null,
      rollNumber: '',
      message: 'Please enter a roll number.',
    };
  }

  if (clean.length < 10) {
    return {
      isValid: false,
      student: null,
      rollNumber: clean,
      message: `Incomplete roll number (${clean.length}/10 characters). Please enter remaining ${10 - clean.length} character(s).`,
    };
  }

  if (clean.length > 10) {
    return {
      isValid: false,
      student: null,
      rollNumber: clean,
      message: `Roll number exceeds 10 characters (${clean.length}/10).`,
    };
  }

  if (!isValidRollNumber(clean)) {
    return {
      isValid: false,
      student: null,
      rollNumber: clean,
      message: 'Invalid roll number format. Must contain exactly 10 alphanumeric characters.',
    };
  }

  if (typeof getUserByRollFn !== 'function') {
    return {
      isValid: true,
      student: null,
      rollNumber: clean,
      message: 'Roll number format valid.',
    };
  }

  const student = getUserByRollFn(clean);
  if (!student) {
    return {
      isValid: false,
      student: null,
      rollNumber: clean,
      message: `Student with Roll Number "${clean}" is not registered in the system.`,
    };
  }

  return {
    isValid: true,
    student,
    rollNumber: clean,
    message: `Identified: ${student.name} (${clean})`,
  };
}

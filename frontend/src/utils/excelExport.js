// src/utils/excelExport.js
// Utility to download lab attendance records as a genuine Microsoft Excel (.xlsx) workbook.
// Generates authentic OpenXML spreadsheet binary format (PKZip) with metadata and detailed visit rows.
// Strictly accessible to Admin and Substitute Admin only.

import { formatDisplayDate } from './dateFormatter.js';

function crc32(uint8Array) {
  let crc = -1;
  for (let i = 0; i < uint8Array.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8Array[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function stringToUtf8(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const buf = new Uint8Array(str.length * 3);
  let p = 0;
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) {
      buf[p++] = c;
    } else if (c < 2048) {
      buf[p++] = (c >> 6) | 192;
      buf[p++] = (c & 63) | 128;
    } else {
      buf[p++] = (c >> 12) | 224;
      buf[p++] = ((c >> 6) & 63) | 128;
      buf[p++] = (c & 63) | 128;
    }
  }
  return buf.subarray(0, p);
}

export function buildZip(files) {
  const parts = [];
  const centralDirParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = stringToUtf8(file.name);
    const dataBytes = file.data instanceof Uint8Array ? file.data : stringToUtf8(file.data);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes)
    const localHeader = new Uint8Array(30);
    const lView = new DataView(localHeader.buffer);
    lView.setUint32(0, 0x04034b50, true);
    lView.setUint16(4, 20, true);
    lView.setUint16(6, 0, true);
    lView.setUint16(8, 0, true);
    lView.setUint16(10, 0x4000, true);
    lView.setUint16(12, 0x5400, true);
    lView.setUint32(14, crc, true);
    lView.setUint32(18, size, true);
    lView.setUint32(22, size, true);
    lView.setUint16(26, nameBytes.length, true);
    lView.setUint16(28, 0, true);

    parts.push(localHeader, nameBytes, dataBytes);

    // Central directory header (46 bytes)
    const cdHeader = new Uint8Array(46);
    const cdView = new DataView(cdHeader.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0x4000, true);
    cdView.setUint16(14, 0x5400, true);
    cdView.setUint32(16, crc, true);
    cdView.setUint32(20, size, true);
    cdView.setUint32(24, size, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, offset, true);

    centralDirParts.push(cdHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + size;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const p of centralDirParts) cdSize += p.length;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, files.length, true);
  eView.setUint16(10, files.length, true);
  eView.setUint32(12, cdSize, true);
  eView.setUint32(16, cdOffset, true);
  eView.setUint16(20, 0, true);

  // Combine all Uint8Arrays
  const totalLength = offset + cdSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of [...parts, ...centralDirParts, eocd]) {
    result.set(part, pos);
    pos += part.length;
  }

  return result;
}

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateGenuineXlsx(rows, sheetName = 'Attendance') {
  let sheetData = '';
  rows.forEach((row, rIdx) => {
    const rowNum = rIdx + 1;
    let rowXml = `<row r="${rowNum}">`;
    row.forEach((cellVal, cIdx) => {
      let colLetter = '';
      let temp = cIdx;
      while (temp >= 0) {
        colLetter = String.fromCharCode((temp % 26) + 65) + colLetter;
        temp = Math.floor(temp / 26) - 1;
      }
      const cellRef = `${colLetter}${rowNum}`;

      if (cellVal === null || cellVal === undefined || cellVal === '') {
        return;
      }

      if (typeof cellVal === 'number') {
        rowXml += `<c r="${cellRef}" t="n"><v>${cellVal}</v></c>`;
      } else {
        const val = escapeXml(cellVal);
        rowXml += `<c r="${cellRef}" t="inlineStr"><is><t>${val}</t></is></c>`;
      }
    });
    rowXml += '</row>';
    sheetData += rowXml;
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetData}</sheetData>
</worksheet>`;

  const files = [
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
  ];

  return buildZip(files);
}

/**
 * Downloads attendance data as an authentic Microsoft Excel (.xlsx) file.
 * Accepts either an array of records or a report result object containing metadata.
 */
export function downloadAttendanceExcel(attendanceData, baseFileName = 'Incubation_Centre_Attendance') {
  let records = [];
  let metadata = null;

  if (attendanceData && Array.isArray(attendanceData.records)) {
    records = attendanceData.records;
    metadata = {
      startDate: attendanceData.startDate,
      endDate: attendanceData.endDate,
      generatedAt: attendanceData.generatedAt,
      totalVisits: attendanceData.totalVisits || records.length,
      totalUniqueStudents: attendanceData.totalUniqueStudents || new Set(records.map(r => r.rollNumber)).size,
      totalHours: attendanceData.totalHours || '0.0',
    };
  } else if (Array.isArray(attendanceData)) {
    records = attendanceData;
  }

  if (!records || records.length === 0) {
    throw new Error('No attendance records available for the selected period to export.');
  }

  const rows = [];

  // 1. Report Metadata Headers
  rows.push(['VRSEC Smart Incubation Centre — Lab Attendance Report']);
  rows.push(['Report Generated At (IST):', metadata?.generatedAt || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]);
  if (metadata?.startDate || metadata?.endDate) {
    rows.push(['Selected Date Range:', `From: ${metadata.startDate || 'Beginning'} To: ${metadata.endDate || 'Latest'}`]);
  }
  rows.push(['Total Attendance Visits:', metadata?.totalVisits || records.length]);
  rows.push(['Total Unique Students:', metadata?.totalUniqueStudents || new Set(records.map(r => r.rollNumber || r.RollNumber)).size]);
  rows.push([]); // Empty separator line

  // 2. Exact Requested Columns
  rows.push([
    'Serial Number',
    'Student Name',
    'Roll Number',
    'Department',
    'Attendance Date',
    'Entry Time',
    'Exit Time',
    'Duration',
    'Visit Status',
    'Number of Visits on Date',
  ]);

  // 3. Data Rows
  records.forEach((r, idx) => {
    rows.push([
      r.serialNumber || (idx + 1),
      r.studentName || r.StudentName || '',
      r.rollNumber || r.RollNumber || '',
      r.department || r.Department || 'ECE',
      formatDisplayDate(r.attendanceDate || r.Date || ''),
      r.entryTime || r.EntryTime || '',
      r.exitTime || r.ExitTime || '',
      r.duration || r.Duration || '',
      r.visitStatus || (r.exitTime && r.exitTime !== 'Still Inside' ? 'Completed' : 'Currently Inside'),
      r.visitsCountOnDate || 1,
    ]);
  });

  const xlsxBytes = generateGenuineXlsx(rows, 'Lab Attendance');

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([xlsxBytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.download = `${baseFileName}_${dateStamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return true;
}

// src/utils/calendarExport.js
// Utility for exporting published events to Google Calendar and downloading standard .ics files

/**
 * Formats a date string or timestamp into Google Calendar / iCalendar format: YYYYMMDDTHHmmssZ
 * @param {string | number | Date} dateInput 
 * @returns {string} Formatted timestamp
 */
function formatUtcCompact(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return fallback.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Formats an all-day date: YYYYMMDD
 * @param {string | number | Date} dateInput 
 * @returns {string}
 */
function formatAllDayCompact(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    const yr = fallback.getFullYear();
    const mo = String(fallback.getMonth() + 1).padStart(2, '0');
    const da = String(fallback.getDate()).padStart(2, '0');
    return `${yr}${mo}${da}`;
  }
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}${mo}${da}`;
}

/**
 * Generates a pre-filled Google Calendar web link for an event.
 * @param {object} event Event object with title, eventDate, description, theme, organizer, externalUrl, etc.
 * @returns {string} Google Calendar event URL
 */
export function generateGoogleCalendarUrl(event) {
  if (!event) return 'https://calendar.google.com';

  const title = event.title || 'VRSEC Incubation Centre Event';
  const organizer = event.organizer || 'VRSEC Incubation Centre & Dept of ECE';
  const location = 'VRSEC Incubation Centre, Department of ECE';

  let details = '';
  if (event.theme) details += `Theme: ${event.theme}\n\n`;
  if (event.description) details += `${event.description}\n\n`;
  if (event.prizes) details += `Prizes / Recognition: ${event.prizes}\n\n`;
  if (event.registrationUrl || event.externalUrl) {
    details += `Registration Link: ${event.registrationUrl || event.externalUrl}\n\n`;
  }
  details += `Organizer: ${organizer}`;

  const startDate = event.eventDate ? formatAllDayCompact(event.eventDate) : formatAllDayCompact(new Date());
  // End date is next day for an all-day event
  const dNext = event.eventDate ? new Date(event.eventDate) : new Date();
  dNext.setDate(dNext.getDate() + 1);
  const endDate = formatAllDayCompact(dNext);

  const datesParam = `${startDate}/${endDate}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: datesParam,
    details: details.trim(),
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates and triggers download of an authentic iCalendar (.ics) file for an event.
 * Compatible with Microsoft Outlook, Apple Calendar, Google Calendar, and Android.
 * @param {object} event 
 */
export function downloadIcsFile(event) {
  if (!event || typeof window === 'undefined') return;

  const title = event.title || 'VRSEC Incubation Centre Event';
  const organizer = event.organizer || 'VRSEC Incubation Centre & Dept of ECE';
  const location = 'VRSEC Incubation Centre, Department of ECE';

  let description = '';
  if (event.theme) description += `Theme: ${event.theme}\\n\\n`;
  if (event.description) description += `${event.description.replace(/\n/g, '\\n')}\\n\\n`;
  if (event.prizes) description += `Prizes: ${event.prizes}\\n\\n`;
  if (event.registrationUrl || event.externalUrl) {
    description += `Registration: ${event.registrationUrl || event.externalUrl}\\n\\n`;
  }
  description += `Organizer: ${organizer}`;

  const startDate = event.eventDate ? formatAllDayCompact(event.eventDate) : formatAllDayCompact(new Date());
  const dNext = event.eventDate ? new Date(event.eventDate) : new Date();
  dNext.setDate(dNext.getDate() + 1);
  const endDate = formatAllDayCompact(dNext);

  const nowStamp = formatUtcCompact(new Date());
  const uid = `inc-event-${event.id || String(Date.now())}@vrsec.ac.in`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VRSEC Incubation Centre//Management System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${title.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
  link.download = `${safeFilename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

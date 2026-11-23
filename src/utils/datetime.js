// All clinic times are "wall-clock" times with no timezone, matching MySQL DATETIME.
const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n) => String(n).padStart(2, '0');

function parseClinicDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = DATETIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => (part === undefined ? 0 : Number(part)));
  const date = new Date(year, month - 1, day, hour, minute, second);
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second;
  return roundTrips ? date : null;
}

function isValidDateOnly(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatSqlDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatSqlDateTime(date) {
  return `${formatSqlDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

module.exports = { parseClinicDateTime, isValidDateOnly, formatSqlDate, formatSqlDateTime, addDays };

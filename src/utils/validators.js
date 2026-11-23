const { badRequest } = require('./errors');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-() ]{7,20}$/;
const MAX_FEE = 99999999.99;

const isNonEmptyString = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

/** Returns an array of human-readable problems (empty array = valid). */
function validatePatientInput(body) {
  const problems = [];
  if (!body || typeof body !== 'object') return ['Request body must be a JSON object'];
  if (!isNonEmptyString(body.fullName, 100)) problems.push('fullName is required (max 100 characters)');
  if (!isNonEmptyString(body.email, 150) || !EMAIL_PATTERN.test(body.email.trim())) problems.push('email must be a valid email address');
  if (typeof body.phone !== 'string' || !PHONE_PATTERN.test(body.phone.trim())) problems.push('phone must be 7-20 characters of digits, spaces, +, - or ()');
  return problems;
}

function validateDoctorInput(body) {
  const problems = [];
  if (!body || typeof body !== 'object') return ['Request body must be a JSON object'];
  if (!isNonEmptyString(body.fullName, 100)) problems.push('fullName is required (max 100 characters)');
  if (!isNonEmptyString(body.specialty, 80)) problems.push('specialty is required (max 80 characters)');
  if (!isNonEmptyString(body.room, 10)) problems.push('room is required (max 10 characters)');
  const fee = body.consultationFee;
  if (typeof fee !== 'number' || Number.isNaN(fee) || fee < 0 || fee > MAX_FEE) problems.push('consultationFee must be a number between 0 and 99999999.99');
  return problems;
}

function assertValid(problems) {
  if (problems.length > 0) throw badRequest(problems.join('; '), { problems });
}

function parseId(raw, label = 'id') {
  const text = String(raw);
  if (!/^[1-9]\d*$/.test(text)) throw badRequest(`${label} must be a positive integer`);
  return Number(text);
}

module.exports = { validatePatientInput, validateDoctorInput, assertValid, parseId };

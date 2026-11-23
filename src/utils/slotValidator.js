const { business } = require('../config');
const { parseClinicDateTime } = require('./datetime');

const codes = Object.freeze({
  INVALID_DATETIME: 'INVALID_DATETIME',
  SLOT_IN_PAST: 'SLOT_IN_PAST',
  OUTSIDE_WORKING_HOURS: 'OUTSIDE_WORKING_HOURS',
  NOT_ON_SLOT_BOUNDARY: 'NOT_ON_SLOT_BOUNDARY',
});

const fail = (code, message) => ({ valid: false, code, message });

/**
 * Pure function: decides whether a requested start time is a bookable slot.
 * A slot must START at 09:00 or later and END by 17:00, so the last start is 16:30
 * (17:00 exactly is rejected because 17:00-17:30 is outside working hours).
 */
function validateSlot(input, now = new Date()) {
  const date = parseClinicDateTime(input);
  if (!date) {
    return fail(codes.INVALID_DATETIME, 'appointmentDatetime must be a real date in the format YYYY-MM-DD HH:mm');
  }
  if (date.getTime() <= now.getTime()) {
    return fail(codes.SLOT_IN_PAST, 'Appointments can only be booked in the future');
  }

  const startMinutes = date.getHours() * 60 + date.getMinutes();
  const earliest = business.WORK_START_HOUR * 60;
  const latestEnd = business.WORK_END_HOUR * 60;
  if (startMinutes < earliest || startMinutes + business.SLOT_MINUTES > latestEnd) {
    return fail(
      codes.OUTSIDE_WORKING_HOURS,
      `Appointments must fit within working hours (${business.WORK_START_HOUR}:00-${business.WORK_END_HOUR}:00); the last slot starts at 16:30`
    );
  }
  if (date.getMinutes() % business.SLOT_MINUTES !== 0 || date.getSeconds() !== 0) {
    return fail(codes.NOT_ON_SLOT_BOUNDARY, `Appointments must start on a ${business.SLOT_MINUTES}-minute boundary (e.g. 09:00, 09:30)`);
  }
  return { valid: true, date };
}

module.exports = { validateSlot, slotErrorCodes: codes };

const { business } = require('../config');
const appointmentModel = require('../models/appointmentModel');
const patientModel = require('../models/patientModel');
const doctorModel = require('../models/doctorModel');
const waitlistQueue = require('../queue/waitlistQueue');
const bookingService = require('./bookingService');
const { enqueueJob, jobTypes } = require('../queue/jobQueue');
const { validateSlot, slotErrorCodes } = require('../utils/slotValidator');
const { formatSqlDate, formatSqlDateTime, addDays, isValidDateOnly } = require('../utils/datetime');
const { AppError, badRequest, notFound, conflict, unprocessable } = require('../utils/errors');
const { parseId } = require('../utils/validators');
const { audit } = require('../utils/auditLogger');

async function joinWaitlist(input, { now = new Date() } = {}) {
  const patientId = parseId(input.patientId, 'patientId');
  const doctorId = parseId(input.doctorId, 'doctorId');

  const slot = validateSlot(input.appointmentDatetime, now);
  if (!slot.valid) {
    throw slot.code === slotErrorCodes.INVALID_DATETIME ? badRequest(slot.message) : unprocessable(slot.code, slot.message);
  }

  if (!(await patientModel.findById(patientId))) throw notFound(`Patient ${patientId} not found`);
  if (!(await doctorModel.findById(doctorId))) throw notFound(`Doctor ${doctorId} not found`);

  const date = formatSqlDate(slot.date);
  const availability = await appointmentModel.getAvailability(doctorId, formatSqlDateTime(slot.date), `${date} 00:00:00`, `${formatSqlDate(addDays(slot.date, 1))} 00:00:00`);
  if (!availability.slotTaken && availability.dayCount < business.DAILY_CAP) {
    throw conflict('SLOT_AVAILABLE', 'That slot is still free - book it directly instead of joining the waitlist');
  }

  let result;
  try {
    result = await waitlistQueue.join({
      patientId,
      doctorId,
      date,
      requestedDatetime: formatSqlDateTime(slot.date),
      joinedAt: now.toISOString(),
    });
  } catch (error) {
    throw new AppError(503, 'QUEUE_UNAVAILABLE', 'The waitlist is temporarily unavailable, please try again shortly');
  }
  if (result.duplicate) throw conflict('ALREADY_WAITLISTED', 'This patient is already on the waitlist for that doctor and day');

  audit('waitlist_joined', { patientId, doctorId, date, position: result.position });
  return { position: result.position, doctorId, date };
}

async function viewWaitlist(rawDoctorId, date) {
  const doctorId = parseId(rawDoctorId, 'doctorId');
  if (!isValidDateOnly(date)) throw badRequest('date is required in the format YYYY-MM-DD');
  return waitlistQueue.list(doctorId, date);
}

/**
 * Worker-side logic for a freed slot. Promotes the first waitlisted patient for that doctor/day.
 * Guarantee: the patient is always either booked, still in the waiting list, or in the failed list.
 */
async function promoteFromWaitlist({ doctorId, datetime, attempt = 1 }) {
  const date = datetime.slice(0, 10);

  for (;;) {
    const claimed = await waitlistQueue.claimNext(doctorId, date);
    if (!claimed) return { status: 'EMPTY' };
    const { raw, entry } = claimed;

    try {
      const appointment = await bookingService.bookAppointment(
        { patientId: entry.patientId, doctorId, appointmentDatetime: datetime },
        { source: 'waitlist' }
      );
      await waitlistQueue.confirm(doctorId, date, raw);
      await audit('waitlist_promoted', { patientId: entry.patientId, doctorId, appointmentId: appointment.id, appointmentDatetime: datetime });
      return { status: 'PROMOTED', appointmentId: appointment.id };
    } catch (error) {
      const expected = error instanceof AppError;

      if (expected && error.status === 404) {
        // This patient can never be booked (e.g. deleted). Park them in the failed list and try the next person.
        await waitlistQueue.deadLetter(doctorId, date, raw, error.code);
        await audit('waitlist_promotion_failed', { patientId: entry.patientId, doctorId, reason: error.code, outcome: 'moved_to_failed_list' });
        continue;
      }

      // Slot taken by someone else / no longer bookable / infrastructure problem: the patient keeps their place.
      await waitlistQueue.returnToFront(doctorId, date, raw);
      await audit('waitlist_promotion_failed', { patientId: entry.patientId, doctorId, reason: expected ? error.code : error.message, outcome: 'returned_to_front', attempt });

      if (!expected && attempt < business.WAITLIST_MAX_ATTEMPTS) {
        await enqueueJob(jobTypes.SLOT_FREED, { doctorId, datetime, attempt: attempt + 1 });
        return { status: 'RETRY_SCHEDULED' };
      }
      return { status: expected ? 'SLOT_NO_LONGER_AVAILABLE' : 'GAVE_UP' };
    }
  }
}

module.exports = { joinWaitlist, viewWaitlist, promoteFromWaitlist };

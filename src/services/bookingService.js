const { business } = require('../config');
const appointmentModel = require('../models/appointmentModel');
const patientModel = require('../models/patientModel');
const doctorModel = require('../models/doctorModel');
const { validateSlot, slotErrorCodes } = require('../utils/slotValidator');
const { calculateRefund } = require('../utils/refundCalculator');
const { parseClinicDateTime, formatSqlDate, formatSqlDateTime, addDays } = require('../utils/datetime');
const { badRequest, notFound, conflict, unprocessable } = require('../utils/errors');
const { parseId } = require('../utils/validators');
const { audit } = require('../utils/auditLogger');
const { enqueueJob, jobTypes } = require('../queue/jobQueue');

const DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

function assertSlotIsValid(appointmentDatetime, now) {
  const slot = validateSlot(appointmentDatetime, now);
  if (slot.valid) return slot.date;
  if (slot.code === slotErrorCodes.INVALID_DATETIME) throw badRequest(slot.message);
  throw unprocessable(slot.code, slot.message);
}

function slotWindow(slotDate) {
  return {
    slotStart: formatSqlDateTime(slotDate),
    dayStart: `${formatSqlDate(slotDate)} 00:00:00`,
    dayEnd: `${formatSqlDate(addDays(slotDate, 1))} 00:00:00`,
  };
}

function waitlistOffer(patientId, doctorId, appointmentDatetime) {
  return {
    offered: true,
    join: { method: 'POST', path: '/api/waitlist', body: { patientId, doctorId, appointmentDatetime } },
  };
}

// A failed notification must never fail the booking itself.
async function queueConfirmation(appointment, patient, doctor) {
  try {
    await enqueueJob(jobTypes.CONFIRMATION, {
      appointmentId: appointment.id,
      channel: 'email',
      to: patient.email,
      message: `Hi ${patient.fullName}, your appointment with ${doctor.fullName} (room ${doctor.room}) is confirmed for ${appointment.appointmentDatetime}.`,
    });
  } catch (error) {
    console.error('[queue] could not enqueue confirmation job:', error.message);
  }
}

async function bookAppointment(input, { source = 'api', now = new Date() } = {}) {
  const patientId = parseId(input.patientId, 'patientId');
  const doctorId = parseId(input.doctorId, 'doctorId');
  const slotDate = assertSlotIsValid(input.appointmentDatetime, now);

  const patient = await patientModel.findById(patientId);
  if (!patient) throw notFound(`Patient ${patientId} not found`);

  const { slotStart, dayStart, dayEnd } = slotWindow(slotDate);
  const offer = waitlistOffer(patientId, doctorId, slotStart.slice(0, 16));

  let appointment;
  try {
    appointment = await appointmentModel.createBooked(
      { patientId, doctorId, slotStart, dayStart, dayEnd, bookedOn: formatSqlDateTime(now) },
      ({ doctor, slotTaken, dayCount }) => {
        if (!doctor) throw notFound(`Doctor ${doctorId} not found`);
        if (slotTaken) throw conflict('SLOT_TAKEN', 'This doctor already has an appointment at that time', { waitlist: offer });
        if (dayCount >= business.DAILY_CAP) {
          throw conflict('DAILY_CAP_REACHED', `This doctor is fully booked on that day (${business.DAILY_CAP} appointments)`, { waitlist: offer });
        }
        return doctor.consultationFee;
      }
    );
  } catch (error) {
    if (error.code === DUPLICATE_ENTRY) {
      throw conflict('SLOT_TAKEN', 'This doctor already has an appointment at that time', { waitlist: offer });
    }
    throw error;
  }

  const doctor = await doctorModel.findById(doctorId);
  audit('appointment_booked', { source, appointmentId: appointment.id, patientId, doctorId, appointmentDatetime: appointment.appointmentDatetime, amountPaid: appointment.amountPaid });
  await queueConfirmation(appointment, patient, doctor);
  return appointment;
}

async function cancelAppointment(rawId, { now = new Date() } = {}) {
  const id = parseId(rawId, 'appointment id');

  const appointment = await appointmentModel.cancelBooked(id, (row) => {
    if (!row) throw notFound(`Appointment ${id} not found`);
    if (row.status === 'cancelled') throw conflict('ALREADY_CANCELLED', 'This appointment has already been cancelled');
    const appointmentDate = parseClinicDateTime(row.appointmentDatetime);
    if (appointmentDate.getTime() <= now.getTime()) {
      throw unprocessable('APPOINTMENT_IN_PAST', 'Appointments that have already started cannot be cancelled');
    }
    const refund = calculateRefund(row.amountPaid, appointmentDate, now);
    return { refundPercent: refund.percent, refundAmount: refund.amount, cancelledAt: formatSqlDateTime(now) };
  });

  audit('appointment_cancelled', {
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    appointmentDatetime: appointment.appointmentDatetime,
    refundPercent: appointment.refundPercent,
    refundAmount: appointment.refundAmount,
  });

  // Tell the waitlist worker that a slot is free. Failure here must not undo a committed cancellation.
  try {
    await enqueueJob(jobTypes.SLOT_FREED, { doctorId: appointment.doctorId, datetime: appointment.appointmentDatetime, attempt: 1 });
  } catch (error) {
    console.error('[queue] could not enqueue slot_freed job:', error.message);
  }

  return {
    appointment,
    refund: { percent: appointment.refundPercent, amount: appointment.refundAmount },
  };
}

module.exports = { bookAppointment, cancelAppointment };

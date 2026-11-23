const appointmentModel = require('../models/appointmentModel');
const bookingService = require('../services/bookingService');
const { notFound, badRequest } = require('../utils/errors');
const { parseId } = require('../utils/validators');

const STATUSES = ['booked', 'cancelled'];

async function bookAppointment(req, res) {
  const appointment = await bookingService.bookAppointment(req.body || {});
  res.status(201).json(appointment);
}

async function cancelAppointment(req, res) {
  const { appointment, refund } = await bookingService.cancelAppointment(req.params.id);
  res.json({ message: `Appointment cancelled. Refund: ${refund.amount.toFixed(2)} (${refund.percent}%)`, appointment, refund });
}

async function getAppointment(req, res) {
  const id = parseId(req.params.id);
  const appointment = await appointmentModel.findById(id);
  if (!appointment) throw notFound(`Appointment ${id} not found`);
  res.json(appointment);
}

async function listAppointments(req, res) {
  const { doctorId, patientId, status } = req.query;
  if (status !== undefined && !STATUSES.includes(status)) throw badRequest(`status must be one of: ${STATUSES.join(', ')}`);
  res.json(
    await appointmentModel.findAll({
      doctorId: doctorId === undefined ? null : parseId(doctorId, 'doctorId'),
      patientId: patientId === undefined ? null : parseId(patientId, 'patientId'),
      status: status === undefined ? null : status,
    })
  );
}

module.exports = { bookAppointment, cancelAppointment, getAppointment, listAppointments };

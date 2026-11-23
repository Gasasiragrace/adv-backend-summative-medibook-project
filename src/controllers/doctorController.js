const { business } = require('../config');
const doctorModel = require('../models/doctorModel');
const reportModel = require('../models/reportModel');
const { notFound } = require('../utils/errors');
const { validateDoctorInput, assertValid, parseId } = require('../utils/validators');
const { formatSqlDate, formatSqlDateTime, addDays } = require('../utils/datetime');

const clean = (body) => ({
  fullName: body.fullName.trim(),
  specialty: body.specialty.trim(),
  consultationFee: body.consultationFee,
  room: body.room.trim(),
});

async function createDoctor(req, res) {
  assertValid(validateDoctorInput(req.body));
  res.status(201).json(await doctorModel.create(clean(req.body)));
}

async function listDoctors(req, res) {
  res.json(await doctorModel.findAll());
}

async function getDoctor(req, res) {
  const id = parseId(req.params.id);
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw notFound(`Doctor ${id} not found`);
  res.json(doctor);
}

async function updateDoctor(req, res) {
  const id = parseId(req.params.id);
  assertValid(validateDoctorInput(req.body));
  if (!(await doctorModel.findById(id))) throw notFound(`Doctor ${id} not found`);
  res.json(await doctorModel.update(id, clean(req.body)));
}

async function deleteDoctor(req, res) {
  const id = parseId(req.params.id);
  if (!(await doctorModel.remove(id))) throw notFound(`Doctor ${id} not found`);
  res.status(204).send();
}

async function getDoctorStatistics(req, res) {
  const id = parseId(req.params.id);
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw notFound(`Doctor ${id} not found`);

  const now = new Date();
  const days = business.STATS_WINDOW_DAYS;
  const windowStart = formatSqlDate(now);
  const windowEnd = formatSqlDate(addDays(now, days));

  const [totals, perDay, window] = await Promise.all([
    reportModel.getDoctorTotals(id, formatSqlDateTime(now)),
    reportModel.getDailyCounts(id, windowStart, days, business.DAILY_CAP),
    reportModel.getWindowUtilization(id, windowStart, windowEnd, days, business.DAILY_CAP),
  ]);

  res.json({
    doctor,
    revenueCollected: totals.revenueCollected,
    upcomingAppointments: totals.upcomingCount,
    nextDays: perDay,
    utilization: { windowDays: days, capacityPerDay: business.DAILY_CAP, bookedInWindow: window.bookedInWindow, percent: window.utilizationPercent },
  });
}

module.exports = { createDoctor, listDoctors, getDoctor, updateDoctor, deleteDoctor, getDoctorStatistics };

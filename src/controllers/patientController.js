const patientModel = require('../models/patientModel');
const { notFound } = require('../utils/errors');
const { validatePatientInput, assertValid, parseId } = require('../utils/validators');

const clean = (body) => ({ fullName: body.fullName.trim(), email: body.email.trim().toLowerCase(), phone: body.phone.trim() });

async function createPatient(req, res) {
  assertValid(validatePatientInput(req.body));
  res.status(201).json(await patientModel.create(clean(req.body)));
}

async function listPatients(req, res) {
  res.json(await patientModel.findAll());
}

async function getPatient(req, res) {
  const id = parseId(req.params.id);
  const patient = await patientModel.findById(id);
  if (!patient) throw notFound(`Patient ${id} not found`);
  res.json(patient);
}

async function updatePatient(req, res) {
  const id = parseId(req.params.id);
  assertValid(validatePatientInput(req.body));
  if (!(await patientModel.findById(id))) throw notFound(`Patient ${id} not found`);
  res.json(await patientModel.update(id, clean(req.body)));
}

async function deletePatient(req, res) {
  const id = parseId(req.params.id);
  if (!(await patientModel.remove(id))) throw notFound(`Patient ${id} not found`);
  res.status(204).send();
}

module.exports = { createPatient, listPatients, getPatient, updatePatient, deletePatient };

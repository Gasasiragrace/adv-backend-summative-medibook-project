const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/patientController');

const router = express.Router();
router.route('/').get(asyncHandler(controller.listPatients)).post(asyncHandler(controller.createPatient));
router.route('/:id').get(asyncHandler(controller.getPatient)).put(asyncHandler(controller.updatePatient)).delete(asyncHandler(controller.deletePatient));

module.exports = router;

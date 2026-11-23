const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/appointmentController');

const router = express.Router();
router.route('/').get(asyncHandler(controller.listAppointments)).post(asyncHandler(controller.bookAppointment));
// DELETE cancels: the appointment leaves the active schedule but the record is kept (soft delete) for refund history.
router.route('/:id').get(asyncHandler(controller.getAppointment)).delete(asyncHandler(controller.cancelAppointment));

module.exports = router;

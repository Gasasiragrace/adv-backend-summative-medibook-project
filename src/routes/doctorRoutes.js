const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/doctorController');

const router = express.Router();
router.route('/').get(asyncHandler(controller.listDoctors)).post(asyncHandler(controller.createDoctor));
router.get('/:id/statistics', asyncHandler(controller.getDoctorStatistics));
router.route('/:id').get(asyncHandler(controller.getDoctor)).put(asyncHandler(controller.updateDoctor)).delete(asyncHandler(controller.deleteDoctor));

module.exports = router;

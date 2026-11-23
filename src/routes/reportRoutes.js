const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/reportController');

const router = express.Router();
router.get('/doctors', asyncHandler(controller.doctorsReport));
router.get('/busy-days', asyncHandler(controller.busyDaysReport));

module.exports = router;

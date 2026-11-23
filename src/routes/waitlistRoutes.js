const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/waitlistController');

const router = express.Router();
router.route('/').get(asyncHandler(controller.viewWaitlist)).post(asyncHandler(controller.joinWaitlist));

module.exports = router;

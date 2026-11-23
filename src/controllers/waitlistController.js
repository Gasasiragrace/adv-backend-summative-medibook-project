const waitlistService = require('../services/waitlistService');

async function joinWaitlist(req, res) {
  const entry = await waitlistService.joinWaitlist(req.body || {});
  res.status(201).json({ message: `You are number ${entry.position} on the waitlist`, ...entry });
}

async function viewWaitlist(req, res) {
  res.json(await waitlistService.viewWaitlist(req.query.doctorId, req.query.date));
}

module.exports = { joinWaitlist, viewWaitlist };

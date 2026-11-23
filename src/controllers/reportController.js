const { business } = require('../config');
const reportModel = require('../models/reportModel');

async function doctorsReport(req, res) {
  res.json(await reportModel.getDoctorsReport());
}

async function busyDaysReport(req, res) {
  res.json({
    thresholdPercent: business.BUSY_DAY_THRESHOLD_PERCENT,
    capacityPerDay: business.DAILY_CAP,
    busyDays: await reportModel.getBusyDays(business.DAILY_CAP, business.BUSY_DAY_THRESHOLD_PERCENT),
  });
}

module.exports = { doctorsReport, busyDaysReport };

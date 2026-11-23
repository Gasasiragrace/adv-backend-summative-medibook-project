const { business } = require('../config');

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Pure function. Refund policy (boundaries are inclusive on the 50% tier):
 *   notice  > 48h           -> 100%
 *   24h <= notice <= 48h    -> 50%   (exactly 48h and exactly 24h both give 50%)
 *   notice  < 24h           -> 0%
 */
function calculateRefund(amountPaid, appointmentDate, cancelledAt) {
  if (!(appointmentDate instanceof Date) || !(cancelledAt instanceof Date) || Number.isNaN(appointmentDate.getTime()) || Number.isNaN(cancelledAt.getTime())) {
    throw new TypeError('appointmentDate and cancelledAt must be valid Dates');
  }
  if (typeof amountPaid !== 'number' || Number.isNaN(amountPaid) || amountPaid < 0) {
    throw new TypeError('amountPaid must be a non-negative number');
  }

  const hoursNotice = (appointmentDate.getTime() - cancelledAt.getTime()) / MS_PER_HOUR;

  let percent = business.REFUND_NONE_PERCENT;
  let tier = 'NONE';
  if (hoursNotice > business.REFUND_FULL_NOTICE_HOURS) {
    percent = business.REFUND_FULL_PERCENT;
    tier = 'FULL';
  } else if (hoursNotice >= business.REFUND_PARTIAL_NOTICE_HOURS) {
    percent = business.REFUND_PARTIAL_PERCENT;
    tier = 'PARTIAL';
  }

  // Work in cents to avoid floating point drift on money.
  const refundCents = Math.round((Math.round(amountPaid * 100) * percent) / 100);
  return { tier, percent, amount: refundCents / 100, hoursNotice };
}

module.exports = { calculateRefund };

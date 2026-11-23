const pool = require('../db/pool');

/** Revenue = what the clinic keeps: amount paid minus any refund issued. */
async function getDoctorTotals(doctorId, now) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(amount_paid - COALESCE(refund_amount, 0)), 0) AS revenueCollected,
            COALESCE(SUM(status = 'booked' AND appt_datetime > ?), 0) AS upcomingCount
       FROM appointments
      WHERE doctor_id = ?`,
    [now, doctorId]
  );
  return rows[0];
}

/** One row per day for the next `days` days (zero-filled via a recursive CTE). */
async function getDailyCounts(doctorId, windowStart, days, dailyCap) {
  const [rows] = await pool.execute(
    `WITH RECURSIVE day_series AS (
        SELECT CAST(? AS DATE) AS day, 1 AS n
        UNION ALL
        SELECT day + INTERVAL 1 DAY, n + 1 FROM day_series WHERE n < ?
     )
     SELECT s.day AS day,
            COUNT(a.id) AS appointmentCount,
            ROUND(100 * COUNT(a.id) / ?, 1) AS utilizationPercent
       FROM day_series s
       LEFT JOIN appointments a
              ON a.doctor_id = ?
             AND a.status = 'booked'
             AND a.appt_datetime >= s.day
             AND a.appt_datetime < s.day + INTERVAL 1 DAY
      GROUP BY s.day
      ORDER BY s.day`,
    [windowStart, days, dailyCap, doctorId]
  );
  return rows;
}

async function getWindowUtilization(doctorId, windowStart, windowEnd, days, dailyCap) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS bookedInWindow,
            ROUND(100 * COUNT(*) / (? * ?), 1) AS utilizationPercent
       FROM appointments
      WHERE doctor_id = ? AND status = 'booked' AND appt_datetime >= ? AND appt_datetime < ?`,
    [days, dailyCap, doctorId, windowStart, windowEnd]
  );
  return rows[0];
}

/** Every doctor, including those with zero appointments (LEFT JOIN). */
async function getDoctorsReport() {
  const [rows] = await pool.execute(
    `SELECT d.id AS doctorId,
            d.full_name AS doctorName,
            d.specialty,
            COUNT(a.id) AS totalAppointments,
            COALESCE(SUM(a.status = 'booked'), 0) AS activeAppointments,
            COALESCE(SUM(a.status = 'cancelled'), 0) AS cancelledAppointments,
            COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenueCollected
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.id
      GROUP BY d.id, d.full_name, d.specialty
      ORDER BY d.id`
  );
  return rows;
}

/** (doctor, date) pairs where booked slots exceed `thresholdPercent` of the daily cap. */
async function getBusyDays(dailyCap, thresholdPercent) {
  const [rows] = await pool.execute(
    `SELECT d.id AS doctorId,
            d.full_name AS doctorName,
            DATE(a.appt_datetime) AS date,
            COUNT(*) AS bookedSlots,
            ROUND(100 * COUNT(*) / ?, 1) AS utilizationPercent
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
      WHERE a.status = 'booked'
      GROUP BY d.id, d.full_name, DATE(a.appt_datetime)
     HAVING 100 * COUNT(*) / ? > ?
      ORDER BY date, d.id`,
    [dailyCap, dailyCap, thresholdPercent]
  );
  return rows;
}

module.exports = { getDoctorTotals, getDailyCounts, getWindowUtilization, getDoctorsReport, getBusyDays };

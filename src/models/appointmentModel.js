const pool = require('../db/pool');

const SELECT_APPOINTMENT = `
  SELECT a.id,
         a.patient_id AS patientId,
         a.doctor_id AS doctorId,
         a.appt_datetime AS appointmentDatetime,
         a.amount_paid AS amountPaid,
         a.status,
         a.refund_percent AS refundPercent,
         a.refund_amount AS refundAmount,
         a.cancelled_at AS cancelledAt,
         a.booked_on AS bookedOn
    FROM appointments a`;

async function findById(id) {
  const [rows] = await pool.execute(`${SELECT_APPOINTMENT} WHERE a.id = ?`, [id]);
  return rows[0] || null;
}

async function findAll({ doctorId = null, patientId = null, status = null } = {}) {
  const [rows] = await pool.execute(
    `${SELECT_APPOINTMENT}
      WHERE (? IS NULL OR a.doctor_id = ?)
        AND (? IS NULL OR a.patient_id = ?)
        AND (? IS NULL OR a.status = ?)
      ORDER BY a.appt_datetime, a.id`,
    [doctorId, doctorId, patientId, patientId, status, status]
  );
  return rows;
}

/** Read-only snapshot used to decide whether a waitlist spot may be offered. */
async function getAvailability(doctorId, slotStart, dayStart, dayEnd) {
  const [rows] = await pool.execute(
    `SELECT SUM(appt_datetime = ?) AS slotTaken, COUNT(*) AS dayCount
       FROM appointments
      WHERE doctor_id = ? AND status = 'booked' AND appt_datetime >= ? AND appt_datetime < ?`,
    [slotStart, doctorId, dayStart, dayEnd]
  );
  return { slotTaken: Number(rows[0].slotTaken || 0) > 0, dayCount: Number(rows[0].dayCount) };
}

/**
 * Books a slot inside one transaction.
 *
 * Concurrency design: the doctor row is locked with SELECT ... FOR UPDATE, so all bookings for
 * the same doctor are serialised. That makes the "count the day, then insert" step race-free
 * (the 12-per-day cap cannot be overshot by simultaneous requests). The UNIQUE key
 * uq_doctor_active_slot is a second, database-level guard for the "same slot" rule.
 *
 * `guard` is supplied by the service layer: it receives the facts read under the lock and either
 * throws (rule broken) or returns the amount to charge. The rules stay in the service; only the
 * data access and locking live here.
 */
async function createBooked({ patientId, doctorId, slotStart, dayStart, dayEnd, bookedOn }, guard) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [doctorRows] = await connection.execute('SELECT id, consultation_fee AS consultationFee FROM doctors WHERE id = ? FOR UPDATE', [doctorId]);
    const doctor = doctorRows[0] || null;

    let facts = { doctor, slotTaken: false, dayCount: 0 };
    if (doctor) {
      const [rows] = await connection.execute(
        `SELECT SUM(appt_datetime = ?) AS slotTaken, COUNT(*) AS dayCount
           FROM appointments
          WHERE doctor_id = ? AND status = 'booked' AND appt_datetime >= ? AND appt_datetime < ?`,
        [slotStart, doctorId, dayStart, dayEnd]
      );
      facts = { doctor, slotTaken: Number(rows[0].slotTaken || 0) > 0, dayCount: Number(rows[0].dayCount) };
    }

    const amountPaid = guard(facts);

    const [result] = await connection.execute(
      `INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, status, booked_on)
       VALUES (?, ?, ?, ?, 'booked', ?)`,
      [patientId, doctorId, slotStart, amountPaid, bookedOn]
    );
    await connection.commit();
    return findById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Cancels an appointment atomically. The row is locked, `decide(row)` (service layer, pure
 * business rules) returns the refund, and the status change and refund record are written by a
 * single UPDATE inside the transaction, so they succeed or fail together.
 */
async function cancelBooked(id, decide) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(`${SELECT_APPOINTMENT} WHERE a.id = ? FOR UPDATE`, [id]);
    const appointment = rows[0] || null;

    const { refundPercent, refundAmount, cancelledAt } = decide(appointment);

    await connection.execute(
      `UPDATE appointments
          SET status = 'cancelled', refund_percent = ?, refund_amount = ?, cancelled_at = ?
        WHERE id = ?`,
      [refundPercent, refundAmount, cancelledAt, id]
    );
    await connection.commit();
    return findById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { findById, findAll, getAvailability, createBooked, cancelBooked };

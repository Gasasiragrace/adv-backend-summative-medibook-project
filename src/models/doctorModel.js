const pool = require('../db/pool');

const COLUMNS = 'id, full_name AS fullName, specialty, consultation_fee AS consultationFee, room, created_at AS createdAt';

async function create({ fullName, specialty, consultationFee, room }) {
  const [result] = await pool.execute('INSERT INTO doctors (full_name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)', [
    fullName,
    specialty,
    consultationFee,
    room,
  ]);
  return findById(result.insertId);
}

async function findAll() {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors ORDER BY id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function update(id, { fullName, specialty, consultationFee, room }) {
  await pool.execute('UPDATE doctors SET full_name = ?, specialty = ?, consultation_fee = ?, room = ? WHERE id = ?', [
    fullName,
    specialty,
    consultationFee,
    room,
    id,
  ]);
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM doctors WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { create, findAll, findById, update, remove };

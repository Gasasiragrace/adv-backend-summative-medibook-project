const pool = require('../db/pool');

const COLUMNS = 'id, full_name AS fullName, email, phone, created_at AS createdAt';

async function create({ fullName, email, phone }) {
  const [result] = await pool.execute('INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)', [fullName, email, phone]);
  return findById(result.insertId);
}

async function findAll() {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients ORDER BY id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function update(id, { fullName, email, phone }) {
  await pool.execute('UPDATE patients SET full_name = ?, email = ?, phone = ? WHERE id = ?', [fullName, email, phone, id]);
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM patients WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { create, findAll, findById, update, remove };

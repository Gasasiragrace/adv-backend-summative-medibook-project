-- Sample data. Dates are relative to the day the script is run so the demo always has
-- "upcoming" appointments. Run AFTER schema.sql on a fresh database.
USE medibook;

INSERT INTO patients (id, full_name, email, phone) VALUES
  (1, 'Ama Mensah',    'ama@mail.com',   '0244-111-222'),
  (2, 'Kojo Owusu',    'kojo@mail.com',  '0555-333-444'),
  (3, 'Efua Asante',   'efua@mail.com',  '0200-555-666'),
  (4, 'Yaw Darko',     'yaw@mail.com',   '0277-888-999'),
  (5, 'Abena Sarpong', 'abena@mail.com', '0266-101-202');

INSERT INTO doctors (id, full_name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Boateng',      'Dermatology',      150.00, 'R-12'),
  (2, 'Dr. Adjei',        'Paediatrics',      100.00, 'R-03'),
  (3, 'Dr. Quaye',        'Cardiology',       200.00, 'R-07'),
  (4, 'Dr. Owusu-Ansah',  'General Practice',  80.00, 'R-01');  -- deliberately has NO appointments

-- Dr. Boateng: a FULL day (exactly 12 appointments) three days from today -> daily cap reached.
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES
  (1, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '09:00:00'), 150.00),
  (2, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '09:30:00'), 150.00),
  (3, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '10:00:00'), 150.00),
  (4, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '10:30:00'), 150.00),
  (5, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '11:00:00'), 150.00),
  (1, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '11:30:00'), 150.00),
  (2, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '12:00:00'), 150.00),
  (3, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '12:30:00'), 150.00),
  (4, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '13:00:00'), 150.00),
  (5, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '13:30:00'), 150.00),
  (1, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '14:00:00'), 150.00),
  (2, 1, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '14:30:00'), 150.00);

-- Dr. Adjei: a few appointments, one already cancelled (kept for refund history).
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES
  (1, 2, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '10:00:00'), 100.00),
  (3, 2, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '10:30:00'), 100.00),
  (4, 2, TIMESTAMP(CURDATE() + INTERVAL 6 DAY, '15:00:00'), 100.00);

INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, status, refund_percent, refund_amount, cancelled_at) VALUES
  (2, 2, TIMESTAMP(CURDATE() + INTERVAL 5 DAY, '11:00:00'), 100.00, 'cancelled', 100, 100.00, NOW());

-- Dr. Quaye: two upcoming appointments.
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES
  (5, 3, TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '09:00:00'), 200.00),
  (3, 3, TIMESTAMP(CURDATE() + INTERVAL 4 DAY, '16:30:00'), 200.00);

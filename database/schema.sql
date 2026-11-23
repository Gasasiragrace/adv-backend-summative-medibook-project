-- MediBook schema (MySQL 8.0.16+ is required because CHECK constraints are enforced).
-- Normalised to 3NF: patient facts live in patients, doctor facts (specialty, fee, room) live in
-- doctors, and appointments only holds facts about one booking plus FKs to the other two tables.

DROP DATABASE IF EXISTS medibook;
CREATE DATABASE medibook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook;

CREATE TABLE patients (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL,
  phone       VARCHAR(20)   NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_patients_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE doctors (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name        VARCHAR(100)  NOT NULL,
  specialty        VARCHAR(80)   NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  room             VARCHAR(10)   NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_doctors_fee_non_negative CHECK (consultation_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  patient_id      INT UNSIGNED  NOT NULL,
  doctor_id       INT UNSIGNED  NOT NULL,
  appt_datetime   DATETIME      NOT NULL,
  amount_paid     DECIMAL(10,2) NOT NULL,
  status          ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  refund_percent  TINYINT UNSIGNED NULL,
  refund_amount   DECIMAL(10,2) NULL,
  cancelled_at    DATETIME      NULL,
  booked_on       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- NULL when cancelled, 1 when booked. NULLs never collide in a UNIQUE index, so a cancelled
  -- row keeps its history yet stops blocking the slot.
  active_flag     TINYINT GENERATED ALWAYS AS (IF(status = 'booked', 1, NULL)) STORED,

  PRIMARY KEY (id),
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appointments_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON DELETE RESTRICT ON UPDATE RESTRICT,

  -- A doctor cannot hold two ACTIVE appointments at the same date/time.
  CONSTRAINT uq_doctor_active_slot UNIQUE (doctor_id, appt_datetime, active_flag),

  CONSTRAINT chk_appt_slot_boundary CHECK (MINUTE(appt_datetime) IN (0, 30) AND SECOND(appt_datetime) = 0),
  CONSTRAINT chk_appt_working_hours CHECK (TIME(appt_datetime) BETWEEN '09:00:00' AND '16:30:00'),
  CONSTRAINT chk_appt_amount_non_negative CHECK (amount_paid >= 0),
  CONSTRAINT chk_appt_refund_percent CHECK (refund_percent IS NULL OR refund_percent IN (0, 50, 100)),
  CONSTRAINT chk_appt_refund_not_above_paid CHECK (refund_amount IS NULL OR refund_amount <= amount_paid),
  CONSTRAINT chk_appt_cancellation_consistent CHECK (
    (status = 'booked'    AND refund_amount IS NULL     AND refund_percent IS NULL     AND cancelled_at IS NULL) OR
    (status = 'cancelled' AND refund_amount IS NOT NULL AND refund_percent IS NOT NULL AND cancelled_at IS NOT NULL)
  ),

  INDEX idx_appt_patient (patient_id),
  INDEX idx_appt_doctor_day (doctor_id, status, appt_datetime)
) ENGINE=InnoDB;

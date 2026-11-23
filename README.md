# MediBook - Clinic Appointment Booking Backend

Express.js + MySQL (`mysql2`, parameterized queries only, no ORM) + Redis (`ioredis`). Includes a separate background worker, an `fs`-based audit log, Jest unit tests and a bilingual feedback page.

## Requirements
- Node.js 18+
- MySQL **8.0.16+** (CHECK constraints are enforced from this version)
- Redis **6.2+** (uses `LMOVE`)

## Setup
```bash
git clone https://github.com/Gasasiragrace/adv-backend-summative-medibook-project.git
cd adv-backend-summative-medibook-project
npm install
cp .env.example .env        # then put your MySQL password in .env
```
1. Start MySQL and Redis (for example `redis-server`, and your MySQL service).
2. Create the database and sample data - either:
   - `npm run db:setup` (runs both SQL files using your `.env`), or
   - manually: `mysql -u root -p < database/schema.sql && mysql -u root -p < database/seed.sql`
3. Start the web server: `npm start` (http://localhost:3000)
4. In a **second terminal** start the worker: `npm run worker`
5. Tests (need neither MySQL nor Redis): `npm test`

> `schema.sql` begins with `DROP DATABASE IF EXISTS medibook` so it can be re-run for a clean slate.

`.env.example`:
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=change_me
DB_NAME=medibook
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
AUDIT_LOG_PATH=logs/audit.log
```

## Project layout
```
database/    schema.sql, seed.sql
schema-diagram.(svg|png|pdf), schema.dbml
locales/     en.json, fr.json
src/
  config/      env + ALL business constants (12-slot cap, hours, refund tiers) defined once
  models/      ALL SQL lives here (patient, doctor, appointment, report)
  services/    business rules (booking, cancellation, waitlist)
  controllers/ HTTP in/out; call services/models, never the DB
  routes/      URL + method -> controller
  queue/       Redis job queue + waitlist queue
  worker/      separate worker process
  middleware/  async wrapper, central error handler
  utils/       pure functions (slot validator, refund calculator, validators), audit logger
tests/       Jest unit tests
```

## API
| Method & path | Purpose | Success |
|---|---|---|
| `POST/GET /api/patients`, `GET/PUT/DELETE /api/patients/:id` | patient CRUD | 201 / 200 / 204 |
| `POST/GET /api/doctors`, `GET/PUT/DELETE /api/doctors/:id` | doctor CRUD | 201 / 200 / 204 |
| `GET /api/doctors/:id/statistics` | revenue, upcoming count, next-7-days per day, utilization % | 200 |
| `POST /api/appointments` | book `{patientId, doctorId, appointmentDatetime: "YYYY-MM-DD HH:mm"}` | 201 |
| `GET /api/appointments`, `GET /api/appointments/:id` | list (filters `doctorId`, `patientId`, `status`) / read one | 200 |
| `DELETE /api/appointments/:id` | cancel + refund (response states the refund) | 200 |
| `POST /api/waitlist`, `GET /api/waitlist?doctorId=&date=YYYY-MM-DD` | join / view waitlist | 201 / 200 |
| `GET /api/reports/doctors` | every doctor's totals + revenue (incl. zero appointments) | 200 |
| `GET /api/reports/busy-days` | (doctor, date) with >80% of 12 slots booked | 200 |
| `GET /feedback?lang=en\|fr` | i18n feedback page | 200 |

Status codes: **400** malformed input, **404** unknown id/route, **409** conflict (slot taken, daily cap, duplicate email, already cancelled, in use), **422** valid format but breaks a rule (past, outside hours, off the 30-minute boundary, cancelling a past appointment). Errors are all `{status, code, message, ...}` from one central middleware.

---

## Written justifications

### Part C - API design and business rules
- **REST design.** Nouns in URLs, verbs in methods; `PUT` for full replacement; `204` on delete of patients/doctors. Statistics are a sub-resource of the doctor; reports are under `/api/reports`.
- **Cancel = `DELETE /api/appointments/:id`.** The appointment leaves the active schedule, but the row is kept (soft delete) for refund history. The response is `200` with the refund, not `204`, because the client needs the refund amount.
- **Working hours.** A slot must *end* by 17:00, so the last bookable start is **16:30**; `17:00` is rejected. That gives 16 slots/day, so the 12-per-day cap is meaningful.
- **No double booking, even simultaneously.** Two layers: (1) inside a transaction the booking locks the doctor's row (`SELECT ... FOR UPDATE`), serialising all bookings for that doctor; (2) a `UNIQUE (doctor_id, appt_datetime, active_flag)` index is the database-level guard. I tested 15 simultaneous requests for one slot: exactly one `201`, fourteen `409`.
- **Daily cap race.** The "count the day, then insert" step is the classic check-then-act race. The doctor-row lock makes it atomic per doctor. Tested with 11 booked and 8 concurrent requests for different slots: exactly one succeeds, the day ends at 12.
- **Cancelled slot is rebookable but the record is kept.** `active_flag` is a generated column that is `1` while `status='booked'` and `NULL` once cancelled. `NULL`s never collide in a UNIQUE index, so the cancelled row stops blocking the slot but stays in the table.
- **Refund policy (computed by the server only).** `> 48h` -> 100%; `24h <= notice <= 48h` -> 50%; `< 24h` -> 0%. **Both boundaries belong to the 50% tier**: exactly 48h and exactly 24h each refund 50%, because "more than 48 hours" is the only way to get 100% and "less than 24 hours" the only way to get 0%. Money is rounded in cents.
- **Cancellation + refund atomic.** The row is locked, the refund is computed, and status + `refund_percent` + `refund_amount` + `cancelled_at` are written in one transaction (a CHECK also forbids a cancelled row without refund data).
- **Why some rule checks sit inside the model.** The race-sensitive checks must run *inside* the transaction, so the model performs the locked reads and calls a `guard`/`decide` callback supplied by the service. SQL stays in models; the rules (cap, refund) stay in services.
- **"Revenue collected"** = `SUM(amount_paid - refund_amount)`, i.e. what the clinic keeps after refunds. Statistics and both reports are produced by SQL (JOINs, aggregates, a recursive CTE for the zero-filled 7-day series, `HAVING` for busy days), not JavaScript.
- **Busy days.** More than 80% of 12 = more than 9.6, so 10+ booked slots; computed as `100*COUNT/12 > 80` in SQL.

### Part D - Audit log (`fs`)
`src/utils/auditLogger.js` uses `fs.promises.mkdir(..., {recursive: true})` and `fs.promises.appendFile`, so no `*Sync` call is ever made while serving a request. `logs/` is created the first time it is needed (and at startup). The function wraps everything in `try/catch` and **never rejects**, so a full disk or permissions error is printed to stderr but cannot fail a booking or cancellation. One JSON object per line, e.g. `appointment_booked`, `appointment_cancelled`, `waitlist_joined`, `waitlist_promoted`, `confirmation_sent`.

### Part E - Queues and Redis
- **Waitlist.** When a slot is taken or the day is full, the 409 response *offers* the waitlist and `POST /api/waitlist` joins it (refused with 409 if the slot is actually free). Each doctor-day has its own FIFO Redis list.
- **Separate worker.** `npm run worker` is its own process and blocks on `BLPOP` of a job list on a dedicated Redis connection. Cancelling enqueues a `slot_freed` job; the worker books the first waitlisted patient into the freed slot. (The patient gets the *freed* slot, which may differ from the time they originally asked for; waitlists are per doctor-day.)
- **If the promoted booking fails, the patient never vanishes.** The worker does not `POP`; it atomically `LMOVE`s the head into an *in-flight* list, tries the booking, and only then removes it. Outcomes:
  - success -> removed from in-flight, patient has an appointment;
  - slot grabbed meanwhile / no longer bookable (409/422) -> put back at the **front** of the queue, keeping their place;
  - infrastructure error -> put back at the front and the job is retried (max 3 attempts);
  - the patient can never be booked (e.g. deleted, 404) -> moved to `medibook:waitlist:failed` with the reason, and the worker tries the next person;
  - worker crash mid-booking -> on start-up the worker moves any in-flight entries back to their waiting lists (assumes a single worker).
- **Confirmation jobs.** Every successful booking (API or waitlist promotion) enqueues a `confirmation` job; the worker "sends" it by writing a `confirmation_sent` line to the audit log. If Redis is down, bookings still succeed (the enqueue error is logged) but joining the waitlist returns `503`.

### Tests (Part F)
19 Jest tests in `tests/`: refund tiers and both exact boundaries (fixed dates), rounding, input rejection; slot validator (valid, 16:30, 17:00, 08:30, 09:15, past, malformed/impossible date); input validators. They import only pure functions, so no MySQL or Redis is needed.

### Part G
`GET /feedback` renders 5 `<textarea>` questions from `locales/en.json` / `locales/fr.json`. `?lang=fr` translates; missing, unknown or non-string `lang` falls back to English. Today's date uses `Intl.DateTimeFormat` for the active locale.

## Demo checklist for the video (about 10 min)
1. Show `schema-diagram` and explain the unique key + generated `active_flag`.
2. `npm start`, `npm run worker`; `GET /api/doctors`.
3. Booking rules: past / 09:15 / 17:00 rejected; a valid booking -> audit log + confirmation line.
4. Race: fire parallel booking requests (e.g. several terminals or a small script) and show one winner.
5. Cancel: refund response; re-book the cancelled slot; `GET /api/appointments/:id` shows the history kept.
6. Waitlist: Dr. Boateng (id 1) is full three days from the seed date -> 409 with offer -> join -> cancel one of his appointments -> worker promotes -> show audit log.
7. `GET /api/doctors/1/statistics`, `/api/reports/doctors` (Dr. Owusu-Ansah has zero), `/api/reports/busy-days`.
8. `/feedback` and `/feedback?lang=fr`; run `npm test`.

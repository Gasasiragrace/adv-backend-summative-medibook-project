const { validateSlot, slotErrorCodes } = require('../src/utils/slotValidator');

const NOW = new Date(2026, 7, 1, 8, 0, 0);

describe('validateSlot', () => {
  test('accepts a future slot on the 30-minute boundary inside working hours', () => {
    const result = validateSlot('2026-08-10 09:00', NOW);
    expect(result.valid).toBe(true);
    expect(result.date.getHours()).toBe(9);
  });

  test('accepts the last slot of the day (16:30) and also the ISO "T" format', () => {
    expect(validateSlot('2026-08-10T16:30', NOW).valid).toBe(true);
  });

  test('rejects 17:00 exactly because the slot would end after closing time', () => {
    expect(validateSlot('2026-08-10 17:00', NOW).code).toBe(slotErrorCodes.OUTSIDE_WORKING_HOURS);
  });

  test('rejects 08:30 (before opening)', () => {
    expect(validateSlot('2026-08-10 08:30', NOW).code).toBe(slotErrorCodes.OUTSIDE_WORKING_HOURS);
  });

  test('rejects 09:15 (not on a 30-minute boundary)', () => {
    expect(validateSlot('2026-08-10 09:15', NOW).code).toBe(slotErrorCodes.NOT_ON_SLOT_BOUNDARY);
  });

  test('rejects a slot in the past', () => {
    expect(validateSlot('2026-07-30 10:00', NOW).code).toBe(slotErrorCodes.SLOT_IN_PAST);
  });

  test('rejects malformed and impossible dates', () => {
    expect(validateSlot('tomorrow at nine', NOW).code).toBe(slotErrorCodes.INVALID_DATETIME);
    expect(validateSlot('2026-02-30 10:00', NOW).code).toBe(slotErrorCodes.INVALID_DATETIME);
    expect(validateSlot(undefined, NOW).code).toBe(slotErrorCodes.INVALID_DATETIME);
  });
});

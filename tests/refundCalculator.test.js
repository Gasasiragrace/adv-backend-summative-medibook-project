const { calculateRefund } = require('../src/utils/refundCalculator');

// Fixed dates only: the tests never depend on the real clock.
const APPOINTMENT = new Date(2026, 7, 10, 9, 0, 0);
const hoursBefore = (hours) => new Date(APPOINTMENT.getTime() - hours * 60 * 60 * 1000);

describe('calculateRefund', () => {
  test('more than 48 hours notice refunds 100%', () => {
    const refund = calculateRefund(150, APPOINTMENT, hoursBefore(72));
    expect(refund).toMatchObject({ tier: 'FULL', percent: 100, amount: 150 });
  });

  test('just over 48 hours (48h + 1 minute) still refunds 100%', () => {
    const refund = calculateRefund(150, APPOINTMENT, new Date(hoursBefore(48).getTime() - 60 * 1000));
    expect(refund.percent).toBe(100);
  });

  test('exactly 48 hours is the 50% tier (boundary belongs to the lower tier)', () => {
    const refund = calculateRefund(150, APPOINTMENT, hoursBefore(48));
    expect(refund).toMatchObject({ tier: 'PARTIAL', percent: 50, amount: 75 });
  });

  test('between 24 and 48 hours refunds 50%', () => {
    expect(calculateRefund(100, APPOINTMENT, hoursBefore(30)).amount).toBe(50);
  });

  test('exactly 24 hours is still the 50% tier', () => {
    const refund = calculateRefund(150, APPOINTMENT, hoursBefore(24));
    expect(refund).toMatchObject({ tier: 'PARTIAL', percent: 50, amount: 75 });
  });

  test('less than 24 hours (24h minus 1 minute) refunds nothing', () => {
    const refund = calculateRefund(150, APPOINTMENT, new Date(hoursBefore(24).getTime() + 60 * 1000));
    expect(refund).toMatchObject({ tier: 'NONE', percent: 0, amount: 0 });
  });

  test('rounds money to cents without floating point drift', () => {
    expect(calculateRefund(33.33, APPOINTMENT, hoursBefore(30)).amount).toBe(16.67);
  });

  test('rejects invalid input instead of guessing', () => {
    expect(() => calculateRefund(100, new Date('nope'), APPOINTMENT)).toThrow(TypeError);
    expect(() => calculateRefund(-5, APPOINTMENT, hoursBefore(72))).toThrow(TypeError);
  });
});

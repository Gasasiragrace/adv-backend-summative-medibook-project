const { validatePatientInput, validateDoctorInput, parseId } = require('../src/utils/validators');

describe('input validators', () => {
  test('a complete patient passes', () => {
    expect(validatePatientInput({ fullName: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' })).toEqual([]);
  });

  test('a bad patient reports every problem', () => {
    expect(validatePatientInput({ fullName: ' ', email: 'not-an-email', phone: 'abc' })).toHaveLength(3);
  });

  test('doctor fee must be a non-negative number', () => {
    const base = { fullName: 'Dr. X', specialty: 'ENT', room: 'R-1' };
    expect(validateDoctorInput({ ...base, consultationFee: 120 })).toEqual([]);
    expect(validateDoctorInput({ ...base, consultationFee: -1 })).toHaveLength(1);
    expect(validateDoctorInput({ ...base, consultationFee: '120' })).toHaveLength(1);
  });

  test('parseId accepts positive integers only', () => {
    expect(parseId('42')).toBe(42);
    expect(() => parseId('0')).toThrow();
    expect(() => parseId('1; DROP TABLE patients')).toThrow();
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNewPatientFromDraft,
  computeRegimenBreakdown,
  inferDobFromMalaysianIc,
  MAX_DBB_BOTTLES,
  MIN_DBB_BOTTLES,
  previewRegistrationSchedule,
  validatePatientRegistrationDraft,
  type PatientRegistrationDraft,
} from './patientRegistration.ts';

function makeBaseDraft(overrides: Partial<PatientRegistrationDraft> = {}): PatientRegistrationDraft {
  return {
    name: 'Mohd Fairuz bin Abdullah',
    mrn: 'MTD-2026-021',
    icNumber: '880715-10-5123',
    dateOfBirth: '1988-07-15',
    gender: 'lelaki',
    ethnicity: 'Melayu',
    phone: '012-778 4412',
    address: 'No 14, Jalan Melur 2, Taman Seri, 43000 Kajang',
    employmentStatus: 'Bekerja Sepenuh Masa',
    emergencyContactName: 'Siti Rahmah binti Abdullah',
    emergencyContactPhone: '019-224 8810',
    emergencyContactRelation: 'Isteri',
    phase: 'penstabilan',
    doseMg: 60,
    regimenType: 'dbb',
    dbbBottles: 3,
    prescribingDoctor: 'Dr. Hakimah Idris',
    startDate: '2026-11-26',
    nextAppointmentTime: '08:30',
    lastBloodTestDate: '2026-11-10',
    lastBloodTestStatus: 'normal',
    lastBloodTestNote: 'LFT normal, HIV/Hep B/Hep C negatif',
    lastUrineTestDate: '2026-11-20',
    lastUrineResult: 'patuh',
    lastEcgDate: '2026-11-10',
    qtcMs: 418,
    drugAllergies: 'Tiada alahan diketahui',
    comorbidities: 'Tiada',
    clinicalAlertNote: 'Patuh kepada protokol dos.',
    ...overrides,
  };
}

test('computeRegimenBreakdown sets 7 DOT days and 0 DBB bottles for pure DOT regimen', () => {
  const res = computeRegimenBreakdown('dot', 4, 50);
  assert.equal(res.regimenType, 'dot');
  assert.equal(res.dbbBottles, 0);
  assert.equal(res.dotDaysPerWeek, 7);
  assert.equal(res.dispensingMode, 'dot_harian');
  assert.equal(res.doseVolumeMl, 10);
  assert.equal(res.weeklyDbbVolumeMl, 0);
});

test('computeRegimenBreakdown enforces DBB min 1 and max 6 bottles and calculates DOT = 7 - DBB', () => {
  const minRes = computeRegimenBreakdown('dbb', 0, 60);
  assert.equal(minRes.dbbBottles, MIN_DBB_BOTTLES);
  assert.equal(minRes.dotDaysPerWeek, 6);
  assert.equal(minRes.dispensingMode, 'bawa_pulang_separa');
  assert.equal(minRes.doseVolumeMl, 12);
  assert.equal(minRes.weeklyDbbVolumeMl, 12);

  const maxRes = computeRegimenBreakdown('dbb', 10, 60);
  assert.equal(maxRes.dbbBottles, MAX_DBB_BOTTLES);
  assert.equal(maxRes.dotDaysPerWeek, 1);
  assert.equal(maxRes.dispensingMode, 'bawa_pulang_mingguan');
  assert.equal(maxRes.weeklyDbbVolumeMl, 72);
});

test('validatePatientRegistrationDraft rejects missing demographics or invalid DBB range', () => {
  const missingPhone = validatePatientRegistrationDraft(makeBaseDraft({ phone: ' ' }));
  assert.equal(missingPhone.valid, false);

  const badDbb = validatePatientRegistrationDraft(
    makeBaseDraft({ regimenType: 'dbb', dbbBottles: 7 })
  );
  assert.equal(badDbb.valid, false);

  const validDbb = validatePatientRegistrationDraft(
    makeBaseDraft({ regimenType: 'dbb', dbbBottles: 6 })
  );
  assert.equal(validDbb.valid, true);
});

test('inferDobFromMalaysianIc parses 12-digit MyKad YYMMDD into ISO date', () => {
  assert.equal(inferDobFromMalaysianIc('880715-10-5123', 2026), '1988-07-15');
  assert.equal(inferDobFromMalaysianIc('021104-14-0112', 2026), '2002-11-04');
  assert.equal(inferDobFromMalaysianIc('AB123', 2026), null);
});

test('buildNewPatientFromDraft and previewRegistrationSchedule respect lastUrineTestDate and DBB/DOT calculation', () => {
  const draft = makeBaseDraft({
    phase: 'penstabilan', // 14-day urine interval, 4-day window
    lastUrineTestDate: '2026-11-20',
    lastBloodTestDate: '2026-11-10',
    regimenType: 'dbb',
    dbbBottles: 4,
  });

  const patient = buildNewPatientFromDraft(draft, '2026-11-26');
  assert.equal(patient.dbbBottles, 4);
  assert.equal(patient.dotDaysPerWeek, 3);
  assert.equal(patient.lastBloodTestDate, '2026-11-10');
  assert.equal(patient.lastUrineTestDate, '2026-11-20');

  const preview = previewRegistrationSchedule(draft, '2026-11-26');
  // 2026-11-20 + 14 days = 2026-12-04
  assert.equal(preview.urineWindow.windowStart, '2026-12-04');
  assert.equal(preview.urineWindow.windowEnd, '2026-12-07');
});

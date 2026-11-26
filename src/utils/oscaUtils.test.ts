import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialClinicalState } from '../data/seedData';
import {
  buildOscaClientProfile,
  computeOscaSummaryStats,
  validateOscaDraft,
} from './oscaUtils';

test('validateOscaDraft enforces required fields', () => {
  const invalid = validateOscaDraft({
    patientId: 'pat-1',
    serviceDomain: 'kaunseling_psikososial',
    riskLevel: 'pemantauan',
    actionDate: '2026-11-26',
    title: '',
    planNote: 'Pelan sokongan',
    agencyOrOfficer: 'Kaunselor OSCA',
  });
  assert.equal(invalid.valid, false);

  const valid = validateOscaDraft({
    patientId: 'pat-1',
    serviceDomain: 'kaunseling_psikososial',
    riskLevel: 'pemantauan',
    actionDate: '2026-11-26',
    title: 'Sesi kaunseling sokongan keluarga',
    planNote: 'Libatkan pasangan dalam pelan pematuhan dos harian.',
    agencyOrOfficer: 'Kaunselor OSCA · Pn. Farah',
  });
  assert.equal(valid.valid, true);
});

test('buildOscaClientProfile pulls Methadone phase, urine status, and risk level accurately', () => {
  const todayIso = '2026-11-26';
  const state = createInitialClinicalState(todayIso);

  const profiles = state.patients.map((p) =>
    buildOscaClientProfile(
      p,
      state.appointments,
      state.tasks,
      state.urineRecords,
      state.oscaRecords,
      todayIso
    )
  );

  const firdaus = profiles.find((p) => p.patient.id === 'pat-1');
  assert.ok(firdaus);
  assert.equal(firdaus.urineWindow.status, 'dalam_julat');
  assert.equal(firdaus.needsAttention, true);
  assert.equal(firdaus.riskLevel, 'pemantauan');

  const suresh = profiles.find((p) => p.patient.id === 'pat-3');
  assert.ok(suresh);
  assert.equal(suresh.latestUrineRecord?.overallStatus, 'patuh');
  assert.equal(suresh.needsAttention, false);

  const highRisk = buildOscaClientProfile(
    suresh.patient,
    state.appointments,
    state.tasks,
    [
      {
        ...state.urineRecords[1],
        id: 'urin-alert',
        testDate: todayIso,
        overallStatus: 'perhatian',
      },
    ],
    state.oscaRecords,
    todayIso
  );
  assert.equal(highRisk.riskLevel, 'tinggi');
  assert.equal(highRisk.needsAttention, true);
});

test('computeOscaSummaryStats aggregates totals from Methadone and OSCA records', () => {
  const todayIso = '2026-11-26';
  const state = createInitialClinicalState(todayIso);
  const profiles = state.patients.map((p) =>
    buildOscaClientProfile(
      p,
      state.appointments,
      state.tasks,
      state.urineRecords,
      state.oscaRecords,
      todayIso
    )
  );

  const stats = computeOscaSummaryStats(profiles, state.oscaRecords, state.urineRecords);
  assert.equal(stats.totalClients, 3);
  assert.equal(stats.activeInterventionsCount, 3);
  assert.equal(stats.compliantUrineCount, 2);
  assert.equal(stats.totalUrineRecordsCount, 2);
});

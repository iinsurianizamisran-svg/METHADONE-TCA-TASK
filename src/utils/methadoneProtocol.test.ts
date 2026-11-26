import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysISO,
  calculateNextAppointmentDate,
  calculateUrineTestWindow,
  evaluatePeriodicReminders,
  formatDailySummaryText,
  generateDailySummaryReport,
  isDateInUrineWindow,
} from './methadoneProtocol';
import type { Appointment, ClinicalTask, Patient, UrineTestRecord } from '../types/clinical';

test('calculateUrineTestWindow derives active range from registered protocol', () => {
  const patient: Patient = {
    id: 'p1',
    name: 'Ahmad Firdaus',
    mrn: 'MTD-001',
    icNumber: '880412-14-5123',
    phone: '012-3456789',
    phase: 'induksi',
    doseMg: 40,
    dispensingMode: 'dot_harian',
    startDate: '2026-11-18',
    nextAppointmentDate: '2026-11-25',
    nextAppointmentTime: '08:30',
    urineIntervalDays: 7,
    urineWindowDays: 3,
  };

  // 7 days after 2026-11-18 is 2026-11-25; 3-day window = 2026-11-25..2026-11-27
  const win = calculateUrineTestWindow(patient, '2026-11-25');
  assert.equal(win.windowStart, '2026-11-25');
  assert.equal(win.windowEnd, '2026-11-27');
  assert.equal(win.status, 'dalam_julat');
  assert.equal(win.daysRemainingInWindow, 2);

  // Before window start
  const early = calculateUrineTestWindow(patient, '2026-11-23');
  assert.equal(early.status, 'akan_datang');
  assert.equal(early.daysUntilStart, 2);

  // After window end
  const late = calculateUrineTestWindow(patient, '2026-11-29');
  assert.equal(late.status, 'tamat_tempoh');
});

test('calculateUrineTestWindow advances from lastUrineTestDate when test recorded', () => {
  const patient: Patient = {
    id: 'p2',
    name: 'Zulhilmi Razak',
    mrn: 'MTD-002',
    icNumber: '820901-08-3341',
    phone: '013-9988776',
    phase: 'penstabilan',
    doseMg: 65,
    dispensingMode: 'bawa_pulang_separa',
    startDate: '2026-10-01',
    lastUrineTestDate: '2026-11-15',
    nextAppointmentDate: '2026-11-25',
    nextAppointmentTime: '09:00',
    urineIntervalDays: 14,
    urineWindowDays: 4,
  };

  const win = calculateUrineTestWindow(patient, '2026-11-25');
  assert.equal(win.windowStart, '2026-11-29');
  assert.equal(win.windowEnd, '2026-12-02');
  assert.equal(win.cycleNumber, 2);
  assert.equal(win.status, 'akan_datang');
});

test('isDateInUrineWindow validates inclusive date boundaries', () => {
  assert.equal(isDateInUrineWindow('2026-11-25', '2026-11-25', '2026-11-27'), true);
  assert.equal(isDateInUrineWindow('2026-11-27', '2026-11-25', '2026-11-27'), true);
  assert.equal(isDateInUrineWindow('2026-11-24', '2026-11-25', '2026-11-27'), false);
  assert.equal(isDateInUrineWindow('2026-11-28', '2026-11-25', '2026-11-27'), false);
});

test('calculateNextAppointmentDate applies phase cadence', () => {
  assert.equal(calculateNextAppointmentDate('induksi', '2026-11-25'), '2026-11-26');
  assert.equal(calculateNextAppointmentDate('penstabilan', '2026-11-25'), '2026-12-02');
  assert.equal(calculateNextAppointmentDate('penyelenggaraan', '2026-11-25'), '2026-12-09');
  assert.equal(addDaysISO('2026-11-28', 4), '2026-12-02');
});

test('generateDailySummaryReport and evaluatePeriodicReminders aggregate accurately', () => {
  const patients: Patient[] = [
    {
      id: 'p1',
      name: 'Ahmad Firdaus',
      mrn: 'MTD-001',
      icNumber: '880412-14-5123',
      phone: '012-3456789',
      phase: 'induksi',
      doseMg: 40,
      dispensingMode: 'dot_harian',
      startDate: '2026-11-18',
      nextAppointmentDate: '2026-11-25',
      nextAppointmentTime: '08:30',
      urineIntervalDays: 7,
      urineWindowDays: 3,
    },
  ];
  const appointments: Appointment[] = [
    {
      id: 'a1',
      patientId: 'p1',
      date: '2026-11-25',
      time: '08:30',
      purpose: 'Dos Harian DOT',
      status: 'hadir',
    },
  ];
  const tasks: ClinicalTask[] = [
    {
      id: 't1',
      patientId: 'p1',
      title: 'Semakan dos 40 mg',
      category: 'dos',
      dueDate: '2026-11-25',
      priority: 'segera',
      completed: true,
    },
    {
      id: 't2',
      patientId: 'p1',
      title: 'Ujian urin berkala',
      category: 'urin',
      dueDate: '2026-11-25',
      priority: 'penting',
      completed: false,
    },
  ];
  const urineRecords: UrineTestRecord[] = [
    {
      id: 'u1',
      patientId: 'p1',
      testDate: '2026-11-25',
      protocolWindowStart: '2026-11-25',
      protocolWindowEnd: '2026-11-27',
      withinProtocolWindow: true,
      methadoneMetabolite: 'positif',
      morphine: 'negatif',
      amphetamine: 'negatif',
      thc: 'negatif',
      benzodiazepine: 'negatif',
      overallStatus: 'patuh',
      recordedBy: 'SN Aisyah',
      clinicalNote: 'Patuh rawatan.',
    },
  ];

  const report = generateDailySummaryReport(
    patients,
    appointments,
    tasks,
    urineRecords,
    '2026-11-25'
  );
  assert.equal(report.totalScheduledAppointments, 1);
  assert.equal(report.attendedCount, 1);
  assert.equal(report.totalTasksDue, 2);
  assert.equal(report.completedTasksCount, 1);
  assert.equal(report.pendingTasksCount, 1);
  assert.equal(report.urineTestsCount, 1);
  assert.equal(report.patientsInActiveUrineWindow, 1);

  const summaryText = formatDailySummaryText(report);
  assert.ok(summaryText.includes('LAPORAN RINGKASAN HARIAN'));
  assert.ok(summaryText.includes('Hadir: 1'));

  const alerts = evaluatePeriodicReminders(patients, appointments, tasks, '2026-11-25');
  assert.equal(alerts.length, 2); // 1 incomplete task + 1 active urine window
});

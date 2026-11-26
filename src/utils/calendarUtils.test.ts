import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCalendarGrid,
  getAgendaForDate,
  getDaySummaryCounts,
  getMonthTitleMY,
  shiftMonth,
} from './calendarUtils';
import type {
  Appointment,
  ClinicalNote,
  ClinicalTask,
  Patient,
  UrineTestRecord,
} from '../types/clinical';

test('buildMonthCalendarGrid builds Monday-first grid for November 2026', () => {
  // Nov 1, 2026 is Sunday -> Monday-first grid starts Oct 26, 2026 (6 leading days) -> 42 cells
  const grid = buildMonthCalendarGrid(2026, 10);
  assert.equal(grid.length, 42);
  assert.equal(grid[0].dateIso, '2026-10-26');
  assert.equal(grid[0].isCurrentMonth, false);
  assert.equal(grid[6].dateIso, '2026-11-01');
  assert.equal(grid[6].isCurrentMonth, true);
  assert.equal(grid[35].dateIso, '2026-11-30');
  assert.equal(grid[35].isCurrentMonth, true);
  assert.equal(getMonthTitleMY(2026, 10), 'November 2026');
});

test('shiftMonth wraps cleanly across year boundaries', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
});

test('getDaySummaryCounts and getAgendaForDate aggregate appointments, tasks, notes, and urine windows', () => {
  const patients: Patient[] = [
    {
      id: 'p1',
      name: 'Ahmad Firdaus',
      mrn: 'MTD-001',
      icNumber: '860412-14-5219',
      phone: '012-3456789',
      phase: 'induksi',
      doseMg: 45,
      dispensingMode: 'dot_harian',
      startDate: '2026-11-19',
      nextAppointmentDate: '2026-11-26',
      nextAppointmentTime: '08:30',
      urineIntervalDays: 7,
      urineWindowDays: 3,
    },
  ];
  const appointments: Appointment[] = [
    {
      id: 'a1',
      patientId: 'p1',
      date: '2026-11-26',
      time: '08:30',
      purpose: 'Dos Harian DOT',
      status: 'dijadualkan',
    },
  ];
  const tasks: ClinicalTask[] = [
    {
      id: 't1',
      patientId: 'p1',
      title: 'Semakan dos',
      category: 'dos',
      dueDate: '2026-11-26',
      priority: 'segera',
      completed: false,
    },
  ];
  const notes: ClinicalNote[] = [
    {
      id: 'n1',
      patientId: 'p1',
      date: '2026-11-26',
      category: 'klinikal',
      title: 'Pantau sedasi',
      content: 'Periksa selepas 30 minit.',
      verified: false,
      createdBy: 'SN Aisyah',
    },
  ];
  const urineRecords: UrineTestRecord[] = [];

  const counts = getDaySummaryCounts(
    '2026-11-26',
    patients,
    appointments,
    tasks,
    notes,
    urineRecords,
    '2026-11-26'
  );
  assert.equal(counts.appointmentsCount, 1);
  assert.equal(counts.tasksCount, 1);
  assert.equal(counts.pendingTasksCount, 1);
  assert.equal(counts.notesCount, 1);
  assert.equal(counts.urineWindowsCount, 1);
  assert.equal(counts.totalItems, 4);

  const agenda = getAgendaForDate(
    '2026-11-26',
    patients,
    appointments,
    tasks,
    notes,
    urineRecords,
    '2026-11-26'
  );
  assert.equal(agenda.appointments[0].patientName, 'Ahmad Firdaus');
  assert.equal(agenda.notes[0].title, 'Pantau sedasi');
  assert.equal(agenda.activeUrineWindows.length, 1);
});

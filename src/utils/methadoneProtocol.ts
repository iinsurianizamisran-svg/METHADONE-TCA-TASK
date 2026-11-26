import type {
  Appointment,
  ClinicalTask,
  DailySummaryReport,
  DispensingMode,
  Patient,
  ProtocolPhase,
  PushAlertItem,
  UrineTestRecord,
  UrineWindowInfo,
} from '../types/clinical';

export interface ProtocolPreset {
  label: string;
  description: string;
  defaultAttendanceDays: number;
  urineIntervalDays: number;
  urineWindowDays: number;
  defaultDispensingMode: DispensingMode;
}

export const PROTOCOL_PRESETS: Record<ProtocolPhase, ProtocolPreset> = {
  induksi: {
    label: 'Fasa Induksi',
    description: 'Pemantauan harian (DOT), ujian urin setiap 7 hari (julat 3 hari).',
    defaultAttendanceDays: 1,
    urineIntervalDays: 7,
    urineWindowDays: 3,
    defaultDispensingMode: 'dot_harian',
  },
  penstabilan: {
    label: 'Fasa Penstabilan',
    description: 'Temujanji mingguan, ujian urin setiap 14 hari (julat 4 hari).',
    defaultAttendanceDays: 7,
    urineIntervalDays: 14,
    urineWindowDays: 4,
    defaultDispensingMode: 'bawa_pulang_separa',
  },
  penyelenggaraan: {
    label: 'Fasa Penyelenggaraan',
    description: 'Dos bawa pulang mingguan, ujian urin setiap 30 hari (julat 5 hari).',
    defaultAttendanceDays: 14,
    urineIntervalDays: 30,
    urineWindowDays: 5,
    defaultDispensingMode: 'bawa_pulang_mingguan',
  },
};

export const DISPENSING_LABELS: Record<DispensingMode, string> = {
  dot_harian: 'DOT Harian di Klinik',
  bawa_pulang_separa: 'Bawa Pulang Separa (3+4)',
  bawa_pulang_mingguan: 'Bawa Pulang Mingguan',
};

const MONTHS_MY = [
  'Jan',
  'Feb',
  'Mac',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Ogos',
  'Sep',
  'Okt',
  'Nov',
  'Dis',
];

function parseISODateUTC(dateIso: string): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function toISODateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(dateIso: string, days: number): string {
  const dt = parseISODateUTC(dateIso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISODateUTC(dt);
}

export function diffDaysISO(fromIso: string, toIso: string): number {
  const a = parseISODateUTC(fromIso).getTime();
  const b = parseISODateUTC(toIso).getTime();
  return Math.round((b - a) / 86400000);
}

export function formatDateMY(dateIso: string): string {
  if (!dateIso || !dateIso.includes('-')) return dateIso;
  const [y, m, d] = dateIso.split('-').map(Number);
  const monthLabel = MONTHS_MY[(m || 1) - 1] ?? String(m);
  return `${String(d).padStart(2, '0')} ${monthLabel} ${y}`;
}

/**
 * Automatically derives the current or upcoming urine screening date range
 * from the patient's registered methadone treatment protocol.
 */
export function calculateUrineTestWindow(
  patient: Pick<
    Patient,
    'startDate' | 'phase' | 'urineIntervalDays' | 'urineWindowDays' | 'lastUrineTestDate'
  >,
  referenceDateIso: string
): UrineWindowInfo {
  const preset = PROTOCOL_PRESETS[patient.phase];
  const intervalDays = Math.max(1, patient.urineIntervalDays || preset.urineIntervalDays);
  const windowDays = Math.max(1, patient.urineWindowDays || preset.urineWindowDays);

  const anchorDate = patient.lastUrineTestDate || patient.startDate;
  const baseCycle = patient.lastUrineTestDate ? 2 : 1;

  // First window starts `intervalDays` after anchor date (or at startDate + intervalDays)
  let windowStart = addDaysISO(anchorDate, intervalDays);
  let windowEnd = addDaysISO(windowStart, windowDays - 1);
  let cycleNumber = baseCycle;

  // If the anchor date is far in the past and we have no recent test, advance cycle count only if
  // there is an earlier completed test; otherwise keep the overdue window visible so staff notice it.
  // However, if referenceDate is before startDate, clamp cleanly.
  const daysUntilStart = diffDaysISO(referenceDateIso, windowStart);
  const daysRemainingInWindow = diffDaysISO(referenceDateIso, windowEnd);

  let status: UrineWindowInfo['status'];
  if (daysUntilStart > 0) {
    status = 'akan_datang';
  } else if (daysRemainingInWindow >= 0) {
    status = 'dalam_julat';
  } else {
    status = 'tamat_tempoh';
  }

  return {
    windowStart,
    windowEnd,
    cycleNumber,
    status,
    daysUntilStart,
    daysRemainingInWindow,
  };
}

export function isDateInUrineWindow(
  testDateIso: string,
  windowStartIso: string,
  windowEndIso: string
): boolean {
  return testDateIso >= windowStartIso && testDateIso <= windowEndIso;
}

export function calculateNextAppointmentDate(
  phase: ProtocolPhase,
  fromDateIso: string
): string {
  const preset = PROTOCOL_PRESETS[phase];
  return addDaysISO(fromDateIso, preset.defaultAttendanceDays);
}

export function generateDefaultProtocolTasks(
  patient: Pick<Patient, 'id' | 'phase' | 'doseMg'>,
  appointmentDateIso: string
): Omit<ClinicalTask, 'id'>[] {
  const tasks: Omit<ClinicalTask, 'id'>[] = [
    {
      patientId: patient.id,
      title: `Pengesahan identiti & pemberian dos metadon ${patient.doseMg} mg`,
      category: 'dos',
      dueDate: appointmentDateIso,
      dueTime: '08:30',
      priority: 'segera',
      completed: false,
    },
    {
      patientId: patient.id,
      title: 'Penilaian tanda penarikan (COWS) & kesan sampingan',
      category: 'kaunseling',
      dueDate: appointmentDateIso,
      dueTime: '09:00',
      priority: 'penting',
      completed: false,
    },
  ];

  if (patient.phase === 'induksi') {
    tasks.push({
      patientId: patient.id,
      title: 'Pantau paras sedasi 30 minit selepas dos induksi',
      category: 'susulan',
      dueDate: appointmentDateIso,
      dueTime: '09:15',
      priority: 'segera',
      completed: false,
    });
  } else if (patient.phase === 'penyelenggaraan') {
    tasks.push({
      patientId: patient.id,
      title: 'Semak kelayakan & baki botol dos bawa pulang',
      category: 'dokumen',
      dueDate: appointmentDateIso,
      dueTime: '09:30',
      priority: 'biasa',
      completed: false,
    });
  }

  return tasks;
}

export function generateDailySummaryReport(
  patients: Patient[],
  appointments: Appointment[],
  tasks: ClinicalTask[],
  urineRecords: UrineTestRecord[],
  reportDateIso: string
): DailySummaryReport {
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const dayAppointments = appointments
    .filter((a) => a.date === reportDateIso)
    .map((a) => {
      const p = patientMap.get(a.patientId);
      return {
        ...a,
        patientName: p?.name ?? 'Pesakit Tidak Dikenali',
        mrn: p?.mrn ?? '-',
        doseMg: p?.doseMg ?? 0,
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const dayTasks = tasks
    .filter((t) => t.dueDate === reportDateIso)
    .map((t) => {
      const p = patientMap.get(t.patientId);
      return {
        ...t,
        patientName: p?.name ?? 'Pesakit Tidak Dikenali',
        mrn: p?.mrn ?? '-',
      };
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed));

  const dayUrine = urineRecords
    .filter((u) => u.testDate === reportDateIso)
    .map((u) => {
      const p = patientMap.get(u.patientId);
      return {
        ...u,
        patientName: p?.name ?? 'Pesakit Tidak Dikenali',
        mrn: p?.mrn ?? '-',
      };
    });

  const overdueItems: DailySummaryReport['overdueItems'] = [];

  for (const a of appointments) {
    if (a.date < reportDateIso && a.status === 'dijadualkan') {
      const p = patientMap.get(a.patientId);
      if (p) {
        overdueItems.push({
          patientName: p.name,
          mrn: p.mrn,
          description: `Temujanji tertunggak (${formatDateMY(a.date)} · ${a.purpose})`,
          type: 'temujanji',
        });
      }
    }
  }

  for (const t of tasks) {
    if (t.dueDate < reportDateIso && !t.completed) {
      const p = patientMap.get(t.patientId);
      if (p) {
        overdueItems.push({
          patientName: p.name,
          mrn: p.mrn,
          description: `Tugasan belum selesai (${formatDateMY(t.dueDate)}): ${t.title}`,
          type: 'tugasan',
        });
      }
    }
  }

  let patientsInActiveUrineWindow = 0;
  for (const p of patients) {
    const win = calculateUrineTestWindow(p, reportDateIso);
    if (win.status === 'dalam_julat') {
      patientsInActiveUrineWindow += 1;
    } else if (win.status === 'tamat_tempoh') {
      overdueItems.push({
        patientName: p.name,
        mrn: p.mrn,
        description: `Julat ujian urin tamat (${formatDateMY(win.windowStart)} – ${formatDateMY(win.windowEnd)})`,
        type: 'urin',
      });
    }
  }

  return {
    reportDate: reportDateIso,
    totalScheduledAppointments: dayAppointments.length,
    attendedCount: dayAppointments.filter((a) => a.status === 'hadir').length,
    absentCount: dayAppointments.filter((a) => a.status === 'tidak_hadir').length,
    pendingAppointmentsCount: dayAppointments.filter((a) => a.status === 'dijadualkan').length,
    totalTasksDue: dayTasks.length,
    completedTasksCount: dayTasks.filter((t) => t.completed).length,
    pendingTasksCount: dayTasks.filter((t) => !t.completed).length,
    urineTestsCount: dayUrine.length,
    urineCompliantCount: dayUrine.filter((u) => u.overallStatus === 'patuh').length,
    urineAttentionCount: dayUrine.filter((u) => u.overallStatus === 'perhatian').length,
    patientsInActiveUrineWindow,
    overdueItems,
    appointments: dayAppointments,
    tasks: dayTasks,
    urineRecords: dayUrine,
  };
}

export function formatDailySummaryText(report: DailySummaryReport): string {
  const lines: string[] = [
    `LAPORAN RINGKASAN HARIAN KLINIK METADON`,
    `Tarikh: ${formatDateMY(report.reportDate)}`,
    `--------------------------------------------------`,
    `1. KEHADIRAN TEMUJANJI`,
    `   Dijadualkan: ${report.totalScheduledAppointments} | Hadir: ${report.attendedCount} | Tidak Hadir: ${report.absentCount} | Menunggu: ${report.pendingAppointmentsCount}`,
    ``,
    `2. TUGASAN KLINIKAL KAKITANGAN`,
    `   Jumlah Tugasan: ${report.totalTasksDue} | Selesai: ${report.completedTasksCount} | Belum Selesai: ${report.pendingTasksCount}`,
    ``,
    `3. SARINGAN UJIAN URIN`,
    `   Ujian Direkod Hari Ini: ${report.urineTestsCount} (Patuh: ${report.urineCompliantCount}, Perlu Perhatian: ${report.urineAttentionCount})`,
    `   Pesakit Dalam Julat Urin Aktif: ${report.patientsInActiveUrineWindow}`,
  ];

  if (report.overdueItems.length > 0) {
    lines.push(``, `4. TINDAKAN SEGERA / TERTUNGGAK (${report.overdueItems.length})`);
    for (const item of report.overdueItems) {
      lines.push(`   - [${item.mrn}] ${item.patientName}: ${item.description}`);
    }
  } else {
    lines.push(``, `4. TINDAKAN SEGERA / TERTUNGGAK: Tiada item tertunggak.`);
  }

  return lines.join('\n');
}

export function evaluatePeriodicReminders(
  patients: Patient[],
  appointments: Appointment[],
  tasks: ClinicalTask[],
  referenceDateIso: string
): PushAlertItem[] {
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const alerts: PushAlertItem[] = [];

  for (const appt of appointments) {
    if (appt.status !== 'dijadualkan') continue;
    const p = patientMap.get(appt.patientId);
    if (!p) continue;
    const delta = diffDaysISO(referenceDateIso, appt.date);
    if (delta < 0) {
      alerts.push({
        id: `appt-${appt.id}`,
        patientId: p.id,
        patientName: p.name,
        type: 'temujanji',
        title: `Temujanji Tertunggak · ${p.name}`,
        detail: `${appt.purpose} sepatutnya pada ${formatDateMY(appt.date)} (${appt.time})`,
        dueAt: `${appt.date} ${appt.time}`,
        severity: 'segera',
        acknowledged: false,
      });
    } else if (delta === 0) {
      alerts.push({
        id: `appt-${appt.id}`,
        patientId: p.id,
        patientName: p.name,
        type: 'temujanji',
        title: `Temujanji Hari Ini · ${p.name}`,
        detail: `${appt.purpose} pada jam ${appt.time} · Dos ${p.doseMg} mg`,
        dueAt: `${appt.date} ${appt.time}`,
        severity: 'amaran',
        acknowledged: false,
      });
    }
  }

  for (const task of tasks) {
    if (task.completed) continue;
    const p = patientMap.get(task.patientId);
    if (!p) continue;
    const delta = diffDaysISO(referenceDateIso, task.dueDate);
    if (delta <= 0) {
      alerts.push({
        id: `task-${task.id}`,
        patientId: p.id,
        patientName: p.name,
        type: 'tugasan',
        title: delta < 0 ? `Tugasan Tertunggak · ${p.name}` : `Tugasan Hari Ini · ${p.name}`,
        detail: task.title,
        dueAt: `${task.dueDate} ${task.dueTime ?? '08:00'}`,
        severity: delta < 0 || task.priority === 'segera' ? 'segera' : 'amaran',
        acknowledged: false,
      });
    }
  }

  for (const p of patients) {
    const win = calculateUrineTestWindow(p, referenceDateIso);
    if (win.status === 'dalam_julat') {
      alerts.push({
        id: `urine-${p.id}-${win.windowStart}`,
        patientId: p.id,
        patientName: p.name,
        type: 'urin',
        title: `Julat Ujian Urin Aktif · ${p.name}`,
        detail: `Perlu ujian urin antara ${formatDateMY(win.windowStart)} hingga ${formatDateMY(win.windowEnd)} (baki ${win.daysRemainingInWindow} hari)`,
        dueAt: win.windowEnd,
        severity: win.daysRemainingInWindow <= 1 ? 'segera' : 'info',
        acknowledged: false,
      });
    } else if (win.status === 'tamat_tempoh') {
      alerts.push({
        id: `urine-${p.id}-${win.windowStart}`,
        patientId: p.id,
        patientName: p.name,
        type: 'urin',
        title: `Ujian Urin Melepasi Julat · ${p.name}`,
        detail: `Julat protokol (${formatDateMY(win.windowStart)} – ${formatDateMY(win.windowEnd)}) telah tamat tempoh`,
        dueAt: win.windowEnd,
        severity: 'segera',
        acknowledged: false,
      });
    }
  }

  const severityRank = { segera: 0, amaran: 1, info: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

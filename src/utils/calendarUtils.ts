import type {
  Appointment,
  ClinicalNote,
  ClinicalTask,
  Patient,
  UrineTestRecord,
  UrineWindowInfo,
} from '../types/clinical';
import { calculateUrineTestWindow, isDateInUrineWindow } from './methadoneProtocol';

export interface CalendarCell {
  dateIso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
}

export interface DaySummaryCounts {
  appointmentsCount: number;
  tasksCount: number;
  pendingTasksCount: number;
  notesCount: number;
  urineWindowsCount: number;
  urineRecordsCount: number;
  totalItems: number;
}

export interface DateAgenda {
  dateIso: string;
  appointments: Array<Appointment & { patientName: string; mrn: string; doseMg: number }>;
  tasks: Array<ClinicalTask & { patientName: string; mrn: string }>;
  notes: Array<ClinicalNote & { patientName?: string; mrn?: string }>;
  urineRecords: Array<UrineTestRecord & { patientName: string; mrn: string }>;
  activeUrineWindows: Array<{
    patient: Patient;
    window: UrineWindowInfo;
  }>;
}

const FULL_MONTHS_MY = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
];

export const WEEKDAY_LABELS_MY = ['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Aha'];

export function getMonthTitleMY(year: number, monthZeroIndexed: number): string {
  const name = FULL_MONTHS_MY[monthZeroIndexed] ?? '';
  return `${name} ${year}`;
}

export function formatIsoYMD(year: number, monthZeroIndexed: number, day: number): string {
  const m = String(monthZeroIndexed + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Builds a Monday-first 7-column monthly calendar grid (always 35 or 42 cells).
 */
export function buildMonthCalendarGrid(
  year: number,
  monthZeroIndexed: number
): CalendarCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthZeroIndexed, 1));
  // JS getUTCDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat -> convert to Mon=0..Sun=6
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
  const totalCells = startWeekday + daysInMonth > 35 ? 42 : 35;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dt = new Date(Date.UTC(year, monthZeroIndexed, 1 - startWeekday + i));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const d = dt.getUTCDate();
    cells.push({
      dateIso: formatIsoYMD(y, m, d),
      dayNumber: d,
      isCurrentMonth: y === year && m === monthZeroIndexed,
    });
  }
  return cells;
}

export function shiftMonth(
  year: number,
  monthZeroIndexed: number,
  delta: number
): { year: number; month: number } {
  const dt = new Date(Date.UTC(year, monthZeroIndexed + delta, 1));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth(),
  };
}

export function getDaySummaryCounts(
  dateIso: string,
  patients: Patient[],
  appointments: Appointment[],
  tasks: ClinicalTask[],
  notes: ClinicalNote[],
  urineRecords: UrineTestRecord[],
  referenceTodayIso: string
): DaySummaryCounts {
  const appointmentsCount = appointments.filter((a) => a.date === dateIso).length;
  const dayTasks = tasks.filter((t) => t.dueDate === dateIso);
  const tasksCount = dayTasks.length;
  const pendingTasksCount = dayTasks.filter((t) => !t.completed).length;
  const notesCount = notes.filter((n) => n.date === dateIso).length;
  const urineRecordsCount = urineRecords.filter((u) => u.testDate === dateIso).length;

  let urineWindowsCount = 0;
  for (const p of patients) {
    const win = calculateUrineTestWindow(p, referenceTodayIso);
    if (isDateInUrineWindow(dateIso, win.windowStart, win.windowEnd)) {
      urineWindowsCount += 1;
    }
  }

  return {
    appointmentsCount,
    tasksCount,
    pendingTasksCount,
    notesCount,
    urineWindowsCount,
    urineRecordsCount,
    totalItems:
      appointmentsCount + tasksCount + notesCount + urineWindowsCount + urineRecordsCount,
  };
}

export function getAgendaForDate(
  dateIso: string,
  patients: Patient[],
  appointments: Appointment[],
  tasks: ClinicalTask[],
  notes: ClinicalNote[],
  urineRecords: UrineTestRecord[],
  referenceTodayIso: string
): DateAgenda {
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const dayAppointments = appointments
    .filter((a) => a.date === dateIso)
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
    .filter((t) => t.dueDate === dateIso)
    .map((t) => {
      const p = patientMap.get(t.patientId);
      return {
        ...t,
        patientName: p?.name ?? 'Pesakit Tidak Dikenali',
        mrn: p?.mrn ?? '-',
      };
    })
    .sort((a, b) => Number(a.completed) - Number(b.completed));

  const dayNotes = notes
    .filter((n) => n.date === dateIso)
    .map((n) => {
      const p = n.patientId ? patientMap.get(n.patientId) : undefined;
      return {
        ...n,
        patientName: p?.name,
        mrn: p?.mrn,
      };
    })
    .sort((a, b) => Number(a.verified) - Number(b.verified));

  const dayUrineRecords = urineRecords
    .filter((u) => u.testDate === dateIso)
    .map((u) => {
      const p = patientMap.get(u.patientId);
      return {
        ...u,
        patientName: p?.name ?? 'Pesakit Tidak Dikenali',
        mrn: p?.mrn ?? '-',
      };
    });

  const activeUrineWindows: DateAgenda['activeUrineWindows'] = [];
  for (const p of patients) {
    const win = calculateUrineTestWindow(p, referenceTodayIso);
    if (isDateInUrineWindow(dateIso, win.windowStart, win.windowEnd)) {
      activeUrineWindows.push({ patient: p, window: win });
    }
  }

  return {
    dateIso,
    appointments: dayAppointments,
    tasks: dayTasks,
    notes: dayNotes,
    urineRecords: dayUrineRecords,
    activeUrineWindows,
  };
}

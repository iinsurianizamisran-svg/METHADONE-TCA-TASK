import type {
  ClinicalTask,
  ManualEntryType,
  TaskCategory,
  TaskPriority,
} from '../types/clinical';
import { addDaysISO } from './methadoneProtocol';

export type RepeatCadence = 'sekali' | 'harian' | 'mingguan';

export interface ManualTaskDraft {
  patientId: string;
  entryType: ManualEntryType;
  title: string;
  details: string;
  orderedBy: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
  repeatCadence: RepeatCadence;
  repeatCount: number;
}

export const MANUAL_ENTRY_TYPE_LABELS: Record<ManualEntryType, string> = {
  tugasan: 'Tugasan Klinikal',
  nota_perubatan: 'Nota Perubatan',
  arahan_pegawai: 'Arahan Pegawai Perubatan',
  lain_lain: 'Peringatan Lain-lain',
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateManualTaskDraft(draft: ManualTaskDraft): ValidationResult {
  if (!draft.patientId.trim()) {
    return { valid: false, error: 'Sila pilih pesakit berdaftar.' };
  }
  if (!draft.title.trim()) {
    return { valid: false, error: 'Sila masukkan tajuk tugasan atau peringatan.' };
  }
  if (!draft.dueDate) {
    return { valid: false, error: 'Sila pilih tarikh untuk dimasukkan ke kalendar.' };
  }
  if (!draft.orderedBy.trim()) {
    return { valid: false, error: 'Sila nyatakan nama pegawai perubatan atau petugas.' };
  }
  if (draft.repeatCadence !== 'sekali' && (draft.repeatCount < 1 || draft.repeatCount > 14)) {
    return { valid: false, error: 'Bilangan ulangan mestilah antara 1 hingga 14 kali.' };
  }
  return { valid: true };
}

export function buildManualTaskEntries(draft: ManualTaskDraft): Omit<ClinicalTask, 'id'>[] {
  const occurrences =
    draft.repeatCadence === 'sekali'
      ? 1
      : Math.max(1, Math.min(14, Math.floor(draft.repeatCount || 1)));
  const stepDays =
    draft.repeatCadence === 'harian' ? 1 : draft.repeatCadence === 'mingguan' ? 7 : 0;

  const entries: Omit<ClinicalTask, 'id'>[] = [];
  for (let i = 0; i < occurrences; i++) {
    const targetDate = stepDays > 0 ? addDaysISO(draft.dueDate, i * stepDays) : draft.dueDate;
    entries.push({
      patientId: draft.patientId,
      entryType: draft.entryType,
      title: draft.title.trim(),
      details: draft.details.trim() || undefined,
      orderedBy: draft.orderedBy.trim(),
      category: draft.category,
      dueDate: targetDate,
      dueTime: draft.dueTime || '09:00',
      priority: draft.priority,
      completed: false,
    });
  }
  return entries;
}

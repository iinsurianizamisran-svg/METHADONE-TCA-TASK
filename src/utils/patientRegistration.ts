import type {
  BloodTestStatus,
  DispensingMode,
  LastUrineSummaryStatus,
  Patient,
  PatientGender,
  ProtocolPhase,
  RegimenType,
} from '../types/clinical';
import {
  addDaysISO,
  calculateNextAppointmentDate,
  calculateUrineTestWindow,
  PROTOCOL_PRESETS,
} from './methadoneProtocol';

export const MIN_DBB_BOTTLES = 1;
export const MAX_DBB_BOTTLES = 6;
export const METHADONE_CONCENTRATION_MG_PER_ML = 5;

export interface RegimenBreakdown {
  regimenType: RegimenType;
  dbbBottles: number; // 0 for DOT, 1..6 for DBB
  dotDaysPerWeek: number; // 7 - dbbBottles
  dispensingMode: DispensingMode;
  doseVolumeMl: number;
  weeklyDbbVolumeMl: number;
  summaryLabel: string;
  scheduleExplanation: string;
}

export interface PatientRegistrationDraft {
  name: string;
  mrn: string;
  icNumber: string;
  dateOfBirth: string;
  gender: PatientGender;
  ethnicity: string;
  phone: string;
  address: string;
  employmentStatus: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  phase: ProtocolPhase;
  doseMg: number;
  regimenType: RegimenType;
  dbbBottles: number;
  prescribingDoctor: string;
  startDate: string;
  nextAppointmentTime: string;
  lastBloodTestDate: string;
  lastBloodTestStatus: BloodTestStatus;
  lastBloodTestNote: string;
  lastUrineTestDate: string;
  lastUrineResult: LastUrineSummaryStatus;
  lastEcgDate: string;
  qtcMs?: number;
  drugAllergies: string;
  comorbidities: string;
  clinicalAlertNote: string;
}

export const BLOOD_TEST_STATUS_LABELS: Record<BloodTestStatus, string> = {
  normal: 'Normal / Terkawal',
  perlu_pemantauan: 'Perlu Pemantauan',
  belum_diambil: 'Belum Diambil',
};

export const LAST_URINE_STATUS_LABELS: Record<LastUrineSummaryStatus, string> = {
  patuh: 'Patuh (Metadon +, Bahan Terlarang -)',
  perhatian: 'Perlu Perhatian',
  belum_diuji: 'Belum Diuji',
};

export function clampDbbBottles(bottles: number): number {
  if (!Number.isFinite(bottles)) return MIN_DBB_BOTTLES;
  return Math.min(MAX_DBB_BOTTLES, Math.max(MIN_DBB_BOTTLES, Math.round(bottles)));
}

/**
 * Calculates DOT clinic days and DBB take-home bottles across a 7-day weekly cycle.
 * - Pure DOT: 7 days clinic DOT, 0 DBB bottles.
 * - DBB: Min 1 bottle, Max 6 bottles -> DOT days = 7 - DBB bottles.
 */
export function computeRegimenBreakdown(
  regimenType: RegimenType,
  requestedDbbBottles: number,
  doseMg: number
): RegimenBreakdown {
  const safeDoseMg = Math.max(0, Number(doseMg) || 0);
  const doseVolumeMl = Number((safeDoseMg / METHADONE_CONCENTRATION_MG_PER_ML).toFixed(1));

  if (regimenType === 'dot') {
    return {
      regimenType: 'dot',
      dbbBottles: 0,
      dotDaysPerWeek: 7,
      dispensingMode: 'dot_harian',
      doseVolumeMl,
      weeklyDbbVolumeMl: 0,
      summaryLabel: 'DOT Harian (7 hari/minggu di klinik · 0 botol DBB)',
      scheduleExplanation:
        'Pesakit hadir setiap hari ke klinik untuk pengambilan dos secara langsung (DOT) tanpa bekalan bawa pulang.',
    };
  }

  const dbbBottles = clampDbbBottles(requestedDbbBottles);
  const dotDaysPerWeek = 7 - dbbBottles;
  const dispensingMode: DispensingMode =
    dbbBottles >= 5 ? 'bawa_pulang_mingguan' : 'bawa_pulang_separa';
  const weeklyDbbVolumeMl = Number((doseVolumeMl * dbbBottles).toFixed(1));

  return {
    regimenType: 'dbb',
    dbbBottles,
    dotDaysPerWeek,
    dispensingMode,
    doseVolumeMl,
    weeklyDbbVolumeMl,
    summaryLabel: `DOT ${dotDaysPerWeek} hari/minggu + DBB ${dbbBottles} botol`,
    scheduleExplanation: `Dalam kitaran 7 hari, pesakit hadir DOT di klinik selama ${dotDaysPerWeek} hari dan dibekalkan ${dbbBottles} botol DBB (${weeklyDbbVolumeMl} mL jumlah DBB).`,
  };
}

/**
 * Parses Malaysian 12-digit MyKad YYMMDD prefix into YYYY-MM-DD when valid.
 */
export function inferDobFromMalaysianIc(icNumber: string, referenceYear = 2026): string | null {
  const digits = icNumber.replace(/\D/g, '');
  if (digits.length < 6) return null;
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const currentTwoDigitYear = referenceYear % 100;
  const fullYear = yy <= currentTwoDigitYear ? 2000 + yy : 1900 + yy;
  return `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function validatePatientRegistrationDraft(
  draft: PatientRegistrationDraft
): { valid: boolean; error?: string } {
  if (!draft.name.trim()) {
    return { valid: false, error: 'Sila masukkan nama penuh pesakit.' };
  }
  if (!draft.mrn.trim()) {
    return { valid: false, error: 'Sila masukkan no. daftar klinikal (MRN).' };
  }
  if (!draft.icNumber.trim()) {
    return { valid: false, error: 'Sila masukkan no. kad pengenalan atau pasport.' };
  }
  if (!draft.phone.trim()) {
    return { valid: false, error: 'Sila masukkan no. telefon pesakit yang boleh dihubungi.' };
  }
  if (!Number.isFinite(draft.doseMg) || draft.doseMg < 5 || draft.doseMg > 200) {
    return { valid: false, error: 'Dos harian metadon hendaklah antara 5 mg hingga 200 mg.' };
  }
  if (
    draft.regimenType === 'dbb' &&
    (!Number.isFinite(draft.dbbBottles) ||
      draft.dbbBottles < MIN_DBB_BOTTLES ||
      draft.dbbBottles > MAX_DBB_BOTTLES)
  ) {
    return {
      valid: false,
      error: `Bilangan botol DBB hendaklah antara ${MIN_DBB_BOTTLES} hingga ${MAX_DBB_BOTTLES} botol sahaja.`,
    };
  }
  if (!draft.startDate) {
    return { valid: false, error: 'Sila pilih tarikh mula protokol rawatan.' };
  }
  return { valid: true };
}

export function buildNewPatientFromDraft(
  draft: PatientRegistrationDraft,
  todayIso: string
): Omit<Patient, 'id'> {
  const preset = PROTOCOL_PRESETS[draft.phase];
  const regimen = computeRegimenBreakdown(draft.regimenType, draft.dbbBottles, draft.doseMg);
  const startDate = draft.startDate || todayIso;

  // Next attendance date: DOT attends daily (+1 day), DBB attends according to phase or DOT interval
  const nextAppointmentDate =
    regimen.regimenType === 'dot'
      ? addDaysISO(startDate, 1)
      : calculateNextAppointmentDate(draft.phase, startDate);

  const patientInput: Omit<Patient, 'id'> = {
    name: draft.name.trim(),
    mrn: draft.mrn.trim(),
    icNumber: draft.icNumber.trim(),
    phone: draft.phone.trim(),
    dateOfBirth: draft.dateOfBirth || undefined,
    gender: draft.gender,
    ethnicity: draft.ethnicity.trim() || undefined,
    address: draft.address.trim() || undefined,
    employmentStatus: draft.employmentStatus.trim() || undefined,
    emergencyContactName: draft.emergencyContactName.trim() || undefined,
    emergencyContactPhone: draft.emergencyContactPhone.trim() || undefined,
    emergencyContactRelation: draft.emergencyContactRelation.trim() || undefined,
    phase: draft.phase,
    doseMg: Number(draft.doseMg),
    regimenType: regimen.regimenType,
    dbbBottles: regimen.dbbBottles,
    dotDaysPerWeek: regimen.dotDaysPerWeek,
    dispensingMode: regimen.dispensingMode,
    prescribingDoctor: draft.prescribingDoctor.trim() || undefined,
    startDate,
    nextAppointmentDate,
    nextAppointmentTime: draft.nextAppointmentTime || '08:30',
    urineIntervalDays: preset.urineIntervalDays,
    urineWindowDays: preset.urineWindowDays,
    lastUrineTestDate: draft.lastUrineTestDate || undefined,
    lastUrineResult: draft.lastUrineResult,
    lastBloodTestDate: draft.lastBloodTestDate || undefined,
    lastBloodTestStatus: draft.lastBloodTestStatus,
    lastBloodTestNote: draft.lastBloodTestNote.trim() || undefined,
    lastEcgDate: draft.lastEcgDate || undefined,
    qtcMs: draft.qtcMs && draft.qtcMs > 0 ? Number(draft.qtcMs) : undefined,
    drugAllergies: draft.drugAllergies.trim() || undefined,
    comorbidities: draft.comorbidities.trim() || undefined,
    clinicalAlertNote: draft.clinicalAlertNote.trim() || undefined,
  };

  return patientInput;
}

export function previewRegistrationSchedule(
  draft: Pick<
    PatientRegistrationDraft,
    'phase' | 'doseMg' | 'regimenType' | 'dbbBottles' | 'startDate' | 'lastUrineTestDate'
  >,
  todayIso: string
) {
  const preset = PROTOCOL_PRESETS[draft.phase];
  const regimen = computeRegimenBreakdown(draft.regimenType, draft.dbbBottles, draft.doseMg);
  const start = draft.startDate || todayIso;
  const nextAppointmentDate =
    regimen.regimenType === 'dot'
      ? addDaysISO(start, 1)
      : calculateNextAppointmentDate(draft.phase, start);

  const urineWindow = calculateUrineTestWindow(
    {
      startDate: start,
      phase: draft.phase,
      urineIntervalDays: preset.urineIntervalDays,
      urineWindowDays: preset.urineWindowDays,
      lastUrineTestDate: draft.lastUrineTestDate || undefined,
    },
    todayIso
  );

  return {
    regimen,
    nextAppointmentDate,
    urineWindow,
    preset,
  };
}

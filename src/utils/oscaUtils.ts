import type {
  Appointment,
  ClinicalTask,
  OscaInterventionRecord,
  OscaRiskLevel,
  OscaServiceDomain,
  Patient,
  UrineTestRecord,
  UrineWindowInfo,
} from '../types/clinical';
import { calculateUrineTestWindow } from './methadoneProtocol';

export const OSCA_DOMAIN_LABELS: Record<OscaServiceDomain, string> = {
  kaunseling_psikososial: 'Kaunseling & Psikososial',
  rujukan_pakar: 'Rujukan Pakar / Hospital',
  sokongan_sosial: 'Sokongan Sosial & Keluarga',
  saringan_kesihatan: 'Saringan Kesihatan (HIV/Hep)',
  pemantauan_pemulihan: 'Pemantauan Pemulihan',
};

export const OSCA_RISK_LABELS: Record<OscaRiskLevel, string> = {
  stabil: 'Stabil (Rutin)',
  pemantauan: 'Pemantauan Berkala',
  tinggi: 'Intervensi Segera',
};

export interface OscaClientProfile {
  patient: Patient;
  urineWindow: UrineWindowInfo;
  latestUrineRecord?: UrineTestRecord;
  nextAppointment?: Appointment;
  pendingTasksCount: number;
  urgentTasksCount: number;
  missedAppointmentsCount: number;
  activeOscaCount: number;
  needsAttention: boolean;
  riskLevel: OscaRiskLevel;
}

export interface OscaSummaryStats {
  totalClients: number;
  attentionClientsCount: number;
  activeInterventionsCount: number;
  compliantUrineCount: number;
  totalUrineRecordsCount: number;
}

export interface OscaDraftInput {
  patientId: string;
  serviceDomain: OscaServiceDomain;
  riskLevel: OscaRiskLevel;
  actionDate: string;
  title: string;
  planNote: string;
  agencyOrOfficer: string;
}

export function validateOscaDraft(draft: OscaDraftInput): {
  valid: boolean;
  error?: string;
} {
  if (!draft.patientId.trim()) {
    return { valid: false, error: 'Sila pilih klien berdaftar dari modul Metadon.' };
  }
  if (!draft.title.trim()) {
    return { valid: false, error: 'Sila masukkan tajuk intervensi atau rujukan OSCA.' };
  }
  if (!draft.actionDate) {
    return { valid: false, error: 'Sila pilih tarikh tindakan OSCA.' };
  }
  if (!draft.agencyOrOfficer.trim()) {
    return { valid: false, error: 'Sila nyatakan pegawai atau agensi terlibat.' };
  }
  if (!draft.planNote.trim()) {
    return { valid: false, error: 'Sila masukkan pelan intervensi atau catatan sokongan OSCA.' };
  }
  return { valid: true };
}

export function buildOscaClientProfile(
  patient: Patient,
  appointments: Appointment[],
  tasks: ClinicalTask[],
  urineRecords: UrineTestRecord[],
  oscaRecords: OscaInterventionRecord[],
  todayIso: string
): OscaClientProfile {
  const urineWindow = calculateUrineTestWindow(patient, todayIso);

  const patientUrine = urineRecords
    .filter((u) => u.patientId === patient.id)
    .sort((a, b) => b.testDate.localeCompare(a.testDate));
  const latestUrineRecord = patientUrine[0];

  const patientAppts = appointments
    .filter((a) => a.patientId === patient.id)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const nextAppointment =
    patientAppts.find((a) => a.date >= todayIso && a.status === 'dijadualkan') ??
    patientAppts[patientAppts.length - 1];

  const missedAppointmentsCount = patientAppts.filter(
    (a) => a.status === 'tidak_hadir'
  ).length;

  const patientPendingTasks = tasks.filter(
    (t) => t.patientId === patient.id && !t.completed
  );
  const urgentTasksCount = patientPendingTasks.filter(
    (t) => t.priority === 'segera'
  ).length;

  const activePatientOsca = oscaRecords.filter(
    (r) => r.patientId === patient.id && r.status === 'aktif'
  );
  const hasHighRiskOsca = activePatientOsca.some((r) => r.riskLevel === 'tinggi');

  const needsAttention =
    latestUrineRecord?.overallStatus === 'perhatian' ||
    missedAppointmentsCount > 0 ||
    urineWindow.status === 'tamat_tempoh' ||
    hasHighRiskOsca ||
    urgentTasksCount > 0;

  let riskLevel: OscaRiskLevel = 'stabil';
  if (
    latestUrineRecord?.overallStatus === 'perhatian' ||
    missedAppointmentsCount > 0 ||
    urineWindow.status === 'tamat_tempoh' ||
    hasHighRiskOsca
  ) {
    riskLevel = 'tinggi';
  } else if (
    patient.phase === 'induksi' ||
    urineWindow.status === 'dalam_julat' ||
    activePatientOsca.some((r) => r.riskLevel === 'pemantauan') ||
    patientPendingTasks.length > 0
  ) {
    riskLevel = 'pemantauan';
  }

  return {
    patient,
    urineWindow,
    latestUrineRecord,
    nextAppointment,
    pendingTasksCount: patientPendingTasks.length,
    urgentTasksCount,
    missedAppointmentsCount,
    activeOscaCount: activePatientOsca.length,
    needsAttention,
    riskLevel,
  };
}

export function computeOscaSummaryStats(
  profiles: OscaClientProfile[],
  oscaRecords: OscaInterventionRecord[],
  urineRecords: UrineTestRecord[]
): OscaSummaryStats {
  const attentionClientsCount = profiles.filter((p) => p.needsAttention).length;
  const activeInterventionsCount = oscaRecords.filter((r) => r.status === 'aktif').length;
  const compliantUrineCount = urineRecords.filter((u) => u.overallStatus === 'patuh').length;

  return {
    totalClients: profiles.length,
    attentionClientsCount,
    activeInterventionsCount,
    compliantUrineCount,
    totalUrineRecordsCount: urineRecords.length,
  };
}

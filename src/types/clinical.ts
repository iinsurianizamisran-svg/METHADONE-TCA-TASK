export type ProtocolPhase = 'induksi' | 'penstabilan' | 'penyelenggaraan';

export type DispensingMode =
  | 'dot_harian'
  | 'bawa_pulang_separa'
  | 'bawa_pulang_mingguan';

export type AppointmentStatus =
  | 'dijadualkan'
  | 'hadir'
  | 'tidak_hadir'
  | 'ditunda';

export type TaskCategory =
  | 'dos'
  | 'urin'
  | 'kaunseling'
  | 'susulan'
  | 'dokumen';

export type TaskPriority = 'biasa' | 'penting' | 'segera';

export type UrineSubstanceResult = 'negatif' | 'positif' | 'tidak_diuji';

export interface Patient {
  id: string;
  name: string;
  mrn: string;
  icNumber: string;
  phone: string;
  phase: ProtocolPhase;
  doseMg: number;
  dispensingMode: DispensingMode;
  startDate: string; // YYYY-MM-DD
  nextAppointmentDate: string; // YYYY-MM-DD
  nextAppointmentTime: string; // HH:mm
  urineIntervalDays: number;
  urineWindowDays: number;
  lastUrineTestDate?: string; // YYYY-MM-DD
  clinicalAlertNote?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  purpose: string;
  status: AppointmentStatus;
  notes?: string;
}

export type ManualEntryType =
  | 'tugasan'
  | 'nota_perubatan'
  | 'arahan_pegawai'
  | 'lain_lain';

export interface ClinicalTask {
  id: string;
  patientId: string;
  title: string;
  entryType?: ManualEntryType;
  details?: string;
  orderedBy?: string;
  category: TaskCategory;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: TaskPriority;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export type NoteCategory = 'klinikal' | 'dos' | 'kaunseling' | 'pentadbiran';

export interface ClinicalNote {
  id: string;
  patientId?: string;
  date: string; // YYYY-MM-DD
  category: NoteCategory;
  title: string;
  content: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  createdBy: string;
}

export interface UrineTestRecord {
  id: string;
  patientId: string;
  testDate: string; // YYYY-MM-DD
  protocolWindowStart: string; // YYYY-MM-DD
  protocolWindowEnd: string; // YYYY-MM-DD
  withinProtocolWindow: boolean;
  methadoneMetabolite: 'positif' | 'negatif';
  morphine: UrineSubstanceResult;
  amphetamine: UrineSubstanceResult;
  thc: UrineSubstanceResult;
  benzodiazepine: UrineSubstanceResult;
  overallStatus: 'patuh' | 'perhatian';
  recordedBy: string;
  clinicalNote: string;
}

export interface PushSettings {
  enabled: boolean;
  intervalMinutes: 15 | 30 | 60 | 120;
  soundEnabled: boolean;
  browserPermission: 'default' | 'granted' | 'denied' | 'unsupported';
  lastTriggeredAt?: string;
}

export interface PushAlertItem {
  id: string;
  patientId: string;
  patientName: string;
  type: 'temujanji' | 'tugasan' | 'urin';
  title: string;
  detail: string;
  dueAt: string;
  severity: 'segera' | 'amaran' | 'info';
  acknowledged: boolean;
}

export interface UrineWindowInfo {
  windowStart: string;
  windowEnd: string;
  cycleNumber: number;
  status: 'dalam_julat' | 'akan_datang' | 'tamat_tempoh';
  daysUntilStart: number;
  daysRemainingInWindow: number;
}

export interface DailySummaryReport {
  reportDate: string;
  totalScheduledAppointments: number;
  attendedCount: number;
  absentCount: number;
  pendingAppointmentsCount: number;
  totalTasksDue: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  urineTestsCount: number;
  urineCompliantCount: number;
  urineAttentionCount: number;
  patientsInActiveUrineWindow: number;
  overdueItems: Array<{
    patientName: string;
    mrn: string;
    description: string;
    type: 'temujanji' | 'tugasan' | 'urin';
  }>;
  appointments: Array<Appointment & { patientName: string; mrn: string; doseMg: number }>;
  tasks: Array<ClinicalTask & { patientName: string; mrn: string }>;
  urineRecords: Array<UrineTestRecord & { patientName: string; mrn: string }>;
}

export type OscaServiceDomain =
  | 'kaunseling_psikososial'
  | 'rujukan_pakar'
  | 'sokongan_sosial'
  | 'saringan_kesihatan'
  | 'pemantauan_pemulihan';

export type OscaRiskLevel = 'stabil' | 'pemantauan' | 'tinggi';

export interface OscaInterventionRecord {
  id: string;
  patientId: string;
  serviceDomain: OscaServiceDomain;
  riskLevel: OscaRiskLevel;
  actionDate: string; // YYYY-MM-DD
  title: string;
  planNote: string;
  agencyOrOfficer: string;
  status: 'aktif' | 'selesai';
  completedAt?: string;
  syncedTaskId?: string;
}

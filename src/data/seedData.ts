import type {
  Appointment,
  ClinicalNote,
  ClinicalTask,
  OscaInterventionRecord,
  Patient,
  PushSettings,
  UrineTestRecord,
} from '../types/clinical';
import { addDaysISO } from '../utils/methadoneProtocol';

export function getLocalTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface ClinicalStoreState {
  patients: Patient[];
  appointments: Appointment[];
  tasks: ClinicalTask[];
  notes: ClinicalNote[];
  urineRecords: UrineTestRecord[];
  oscaRecords: OscaInterventionRecord[];
  pushSettings: PushSettings;
  activePatientId: string;
}

export function createDefaultSeedNotes(todayIso = getLocalTodayISO()): ClinicalNote[] {
  return [
    {
      id: 'note-1',
      patientId: 'pat-1',
      date: todayIso,
      category: 'klinikal',
      title: 'Pemerhatian Hari ke-7 Induksi',
      content: 'Pastikan pesakit dipantau 30 minit selepas dos 45 mg kerana peningkatan dos semalam.',
      verified: false,
      createdBy: 'Dr. Hakimah Idris',
    },
    {
      id: 'note-2',
      patientId: 'pat-2',
      date: todayIso,
      category: 'dos',
      title: 'Semakan Bekalan Bawa Pulang 3+4',
      content: 'Pesakit layak menerima bekalan bawa pulang sekiranya ujian urin hari ini patuh dan negatif.',
      verified: true,
      verifiedAt: `${todayIso}T08:15:00`,
      verifiedBy: 'SN Nurul Aisyah',
      createdBy: 'SN Nurul Aisyah',
    },
    {
      id: 'note-3',
      patientId: 'pat-3',
      date: addDaysISO(todayIso, 2),
      category: 'kaunseling',
      title: 'Sesi Kaunseling Sokongan Pekerjaan',
      content: 'Susulan penyesuaian syif kerja dan penyimpanan selamat botol metadon di rumah.',
      verified: false,
      createdBy: 'Pegawai Farmasi Azman',
    },
  ];
}

export function createDefaultSeedOscaRecords(
  todayIso = getLocalTodayISO()
): OscaInterventionRecord[] {
  return [
    {
      id: 'osca-1',
      patientId: 'pat-1',
      serviceDomain: 'saringan_kesihatan',
      riskLevel: 'pemantauan',
      actionDate: todayIso,
      title: 'Saringan Kesihatan Asas OSCA (HIV / Hep B / Hep C) & Orientasi',
      planNote:
        'Pesakit dalam fasa induksi Metadon. Lakukan saringan penyakit berjangkit dan kenalkan kaunselor sokongan OSCA.',
      agencyOrOfficer: 'Kaunselor OSCA · Pn. Farah Nabila',
      status: 'aktif',
    },
    {
      id: 'osca-2',
      patientId: 'pat-2',
      serviceDomain: 'sokongan_sosial',
      riskLevel: 'pemantauan',
      actionDate: todayIso,
      title: 'Penilaian Sokongan Keluarga untuk Bekalan Bawa Pulang',
      planNote:
        'Sahkan penjaga atau ahli keluarga memahami tatacara penyimpanan selamat metadon di rumah.',
      agencyOrOfficer: 'Pekerja Sosial Perubatan · En. Hafiz',
      status: 'aktif',
    },
    {
      id: 'osca-3',
      patientId: 'pat-3',
      serviceDomain: 'kaunseling_psikososial',
      riskLevel: 'stabil',
      actionDate: addDaysISO(todayIso, 2),
      title: 'Kaunseling Pencegahan Relaps & Penyesuaian Kerjaya',
      planNote:
        'Sesi susulan bulanan OSCA bagi mengekalkan pemulihan stabil serta kesinambungan pekerjaan.',
      agencyOrOfficer: 'Kaunselor OSCA · Pn. Farah Nabila',
      status: 'aktif',
    },
  ];
}

export function createInitialClinicalState(todayIso = getLocalTodayISO()): ClinicalStoreState {
  const patients: Patient[] = [
    {
      id: 'pat-1',
      name: 'Ahmad Firdaus bin Salleh',
      mrn: 'MTD-2026-014',
      icNumber: '860412-14-5219',
      phone: '012-648 9120',
      phase: 'induksi',
      doseMg: 45,
      dispensingMode: 'dot_harian',
      startDate: addDaysISO(todayIso, -7), // Window starts today!
      nextAppointmentDate: todayIso,
      nextAppointmentTime: '08:30',
      urineIntervalDays: 7,
      urineWindowDays: 3,
      clinicalAlertNote: 'Pantau paras sedasi 30 minit selepas pengambilan dos.',
    },
    {
      id: 'pat-2',
      name: 'Mohd Zulhilmi bin Razak',
      mrn: 'MTD-2025-089',
      icNumber: '810903-08-3341',
      phone: '013-992 4180',
      phase: 'penstabilan',
      doseMg: 70,
      dispensingMode: 'bawa_pulang_separa',
      startDate: addDaysISO(todayIso, -42),
      lastUrineTestDate: addDaysISO(todayIso, -15), // Window started 1 day ago (4-day window)
      nextAppointmentDate: todayIso,
      nextAppointmentTime: '09:15',
      urineIntervalDays: 14,
      urineWindowDays: 4,
      clinicalAlertNote: 'Layak bawa pulang hujung minggu jika saringan urin negatif.',
    },
    {
      id: 'pat-3',
      name: 'Suresh a/l Krishnan',
      mrn: 'MTD-2024-032',
      icNumber: '791120-10-5891',
      phone: '016-331 7402',
      phase: 'penyelenggaraan',
      doseMg: 60,
      dispensingMode: 'bawa_pulang_mingguan',
      startDate: addDaysISO(todayIso, -180),
      lastUrineTestDate: addDaysISO(todayIso, -12),
      nextAppointmentDate: addDaysISO(todayIso, 2),
      nextAppointmentTime: '10:00',
      urineIntervalDays: 30,
      urineWindowDays: 5,
      clinicalAlertNote: 'Patuh rawatan baik. Sesi kaunseling sokongan kerja dijadualkan.',
    },
  ];

  const appointments: Appointment[] = [
    {
      id: 'appt-1',
      patientId: 'pat-1',
      date: todayIso,
      time: '08:30',
      purpose: 'Dos Harian DOT & Semakan Induksi',
      status: 'dijadualkan',
      notes: 'Hari ke-7 induksi — saringan urin protokol bermula hari ini.',
    },
    {
      id: 'appt-2',
      patientId: 'pat-2',
      date: todayIso,
      time: '09:15',
      purpose: 'Pengambilan Dos & Bekalan Bawa Pulang',
      status: 'dijadualkan',
      notes: 'Perlu serah sampel urin sebelum pemberian botol bawa pulang.',
    },
    {
      id: 'appt-3',
      patientId: 'pat-3',
      date: addDaysISO(todayIso, 2),
      time: '10:00',
      purpose: 'Semakan Dos Penyelenggaraan & Kaunseling',
      status: 'dijadualkan',
      notes: 'Bawa semula baki botol kosong untuk pengesahan.',
    },
    {
      id: 'appt-4',
      patientId: 'pat-1',
      date: addDaysISO(todayIso, -1),
      time: '08:30',
      purpose: 'Dos Harian DOT',
      status: 'hadir',
      notes: 'Dos 45 mg diambil di bawah penyeliaan.',
    },
  ];

  const tasks: ClinicalTask[] = [
    {
      id: 'task-1',
      patientId: 'pat-1',
      title: 'Pengesahan identiti & pemberian dos metadon 45 mg (DOT)',
      category: 'dos',
      dueDate: todayIso,
      dueTime: '08:30',
      priority: 'segera',
      completed: false,
    },
    {
      id: 'task-2',
      patientId: 'pat-1',
      title: 'Ambil sampel ujian urin (Julat Protokol Hari 7–9)',
      category: 'urin',
      dueDate: todayIso,
      dueTime: '08:45',
      priority: 'segera',
      completed: false,
    },
    {
      id: 'task-3',
      patientId: 'pat-1',
      title: 'Penilaian skor COWS & pantau sedasi 30 minit',
      category: 'susulan',
      dueDate: todayIso,
      dueTime: '09:05',
      priority: 'penting',
      completed: false,
    },
    {
      id: 'task-4',
      patientId: 'pat-2',
      title: 'Semak kelayakan bekalan bawa pulang (3+4) & dos 70 mg',
      category: 'dos',
      dueDate: todayIso,
      dueTime: '09:15',
      priority: 'penting',
      completed: true,
      completedAt: `${todayIso}T09:20:00`,
      completedBy: 'SN Nurul Aisyah',
    },
    {
      id: 'task-5',
      patientId: 'pat-2',
      title: 'Rekod keputusan ujian urin saringan berkala',
      category: 'urin',
      dueDate: todayIso,
      dueTime: '09:30',
      priority: 'segera',
      completed: false,
    },
    {
      id: 'task-6',
      patientId: 'pat-3',
      title: 'Sediakan borang semakan pemulihan bulanan',
      category: 'dokumen',
      dueDate: addDaysISO(todayIso, 2),
      dueTime: '10:00',
      priority: 'biasa',
      completed: false,
    },
  ];

  const urineRecords: UrineTestRecord[] = [
    {
      id: 'urin-1',
      patientId: 'pat-2',
      testDate: addDaysISO(todayIso, -15),
      protocolWindowStart: addDaysISO(todayIso, -16),
      protocolWindowEnd: addDaysISO(todayIso, -13),
      withinProtocolWindow: true,
      methadoneMetabolite: 'positif',
      morphine: 'negatif',
      amphetamine: 'negatif',
      thc: 'negatif',
      benzodiazepine: 'negatif',
      overallStatus: 'patuh',
      recordedBy: 'SN Nurul Aisyah',
      clinicalNote: 'Sampel jernih, suhu normal. Patuh penuh kepada dos 70 mg.',
    },
    {
      id: 'urin-2',
      patientId: 'pat-3',
      testDate: addDaysISO(todayIso, -12),
      protocolWindowStart: addDaysISO(todayIso, -14),
      protocolWindowEnd: addDaysISO(todayIso, -10),
      withinProtocolWindow: true,
      methadoneMetabolite: 'positif',
      morphine: 'negatif',
      amphetamine: 'negatif',
      thc: 'negatif',
      benzodiazepine: 'negatif',
      overallStatus: 'patuh',
      recordedBy: 'Dr. Hakimah Idris',
      clinicalNote: 'Tiada penggunaan bahan terlarang dikesan. Kekalkan jadual bawa pulang.',
    },
  ];

  const notes = createDefaultSeedNotes(todayIso);
  const oscaRecords = createDefaultSeedOscaRecords(todayIso);

  return {
    patients,
    appointments,
    tasks,
    notes,
    urineRecords,
    oscaRecords,
    pushSettings: {
      enabled: true,
      intervalMinutes: 30,
      soundEnabled: false,
      browserPermission:
        typeof window !== 'undefined' && 'Notification' in window
          ? (Notification.permission as PushSettings['browserPermission'])
          : 'unsupported',
    },
    activePatientId: 'pat-1',
  };
}

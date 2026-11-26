import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  BloodTestStatus,
  LastUrineSummaryStatus,
  Patient,
  PatientGender,
  ProtocolPhase,
  RegimenType,
} from '../types/clinical';
import { formatDateMY, PROTOCOL_PRESETS } from '../utils/methadoneProtocol';
import {
  BLOOD_TEST_STATUS_LABELS,
  buildNewPatientFromDraft,
  inferDobFromMalaysianIc,
  LAST_URINE_STATUS_LABELS,
  MAX_DBB_BOTTLES,
  MIN_DBB_BOTTLES,
  type PatientRegistrationDraft,
  previewRegistrationSchedule,
  validatePatientRegistrationDraft,
} from '../utils/patientRegistration';

interface DaftarPesakitViewProps {
  todayIso: string;
  patientsCount: number;
  onRegisterPatient: (patient: Omit<Patient, 'id'>, enrollInOsca: boolean) => string;
  onOpenPatientSession: (patientId: string) => void;
  onOpenRosterTab: () => void;
}

const ETHNICITY_OPTIONS = ['Melayu', 'Cina', 'India', 'Bumiputera Sabah / Sarawak', 'Lain-lain'];
const EMPLOYMENT_OPTIONS = [
  'Bekerja Sepenuh Masa',
  'Bekerja Sendiri',
  'Kerja Sambilan',
  'Tidak Bekerja',
  'Pelajar / Latihan',
];

export const DaftarPesakitView: React.FC<DaftarPesakitViewProps> = ({
  todayIso,
  patientsCount,
  onRegisterPatient,
  onOpenPatientSession,
  onOpenRosterTab,
}) => {
  const createInitialDraft = (count: number): PatientRegistrationDraft => ({
    name: '',
    mrn: `MTD-2026-${String(count + 15).padStart(3, '0')}`,
    icNumber: '',
    dateOfBirth: '',
    gender: 'lelaki',
    ethnicity: 'Melayu',
    phone: '',
    address: '',
    employmentStatus: 'Bekerja Sepenuh Masa',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: 'Waris / Keluarga',
    phase: 'induksi',
    doseMg: 30,
    regimenType: 'dot',
    dbbBottles: 1,
    prescribingDoctor: 'Dr. Hakimah Idris',
    startDate: todayIso,
    nextAppointmentTime: '08:30',
    lastBloodTestDate: '',
    lastBloodTestStatus: 'belum_diambil',
    lastBloodTestNote: '',
    lastUrineTestDate: '',
    lastUrineResult: 'belum_diuji',
    lastEcgDate: '',
    qtcMs: undefined,
    drugAllergies: 'Tiada alahan diketahui',
    comorbidities: '',
    clinicalAlertNote: '',
  });

  const [draft, setDraft] = useState<PatientRegistrationDraft>(() =>
    createInitialDraft(patientsCount)
  );
  const [enrollInOsca, setEnrollInOsca] = useState(true);
  const [formError, setFormError] = useState('');
  const [registeredResult, setRegisteredResult] = useState<{
    patientId: string;
    name: string;
    mrn: string;
    regimenSummary: string;
    nextDate: string;
  } | null>(null);

  const schedulePreview = useMemo(
    () =>
      previewRegistrationSchedule(
        {
          phase: draft.phase,
          doseMg: draft.doseMg,
          regimenType: draft.regimenType,
          dbbBottles: draft.dbbBottles,
          startDate: draft.startDate,
          lastUrineTestDate: draft.lastUrineTestDate,
        },
        todayIso
      ),
    [
      draft.phase,
      draft.doseMg,
      draft.regimenType,
      draft.dbbBottles,
      draft.startDate,
      draft.lastUrineTestDate,
      todayIso,
    ]
  );

  const updateField = <K extends keyof PatientRegistrationDraft>(
    key: K,
    value: PatientRegistrationDraft[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleIcChange = (value: string) => {
    const inferredDob = inferDobFromMalaysianIc(value, Number(todayIso.slice(0, 4)) || 2026);
    setDraft((prev) => ({
      ...prev,
      icNumber: value,
      dateOfBirth: inferredDob ?? prev.dateOfBirth,
    }));
  };

  const handlePhaseChange = (nextPhase: ProtocolPhase) => {
    setDraft((prev) => {
      if (nextPhase === 'induksi') {
        return { ...prev, phase: nextPhase, regimenType: 'dot' };
      }
      if (nextPhase === 'penstabilan') {
        return {
          ...prev,
          phase: nextPhase,
          regimenType: 'dbb',
          dbbBottles: Math.min(4, Math.max(MIN_DBB_BOTTLES, prev.dbbBottles || 3)),
        };
      }
      return {
        ...prev,
        phase: nextPhase,
        regimenType: 'dbb',
        dbbBottles: prev.dbbBottles || 6,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePatientRegistrationDraft(draft);
    if (!validation.valid) {
      setFormError(validation.error ?? 'Sila lengkapkan maklumat pendaftaran pesakit.');
      return;
    }

    setFormError('');
    const newPatient = buildNewPatientFromDraft(draft, todayIso);
    const createdId = onRegisterPatient(newPatient, enrollInOsca);

    setRegisteredResult({
      patientId: createdId,
      name: newPatient.name,
      mrn: newPatient.mrn,
      regimenSummary: schedulePreview.regimen.summaryLabel,
      nextDate: newPatient.nextAppointmentDate,
    });

    setDraft(createInitialDraft(patientsCount + 1));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700">
              Pendaftaran Klinikal · Terapi Gantian Metadon (MMT)
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Modul Daftar Pesakit Baharu
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Rekodkan maklumat demografik, dos &amp; regimen Metadon (DOT / DBB 1–6 botol), serta tarikh akhir ujian darah dan urin untuk menjana jadual protokol secara automatik.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRosterTab}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Users className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            Lihat Senarai Pesakit ({patientsCount})
          </button>
        </div>

        {registeredResult && (
          <div
            role="status"
            data-testid="patient-registered-banner"
            className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="font-semibold text-sm">
                  Pesakit {registeredResult.name} ({registeredResult.mrn}) berjaya didaftarkan!
                </div>
                <div className="mt-0.5 text-emerald-800">
                  Regimen: {registeredResult.regimenSummary} · Temujanji pertama:{' '}
                  <span className="font-mono font-semibold">
                    {formatDateMY(registeredResult.nextDate)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenPatientSession(registeredResult.patientId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap"
              >
                <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
                Buka Sesi Klinikal
              </button>
              <button
                type="button"
                onClick={onOpenRosterTab}
                className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-white border border-teal-300 rounded-lg hover:bg-teal-50 whitespace-nowrap"
              >
                Senarai Pesakit
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main 12-Col Registration Form + Live Automatic Schedule Preview */}
      <form
        onSubmit={handleSubmit}
        aria-label="Borang pendaftaran pesakit metadon baharu"
        className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
      >
        {/* Left 8 Cols: Complete Multi-Section Form */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
          {/* SECTION 1: DEMOGRAFIK & WARIS */}
          <section aria-label="Maklumat demografik pesakit" className="space-y-4">
            <div className="pb-2 border-b border-slate-100">
              <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                Bahagian 1 · Maklumat Demografik &amp; Waris
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Butiran pengenalan diri, alamat kediaman dan waris kecemasan pesakit.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="dp-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Penuh Pesakit <span className="text-red-600">*</span>
                </label>
                <input
                  id="dp-name"
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Cth: Mohamad Hafiz bin Osman"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-mrn" className="block text-xs font-medium text-slate-700 mb-1">
                  No. Daftar Klinikal (MRN) <span className="text-red-600">*</span>
                </label>
                <input
                  id="dp-mrn"
                  type="text"
                  value={draft.mrn}
                  onChange={(e) => updateField('mrn', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-ic" className="block text-xs font-medium text-slate-700 mb-1">
                  No. Kad Pengenalan / Pasport <span className="text-red-600">*</span>
                </label>
                <input
                  id="dp-ic"
                  type="text"
                  value={draft.icNumber}
                  onChange={(e) => handleIcChange(e.target.value)}
                  placeholder="Cth: 880512-10-4411"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-dob" className="block text-xs font-medium text-slate-700 mb-1">
                  Tarikh Lahir
                </label>
                <input
                  id="dp-dob"
                  type="date"
                  value={draft.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="dp-gender" className="block text-xs font-medium text-slate-700 mb-1">
                  Jantina
                </label>
                <select
                  id="dp-gender"
                  value={draft.gender}
                  onChange={(e) => updateField('gender', e.target.value as PatientGender)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="lelaki">Lelaki</option>
                  <option value="perempuan">Perempuan</option>
                </select>
              </div>

              <div>
                <label htmlFor="dp-ethnicity" className="block text-xs font-medium text-slate-700 mb-1">
                  Bangsa / Etnik
                </label>
                <select
                  id="dp-ethnicity"
                  value={draft.ethnicity}
                  onChange={(e) => updateField('ethnicity', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {ETHNICITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="dp-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  No. Telefon Pesakit <span className="text-red-600">*</span>
                </label>
                <input
                  id="dp-phone"
                  type="text"
                  value={draft.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="Cth: 012-345 6789"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-employment" className="block text-xs font-medium text-slate-700 mb-1">
                  Status Pekerjaan
                </label>
                <select
                  id="dp-employment"
                  value={draft.employmentStatus}
                  onChange={(e) => updateField('employmentStatus', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {EMPLOYMENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="dp-address" className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat Kediaman Semasa
                </label>
                <input
                  id="dp-address"
                  type="text"
                  value={draft.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Alamat penuh kediaman untuk tujuan pengesanan & lawatan susulan"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-ec-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Waris / Penjaga
                </label>
                <input
                  id="dp-ec-name"
                  type="text"
                  value={draft.emergencyContactName}
                  onChange={(e) => updateField('emergencyContactName', e.target.value)}
                  placeholder="Nama ahli keluarga / penjaga"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-ec-relation" className="block text-xs font-medium text-slate-700 mb-1">
                  Hubungan Waris
                </label>
                <input
                  id="dp-ec-relation"
                  type="text"
                  value={draft.emergencyContactRelation}
                  onChange={(e) => updateField('emergencyContactRelation', e.target.value)}
                  placeholder="Cth: Isteri / Ibu / Bapa"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-ec-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  No. Telefon Waris
                </label>
                <input
                  id="dp-ec-phone"
                  type="text"
                  value={draft.emergencyContactPhone}
                  onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                  placeholder="Cth: 019-221 4401"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>
            </div>
          </section>

          {/* SECTION 2: DOS & REGIMEN METHADONE (DOT & DBB 1-6 BOTOL) */}
          <section aria-label="Dos dan regimen metadon" className="pt-5 border-t border-slate-100 space-y-4">
            <div className="pb-2 border-b border-slate-100">
              <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                Bahagian 2 · Dos &amp; Regimen Metadon (DOT &amp; DBB)
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kehadiran DOT klinik bergantung kepada bilangan botol DBB yang diberikan (Minimum 1 botol, Maksimum 6 botol seminggu).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="dp-phase" className="block text-xs font-medium text-slate-700 mb-1">
                  Fasa Protokol Rawatan
                </label>
                <select
                  id="dp-phase"
                  value={draft.phase}
                  onChange={(e) => handlePhaseChange(e.target.value as ProtocolPhase)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {Object.entries(PROTOCOL_PRESETS).map(([k, preset]) => (
                    <option key={k} value={k}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="dp-dose" className="block text-xs font-medium text-slate-700 mb-1">
                  Dos Harian (mg) <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="dp-dose"
                    type="number"
                    min={5}
                    max={200}
                    step={5}
                    value={draft.doseMg}
                    onChange={(e) => updateField('doseMg', Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                  <span className="text-xs font-mono text-slate-500 whitespace-nowrap shrink-0">
                    ({schedulePreview.regimen.doseVolumeMl} mL)
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="dp-start-date" className="block text-xs font-medium text-slate-700 mb-1">
                  Tarikh Mula Protokol
                </label>
                <input
                  id="dp-start-date"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="dp-appt-time" className="block text-xs font-medium text-slate-700 mb-1">
                  Masa Temujanji
                </label>
                <input
                  id="dp-appt-time"
                  type="time"
                  value={draft.nextAppointmentTime}
                  onChange={(e) => updateField('nextAppointmentTime', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Regimen Selector: DOT vs DBB */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div>
                <span className="block text-xs font-semibold text-slate-800 mb-2">
                  Regimen Pemberian Metadon
                </span>
                <div
                  role="group"
                  aria-label="Pilih regimen DOT atau DBB"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                >
                  {(
                    [
                      {
                        key: 'dot' as RegimenType,
                        title: 'DOT (Minum di Klinik Sahaja)',
                        sub: '7 hari/minggu hadir DOT · 0 botol DBB',
                      },
                      {
                        key: 'dbb' as RegimenType,
                        title: 'DBB (Dos Bawa Pulang)',
                        sub: 'DOT bergantung kepada jumlah DBB (Min 1 – Max 6 botol)',
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => updateField('regimenType', opt.key)}
                      aria-pressed={draft.regimenType === opt.key}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        draft.regimenType === opt.key
                          ? 'bg-white border-teal-700 ring-1 ring-teal-700'
                          : 'bg-slate-50 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{opt.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {draft.regimenType === 'dbb' && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="dp-dbb-bottles" className="text-xs font-semibold text-slate-800">
                      Bilangan Botol DBB Diberikan (Min {MIN_DBB_BOTTLES} Botol – Max {MAX_DBB_BOTTLES} Botol)
                    </label>
                    <span className="text-xs font-mono font-semibold text-teal-800 tabular-nums">
                      DOT Klinik: {schedulePreview.regimen.dotDaysPerWeek} hari + DBB:{' '}
                      {schedulePreview.regimen.dbbBottles} btl
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" id="dp-dbb-bottles">
                    {[1, 2, 3, 4, 5, 6].map((btl) => {
                      const active = draft.dbbBottles === btl;
                      return (
                        <button
                          key={btl}
                          type="button"
                          onClick={() => updateField('dbbBottles', btl)}
                          aria-pressed={active}
                          data-testid={`dbb-bottle-${btl}`}
                          className={`py-2 px-2 rounded-lg border text-center transition-colors ${
                            active
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-teal-50'
                          }`}
                        >
                          <div className="text-xs font-mono font-bold tabular-nums">{btl} Botol</div>
                          <div
                            className={`text-[10px] font-mono tabular-nums mt-0.5 ${
                              active ? 'text-teal-100' : 'text-slate-500'
                            }`}
                          >
                            DOT {7 - btl} hari
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
                <span className="font-semibold text-slate-900">Ringkasan Regimen: </span>
                {schedulePreview.regimen.scheduleExplanation}
              </div>
            </div>

            <div>
              <label htmlFor="dp-doctor" className="block text-xs font-medium text-slate-700 mb-1">
                Pegawai Perubatan / Farmasi Bertanggungjawab
              </label>
              <input
                id="dp-doctor"
                type="text"
                value={draft.prescribingDoctor}
                onChange={(e) => updateField('prescribingDoctor', e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>
          </section>

          {/* SECTION 3: TARIKH AKHIR UJIAN DARAH, UJIAN URIN & ECG */}
          <section aria-label="Tarikh akhir ujian darah dan urin" className="pt-5 border-t border-slate-100 space-y-4">
            <div className="pb-2 border-b border-slate-100">
              <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                Bahagian 3 · Tarikh Akhir Ujian Darah, Ujian Urin &amp; Saringan Klinikal
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekodkan tarikh ujian terakhir yang telah dibuat bagi penetapan julat saringan automatik sistem.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="dp-blood-date" className="block text-xs font-medium text-slate-700 mb-1">
                  Tarikh Akhir Ujian Darah Dibuat
                </label>
                <input
                  id="dp-blood-date"
                  type="date"
                  value={draft.lastBloodTestDate}
                  onChange={(e) => updateField('lastBloodTestDate', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="dp-blood-status" className="block text-xs font-medium text-slate-700 mb-1">
                  Status Keputusan Darah
                </label>
                <select
                  id="dp-blood-status"
                  value={draft.lastBloodTestStatus}
                  onChange={(e) =>
                    updateField('lastBloodTestStatus', e.target.value as BloodTestStatus)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {(Object.keys(BLOOD_TEST_STATUS_LABELS) as BloodTestStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {BLOOD_TEST_STATUS_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="dp-blood-note" className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Ujian Darah (HIV / Hep / LFT)
                </label>
                <input
                  id="dp-blood-note"
                  type="text"
                  value={draft.lastBloodTestNote}
                  onChange={(e) => updateField('lastBloodTestNote', e.target.value)}
                  placeholder="Cth: LFT normal, HIV/Hep B/C negatif"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-urine-date" className="block text-xs font-medium text-slate-700 mb-1">
                  Tarikh Akhir Ujian Urin Dibuat
                </label>
                <input
                  id="dp-urine-date"
                  type="date"
                  value={draft.lastUrineTestDate}
                  onChange={(e) => updateField('lastUrineTestDate', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="dp-urine-result" className="block text-xs font-medium text-slate-700 mb-1">
                  Keputusan Ujian Urin Terakhir
                </label>
                <select
                  id="dp-urine-result"
                  value={draft.lastUrineResult}
                  onChange={(e) =>
                    updateField('lastUrineResult', e.target.value as LastUrineSummaryStatus)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {(Object.keys(LAST_URINE_STATUS_LABELS) as LastUrineSummaryStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {LAST_URINE_STATUS_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="dp-ecg-date" className="block text-xs font-medium text-slate-700 mb-1">
                    Tarikh Akhir ECG
                  </label>
                  <input
                    id="dp-ecg-date"
                    type="date"
                    value={draft.lastEcgDate}
                    onChange={(e) => updateField('lastEcgDate', e.target.value)}
                    className="w-full min-h-[40px] px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="dp-qtc" className="block text-xs font-medium text-slate-700 mb-1">
                    Bacaan QTc (ms)
                  </label>
                  <input
                    id="dp-qtc"
                    type="number"
                    min={300}
                    max={650}
                    value={draft.qtcMs ?? ''}
                    onChange={(e) =>
                      updateField('qtcMs', e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="420"
                    className="w-full min-h-[40px] px-2.5 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: ALAHAN, KOMORBIDITI & CATATAN KLINIKAL */}
          <section aria-label="Alahan dan catatan klinikal" className="pt-5 border-t border-slate-100 space-y-4">
            <div className="pb-2 border-b border-slate-100">
              <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                Bahagian 4 · Alahan Ubat, Komorbiditi &amp; Catatan Klinikal
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dp-allergies" className="block text-xs font-medium text-slate-700 mb-1">
                  Alahan Ubat
                </label>
                <input
                  id="dp-allergies"
                  type="text"
                  value={draft.drugAllergies}
                  onChange={(e) => updateField('drugAllergies', e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="dp-comorbid" className="block text-xs font-medium text-slate-700 mb-1">
                  Komorbiditi / Penyakit Kronik
                </label>
                <input
                  id="dp-comorbid"
                  type="text"
                  value={draft.comorbidities}
                  onChange={(e) => updateField('comorbidities', e.target.value)}
                  placeholder="Cth: Hipertensi, Asma, Hepatitis C, atau Tiada"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="dp-alert-note" className="block text-xs font-medium text-slate-700 mb-1">
                Nota Amaran &amp; Pelan Klinikal Awal
              </label>
              <textarea
                id="dp-alert-note"
                rows={2}
                value={draft.clinicalAlertNote}
                onChange={(e) => updateField('clinicalAlertNote', e.target.value)}
                placeholder="Cth: Pantau paras sedasi 30 minit selepas dos, atau arahan khas pengambilan DBB..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enrollInOsca}
                onChange={(e) => setEnrollInOsca(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>
                Jana rekod saringan &amp; orientasi awal secara automatik dalam modul OSCA (One Stop Center for Addiction)
              </span>
            </label>

            {formError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {formError}
              </p>
            )}
          </section>
        </div>

        {/* Right 4 Cols: Live Automatic Schedule & Regimen Preview */}
        <aside
          aria-label="Pratonton automatik protokol pesakit"
          className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 xl:sticky xl:top-6"
        >
          <div className="pb-3 border-b border-slate-100">
            <div className="text-xs font-semibold text-teal-700">
              Pratonton Sistem Automatik
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Ringkasan Protokol &amp; Jadual
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="text-slate-500">Pesakit &amp; Pengenalan</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {draft.name.trim() || 'Nama pesakit belum diisi'}
              </div>
              <div className="text-slate-600 font-mono tabular-nums mt-0.5">
                {draft.mrn} · {draft.icNumber || 'No. KP belum diisi'}
              </div>
              {draft.emergencyContactName && (
                <div className="text-slate-500 mt-0.5">
                  Waris: {draft.emergencyContactName} ({draft.emergencyContactPhone || '-'})
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="text-slate-500">Dos &amp; Regimen Metadon</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {PROTOCOL_PRESETS[draft.phase].label} ·{' '}
                <span className="font-mono tabular-nums">
                  {draft.doseMg || 0} mg ({schedulePreview.regimen.doseVolumeMl} mL)
                </span>
              </div>
              <div className="mt-1 font-medium text-teal-800">
                {schedulePreview.regimen.summaryLabel}
              </div>
              {draft.regimenType === 'dbb' && (
                <div className="mt-0.5 text-slate-600 font-mono tabular-nums">
                  Jumlah bekalan DBB: {schedulePreview.regimen.weeklyDbbVolumeMl} mL / minggu
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="text-slate-500">Tarikh Temujanji Pertama (Automatik)</div>
              <div className="mt-1 text-sm font-bold font-mono text-slate-900 tabular-nums">
                {formatDateMY(schedulePreview.nextAppointmentDate)} · Jam {draft.nextAppointmentTime}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="text-slate-500 flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Julat Ujian Urin Seterusnya (Automatik)</span>
              </div>
              <div className="mt-1 text-sm font-bold font-mono text-teal-800 tabular-nums">
                {formatDateMY(schedulePreview.urineWindow.windowStart)} –{' '}
                {formatDateMY(schedulePreview.urineWindow.windowEnd)}
              </div>
              <div className="text-slate-500 mt-0.5">
                {draft.lastUrineTestDate
                  ? `Dikira daripada tarikh akhir urin: ${formatDateMY(draft.lastUrineTestDate)}`
                  : `Dikira daripada tarikh mula rawatan: ${formatDateMY(draft.startDate || todayIso)}`}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="text-slate-500">Tarikh Akhir Ujian Darah &amp; ECG</div>
              <div className="mt-1 text-slate-800 font-mono tabular-nums">
                Darah:{' '}
                {draft.lastBloodTestDate
                  ? `${formatDateMY(draft.lastBloodTestDate)} (${BLOOD_TEST_STATUS_LABELS[draft.lastBloodTestStatus]})`
                  : BLOOD_TEST_STATUS_LABELS[draft.lastBloodTestStatus]}
              </div>
              <div className="text-slate-600 font-mono tabular-nums mt-0.5">
                ECG:{' '}
                {draft.lastEcgDate ? formatDateMY(draft.lastEcgDate) : 'Belum direkod'}
                {draft.qtcMs ? ` · QTc ${draft.qtcMs} ms` : ''}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <button
              type="submit"
              data-testid="submit-daftar-pesakit-btn"
              className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Simpan &amp; Daftar Pesakit Baharu
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pendaftaran akan menjana jadual temujanji pertama, tugasan protokol kakitangan, julat ujian urin automatik, serta masuk ke kalendar bulanan.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
};

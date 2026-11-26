import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ClipboardList,
  FlaskConical,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  Appointment,
  ClinicalTask,
  OscaInterventionRecord,
  OscaRiskLevel,
  OscaServiceDomain,
  Patient,
  UrineTestRecord,
} from '../types/clinical';
import { formatDateMY, PROTOCOL_PRESETS } from '../utils/methadoneProtocol';
import {
  buildOscaClientProfile,
  computeOscaSummaryStats,
  OSCA_DOMAIN_LABELS,
  OSCA_RISK_LABELS,
  validateOscaDraft,
} from '../utils/oscaUtils';

interface OscaCenterViewProps {
  todayIso: string;
  patients: Patient[];
  activePatientId: string;
  onSelectPatient: (patientId: string) => void;
  appointments: Appointment[];
  tasks: ClinicalTask[];
  urineRecords: UrineTestRecord[];
  oscaRecords: OscaInterventionRecord[];
  onAddOscaRecord: (
    record: Omit<OscaInterventionRecord, 'id'>,
    syncToCalendar: boolean
  ) => void;
  onToggleOscaStatus: (recordId: string) => void;
  onDeleteOscaRecord: (recordId: string) => void;
  onOpenPatientSession: (patientId: string) => void;
  onOpenPatientUrine: (patientId: string) => void;
  onOpenDateInCalendar: (dateIso: string) => void;
}

const DISPENSING_SHORT: Record<Patient['dispensingMode'], string> = {
  dot_harian: 'DOT Harian',
  bawa_pulang_separa: 'Bawa Pulang Separa',
  bawa_pulang_mingguan: 'Bawa Pulang Mingguan',
};

const QUICK_OSCA_TEMPLATES: Array<{
  label: string;
  domain: OscaServiceDomain;
  risk: OscaRiskLevel;
  title: string;
  note: string;
}> = [
  {
    label: 'Kaunseling Relaps',
    domain: 'kaunseling_psikososial',
    risk: 'pemantauan',
    title: 'Sesi kaunseling pencegahan relaps & pengurusan pencetus',
    note: 'Semak kepatuhan dos Metadon serta bincang strategi sokongan psikososial harian.',
  },
  {
    label: 'Rujukan Pakar Psikiatri',
    domain: 'rujukan_pakar',
    risk: 'tinggi',
    title: 'Rujukan penilaian komorbiditi psikiatri & pelarasan rawatan',
    note: 'Sertakan ringkasan dos Metadon semasa dan keputusan saringan urin terkini dalam surat rujukan.',
  },
  {
    label: 'Saringan HIV / Hep C',
    domain: 'saringan_kesihatan',
    risk: 'pemantauan',
    title: 'Ujian saringan penyakit berjangkit berkala (HIV / Hep B / Hep C)',
    note: 'Ambil sampel darah saringan OSCA dan kemaskini status imunisasi pesakit.',
  },
  {
    label: 'Sokongan Keluarga',
    domain: 'sokongan_sosial',
    risk: 'stabil',
    title: 'Perbincangan sokongan ahli keluarga & penjaga',
    note: 'Terangkan peranan penjaga dalam memantau keselamatan bekalan bawa pulang.',
  },
];

export const OscaCenterView: React.FC<OscaCenterViewProps> = ({
  todayIso,
  patients,
  activePatientId,
  onSelectPatient,
  appointments,
  tasks,
  urineRecords,
  oscaRecords,
  onAddOscaRecord,
  onToggleOscaStatus,
  onDeleteOscaRecord,
  onOpenPatientSession,
  onOpenPatientUrine,
  onOpenDateInCalendar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [cohortFilter, setCohortFilter] = useState<'semua' | 'perhatian' | 'stabil'>('semua');

  // Form state
  const [serviceDomain, setServiceDomain] =
    useState<OscaServiceDomain>('kaunseling_psikososial');
  const [riskLevel, setRiskLevel] = useState<OscaRiskLevel>('pemantauan');
  const [actionDate, setActionDate] = useState(todayIso);
  const [agencyOrOfficer, setAgencyOrOfficer] = useState('Kaunselor OSCA · Pn. Farah Nabila');
  const [title, setTitle] = useState('');
  const [planNote, setPlanNote] = useState('');
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [formError, setFormError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const clientProfiles = useMemo(
    () =>
      patients.map((p) =>
        buildOscaClientProfile(p, appointments, tasks, urineRecords, oscaRecords, todayIso)
      ),
    [patients, appointments, tasks, urineRecords, oscaRecords, todayIso]
  );

  const stats = useMemo(
    () => computeOscaSummaryStats(clientProfiles, oscaRecords, urineRecords),
    [clientProfiles, oscaRecords, urineRecords]
  );

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clientProfiles.filter((item) => {
      if (cohortFilter === 'perhatian' && !item.needsAttention) return false;
      if (cohortFilter === 'stabil' && item.needsAttention) return false;
      if (
        q &&
        !item.patient.name.toLowerCase().includes(q) &&
        !item.patient.mrn.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [clientProfiles, cohortFilter, searchQuery]);

  const activeProfile =
    clientProfiles.find((c) => c.patient.id === activePatientId) ?? clientProfiles[0];

  const activeClientOscaRecords = useMemo(() => {
    if (!activeProfile) return [];
    return oscaRecords
      .filter((r) => r.patientId === activeProfile.patient.id)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'aktif' ? -1 : 1;
        return a.actionDate.localeCompare(b.actionDate);
      });
  }, [oscaRecords, activeProfile]);

  const activeClientRelatedTasks = useMemo(() => {
    if (!activeProfile) return [];
    return tasks
      .filter(
        (t) =>
          t.patientId === activeProfile.patient.id &&
          (t.category === 'kaunseling' || t.category === 'susulan' || t.category === 'urin')
      )
      .slice(0, 5);
  }, [tasks, activeProfile]);

  const applyTemplate = (tpl: (typeof QUICK_OSCA_TEMPLATES)[number]) => {
    setServiceDomain(tpl.domain);
    setRiskLevel(tpl.risk);
    setTitle(tpl.title);
    setPlanNote(tpl.note);
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;

    const draft = {
      patientId: activeProfile.patient.id,
      serviceDomain,
      riskLevel,
      actionDate,
      title,
      planNote,
      agencyOrOfficer,
    };

    const validation = validateOscaDraft(draft);
    if (!validation.valid) {
      setFormError(validation.error ?? 'Sila lengkapkan maklumat intervensi OSCA.');
      return;
    }

    setFormError('');
    onAddOscaRecord(
      {
        patientId: activeProfile.patient.id,
        serviceDomain,
        riskLevel,
        actionDate,
        title: title.trim(),
        planNote: planNote.trim(),
        agencyOrOfficer: agencyOrOfficer.trim(),
        status: 'aktif',
      },
      syncToCalendar
    );

    setSavedNotice(
      syncToCalendar
        ? `Rekod OSCA untuk ${activeProfile.patient.name} disimpan & disegerakkan ke Kalendar Bulanan.`
        : `Rekod OSCA untuk ${activeProfile.patient.name} berjaya disimpan.`
    );
    setTitle('');
    setPlanNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700">
              Pusat Sehenti Ketagihan · Bersepadu dengan Modul Metadon
            </p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              OSCA (One Stop Center for Addiction)
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Penyelarasan kes berbilang disiplin yang menarik data pesakit, fasa rawatan, julat
              ujian urin, dan jadual temujanji terus daripada modul keseluruhan Metadon.
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
            Tarikh Sesi: {formatDateMY(todayIso)}
          </div>
        </div>

        {/* 4-Column KPI Strip */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-slate-500">Klien OSCA (Sumber Metadon)</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {stats.totalClients}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Perlu Intervensi / Perhatian</div>
            <div className="mt-1 text-2xl font-bold text-amber-700 font-mono tabular-nums">
              {stats.attentionClientsCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Rekod Intervensi OSCA Aktif</div>
            <div className="mt-1 text-2xl font-bold text-teal-700 font-mono tabular-nums">
              {stats.activeInterventionsCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Ujian Urin Patuh</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {stats.compliantUrineCount}/{stats.totalUrineRecordsCount}
            </div>
          </div>
        </div>
      </section>

      {/* Main 12-Col Split: Left 5 Cols Client Roster from Methadone, Right 7 Cols OSCA Coordination */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Roster */}
        <section
          aria-label="Senarai klien OSCA daripada modul Metadon"
          className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Senarai Klien Metadon ke OSCA
              </h2>
              <p className="text-xs text-slate-500">
                Pilih klien untuk mengurus rujukan dan intervensi bersepadu
              </p>
            </div>
          </div>

          {/* Search & Cohort Filter */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Cari nama atau MRN klien OSCA"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama pesakit atau nombor MRN..."
                className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>

            <div
              role="group"
              aria-label="Tapis status klien OSCA"
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {(
                [
                  { key: 'semua', label: `Semua (${clientProfiles.length})` },
                  {
                    key: 'perhatian',
                    label: `Perhatian (${stats.attentionClientsCount})`,
                  },
                  {
                    key: 'stabil',
                    label: `Stabil (${clientProfiles.length - stats.attentionClientsCount})`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCohortFilter(tab.key)}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    cohortFilter === tab.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client List */}
          {filteredProfiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Tiada klien sepadan dengan carian semasa.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl" data-testid="osca-client-list">
              {filteredProfiles.map((item) => {
                const isSelected = activeProfile?.patient.id === item.patient.id;
                return (
                  <li key={item.patient.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPatient(item.patient.id);
                        setSavedNotice('');
                      }}
                      aria-pressed={isSelected}
                      className={`w-full text-left p-3.5 transition-colors space-y-1.5 ${
                        isSelected
                          ? 'bg-teal-50/70'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {item.patient.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                            {item.patient.mrn} · {PROTOCOL_PRESETS[item.patient.phase].label} · Dos{' '}
                            {item.patient.doseMg} mg
                          </div>
                        </div>

                        <span
                          className={`text-xs font-semibold whitespace-nowrap ${
                            item.riskLevel === 'tinggi'
                              ? 'text-red-700'
                              : item.riskLevel === 'pemantauan'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.riskLevel === 'tinggi'
                            ? 'Intervensi Segera'
                            : item.riskLevel === 'pemantauan'
                            ? 'Pemantauan'
                            : 'Stabil'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600 tabular-nums">
                        <span>
                          Urin:{' '}
                          {item.latestUrineRecord
                            ? item.latestUrineRecord.overallStatus === 'patuh'
                              ? 'Patuh'
                              : 'Perhatian'
                            : item.urineWindow.status === 'dalam_julat'
                            ? 'Dalam Julat'
                            : 'Dijadualkan'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.pendingTasksCount} tugasan Metadon</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.activeOscaCount} pelan OSCA</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right OSCA Case Management Workspace */}
        {activeProfile && (
          <section
            aria-label="Pengurusan kes bersepadu OSCA"
            className="xl:col-span-7 space-y-6"
          >
            {/* Live Integrated Summary Pulled From Methadone Module */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="text-xs font-medium text-teal-700">
                    Profil Bersepadu Klien (Data Langsung Modul Metadon)
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {activeProfile.patient.name}
                  </h2>
                  <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    {activeProfile.patient.mrn} · {activeProfile.patient.icNumber} ·{' '}
                    {activeProfile.patient.phone}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPatientSession(activeProfile.patient.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    Sesi Klinikal
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPatientUrine(activeProfile.patient.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                    Ujian Urin
                  </button>
                </div>
              </div>

              {/* Clean Hairline Grid of Methadone Clinical Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-slate-500">Protokol &amp; Dos Metadon</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {PROTOCOL_PRESETS[activeProfile.patient.phase].label} ·{' '}
                    <span className="font-mono tabular-nums">{activeProfile.patient.doseMg} mg</span>
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {DISPENSING_SHORT[activeProfile.patient.dispensingMode]}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Julat Ujian Urin Automatik</div>
                  <div className="mt-1 font-semibold text-slate-900 font-mono tabular-nums">
                    {formatDateMY(activeProfile.urineWindow.windowStart)} –{' '}
                    {formatDateMY(activeProfile.urineWindow.windowEnd)}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {activeProfile.latestUrineRecord
                      ? `Rekod terakhir: ${formatDateMY(
                          activeProfile.latestUrineRecord.testDate
                        )} (${
                          activeProfile.latestUrineRecord.overallStatus === 'patuh'
                            ? 'Patuh'
                            : 'Perhatian'
                        })`
                      : 'Belum ada rekod ujian urin'}
                  </div>
                </div>

                <div>
                  <div className="text-slate-500">Temujanji &amp; Tugasan Metadon</div>
                  <div className="mt-1 font-semibold text-slate-900 font-mono tabular-nums">
                    {activeProfile.nextAppointment
                      ? `${formatDateMY(activeProfile.nextAppointment.date)} · ${
                          activeProfile.nextAppointment.time
                        }`
                      : formatDateMY(activeProfile.patient.nextAppointmentDate)}
                  </div>
                  <div className="text-slate-500 mt-0.5 tabular-nums">
                    {activeProfile.pendingTasksCount} tugasan belum selesai
                  </div>
                </div>
              </div>

              {activeProfile.patient.clinicalAlertNote && (
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Catatan Klinikal Metadon: </span>
                  {activeProfile.patient.clinicalAlertNote}
                </div>
              )}
            </div>

            {/* Add OSCA Intervention / Multidisciplinary Referral Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">
                  Tambah Rekod Intervensi &amp; Rujukan OSCA
                </h2>
                <Plus className="w-4 h-4 text-teal-700" aria-hidden="true" />
              </div>

              {savedNotice && (
                <div
                  role="status"
                  className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex flex-wrap items-center justify-between gap-2"
                >
                  <span>{savedNotice}</span>
                  <button
                    type="button"
                    onClick={() => onOpenDateInCalendar(actionDate)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 bg-white border border-teal-300 rounded-md hover:bg-teal-50 whitespace-nowrap"
                  >
                    <Calendar className="w-3 h-3" aria-hidden="true" />
                    Lihat di Kalendar
                  </button>
                </div>
              )}

              <div>
                <span className="block text-xs text-slate-500 mb-1.5">
                  Templat Pantas Intervensi OSCA:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_OSCA_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors whitespace-nowrap"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="osca-domain"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Komponen OSCA
                    </label>
                    <select
                      id="osca-domain"
                      value={serviceDomain}
                      onChange={(e) => setServiceDomain(e.target.value as OscaServiceDomain)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {(Object.keys(OSCA_DOMAIN_LABELS) as OscaServiceDomain[]).map((k) => (
                        <option key={k} value={k}>
                          {OSCA_DOMAIN_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="osca-risk"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Tahap Risiko Kes
                    </label>
                    <select
                      id="osca-risk"
                      value={riskLevel}
                      onChange={(e) => setRiskLevel(e.target.value as OscaRiskLevel)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {(Object.keys(OSCA_RISK_LABELS) as OscaRiskLevel[]).map((k) => (
                        <option key={k} value={k}>
                          {OSCA_RISK_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="osca-date"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Tarikh Tindakan
                    </label>
                    <input
                      id="osca-date"
                      type="date"
                      value={actionDate}
                      onChange={(e) => setActionDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="osca-title"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Tajuk Intervensi / Rujukan OSCA
                    </label>
                    <input
                      id="osca-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Cth: Rujukan kaunseling keluarga & sokongan kerjaya"
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="osca-officer"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Pegawai / Agensi Terlibat
                    </label>
                    <input
                      id="osca-officer"
                      type="text"
                      value={agencyOrOfficer}
                      onChange={(e) => setAgencyOrOfficer(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="osca-plan"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Pelan Intervensi &amp; Catatan OSCA
                  </label>
                  <textarea
                    id="osca-plan"
                    rows={2}
                    value={planNote}
                    onChange={(e) => setPlanNote(e.target.value)}
                    placeholder="Nyatakan objektif sesi kaunseling, agensi rujukan, atau sokongan sosial yang perlu diselaraskan..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncToCalendar}
                    onChange={(e) => setSyncToCalendar(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>
                    Segerakkan juga sebagai tugasan peringatan ke Kalendar Bulanan &amp; Sesi Metadon
                  </span>
                </label>

                {formError && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
                >
                  Simpan Rekod Intervensi OSCA
                </button>
              </form>
            </div>

            {/* OSCA Intervention History + Linked Methadone Tasks */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Pelan &amp; Rekod OSCA Klien ({activeClientOscaRecords.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekod intervensi OSCA untuk {activeProfile.patient.name}
                </p>
              </div>

              {activeClientOscaRecords.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                  Belum ada rekod intervensi OSCA bagi klien ini.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl" data-testid="osca-record-list">
                  {activeClientOscaRecords.map((rec) => {
                    const isConfirmDel = confirmDeleteId === rec.id;
                    return (
                      <li key={rec.id} className="p-4 space-y-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-teal-800">
                              {OSCA_DOMAIN_LABELS[rec.serviceDomain]} · {rec.agencyOrOfficer}
                            </div>
                            <div
                              className={`text-sm font-semibold mt-0.5 ${
                                rec.status === 'selesai'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900'
                              }`}
                            >
                              {rec.title}
                            </div>
                            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                              {rec.planNote}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 font-mono tabular-nums">
                              <span>{formatDateMY(rec.actionDate)}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-sans">{OSCA_RISK_LABELS[rec.riskLevel]}</span>
                            </div>
                          </div>

                          <span
                            className={`text-xs font-semibold whitespace-nowrap ${
                              rec.status === 'selesai' ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {rec.status === 'selesai' ? 'Selesai' : 'Aktif'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onToggleOscaStatus(rec.id)}
                              aria-pressed={rec.status === 'selesai'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                                rec.status === 'selesai'
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                              }`}
                            >
                              <Check className="w-3 h-3" aria-hidden="true" />
                              {rec.status === 'selesai' ? 'Disahkan Selesai' : 'Sahkan Selesai'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDateInCalendar(rec.actionDate)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 whitespace-nowrap"
                            >
                              <Calendar className="w-3 h-3" aria-hidden="true" />
                              Kalendar
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isConfirmDel ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteOscaRecord(rec.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800"
                                >
                                  Ya, Padam
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 text-xs text-slate-600"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(rec.id)}
                                aria-label={`Padam rekod OSCA ${rec.title}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 whitespace-nowrap"
                              >
                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                Padam
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {activeClientRelatedTasks.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Tugasan Berkaitan dari Modul Metadon
                  </h3>
                  <ul className="divide-y divide-slate-100 text-xs">
                    {activeClientRelatedTasks.map((t) => (
                      <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                        <span
                          className={
                            t.completed ? 'line-through text-slate-400' : 'text-slate-800'
                          }
                        >
                          {t.title}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {formatDateMY(t.dueDate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, AlertTriangle } from 'lucide-react';
import type {
  Patient,
  UrineSubstanceResult,
  UrineTestRecord,
} from '../types/clinical';
import {
  calculateUrineTestWindow,
  formatDateMY,
  isDateInUrineWindow,
  PROTOCOL_PRESETS,
} from '../utils/methadoneProtocol';

interface UrineRecordsViewProps {
  todayIso: string;
  patients: Patient[];
  activePatient: Patient | undefined;
  onSelectPatient: (patientId: string) => void;
  urineRecords: UrineTestRecord[];
  onAddUrineRecord: (record: Omit<UrineTestRecord, 'id'>) => void;
}

const SUBSTANCE_OPTIONS: Array<{ value: UrineSubstanceResult; label: string }> = [
  { value: 'negatif', label: 'Negatif' },
  { value: 'positif', label: 'Positif' },
  { value: 'tidak_diuji', label: 'Tidak Diuji' },
];

export const UrineRecordsView: React.FC<UrineRecordsViewProps> = ({
  todayIso,
  patients,
  activePatient,
  onSelectPatient,
  urineRecords,
  onAddUrineRecord,
}) => {
  const [testDate, setTestDate] = useState(todayIso);
  const [methadoneMetabolite, setMethadoneMetabolite] = useState<'positif' | 'negatif'>('positif');
  const [morphine, setMorphine] = useState<UrineSubstanceResult>('negatif');
  const [amphetamine, setAmphetamine] = useState<UrineSubstanceResult>('negatif');
  const [thc, setThc] = useState<UrineSubstanceResult>('negatif');
  const [benzodiazepine, setBenzodiazepine] = useState<UrineSubstanceResult>('negatif');
  const [recordedBy, setRecordedBy] = useState('SN Nurul Aisyah');
  const [clinicalNote, setClinicalNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saveBanner, setSaveBanner] = useState('');

  const urineWindow = useMemo(() => {
    if (!activePatient) return null;
    return calculateUrineTestWindow(activePatient, todayIso);
  }, [activePatient, todayIso]);

  const isSelectedDateInWindow = useMemo(() => {
    if (!urineWindow) return false;
    return isDateInUrineWindow(testDate, urineWindow.windowStart, urineWindow.windowEnd);
  }, [testDate, urineWindow]);

  const patientRecords = useMemo(() => {
    if (!activePatient) return [];
    return urineRecords
      .filter((r) => r.patientId === activePatient.id)
      .sort((a, b) => b.testDate.localeCompare(a.testDate));
  }, [urineRecords, activePatient]);

  if (!activePatient || !urineWindow) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
        Tiada pesakit dipilih untuk rekod ujian urin.
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDate) {
      setFormError('Sila pilih tarikh ujian urin.');
      return;
    }
    if (!recordedBy.trim()) {
      setFormError('Sila masukkan nama kakitangan yang merekod.');
      return;
    }
    if (!clinicalNote.trim()) {
      setFormError('Sila masukkan nota klinikal ujian urin.');
      return;
    }

    setFormError('');
    const hasIllicitPositive =
      morphine === 'positif' ||
      amphetamine === 'positif' ||
      thc === 'positif' ||
      benzodiazepine === 'positif';
    const overallStatus =
      methadoneMetabolite === 'positif' && !hasIllicitPositive ? 'patuh' : 'perhatian';

    onAddUrineRecord({
      patientId: activePatient.id,
      testDate,
      protocolWindowStart: urineWindow.windowStart,
      protocolWindowEnd: urineWindow.windowEnd,
      withinProtocolWindow: isSelectedDateInWindow,
      methadoneMetabolite,
      morphine,
      amphetamine,
      thc,
      benzodiazepine,
      overallStatus,
      recordedBy: recordedBy.trim(),
      clinicalNote: clinicalNote.trim(),
    });

    setClinicalNote('');
    setSaveBanner(
      `Rekod ujian urin pada ${formatDateMY(testDate)} disimpan. Julat protokol seterusnya telah dikemaskini secara automatik.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Protocol Window Banner */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Nota Rekod Ujian Urin & Julat Protokol Automatik
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Julat tarikh saringan ditetapkan secara automatik berdasarkan fasa protokol rawatan pesakit.
            </p>
          </div>
          <div className="shrink-0">
            <label
              htmlFor="urine-patient-select"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Pesakit Saringan
            </label>
            <select
              id="urine-patient-select"
              value={activePatient.id}
              onChange={(e) => {
                onSelectPatient(e.target.value);
                setSaveBanner('');
              }}
              className="w-full sm:w-auto min-h-[42px] px-3 py-2 text-sm font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mrn})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
          <div>
            <div className="text-xs text-slate-500">Protokol Rawatan Berdaftar</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {PROTOCOL_PRESETS[activePatient.phase].label}
            </div>
            <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
              Saringan setiap {activePatient.urineIntervalDays} hari · Tempoh julat {activePatient.urineWindowDays} hari
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Julat Tarikh Ujian Urin Sistem</div>
            <div className="mt-1 text-base font-bold font-mono text-teal-800 tabular-nums">
              {formatDateMY(urineWindow.windowStart)} – {formatDateMY(urineWindow.windowEnd)}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {activePatient.lastUrineTestDate
                ? `Berdasarkan ujian terakhir: ${formatDateMY(activePatient.lastUrineTestDate)}`
                : `Berdasarkan tarikh mula rawatan: ${formatDateMY(activePatient.startDate)}`}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Status Julat Semasa</div>
            <div
              className={`mt-1 text-sm font-semibold ${
                urineWindow.status === 'dalam_julat'
                  ? 'text-amber-700'
                  : urineWindow.status === 'tamat_tempoh'
                  ? 'text-red-700'
                  : 'text-emerald-700'
              }`}
            >
              {urineWindow.status === 'dalam_julat'
                ? `Aktif Sekarang (Baki ${urineWindow.daysRemainingInWindow} hari)`
                : urineWindow.status === 'tamat_tempoh'
                ? 'Melepasi Julat Protokol — Perlu Saringan Segera'
                : `Akan Datang (${urineWindow.daysUntilStart} hari lagi)`}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form to Record Urine Test Note (5 cols) */}
        <section
          aria-label="Borang nota rekod ujian urin"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Tambah Nota Rekod Ujian Urin
            </h2>
            <FlaskConical className="w-4 h-4 text-teal-700" aria-hidden="true" />
          </div>

          {saveBanner && (
            <div
              role="status"
              className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{saveBanner}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                1. Tarikh &amp; Pengesahan Julat
              </div>
              <div>
                <label htmlFor="urine-test-date" className="block text-xs font-medium text-slate-700 mb-1">
                  Tarikh Ujian Dilaksanakan
                </label>
                <input
                  id="urine-test-date"
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                  <span
                    className={
                      isSelectedDateInWindow
                        ? 'font-medium text-emerald-700 flex items-center gap-1'
                        : 'font-medium text-amber-700 flex items-center gap-1'
                    }
                  >
                    {isSelectedDateInWindow ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Tarikh berada dalam julat protokol automatik
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Di luar julat protokol ({formatDateMY(urineWindow.windowStart)} –{' '}
                        {formatDateMY(urineWindow.windowEnd)})
                      </>
                    )}
                  </span>
                  {!isSelectedDateInWindow && (
                    <button
                      type="button"
                      onClick={() => setTestDate(urineWindow.windowStart)}
                      className="text-teal-700 font-medium underline hover:text-teal-800 whitespace-nowrap shrink-0"
                    >
                      Guna Julat
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  2. Keputusan Saringan Bahan
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMethadoneMetabolite('positif');
                    setMorphine('negatif');
                    setAmphetamine('negatif');
                    setThc('negatif');
                    setBenzodiazepine('negatif');
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors whitespace-nowrap"
                >
                  Set Semua Patuh
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="urine-methadone"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Metabolit Metadon (Pengesahan Pengambilan Dos)
                </label>
                <select
                  id="urine-methadone"
                  value={methadoneMetabolite}
                  onChange={(e) =>
                    setMethadoneMetabolite(e.target.value as 'positif' | 'negatif')
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="positif">Positif (Patuh Dos)</option>
                  <option value="negatif">Negatif (Amaran)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="urine-morphine"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Morfin / Opiat
                </label>
                <select
                  id="urine-morphine"
                  value={morphine}
                  onChange={(e) => setMorphine(e.target.value as UrineSubstanceResult)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {SUBSTANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="urine-amp"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Amfetamin / ATS
                </label>
                <select
                  id="urine-amp"
                  value={amphetamine}
                  onChange={(e) => setAmphetamine(e.target.value as UrineSubstanceResult)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {SUBSTANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="urine-thc"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  THC (Kanabis)
                </label>
                <select
                  id="urine-thc"
                  value={thc}
                  onChange={(e) => setThc(e.target.value as UrineSubstanceResult)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {SUBSTANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="urine-benzo"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Benzodiazepin
                </label>
                <select
                  id="urine-benzo"
                  value={benzodiazepine}
                  onChange={(e) =>
                    setBenzodiazepine(e.target.value as UrineSubstanceResult)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {SUBSTANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                3. Nota Klinikal &amp; Pengesahan
              </div>
              <div>
                <label
                  htmlFor="urine-recorded-by"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Direkod Oleh Kakitangan
                </label>
                <input
                  id="urine-recorded-by"
                  type="text"
                  value={recordedBy}
                  onChange={(e) => setRecordedBy(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

            <div>
              <label
                htmlFor="urine-clinical-note"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Nota Klinikal & Pemerhatian Sampel
              </label>
              <textarea
                id="urine-clinical-note"
                rows={3}
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
                placeholder="Cth: Suhu sampel 36.5°C, diselia oleh kakitangan, pesakit patuh kepada jadual."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] px-4 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              Simpan Rekod Ujian Urin
            </button>
          </form>
        </section>

        {/* Historical Urine Test Log (7 cols) */}
        <section
          aria-label="Sejarah rekod ujian urin"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sejarah Nota Rekod Ujian Urin
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Menunjukkan pematuhan saringan berbanding julat tarikh protokol pesakit.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-600 tabular-nums">
              {patientRecords.length} Rekod
            </span>
          </div>

          {patientRecords.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Belum ada rekod ujian urin untuk pesakit ini. Sila rekodkan keputusan pertama di sebelah kiri.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100" data-testid="urine-record-list">
              {patientRecords.map((rec) => (
                <article key={rec.id} className="py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-900 tabular-nums">
                      <span className="font-mono">{formatDateMY(rec.testDate)}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span
                        className={
                          rec.overallStatus === 'patuh'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }
                      >
                        {rec.overallStatus === 'patuh' ? 'Patuh Rawatan' : 'Perlu Perhatian'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      Julat: {formatDateMY(rec.protocolWindowStart)} – {formatDateMY(rec.protocolWindowEnd)}
                      {rec.withinProtocolWindow ? ' (Dalam Julat)' : ' (Luar Julat)'}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Metadon</span>
                      <span
                        className={`font-medium ${
                          rec.methadoneMetabolite === 'positif'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {rec.methadoneMetabolite === 'positif' ? 'Positif' : 'Negatif'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Morfin</span>
                      <span className={rec.morphine === 'positif' ? 'font-semibold text-red-700' : 'text-slate-700'}>
                        {rec.morphine === 'positif' ? 'Positif' : rec.morphine === 'negatif' ? 'Negatif' : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Amfetamin</span>
                      <span className={rec.amphetamine === 'positif' ? 'font-semibold text-red-700' : 'text-slate-700'}>
                        {rec.amphetamine === 'positif' ? 'Positif' : rec.amphetamine === 'negatif' ? 'Negatif' : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">THC</span>
                      <span className={rec.thc === 'positif' ? 'font-semibold text-red-700' : 'text-slate-700'}>
                        {rec.thc === 'positif' ? 'Positif' : rec.thc === 'negatif' ? 'Negatif' : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Benzo</span>
                      <span className={rec.benzodiazepine === 'positif' ? 'font-semibold text-red-700' : 'text-slate-700'}>
                        {rec.benzodiazepine === 'positif' ? 'Positif' : rec.benzodiazepine === 'negatif' ? 'Negatif' : '-'}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-sm text-slate-700">{rec.clinicalNote}</p>
                  <div className="mt-1 text-xs text-slate-500">
                    Direkod oleh: {rec.recordedBy}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

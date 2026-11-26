import React from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { formatDateMY } from '../utils/methadoneProtocol';

interface FrontpageEntryViewProps {
  todayIso: string;
  registeredPatientsCount: number;
  todayAppointmentsCount: number;
  pendingTasksCount: number;
  activeUrineWindowsCount: number;
  onEnterSystem: () => void;
}

const CLINICAL_MODULES: Array<{
  index: string;
  title: string;
  description: string;
}> = [
  {
    index: '01.',
    title: 'Dashboard Kalendar Bulanan',
    description:
      'Paparan jadual harian, pengesahan kehadiran pesakit, serta suntingan pantas tugasan dan nota.',
  },
  {
    index: '02.',
    title: 'Modul Tugasan Manual & Arahan Pegawai',
    description:
      'Masukkan tugasan klinikal, nota perubatan, dan arahan pegawai perubatan terus ke kalendar bulanan.',
  },
  {
    index: '03.',
    title: 'Saringan Ujian Urin Berprotokol',
    description:
      'Julat tarikh ujian urin dikira automatik mengikut fasa rawatan bersama nota keputusan patuh atau perhatian.',
  },
  {
    index: '04.',
    title: 'OSCA, Push Berkala & Cetak Laporan',
    description:
      'Penyelarasan kes OSCA bersepadu, peringatan push berkala, serta laporan syif harian sedia dicetak ke PDF.',
  },
];

export const FrontpageEntryView: React.FC<FrontpageEntryViewProps> = ({
  todayIso,
  registeredPatientsCount,
  todayAppointmentsCount,
  pendingTasksCount,
  activeUrineWindowsCount,
  onEnterSystem,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Clean Single-Row Top Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between gap-8">
        <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Klinik Metadon
        </span>

        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
          <CalendarDays className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
          <span>{formatDateMY(todayIso)}</span>
        </div>

        <button
          type="button"
          onClick={onEnterSystem}
          className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
        >
          <span>Masuk Sistem</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </header>

      {/* Main Frontpage Split */}
      <main className="flex-1 flex items-center">
        <div className="max-w-6xl w-full mx-auto px-6 lg:px-10 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Clinical System Introduction & Single Primary Entry CTA */}
            <section className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-teal-700 tracking-wide">
                  Sistem Pengurusan Klinik Terapi Gantian Metadon
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight text-balance max-w-2xl">
                  Penjadualan Temujanji, Tugasan Klinikal &amp; Pemantauan Protokol Pesakit
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                  Portal rujukan pantas untuk pegawai perubatan, pegawai farmasi, dan jururawat
                  klinikal menyelaraskan kehadiran pesakit, arahan rawatan, ujian urin berprotokol,
                  serta laporan harian syif tanpa kata laluan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={onEnterSystem}
                  data-testid="enter-dashboard-btn"
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                >
                  <span>Masuk ke Dashboard Utama</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-xs text-slate-500">
                  Akses terus kakitangan klinik · Tiada nama pengguna atau kata laluan diperlukan
                </span>
              </div>

              {/* Live Clinical Snapshot Strip (Grounded in Real Store Counts) */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs text-slate-500">Pesakit Berdaftar</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {registeredPatientsCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Temujanji Hari Ini</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {todayAppointmentsCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Tugasan Aktif</div>
                  <div className="mt-1 text-2xl font-bold text-amber-700 font-mono tabular-nums">
                    {pendingTasksCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Julat Urin Semasa</div>
                  <div className="mt-1 text-2xl font-bold text-teal-700 font-mono tabular-nums">
                    {activeUrineWindowsCount}
                  </div>
                </div>
              </div>
            </section>

            {/* Right Column: Structured Clinical Scope Card (Single Elevation) */}
            <aside
              aria-label="Ringkasan modul sistem klinik"
              className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-7"
            >
              <div className="pb-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Aliran Kerja Sesi Klinikal
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ringkasan modul utama sebelum memulakan operasi harian
                  </p>
                </div>
              </div>

              <ol className="divide-y divide-slate-100 mt-2">
                {CLINICAL_MODULES.map((item) => (
                  <li key={item.index} className="py-4 first:pt-3 last:pb-2">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-xs font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                        {item.index}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 lg:px-10 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Unit Rawatan Terapi Gantian Metadon · Kegunaan Kakitangan Perubatan</span>
          <span className="font-mono tabular-nums">Tarikh Semasa: {formatDateMY(todayIso)}</span>
        </div>
      </footer>
    </div>
  );
};

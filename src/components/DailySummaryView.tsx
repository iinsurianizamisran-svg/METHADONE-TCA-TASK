import React, { useMemo, useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';
import type {
  Appointment,
  ClinicalTask,
  Patient,
  UrineTestRecord,
} from '../types/clinical';
import {
  formatDailySummaryText,
  formatDateMY,
  generateDailySummaryReport,
} from '../utils/methadoneProtocol';

interface DailySummaryViewProps {
  todayIso: string;
  patients: Patient[];
  appointments: Appointment[];
  tasks: ClinicalTask[];
  urineRecords: UrineTestRecord[];
}

export const DailySummaryView: React.FC<DailySummaryViewProps> = ({
  todayIso,
  patients,
  appointments,
  tasks,
  urineRecords,
}) => {
  const [reportDate, setReportDate] = useState(todayIso);
  const [copied, setCopied] = useState(false);

  const report = useMemo(
    () => generateDailySummaryReport(patients, appointments, tasks, urineRecords, reportDate),
    [patients, appointments, tasks, urineRecords, reportDate]
  );

  const handleCopySummary = async () => {
    const text = formatDailySummaryText(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Clinical Letterhead for PDF / Paper */}
      <div className="hidden print:block pb-4 border-b border-slate-300">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-teal-800 uppercase tracking-wider">
              Unit Rawatan Terapi Gantian Metadon · Klinik Kesihatan
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Laporan Ringkasan Harian Kakitangan Perubatan
            </h1>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono tabular-nums">
            <div>Tarikh Laporan: {formatDateMY(reportDate)}</div>
            <div>Dicetak: {formatDateMY(todayIso)}</div>
          </div>
        </div>
      </div>

      {/* Header & Report Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 print-avoid-break">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-slate-100 print:hidden">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">
              Laporan Ringkasan Harian Kakitangan Perubatan
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Rujukan serahan syif klinikal: kehadiran, tugasan kakitangan, ujian urin dan amaran protokol.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 no-print">
            <div>
              <label htmlFor="daily-report-date" className="sr-only">
                Tarikh laporan harian
              </label>
              <input
                id="daily-report-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  Ringkasan Disalin
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  Salin Ringkasan Teks
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              data-testid="print-daily-report-btn"
              title="Cetak laporan ringkasan harian ke PDF atau kertas"
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Cetak Laporan
            </button>
          </div>
        </div>

        {/* 4-column KPI summary strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 pt-5 print:pt-0 print:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Temujanji ({formatDateMY(reportDate)})</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {report.attendedCount}/{report.totalScheduledAppointments}
            </div>
            <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
              Hadir: {report.attendedCount} · Menunggu: {report.pendingAppointmentsCount} · Tidak Hadir:{' '}
              {report.absentCount}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Tugasan Kakitangan</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {report.completedTasksCount}/{report.totalTasksDue}
            </div>
            <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
              Selesai: {report.completedTasksCount} · Belum Selesai: {report.pendingTasksCount}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Saringan Ujian Urin</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {report.urineTestsCount}
            </div>
            <div className="text-xs text-slate-600 mt-0.5 tabular-nums">
              {report.patientsInActiveUrineWindow} pesakit dalam julat aktif
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Amaran & Tertunggak</div>
            <div
              className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                report.overdueItems.length > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {report.overdueItems.length}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {report.overdueItems.length > 0
                ? 'Memerlukan tindakan susulan'
                : 'Semua protokol terkawal'}
            </div>
          </div>
        </div>
      </section>

      {/* Overdue / Priority Attention Table */}
      {report.overdueItems.length > 0 && (
        <section
          aria-label="Senarai tindakan segera dan tertunggak"
          className="bg-white border border-red-200 rounded-xl p-5 sm:p-6 print-avoid-break"
        >
          <h2 className="text-base font-semibold text-red-800">
            Perkara Tertunggak & Perlu Perhatian Kakitangan
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {report.overdueItems.map((item, idx) => (
              <li key={idx} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-900">{item.patientName}</span>
                  <span className="text-xs text-slate-500 font-mono ml-2">{item.mrn}</span>
                </div>
                <span className="text-xs font-medium text-red-700">{item.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Detailed Daily Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Appointments */}
        <section
          aria-label="Ringkasan temujanji harian"
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 print-avoid-break"
        >
          <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
            Senarai Temujanji ({report.appointments.length})
          </h2>
          {report.appointments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Tiada temujanji dijadualkan pada {formatDateMY(reportDate)}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 mt-2">
              {report.appointments.map((appt) => (
                <li key={appt.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{appt.patientName}</div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                      {appt.time} · {appt.mrn} · Dos {appt.doseMg} mg
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{appt.purpose}</div>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      appt.status === 'hadir'
                        ? 'text-emerald-700'
                        : appt.status === 'tidak_hadir'
                        ? 'text-red-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {appt.status === 'hadir'
                      ? 'Hadir'
                      : appt.status === 'tidak_hadir'
                      ? 'Tidak Hadir'
                      : 'Menunggu'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Daily Staff Tasks */}
        <section
          aria-label="Ringkasan tugasan harian"
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 print-avoid-break"
        >
          <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
            Log Tugasan Kakitangan ({report.tasks.length})
          </h2>
          {report.tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Tiada tugasan dijadualkan pada {formatDateMY(reportDate)}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 mt-2">
              {report.tasks.map((task) => (
                <li key={task.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{task.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {task.patientName} <span className="font-mono">({task.mrn})</span>
                      {task.orderedBy ? ` · ${task.orderedBy}` : ''}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      task.completed ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {task.completed ? 'Selesai' : 'Belum Selesai'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Urine Records Summary for the Day */}
      <section
        aria-label="Ringkasan ujian urin harian"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 print-avoid-break"
      >
        <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-100">
          Rekod Ujian Urin Hari Ini ({report.urineRecords.length})
        </h2>
        {report.urineRecords.length === 0 ? (
          <p className="py-6 text-sm text-slate-500 text-center">
            Tiada rekod ujian urin direkodkan pada {formatDateMY(reportDate)}.
          </p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Pesakit</th>
                  <th className="py-2.5 px-3">Metadon</th>
                  <th className="py-2.5 px-3">Status Protokol</th>
                  <th className="py-2.5 px-3">Nota Klinikal</th>
                  <th className="py-2.5 px-3">Kakitangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.urineRecords.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {u.patientName}{' '}
                      <span className="text-xs font-mono text-slate-500">({u.mrn})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          u.methadoneMetabolite === 'positif'
                            ? 'text-emerald-700 font-medium'
                            : 'text-red-700 font-medium'
                        }
                      >
                        {u.methadoneMetabolite === 'positif' ? 'Positif' : 'Negatif'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          u.overallStatus === 'patuh'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-red-700 font-semibold'
                        }
                      >
                        {u.overallStatus === 'patuh' ? 'Patuh' : 'Perlu Perhatian'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{u.clinicalNote}</td>
                    <td className="py-2.5 px-3 text-slate-600">{u.recordedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Print-Only Shift Handover Sign-Off */}
      <div className="hidden print:grid print:grid-cols-2 gap-10 pt-8 mt-6 border-t border-slate-300 text-xs text-slate-700 print-avoid-break">
        <div>
          <div className="font-semibold text-slate-900">Disediakan Oleh (Kakitangan Bertugas):</div>
          <div className="mt-10 pt-2 border-t border-slate-400">
            Tandatangan, Nama &amp; Jawatan
          </div>
        </div>
        <div>
          <div className="font-semibold text-slate-900">Disahkan Oleh (Pegawai Perubatan / Farmasi):</div>
          <div className="mt-10 pt-2 border-t border-slate-400">
            Tandatangan, Nama &amp; Cop Rasmi
          </div>
        </div>
      </div>
    </div>
  );
};

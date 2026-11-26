import React, { useMemo, useState } from 'react';
import { Plus, Search, UserPlus } from 'lucide-react';
import type { DispensingMode, Patient, ProtocolPhase } from '../types/clinical';
import {
  calculateNextAppointmentDate,
  calculateUrineTestWindow,
  DISPENSING_LABELS,
  formatDateMY,
  PROTOCOL_PRESETS,
} from '../utils/methadoneProtocol';

interface PatientsProtocolViewProps {
  todayIso: string;
  patients: Patient[];
  activePatientId: string;
  onSelectAndOpenSession: (patientId: string) => void;
  onRegisterPatient: (patient: Omit<Patient, 'id'>) => void;
  onUpdatePatientPhase: (
    patientId: string,
    phase: ProtocolPhase,
    doseMg: number,
    dispensingMode: DispensingMode
  ) => void;
  initialShowForm?: boolean;
}

export const PatientsProtocolView: React.FC<PatientsProtocolViewProps> = ({
  todayIso,
  patients,
  activePatientId,
  onSelectAndOpenSession,
  onRegisterPatient,
  onUpdatePatientPhase,
  initialShowForm = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'semua' | ProtocolPhase>('semua');
  const [showRegisterForm, setShowRegisterForm] = useState(initialShowForm);

  // Registration form state
  const [name, setName] = useState('');
  const [mrn, setMrn] = useState(`MTD-2026-0${patients.length + 15}`);
  const [icNumber, setIcNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState<ProtocolPhase>('induksi');
  const [doseMg, setDoseMg] = useState<number>(30);
  const [dispensingMode, setDispensingMode] = useState<DispensingMode>('dot_harian');
  const [startDate, setStartDate] = useState(todayIso);
  const [clinicalAlertNote, setClinicalAlertNote] = useState('');
  const [formError, setFormError] = useState('');

  // Inline quick phase edit state
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editPhase, setEditPhase] = useState<ProtocolPhase>('induksi');
  const [editDose, setEditDose] = useState<number>(40);
  const [editDispensing, setEditDispensing] = useState<DispensingMode>('dot_harian');

  React.useEffect(() => {
    if (initialShowForm) setShowRegisterForm(true);
  }, [initialShowForm]);

  const handlePhaseSelection = (nextPhase: ProtocolPhase) => {
    setPhase(nextPhase);
    setDispensingMode(PROTOCOL_PRESETS[nextPhase].defaultDispensingMode);
  };

  const previewProtocol = PROTOCOL_PRESETS[phase];
  const previewNextAppointment = calculateNextAppointmentDate(phase, startDate || todayIso);
  const previewUrineWindow = calculateUrineTestWindow(
    {
      startDate: startDate || todayIso,
      phase,
      urineIntervalDays: previewProtocol.urineIntervalDays,
      urineWindowDays: previewProtocol.urineWindowDays,
    },
    todayIso
  );

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      if (phaseFilter !== 'semua' && p.phase !== phaseFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.icNumber.toLowerCase().includes(q)
      );
    });
  }, [patients, searchQuery, phaseFilter]);

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Sila masukkan nama penuh pesakit.');
      return;
    }
    if (!mrn.trim()) {
      setFormError('Sila masukkan nombor daftar klinikal (MRN).');
      return;
    }
    if (!icNumber.trim()) {
      setFormError('Sila masukkan nombor kad pengenalan pesakit.');
      return;
    }
    if (!doseMg || doseMg <= 0) {
      setFormError('Sila masukkan dos metadon (mg) yang sah.');
      return;
    }
    setFormError('');

    onRegisterPatient({
      name: name.trim(),
      mrn: mrn.trim(),
      icNumber: icNumber.trim(),
      phone: phone.trim() || '-',
      phase,
      doseMg: Number(doseMg),
      dispensingMode,
      startDate: startDate || todayIso,
      nextAppointmentDate: previewNextAppointment,
      nextAppointmentTime: '08:30',
      urineIntervalDays: previewProtocol.urineIntervalDays,
      urineWindowDays: previewProtocol.urineWindowDays,
      clinicalAlertNote: clinicalAlertNote.trim() || undefined,
    });

    setName('');
    setIcNumber('');
    setPhone('');
    setClinicalAlertNote('');
    setMrn(`MTD-2026-0${patients.length + 16}`);
    setShowRegisterForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Filter Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Senarai Pesakit & Protokol Rawatan Metadon
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Pendaftaran protokol menentukan jadual temujanji dan julat tarikh ujian urin secara automatik.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRegisterForm((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            {showRegisterForm ? 'Tutup Borang Daftar' : 'Daftar Pesakit Baharu'}
          </button>
        </div>

        {/* Registration Form */}
        {showRegisterForm && (
          <form
            onSubmit={handleCreatePatient}
            aria-label="Borang daftar pesakit metadon baharu"
            className="mt-6 pt-6 border-t border-slate-200 space-y-5"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Pendaftaran Pesakit & Protokol Rawatan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Penuh Pesakit
                </label>
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cth: Mohamad Hafiz bin Osman"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="reg-mrn" className="block text-xs font-medium text-slate-700 mb-1">
                  No. Daftar Klinikal (MRN)
                </label>
                <input
                  id="reg-mrn"
                  type="text"
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="reg-ic" className="block text-xs font-medium text-slate-700 mb-1">
                  No. Kad Pengenalan
                </label>
                <input
                  id="reg-ic"
                  type="text"
                  value={icNumber}
                  onChange={(e) => setIcNumber(e.target.value)}
                  placeholder="Cth: 890512-10-4411"
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  No. Telefon
                </label>
                <input
                  id="reg-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Cth: 012-345 6789"
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="reg-phase" className="block text-xs font-medium text-slate-700 mb-1">
                  Fasa Protokol Rawatan
                </label>
                <select
                  id="reg-phase"
                  value={phase}
                  onChange={(e) => handlePhaseSelection(e.target.value as ProtocolPhase)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {Object.entries(PROTOCOL_PRESETS).map(([k, preset]) => (
                    <option key={k} value={k}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-dose" className="block text-xs font-medium text-slate-700 mb-1">
                  Dos Harian Metadon (mg)
                </label>
                <input
                  id="reg-dose"
                  type="number"
                  min={5}
                  max={200}
                  value={doseMg}
                  onChange={(e) => setDoseMg(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="reg-dispensing" className="block text-xs font-medium text-slate-700 mb-1">
                  Mod Pengambilan Dos
                </label>
                <select
                  id="reg-dispensing"
                  value={dispensingMode}
                  onChange={(e) => setDispensingMode(e.target.value as DispensingMode)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {Object.entries(DISPENSING_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-start" className="block text-xs font-medium text-slate-700 mb-1">
                  Tarikh Mula Protokol
                </label>
                <input
                  id="reg-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="reg-note" className="block text-xs font-medium text-slate-700 mb-1">
                  Nota Klinikal Awal
                </label>
                <input
                  id="reg-note"
                  type="text"
                  value={clinicalAlertNote}
                  onChange={(e) => setClinicalAlertNote(e.target.value)}
                  placeholder="Cth: Tiada alahan ubat, pantau sedasi"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Live Automatic Protocol Calculation Preview */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Peraturan Protokol Terpilih</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {previewProtocol.description}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Tarikh Akan Hadir Pertama (Automatik)</span>
                <span className="font-mono font-semibold text-teal-800 mt-0.5 block tabular-nums">
                  {formatDateMY(previewNextAppointment)} (Jam 08:30)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Julat Ujian Urin Automatik Sistem</span>
                <span className="font-mono font-semibold text-teal-800 mt-0.5 block tabular-nums">
                  {formatDateMY(previewUrineWindow.windowStart)} –{' '}
                  {formatDateMY(previewUrineWindow.windowEnd)}
                </span>
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-red-700">
                {formError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Simpan & Jana Jadual Protokol
              </button>
              <button
                type="button"
                onClick={() => setShowRegisterForm(false)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {/* Search & Segmented Filter Controls */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <label htmlFor="patient-search" className="sr-only">
              Cari nama, MRN, atau nombor kad pengenalan pesakit
            </label>
            <input
              id="patient-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pesakit, MRN, atau No. KP..."
              className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div
            role="group"
            aria-label="Tapis mengikut fasa rawatan"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { key: 'semua', label: 'Semua' },
                { key: 'induksi', label: 'Induksi' },
                { key: 'penstabilan', label: 'Penstabilan' },
                { key: 'penyelenggaraan', label: 'Penyelenggaraan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPhaseFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  phaseFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Patient Roster Table */}
      <section
        aria-label="Jadual senarai pesakit berdaftar"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Pesakit & MRN</th>
                <th className="py-3 px-4">Fasa Protokol</th>
                <th className="py-3 px-4 text-right">Dos</th>
                <th className="py-3 px-4">Tarikh Akan Hadir</th>
                <th className="py-3 px-4">Julat Urin Automatik</th>
                <th className="py-3 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Tiada pesakit sepadan dengan carian atau penapis fasa.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const win = calculateUrineTestWindow(patient, todayIso);
                  const isEditing = editingPatientId === patient.id;
                  const isActive = patient.id === activePatientId;

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isActive ? 'bg-teal-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{patient.name}</div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          {patient.mrn} · {patient.icNumber}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select
                            aria-label={`Fasa baharu untuk ${patient.name}`}
                            value={editPhase}
                            onChange={(e) => {
                              const p = e.target.value as ProtocolPhase;
                              setEditPhase(p);
                              setEditDispensing(PROTOCOL_PRESETS[p].defaultDispensingMode);
                            }}
                            className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                          >
                            {Object.entries(PROTOCOL_PRESETS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <div className="font-medium text-slate-800">
                              {PROTOCOL_PRESETS[patient.phase].label}
                            </div>
                            <div className="text-xs text-slate-500">
                              {DISPENSING_LABELS[patient.dispensingMode]}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            aria-label={`Dos baharu untuk ${patient.name}`}
                            value={editDose}
                            onChange={(e) => setEditDose(Number(e.target.value))}
                            className="w-20 px-2 py-1 text-xs text-right bg-white border border-slate-300 rounded"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900">{patient.doseMg} mg</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700">
                        <div>{formatDateMY(patient.nextAppointmentDate)}</div>
                        <div className="text-slate-500">Jam {patient.nextAppointmentTime}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs">
                        <div className="text-slate-900 font-medium">
                          {formatDateMY(win.windowStart)} – {formatDateMY(win.windowEnd)}
                        </div>
                        <div
                          className={
                            win.status === 'dalam_julat'
                              ? 'text-amber-700 font-medium'
                              : win.status === 'tamat_tempoh'
                              ? 'text-red-700 font-medium'
                              : 'text-slate-500'
                          }
                        >
                          {win.status === 'dalam_julat'
                            ? 'Aktif sekarang'
                            : win.status === 'tamat_tempoh'
                            ? 'Tamat tempoh'
                            : `Dalam ${win.daysUntilStart} hari`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdatePatientPhase(
                                    patient.id,
                                    editPhase,
                                    editDose,
                                    editDispensing
                                  );
                                  setEditingPatientId(null);
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 whitespace-nowrap"
                              >
                                Simpan
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPatientId(null)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPatientId(patient.id);
                                  setEditPhase(patient.phase);
                                  setEditDose(patient.doseMg);
                                  setEditDispensing(patient.dispensingMode);
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 whitespace-nowrap"
                              >
                                Ubah Protokol
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectAndOpenSession(patient.id)}
                                className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 whitespace-nowrap"
                              >
                                Buka Sesi
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

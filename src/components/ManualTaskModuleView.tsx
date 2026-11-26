import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  ClipboardPlus,
  Trash2,
} from 'lucide-react';
import type {
  ClinicalTask,
  ManualEntryType,
  Patient,
  TaskCategory,
  TaskPriority,
} from '../types/clinical';
import {
  buildManualTaskEntries,
  MANUAL_ENTRY_TYPE_LABELS,
  type RepeatCadence,
  validateManualTaskDraft,
} from '../utils/manualTaskBuilder';
import { addDaysISO, formatDateMY, PROTOCOL_PRESETS } from '../utils/methadoneProtocol';

interface ManualTaskModuleViewProps {
  todayIso: string;
  patients: Patient[];
  activePatientId: string;
  onSelectPatient: (patientId: string) => void;
  tasks: ClinicalTask[];
  onAddTaskBatch: (tasks: Omit<ClinicalTask, 'id'>[]) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenDateInCalendar: (dateIso: string) => void;
}

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  dos: 'Pemberian Dos',
  urin: 'Ujian Urin',
  kaunseling: 'Kaunseling',
  susulan: 'Pemantauan',
  dokumen: 'Dokumentasi',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  segera: 'Segera',
  penting: 'Penting',
  biasa: 'Biasa',
};

const QUICK_TEMPLATES: Array<{
  label: string;
  entryType: ManualEntryType;
  title: string;
  details: string;
  category: TaskCategory;
  priority: TaskPriority;
}> = [
  {
    label: 'Arahan Pelarasan Dos',
    entryType: 'arahan_pegawai',
    title: 'Arahan Pegawai Perubatan: Semakan & pelarasan dos metadon',
    details: 'Nilaikan simptom penarikan (COWS) atau sedasi sebelum pelarasan dos harian.',
    category: 'dos',
    priority: 'segera',
  },
  {
    label: 'Ujian Darah / ECG',
    entryType: 'arahan_pegawai',
    title: 'Ujian darah (LFT/Renal) & saringan ECG QTc',
    details: 'Arahan pegawai perubatan untuk pengesahan keselamatan dos penyelenggaraan.',
    category: 'susulan',
    priority: 'penting',
  },
  {
    label: 'Nota Kesan Sampingan',
    entryType: 'nota_perubatan',
    title: 'Nota Perubatan: Pantau kesan sampingan & tidur pesakit',
    details: 'Rekodkan sebarang aduan mengantuk berlebihan, sembelit, atau pening selepas dos.',
    category: 'susulan',
    priority: 'penting',
  },
  {
    label: 'Rujukan Kaunseling',
    entryType: 'tugasan',
    title: 'Sesi kaunseling sokongan pemulihan & kepatuhan rawatan',
    details: 'Bincang strategi pencegahan relaps dan jadual kehadiran berkala.',
    category: 'kaunseling',
    priority: 'biasa',
  },
];

export const ManualTaskModuleView: React.FC<ManualTaskModuleViewProps> = ({
  todayIso,
  patients,
  activePatientId,
  onSelectPatient,
  tasks,
  onAddTaskBatch,
  onToggleTask,
  onDeleteTask,
  onOpenDateInCalendar,
}) => {
  const selectedPatient =
    patients.find((p) => p.id === activePatientId) ?? patients[0];

  const [entryType, setEntryType] = useState<ManualEntryType>('arahan_pegawai');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [orderedBy, setOrderedBy] = useState('Dr. Hakimah Idris');
  const [category, setCategory] = useState<TaskCategory>('dos');
  const [priority, setPriority] = useState<TaskPriority>('penting');
  const [dueDate, setDueDate] = useState(todayIso);
  const [dueTime, setDueTime] = useState('09:00');
  const [repeatCadence, setRepeatCadence] = useState<RepeatCadence>('sekali');
  const [repeatCount, setRepeatCount] = useState<number>(3);
  const [formError, setFormError] = useState('');
  const [savedNotice, setSavedNotice] = useState<{
    count: number;
    targetDate: string;
    patientName: string;
  } | null>(null);

  // Right-side list filter state
  const [listScope, setListScope] = useState<'pesakit_ini' | 'semua'>('pesakit_ini');
  const [typeFilter, setTypeFilter] = useState<'semua' | ManualEntryType>('semua');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p])),
    [patients]
  );

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (listScope === 'pesakit_ini' && selectedPatient && t.patientId !== selectedPatient.id) {
          return false;
        }
        const effectiveType: ManualEntryType = t.entryType ?? 'tugasan';
        if (typeFilter !== 'semua' && effectiveType !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [tasks, listScope, selectedPatient, typeFilter]);

  const applyTemplate = (tpl: (typeof QUICK_TEMPLATES)[number]) => {
    setEntryType(tpl.entryType);
    setTitle(tpl.title);
    setDetails(tpl.details);
    setCategory(tpl.category);
    setPriority(tpl.priority);
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setFormError('Tiada pesakit berdaftar dipilih.');
      return;
    }

    const draft = {
      patientId: selectedPatient.id,
      entryType,
      title,
      details,
      orderedBy,
      category,
      priority,
      dueDate,
      dueTime,
      repeatCadence,
      repeatCount,
    };

    const validation = validateManualTaskDraft(draft);
    if (!validation.valid) {
      setFormError(validation.error ?? 'Sila lengkapkan maklumat peringatan.');
      return;
    }

    setFormError('');
    const entries = buildManualTaskEntries(draft);
    onAddTaskBatch(entries);

    setSavedNotice({
      count: entries.length,
      targetDate: dueDate,
      patientName: selectedPatient.name,
    });
    setTitle('');
    setDetails('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Registered Patient Selector */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Modul Penambahan Tugasan & Arahan Manual
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Masukkan tugasan, nota perubatan, atau arahan pegawai perubatan ke atas pesakit berdaftar sebagai peringatan di kalendar bulanan.
            </p>
          </div>

          <div className="shrink-0">
            <label htmlFor="manual-patient-select" className="block text-xs font-medium text-slate-600 mb-1">
              Pesakit Berdaftar
            </label>
            <select
              id="manual-patient-select"
              value={selectedPatient?.id ?? ''}
              onChange={(e) => {
                onSelectPatient(e.target.value);
                setSavedNotice(null);
              }}
              className="min-h-[42px] px-3 py-2 text-sm font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mrn})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPatient && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
            <span className="font-mono font-semibold text-slate-800">{selectedPatient.mrn}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{selectedPatient.icNumber}</span>
            <span aria-hidden="true">·</span>
            <span>{PROTOCOL_PRESETS[selectedPatient.phase].label}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-900">Dos {selectedPatient.doseMg} mg</span>
            <span aria-hidden="true">·</span>
            <span>
              Temujanji Seterusnya:{' '}
              <span className="font-mono font-medium text-slate-800">
                {formatDateMY(selectedPatient.nextAppointmentDate)}
              </span>
            </span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Manual Entry Form (7 cols) */}
        <section
          aria-label="Borang tambah tugasan dan arahan manual"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Tambah Peringatan ke Kalendar Bulanan
            </h2>
            <ClipboardPlus className="w-4 h-4 text-teal-700" aria-hidden="true" />
          </div>

          {savedNotice && (
            <div
              role="status"
              className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2 text-xs font-medium text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {savedNotice.count} peringatan untuk{' '}
                  <strong>{savedNotice.patientName}</strong> telah dimasukkan ke kalendar (bermula{' '}
                  <span className="font-mono">{formatDateMY(savedNotice.targetDate)}</span>).
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenDateInCalendar(savedNotice.targetDate)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-white border border-teal-300 rounded-lg hover:bg-teal-50 whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                Lihat di Kalendar
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Entry Type Segmented Control */}
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1.5">
                Jenis Rekod / Peringatan
              </span>
              <div
                role="group"
                aria-label="Pilih jenis rekod atau peringatan"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg"
              >
                {(Object.keys(MANUAL_ENTRY_TYPE_LABELS) as ManualEntryType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEntryType(key)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors text-center ${
                      entryType === key
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {MANUAL_ENTRY_TYPE_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Clinical Templates */}
            <div>
              <span className="block text-xs text-slate-500 mb-1.5">
                Templat Pantas (Pilihan):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((tpl) => (
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

            {/* Title */}
            <div>
              <label htmlFor="manual-title" className="block text-xs font-medium text-slate-700 mb-1">
                Tajuk Tugasan / Nota / Arahan
              </label>
              <input
                id="manual-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Cth: Arahan Dr. Hakimah — Semak keputusan darah LFT sebelum naikkan dos"
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>

            {/* Medical Details / Doctor Instructions */}
            <div>
              <label htmlFor="manual-details" className="block text-xs font-medium text-slate-700 mb-1">
                Butiran Nota Perubatan / Arahan Pegawai Perubatan
              </label>
              <textarea
                id="manual-details"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Masukkan arahan terperinci, perhatian dos, atau nota susulan klinikal..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>

            {/* Date, Time & Quick Date Helpers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="manual-date" className="text-xs font-medium text-slate-700">
                    Tarikh Kalendar
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDueDate(todayIso)}
                      className="text-teal-700 hover:underline font-medium"
                    >
                      Hari Ini
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setDueDate(addDaysISO(todayIso, 1))}
                      className="text-teal-700 hover:underline font-medium"
                    >
                      Esok
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setDueDate(addDaysISO(todayIso, 7))}
                      className="text-teal-700 hover:underline font-medium"
                    >
                      +7 Hari
                    </button>
                  </div>
                </div>
                <input
                  id="manual-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="manual-time" className="block text-xs font-medium text-slate-700 mb-1">
                  Masa Peringatan
                </label>
                <input
                  id="manual-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Category, Priority, Ordered By */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="manual-category" className="block text-xs font-medium text-slate-700 mb-1">
                  Kategori
                </label>
                <select
                  id="manual-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="manual-priority" className="block text-xs font-medium text-slate-700 mb-1">
                  Keutamaan
                </label>
                <select
                  id="manual-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="manual-ordered-by" className="block text-xs font-medium text-slate-700 mb-1">
                  Pegawai / Petugas
                </label>
                <input
                  id="manual-ordered-by"
                  type="text"
                  value={orderedBy}
                  onChange={(e) => setOrderedBy(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {/* Repeat Cadence into Calendar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label htmlFor="manual-cadence" className="block text-xs font-medium text-slate-700 mb-1">
                  Kekerapan di Kalendar
                </label>
                <select
                  id="manual-cadence"
                  value={repeatCadence}
                  onChange={(e) => setRepeatCadence(e.target.value as RepeatCadence)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="sekali">Sekali Sahaja</option>
                  <option value="harian">Ulang Setiap Hari</option>
                  <option value="mingguan">Ulang Setiap Minggu</option>
                </select>
              </div>

              {repeatCadence !== 'sekali' && (
                <div>
                  <label htmlFor="manual-repeat-count" className="block text-xs font-medium text-slate-700 mb-1">
                    Bilangan Kali (Maks 14)
                  </label>
                  <input
                    id="manual-repeat-count"
                    type="number"
                    min={1}
                    max={14}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              )}
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
              Masukkan ke Kalendar Bulanan
            </button>
          </form>
        </section>

        {/* Registered Patient's Scheduled Reminders List (5 cols) */}
        <section
          aria-label="Senarai tugasan dan arahan berjadual"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Senarai Peringatan Kalendar
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {filteredTasks.length} peringatan dipaparkan
              </p>
            </div>

            <div
              role="group"
              aria-label="Skop paparan senarai"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setListScope('pesakit_ini')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  listScope === 'pesakit_ini'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pesakit Ini
              </button>
              <button
                type="button"
                onClick={() => setListScope('semua')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  listScope === 'semua'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="manual-list-type-filter" className="sr-only">
              Tapis mengikut jenis peringatan
            </label>
            <select
              id="manual-list-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'semua' | ManualEntryType)}
              className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="semua">Semua Jenis (Tugasan, Nota & Arahan)</option>
              {(Object.keys(MANUAL_ENTRY_TYPE_LABELS) as ManualEntryType[]).map((k) => (
                <option key={k} value={k}>
                  {MANUAL_ENTRY_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Tiada tugasan atau arahan manual sepadan dengan penapis ini.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-1" data-testid="manual-task-list">
              {filteredTasks.map((task) => {
                const p = patientMap.get(task.patientId);
                const entryLabel =
                  MANUAL_ENTRY_TYPE_LABELS[task.entryType ?? 'tugasan'];
                const isConfirmDel = confirmDeleteId === task.id;

                return (
                  <li key={task.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-teal-800">
                          {entryLabel}
                          {task.orderedBy ? ` · ${task.orderedBy}` : ''}
                        </div>
                        <div
                          className={`text-sm font-semibold mt-0.5 ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.details && (
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                            {task.details}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 font-mono tabular-nums">
                          <span>{formatDateMY(task.dueDate)}</span>
                          {task.dueTime && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{task.dueTime}</span>
                            </>
                          )}
                          {listScope === 'semua' && p && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-sans">{p.name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold whitespace-nowrap ${
                          task.completed
                            ? 'text-emerald-700'
                            : task.priority === 'segera'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {task.completed ? 'Selesai' : PRIORITY_LABELS[task.priority]}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleTask(task.id)}
                          aria-pressed={task.completed}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                            task.completed
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                          }`}
                        >
                          <Check className="w-3 h-3" aria-hidden="true" />
                          {task.completed ? 'Selesai' : 'Sahkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDateInCalendar(task.dueDate)}
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
                                onDeleteTask(task.id);
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
                            onClick={() => setConfirmDeleteId(task.id)}
                            aria-label={`Padam peringatan ${task.title}`}
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
        </section>
      </div>
    </div>
  );
};

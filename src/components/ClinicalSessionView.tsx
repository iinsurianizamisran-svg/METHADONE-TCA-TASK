import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Check,
  Clock,
  FlaskConical,
  Plus,
  UserCheck,
  UserX,
} from 'lucide-react';
import type {
  Appointment,
  AppointmentStatus,
  ClinicalTask,
  Patient,
  TaskCategory,
  TaskPriority,
} from '../types/clinical';
import {
  calculateNextAppointmentDate,
  calculateUrineTestWindow,
  DISPENSING_LABELS,
  formatDateMY,
  PROTOCOL_PRESETS,
} from '../utils/methadoneProtocol';

interface ClinicalSessionViewProps {
  todayIso: string;
  patients: Patient[];
  activePatient: Patient | undefined;
  onSelectPatient: (patientId: string) => void;
  appointments: Appointment[];
  tasks: ClinicalTask[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: Omit<ClinicalTask, 'id'>) => void;
  onUpdateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onScheduleNextAppointment: (
    patientId: string,
    date: string,
    time: string,
    purpose: string
  ) => void;
  onOpenUrineTab: () => void;
  onOpenRegisterPatient: () => void;
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

const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  dijadualkan: 'Dijadualkan',
  hadir: 'Hadir',
  tidak_hadir: 'Tidak Hadir',
  ditunda: 'Ditunda',
};

export const ClinicalSessionView: React.FC<ClinicalSessionViewProps> = ({
  todayIso,
  patients,
  activePatient,
  onSelectPatient,
  appointments,
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateAppointmentStatus,
  onScheduleNextAppointment,
  onOpenUrineTab,
  onOpenRegisterPatient,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('dos');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('penting');
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  const recommendedNextDate = activePatient
    ? calculateNextAppointmentDate(activePatient.phase, todayIso)
    : todayIso;

  const [nextDate, setNextDate] = useState(recommendedNextDate);
  const [nextTime, setNextTime] = useState(activePatient?.nextAppointmentTime || '08:30');
  const [nextPurpose, setNextPurpose] = useState('Dos & Semakan Klinikal Metadon');
  const [scheduleError, setScheduleError] = useState('');
  const [taskError, setTaskError] = useState('');

  // Keep form default synced when patient changes
  React.useEffect(() => {
    if (activePatient) {
      setNextDate(calculateNextAppointmentDate(activePatient.phase, todayIso));
      setNextTime(activePatient.nextAppointmentTime || '08:30');
    }
  }, [activePatient?.id, activePatient?.phase, todayIso]);

  const patientAppointments = useMemo(() => {
    if (!activePatient) return [];
    return appointments
      .filter((a) => a.patientId === activePatient.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments, activePatient]);

  const patientTasks = useMemo(() => {
    if (!activePatient) return [];
    return tasks
      .filter((t) => t.patientId === activePatient.id)
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [tasks, activePatient]);

  const urineWindow = useMemo(() => {
    if (!activePatient) return null;
    return calculateUrineTestWindow(activePatient, todayIso);
  }, [activePatient, todayIso]);

  if (!activePatient) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Tiada Pesakit Dipilih</h2>
        <p className="mt-2 text-sm text-slate-600">
          Sila daftar pesakit metadon baharu untuk memulakan jadual temujanji dan tugasan klinikal.
        </p>
        <button
          type="button"
          onClick={onOpenRegisterPatient}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Daftar Pesakit Baharu
        </button>
      </div>
    );
  }

  const todayAppt = patientAppointments.find((a) => a.date === todayIso);
  const completedCount = patientTasks.filter((t) => t.completed).length;
  const pendingCount = patientTasks.length - completedCount;

  const handleQuickAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) {
      setTaskError('Sila masukkan penerangan tugasan kakitangan.');
      return;
    }
    setTaskError('');
    onAddTask({
      patientId: activePatient.id,
      title: trimmed,
      category: newTaskCategory,
      dueDate: todayIso,
      dueTime: new Date().toTimeString().slice(0, 5),
      priority: newTaskPriority,
      completed: false,
    });
    setNewTaskTitle('');
  };

  const handleSaveNextAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextDate) {
      setScheduleError('Sila pilih tarikh akan hadir.');
      return;
    }
    if (!nextPurpose.trim()) {
      setScheduleError('Sila nyatakan tujuan temujanji.');
      return;
    }
    setScheduleError('');
    onScheduleNextAppointment(activePatient.id, nextDate, nextTime || '08:30', nextPurpose.trim());
    setShowScheduleForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Patient Selection & Protocol Overview Strip */}
      <section
        aria-label="Profil pesakit aktif"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1">
            <div className="text-xs font-medium text-teal-700">
              Pesakit Aktif Sesi Klinikal
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {activePatient.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-600 tabular-nums">
              <span className="font-mono font-medium text-slate-800">{activePatient.mrn}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activePatient.icNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{PROTOCOL_PRESETS[activePatient.phase].label}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-900 whitespace-nowrap">
                Dos {activePatient.doseMg} mg
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {activePatient.regimenType === 'dbb' || (activePatient.dbbBottles ?? 0) > 0
                  ? `DOT ${activePatient.dotDaysPerWeek ?? 7 - (activePatient.dbbBottles ?? 0)}h + DBB ${activePatient.dbbBottles ?? 0} btl`
                  : DISPENSING_LABELS[activePatient.dispensingMode]}
              </span>
              {activePatient.lastBloodTestDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-xs text-slate-500">
                    Darah terakhir: {formatDateMY(activePatient.lastBloodTestDate)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <label
              htmlFor="active-patient-select"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Tukar Pesakit Sesi
            </label>
            <select
              id="active-patient-select"
              value={activePatient.id}
              onChange={(e) => onSelectPatient(e.target.value)}
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

        {/* 4-metric clean horizontal summary row (no nested card shadows) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div>
            <div className="text-xs text-slate-500">Tarikh Akan Hadir</div>
            <div className="mt-1 text-base font-semibold text-slate-900 font-mono tabular-nums">
              {formatDateMY(activePatient.nextAppointmentDate)}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              Jam {activePatient.nextAppointmentTime}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Tugasan Sesi Ini</div>
            <div className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
              {completedCount} / {patientTasks.length} Selesai
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              {pendingCount > 0 ? `${pendingCount} tugasan menunggu` : 'Semua tugasan selesai'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Julat Ujian Urin Automatik</div>
            {urineWindow && (
              <>
                <div className="mt-1 text-base font-semibold text-slate-900 font-mono tabular-nums">
                  {formatDateMY(urineWindow.windowStart)} – {formatDateMY(urineWindow.windowEnd)}
                </div>
                <div
                  className={`text-xs font-medium ${
                    urineWindow.status === 'dalam_julat'
                      ? 'text-amber-700'
                      : urineWindow.status === 'tamat_tempoh'
                      ? 'text-red-700'
                      : 'text-slate-600'
                  }`}
                >
                  {urineWindow.status === 'dalam_julat'
                    ? `Aktif sekarang (baki ${urineWindow.daysRemainingInWindow} hari)`
                    : urineWindow.status === 'tamat_tempoh'
                    ? 'Tamat tempoh protokol'
                    : `Bermula dalam ${urineWindow.daysUntilStart} hari`}
                </div>
              </>
            )}
          </div>

          <div>
            <div className="text-xs text-slate-500">Nota Klinikal Protokol</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-700 line-clamp-3">
              {activePatient.clinicalAlertNote || 'Tiada catatan khas.'}
            </p>
          </div>
        </div>
      </section>

      {/* Main 2-column split: Left = Ultra-Simple Staff Task Checklist, Right = Attendance & Urine Window */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Staff Tasks Section (7 cols) */}
        <section
          aria-label="Senarai tugasan kakitangan"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="text-xs font-semibold text-teal-700">
                Langkah 1 · Semak &amp; Tandakan Tugasan
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                Tugasan Kakitangan Semasa Temujanji
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ketik satu kali untuk menandakan tugasan selesai semasa sesi klinikal.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">
              {pendingCount} Belum Selesai
            </span>
          </div>

          {/* Ultra-simple quick add task form */}
          <form onSubmit={handleQuickAddTask} className="mt-4 pb-4 border-b border-slate-100 space-y-2.5">
            <div>
              <label htmlFor="quick-task-title" className="sr-only">
                Tambah tugasan baharu untuk pesakit ini
              </label>
              <input
                id="quick-task-title"
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Tambah tugasan pantas (cth: Semak tekanan darah & nadi)..."
                className="w-full min-h-[42px] px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5">
                <label htmlFor="quick-task-category" className="sr-only">
                  Kategori tugasan
                </label>
                <select
                  id="quick-task-category"
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value as TaskCategory)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label htmlFor="quick-task-priority" className="sr-only">
                  Keutamaan tugasan
                </label>
                <select
                  id="quick-task-priority"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-1.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Tambah
              </button>
            </div>
            {taskError && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                {taskError}
              </p>
            )}
          </form>

          {/* Task list */}
          {patientTasks.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Tiada tugasan direkodkan untuk pesakit ini. Gunakan ruang di atas untuk menambah tugasan.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 mt-2" data-testid="staff-task-list">
              {patientTasks.map((task) => {
                const isOverdue = !task.completed && task.dueDate < todayIso;
                return (
                  <li key={task.id} className="py-3 first:pt-2 last:pb-1">
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      aria-pressed={task.completed}
                      className={`w-full flex items-start gap-3.5 p-2.5 rounded-lg text-left transition-colors min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                        task.completed
                          ? 'bg-slate-50/70 hover:bg-slate-100/70'
                          : 'hover:bg-teal-50/40'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex items-center justify-center w-6 h-6 rounded-md border shrink-0 transition-colors ${
                          task.completed
                            ? 'bg-teal-700 border-teal-700 text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-sm font-medium leading-snug ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                          <span>{CATEGORY_LABELS[task.category]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {formatDateMY(task.dueDate)}
                            {task.dueTime ? ` (${task.dueTime})` : ''}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              task.completed
                                ? 'text-emerald-700 font-medium'
                                : isOverdue || task.priority === 'segera'
                                ? 'text-red-700 font-medium'
                                : task.priority === 'penting'
                                ? 'text-amber-700 font-medium'
                                : 'text-slate-600'
                            }
                          >
                            {task.completed
                              ? `Selesai${task.completedBy ? ` oleh ${task.completedBy}` : ''}`
                              : isOverdue
                              ? 'Tertunggak'
                              : PRIORITY_LABELS[task.priority]}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right Column: Attendance & Automatic Urine Screening Action (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Appointment & Next Attendance Panel */}
          <section
            aria-label="Jadual tarikh akan hadir"
            className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs font-semibold text-teal-700">
                  Langkah 2 · Kehadiran &amp; Tarikh Akan Hadir
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                  Jadual &amp; Kehadiran Temujanji
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekod kehadiran hari ini atau tetapkan tarikh akan hadir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleForm((prev) => !prev)}
                className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
              >
                {showScheduleForm ? 'Tutup Borang' : '+ Jadual Baharu'}
              </button>
            </div>

            {/* Today's Appointment Quick Action */}
            {todayAppt ? (
              <div className="mt-4 pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-500">
                      Temujanji Hari Ini · <span className="font-mono">{todayAppt.time}</span>
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">
                      {todayAppt.purpose}
                    </div>
                    {todayAppt.notes && (
                      <p className="mt-1 text-xs text-slate-600">{todayAppt.notes}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                      todayAppt.status === 'hadir'
                        ? 'text-emerald-700'
                        : todayAppt.status === 'tidak_hadir'
                        ? 'text-red-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {APPOINTMENT_STATUS_LABELS[todayAppt.status]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateAppointmentStatus(todayAppt.id, 'hadir')}
                    className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      todayAppt.status === 'hadir'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Tandakan Hadir
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAppointmentStatus(todayAppt.id, 'tidak_hadir')}
                    className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      todayAppt.status === 'tidak_hadir'
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-red-50 hover:text-red-800 hover:border-red-300'
                    }`}
                  >
                    <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                    Tidak Hadir
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 pb-4 border-b border-slate-100 text-xs text-slate-500">
                Tiada temujanji dijadualkan khusus untuk hari ini ({formatDateMY(todayIso)}).
              </div>
            )}

            {/* Schedule Next Appointment Form */}
            {showScheduleForm && (
              <form
                onSubmit={handleSaveNextAppointment}
                className="mt-4 pb-4 border-b border-slate-100 space-y-3"
              >
                <div className="text-xs font-semibold text-slate-800">
                  Tetapkan Tarikh Akan Hadir Seterusnya
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="next-appt-date"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Tarikh Akan Hadir
                    </label>
                    <input
                      id="next-appt-date"
                      type="date"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="next-appt-time"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Masa
                    </label>
                    <input
                      id="next-appt-time"
                      type="time"
                      value={nextTime}
                      onChange={(e) => setNextTime(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="next-appt-purpose"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Tujuan Temujanji
                  </label>
                  <input
                    id="next-appt-purpose"
                    type="text"
                    value={nextPurpose}
                    onChange={(e) => setNextPurpose(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Cadangan sistem ({PROTOCOL_PRESETS[activePatient.phase].label}):{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {formatDateMY(recommendedNextDate)}
                  </span>
                </p>
                {scheduleError && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {scheduleError}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
                  >
                    Simpan Tarikh Temujanji
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleForm(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            {/* Recent & Upcoming Appointments List */}
            <div className="mt-4">
              <div className="text-xs font-medium text-slate-500 mb-2">
                Rekod Jadual Temujanji Pesakit
              </div>
              <ul className="divide-y divide-slate-100">
                {patientAppointments.slice(0, 4).map((appt) => (
                  <li key={appt.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {appt.purpose}
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {formatDateMY(appt.date)} · {appt.time}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        appt.status === 'hadir'
                          ? 'text-emerald-700'
                          : appt.status === 'tidak_hadir'
                          ? 'text-red-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {APPOINTMENT_STATUS_LABELS[appt.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Urine Protocol Window Quick Card */}
          {urineWindow && (
            <section
              aria-label="Ringkasan julat ujian urin"
              className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-teal-700">
                    Langkah 3 · Saringan Urin Berprotokol
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                    Saringan Urin Mengikut Protokol
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Julat tarikh ditetapkan automatik setiap {activePatient.urineIntervalDays} hari.
                  </p>
                </div>
                <FlaskConical className="w-5 h-5 text-teal-700 shrink-0" aria-hidden="true" />
              </div>

              <div className="mt-4 py-3 border-y border-slate-100 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500">Julat Tarikh Ditetapkan</div>
                  <div className="mt-0.5 text-sm font-semibold font-mono text-slate-900 tabular-nums">
                    {formatDateMY(urineWindow.windowStart)} – {formatDateMY(urineWindow.windowEnd)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Status Julat</div>
                  <div
                    className={`mt-0.5 text-xs font-semibold ${
                      urineWindow.status === 'dalam_julat'
                        ? 'text-amber-700'
                        : urineWindow.status === 'tamat_tempoh'
                        ? 'text-red-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {urineWindow.status === 'dalam_julat'
                      ? 'Dalam Julat Aktif'
                      : urineWindow.status === 'tamat_tempoh'
                      ? 'Melepasi Julat'
                      : 'Belum Tiba'}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={onOpenUrineTab}
                  className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap"
                >
                  <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                  Rekod Nota Ujian Urin
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

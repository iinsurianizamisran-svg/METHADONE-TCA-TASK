import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  FlaskConical,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import type {
  Appointment,
  AppointmentStatus,
  ClinicalNote,
  ClinicalTask,
  NoteCategory,
  Patient,
  TaskCategory,
  TaskPriority,
  UrineTestRecord,
} from '../types/clinical';
import {
  buildMonthCalendarGrid,
  getAgendaForDate,
  getDaySummaryCounts,
  getMonthTitleMY,
  shiftMonth,
  WEEKDAY_LABELS_MY,
} from '../utils/calendarUtils';
import { formatDateMY } from '../utils/methadoneProtocol';
import { MANUAL_ENTRY_TYPE_LABELS } from '../utils/manualTaskBuilder';

interface CalendarDashboardViewProps {
  todayIso: string;
  patients: Patient[];
  appointments: Appointment[];
  tasks: ClinicalTask[];
  notes: ClinicalNote[];
  urineRecords: UrineTestRecord[];
  onAddAppointment: (appt: Omit<Appointment, 'id'>) => void;
  onUpdateAppointment: (id: string, patch: Partial<Omit<Appointment, 'id'>>) => void;
  onDeleteAppointment: (id: string) => void;
  onAddTask: (task: Omit<ClinicalTask, 'id'>) => void;
  onUpdateTask: (id: string, patch: Partial<Omit<ClinicalTask, 'id'>>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onAddNote: (note: Omit<ClinicalNote, 'id'>) => void;
  onUpdateNote: (id: string, patch: Partial<Omit<ClinicalNote, 'id'>>) => void;
  onToggleNoteVerified: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onOpenPatientSession: (patientId: string) => void;
  onOpenPatientUrine: (patientId: string) => void;
  focusedDate?: { dateIso: string; nonce: number };
}

type AgendaFilter = 'semua' | 'temujanji' | 'tugasan' | 'nota' | 'urin';
type QuickAddMode = null | 'temujanji' | 'tugasan' | 'nota';

const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  dos: 'Pemberian Dos',
  urin: 'Ujian Urin',
  kaunseling: 'Kaunseling',
  susulan: 'Pemantauan',
  dokumen: 'Dokumentasi',
};

const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  klinikal: 'Klinikal',
  dos: 'Pengurusan Dos',
  kaunseling: 'Kaunseling',
  pentadbiran: 'Pentadbiran',
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

export const CalendarDashboardView: React.FC<CalendarDashboardViewProps> = ({
  todayIso,
  patients,
  appointments,
  tasks,
  notes,
  urineRecords,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onAddNote,
  onUpdateNote,
  onToggleNoteVerified,
  onDeleteNote,
  onOpenPatientSession,
  onOpenPatientUrine,
  focusedDate,
}) => {
  const [selectedDate, setSelectedDate] = useState(focusedDate?.dateIso || todayIso);
  const [viewYear, setViewYear] = useState(() =>
    Number((focusedDate?.dateIso || todayIso).slice(0, 4))
  );
  const [viewMonth, setViewMonth] = useState(
    () => Number((focusedDate?.dateIso || todayIso).slice(5, 7)) - 1
  );
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>('semua');

  useEffect(() => {
    if (!focusedDate?.dateIso) return;
    setSelectedDate(focusedDate.dateIso);
    setViewYear(Number(focusedDate.dateIso.slice(0, 4)));
    setViewMonth(Number(focusedDate.dateIso.slice(5, 7)) - 1);
    setAgendaFilter('semua');
    setEditingItem(null);
    setConfirmDelete(null);
  }, [focusedDate]);

  // Quick-add form state
  const [quickAddMode, setQuickAddMode] = useState<QuickAddMode>(null);
  const [addPatientId, setAddPatientId] = useState(patients[0]?.id ?? '');
  const [addTime, setAddTime] = useState('09:00');
  const [addTitle, setAddTitle] = useState('');
  const [addContent, setAddContent] = useState('');
  const [addTaskCategory, setAddTaskCategory] = useState<TaskCategory>('dos');
  const [addTaskPriority, setAddTaskPriority] = useState<TaskPriority>('penting');
  const [addNoteCategory, setAddNoteCategory] = useState<NoteCategory>('klinikal');
  const [addError, setAddError] = useState('');

  // Inline edit state (at most one item being edited at a time)
  const [editingItem, setEditingItem] = useState<{
    kind: 'appt' | 'task' | 'note';
    id: string;
  } | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState<AppointmentStatus>('dijadualkan');
  const [editTaskCategory, setEditTaskCategory] = useState<TaskCategory>('dos');
  const [editTaskPriority, setEditTaskPriority] = useState<TaskPriority>('penting');
  const [editTaskOrderedBy, setEditTaskOrderedBy] = useState('');
  const [editNoteCategory, setEditNoteCategory] = useState<NoteCategory>('klinikal');
  const [editPatientId, setEditPatientId] = useState('');

  // Inline delete confirmation state (safe for iframe, no window.confirm)
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'appt' | 'task' | 'note';
    id: string;
  } | null>(null);

  const calendarCells = useMemo(
    () => buildMonthCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const dayCountsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDaySummaryCounts>>();
    for (const cell of calendarCells) {
      map.set(
        cell.dateIso,
        getDaySummaryCounts(
          cell.dateIso,
          patients,
          appointments,
          tasks,
          notes,
          urineRecords,
          todayIso
        )
      );
    }
    return map;
  }, [calendarCells, patients, appointments, tasks, notes, urineRecords, todayIso]);

  const agenda = useMemo(
    () =>
      getAgendaForDate(
        selectedDate,
        patients,
        appointments,
        tasks,
        notes,
        urineRecords,
        todayIso
      ),
    [selectedDate, patients, appointments, tasks, notes, urineRecords, todayIso]
  );

  const handleJumpToday = () => {
    setSelectedDate(todayIso);
    setViewYear(Number(todayIso.slice(0, 4)));
    setViewMonth(Number(todayIso.slice(5, 7)) - 1);
  };

  const handleShiftMonth = (delta: number) => {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const openQuickAdd = (mode: QuickAddMode) => {
    setQuickAddMode((prev) => (prev === mode ? null : mode));
    setAddError('');
    setAddTitle('');
    setAddContent('');
    if (!addPatientId && patients[0]) {
      setAddPatientId(patients[0].id);
    }
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) {
      setAddError('Sila masukkan tajuk atau tujuan perkara.');
      return;
    }
    if ((quickAddMode === 'temujanji' || quickAddMode === 'tugasan') && !addPatientId) {
      setAddError('Sila pilih pesakit.');
      return;
    }
    setAddError('');

    if (quickAddMode === 'temujanji') {
      onAddAppointment({
        patientId: addPatientId,
        date: selectedDate,
        time: addTime || '09:00',
        purpose: addTitle.trim(),
        status: 'dijadualkan',
        notes: addContent.trim() || undefined,
      });
    } else if (quickAddMode === 'tugasan') {
      onAddTask({
        patientId: addPatientId,
        title: addTitle.trim(),
        category: addTaskCategory,
        dueDate: selectedDate,
        dueTime: addTime || '09:00',
        priority: addTaskPriority,
        completed: false,
      });
    } else if (quickAddMode === 'nota') {
      onAddNote({
        patientId: addPatientId || undefined,
        date: selectedDate,
        category: addNoteCategory,
        title: addTitle.trim(),
        content: addContent.trim() || addTitle.trim(),
        verified: false,
        createdBy: 'Kakitangan Klinikal',
      });
    }

    setQuickAddMode(null);
    setAddTitle('');
    setAddContent('');
  };

  const startEditAppointment = (appt: Appointment) => {
    setEditingItem({ kind: 'appt', id: appt.id });
    setConfirmDelete(null);
    setEditPatientId(appt.patientId);
    setEditDate(appt.date);
    setEditTime(appt.time);
    setEditTitle(appt.purpose);
    setEditContent(appt.notes || '');
    setEditStatus(appt.status);
  };

  const startEditTask = (task: ClinicalTask) => {
    setEditingItem({ kind: 'task', id: task.id });
    setConfirmDelete(null);
    setEditPatientId(task.patientId);
    setEditDate(task.dueDate);
    setEditTime(task.dueTime || '09:00');
    setEditTitle(task.title);
    setEditContent(task.details || '');
    setEditTaskOrderedBy(task.orderedBy || '');
    setEditTaskCategory(task.category);
    setEditTaskPriority(task.priority);
  };

  const startEditNote = (note: ClinicalNote) => {
    setEditingItem({ kind: 'note', id: note.id });
    setConfirmDelete(null);
    setEditPatientId(note.patientId || '');
    setEditDate(note.date);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditNoteCategory(note.category);
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editTitle.trim()) return;

    if (editingItem.kind === 'appt') {
      onUpdateAppointment(editingItem.id, {
        patientId: editPatientId,
        date: editDate,
        time: editTime,
        purpose: editTitle.trim(),
        notes: editContent.trim() || undefined,
        status: editStatus,
      });
    } else if (editingItem.kind === 'task') {
      onUpdateTask(editingItem.id, {
        patientId: editPatientId,
        dueDate: editDate,
        dueTime: editTime,
        title: editTitle.trim(),
        details: editContent.trim() || undefined,
        orderedBy: editTaskOrderedBy.trim() || undefined,
        category: editTaskCategory,
        priority: editTaskPriority,
      });
    } else if (editingItem.kind === 'note') {
      onUpdateNote(editingItem.id, {
        patientId: editPatientId || undefined,
        date: editDate,
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editNoteCategory,
      });
    }
    setEditingItem(null);
  };

  const showSection = (section: Exclude<AgendaFilter, 'semua'>) =>
    agendaFilter === 'semua' || agendaFilter === section;

  const totalDayItems =
    agenda.appointments.length +
    agenda.tasks.length +
    agenda.notes.length +
    agenda.activeUrineWindows.length +
    agenda.urineRecords.length;

  return (
    <div className="space-y-6">
      {/* Main 12-col split: Left 5 cols = Monthly Calendar, Right 7 cols = Selected Date Agenda List */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Monthly Calendar Card (5 cols) */}
        <section
          aria-label="Kalendar bulanan klinik"
          className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5"
        >
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {getMonthTitleMY(viewYear, viewMonth)}
              </h1>
              <p className="text-xs text-slate-500">
                Pilih tarikh untuk mengurus tugasan, temujanji dan nota.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleJumpToday}
                className="px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                aria-label="Bulan sebelumnya"
                className="p-1.5 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                aria-label="Bulan seterusnya"
                className="p-1.5 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mt-4 mb-1.5 text-center">
            {WEEKDAY_LABELS_MY.map((day) => (
              <div key={day} className="text-xs font-semibold text-slate-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Grid tarikh bulanan">
            {calendarCells.map((cell) => {
              const counts = dayCountsMap.get(cell.dateIso);
              const isSelected = cell.dateIso === selectedDate;
              const isToday = cell.dateIso === todayIso;
              const hasAppt = (counts?.appointmentsCount ?? 0) > 0;
              const hasTask = (counts?.tasksCount ?? 0) > 0;
              const hasNote = (counts?.notesCount ?? 0) > 0;
              const hasUrine = (counts?.urineWindowsCount ?? 0) > 0 || (counts?.urineRecordsCount ?? 0) > 0;
              const total = counts?.totalItems ?? 0;

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(cell.dateIso);
                    setEditingItem(null);
                    setConfirmDelete(null);
                  }}
                  aria-label={`Tarikh ${formatDateMY(cell.dateIso)}, ${total} perkara`}
                  aria-pressed={isSelected}
                  className={`min-h-[68px] p-1.5 rounded-lg border text-left flex flex-col justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                    isSelected
                      ? 'bg-teal-50 border-teal-700 ring-1 ring-teal-700'
                      : isToday
                      ? 'bg-slate-50 border-teal-400 hover:bg-slate-100'
                      : cell.isCurrentMonth
                      ? 'bg-white border-slate-200 hover:bg-slate-50'
                      : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold leading-none ${
                        isToday
                          ? 'px-1.5 py-0.5 rounded bg-teal-700 text-white'
                          : isSelected
                          ? 'text-teal-900'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                  </div>

                  {total > 0 && (
                    <div className="mt-1 space-y-0.5 text-[10px] leading-tight font-mono tabular-nums tracking-tight">
                      {(hasAppt || hasTask) && (
                        <div className="text-slate-700 whitespace-nowrap">
                          {hasAppt ? `${counts!.appointmentsCount}J` : ''}
                          {hasAppt && hasTask ? ' ' : ''}
                          {hasTask ? `${counts!.tasksCount}T` : ''}
                        </div>
                      )}
                      {(hasNote || hasUrine) && (
                        <div className="text-amber-700 whitespace-nowrap">
                          {hasNote ? `${counts!.notesCount}N` : ''}
                          {hasNote && hasUrine ? ' ' : ''}
                          {hasUrine ? (
                            <>
                              <span className="sm:hidden">Ur</span>
                              <span className="hidden sm:inline">Urin</span>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Concise Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Petunjuk kalendar:</span>
            <span className="font-mono text-slate-700">J = Temujanji</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-700">T = Tugasan</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-700">N = Nota</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-700">Urin = Julat Protokol</span>
          </div>
        </section>

        {/* Selected Date Agenda Panel (7 cols) */}
        <section
          aria-label="Senarai aktiviti tarikh dipilih"
          className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
        >
          {/* Selected Date Header & Quick Add Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="text-xs font-medium text-teal-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Jadual & Rekod Tarikh Dipilih</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {formatDateMY(selectedDate)}
                {selectedDate === todayIso ? ' (Hari Ini)' : ''}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {agenda.appointments.length} temujanji · {agenda.tasks.length} tugasan ·{' '}
                {agenda.notes.length} nota · {agenda.activeUrineWindows.length} julat urin
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openQuickAdd('temujanji')}
                className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  quickAddMode === 'temujanji'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Temujanji
              </button>
              <button
                type="button"
                onClick={() => openQuickAdd('tugasan')}
                className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  quickAddMode === 'tugasan'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Tugasan
              </button>
              <button
                type="button"
                onClick={() => openQuickAdd('nota')}
                className={`inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  quickAddMode === 'nota'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Nota
              </button>
            </div>
          </div>

          {/* Inline Quick Add Form for Selected Date */}
          {quickAddMode && (
            <form
              onSubmit={handleQuickAddSubmit}
              aria-label={`Borang tambah ${quickAddMode} pada ${formatDateMY(selectedDate)}`}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {quickAddMode === 'temujanji'
                    ? `Tambah Temujanji (${formatDateMY(selectedDate)})`
                    : quickAddMode === 'tugasan'
                    ? `Tambah Tugasan (${formatDateMY(selectedDate)})`
                    : `Tambah Nota Klinikal (${formatDateMY(selectedDate)})`}
                </h3>
                <button
                  type="button"
                  onClick={() => setQuickAddMode(null)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Tutup
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cal-add-patient" className="block text-xs font-medium text-slate-700 mb-1">
                    {quickAddMode === 'nota' ? 'Pesakit Berkaitan (Pilihan)' : 'Pesakit'}
                  </label>
                  <select
                    id="cal-add-patient"
                    value={addPatientId}
                    onChange={(e) => setAddPatientId(e.target.value)}
                    className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {quickAddMode === 'nota' && <option value="">Nota Am Klinik</option>}
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.mrn})
                      </option>
                    ))}
                  </select>
                </div>

                {quickAddMode !== 'nota' ? (
                  <div>
                    <label htmlFor="cal-add-time" className="block text-xs font-medium text-slate-700 mb-1">
                      Masa
                    </label>
                    <input
                      id="cal-add-time"
                      type="time"
                      value={addTime}
                      onChange={(e) => setAddTime(e.target.value)}
                      className="w-full min-h-[38px] px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="cal-add-note-cat" className="block text-xs font-medium text-slate-700 mb-1">
                      Kategori Nota
                    </label>
                    <select
                      id="cal-add-note-cat"
                      value={addNoteCategory}
                      onChange={(e) => setAddNoteCategory(e.target.value as NoteCategory)}
                      className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {Object.entries(NOTE_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="cal-add-title" className="block text-xs font-medium text-slate-700 mb-1">
                  {quickAddMode === 'temujanji'
                    ? 'Tujuan Temujanji'
                    : quickAddMode === 'tugasan'
                    ? 'Penerangan Tugasan'
                    : 'Tajuk Nota'}
                </label>
                <input
                  id="cal-add-title"
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder={
                    quickAddMode === 'temujanji'
                      ? 'Cth: Semakan dos & kaunseling'
                      : quickAddMode === 'tugasan'
                      ? 'Cth: Periksa tekanan darah sebelum dos'
                      : 'Cth: Pesakit maklumkan perubahan jadual kerja'
                  }
                  className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              {quickAddMode === 'tugasan' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cal-add-task-cat" className="block text-xs font-medium text-slate-700 mb-1">
                      Kategori Tugasan
                    </label>
                    <select
                      id="cal-add-task-cat"
                      value={addTaskCategory}
                      onChange={(e) => setAddTaskCategory(e.target.value as TaskCategory)}
                      className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {Object.entries(TASK_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cal-add-task-prio" className="block text-xs font-medium text-slate-700 mb-1">
                      Keutamaan
                    </label>
                    <select
                      id="cal-add-task-prio"
                      value={addTaskPriority}
                      onChange={(e) => setAddTaskPriority(e.target.value as TaskPriority)}
                      className="w-full min-h-[38px] px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(quickAddMode === 'temujanji' || quickAddMode === 'nota') && (
                <div>
                  <label htmlFor="cal-add-content" className="block text-xs font-medium text-slate-700 mb-1">
                    {quickAddMode === 'temujanji' ? 'Catatan Tambahan (Pilihan)' : 'Kandungan Nota'}
                  </label>
                  <textarea
                    id="cal-add-content"
                    rows={2}
                    value={addContent}
                    onChange={(e) => setAddContent(e.target.value)}
                    placeholder="Masukkan perincian untuk rujukan kakitangan..."
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              )}

              {addError && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {addError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
                >
                  Simpan pada Tarikh Ini
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAddMode(null)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Segmented Agenda Filter */}
          <div
            role="group"
            aria-label="Tapis senarai tarikh dipilih"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit"
          >
            {(
              [
                { key: 'semua', label: 'Semua' },
                { key: 'temujanji', label: `Temujanji (${agenda.appointments.length})` },
                { key: 'tugasan', label: `Tugasan (${agenda.tasks.length})` },
                { key: 'nota', label: `Nota (${agenda.notes.length})` },
                { key: 'urin', label: `Urin (${agenda.activeUrineWindows.length + agenda.urineRecords.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setAgendaFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  agendaFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Empty Day State */}
          {totalDayItems === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl">
              <p className="text-sm font-medium text-slate-700">
                Tiada temujanji, tugasan atau nota direkodkan pada {formatDateMY(selectedDate)}.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan butang + Temujanji, + Tugasan atau + Nota di atas untuk menjadualkan aktiviti.
              </p>
            </div>
          ) : (
            <div className="space-y-6" data-testid="selected-date-agenda">
              {/* 1. Appointments Section */}
              {showSection('temujanji') && agenda.appointments.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                    Temujanji Pesakit ({agenda.appointments.length})
                  </h3>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {agenda.appointments.map((appt) => {
                      const isEditing =
                        editingItem?.kind === 'appt' && editingItem.id === appt.id;
                      const isConfirmDel =
                        confirmDelete?.kind === 'appt' && confirmDelete.id === appt.id;

                      return (
                        <li key={appt.id} className="p-4 space-y-3">
                          {isEditing ? (
                            <form onSubmit={saveEdit} className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <input
                                  type="date"
                                  aria-label="Tarikh temujanji"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                                />
                                <input
                                  type="time"
                                  aria-label="Masa temujanji"
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                                />
                                <select
                                  aria-label="Status temujanji"
                                  value={editStatus}
                                  onChange={(e) =>
                                    setEditStatus(e.target.value as AppointmentStatus)
                                  }
                                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                                >
                                  {Object.entries(APPOINTMENT_STATUS_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="text"
                                aria-label="Tujuan temujanji"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <input
                                type="text"
                                aria-label="Catatan temujanji"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="Catatan temujanji..."
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
                                >
                                  Simpan Perubahan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                  Batal
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-900">
                                    <span>{appt.purpose}</span>
                                    <span aria-hidden="true" className="text-slate-300">
                                      ·
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onOpenPatientSession(appt.patientId)}
                                      className="text-teal-700 hover:underline font-medium"
                                    >
                                      {appt.patientName}
                                    </button>
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 font-mono tabular-nums">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3" aria-hidden="true" />
                                      {appt.time}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>{appt.mrn}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>Dos {appt.doseMg} mg</span>
                                  </div>
                                  {appt.notes && (
                                    <p className="mt-1 text-xs text-slate-600">{appt.notes}</p>
                                  )}
                                </div>

                                <span
                                  className={`text-xs font-semibold whitespace-nowrap ${
                                    appt.status === 'hadir'
                                      ? 'text-emerald-700'
                                      : appt.status === 'tidak_hadir'
                                      ? 'text-red-700'
                                      : appt.status === 'ditunda'
                                      ? 'text-slate-600'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {APPOINTMENT_STATUS_LABELS[appt.status]}
                                </span>
                              </div>

                              {/* Verification, Edit, Delete Controls */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateAppointment(appt.id, { status: 'hadir' })
                                    }
                                    aria-label={`Sahkan hadir untuk ${appt.patientName}`}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                                      appt.status === 'hadir'
                                        ? 'bg-emerald-700 text-white border-emerald-700'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                                    }`}
                                  >
                                    <UserCheck className="w-3 h-3" aria-hidden="true" />
                                    Sahkan Hadir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateAppointment(appt.id, { status: 'tidak_hadir' })
                                    }
                                    aria-label={`Tandakan tidak hadir untuk ${appt.patientName}`}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                                      appt.status === 'tidak_hadir'
                                        ? 'bg-red-700 text-white border-red-700'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-800'
                                    }`}
                                  >
                                    <UserX className="w-3 h-3" aria-hidden="true" />
                                    Tidak Hadir
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {isConfirmDel ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onDeleteAppointment(appt.id);
                                          setConfirmDelete(null);
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 whitespace-nowrap"
                                      >
                                        Ya, Padam
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDelete(null)}
                                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditAppointment(appt)}
                                        aria-label={`Edit temujanji ${appt.purpose}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 whitespace-nowrap"
                                      >
                                        <Edit3 className="w-3 h-3" aria-hidden="true" />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDelete({ kind: 'appt', id: appt.id })
                                        }
                                        aria-label={`Padam temujanji ${appt.purpose}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 whitespace-nowrap"
                                      >
                                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                                        Padam
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 2. Clinical Tasks Section */}
              {showSection('tugasan') && agenda.tasks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                    Tugasan Kakitangan ({agenda.tasks.length})
                  </h3>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {agenda.tasks.map((task) => {
                      const isEditing =
                        editingItem?.kind === 'task' && editingItem.id === task.id;
                      const isConfirmDel =
                        confirmDelete?.kind === 'task' && confirmDelete.id === task.id;

                      return (
                        <li key={task.id} className="p-4 space-y-3">
                          {isEditing ? (
                            <form onSubmit={saveEdit} className="space-y-3">
                              <input
                                type="text"
                                aria-label="Penerangan tugasan"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <textarea
                                rows={2}
                                aria-label="Butiran nota atau arahan"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="Butiran nota perubatan atau arahan pegawai perubatan..."
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <input
                                type="text"
                                aria-label="Pegawai atau petugas"
                                value={editTaskOrderedBy}
                                onChange={(e) => setEditTaskOrderedBy(e.target.value)}
                                placeholder="Pegawai / Petugas (cth: Dr. Hakimah Idris)"
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <input
                                  type="date"
                                  aria-label="Tarikh tugasan"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                                />
                                <input
                                  type="time"
                                  aria-label="Masa tugasan"
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                                />
                                <select
                                  aria-label="Kategori tugasan"
                                  value={editTaskCategory}
                                  onChange={(e) =>
                                    setEditTaskCategory(e.target.value as TaskCategory)
                                  }
                                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                                >
                                  {Object.entries(TASK_CATEGORY_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  aria-label="Keutamaan tugasan"
                                  value={editTaskPriority}
                                  onChange={(e) =>
                                    setEditTaskPriority(e.target.value as TaskPriority)
                                  }
                                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                                >
                                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
                                >
                                  Simpan Perubahan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                  Batal
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  {(task.entryType || task.orderedBy) && (
                                    <div className="text-xs font-medium text-teal-800 mb-0.5">
                                      {task.entryType
                                        ? MANUAL_ENTRY_TYPE_LABELS[task.entryType]
                                        : 'Tugasan Klinikal'}
                                      {task.orderedBy ? ` · ${task.orderedBy}` : ''}
                                    </div>
                                  )}
                                  <div
                                    className={`text-sm font-semibold ${
                                      task.completed
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-900'
                                    }`}
                                  >
                                    {task.title}
                                  </div>
                                  {task.details && (
                                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                                      {task.details}
                                    </p>
                                  )}
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums">
                                    <span>{task.patientName}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{TASK_CATEGORY_LABELS[task.category]}</span>
                                    {task.dueTime && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="font-mono">{task.dueTime}</span>
                                      </>
                                    )}
                                    <span aria-hidden="true">·</span>
                                    <span
                                      className={
                                        task.priority === 'segera'
                                          ? 'text-red-700 font-medium'
                                          : 'text-slate-600'
                                      }
                                    >
                                      {PRIORITY_LABELS[task.priority]}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-semibold whitespace-nowrap ${
                                    task.completed ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {task.completed ? 'Telah Dilaksanakan' : 'Belum Selesai'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => onToggleTask(task.id)}
                                  aria-pressed={task.completed}
                                  aria-label={`Sahkan perlaksanaan tugasan ${task.title}`}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                                    task.completed
                                      ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                                  }`}
                                >
                                  <Check className="w-3 h-3" aria-hidden="true" />
                                  {task.completed ? 'Disahkan Selesai' : 'Sahkan Selesai'}
                                </button>

                                <div className="flex items-center gap-1.5">
                                  {isConfirmDel ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onDeleteTask(task.id);
                                          setConfirmDelete(null);
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 whitespace-nowrap"
                                      >
                                        Ya, Padam
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDelete(null)}
                                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditTask(task)}
                                        aria-label={`Edit tugasan ${task.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 whitespace-nowrap"
                                      >
                                        <Edit3 className="w-3 h-3" aria-hidden="true" />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDelete({ kind: 'task', id: task.id })
                                        }
                                        aria-label={`Padam tugasan ${task.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 whitespace-nowrap"
                                      >
                                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                                        Padam
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 3. Clinical Notes Section */}
              {showSection('nota') && agenda.notes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                    Nota Klinikal & Peringatan ({agenda.notes.length})
                  </h3>
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {agenda.notes.map((note) => {
                      const isEditing =
                        editingItem?.kind === 'note' && editingItem.id === note.id;
                      const isConfirmDel =
                        confirmDelete?.kind === 'note' && confirmDelete.id === note.id;

                      return (
                        <li key={note.id} className="p-4 space-y-3">
                          {isEditing ? (
                            <form onSubmit={saveEdit} className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <input
                                  type="date"
                                  aria-label="Tarikh nota"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                                />
                                <select
                                  aria-label="Kategori nota"
                                  value={editNoteCategory}
                                  onChange={(e) =>
                                    setEditNoteCategory(e.target.value as NoteCategory)
                                  }
                                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                                >
                                  {Object.entries(NOTE_CATEGORY_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="text"
                                aria-label="Tajuk nota"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <textarea
                                rows={2}
                                aria-label="Kandungan nota"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
                                >
                                  Simpan Perubahan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                  Batal
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                    <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                                    <span>{note.title}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-700 leading-relaxed">
                                    {note.content}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                                    <span>{NOTE_CATEGORY_LABELS[note.category]}</span>
                                    {note.patientName && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span>
                                          {note.patientName} ({note.mrn})
                                        </span>
                                      </>
                                    )}
                                    <span aria-hidden="true">·</span>
                                    <span>Oleh {note.createdBy}</span>
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-semibold whitespace-nowrap ${
                                    note.verified ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {note.verified ? 'Disahkan Disemak' : 'Belum Disemak'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => onToggleNoteVerified(note.id)}
                                  aria-pressed={note.verified}
                                  aria-label={`Sahkan semakan nota ${note.title}`}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                                    note.verified
                                      ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                                  }`}
                                >
                                  <Check className="w-3 h-3" aria-hidden="true" />
                                  {note.verified ? 'Disemak' : 'Sahkan Disemak'}
                                </button>

                                <div className="flex items-center gap-1.5">
                                  {isConfirmDel ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onDeleteNote(note.id);
                                          setConfirmDelete(null);
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 whitespace-nowrap"
                                      >
                                        Ya, Padam
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDelete(null)}
                                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditNote(note)}
                                        aria-label={`Edit nota ${note.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 whitespace-nowrap"
                                      >
                                        <Edit3 className="w-3 h-3" aria-hidden="true" />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDelete({ kind: 'note', id: note.id })
                                        }
                                        aria-label={`Padam nota ${note.title}`}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 whitespace-nowrap"
                                      >
                                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                                        Padam
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* 4. Urine Windows & Records on Selected Date */}
              {showSection('urin') &&
                (agenda.activeUrineWindows.length > 0 || agenda.urineRecords.length > 0) && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                      Saringan & Rekod Ujian Urin Protokol
                    </h3>
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {agenda.activeUrineWindows.map(({ patient, window }) => (
                        <li
                          key={`win-${patient.id}`}
                          className="p-4 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                              <FlaskConical
                                className="w-3.5 h-3.5 text-amber-700 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Julat Ujian Urin · {patient.name}</span>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                              {patient.mrn} · Julat: {formatDateMY(window.windowStart)} –{' '}
                              {formatDateMY(window.windowEnd)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenPatientUrine(patient.id)}
                            className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 whitespace-nowrap"
                          >
                            Rekod Ujian Urin
                          </button>
                        </li>
                      ))}

                      {agenda.urineRecords.map((rec) => (
                        <li key={rec.id} className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              Keputusan Urin · {rec.patientName}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                rec.overallStatus === 'patuh'
                                  ? 'text-emerald-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {rec.overallStatus === 'patuh' ? 'Patuh Rawatan' : 'Perlu Perhatian'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">{rec.clinicalNote}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  ClipboardPlus,
  FileBarChart2,
  FlaskConical,
  HeartHandshake,
  LogOut,
  Menu,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CalendarDashboardView } from './components/CalendarDashboardView';
import { ClinicalSessionView } from './components/ClinicalSessionView';
import { DaftarPesakitView } from './components/DaftarPesakitView';
import { DailySummaryView } from './components/DailySummaryView';
import { FrontpageEntryView } from './components/FrontpageEntryView';
import { ManualTaskModuleView } from './components/ManualTaskModuleView';
import { OscaCenterView } from './components/OscaCenterView';
import { PatientsProtocolView } from './components/PatientsProtocolView';
import { PushNotificationsPanel } from './components/PushNotificationsPanel';
import { UrineRecordsView } from './components/UrineRecordsView';
import {
  type ClinicalStoreState,
  createDefaultSeedNotes,
  createDefaultSeedOscaRecords,
  createInitialClinicalState,
  getLocalTodayISO,
} from './data/seedData';
import type {
  Appointment,
  AppointmentStatus,
  ClinicalNote,
  ClinicalTask,
  DispensingMode,
  OscaInterventionRecord,
  Patient,
  ProtocolPhase,
  PushSettings,
  UrineTestRecord,
} from './types/clinical';
import {
  calculateUrineTestWindow,
  evaluatePeriodicReminders,
  formatDateMY,
  generateDefaultProtocolTasks,
  PROTOCOL_PRESETS,
} from './utils/methadoneProtocol';
import { SESSION_ENTRY_KEY, shouldStartEntered } from './utils/entrySession';

type ActiveTab =
  | 'dashboard'
  | 'tugasan_manual'
  | 'sesi'
  | 'urin'
  | 'osca'
  | 'daftar_pesakit'
  | 'pesakit'
  | 'laporan';

const STORAGE_KEY = 'klinik_metadon_state_v1';

const TAB_BREADCRUMBS: Record<ActiveTab, string> = {
  dashboard: 'Dashboard Kalendar',
  tugasan_manual: 'Tugasan Manual',
  sesi: 'Sesi Klinikal',
  urin: 'Ujian Urin',
  osca: 'OSCA (One Stop Center)',
  daftar_pesakit: 'Daftar Pesakit Baharu',
  pesakit: 'Pesakit & Protokol',
  laporan: 'Laporan Harian',
};

function loadStoredState(todayIso: string): ClinicalStoreState {
  if (typeof window === 'undefined') {
    return createInitialClinicalState(todayIso);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialClinicalState(todayIso);
    const parsed = JSON.parse(raw) as ClinicalStoreState;
    if (!parsed || !Array.isArray(parsed.patients) || parsed.patients.length === 0) {
      return createInitialClinicalState(todayIso);
    }
    return {
      ...parsed,
      notes: Array.isArray(parsed.notes)
        ? parsed.notes
        : createDefaultSeedNotes(todayIso),
      oscaRecords: Array.isArray(parsed.oscaRecords)
        ? parsed.oscaRecords
        : createDefaultSeedOscaRecords(todayIso),
    };
  } catch {
    return createInitialClinicalState(todayIso);
  }
}

function playGentleChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio playback may be blocked prior to user gesture
  }
}

export default function App() {
  const todayIso = useMemo(() => getLocalTodayISO(), []);
  const [isEntered, setIsEntered] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return shouldStartEntered(
        window.location.search,
        window.sessionStorage.getItem(SESSION_ENTRY_KEY)
      );
    } catch {
      return shouldStartEntered(window.location.search, null);
    }
  });
  const [store, setStore] = useState<ClinicalStoreState>(() => loadStoredState(todayIso));
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pushDrawerOpen, setPushDrawerOpen] = useState(false);
  const [openRegisterOnPatientsTab, setOpenRegisterOnPatientsTab] = useState(false);
  const [calendarFocus, setCalendarFocus] = useState<
    { dateIso: string; nonce: number } | undefined
  >(undefined);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);
  const [livePushToast, setLivePushToast] = useState<{
    title: string;
    message: string;
    timestamp: string;
  } | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota errors
    }
  }, [store]);

  const activePatient = useMemo(
    () =>
      store.patients.find((p) => p.id === store.activePatientId) ??
      store.patients[0],
    [store.patients, store.activePatientId]
  );

  const computedAlerts = useMemo(() => {
    const raw = evaluatePeriodicReminders(
      store.patients,
      store.appointments,
      store.tasks,
      todayIso
    );
    return raw.map((a) => ({
      ...a,
      acknowledged: acknowledgedIds.includes(a.id),
    }));
  }, [store.patients, store.appointments, store.tasks, todayIso, acknowledgedIds]);

  const unacknowledgedCount = useMemo(
    () => computedAlerts.filter((a) => !a.acknowledged).length,
    [computedAlerts]
  );

  const triggerPeriodicPush = useCallback(
    (manual = false) => {
      const pending = computedAlerts.filter((a) => !a.acknowledged);
      if (pending.length === 0 && !manual) return;

      const timeStr = new Date().toTimeString().slice(0, 5);
      const top = pending[0];
      const title =
        pending.length > 0
          ? `Peringatan Klinikal (${pending.length} Perkara)`
          : 'Peringatan Berkala Klinik Metadon';
      const body = top
        ? `${top.title} — ${top.detail}`
        : 'Tiada tugasan atau temujanji tertunggak pada masa ini.';

      setLivePushToast({
        title,
        message: body,
        timestamp: timeStr,
      });

      setStore((prev) => ({
        ...prev,
        pushSettings: {
          ...prev.pushSettings,
          lastTriggeredAt: `${formatDateMY(todayIso)} · ${timeStr}`,
        },
      }));

      if (store.pushSettings.soundEnabled) {
        playGentleChime();
      }

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(title, { body });
        } catch {
          // Ignore browser Notification constructor restrictions
        }
      }
    },
    [computedAlerts, store.pushSettings.soundEnabled, todayIso]
  );

  // Periodic push scheduler (active only after entering main dashboard)
  useEffect(() => {
    if (!isEntered || !store.pushSettings.enabled) return;
    const ms = store.pushSettings.intervalMinutes * 60 * 1000;
    const id = window.setInterval(() => {
      triggerPeriodicPush(false);
    }, ms);
    return () => window.clearInterval(id);
  }, [isEntered, store.pushSettings.enabled, store.pushSettings.intervalMinutes, triggerPeriodicPush]);

  const handleEnterSystem = () => {
    setIsEntered(true);
    setActiveTab('dashboard');
    try {
      window.sessionStorage.setItem(SESSION_ENTRY_KEY, 'true');
    } catch {
      // Ignore storage restrictions
    }
  };

  const handleLogout = () => {
    setIsEntered(false);
    setMobileMenuOpen(false);
    setPushDrawerOpen(false);
    setLivePushToast(null);
    try {
      window.sessionStorage.removeItem(SESSION_ENTRY_KEY);
    } catch {
      // Ignore storage restrictions
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStore((prev) => ({
        ...prev,
        pushSettings: { ...prev.pushSettings, browserPermission: 'unsupported' },
      }));
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setStore((prev) => ({
        ...prev,
        pushSettings: { ...prev.pushSettings, browserPermission: perm },
      }));
    } catch {
      // Ignore permission prompt errors
    }
  };

  const handleToggleTask = (taskId: string) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          completedBy: nextCompleted ? 'Kakitangan Klinikal' : undefined,
        };
      }),
    }));
  };

  const handleAddTask = (taskInput: Omit<ClinicalTask, 'id'>) => {
    const newTask: ClinicalTask = {
      ...taskInput,
      id: `task-${Date.now()}`,
    };
    setStore((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  };

  const handleAddTaskBatch = (taskInputs: Omit<ClinicalTask, 'id'>[]) => {
    const base = Date.now();
    const newTasks: ClinicalTask[] = taskInputs.map((item, idx) => ({
      ...item,
      id: `task-${base}-${idx}`,
    }));
    setStore((prev) => ({
      ...prev,
      tasks: [...newTasks, ...prev.tasks],
    }));
  };

  const handleUpdateTask = (taskId: string, patch: Partial<Omit<ClinicalTask, 'id'>>) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  };

  const handleAddAppointment = (apptInput: Omit<Appointment, 'id'>) => {
    const newAppt: Appointment = {
      ...apptInput,
      id: `appt-${Date.now()}`,
    };
    setStore((prev) => ({
      ...prev,
      appointments: [newAppt, ...prev.appointments],
    }));
  };

  const handleUpdateAppointment = (
    appointmentId: string,
    patch: Partial<Omit<Appointment, 'id'>>
  ) => {
    setStore((prev) => ({
      ...prev,
      appointments: prev.appointments.map((a) =>
        a.id === appointmentId ? { ...a, ...patch } : a
      ),
    }));
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    setStore((prev) => ({
      ...prev,
      appointments: prev.appointments.filter((a) => a.id !== appointmentId),
    }));
  };

  const handleAddNote = (noteInput: Omit<ClinicalNote, 'id'>) => {
    const newNote: ClinicalNote = {
      ...noteInput,
      id: `note-${Date.now()}`,
    };
    setStore((prev) => ({
      ...prev,
      notes: [newNote, ...prev.notes],
    }));
  };

  const handleUpdateNote = (noteId: string, patch: Partial<Omit<ClinicalNote, 'id'>>) => {
    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)),
    }));
  };

  const handleToggleNoteVerified = (noteId: string) => {
    setStore((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => {
        if (n.id !== noteId) return n;
        const nextVerified = !n.verified;
        return {
          ...n,
          verified: nextVerified,
          verifiedAt: nextVerified ? new Date().toISOString() : undefined,
          verifiedBy: nextVerified ? 'Kakitangan Klinikal' : undefined,
        };
      }),
    }));
  };

  const handleDeleteNote = (noteId: string) => {
    setStore((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== noteId),
    }));
  };

  const handleUpdateAppointmentStatus = (
    appointmentId: string,
    status: AppointmentStatus
  ) => {
    setStore((prev) => ({
      ...prev,
      appointments: prev.appointments.map((a) =>
        a.id === appointmentId ? { ...a, status } : a
      ),
    }));
  };

  const handleScheduleNextAppointment = (
    patientId: string,
    date: string,
    time: string,
    purpose: string
  ) => {
    const newApptId = `appt-${Date.now()}`;
    setStore((prev) => ({
      ...prev,
      patients: prev.patients.map((p) =>
        p.id === patientId
          ? { ...p, nextAppointmentDate: date, nextAppointmentTime: time }
          : p
      ),
      appointments: [
        {
          id: newApptId,
          patientId,
          date,
          time,
          purpose,
          status: 'dijadualkan',
        },
        ...prev.appointments,
      ],
    }));
  };

  const handleAddUrineRecord = (recordInput: Omit<UrineTestRecord, 'id'>) => {
    const newRecord: UrineTestRecord = {
      ...recordInput,
      id: `urin-${Date.now()}`,
    };
    setStore((prev) => ({
      ...prev,
      urineRecords: [newRecord, ...prev.urineRecords],
      patients: prev.patients.map((p) => {
        if (p.id !== recordInput.patientId) return p;
        const shouldUpdateLast =
          !p.lastUrineTestDate || recordInput.testDate >= p.lastUrineTestDate;
        return shouldUpdateLast
          ? { ...p, lastUrineTestDate: recordInput.testDate }
          : p;
      }),
      // Automatically mark matching urine task completed if any for that patient today
      tasks: prev.tasks.map((t) =>
        t.patientId === recordInput.patientId &&
        t.category === 'urin' &&
        !t.completed &&
        t.dueDate === recordInput.testDate
          ? {
              ...t,
              completed: true,
              completedAt: new Date().toISOString(),
              completedBy: recordInput.recordedBy,
            }
          : t
      ),
    }));
  };

  const handleRegisterPatient = (
    patientInput: Omit<Patient, 'id'>,
    enrollInOsca = false
  ): string => {
    const ts = Date.now();
    const newId = `pat-${ts}`;
    const newPatient: Patient = {
      ...patientInput,
      id: newId,
    };
    const defaultTasks = generateDefaultProtocolTasks(
      newPatient,
      newPatient.nextAppointmentDate
    ).map((t, idx) => ({
      ...t,
      id: `task-${ts}-${idx}`,
    }));

    const initialOscaRecord: OscaInterventionRecord | null = enrollInOsca
      ? {
          id: `osca-${ts}`,
          patientId: newId,
          serviceDomain: 'saringan_kesihatan',
          riskLevel: newPatient.phase === 'induksi' ? 'pemantauan' : 'stabil',
          actionDate: newPatient.startDate,
          title: 'Orientasi Awal OSCA & Semakan Saringan Kesihatan',
          planNote: `Kemasukan baharu ${PROTOCOL_PRESETS[newPatient.phase].label} (${newPatient.doseMg} mg). Sahkan status ujian darah, urin, dan keperluan sokongan psikososial.`,
          agencyOrOfficer: newPatient.prescribingDoctor || 'Pasukan OSCA Klinik',
          status: 'aktif',
        }
      : null;

    setStore((prev) => ({
      ...prev,
      patients: [newPatient, ...prev.patients],
      activePatientId: newId,
      appointments: [
        {
          id: `appt-${ts}`,
          patientId: newId,
          date: newPatient.nextAppointmentDate,
          time: newPatient.nextAppointmentTime,
          purpose: `Temujanji Protokol (${PROTOCOL_PRESETS[newPatient.phase].label})`,
          status: 'dijadualkan',
        },
        ...prev.appointments,
      ],
      tasks: [...defaultTasks, ...prev.tasks],
      oscaRecords: initialOscaRecord ? [initialOscaRecord, ...prev.oscaRecords] : prev.oscaRecords,
    }));
    setOpenRegisterOnPatientsTab(false);
    return newId;
  };

  const handleUpdatePatientPhase = (
    patientId: string,
    phase: ProtocolPhase,
    doseMg: number,
    dispensingMode: DispensingMode
  ) => {
    const preset = PROTOCOL_PRESETS[phase];
    setStore((prev) => ({
      ...prev,
      patients: prev.patients.map((p) =>
        p.id === patientId
          ? {
              ...p,
              phase,
              doseMg,
              dispensingMode,
              urineIntervalDays: preset.urineIntervalDays,
              urineWindowDays: preset.urineWindowDays,
            }
          : p
      ),
    }));
  };

  const handleUpdatePushSettings = (next: Partial<PushSettings>) => {
    setStore((prev) => ({
      ...prev,
      pushSettings: { ...prev.pushSettings, ...next },
    }));
  };

  const handleAddOscaRecord = (
    recordInput: Omit<OscaInterventionRecord, 'id'>,
    syncToCalendar: boolean
  ) => {
    const ts = Date.now();
    const oscaId = `osca-${ts}`;
    const syncedTaskId = syncToCalendar ? `task-osca-${ts}` : undefined;

    const newOsca: OscaInterventionRecord = {
      ...recordInput,
      id: oscaId,
      syncedTaskId,
    };

    const syncedTask: ClinicalTask | null = syncToCalendar
      ? {
          id: syncedTaskId!,
          patientId: recordInput.patientId,
          entryType: 'tugasan',
          title: `[OSCA] ${recordInput.title}`,
          details: recordInput.planNote,
          orderedBy: recordInput.agencyOrOfficer,
          category:
            recordInput.serviceDomain === 'kaunseling_psikososial'
              ? 'kaunseling'
              : 'susulan',
          dueDate: recordInput.actionDate,
          dueTime: '10:00',
          priority:
            recordInput.riskLevel === 'tinggi'
              ? 'segera'
              : recordInput.riskLevel === 'pemantauan'
              ? 'penting'
              : 'biasa',
          completed: false,
        }
      : null;

    setStore((prev) => ({
      ...prev,
      oscaRecords: [newOsca, ...prev.oscaRecords],
      tasks: syncedTask ? [syncedTask, ...prev.tasks] : prev.tasks,
    }));
  };

  const handleToggleOscaStatus = (recordId: string) => {
    setStore((prev) => {
      const target = prev.oscaRecords.find((r) => r.id === recordId);
      const nextStatus: OscaInterventionRecord['status'] =
        target?.status === 'selesai' ? 'aktif' : 'selesai';
      return {
        ...prev,
        oscaRecords: prev.oscaRecords.map((r) =>
          r.id === recordId
            ? {
                ...r,
                status: nextStatus,
                completedAt: nextStatus === 'selesai' ? new Date().toISOString() : undefined,
              }
            : r
        ),
        tasks: target?.syncedTaskId
          ? prev.tasks.map((t) =>
              t.id === target.syncedTaskId
                ? {
                    ...t,
                    completed: nextStatus === 'selesai',
                    completedAt:
                      nextStatus === 'selesai' ? new Date().toISOString() : undefined,
                    completedBy:
                      nextStatus === 'selesai' ? 'Kakitangan OSCA' : undefined,
                  }
                : t
            )
          : prev.tasks,
      };
    });
  };

  const handleDeleteOscaRecord = (recordId: string) => {
    setStore((prev) => ({
      ...prev,
      oscaRecords: prev.oscaRecords.filter((r) => r.id !== recordId),
    }));
  };

  const frontpageCounts = useMemo(() => {
    const todayAppointmentsCount = store.appointments.filter((a) => a.date === todayIso).length;
    const pendingTasksCount = store.tasks.filter((t) => !t.completed).length;
    const activeUrineWindowsCount = store.patients.filter(
      (p) => calculateUrineTestWindow(p, todayIso).status === 'dalam_julat'
    ).length;
    return {
      todayAppointmentsCount,
      pendingTasksCount,
      activeUrineWindowsCount,
    };
  }, [store.appointments, store.tasks, store.patients, todayIso]);

  const navGroups: Array<{
    groupLabel: string;
    items: Array<{
      key: ActiveTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      count?: number;
    }>;
  }> = [
    {
      groupLabel: 'Operasi Harian',
      items: [
        { key: 'dashboard', label: 'Dashboard Kalendar', icon: CalendarDays },
        { key: 'sesi', label: 'Sesi Klinikal', icon: ClipboardList },
        {
          key: 'tugasan_manual',
          label: 'Tugasan Manual',
          icon: ClipboardPlus,
          count: frontpageCounts.pendingTasksCount,
        },
      ],
    },
    {
      groupLabel: 'Rawatan & Bersepadu',
      items: [
        {
          key: 'urin',
          label: 'Ujian Urin',
          icon: FlaskConical,
          count: frontpageCounts.activeUrineWindowsCount,
        },
        { key: 'osca', label: 'OSCA', icon: HeartHandshake },
        { key: 'daftar_pesakit', label: 'Daftar Pesakit', icon: UserPlus },
        { key: 'pesakit', label: 'Pesakit & Protokol', icon: Users },
      ],
    },
    {
      groupLabel: 'Dokumentasi',
      items: [{ key: 'laporan', label: 'Laporan Harian', icon: FileBarChart2 }],
    },
  ];

  if (!isEntered) {
    return (
      <FrontpageEntryView
        todayIso={todayIso}
        registeredPatientsCount={store.patients.length}
        todayAppointmentsCount={frontpageCounts.todayAppointmentsCount}
        pendingTasksCount={frontpageCounts.pendingTasksCount}
        activeUrineWindowsCount={frontpageCounts.activeUrineWindowsCount}
        onEnterSystem={handleEnterSystem}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar (256px) */}
      <aside
        aria-label="Navigasi utama klinik"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white border-r border-slate-200 no-print"
      >
        <div className="h-16 px-5 flex items-center border-b border-slate-200 shrink-0">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Klinik Metadon
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.groupLabel} className="space-y-1">
              <div className="px-3 pt-1 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {group.groupLabel}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setOpenRegisterOnPatientsTab(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span
                        className={`text-xs font-mono tabular-nums shrink-0 ${
                          active ? 'text-teal-700 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="text-xs text-slate-500 space-y-1">
            <div className="font-medium text-slate-700">Tarikh Klinikal</div>
            <div className="font-mono tabular-nums">{formatDateMY(todayIso)}</div>
            <div className="pt-0.5 text-slate-500 tabular-nums">
              {store.patients.length} pesakit berdaftar
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            data-testid="sidebar-logout-btn"
            className="w-full flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Log Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-slate-900/30 no-print">
          <div className="w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-slate-900">Klinik Metadon</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu navigasi"
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
              {navGroups.map((group) => (
                <div key={group.groupLabel} className="space-y-1">
                  <div className="px-3 pt-1 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {group.groupLabel}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.key);
                          setMobileMenuOpen(false);
                          setOpenRegisterOnPatientsTab(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                          active
                            ? 'bg-teal-50 text-teal-800'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {typeof item.count === 'number' && item.count > 0 && (
                          <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-3">
              <div className="text-xs text-slate-500 space-y-0.5">
                <div className="font-medium text-slate-700">Tarikh Klinikal</div>
                <div className="font-mono tabular-nums">{formatDateMY(todayIso)}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Log Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, max 2 actions on right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                Terapi Gantian Metadon
              </span>
              <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {TAB_BREADCRUMBS[activeTab]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setPushDrawerOpen(true)}
              aria-label={`Pemberitahuan push berkala (${unacknowledgedCount} aktif)`}
              className="inline-flex items-center gap-2 min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
              <span className="hidden sm:inline">Notifikasi Push</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                ({unacknowledgedCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('daftar_pesakit');
                setOpenRegisterOnPatientsTab(false);
              }}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Daftar Pesakit</span>
            </button>
          </div>
        </header>

        {/* Live Periodic Push Toast Banner */}
        {livePushToast && (
          <div
            role="status"
            aria-live="polite"
            className="mx-4 sm:mx-6 mt-4 bg-teal-900 text-white rounded-xl px-4 py-3 flex items-start justify-between gap-4 no-print"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Bell className="w-4 h-4 text-teal-200 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {livePushToast.title} ·{' '}
                  <span className="font-mono text-xs text-teal-200">
                    {livePushToast.timestamp}
                  </span>
                </div>
                <p className="text-xs text-teal-100 mt-0.5">{livePushToast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLivePushToast(null)}
              aria-label="Tutup pemberitahuan push semasa"
              className="p-1 text-teal-200 hover:text-white rounded shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <CalendarDashboardView
              todayIso={todayIso}
              patients={store.patients}
              appointments={store.appointments}
              tasks={store.tasks}
              notes={store.notes}
              urineRecords={store.urineRecords}
              onAddAppointment={handleAddAppointment}
              onUpdateAppointment={handleUpdateAppointment}
              onDeleteAppointment={handleDeleteAppointment}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onToggleNoteVerified={handleToggleNoteVerified}
              onDeleteNote={handleDeleteNote}
              onOpenPatientSession={(patientId) => {
                setStore((prev) => ({ ...prev, activePatientId: patientId }));
                setActiveTab('sesi');
              }}
              onOpenPatientUrine={(patientId) => {
                setStore((prev) => ({ ...prev, activePatientId: patientId }));
                setActiveTab('urin');
              }}
              focusedDate={calendarFocus}
            />
          )}

          {activeTab === 'tugasan_manual' && (
            <ManualTaskModuleView
              todayIso={todayIso}
              patients={store.patients}
              activePatientId={store.activePatientId}
              onSelectPatient={(id) =>
                setStore((prev) => ({ ...prev, activePatientId: id }))
              }
              tasks={store.tasks}
              onAddTaskBatch={handleAddTaskBatch}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onOpenDateInCalendar={(dateIso) => {
                setCalendarFocus({ dateIso, nonce: Date.now() });
                setActiveTab('dashboard');
              }}
            />
          )}

          {activeTab === 'sesi' && (
            <ClinicalSessionView
              todayIso={todayIso}
              patients={store.patients}
              activePatient={activePatient}
              onSelectPatient={(id) =>
                setStore((prev) => ({ ...prev, activePatientId: id }))
              }
              appointments={store.appointments}
              tasks={store.tasks}
              onToggleTask={handleToggleTask}
              onAddTask={handleAddTask}
              onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
              onScheduleNextAppointment={handleScheduleNextAppointment}
              onOpenUrineTab={() => setActiveTab('urin')}
              onOpenRegisterPatient={() => {
                setActiveTab('pesakit');
                setOpenRegisterOnPatientsTab(true);
              }}
            />
          )}

          {activeTab === 'urin' && (
            <UrineRecordsView
              todayIso={todayIso}
              patients={store.patients}
              activePatient={activePatient}
              onSelectPatient={(id) =>
                setStore((prev) => ({ ...prev, activePatientId: id }))
              }
              urineRecords={store.urineRecords}
              onAddUrineRecord={handleAddUrineRecord}
            />
          )}

          {activeTab === 'osca' && (
            <OscaCenterView
              todayIso={todayIso}
              patients={store.patients}
              activePatientId={store.activePatientId}
              onSelectPatient={(id) =>
                setStore((prev) => ({ ...prev, activePatientId: id }))
              }
              appointments={store.appointments}
              tasks={store.tasks}
              urineRecords={store.urineRecords}
              oscaRecords={store.oscaRecords}
              onAddOscaRecord={handleAddOscaRecord}
              onToggleOscaStatus={handleToggleOscaStatus}
              onDeleteOscaRecord={handleDeleteOscaRecord}
              onOpenPatientSession={(patientId) => {
                setStore((prev) => ({ ...prev, activePatientId: patientId }));
                setActiveTab('sesi');
              }}
              onOpenPatientUrine={(patientId) => {
                setStore((prev) => ({ ...prev, activePatientId: patientId }));
                setActiveTab('urin');
              }}
              onOpenDateInCalendar={(dateIso) => {
                setCalendarFocus({ dateIso, nonce: Date.now() });
                setActiveTab('dashboard');
              }}
            />
          )}

          {activeTab === 'daftar_pesakit' && (
            <DaftarPesakitView
              todayIso={todayIso}
              patientsCount={store.patients.length}
              onRegisterPatient={handleRegisterPatient}
              onOpenPatientSession={(patientId) => {
                setStore((prev) => ({ ...prev, activePatientId: patientId }));
                setActiveTab('sesi');
              }}
              onOpenRosterTab={() => setActiveTab('pesakit')}
            />
          )}

          {activeTab === 'pesakit' && (
            <PatientsProtocolView
              todayIso={todayIso}
              patients={store.patients}
              activePatientId={store.activePatientId}
              onSelectAndOpenSession={(id) => {
                setStore((prev) => ({ ...prev, activePatientId: id }));
                setActiveTab('sesi');
              }}
              onRegisterPatient={(patient) => {
                handleRegisterPatient(patient, false);
              }}
              onOpenDedicatedRegister={() => setActiveTab('daftar_pesakit')}
              onUpdatePatientPhase={handleUpdatePatientPhase}
              initialShowForm={openRegisterOnPatientsTab}
            />
          )}

          {activeTab === 'laporan' && (
            <DailySummaryView
              todayIso={todayIso}
              patients={store.patients}
              appointments={store.appointments}
              tasks={store.tasks}
              urineRecords={store.urineRecords}
            />
          )}
        </main>
      </div>

      {/* Periodic Push Notification Drawer */}
      <PushNotificationsPanel
        open={pushDrawerOpen}
        onClose={() => setPushDrawerOpen(false)}
        settings={store.pushSettings}
        onUpdateSettings={handleUpdatePushSettings}
        onRequestBrowserPermission={handleRequestBrowserPermission}
        onTriggerPushNow={() => triggerPeriodicPush(true)}
        alerts={computedAlerts}
        onAcknowledgeAlert={(alertId) =>
          setAcknowledgedIds((prev) => [...prev, alertId])
        }
        onSelectPatientFromAlert={(patientId) => {
          setStore((prev) => ({ ...prev, activePatientId: patientId }));
          setActiveTab('sesi');
        }}
      />
    </div>
  );
}

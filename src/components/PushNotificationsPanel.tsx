import React from 'react';
import { Bell, Check, Send, Volume2, VolumeX, X } from 'lucide-react';
import type { PushAlertItem, PushSettings } from '../types/clinical';

interface PushNotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  settings: PushSettings;
  onUpdateSettings: (next: Partial<PushSettings>) => void;
  onRequestBrowserPermission: () => void;
  onTriggerPushNow: () => void;
  alerts: PushAlertItem[];
  onAcknowledgeAlert: (alertId: string) => void;
  onSelectPatientFromAlert: (patientId: string) => void;
}

export const PushNotificationsPanel: React.FC<PushNotificationsPanelProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onRequestBrowserPermission,
  onTriggerPushNow,
  alerts,
  onAcknowledgeAlert,
  onSelectPatientFromAlert,
}) => {
  if (!open) return null;

  const activeAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Tetapan dan senarai pemberitahuan push berkala"
    >
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">
              Pemberitahuan Push Berkala
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel pemberitahuan"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Periodic Settings */}
          <section className="space-y-4 pb-5 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Aktifkan Peringatan Berkala
                </div>
                <div className="text-xs text-slate-500">
                  Menghantar peringatan temujanji, tugasan & julat urin secara automatik.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                onClick={() => onUpdateSettings({ enabled: !settings.enabled })}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  settings.enabled
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {settings.enabled ? 'Aktif' : 'Dimatikan'}
              </button>
            </div>

            <div>
              <label
                htmlFor="push-interval-select"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Kekerapan Pemberitahuan Berkala
              </label>
              <select
                id="push-interval-select"
                value={settings.intervalMinutes}
                onChange={(e) =>
                  onUpdateSettings({
                    intervalMinutes: Number(e.target.value) as PushSettings['intervalMinutes'],
                  })
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value={15}>Setiap 15 minit</option>
                <option value={30}>Setiap 30 minit</option>
                <option value={60}>Setiap 1 jam</option>
                <option value={120}>Setiap 2 jam</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRequestBrowserPermission}
                className="flex-1 min-h-[40px] px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                {settings.browserPermission === 'granted'
                  ? 'Notifikasi Pelayar: Dibenarkan'
                  : settings.browserPermission === 'denied'
                  ? 'Notifikasi Pelayar: Disekat'
                  : 'Benarkan Push Pelayar'}
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                aria-label={settings.soundEnabled ? 'Matikan bunyi amaran' : 'Aktifkan bunyi amaran'}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                {settings.soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    Bunyi Hidup
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    Senyap
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={onTriggerPushNow}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              Hantar Notifikasi Push Sekarang
            </button>

            {settings.lastTriggeredAt && (
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                Peringatan terakhir dihantar: {settings.lastTriggeredAt}
              </div>
            )}
          </section>

          {/* Active Reminder Queue */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Peringatan Aktif ({activeAlerts.length})
              </h3>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Semua peringatan semasa telah disahkan.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeAlerts.map((alert) => (
                  <li key={alert.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div
                          className={`text-xs font-semibold ${
                            alert.severity === 'segera'
                              ? 'text-red-700'
                              : alert.severity === 'amaran'
                              ? 'text-amber-700'
                              : 'text-teal-700'
                          }`}
                        >
                          {alert.severity === 'segera'
                            ? 'Tindakan Segera'
                            : alert.severity === 'amaran'
                            ? 'Peringatan Hari Ini'
                            : 'Makluman Protokol'}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-0.5">
                          {alert.title}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{alert.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPatientFromAlert(alert.patientId);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 whitespace-nowrap"
                      >
                        Buka Rekod Pesakit
                      </button>
                      <button
                        type="button"
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                      >
                        <Check className="w-3 h-3" aria-hidden="true" />
                        Sahkan
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

'use client';

import { useState } from 'react';

const SETTINGS = [
  { key: 'platform_fee_pct', label: 'Platform fee (%)', value: '10.00', type: 'number' },
  { key: 'activation_fee_cents', label: 'Activation fee (cents)', value: '80000', type: 'number' },
  { key: 'activation_sessions', label: 'Activation deduction sessions', value: '2', type: 'number' },
  { key: 'goodwill_threshold_sessions', label: 'Goodwill threshold (sessions)', value: '6', type: 'number' },
  { key: 'goodwill_fee_pct', label: 'Goodwill fee (%)', value: '8.00', type: 'number' },
  { key: 'deactivation_fee_pct', label: 'Deactivation fee (%)', value: '15.00', type: 'number' },
  { key: 'notice_period_days', label: 'Default notice period (days)', value: '30', type: 'number' },
  { key: 'settlement_auto_release_hours', label: 'Auto-release after (hours)', value: '48', type: 'number' },
];

const TOGGLES = [
  { key: 'auto_release_enabled', label: 'Automatic settlement release', value: true },
  { key: 'ai_photo_comparison', label: 'AI photo comparison', value: true },
  { key: 'ai_document_parsing', label: 'AI document parsing', value: true },
  { key: 'sms_otp_enabled', label: 'SMS OTP verification', value: true },
  { key: 'vetting_required', label: 'Require vetting before booking', value: true },
];

export function PlatformSettings() {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(SETTINGS.map((s) => [s.key, s.value]))
  );
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((t) => [t.key, t.value]))
  );
  const [saved, setSaved] = useState(false);

  function save() {
    // In production this would POST to /api/admin/settings
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Numeric settings */}
      <div className="card-white">
        <p className="text-xs font-semibold text-[#444] mb-4">Financial parameters</p>
        {SETTINGS.map((s) => (
          <div key={s.key} className="row-item text-xs mb-3">
            <label className="text-[#666] flex-1">{s.label}</label>
            <input
              type={s.type}
              step="any"
              className="input w-32 text-xs text-right"
              value={values[s.key]}
              onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {/* Feature toggles */}
      <div className="card-white">
        <p className="text-xs font-semibold text-[#444] mb-4">Feature flags</p>
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between py-2 border-b border-[#f0f0ee] last:border-0">
            <span className="text-xs text-[#555]">{t.label}</span>
            <button
              onClick={() => setToggles((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                toggles[t.key] ? 'bg-[#1d9e75]' : 'bg-[#ddd]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  toggles[t.key] ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button className="btn-primary text-xs px-5" onClick={save}>Save settings</button>
        {saved && <span className="text-xs text-[#1d9e75]">Saved successfully</span>}
      </div>

      {/* Danger zone */}
      <div className="card-white border border-red-100">
        <p className="text-xs font-semibold text-red-600 mb-3">Danger zone</p>
        <p className="text-xs text-[#888] mb-3">These actions affect the entire platform and cannot be undone.</p>
        <div className="flex gap-2">
          <button className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors">
            Trigger manual settlement run
          </button>
          <button className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors">
            Force auto-release now
          </button>
        </div>
      </div>
    </div>
  );
}

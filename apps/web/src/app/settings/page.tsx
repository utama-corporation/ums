"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/Card";

interface CompanyProfile {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
}

interface SecurityPolicy {
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  from: string;
}

interface EmailTemplate {
  notificationType: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  updatedAt: string | null;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  APPROVAL_REQUIRED: "Memo Perlu Persetujuan",
  MEMO_APPROVED: "Memo Disetujui",
  TASK_ASSIGNED: "Tugas Baru Ditugaskan",
  TASK_VERIFICATION_REQUESTED: "Tugas Menunggu Verifikasi",
  TASK_VERIFIED_COMPLETED: "Tugas Disetujui Selesai",
  TASK_REWORK_REQUESTED: "Tugas Perlu Direvisi",
  TASK_OVERDUE: "Tugas Terlambat",
};

const SAMPLE_VALUES: Record<string, string> = {
  title: "Contoh Judul Notifikasi",
  message: "Contoh isi pesan notifikasi.",
  memoTitle: "Permohonan Cuti Tahunan",
  memoNumber: "001/HR/VIII/2026",
  taskTitle: "Buat Laporan Bulanan",
  comment: "Mohon lengkapi data pendukung.",
};

function renderPreview(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => SAMPLE_VALUES[key] ?? `{{${key}}}`);
}

const TABS = [
  "Profil Perusahaan",
  "Penomoran Memo",
  "Email & SMTP",
  "Notifikasi",
  "Lampiran File",
  "Keamanan",
  "Backup & Restore",
  "Sistem",
];

function CompanyProfileTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", logoUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await apiClient<CompanyProfile>("/settings/company-profile");
    setLoading(false);
    if (res.success && res.data) {
      setProfile(res.data);
      setForm({
        name: res.data.name,
        address: res.data.address || "",
        phone: res.data.phone || "",
        email: res.data.email || "",
        logoUrl: res.data.logoUrl || "",
      });
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat profil perusahaan");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const payload = {
      name: form.name,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
      logoUrl: form.logoUrl || null,
    };
    const res = await apiClient("/settings/company-profile", { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      setSuccessMsg("Profil perusahaan berhasil disimpan.");
      load();
    } else {
      setErrorMsg(res.error?.message || "Gagal menyimpan profil perusahaan");
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;
  if (!profile) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{errorMsg}</div>;

  return (
    <form onSubmit={handleSave} className="space-y-3.5 max-w-xl">
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{errorMsg}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded border border-green-200">{successMsg}</div>}
      <div>
        <label htmlFor="cp-code" className="block text-xs font-bold mb-1.5">Kode</label>
        <input id="cp-code" value={profile.code} disabled className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm bg-slate-50 text-slate-500" />
      </div>
      <div>
        <label htmlFor="cp-name" className="block text-xs font-bold mb-1.5">Nama Perusahaan *</label>
        <input
          id="cp-name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="cp-phone" className="block text-xs font-bold mb-1.5">Telepon</label>
        <input
          id="cp-phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="cp-email" className="block text-xs font-bold mb-1.5">Email</label>
        <input
          id="cp-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="cp-address" className="block text-xs font-bold mb-1.5">Alamat</label>
        <textarea
          id="cp-address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          rows={3}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="cp-logo-url" className="block text-xs font-bold mb-1.5">URL Logo</label>
        <input
          id="cp-logo-url"
          value={form.logoUrl}
          onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
          placeholder="https://..."
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}

function SecurityTab() {
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [form, setForm] = useState({ accessTokenTtlMinutes: 15, refreshTokenTtlDays: 7 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await apiClient<SecurityPolicy>("/settings/security");
    setLoading(false);
    if (res.success && res.data) {
      setPolicy(res.data);
      setForm(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat kebijakan keamanan");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const res = await apiClient<SecurityPolicy>("/settings/security", { method: "PATCH", body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) {
      setSuccessMsg(res.message || "Kebijakan keamanan berhasil disimpan.");
      load();
    } else {
      setErrorMsg(res.error?.message || "Gagal menyimpan kebijakan keamanan");
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;
  if (!policy) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{errorMsg}</div>;

  return (
    <form onSubmit={handleSave} className="space-y-3.5 max-w-xl">
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{errorMsg}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded border border-green-200">{successMsg}</div>}
      <p className="text-xs text-slate-500">
        Mengatur masa berlaku token sesi. Perubahan hanya berlaku untuk sesi login baru — sesi yang sedang aktif tetap memakai masa berlaku
        lama sampai kedaluwarsa.
      </p>
      <div>
        <label htmlFor="sec-access-ttl" className="block text-xs font-bold mb-1.5">Masa Berlaku Access Token (menit) *</label>
        <input
          id="sec-access-ttl"
          required
          type="number"
          min={1}
          max={1440}
          value={form.accessTokenTtlMinutes}
          onChange={(e) => setForm({ ...form, accessTokenTtlMinutes: Number(e.target.value) })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
        <p className="text-xs text-slate-400 mt-1">1 - 1440 menit (maks. 24 jam)</p>
      </div>
      <div>
        <label htmlFor="sec-refresh-ttl" className="block text-xs font-bold mb-1.5">Masa Berlaku Sesi / Refresh Token (hari) *</label>
        <input
          id="sec-refresh-ttl"
          required
          type="number"
          min={1}
          max={90}
          value={form.refreshTokenTtlDays}
          onChange={(e) => setForm({ ...form, refreshTokenTtlDays: Number(e.target.value) })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
        <p className="text-xs text-slate-400 mt-1">1 - 90 hari</p>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}

function SmtpTab() {
  const [form, setForm] = useState<SmtpConfig>({ host: "", port: 587, secure: false, user: "", from: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await apiClient<SmtpConfig>("/settings/smtp");
    setLoading(false);
    if (res.success && res.data) {
      setForm({ ...res.data, user: res.data.user || "" });
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat konfigurasi SMTP");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const payload = { ...form, user: form.user || null };
    const res = await apiClient<SmtpConfig>("/settings/smtp", { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      setSuccessMsg(res.message || "Konfigurasi SMTP berhasil disimpan.");
      load();
    } else {
      setErrorMsg(res.error?.message || "Gagal menyimpan konfigurasi SMTP");
    }
  }

  async function handleTestEmail() {
    setTesting(true);
    setErrorMsg("");
    setSuccessMsg("");
    const res = await apiClient("/settings/smtp/test", { method: "POST" });
    setTesting(false);
    if (res.success) {
      setSuccessMsg(res.message || "Email test sedang dikirim.");
    } else {
      setErrorMsg(res.error?.message || "Gagal mengirim email test");
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <form onSubmit={handleSave} className="space-y-3.5 max-w-xl">
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{errorMsg}</div>}
      {successMsg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded border border-green-200">{successMsg}</div>}
      <p className="text-xs text-slate-500">
        Konfigurasi server SMTP untuk pengiriman email notifikasi. Password SMTP dikelola lewat environment variable server
        (<code>SMTP_PASS</code>) demi keamanan, bukan lewat form ini — hubungi admin infrastruktur untuk mengubahnya.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="smtp-host" className="block text-xs font-bold mb-1.5">SMTP Host *</label>
          <input
            id="smtp-host"
            required
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
            className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
            placeholder="smtp.gmail.com"
          />
        </div>
        <div>
          <label htmlFor="smtp-port" className="block text-xs font-bold mb-1.5">Port *</label>
          <input
            id="smtp-port"
            required
            type="number"
            min={1}
            max={65535}
            value={form.port}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
            className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} />
          Gunakan TLS implisit (SMTPS, umumnya port 465)
        </label>
      </div>
      <div>
        <label htmlFor="smtp-user" className="block text-xs font-bold mb-1.5">Username SMTP</label>
        <input
          id="smtp-user"
          value={form.user || ""}
          onChange={(e) => setForm({ ...form, user: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
          placeholder="Kosongkan jika server tidak butuh autentikasi"
        />
      </div>
      <div>
        <label htmlFor="smtp-from" className="block text-xs font-bold mb-1.5">Alamat Pengirim (From) *</label>
        <input
          id="smtp-from"
          required
          value={form.from}
          onChange={(e) => setForm({ ...form, from: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
          placeholder="noreply@utama.co.id"
        />
      </div>
      <div className="flex justify-between items-center pt-2">
        <button type="button" onClick={handleTestEmail} disabled={testing} className="border border-ums-border text-slate-700 font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
          {testing ? "Mengirim..." : "Kirim Email Test"}
        </button>
        <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}

function NotificationTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [form, setForm] = useState({ subject: "", bodyHtml: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await apiClient<EmailTemplate[]>("/email-templates");
    setLoading(false);
    if (res.success && res.data) {
      setTemplates(res.data);
      if (!selectedType && res.data.length > 0) {
        setSelectedType(res.data[0].notificationType);
        setForm({ subject: res.data[0].subject, bodyHtml: res.data[0].bodyHtml });
      }
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat template notifikasi");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTemplate(t: EmailTemplate) {
    setSelectedType(t.notificationType);
    setForm({ subject: t.subject, bodyHtml: t.bodyHtml });
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const res = await apiClient(`/email-templates/${selectedType}`, { method: "PATCH", body: JSON.stringify(form) });
    setSaving(false);
    if (res.success) {
      setSuccessMsg("Template email berhasil disimpan.");
      load();
    } else {
      setErrorMsg(res.error?.message || "Gagal menyimpan template email");
    }
  }

  const current = templates.find((t) => t.notificationType === selectedType);

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="grid md:grid-cols-[200px_minmax(0,1fr)] gap-4">
      <div className="space-y-1">
        {templates.map((t) => (
          <button
            key={t.notificationType}
            onClick={() => selectTemplate(t)}
            className={`block w-full text-left px-3 py-2 rounded-md text-xs font-bold ${
              t.notificationType === selectedType ? "bg-[#fff0f1] text-ums-red" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {NOTIFICATION_TYPE_LABELS[t.notificationType] || t.notificationType}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-3.5">
        {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{errorMsg}</div>}
        {successMsg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded border border-green-200">{successMsg}</div>}

        {current && (
          <p className="text-xs text-slate-500">
            Variabel tersedia untuk template ini:{" "}
            {current.variables.map((v) => (
              <code key={v} className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] mr-1">{`{{${v}}}`}</code>
            ))}
          </p>
        )}

        <div>
          <label htmlFor="tpl-subject" className="block text-xs font-bold mb-1.5">Subjek Email *</label>
          <input
            id="tpl-subject"
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="tpl-body" className="block text-xs font-bold mb-1.5">Isi Email (HTML) *</label>
          <textarea
            id="tpl-body"
            required
            value={form.bodyHtml}
            onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
            rows={8}
            className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm font-mono text-xs"
          />
        </div>

        <div>
          <p className="text-xs font-bold mb-1.5">Pratinjau (dengan data contoh)</p>
          <div className="border border-ums-border rounded-md p-3 bg-slate-50 text-sm">
            <p className="font-bold text-ums-text mb-2">{renderPreview(form.subject)}</p>
            <div dangerouslySetInnerHTML={{ __html: renderPreview(form.bodyHtml) }} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <div className="grid md:grid-cols-[220px_minmax(0,1fr)] gap-4">
      <Card className="p-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`block w-full text-left px-3 py-2.5 rounded-md text-sm ${
              activeTab === tab ? "bg-[#fff0f1] text-ums-red border-l-4 border-ums-red font-bold" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </Card>

      <Card>
        {activeTab === "Profil Perusahaan" ? (
          <>
            <h2 className="text-lg font-bold text-ums-text mb-4">Profil Perusahaan</h2>
            <CompanyProfileTab />
          </>
        ) : activeTab === "Email & SMTP" ? (
          <>
            <h2 className="text-lg font-bold text-ums-text mb-4">Email &amp; SMTP</h2>
            <SmtpTab />
          </>
        ) : activeTab === "Notifikasi" ? (
          <>
            <h2 className="text-lg font-bold text-ums-text mb-4">Template Email Notifikasi</h2>
            <NotificationTemplatesTab />
          </>
        ) : activeTab === "Keamanan" ? (
          <>
            <h2 className="text-lg font-bold text-ums-text mb-4">Keamanan</h2>
            <SecurityTab />
          </>
        ) : (
          <div className="text-center py-16">
            <h2 className="text-lg font-bold text-ums-text mb-2">{activeTab}</h2>
            <p className="text-sm text-slate-500">Modul pengaturan ini belum tersedia dan akan dibangun pada fase berikutnya.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

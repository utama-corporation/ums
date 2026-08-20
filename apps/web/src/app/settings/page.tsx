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
        <label className="block text-xs font-bold mb-1.5">Kode</label>
        <input value={profile.code} disabled className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm bg-slate-50 text-slate-500" />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1.5">Nama Perusahaan *</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1.5">Telepon</label>
        <input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1.5">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1.5">Alamat</label>
        <textarea
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          rows={3}
          className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1.5">URL Logo</label>
        <input
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
        <label className="block text-xs font-bold mb-1.5">Masa Berlaku Access Token (menit) *</label>
        <input
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
        <label className="block text-xs font-bold mb-1.5">Masa Berlaku Sesi / Refresh Token (hari) *</label>
        <input
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

"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/Card";

interface CompanyProfile {
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      const res = await apiClient<CompanyProfile>("/settings/company-profile");
      setLoading(false);
      if (res.success && res.data) {
        setProfile(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memuat profil perusahaan");
      }
    }
    load();
  }, []);

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
            {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}
            {loading ? (
              <p className="text-sm text-slate-500">Memuat...</p>
            ) : profile ? (
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Nama Perusahaan</p>
                  <p className="font-medium text-ums-text">{profile.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Kode</p>
                  <p className="font-medium text-ums-text">{profile.code}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Telepon</p>
                  <p className="font-medium text-ums-text">{profile.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Email</p>
                  <p className="font-medium text-ums-text">{profile.email || "-"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-500 mb-1">Alamat</p>
                  <p className="font-medium text-ums-text">{profile.address || "-"}</p>
                </div>
              </div>
            ) : null}
            <p className="text-xs text-slate-400 mt-6 border-t border-ums-border pt-4">
              Tampilan ini masih baca-saja. Formulir edit profil perusahaan akan tersedia bersama modul Settings lengkap pada fase berikutnya.
            </p>
          </>
        ) : (
          <div className="text-center py-16">
            <h2 className="text-lg font-bold text-ums-text mb-2">{activeTab}</h2>
            <p className="text-sm text-slate-500">Modul pengaturan ini belum tersedia dan akan dibangun pada fase Notification Center &amp; Settings berikutnya.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

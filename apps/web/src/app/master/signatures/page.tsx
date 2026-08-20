"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface SignatureItem {
  id: string;
  signatureType: string;
  isActive: boolean;
  createdAt: string;
  ownerName: string;
  ownerUsername: string;
  departmentName: string | null;
  usageCount: number;
  lastUsedAt: string | null;
}

export default function MasterSignaturesPage() {
  const [items, setItems] = useState<SignatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  async function load() {
    setLoading(true);
    const res = await apiClient<SignatureItem[]>("/signatures");
    setLoading(false);
    if (res.success && res.data) {
      setItems(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat data digital signature");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(s: SignatureItem) {
    setActionMsg("");
    const confirmMsg = s.isActive
      ? `Nonaktifkan hak tanda tangan ${s.ownerName}? Mereka tidak akan bisa publikasi memo sampai diaktifkan lagi.`
      : `Aktifkan kembali hak tanda tangan ${s.ownerName}?`;
    if (!window.confirm(confirmMsg)) return;

    const res = await apiClient(`/signatures/${s.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !s.isActive }) });
    if (res.success) {
      load();
    } else {
      setActionMsg(res.error?.message || "Gagal mengubah status signature");
    }
  }

  return (
    <Card>
      <CardHead title="Master Digital Signature" />
      <p className="text-xs text-slate-500 -mt-2 mb-4">
        Profil tanda tangan internal (bukan tanda tangan elektronik tersertifikasi/PSrE), dibuat otomatis saat seorang user pertama kali
        mempublikasikan memo. Nonaktifkan di sini untuk mencabut hak tanda tangan seseorang (mis. karyawan resign) — mereka akan diblokir dari
        memublikasikan memo baru selama nonaktif.
      </p>

      {actionMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{actionMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Pemilik</th>
                <th className="p-3">Username</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Jumlah Penggunaan</th>
                <th className="p-3">Terakhir Digunakan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    Belum ada profil digital signature yang terdaftar. Profil akan muncul otomatis setelah seorang user pertama kali
                    mempublikasikan memo.
                  </td>
                </tr>
              ) : (
                items.map((s) => (
                  <tr key={s.id} className="border-b border-ums-border hover:bg-slate-50">
                    <td className="p-3 font-medium text-ums-text">{s.ownerName}</td>
                    <td className="p-3 font-mono text-xs text-slate-600">{s.ownerUsername}</td>
                    <td className="p-3 text-slate-600">{s.departmentName || "-"}</td>
                    <td className="p-3">
                      <Badge label={s.signatureType === "INTERNAL" ? "Internal" : "Tersertifikasi"} color={s.signatureType === "INTERNAL" ? "blue" : "green"} />
                    </td>
                    <td className="p-3 text-slate-600">{s.usageCount}x</td>
                    <td className="p-3 text-slate-500 text-xs">{s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString("id-ID") : "Belum pernah"}</td>
                    <td className="p-3">
                      <Badge label={s.isActive ? "Aktif" : "Non-aktif"} color={s.isActive ? "green" : "gray"} />
                    </td>
                    <td className="p-3">
                      <button onClick={() => toggleActive(s)} className="text-xs font-bold text-ums-red">
                        {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

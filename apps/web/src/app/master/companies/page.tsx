"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface CompanyItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface FormState {
  id?: string;
  code: string;
  name: string;
}

const EMPTY_FORM: FormState = { code: "", name: "" };

export default function MasterCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadCompanies() {
    setLoading(true);
    const res = await apiClient<CompanyItem[]>("/companies");
    setLoading(false);
    if (res.success && res.data) {
      setCompanies(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat data perusahaan");
    }
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(c: CompanyItem) {
    setForm({ id: c.id, code: c.code, name: c.name });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = { code: form.code, name: form.name };
    const res = form.id
      ? await apiClient(`/companies/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await apiClient("/companies", { method: "POST", body: JSON.stringify(payload) });

    setSaving(false);
    if (res.success) {
      setModalOpen(false);
      loadCompanies();
    } else {
      setFormError(res.error?.message || "Gagal menyimpan perusahaan");
    }
  }

  async function toggleActive(c: CompanyItem) {
    const res = await apiClient(`/companies/${c.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !c.isActive }) });
    if (res.success) {
      loadCompanies();
    } else {
      setErrorMsg(res.error?.message || "Gagal mengubah status perusahaan");
    }
  }

  return (
    <Card>
      <CardHead
        title="Master Perusahaan"
        actions={
          <button onClick={openCreate} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm">
            + Tambah Perusahaan
          </button>
        }
      />
      <p className="text-xs text-slate-500 -mt-2 mb-4">
        Daftar entitas perusahaan dalam grup (mis. UC, RU, GSU) yang menjadi sumber data karyawan untuk pembuatan akun user. Baris di sini
        akan otomatis bertambah saat kode perusahaan baru muncul di data karyawan hasil sinkronisasi.
      </p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Kode</th>
                <th className="p-3">Nama Perusahaan</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    Belum ada data perusahaan. Klik &quot;Tambah Perusahaan&quot; atau jalankan sinkronisasi karyawan dari Master User.
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="border-b border-ums-border hover:bg-slate-50">
                    <td className="p-3">
                      <Badge label={c.code} color="gray" />
                    </td>
                    <td className="p-3 font-medium text-ums-text">{c.name}</td>
                    <td className="p-3">
                      <Badge label={c.isActive ? "Aktif" : "Non-aktif"} color={c.isActive ? "green" : "gray"} />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(c)} className="text-ums-blue font-bold text-xs">
                          Edit
                        </button>
                        <button onClick={() => toggleActive(c)} className="text-slate-500 font-bold text-xs">
                          {c.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal title={form.id ? "Edit Perusahaan" : "Tambah Perusahaan"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}
            <div>
              <label className="block text-xs font-bold mb-1.5">Kode *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                placeholder="Contoh: UC"
              />
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
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 font-bold">
                Batal
              </button>
              <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

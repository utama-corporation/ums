"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface MemoTypeItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

interface FormState {
  id?: string;
  code: string;
  name: string;
  description: string;
}

const EMPTY_FORM: FormState = { code: "", name: "", description: "" };

export default function MasterMemoTypesPage() {
  const [types, setTypes] = useState<MemoTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadTypes() {
    setLoading(true);
    const res = await apiClient<MemoTypeItem[]>("/memo-types");
    setLoading(false);
    if (res.success && res.data) {
      setTypes(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat jenis memo");
    }
  }

  useEffect(() => {
    loadTypes();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(t: MemoTypeItem) {
    setForm({ id: t.id, code: t.code, name: t.name, description: t.description || "" });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = { code: form.code, name: form.name, description: form.description || null };
    const res = form.id
      ? await apiClient(`/memo-types/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await apiClient("/memo-types", { method: "POST", body: JSON.stringify(payload) });

    setSaving(false);
    if (res.success) {
      setModalOpen(false);
      loadTypes();
    } else {
      setFormError(res.error?.message || "Gagal menyimpan jenis memo");
    }
  }

  async function toggleActive(t: MemoTypeItem) {
    const res = await apiClient(`/memo-types/${t.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !t.isActive }) });
    if (res.success) {
      loadTypes();
    } else {
      setErrorMsg(res.error?.message || "Gagal mengubah status jenis memo");
    }
  }

  return (
    <Card>
      <CardHead
        title="Master Jenis Memo"
        actions={
          <button onClick={openCreate} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm">
            + Tambah Jenis
          </button>
        }
      />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Klasifikasi tipe dokumen memo internal</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat jenis memo...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Kode</th>
                <th className="p-3">Nama Tipe</th>
                <th className="p-3">Deskripsi</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    Belum ada jenis memo. Klik &quot;Tambah Jenis&quot; untuk membuat.
                  </td>
                </tr>
              ) : (
                types.map((t) => (
                  <tr key={t.id} className="border-b border-ums-border hover:bg-slate-50">
                    <td className="p-3">
                      <Badge label={t.code} color="gray" />
                    </td>
                    <td className="p-3 font-medium text-ums-text">{t.name}</td>
                    <td className="p-3 text-slate-600">{t.description || "-"}</td>
                    <td className="p-3">
                      <Badge label={t.isActive ? "Aktif" : "Non-aktif"} color={t.isActive ? "green" : "gray"} />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(t)} className="text-ums-blue font-bold text-xs">
                          Edit
                        </button>
                        <button onClick={() => toggleActive(t)} className="text-slate-500 font-bold text-xs">
                          {t.isActive ? "Nonaktifkan" : "Aktifkan"}
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
        <Modal title={form.id ? "Edit Jenis Memo" : "Tambah Jenis Memo"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}
            <div>
              <label className="block text-xs font-bold mb-1.5">Kode *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                placeholder="Contoh: UMUM"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Nama Tipe *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Deskripsi</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
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

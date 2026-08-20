"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  headUserId?: string | null;
  isActive: boolean;
}

interface UserOption {
  id: string;
  fullName: string;
}

interface FormState {
  id?: string;
  code: string;
  name: string;
  parentId: string;
  headUserId: string;
}

const EMPTY_FORM: FormState = { code: "", name: "", parentId: "", headUserId: "" };

export default function MasterDepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadDepartments() {
    setLoading(true);
    const res = await apiClient<DepartmentItem[]>("/departments");
    setLoading(false);
    if (res.success && res.data) {
      setDepartments(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat data departemen");
    }
  }

  useEffect(() => {
    loadDepartments();
    apiClient<UserOption[]>("/users?limit=100").then((res) => {
      if (res.success && res.data) setUsers(res.data);
    });
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(d: DepartmentItem) {
    setForm({ id: d.id, code: d.code, name: d.name, parentId: d.parentId || "", headUserId: d.headUserId || "" });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      code: form.code,
      name: form.name,
      parentId: form.parentId || null,
      headUserId: form.headUserId || null,
    };
    const res = form.id
      ? await apiClient(`/departments/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await apiClient("/departments", { method: "POST", body: JSON.stringify(payload) });

    setSaving(false);
    if (res.success) {
      setModalOpen(false);
      loadDepartments();
    } else {
      setFormError(res.error?.message || "Gagal menyimpan departemen");
    }
  }

  async function toggleActive(d: DepartmentItem) {
    const res = await apiClient(`/departments/${d.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !d.isActive }) });
    if (res.success) {
      loadDepartments();
    } else {
      setErrorMsg(res.error?.message || "Gagal mengubah status departemen");
    }
  }

  return (
    <Card>
      <CardHead
        title="Master Data Departemen"
        actions={
          <button onClick={openCreate} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm">
            + Tambah Departemen
          </button>
        }
      />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Struktur hierarki departemen perusahaan</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat data departemen...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Kode</th>
                <th className="p-3">Nama Departemen</th>
                <th className="p-3">Parent Departemen</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-ums-border hover:bg-slate-50">
                  <td className="p-3">
                    <Badge label={d.code} color="gray" />
                  </td>
                  <td className="p-3 font-medium text-ums-text">{d.name}</td>
                  <td className="p-3 text-slate-600">{d.parent?.name || "-"}</td>
                  <td className="p-3">
                    <Badge label={d.isActive ? "Aktif" : "Non-aktif"} color={d.isActive ? "green" : "gray"} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(d)} className="text-ums-blue font-bold text-xs">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(d)} className="text-slate-500 font-bold text-xs">
                        {d.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal title={form.id ? "Edit Departemen" : "Tambah Departemen"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}
            <div>
              <label className="block text-xs font-bold mb-1.5">Kode *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                placeholder="Contoh: HR"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Nama Departemen *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Parent Departemen</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              >
                <option value="">(Tidak ada / departemen puncak)</option>
                {departments
                  .filter((d) => d.id !== form.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Kepala Departemen</label>
              <select
                value={form.headUserId}
                onChange={(e) => setForm({ ...form, headUserId: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              >
                <option value="">(Belum ditentukan)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
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

"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface NumberingRuleItem {
  id: string;
  name: string;
  formatPattern: string;
  resetFrequency: string;
  paddingDigits: number;
  isActive: boolean;
}

interface FormState {
  id?: string;
  name: string;
  formatPattern: string;
  resetFrequency: "YEARLY" | "MONTHLY";
  paddingDigits: number;
}

const EMPTY_FORM: FormState = {
  name: "",
  formatPattern: "{SEQUENCE}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}",
  resetFrequency: "YEARLY",
  paddingDigits: 4,
};

export default function MasterNumberingPage() {
  const [rules, setRules] = useState<NumberingRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadRules() {
    setLoading(true);
    const res = await apiClient<NumberingRuleItem[]>("/numbering-rules");
    setLoading(false);
    if (res.success && res.data) {
      setRules(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat aturan penomoran");
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(r: NumberingRuleItem) {
    setForm({
      id: r.id,
      name: r.name,
      formatPattern: r.formatPattern,
      resetFrequency: r.resetFrequency as "YEARLY" | "MONTHLY",
      paddingDigits: r.paddingDigits,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      name: form.name,
      formatPattern: form.formatPattern,
      resetFrequency: form.resetFrequency,
      paddingDigits: Number(form.paddingDigits),
    };
    const res = form.id
      ? await apiClient(`/numbering-rules/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await apiClient("/numbering-rules", { method: "POST", body: JSON.stringify(payload) });

    setSaving(false);
    if (res.success) {
      setModalOpen(false);
      loadRules();
    } else {
      setFormError(res.error?.message || "Gagal menyimpan aturan penomoran");
    }
  }

  async function toggleActive(r: NumberingRuleItem) {
    const res = await apiClient(`/numbering-rules/${r.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !r.isActive }) });
    if (res.success) {
      loadRules();
    } else {
      setErrorMsg(res.error?.message || "Gagal mengubah status aturan");
    }
  }

  return (
    <Card>
      <CardHead
        title="Master Aturan Penomoran Memo"
        actions={
          <button onClick={openCreate} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm">
            + Tambah Aturan
          </button>
        }
      />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Konfigurasi format penomoran otomatis dan reset sequence</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat aturan penomoran...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Nama Aturan</th>
                <th className="p-3">Format Pattern</th>
                <th className="p-3">Reset</th>
                <th className="p-3">Padding</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    Belum ada aturan penomoran. Klik &quot;Tambah Aturan&quot; untuk membuat.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="border-b border-ums-border hover:bg-slate-50">
                    <td className="p-3 font-medium text-ums-text">{r.name}</td>
                    <td className="p-3 font-mono text-xs text-ums-blue">{r.formatPattern}</td>
                    <td className="p-3 text-slate-600">{r.resetFrequency}</td>
                    <td className="p-3 text-slate-600">{r.paddingDigits}</td>
                    <td className="p-3">
                      <Badge label={r.isActive ? "Aktif" : "Non-aktif"} color={r.isActive ? "green" : "gray"} />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(r)} className="text-ums-blue font-bold text-xs">
                          Edit
                        </button>
                        <button onClick={() => toggleActive(r)} className="text-slate-500 font-bold text-xs">
                          {r.isActive ? "Nonaktifkan" : "Aktifkan"}
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
        <Modal title={form.id ? "Edit Aturan Penomoran" : "Tambah Aturan Penomoran"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}
            <div>
              <label className="block text-xs font-bold mb-1.5">Nama Aturan *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Format Pattern *</label>
              <input
                required
                value={form.formatPattern}
                onChange={(e) => setForm({ ...form, formatPattern: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">Token: {"{SEQUENCE} {DEPT} {TYPE} {ROMAN_MONTH} {YEAR}"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">Reset Frequency</label>
                <select
                  value={form.resetFrequency}
                  onChange={(e) => setForm({ ...form, resetFrequency: e.target.value as "YEARLY" | "MONTHLY" })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                >
                  <option value="YEARLY">Tahunan</option>
                  <option value="MONTHLY">Bulanan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Padding Digit</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  required
                  value={form.paddingDigits}
                  onChange={(e) => setForm({ ...form, paddingDigits: Number(e.target.value) })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
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

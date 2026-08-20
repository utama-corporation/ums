"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface UserItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  employeeId?: string | null;
  mobilePhone?: string | null;
  companyId?: string | null;
  departmentId?: string | null;
  position?: string | null;
  department?: { id: string; name: string };
  company?: { id: string; code: string; name: string };
  isActive: boolean;
  userRoles: { role: { id: string; name: string } }[];
}

interface SimpleOption {
  id: string;
  name: string;
}

interface CompanyOption {
  id: string;
  code: string;
  name: string;
}

interface EmployeeCandidate {
  externalId: number;
  fullName: string;
  nik: string;
  email: string | null;
  mobilePhone: string | null;
  companyCode: string;
  hasAccount: boolean;
}

interface SyncSummary {
  totalEmployeesFetched: number;
  companiesUpserted: number;
  usersChecked: number;
  usersDisabled: { id: string; username: string; fullName: string }[];
}

interface FormState {
  id?: string;
  username: string;
  email: string;
  fullName: string;
  employeeId: string;
  mobilePhone: string;
  companyId: string;
  departmentId: string;
  position: string;
  password: string;
  roleIds: string[];
}

const EMPTY_FORM: FormState = {
  username: "",
  email: "",
  fullName: "",
  employeeId: "",
  mobilePhone: "",
  companyId: "",
  departmentId: "",
  position: "",
  password: "",
  roleIds: [],
};

export default function MasterUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<SimpleOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [roles, setRoles] = useState<SimpleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeResults, setEmployeeResults] = useState<EmployeeCandidate[]>([]);
  const [employeeSearchLoading, setEmployeeSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState("");

  async function loadUsers() {
    setLoading(true);
    const res = await apiClient<UserItem[]>("/users?limit=100");
    setLoading(false);
    if (res.success && res.data) {
      setUsers(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat data pengguna");
    }
  }

  useEffect(() => {
    loadUsers();
    apiClient<{ id: string; name: string }[]>("/departments").then((res) => {
      if (res.success && res.data) setDepartments(res.data.map((d) => ({ id: d.id, name: d.name })));
    });
    apiClient<CompanyOption[]>("/companies").then((res) => {
      if (res.success && res.data) setCompanies(res.data);
    });
    apiClient<{ id: string; name: string }[]>("/roles").then((res) => {
      if (res.success && res.data) setRoles(res.data);
    });
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setEmployeeQuery("");
    setEmployeeResults([]);
    setModalOpen(true);
  }

  function openEdit(u: UserItem) {
    setForm({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      employeeId: u.employeeId || "",
      mobilePhone: u.mobilePhone || "",
      companyId: u.companyId || "",
      departmentId: u.departmentId || "",
      position: u.position || "",
      password: "",
      roleIds: u.userRoles.map((ur) => ur.role.id),
    });
    setFormError("");
    setModalOpen(true);
  }

  function toggleRole(roleId: string) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(roleId) ? f.roleIds.filter((r) => r !== roleId) : [...f.roleIds, roleId],
    }));
  }

  function handleEmployeeQueryChange(value: string) {
    setEmployeeQuery(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (value.trim().length < 2) {
      setEmployeeResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setEmployeeSearchLoading(true);
      const res = await apiClient<EmployeeCandidate[]>(`/employees/search?q=${encodeURIComponent(value.trim())}`);
      setEmployeeSearchLoading(false);
      if (res.success && res.data) setEmployeeResults(res.data);
    }, 350);
  }

  function pickEmployee(e: EmployeeCandidate) {
    const matchedCompany = companies.find((c) => c.code === e.companyCode);
    setForm((f) => ({
      ...f,
      fullName: e.fullName,
      employeeId: e.nik,
      email: e.email || f.email,
      mobilePhone: e.mobilePhone || "",
      companyId: matchedCompany?.id || "",
    }));
    setEmployeeQuery("");
    setEmployeeResults([]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    if (form.id) {
      const payload = {
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        employeeId: form.employeeId || null,
        mobilePhone: form.mobilePhone || null,
        companyId: form.companyId || null,
        departmentId: form.departmentId || null,
        position: form.position || null,
        roleIds: form.roleIds,
      };
      const res = await apiClient(`/users/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setSaving(false);
      if (res.success) {
        setModalOpen(false);
        loadUsers();
      } else {
        setFormError(res.error?.message || "Gagal menyimpan pengguna");
      }
    } else {
      const payload = {
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        employeeId: form.employeeId || undefined,
        mobilePhone: form.mobilePhone || undefined,
        companyId: form.companyId || undefined,
        departmentId: form.departmentId || null,
        position: form.position || null,
        password: form.password,
        roleIds: form.roleIds,
      };
      const res = await apiClient("/users", { method: "POST", body: JSON.stringify(payload) });
      setSaving(false);
      if (res.success) {
        setModalOpen(false);
        loadUsers();
      } else {
        setFormError(res.error?.message || "Gagal membuat pengguna");
      }
    }
  }

  async function toggleActive(u: UserItem) {
    const res = await apiClient(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !u.isActive }) });
    if (res.success) {
      loadUsers();
    } else {
      setErrorMsg(res.error?.message || "Gagal mengubah status pengguna");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetMsg("");
    const res = await apiClient(`/users/${resetTarget.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
    if (res.success) {
      setResetMsg("Password berhasil direset. Semua sesi login pengguna ini telah dinonaktifkan.");
      setNewPassword("");
    } else {
      setResetMsg(res.error?.message || "Gagal mereset password");
    }
  }

  async function handleSync() {
    if (!window.confirm("Sinkronisasi akan menonaktifkan otomatis semua user (di luar role SUPER_ADMIN/MANAGEMENT) yang NIK-nya sudah tidak ada di data karyawan. Lanjutkan?")) {
      return;
    }
    setSyncing(true);
    setSyncError("");
    setSyncSummary(null);
    const res = await apiClient<SyncSummary>("/employees/sync", { method: "POST" });
    setSyncing(false);
    if (res.success && res.data) {
      setSyncSummary(res.data);
      apiClient<CompanyOption[]>("/companies").then((r) => {
        if (r.success && r.data) setCompanies(r.data);
      });
      loadUsers();
    } else {
      setSyncError(res.error?.message || "Gagal sinkronisasi data karyawan");
    }
  }

  return (
    <Card>
      <CardHead
        title="Master Data User"
        actions={
          <div className="flex gap-2">
            <button onClick={handleSync} disabled={syncing} className="border border-ums-border text-slate-700 font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
              {syncing ? "Menyinkron..." : "⟳ Sync Karyawan"}
            </button>
            <button onClick={openCreate} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm">
              + Tambah User
            </button>
          </div>
        }
      />
      <p className="text-xs text-slate-500 -mt-2 mb-4">
        Kelola daftar pengguna dan hak akses aplikasi. Data karyawan (Nama, NIK, Email, No. HP, Perusahaan) bersumber dari sistem HR — gunakan
        pencarian karyawan saat membuat user baru, dan klik &quot;Sync Karyawan&quot; untuk menonaktifkan otomatis user yang sudah tidak
        terdaftar sebagai karyawan aktif.
      </p>

      {syncError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{syncError}</div>}
      {syncSummary && (
        <div className="bg-[#e5f7ed] text-[#10834d] text-sm p-3 rounded border border-[#c5ecd6] mb-4">
          <p className="font-bold mb-1">Sinkronisasi selesai</p>
          <p>
            {syncSummary.totalEmployeesFetched} karyawan diambil dari API &middot; {syncSummary.companiesUpserted} perusahaan diperbarui &middot;{" "}
            {syncSummary.usersChecked} user diperiksa &middot; {syncSummary.usersDisabled.length} user dinonaktifkan
          </p>
          {syncSummary.usersDisabled.length > 0 && (
            <p className="mt-1">
              Dinonaktifkan: {syncSummary.usersDisabled.map((u) => u.username).join(", ")}
            </p>
          )}
        </div>
      )}
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat data user...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Username</th>
                <th className="p-3">Nama Lengkap</th>
                <th className="p-3">NIK</th>
                <th className="p-3">Email</th>
                <th className="p-3">Perusahaan</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ums-border hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs text-slate-700">{u.username}</td>
                  <td className="p-3 font-medium text-ums-text">{u.fullName}</td>
                  <td className="p-3 font-mono text-xs text-slate-600">{u.employeeId || "-"}</td>
                  <td className="p-3 text-slate-600">{u.email}</td>
                  <td className="p-3 text-slate-600">{u.company?.code || "-"}</td>
                  <td className="p-3 text-slate-600">{u.department?.name || "-"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {u.userRoles.map((ur) => (
                        <Badge key={ur.role.id} label={ur.role.name} color="blue" />
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge label={u.isActive ? "Aktif" : "Non-aktif"} color={u.isActive ? "green" : "gray"} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-ums-blue font-bold text-xs">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(u)} className="text-slate-500 font-bold text-xs">
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        onClick={() => {
                          setResetTarget(u);
                          setResetMsg("");
                          setNewPassword("");
                        }}
                        className="text-ums-orange font-bold text-xs"
                      >
                        Reset Password
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
        <Modal title={form.id ? "Edit User" : "Tambah User"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}

            {!form.id && (
              <div className="relative">
                <label className="block text-xs font-bold mb-1.5">Cari dari Data Karyawan</label>
                <input
                  value={employeeQuery}
                  onChange={(e) => handleEmployeeQueryChange(e.target.value)}
                  placeholder="Ketik nama atau NIK karyawan..."
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
                {employeeSearchLoading && <p className="text-xs text-slate-400 mt-1">Mencari...</p>}
                {employeeResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-ums-border rounded-md shadow-lg max-h-56 overflow-y-auto">
                    {employeeResults.map((e) => (
                      <button
                        type="button"
                        key={e.nik}
                        disabled={e.hasAccount}
                        onClick={() => pickEmployee(e)}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-ums-border last:border-0 ${
                          e.hasAccount ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium text-ums-text">{e.fullName}</span>{" "}
                        <span className="text-xs text-slate-500 font-mono">({e.nik}, {e.companyCode})</span>
                        {e.hasAccount && <span className="text-xs text-slate-400"> — sudah punya akun</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Pilih karyawan untuk mengisi otomatis Nama, NIK, Email, No. HP &amp; Perusahaan. Field lain tetap bisa diisi manual.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">Username *</label>
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Nama Lengkap *</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">NIK</label>
                <input
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">No. HP</label>
                <input
                  value={form.mobilePhone}
                  onChange={(e) => setForm({ ...form, mobilePhone: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            {!form.id && (
              <div>
                <label className="block text-xs font-bold mb-1.5">Password Awal *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">Perusahaan</label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                >
                  <option value="">(Tidak ada)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Departemen</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                >
                  <option value="">(Tidak ada)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Jabatan</label>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Role</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full font-bold border ${
                      form.roleIds.includes(r.id) ? "bg-ums-blue text-white border-ums-blue" : "bg-white text-slate-600 border-ums-border"
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
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

      {resetTarget && (
        <Modal title={`Reset Password: ${resetTarget.fullName}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            {resetMsg && (
              <div className={`text-sm p-3 rounded border ${resetMsg.includes("berhasil") ? "bg-[#e5f7ed] text-[#10834d] border-[#c5ecd6]" : "bg-red-50 text-red-700 border-red-200"}`}>
                {resetMsg}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold mb-1.5">Password Baru *</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">Mereset password akan otomatis mengeluarkan pengguna dari semua sesi login aktif.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm text-slate-600 font-bold">
                Tutup
              </button>
              <button type="submit" className="bg-ums-orange text-white font-bold px-4 py-2 rounded-md text-sm">
                Reset Password
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

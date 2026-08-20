"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";
import { Card, CardHead } from "@/components/ui/Card";

interface SimpleOption {
  id: string;
  name: string;
  code?: string;
}

export default function CreateMemoPage() {
  const router = useRouter();
  const { user } = useSession();

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [memoTypeId, setMemoTypeId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [classification, setClassification] = useState("GENERAL");
  const [bodyHtml, setBodyHtml] = useState("");
  const [recipientDeptId, setRecipientDeptId] = useState("");

  const [categories, setCategories] = useState<SimpleOption[]>([]);
  const [types, setTypes] = useState<SimpleOption[]>([]);
  const [departments, setDepartments] = useState<SimpleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadMasterData() {
      const [catRes, typeRes, deptRes] = await Promise.all([
        apiClient<SimpleOption[]>("/categories"),
        apiClient<SimpleOption[]>("/memo-types"),
        apiClient<SimpleOption[]>("/departments"),
      ]);
      if (catRes.success && catRes.data) {
        setCategories(catRes.data);
        if (catRes.data.length > 0) setCategoryId(catRes.data[0].id);
      }
      if (typeRes.success && typeRes.data) {
        setTypes(typeRes.data);
        if (typeRes.data.length > 0) setMemoTypeId(typeRes.data[0].id);
      }
      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data);
        if (deptRes.data.length > 0) setRecipientDeptId(deptRes.data[0].id);
      }
    }
    loadMasterData();
  }, []);

  async function save(submitAfter: boolean) {
    if (!user) return;
    setLoading(true);
    setErrorMsg("");

    const recipientDept = departments.find((d) => d.id === recipientDeptId);

    const payload = {
      title,
      categoryId,
      memoTypeId,
      priority,
      classification,
      bodyHtml,
      senders: [{ partyType: "USER" as const, partyId: user.id, displayName: user.fullName }],
      recipients: [{ partyType: "DEPARTMENT" as const, partyId: recipientDeptId, displayName: recipientDept?.name || "Departemen Tujuan" }],
      ccs: [],
    };

    const res = await apiClient<{ id: string }>("/memos", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.success || !res.data) {
      setLoading(false);
      setErrorMsg(res.error?.message || "Gagal menyimpan draf memo");
      return;
    }

    if (submitAfter) {
      const submitRes = await apiClient(`/memos/${res.data.id}/submit`, { method: "POST" });
      setLoading(false);
      if (!submitRes.success) {
        setErrorMsg(`Draf tersimpan, tetapi gagal diajukan: ${submitRes.error?.message || "unknown error"}`);
        router.push(`/memos/${res.data.id}`);
        return;
      }
      router.push(`/memos/${res.data.id}`);
    } else {
      setLoading(false);
      router.push("/memos/drafts");
    }
  }

  const senderName = user?.fullName || "-";
  const recipientName = departments.find((d) => d.id === recipientDeptId)?.name || "-";

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-4 items-start">
      <div className="space-y-4">
        <Card>
          <CardHead title="1. Informasi Memo" />
          <div className="grid md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold mb-1.5">Nomor Memo</label>
              <input disabled value="Akan dibuat otomatis" className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm bg-slate-50 text-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Kategori *</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Jenis Memo *</label>
              <select value={memoTypeId} onChange={(e) => setMemoTypeId(e.target.value)} className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm">
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Prioritas</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm">
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Penting</option>
                <option value="URGENT">Mendesak</option>
                <option value="CRITICAL">Kritis</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Klasifikasi</label>
              <select value={classification} onChange={(e) => setClassification(e.target.value)} className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm">
                <option value="GENERAL">Umum</option>
                <option value="INTERNAL">Internal</option>
                <option value="CONFIDENTIAL">Rahasia</option>
                <option value="HIGHLY_CONFIDENTIAL">Sangat Rahasia</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="2. Penerima" />
          <div className="grid md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold mb-1.5">Departemen Penerima *</label>
              <select value={recipientDeptId} onChange={(e) => setRecipientDeptId(e.target.value)} className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Penerima individu, tembusan (CC), dan penerima eksternal akan tersedia pada iterasi berikutnya. Saat ini memo dikirim ke seluruh anggota
            departemen terpilih.
          </p>
        </Card>

        <Card>
          <CardHead title="3. Isi Memo" />
          <label className="block text-xs font-bold mb-1.5">Judul / Perihal *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm mb-3.5"
            placeholder="Masukkan judul memo"
          />
          <label className="block text-xs font-bold mb-1.5">Isi Memo</label>
          <div className="border border-ums-border rounded-lg overflow-hidden">
            <div className="p-2 bg-slate-50 border-b border-ums-border text-xs text-slate-500">Format teks dasar (HTML disanitasi otomatis)</div>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={8}
              className="w-full p-3 text-sm border-0"
              placeholder="Tulis isi memo di sini..."
            />
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHead title="4. Workflow" />
            <p className="text-xs text-slate-500">
              Alur persetujuan akan ditentukan otomatis oleh sistem berdasarkan kategori memo saat diajukan. Jika tidak ada workflow aktif untuk
              kategori ini, memo akan langsung berstatus Disetujui.
            </p>
          </Card>
          <Card>
            <CardHead title="5. Lampiran" />
            <div className="border border-dashed border-ums-border rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500">Simpan draf terlebih dahulu untuk mengunggah lampiran.</p>
              <p className="text-xs text-slate-400 mt-1">Opsi unggah akan muncul di halaman detail memo setelah draf tersimpan.</p>
            </div>
          </Card>
        </div>

        {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{errorMsg}</div>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push("/memos/drafts")} className="px-4 py-2.5 text-sm text-slate-600 font-bold">
            Batal
          </button>
          <button
            type="button"
            disabled={loading || !title || !recipientDeptId}
            onClick={() => save(false)}
            className="bg-white border border-ums-border font-bold px-5 py-2.5 rounded-md text-sm disabled:opacity-50"
          >
            Simpan Draf
          </button>
          <button
            type="button"
            disabled={loading || !title || !recipientDeptId}
            onClick={() => save(true)}
            className="bg-ums-red hover:opacity-90 text-white font-bold px-5 py-2.5 rounded-md text-sm transition disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Kirim untuk Persetujuan"}
          </button>
        </div>
      </div>

      <Card>
        <CardHead title="6. Preview Ringkas Memo" />
        <div className="space-y-2.5 text-sm">
          {[
            ["Nomor Memo", "Otomatis"],
            ["Tanggal", new Date().toLocaleDateString("id-ID")],
            ["Kategori", categories.find((c) => c.id === categoryId)?.name || "-"],
            ["Jenis Memo", types.find((t) => t.id === memoTypeId)?.name || "-"],
            ["Prioritas", priority],
            ["Pengirim", senderName],
            ["Penerima", recipientName],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border border-ums-border rounded-lg p-2.5">
              <span className="text-slate-500">{label}</span>
              <b className="text-ums-text">{value}</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api";

interface VerificationResult {
  isValid: boolean;
  message: string;
  memoNumber?: string;
  title?: string;
  categoryName?: string;
  typeName?: string;
  classification?: string;
  publicationDate?: string;
  documentHashSha256?: string;
  signer?: {
    fullName: string;
    employeeId?: string | null;
    departmentName?: string | null;
    position?: string | null;
  } | null;
  signedAt?: string;
}

export default function DocumentVerificationPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadVerification() {
      const res = await apiClient<VerificationResult>(`/verify/${token}`);
      setLoading(false);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memverifikasi keabsahan dokumen.");
      }
    }
    loadVerification();
  }, [token]);

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Memeriksa keabsahan dokumen digital...</div>;
  }

  if (errorMsg || !data) {
    return (
      <div className="bg-red-50 p-8 rounded-lg border border-red-200 text-center max-w-md mx-auto my-12 text-red-900">
        <h2 className="text-xl font-bold mb-2">Verifikasi Gagal</h2>
        <p className="text-sm text-red-700">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border border-slate-200 max-w-xl mx-auto my-12 text-slate-800">
      <div className="text-center pb-6 border-b mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Portal Verifikasi Keabsahan Dokumen</span>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">PT UTAMA CORP</h1>

        <div className="mt-4 inline-flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-4 py-2 rounded-full border border-emerald-200">
          <span className="font-bold text-sm">VALID &amp; TERVERIFIKASI RESMI</span>
        </div>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex justify-between border-b pb-2">
          <span className="text-slate-500">Nomor Memo Resmi</span>
          <span className="font-mono font-bold text-sky-800">{data.memoNumber}</span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-slate-500">Judul Dokumen</span>
          <span className="font-semibold text-slate-800 text-right">{data.title}</span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-slate-500">Kategori / Tipe</span>
          <span className="text-slate-700">{data.categoryName} ({data.typeName})</span>
        </div>

        {data.signer && (
          <div className="bg-slate-50 p-4 rounded border my-4 space-y-1">
            <div className="text-xs font-bold text-slate-500 uppercase">Informasi Penandatangan Digital</div>
            <div className="font-bold text-slate-900">{data.signer.fullName}</div>
            <div className="text-xs text-slate-600">{data.signer.position || "Jabatan Perusahaan"} - {data.signer.departmentName || "-"}</div>
            {data.signer.employeeId && <div className="text-xs font-mono text-slate-500">NIP: {data.signer.employeeId}</div>}
          </div>
        )}

        <div className="flex justify-between border-b pb-2 text-xs">
          <span className="text-slate-500">Waktu Penandatanganan</span>
          <span className="text-slate-700">{data.signedAt ? new Date(data.signedAt).toLocaleString("id-ID") : "-"}</span>
        </div>

        <div className="pt-2">
          <span className="block text-xs font-semibold text-slate-500 mb-1">Checksum Hash SHA-256 (Canonical PDF):</span>
          <code className="block bg-slate-100 p-2 rounded text-[11px] font-mono break-all text-slate-700 border">
            {data.documentHashSha256}
          </code>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";

const REPORT_TYPES: { value: string; label: string }[] = [
  { value: "incoming", label: "Memo Masuk" },
  { value: "outgoing", label: "Memo Keluar" },
  { value: "status", label: "Ringkasan Status" },
  { value: "approval", label: "Ringkasan Persetujuan" },
  { value: "late", label: "Terlambat (Approval & Tugas)" },
  { value: "unread", label: "Belum Dibaca" },
  { value: "task", label: "Ringkasan Tugas" },
  { value: "category", label: "Per Kategori" },
  { value: "department", label: "Per Departemen" },
  { value: "user-activity", label: "Aktivitas Pengguna (Audit)" },
];

interface ExportJob {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorLog?: string | null;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState("status");
  const [reportData, setReportData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [exportError, setExportError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  async function loadReport() {
    setLoading(true);
    setErrorMsg("");
    setReportData(null);
    const res = await apiClient(`/reports/${reportType}`);
    setLoading(false);
    if (res.success) {
      setReportData(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat laporan");
    }
  }

  async function requestExport() {
    setExportError("");
    setDownloadUrl("");
    const res = await apiClient<ExportJob>("/exports", {
      method: "POST",
      body: JSON.stringify({ reportType, exportType: "CSV", filters: {} }),
    });
    if (res.success && res.data) {
      setExportJob(res.data);
      pollExportStatus(res.data.id);
    } else {
      setExportError(res.error?.message || "Gagal membuat permintaan export");
    }
  }

  function pollExportStatus(jobId: string) {
    const interval = setInterval(async () => {
      const res = await apiClient<ExportJob>(`/exports/${jobId}`);
      if (res.success && res.data) {
        setExportJob(res.data);
        if (res.data.status === "COMPLETED") {
          clearInterval(interval);
          const dl = await apiClient<{ downloadUrl: string }>(`/exports/${jobId}/download`);
          if (dl.success && dl.data) setDownloadUrl(dl.data.downloadUrl);
        } else if (res.data.status === "FAILED") {
          clearInterval(interval);
          setExportError(res.data.errorLog || "Export gagal diproses");
        }
      } else {
        clearInterval(interval);
      }
    }, 2000);
  }

  return (
    <Card>
      <CardHead title="Laporan" />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Pilih jenis laporan untuk melihat ringkasan, atau export sebagai CSV.</p>

      <div className="flex flex-wrap gap-3 items-center mb-6">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="border border-ums-border rounded-md px-3 py-2.5 text-sm"
          aria-label="Jenis laporan"
        >
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button onClick={loadReport} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2.5 rounded-md text-sm transition">
          Tampilkan
        </button>
        <button onClick={requestExport} className="bg-white border border-ums-border text-ums-text font-bold px-4 py-2.5 rounded-md text-sm transition">
          Export CSV
        </button>
      </div>

      {exportJob && (
        <div className="mb-4 text-sm border border-ums-border rounded-lg p-3 bg-slate-50">
          <p>
            Status export: <span className="font-semibold">{exportJob.status}</span>
          </p>
          {exportError && <p className="text-red-600 text-xs mt-1">{exportError}</p>}
          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-ums-blue font-semibold text-xs hover:underline">
              Unduh hasil export
            </a>
          )}
        </div>
      )}

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat laporan...</div>
      ) : reportData ? (
        <pre className="bg-slate-50 border border-ums-border rounded-lg p-4 text-xs overflow-x-auto">
          {JSON.stringify(reportData, null, 2)}
        </pre>
      ) : (
        <div className="text-center py-10 text-slate-400 text-sm">Pilih jenis laporan lalu klik &quot;Tampilkan&quot;.</div>
      )}
    </Card>
  );
}

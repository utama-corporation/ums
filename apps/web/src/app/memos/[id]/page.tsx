"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { MemoStatusBadge, PriorityBadge, Badge } from "@/components/ui/Badge";

interface MemoDetail {
  id: string;
  memoNumber: string | null;
  title: string;
  status: string;
  priority: string;
  classification: string;
  memoDate: string;
  deadline: string | null;
  currentVersion: number;
  category?: { name: string } | null;
  memoType?: { name: string } | null;
  senders: { id: string; partyType: string; displayName: string }[];
  recipients: { id: string; partyType: string; displayName: string; email: string | null }[];
  ccs: { id: string; partyType: string; displayName: string }[];
  contentVersions: { version: number; bodyHtml: string; createdAt: string }[];
  attachments: { id: string; attachmentObject: { id: string; fileName: string; fileSize: number; status: string; mimeType: string } }[];
  statusHistory: { id: string; fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }[];
  capabilities: {
    canEdit: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canApprove: boolean;
    canReject: boolean;
    canRevision: boolean;
    canDistribute: boolean;
    canPublish: boolean;
    canArchive: boolean;
  };
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function MemoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [memo, setMemo] = useState<MemoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState(false);
  const [uploading, setUploading] = useState(false);

  function showMessage(msg: string, isError: boolean) {
    setActionMsg(msg);
    setActionError(isError);
  }

  async function load() {
    setLoading(true);
    const res = await apiClient<MemoDetail>(`/memos/${params.id}`);
    setLoading(false);
    if (res.success && res.data) {
      setMemo(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat detail memo");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function runAction(path: string, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionMsg("");
    const res = await apiClient(`/memos/${params.id}${path}`, { method: "POST" });
    if (res.success) {
      showMessage(res.message || "Aksi berhasil dijalankan", false);
      load();
    } else {
      showMessage(res.error?.message || "Aksi gagal dijalankan", true);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !memo) return;

    setUploading(true);
    setActionMsg("");
    try {
      const initiateRes = await apiClient<{ attachmentId: string; uploadUrl: string }>(`/memos/${memo.id}/attachments/initiate`, {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type || "application/octet-stream" }),
      });
      if (!initiateRes.success || !initiateRes.data) {
        throw new Error(initiateRes.error?.message || "Gagal memulai unggahan lampiran");
      }

      const putRes = await fetch(initiateRes.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Gagal mengunggah berkas ke storage (HTTP ${putRes.status}). Pastikan object storage (MinIO/S3) aktif dan dapat diakses.`);
      }

      const checksum = await sha256Hex(file);
      const completeRes = await apiClient(`/attachments/${initiateRes.data.attachmentId}/complete`, {
        method: "POST",
        body: JSON.stringify({ checksumSha256: checksum }),
      });
      if (!completeRes.success) {
        throw new Error(completeRes.error?.message || "Gagal memverifikasi lampiran setelah unggah");
      }

      showMessage(`Lampiran "${file.name}" berhasil diunggah.`, false);
      load();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "Gagal mengunggah lampiran", true);
    } finally {
      setUploading(false);
    }
  }

  async function downloadAttachment(attachmentId: string) {
    const res = await apiClient<{ downloadUrl: string }>(`/attachments/${attachmentId}/download`);
    if (res.success && res.data) {
      window.open(res.data.downloadUrl, "_blank", "noopener,noreferrer");
    } else {
      showMessage(res.error?.message || "Gagal mengunduh lampiran", true);
    }
  }

  if (loading) return <div className="text-center py-10 text-slate-500 text-sm">Memuat detail memo...</div>;
  if (errorMsg || !memo) {
    return <div className="bg-red-50 text-red-700 text-sm p-4 rounded border border-red-200">{errorMsg || "Memo tidak ditemukan"}</div>;
  }

  const latestContent = memo.contentVersions[0];
  const caps = memo.capabilities;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-ums-blue font-bold text-sm">{memo.memoNumber || "Belum bernomor (draft)"}</span>
              <MemoStatusBadge status={memo.status} />
              <PriorityBadge priority={memo.priority} />
              <Badge label={memo.classification} color="gray" />
            </div>
            <h1 className="text-xl font-bold text-ums-text">{memo.title}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {memo.category?.name || "-"} &middot; {memo.memoType?.name || "-"} &middot; {new Date(memo.memoDate).toLocaleDateString("id-ID")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {caps.canSubmit && (
              <button onClick={() => runAction("/submit", "Ajukan memo ini untuk persetujuan?")} className="bg-ums-blue text-white font-bold text-xs px-3 py-2 rounded-md">
                Ajukan Persetujuan
              </button>
            )}
            {caps.canDistribute && (
              <button onClick={() => runAction("/distribute", "Distribusikan memo ini ke penerima?")} className="bg-ums-green text-white font-bold text-xs px-3 py-2 rounded-md">
                Distribusikan
              </button>
            )}
            {caps.canPublish && (
              <button onClick={() => runAction("/publish", "Publikasikan memo ini? Setelah dipublikasikan, isi tidak dapat diubah.")} className="bg-ums-red text-white font-bold text-xs px-3 py-2 rounded-md">
                Publikasikan
              </button>
            )}
            {caps.canArchive && (
              <button onClick={() => runAction("/archive", "Arsipkan memo ini?")} className="bg-white border border-ums-border font-bold text-xs px-3 py-2 rounded-md">
                Arsipkan
              </button>
            )}
            {caps.canDelete && (
              <button
                onClick={async () => {
                  if (!window.confirm("Hapus draf ini secara permanen?")) return;
                  const res = await apiClient(`/memos/${memo.id}`, { method: "DELETE" });
                  if (res.success) router.push("/memos/drafts");
                  else showMessage(res.error?.message || "Gagal menghapus draf", true);
                }}
                className="bg-white border border-red-200 text-red-600 font-bold text-xs px-3 py-2 rounded-md"
              >
                Hapus Draf
              </button>
            )}
          </div>
        </div>
        {actionMsg && (
          <div
            className={`text-sm p-3 rounded border mt-3 ${
              actionError ? "bg-red-50 text-red-700 border-red-200" : "bg-[#e5f7ed] text-[#10834d] border-[#c5ecd6]"
            }`}
          >
            {actionMsg}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHead title="Isi Memo" />
            {latestContent ? (
              <div className="prose prose-sm max-w-none text-ums-text" dangerouslySetInnerHTML={{ __html: latestContent.bodyHtml }} />
            ) : (
              <p className="text-sm text-slate-400">Belum ada konten.</p>
            )}
          </Card>

          {(memo.attachments.length > 0 || caps.canEdit) && (
            <Card>
              <CardHead title="Lampiran" />
              {memo.attachments.length === 0 ? (
                <p className="text-sm text-slate-400 mb-3">Belum ada lampiran.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {memo.attachments.map((a) => (
                    <div key={a.id} className="flex justify-between items-center border border-ums-border rounded-lg p-2.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-ums-text truncate block">{a.attachmentObject.fileName}</span>
                        <span className="text-xs text-slate-500">{(a.attachmentObject.fileSize / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          label={a.attachmentObject.status}
                          color={a.attachmentObject.status === "READY" ? "green" : a.attachmentObject.status === "QUARANTINED" ? "red" : "orange"}
                        />
                        {a.attachmentObject.status === "READY" && (
                          <button onClick={() => downloadAttachment(a.attachmentObject.id)} className="text-ums-blue font-bold text-xs">
                            Unduh
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {caps.canEdit && (
                <div>
                  <label className="inline-block bg-white border border-ums-border rounded-md px-3 py-2 text-xs font-bold cursor-pointer">
                    {uploading ? "Mengunggah..." : "+ Unggah Lampiran"}
                    <input type="file" className="hidden" disabled={uploading} onChange={handleFileSelected} />
                  </label>
                  <p className="text-xs text-slate-400 mt-2">Format PDF, DOCX, XLSX, JPG, PNG. Maks. 25 MB.</p>
                </div>
              )}
            </Card>
          )}

          <Card>
            <CardHead title="Riwayat Status" />
            {memo.statusHistory.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada riwayat.</p>
            ) : (
              <div className="space-y-2">
                {memo.statusHistory.map((h) => (
                  <div key={h.id} className="flex justify-between items-start border-b border-ums-border last:border-b-0 pb-2 text-sm">
                    <div>
                      <span className="font-medium text-ums-text">
                        {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                      </span>
                      {h.reason && <p className="text-xs text-slate-500 mt-0.5">{h.reason}</p>}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{new Date(h.createdAt).toLocaleString("id-ID")}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHead title="Pengirim" />
            <div className="space-y-1 text-sm">
              {memo.senders.map((s) => (
                <div key={s.id} className="text-ums-text">{s.displayName}</div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHead title="Penerima" />
            <div className="space-y-1 text-sm">
              {memo.recipients.length === 0 ? (
                <p className="text-slate-400 text-xs">Belum ada penerima</p>
              ) : (
                memo.recipients.map((r) => (
                  <div key={r.id} className="text-ums-text">
                    {r.displayName} <span className="text-xs text-slate-400">({r.partyType})</span>
                  </div>
                ))
              )}
            </div>
          </Card>
          {memo.ccs.length > 0 && (
            <Card>
              <CardHead title="Tembusan / CC" />
              <div className="space-y-1 text-sm">
                {memo.ccs.map((c) => (
                  <div key={c.id} className="text-ums-text">{c.displayName}</div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

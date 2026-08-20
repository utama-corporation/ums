import React from "react";
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center max-w-lg mx-auto my-12">
      <h1 className="text-4xl font-bold text-amber-600 mb-2">403</h1>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Akses Ditolak</h2>
      <p className="text-slate-600 text-sm mb-6">
        Anda tidak memiliki izin (permission) atau wewenang untuk mengakses halaman atau fitur ini.
      </p>
      <Link href="/" className="inline-block bg-sky-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-sky-700">
        Kembali ke Beranda
      </Link>
    </div>
  );
}

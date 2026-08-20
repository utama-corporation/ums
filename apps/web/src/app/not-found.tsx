import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center">
      <h1 className="text-4xl font-bold text-slate-800 mb-2">404</h1>
      <h2 className="text-xl font-semibold text-slate-700 mb-4">Halaman Tidak Ditemukan</h2>
      <p className="text-slate-500 mb-6">Halaman yang Anda cari tidak tersedia atau telah dipindahkan.</p>
      <Link href="/" className="inline-block bg-ums-red text-white px-4 py-2 rounded-md font-bold hover:opacity-90">
        Kembali ke Beranda
      </Link>
    </div>
  );
}

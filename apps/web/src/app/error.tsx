"use client";

import React, { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled UI error:", error);
  }, [error]);

  return (
    <div className="bg-red-50 p-6 rounded-lg border border-red-200 text-red-900">
      <h2 className="text-lg font-bold mb-2">Terjadi Kesalahan Sistem</h2>
      <p className="text-sm text-red-700 mb-4">{error.message || "Gagal memproses tampilan aplikasi."}</p>
      <button
        onClick={() => reset()}
        className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
      >
        Coba Lagi
      </button>
    </div>
  );
}

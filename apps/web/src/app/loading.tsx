import React from "react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      <span className="ml-3 text-slate-600">Memuat halaman...</span>
    </div>
  );
}

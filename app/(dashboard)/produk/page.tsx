"use client";

import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import { 
  Plus, Search, Trash2, Tag, Boxes, 
  AlertCircle, CheckCircle2
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string | null;
  isActive: boolean;
};

type ToastData = {
  message: string;
  type: string;
};

export default function ProdukPage() {
  const darkMode = false;
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // State Form
  const [form, setForm] = useState({ name: "", price: "", stock: "", category: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const triggerToast = useCallback((message: string, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // --- FETCH DATA ---
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal ambil produk");
      }
      if (!Array.isArray(data)) {
        throw new Error("Format data produk tidak valid");
      }
      setProducts(data);
    } catch (error) {
      console.error("Gagal ambil produk", error);
      triggerToast(
        error instanceof Error ? error.message : "Gagal ambil produk",
        "error"
      );
    }
  }, [triggerToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchProducts]);

  // --- SIMPAN PRODUK ---
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      if (res.ok) {
        setForm({ name: "", price: "", stock: "", category: "" });
        fetchProducts();
        triggerToast("Produk berhasil ditambahkan!");
      } else {
        triggerToast("Gagal menambahkan produk", "error");
      }
    } catch (error) {
      triggerToast(
        error instanceof Error ? error.message : "Terjadi kesalahan sistem",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --- HAPUS PRODUK ---
  const handleDelete = async (id: string) => {
    if (confirm("Nonaktifkan produk ini? Produk dengan riwayat transaksi akan tetap tersimpan.")) {
      try {
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal menonaktifkan produk");
        }
        fetchProducts();
        triggerToast("Produk berhasil dinonaktifkan", "info");
      } catch (error) {
        triggerToast(
          error instanceof Error ? error.message : "Gagal menonaktifkan produk",
          "error"
        );
      }
    }
  };

  // --- FILTER PENCARIAN ---
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.isActive !== false &&
      (
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    );
  }, [products, searchQuery]);

  return (
    <div className={`min-h-screen p-6 transition-colors duration-200 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100/90 text-slate-800'}`}>
      
      {/* TOAST */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className={`px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium border ${toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500' : toast.type === 'info' ? 'bg-slate-800 text-white border-slate-700' : 'bg-emerald-600 text-white border-emerald-500'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER & PENCARIAN */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Boxes className="w-6 h-6 text-indigo-500" /> 
              Manajemen Produk
            </h1>
            <p className="text-sm text-slate-500 mt-1">Kelola daftar barang jualan & stok lo di sini.</p>
          </div>
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Cari nama / kategori..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${darkMode ? 'bg-slate-900 border-slate-800 focus:border-indigo-500' : 'bg-white border-slate-200 focus:border-indigo-500 shadow-sm'}`}
            />
          </div>
        </div>

        {/* FORM TAMBAH PRODUK */}
        <div className={`rounded-2xl border p-5 sm:p-6 shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Tambah Produk Baru</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input 
              type="text" placeholder="Nama Produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className={`md:col-span-2 px-4 py-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
            />
            <input 
              type="number" placeholder="Harga (Rp)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required
              className={`px-4 py-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
            />
            <input 
              type="number" placeholder="Stok Awal" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required
              className={`px-4 py-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
            />
            <input 
              type="text" placeholder="Kategori (Kopi/Makanan)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={`px-4 py-2.5 rounded-xl border text-sm outline-none ${darkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
            />
            
            <button 
              type="submit" disabled={isLoading}
              className={`md:col-span-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mt-2 ${darkMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md'}`}
            >
              {isLoading ? "Menyimpan..." : <><Plus className="w-4 h-4" /> Simpan Produk</>}
            </button>
          </form>
        </div>

        {/* DAFTAR PRODUK (GRID) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">Belum ada produk yang cocok.</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div 
                key={product.id} 
                className={`group relative rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-base leading-tight line-clamp-2">{product.name}</h3>
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'hover:bg-slate-800 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                    Rp {product.price.toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${product.stock <= 5 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                    Stok: {product.stock}
                  </span>
                  {product.category && (
                    <span className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      <Tag className="w-3 h-3" /> {product.category}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
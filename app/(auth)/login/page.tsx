"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Coffee, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Username atau password tidak sesuai.");
        return;
      }

      router.push("/kasir");
      router.refresh();
    } catch (error) {
      console.error("Login failed", error);
      setError("Gagal masuk. Coba lagi sebentar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100/90 px-4 py-10 text-slate-800">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-md">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-950">
              KasirKu <span className="text-indigo-600">POS</span>
            </h1>
            <p className="text-xs font-medium text-slate-400">Warung Kopi</p>
          </div>
        </div>

        <div className="mb-7 border-t border-slate-100 pt-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            Selamat datang
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Masuk untuk melanjutkan ke dashboard tokomu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-semibold text-slate-700">
              Username
            </label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="h-11 rounded-xl border-slate-200 bg-slate-50 px-3 text-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-semibold text-slate-700">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 rounded-xl border-slate-200 bg-slate-50 px-3 text-sm focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700"
            disabled={isLoading}
          >
            {isLoading ? "Memproses..." : "Masuk ke dashboard"}
          </Button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <LockKeyhole className="h-3.5 w-3.5 text-indigo-500" />
          Akses aman untuk tim tokomu
        </p>
      </section>
    </main>
  );
}
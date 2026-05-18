import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServerClient } from "@/lib/supabase/server";
import { FlagRow } from "./_components/FlagRow";

export default async function FlagsPage() {
  await requireAdmin();
  const sb = getServerClient();
  const { data: flags } = await sb
    .from("feature_flags")
    .select("*")
    .order("key");

  return (
    <div className="space-y-6 p-8 bg-zinc-950 min-h-screen text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Feature Flags</h1>
          <p className="text-sm text-zinc-400">機能フラグの切り替え、部分ロールアウト率の調整、およびプラン別のアクセス権限割り当て</p>
        </div>
      </header>
      
      <div className="divide-y divide-zinc-800/60 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden backdrop-blur-md">
        {(flags ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">登録されている機能フラグはありません</div>
        ) : (
          (flags ?? []).map((f) => <FlagRow key={f.key} flag={f as any} />)
        )}
      </div>
    </div>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">YES or YES</h1>
      <p className="text-slate-400">Three guppies decide your life.</p>
      <Link
        href="/display"
        className="px-6 py-3 rounded-md bg-glow/20 border border-glow text-glow hover:bg-glow/30 transition"
      >
        Open TV display →
      </Link>
    </main>
  );
}

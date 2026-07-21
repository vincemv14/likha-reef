import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-sky-900 via-blue-900 to-sky-950">
      <div className="max-w-md mx-auto space-y-8">
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 to-teal-200 bg-clip-text text-transparent">
          🐠 LIKHA-Reef
        </h1>
        <p className="text-lg text-sky-200 leading-relaxed">
          Draw a sea creature on paper, snap a photo, and watch it come alive in
          our shared digital aquarium!
        </p>
        <div className="flex flex-col gap-4">
          <Link
            href="/capture"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white shadow-lg shadow-teal-500/30 transition-all hover:scale-105"
          >
            📸 Start Creating
          </Link>
          <Link
            href="/aquarium"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-2xl border-2 border-sky-400/50 hover:bg-sky-800/50 text-sky-200 transition-all"
          >
            🌊 View Aquarium
          </Link>
        </div>
      </div>
    </main>
  );
}

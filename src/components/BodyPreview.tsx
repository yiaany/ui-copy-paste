export function BodyPreview() {
  return (
    <div className="relative w-full min-h-screen overflow-hidden text-[#f5f5f5] bg-[#0a0a0a] font-mono leading-[24px]">
      <header className="flex justify-between items-center max-w-7xl mx-auto px-6 py-4 border-b border-[#171717]">
        <a className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#f5f5f5] hover:opacity-90" href="/">
          <span>\ (^_^) /</span>
          <span className="text-[#737373]">devquest</span>
        </a>
        <nav className="flex items-center gap-6 text-sm">
          <a className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors" href="/build">build card</a>
          <div className="flex items-center gap-4">
            <span className="text-[#737373]">@yiaany</span>
            <a className="px-3 py-1.5 rounded-md text-[#0a0a0a] bg-[#f5f5f5] font-medium hover:opacity-90 transition-opacity" href="/build">constructor</a>
            <button className="text-[#737373] hover:text-[#f5f5f5] transition-colors">sign out</button>
          </div>
        </nav>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-20 text-center flex flex-col items-center">
        <div className="max-w-2xl flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-[#fafafa] to-[#a3a3a3] bg-clip-text text-transparent leading-tight md:leading-[1.1] text-center">
            Turn your GitHub stats into a profile card worth showing off.
          </h1>
          <p className="max-w-lg mt-6 text-lg text-[#a3a3a3] text-center">
            An ultra-clean, minimalist terminal card generator for your profile README. No server setup, no static image lag.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10">
            <a className="w-48 py-3 rounded-lg text-[#0a0a0a] bg-[#f5f5f5] font-medium text-center hover:opacity-90 transition-opacity" href="/build">
              build yours now
            </a>
            <button className="w-48 py-3 border border-[#262626] rounded-lg text-[#a3a3a3] bg-[#171717]/50 hover:bg-[#171717] hover:text-[#f5f5f5] transition-all">
              login with github
            </button>
          </div>
        </div>

        <div className="relative max-w-2xl w-full mt-20 p-1 overflow-hidden border border-[#171717] rounded-xl bg-[#0a0a0a] shadow-2xl">
          <div className="overflow-hidden rounded-lg bg-[#0a0a0a] border border-[#171717] aspect-[2.22/1]">
            <img className="w-full h-full object-cover" src="/card/octocat.svg?ascii=1" alt="DevQuest Card Preview" />
          </div>
        </div>
      </section>

      <section className="border-t border-[#171717] bg-[#0a0a0a]/40 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-xs font-semibold tracking-[0.05em] text-[#737373] text-center uppercase">process</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="p-6 border border-[#171717] rounded-lg bg-[#0a0a0a]">
              <span className="text-sm font-bold text-[#525252]">01</span>
              <h3 className="mt-4 text-base font-semibold text-[#e5e5e5]">OAuth Connect</h3>
              <p className="mt-2 text-sm text-[#a3a3a3] leading-relaxed">Authorize using your GitHub profile. Safe, read-only scope.</p>
            </div>
            <div className="p-6 border border-[#171717] rounded-lg bg-[#0a0a0a]">
              <span className="text-sm font-bold text-[#525252]">02</span>
              <h3 className="mt-4 text-base font-semibold text-[#e5e5e5]">Customize & Preview</h3>
              <p className="mt-2 text-sm text-[#a3a3a3] leading-relaxed">Pick themes, colors, and configure which stats to show inside the terminal card.</p>
            </div>
            <div className="p-6 border border-[#171717] rounded-lg bg-[#0a0a0a]">
              <span className="text-sm font-bold text-[#525252]">03</span>
              <h3 className="mt-4 text-base font-semibold text-[#e5e5e5]">README Embed</h3>
              <p className="mt-2 text-sm text-[#a3a3a3] leading-relaxed">Paste the generated markdown link into the README.md of your special repository named exactly matching your GitHub username.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#171717] py-20 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xs font-semibold tracking-[0.05em] text-[#737373] uppercase">audience</h2>
          <h3 className="mt-4 text-3xl font-bold text-[#f5f5f5]">Designed for engineers who care about detail.</h3>
          <p className="max-w-xl mx-auto mt-4 text-base text-[#a3a3a3] leading-relaxed">
            Whether you want a clean list of stats for job applications, or an ASCII window to show your stack, DevQuest makes it minimal.
          </p>
        </div>
      </section>

      <footer className="border-t border-[#171717] py-8 text-center text-xs text-[#525252]">
        <p>© 2026 DevQuest. MIT License. Open-source on GitHub.</p>
      </footer>
    </div>
  );
}

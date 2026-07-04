import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  AudioWaveform,
  BadgeCheck,
  Box,
  CheckCircle2,
  Chrome,
  Film,
  Grid2X2,
  House,
  Image as ImageIcon,
  Info,
  Layers,
  LockKeyhole,
  Mail,
  Plug,
  Puzzle,
  Scissors,
  Sun,
  UserPlus,
} from "lucide-react";

const tools = [
  {
    title: "Video Palette",
    description: "Extract palettes from videos, YouTube links, or local files.",
    href: "/tools/video-palette",
    icon: Film,
    accent: "text-[#e46f17]",
    iconBg: "bg-[#fff5ee]",
    status: "Live demo",
  },
  {
    title: "Frame Palette",
    description: "Create frame previews and export-ready swatches for visual assets.",
    href: "/tools/frame-palette",
    icon: ImageIcon,
    accent: "text-[#4f8739]",
    iconBg: "bg-[#f2f8f0]",
    status: "Demo route",
  },
];

const upcomingTools = [
  { title: "Image Lab", icon: ImageIcon, accent: "text-[#4c78a8]", iconBg: "bg-[#eef5fb]" },
  { title: "Audio Keys", icon: AudioWaveform, accent: "text-[#2c8a75]", iconBg: "bg-[#edf7f5]" },
  { title: "Poster Cut", icon: Scissors, accent: "text-[#c56c32]", iconBg: "bg-[#fbf1ea]" },
];

const infoCards = [
  {
    title: "One catalog, many media workflows",
    body: "Tools, plugins, and extensions share the same visual index, so new modules can be added without redesigning the home.",
    icon: Layers,
  },
  {
    title: "Demo-first product surface",
    body: "The sections below are intentionally non-operational for now. They define product shape before backend wiring.",
    icon: Info,
  },
  {
    title: "Registration placeholder",
    body: "The registration form is static. No account is created and no data is stored in this mockup.",
    icon: UserPlus,
  },
];

const wordpressPlugins = [
  {
    title: "Palette Blocks",
    description: "A WordPress block mockup for publishing extracted palettes inside posts and landing pages.",
    icon: Plug,
  },
  {
    title: "Media Kit Sync",
    description: "A demo plugin card for syncing exported colors and thumbnails into a site media library.",
    icon: Puzzle,
  },
  {
    title: "Editorial Swatches",
    description: "A planned plugin surface for reusable palette presets across editorial templates.",
    icon: Box,
  },
];

const chromeExtensions = [
  {
    title: "Palette Grabber",
    description: "Capture color references from video and image pages directly in Chrome.",
    icon: Chrome,
  },
  {
    title: "Frame Saver",
    description: "A mock extension for saving current media frames into the local palette workflow.",
    icon: Film,
  },
  {
    title: "Quick Export",
    description: "Prepare shareable palette snippets from the browser toolbar.",
    icon: ArrowRight,
  },
];

export function ToolsHome() {
  return (
    <main
      className="tools-home-shell min-h-screen bg-[#f0eeec] text-[#4a433d]"
      style={{ colorScheme: "light" }}
    >
      <style>{`
        html:has(.tools-home-shell),
        body:has(.tools-home-shell) {
          background: #f0eeec;
          color-scheme: light;
        }
      `}</style>
      <header className="border-b border-[#e2ddd7] bg-[#f8f7f5]/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="VAC Tools home">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#7b6a5e] bg-[#fdfcfa] text-[16px] font-semibold tracking-tight text-[#251f1b]">
              VAC
            </span>
            <span className="truncate text-[18px] font-semibold tracking-tight text-[#251f1b]">
              VAC Tools
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <a
              href="#top"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ded8d1] bg-[#fdfcfa] px-4 text-[14px] font-medium text-[#4a433d] shadow-[0_1px_2px_rgba(47,38,30,.035)]"
            >
              <House className="h-4 w-4" />
              Home
            </a>
            <a href="#tools" className="inline-flex h-10 items-center gap-2 px-3 text-[14px] font-medium text-[#665f57] hover:text-[#251f1b]">
              <Grid2X2 className="h-4 w-4" />
              Tools
            </a>
            <a href="#wordpress" className="inline-flex h-10 items-center gap-2 px-3 text-[14px] font-medium text-[#665f57] hover:text-[#251f1b]">
              <Plug className="h-4 w-4" />
              WP Plugins
            </a>
            <a href="#extensions" className="inline-flex h-10 items-center gap-2 px-3 text-[14px] font-medium text-[#665f57] hover:text-[#251f1b]">
              <Chrome className="h-4 w-4" />
              Extensions
            </a>
            <a href="#register" className="inline-flex h-10 items-center gap-2 px-3 text-[14px] font-medium text-[#665f57] hover:text-[#251f1b]">
              <UserPlus className="h-4 w-4" />
              Register
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden h-10 items-center gap-2 rounded-full border border-[#e2ddd7] bg-[#fdfcfa] px-4 text-[13px] font-medium text-[#665f57] sm:inline-flex">
              <span className="h-2.5 w-2.5 rounded-full bg-[#48a34a]" />
              Demo mode
            </span>
            <span className="hidden h-8 w-px bg-[#ddd7d0] sm:block" />
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-md text-[#665f57] transition-colors hover:bg-[#e8e6e3]"
              aria-label="Theme preview"
            >
              <Sun className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div
        id="top"
        className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,0.82fr)_minmax(560px,1.18fr)] lg:gap-14"
      >
        <section className="flex flex-col justify-between gap-9 lg:min-h-[520px]">
          <div className="max-w-xl">
            <div className="mb-8 grid h-[72px] w-[72px] place-items-center rounded-lg border border-[#ded8d1] bg-[#fdfcfa] shadow-[0_1px_2px_rgba(47,38,30,.035),0_14px_34px_-28px_rgba(47,38,30,.34)]">
              <Grid2X2 className="h-8 w-8 text-[#4a433d]" strokeWidth={1.9} />
            </div>
            <h1 className="text-balance text-[42px] font-semibold leading-[1.08] tracking-normal text-[#251f1b] sm:text-[58px] lg:text-[62px]">
              Media tools for fast creative work
            </h1>
            <p className="mt-7 max-w-md text-[18px] leading-8 text-[#665f57] sm:text-[20px]">
              A compact workspace for palettes, frames, images, audio, browser helpers, and publishing plugins.
            </p>
          </div>

          <div className="hidden max-w-lg border-t border-[#ded8d1] pt-5 text-[13px] leading-6 text-[#7b746d] lg:block">
            Small by design: two usable tools today, with room for WordPress plugins,
            Chrome extensions, and media modules tomorrow.
          </div>
        </section>

        <section id="tools" className="grid gap-6 md:grid-cols-2" aria-label="Available tools">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.title}
                href={tool.href}
                className="group flex min-h-[314px] flex-col justify-between rounded-lg border border-[#d7d2cc] bg-[#fdfcfa] p-8 shadow-[0_1px_2px_rgba(47,38,30,.04),0_14px_34px_-28px_rgba(47,38,30,.34)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_1px_2px_rgba(47,38,30,.05),0_20px_44px_-30px_rgba(47,38,30,.42)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b524a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f0eeec]"
              >
                <div>
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div className={`grid h-[72px] w-[72px] place-items-center rounded-lg border border-[#d7d2cc] ${tool.iconBg}`}>
                      <Icon className={`h-8 w-8 ${tool.accent}`} strokeWidth={1.9} />
                    </div>
                    <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-[#e2ddd7] bg-[#f8f7f5] px-3 text-[12px] font-semibold uppercase tracking-normal text-[#7b746d]">
                      {tool.status}
                    </span>
                  </div>
                  <h2 className="text-[31px] font-semibold leading-tight tracking-normal text-[#251f1b]">
                    {tool.title}
                  </h2>
                  <p className="mt-5 max-w-[20rem] text-[17px] leading-7 text-[#665f57]">
                    {tool.description}
                  </p>
                </div>

                <span className="mt-10 inline-flex h-14 items-center justify-center gap-3 rounded-md bg-[#4b4138] px-5 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)] transition-colors group-hover:bg-[#332b25]">
                  Open tool
                  <ArrowUpRight className="h-5 w-5" />
                </span>
              </Link>
            );
          })}
        </section>
      </div>

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8" aria-label="Information">
        <div className="grid gap-5 md:grid-cols-3">
          {infoCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-lg border border-[#d7d2cc] bg-[#f8f7f5]/80 p-6">
                <Icon className="mb-5 h-6 w-6 text-[#5b524a]" strokeWidth={1.9} />
                <h2 className="text-[18px] font-semibold leading-6 text-[#251f1b]">{card.title}</h2>
                <p className="mt-3 text-[14px] leading-6 text-[#665f57]">{card.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8" aria-label="Upcoming tools">
        <h2 className="mb-5 text-[22px] font-semibold tracking-normal text-[#251f1b]">
          Upcoming tools
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {upcomingTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.title}
                className="flex min-h-[86px] items-center gap-5 rounded-lg border border-dashed border-[#d7d2cc] bg-[#f8f7f5]/70 px-6 text-[#8a837c]"
                aria-disabled="true"
              >
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-[#ded8d1] ${tool.iconBg}`}>
                  <Icon className={`h-6 w-6 ${tool.accent}`} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">
                  {tool.title}
                </span>
                <LockKeyhole className="h-5 w-5 shrink-0 text-[#9a928a]" strokeWidth={1.8} />
              </div>
            );
          })}
        </div>
      </section>

      <section id="wordpress" className="border-y border-[#e2ddd7] bg-[#f8f7f5]/68">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-[30px] font-semibold leading-tight text-[#251f1b]">
                WordPress plugins
              </h2>
              <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#665f57]">
                Mockup cards for future publishing integrations. They are placeholders, not installable packages.
              </p>
            </div>
            <span className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[#ded8d1] bg-[#fdfcfa] px-4 text-[13px] font-semibold text-[#665f57]">
              <BadgeCheck className="h-4 w-4" />
              Demo section
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {wordpressPlugins.map((plugin) => {
              const Icon = plugin.icon;
              return (
                <div key={plugin.title} className="rounded-lg border border-[#d7d2cc] bg-[#fdfcfa] p-6 shadow-[0_1px_2px_rgba(47,38,30,.035)]">
                  <div className="mb-8 flex items-center justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-lg border border-[#ded8d1] bg-[#f4f1ed] text-[#5b524a]">
                      <Icon className="h-6 w-6" strokeWidth={1.85} />
                    </span>
                    <span className="text-[12px] font-semibold uppercase tracking-normal text-[#8a837c]">Mockup</span>
                  </div>
                  <h3 className="text-[21px] font-semibold text-[#251f1b]">{plugin.title}</h3>
                  <p className="mt-3 text-[15px] leading-6 text-[#665f57]">{plugin.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="extensions" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-[30px] font-semibold leading-tight text-[#251f1b]">
              Chrome extensions
            </h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[#665f57]">
              Demo extension concepts for browser-side capture, frame saving, and quick export workflows.
            </p>
          </div>
          <span className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[#ded8d1] bg-[#fdfcfa] px-4 text-[13px] font-semibold text-[#665f57]">
            <Chrome className="h-4 w-4" />
            Preview only
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {chromeExtensions.map((extension) => {
            const Icon = extension.icon;
            return (
              <div key={extension.title} className="rounded-lg border border-dashed border-[#d7d2cc] bg-[#f8f7f5]/80 p-6">
                <div className="mb-8 flex items-center justify-between gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-lg border border-[#ded8d1] bg-[#eef5fb] text-[#4c78a8]">
                    <Icon className="h-6 w-6" strokeWidth={1.85} />
                  </span>
                  <LockKeyhole className="h-5 w-5 text-[#9a928a]" strokeWidth={1.8} />
                </div>
                <h3 className="text-[21px] font-semibold text-[#251f1b]">{extension.title}</h3>
                <p className="mt-3 text-[15px] leading-6 text-[#665f57]">{extension.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="register" className="mx-auto max-w-7xl px-5 pb-14 sm:px-8 sm:pb-16">
        <div className="grid gap-6 rounded-lg border border-[#d7d2cc] bg-[#fdfcfa] p-6 shadow-[0_1px_2px_rgba(47,38,30,.04),0_18px_44px_-34px_rgba(47,38,30,.36)] md:grid-cols-[0.8fr_1.2fr] md:p-8">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <div className="mb-6 grid h-12 w-12 place-items-center rounded-lg border border-[#ded8d1] bg-[#f4f1ed] text-[#5b524a]">
                <UserPlus className="h-6 w-6" strokeWidth={1.9} />
              </div>
              <h2 className="text-[30px] font-semibold leading-tight text-[#251f1b]">
                Register for early access
              </h2>
              <p className="mt-4 max-w-md text-[16px] leading-7 text-[#665f57]">
                Static registration mockup for now. It shows the intended flow before authentication and storage are added.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[13px] font-medium text-[#7b746d]">
              <CheckCircle2 className="h-4 w-4 text-[#4f8739]" />
              Demo only. No data is submitted.
            </div>
          </div>

          <form className="grid gap-4" aria-label="Demo registration form">
            <div className="grid gap-2">
              <label htmlFor="demo-name" className="text-[13px] font-semibold text-[#4a433d]">
                Name
              </label>
              <input
                id="demo-name"
                name="name"
                type="text"
                placeholder="Creative team"
                className="h-12 rounded-md border border-[#d7d2cc] bg-[#f8f7f5] px-4 text-[15px] text-[#251f1b] outline-none placeholder:text-[#9a928a] focus:border-[#5b524a]"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="demo-email" className="text-[13px] font-semibold text-[#4a433d]">
                Email
              </label>
              <input
                id="demo-email"
                name="email"
                type="email"
                placeholder="team@example.com"
                className="h-12 rounded-md border border-[#d7d2cc] bg-[#f8f7f5] px-4 text-[15px] text-[#251f1b] outline-none placeholder:text-[#9a928a] focus:border-[#5b524a]"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="demo-interest" className="text-[13px] font-semibold text-[#4a433d]">
                Interest
              </label>
              <select
                id="demo-interest"
                name="interest"
                className="h-12 rounded-md border border-[#d7d2cc] bg-[#f8f7f5] px-4 text-[15px] text-[#251f1b] outline-none focus:border-[#5b524a]"
                defaultValue="tools"
              >
                <option value="tools">Media tools</option>
                <option value="wordpress">WordPress plugins</option>
                <option value="chrome">Chrome extensions</option>
                <option value="all">Full suite</option>
              </select>
            </div>
            <button
              type="button"
              className="mt-2 inline-flex h-14 items-center justify-center gap-3 rounded-md bg-[#4b4138] px-5 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)] transition-colors hover:bg-[#332b25]"
            >
              <Mail className="h-5 w-5" />
              Register demo interest
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

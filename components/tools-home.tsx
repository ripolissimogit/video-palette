import Link from "next/link";
import {
  ArrowUpRight,
  AudioWaveform,
  CheckCircle2,
  Chrome,
  Film,
  Grid2X2,
  Image as ImageIcon,
  LockKeyhole,
  Mail,
  Palette,
  Plug,
  Scissors,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const tools = [
  {
    title: "Video Palette",
    line: "Pull palettes from motion.",
    description: "Video, YouTube, local files.",
    href: "/tools/video-palette",
    icon: Film,
    accent: "text-[#d86b2a] dark:text-[#f1a06f]",
    tile: "bg-[#fff3e9] dark:bg-[#2a1b14]",
    status: "Live",
  },
  {
    title: "Frame Palette",
    line: "Turn stills into swatches.",
    description: "Frames, previews, exports.",
    href: "/tools/frame-palette",
    icon: ImageIcon,
    accent: "text-[#4f7d52] dark:text-[#9bc58d]",
    tile: "bg-[#eef6eb] dark:bg-[#172516]",
    status: "Demo",
  },
];

const upcoming = [
  { title: "Image Lab", icon: ImageIcon },
  { title: "Audio Keys", icon: AudioWaveform },
  { title: "Poster Cut", icon: Scissors },
];

const wordpress = ["Palette Blocks", "Media Kit Sync", "Editorial Swatches"];
const chrome = ["Palette Grabber", "Frame Saver", "Quick Export"];
const swatches = ["#221c18", "#d86b2a", "#d8ad5f", "#4f7d52", "#537a9f", "#f8f3ea"];

function DemoList({
  title,
  icon: Icon,
  items,
  id,
}: {
  title: string;
  icon: typeof Plug;
  items: string[];
  id: string;
}) {
  return (
    <section
      id={id}
      className="rounded-lg border border-[#ddd5ca] bg-[#fbf8f2] p-6 dark:border-[#302820] dark:bg-[#181512]"
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md border border-[#ddd5ca] bg-[#f4eee4] text-[#564b41] dark:border-[#3a3129] dark:bg-[#211c18] dark:text-[#d8cec0]">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h2 className="text-[22px] font-semibold tracking-normal text-[#241f1a] dark:text-[#f4eee5]">
            {title}
          </h2>
        </div>
        <span className="text-[12px] font-semibold uppercase tracking-normal text-[#887c70] dark:text-[#9f9489]">
          Mockup
        </span>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <div
            key={item}
            className="flex min-h-12 items-center justify-between rounded-md border border-[#e6ded2] bg-[#fffdf8] px-4 text-[15px] font-medium text-[#4d443b] dark:border-[#302820] dark:bg-[#12100e] dark:text-[#ded4c7]"
          >
            {item}
            <LockKeyhole className="h-4 w-4 text-[#9a8e82]" strokeWidth={1.8} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ToolsHome() {
  return (
    <main className="tools-home-shell min-h-screen bg-[#f4f0ea] text-[#4d443b] dark:bg-[#13110f] dark:text-[#d8cec0]">
      <style>{`
        html:has(.tools-home-shell),
        body:has(.tools-home-shell) {
          background: #f4f0ea;
          color-scheme: light;
        }
        html.dark:has(.tools-home-shell),
        html.dark body:has(.tools-home-shell) {
          background: #13110f;
          color-scheme: dark;
        }
      `}</style>

      <header className="border-b border-[#e0d7ca] bg-[#fbf8f2]/88 backdrop-blur dark:border-[#2b241e] dark:bg-[#15120f]/88">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Colorificio home">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#7b6b5d] bg-[#fffdf8] text-[18px] font-semibold text-[#241f1a] dark:border-[#54483d] dark:bg-[#211c18] dark:text-[#f4eee5]">
              C
            </span>
            <span className="truncate text-[19px] font-semibold text-[#241f1a] dark:text-[#f4eee5]">
              Colorificio
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            <a href="#tools" className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ddd5ca] bg-[#fffdf8] px-4 text-[14px] font-medium text-[#4d443b] dark:border-[#302820] dark:bg-[#211c18] dark:text-[#ded4c7]">
              <Grid2X2 className="h-4 w-4" />
              Tools
            </a>
            <a href="#wordpress" className="inline-flex h-10 items-center gap-2 px-3 text-[14px] font-medium text-[#6d6257] hover:text-[#241f1a] dark:text-[#a79b8f] dark:hover:text-[#f4eee5]">
              <Plug className="h-4 w-4" />
              WP
            </a>
            <a href="#extensions" className="inline-flex h-10 items-center gap-2 px-3 text-[14px] font-medium text-[#6d6257] hover:text-[#241f1a] dark:text-[#a79b8f] dark:hover:text-[#f4eee5]">
              <Chrome className="h-4 w-4" />
              Chrome
            </a>
            <a href="#register" className="inline-flex h-10 items-center gap-2 px-3 text-[14px] font-medium text-[#6d6257] hover:text-[#241f1a] dark:text-[#a79b8f] dark:hover:text-[#f4eee5]">
              <UserPlus className="h-4 w-4" />
              Access
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden h-10 items-center gap-2 rounded-full border border-[#ddd5ca] bg-[#fffdf8] px-4 text-[13px] font-medium text-[#6d6257] dark:border-[#302820] dark:bg-[#211c18] dark:text-[#a79b8f] sm:inline-flex">
              <Sparkles className="h-4 w-4" />
              Preview
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] lg:gap-16 lg:py-28">
          <div className="flex flex-col justify-between gap-12">
            <div>
              <div className="mb-10 grid h-16 w-16 place-items-center rounded-lg border border-[#ddd5ca] bg-[#fffdf8] text-[#4d443b] shadow-[0_1px_2px_rgba(47,38,30,.035),0_20px_48px_-38px_rgba(47,38,30,.45)] dark:border-[#302820] dark:bg-[#211c18] dark:text-[#ded4c7]">
                <Palette className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h1 className="text-balance text-[58px] font-semibold leading-[0.94] tracking-normal text-[#241f1a] dark:text-[#f4eee5] sm:text-[82px] lg:text-[96px]">
                Colorificio
              </h1>
              <p className="mt-8 max-w-md text-[20px] leading-8 text-[#645a50] dark:text-[#b9ad9f]">
                Color from film, frames and the web.
              </p>
            </div>

            <div className="flex h-11 w-fit overflow-hidden rounded-md border border-[#d8d0c6] bg-[#fffdf8] dark:border-[#3a3129] dark:bg-[#211c18]">
              {swatches.map((color) => (
                <span
                  key={color}
                  className="h-11 w-12 border-r border-white/40 last:border-r-0"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <section id="tools" className="grid gap-5 md:grid-cols-2" aria-label="Available tools">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.title}
                  href={tool.href}
                  className="group flex min-h-[340px] flex-col justify-between rounded-lg border border-[#d8d0c6] bg-[#fffdf8] p-8 shadow-[0_1px_2px_rgba(47,38,30,.04),0_24px_56px_-46px_rgba(47,38,30,.5)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#675a4e] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4f0ea] dark:border-[#302820] dark:bg-[#181512] dark:shadow-none dark:hover:bg-[#1d1915] dark:focus-visible:ring-offset-[#13110f]"
                >
                  <div>
                    <div className="mb-10 flex items-start justify-between gap-4">
                      <div className={`grid h-[72px] w-[72px] place-items-center rounded-lg border border-[#d8d0c6] dark:border-[#3a3129] ${tool.tile}`}>
                        <Icon className={`h-8 w-8 ${tool.accent}`} strokeWidth={1.85} />
                      </div>
                      <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-[#e0d7ca] bg-[#f8f3ea] px-3 text-[12px] font-semibold uppercase tracking-normal text-[#807568] dark:border-[#302820] dark:bg-[#211c18] dark:text-[#a79b8f]">
                        {tool.status}
                      </span>
                    </div>
                    <h2 className="text-[31px] font-semibold leading-tight text-[#241f1a] dark:text-[#f4eee5]">
                      {tool.title}
                    </h2>
                    <p className="mt-4 text-[18px] leading-7 text-[#4d443b] dark:text-[#ded4c7]">
                      {tool.line}
                    </p>
                    <p className="mt-2 text-[14px] leading-6 text-[#807568] dark:text-[#a79b8f]">
                      {tool.description}
                    </p>
                  </div>

                  <span className="mt-12 inline-flex h-14 items-center justify-center gap-3 rounded-md bg-[#453a31] px-5 text-[16px] font-semibold text-white transition-colors group-hover:bg-[#2e261f] dark:bg-[#f4eee5] dark:text-[#181512] dark:group-hover:bg-white">
                    Open
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </Link>
              );
            })}
          </section>
        </section>

        <section className="grid gap-5 pb-16 md:grid-cols-3" aria-label="Upcoming tools">
          {upcoming.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex min-h-[84px] items-center gap-4 rounded-lg border border-dashed border-[#d8d0c6] bg-[#fbf8f2]/72 px-5 text-[#776c60] dark:border-[#302820] dark:bg-[#181512]/72 dark:text-[#a79b8f]"
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                <span className="flex-1 text-[16px] font-semibold">{item.title}</span>
                <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 pb-16 lg:grid-cols-2">
          <DemoList id="wordpress" title="WordPress plugins" icon={Plug} items={wordpress} />
          <DemoList id="extensions" title="Chrome extensions" icon={Chrome} items={chrome} />
        </section>

        <section id="register" className="pb-16 sm:pb-20">
          <div className="grid gap-8 rounded-lg border border-[#d8d0c6] bg-[#fffdf8] p-7 shadow-[0_1px_2px_rgba(47,38,30,.04),0_24px_56px_-46px_rgba(47,38,30,.5)] dark:border-[#302820] dark:bg-[#181512] dark:shadow-none md:grid-cols-[0.75fr_1.25fr] md:p-9">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="mb-7 grid h-11 w-11 place-items-center rounded-md border border-[#ddd5ca] bg-[#f4eee4] text-[#564b41] dark:border-[#3a3129] dark:bg-[#211c18] dark:text-[#d8cec0]">
                  <UserPlus className="h-5 w-5" strokeWidth={1.85} />
                </div>
                <h2 className="text-[32px] font-semibold leading-tight text-[#241f1a] dark:text-[#f4eee5]">
                  Early access
                </h2>
                <p className="mt-4 text-[15px] leading-6 text-[#807568] dark:text-[#a79b8f]">
                  Demo form. No data is submitted.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[13px] font-medium text-[#807568] dark:text-[#a79b8f]">
                <CheckCircle2 className="h-4 w-4 text-[#4f7d52] dark:text-[#9bc58d]" />
                Static preview
              </div>
            </div>

            <form className="grid gap-4" aria-label="Demo registration form">
              <div className="grid gap-2">
                <label htmlFor="demo-name" className="text-[13px] font-semibold text-[#4d443b] dark:text-[#ded4c7]">
                  Name
                </label>
                <input
                  id="demo-name"
                  name="name"
                  type="text"
                  placeholder="Creative team"
                  className="h-12 rounded-md border border-[#d8d0c6] bg-[#fbf8f2] px-4 text-[15px] text-[#241f1a] outline-none placeholder:text-[#9a8e82] focus:border-[#675a4e] dark:border-[#302820] dark:bg-[#12100e] dark:text-[#f4eee5] dark:placeholder:text-[#70675f]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="demo-email" className="text-[13px] font-semibold text-[#4d443b] dark:text-[#ded4c7]">
                  Email
                </label>
                <input
                  id="demo-email"
                  name="email"
                  type="email"
                  placeholder="team@example.com"
                  className="h-12 rounded-md border border-[#d8d0c6] bg-[#fbf8f2] px-4 text-[15px] text-[#241f1a] outline-none placeholder:text-[#9a8e82] focus:border-[#675a4e] dark:border-[#302820] dark:bg-[#12100e] dark:text-[#f4eee5] dark:placeholder:text-[#70675f]"
                />
              </div>
              <button
                type="button"
                className="mt-2 inline-flex h-14 items-center justify-center gap-3 rounded-md bg-[#453a31] px-5 text-[16px] font-semibold text-white transition-colors hover:bg-[#2e261f] dark:bg-[#f4eee5] dark:text-[#181512] dark:hover:bg-white"
              >
                <Mail className="h-5 w-5" />
                Request preview
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

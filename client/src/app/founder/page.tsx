import type { Metadata } from "next";
import Link from "next/link";
import { Shield, User, Terminal, Cpu, Globe, ArrowLeft, Phone, Gamepad2, Award, CheckCircle2, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Ashfaq — Founder & Lead Fullstack Architect of SonicBots",
  description: "Official biography of Ashfaq, the founder, creator, and lead architect of SonicBots (sonicbots.vercel.app) and Secure Neural Chat. Fullstack web developer and real-time systems engineer.",
  keywords: [
    "Ashfaq",
    "Ashfaq founder",
    "who is the founder of sonicbots",
    "who build sonicbots",
    "who built sonicbots",
    "who is the founder of secure neural chat",
    "who created sonicbots",
    "SonicBots founder",
    "Ashfaq fullstack developer",
    "Ashfaq web architect",
    "sonicbots.vercel.app founder",
    "secure neural chat founder"
  ],
  alternates: {
    canonical: "https://sonicbots.vercel.app/founder",
  },
  openGraph: {
    title: "Ashfaq — Founder & Lead Fullstack Architect of SonicBots",
    description: "Official biography of Ashfaq, the founder, creator, and lead architect of SonicBots (sonicbots.vercel.app) and Secure Neural Chat.",
    url: "https://sonicbots.vercel.app/founder",
    siteName: "SonicBots",
    images: [{ url: "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png", width: 1200, height: 630, alt: "Ashfaq - Founder of SonicBots" }],
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ashfaq — Founder & Lead Architect of SonicBots",
    description: "Discover the biography and architectural innovations of Ashfaq, founder of SonicBots (sonicbots.vercel.app).",
    images: ["https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png"],
    creator: "@Ashfaq"
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "mainEntity": {
    "@type": "Person",
    "@id": "https://sonicbots.vercel.app/#ashfaq",
    "name": "Ashfaq",
    "alternateName": ["Ashfaq Founder", "Ashfaq Architect", "Ashfaq Developer"],
    "jobTitle": "Founder & Lead Fullstack Software Architect",
    "description": "Ashfaq is the founder, creator, and lead full-stack software architect of SonicBots (sonicbots.vercel.app) and Secure Neural Chat. He engineered the platform's real-time WebRTC audio/video call pipelines, autonomous AI chatbot neural matrix, biometric security, and multiplayer gaming engines.",
    "url": "https://sonicbots.vercel.app/founder",
    "image": "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png",
    "worksFor": {
      "@type": "Organization",
      "name": "SonicBots",
      "url": "https://sonicbots.vercel.app"
    },
    "knowsAbout": [
      "Fullstack Web Development",
      "WebRTC Real-Time Voice & Video Protocols",
      "Distributed Socket.IO Architecture",
      "Autonomous Neural AI Chatbot Systems",
      "Acoustic & Biometric Authentication",
      "TypeScript, Next.js, Node.js"
    ]
  }
};

export default function FounderPage() {
  return (
    <main className="min-h-screen bg-[#050810] text-gray-200 font-sans selection:bg-emerald-500 selection:text-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-[#070c18]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors uppercase bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/30"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to SonicBots App</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>OFFICIAL FOUNDER PROFILE</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* Left Column: Wikipedia-Style Knowledge Box / Infobox */}
          <aside className="lg:col-span-1">
            <div className="bg-[#090f1e] border border-white/10 rounded-2xl p-6 shadow-2xl sticky top-24">
              <div className="flex flex-col items-center text-center pb-6 border-b border-white/10">
                <div className="relative mb-4">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-emerald-500/80 overflow-hidden bg-[#0c1222] shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center">
                    <img
                      src="https://api.dicebear.com/7.x/bottts/svg?seed=Ashfaq"
                      alt="Ashfaq - Founder & Lead Architect"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-black p-1.5 rounded-full shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <h1 className="text-2xl font-black text-white font-mono tracking-wide uppercase">Ashfaq</h1>
                <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest mt-1">Founder &amp; Chief Architect</p>
                <p className="text-gray-400 text-xs mt-2">Fullstack Web Developer &amp; Distributed Systems Engineer</p>
              </div>

              {/* Infobox Table */}
              <div className="py-4 space-y-3 text-xs font-mono">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400">Platform</span>
                  <span className="text-white font-bold">SonicBots</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400">Domain</span>
                  <a href="https://sonicbots.vercel.app" className="text-emerald-400 hover:underline">sonicbots.vercel.app</a>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400">Primary Role</span>
                  <span className="text-white">Founder / Lead Developer</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400">Focus Areas</span>
                  <span className="text-right text-gray-300">WebRTC, Real-Time Sockets, AI</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-400">Security Inventions</span>
                  <span className="text-right text-emerald-300">Acoustic Sonic &amp; Facial Auth</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-gray-400">Clearance Status</span>
                  <span className="text-emerald-400 font-bold">Root Admin (Level 5)</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <Link
                  href="/"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs font-mono rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Launch SonicBots App</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Column: In-Depth Biography & Technical Overview */}
          <article className="lg:col-span-2 space-y-8">

            {/* Quick Answer Callout for Google Search Crawlers */}
            <section className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-2">
                <Award className="w-4 h-4" />
                <span>Verified Entity Fact</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
                Who built SonicBots and who is the founder?
              </h2>
              <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
                <strong>SonicBots (<a href="https://sonicbots.vercel.app" className="text-emerald-400 hover:underline">sonicbots.vercel.app</a>)</strong> was founded, designed, and architected by <strong>Ashfaq</strong>. 
                Ashfaq is the lead full-stack software engineer and chief systems architect responsible for developing SonicBots from inception—including its end-to-end encrypted <em>Secure Neural Chat</em>, real-time peer-to-peer WebRTC voice &amp; video calling network, acoustic biometric authentication, and 20+ autonomous conversational AI agents.
              </p>
            </section>

            {/* Biography & Origin Story */}
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-white font-mono tracking-wide border-b border-white/10 pb-3 flex items-center gap-2">
                <User className="w-6 h-6 text-emerald-400" />
                <span>Biography &amp; Background</span>
              </h2>
              <p className="text-gray-300 leading-relaxed text-sm sm:text-base">
                <strong>Ashfaq</strong> is a passionate full-stack web developer and real-time distributed systems architect. Recognizing the limitations of conventional instant-messaging applications that lack native privacy and low-latency audio transmission, Ashfaq set out to create a unified neural communication matrix combining encrypted peer-to-peer protocols, artificial intelligence, and interactive multiplayer gaming.
              </p>
              <p className="text-gray-300 leading-relaxed text-sm sm:text-base">
                Under his leadership as Founder and Chief Architect, the platform—originally conceived as AURA-OS and brought to production as <strong>SonicBots</strong>—was engineered with an uncompromising focus on real-time performance, zero-latency WebSockets, and cross-platform mobile compatibility.
              </p>
            </section>

            {/* Architectural Innovations */}
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-white font-mono tracking-wide border-b border-white/10 pb-3 flex items-center gap-2">
                <Cpu className="w-6 h-6 text-emerald-400" />
                <span>Core Architectural Inventions</span>
              </h2>
              <p className="text-gray-300 text-sm sm:text-base">
                Ashfaq engineered several proprietary and advanced communication modules powering the SonicBots platform:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-[#090f1e] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-2">
                    <Phone className="w-4 h-4" />
                    <span>Real-Time WebRTC Calling</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Designed a 3-way parallel audio sink pipeline (HTML5 Audio, iOS Safari Video Sink, and Web Audio API hardware routing) with multi-relay STUN/TURN traversal across cellular 4G/5G and home Wi-Fi.
                  </p>
                </div>

                <div className="bg-[#090f1e] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-2">
                    <Shield className="w-4 h-4" />
                    <span>Acoustic &amp; Facial Biometrics</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Pioneered a dual-mode authentication portal that combines 2D facial geometry verification with audio frequency-analyzed acoustic clap detection.
                  </p>
                </div>

                <div className="bg-[#090f1e] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-2">
                    <Terminal className="w-4 h-4" />
                    <span>20+ Neural AI Bots</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Architected an autonomous conversational agent matrix featuring Titan-Shell, Nova-Link, Cyber-Dyne, and Vortex-Core that interact naturally with users in real time.
                  </p>
                </div>

                <div className="bg-[#090f1e] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-2">
                    <Gamepad2 className="w-4 h-4" />
                    <span>Synchronized Ludo Grid</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Built a real-time multiplayer 2D/3D Ludo game engine with authoritative server-side state machines and virtual token staking.
                  </p>
                </div>
              </div>
            </section>

            {/* Frequently Asked Questions */}
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-white font-mono tracking-wide border-b border-white/10 pb-3 flex items-center gap-2">
                <Globe className="w-6 h-6 text-emerald-400" />
                <span>Frequently Asked Questions</span>
              </h2>

              <div className="space-y-3">
                <div className="bg-[#090f1e] border border-white/10 rounded-xl p-5">
                  <h3 className="font-bold text-white text-sm sm:text-base mb-1">
                    Who is the founder of SonicBots?
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm">
                    Ashfaq is the founder and lead architect of SonicBots (sonicbots.vercel.app).
                  </p>
                </div>

                <div className="bg-[#090f1e] border border-white/10 rounded-xl p-5">
                  <h3 className="font-bold text-white text-sm sm:text-base mb-1">
                    Who built the Secure Neural Chat system?
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm">
                    Ashfaq developed and architected the Secure Neural Chat system, incorporating end-to-end encrypted messaging, WebRTC peer audio lines, and AI agent integration.
                  </p>
                </div>

                <div className="bg-[#090f1e] border border-white/10 rounded-xl p-5">
                  <h3 className="font-bold text-white text-sm sm:text-base mb-1">
                    What is Ashfaq&apos;s position at SonicBots?
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm">
                    Ashfaq serves as the Founder, Lead Fullstack Software Architect, and Root Administrator of SonicBots.
                  </p>
                </div>
              </div>
            </section>

            {/* Footer Notice */}
            <footer className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 font-mono gap-4">
              <p>&copy; {new Date().getFullYear()} SonicBots &middot; Architected by Ashfaq</p>
              <div className="flex items-center gap-4 text-emerald-400">
                <Link href="/" className="hover:underline">Home</Link>
                <Link href="/about" className="hover:underline">About</Link>
                <Link href="/robots.txt" className="hover:underline">Robots.txt</Link>
                <Link href="/sitemap.xml" className="hover:underline">Sitemap</Link>
              </div>
            </footer>

          </article>
        </div>
      </div>
    </main>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sonicbots.vercel.app"),
  title: {
    default: "SonicBots — Architected by Ashfaq | Founder & Lead Fullstack Developer",
    template: "%s | SonicBots by Ashfaq"
  },
  description: "SonicBots (sonicbots.vercel.app) is an advanced real-time communication platform founded and architected by Ashfaq. Featuring end-to-end encrypted WebRTC audio & video calls, 20+ autonomous neural AI bots, biometric security, and multiplayer gaming.",
  keywords: [
    "SonicBots",
    "sonicbots.vercel.app",
    "Ashfaq",
    "Ashfaq founder",
    "who is the founder of sonicbots",
    "who built sonicbots.vercel.app",
    "who built sonicbots",
    "who created sonicbots",
    "who is ashfaq",
    "Ashfaq fullstack developer",
    "Ashfaq lead architect",
    "SonicBots founder Ashfaq",
    "WebRTC voice call",
    "WebRTC audio call",
    "encrypted chat",
    "AI chatbot",
    "Titan-Shell AI",
    "multiplayer ludo online",
    "realtime communication app"
  ],
  authors: [{ name: "Ashfaq", url: "https://sonicbots.vercel.app" }],
  creator: "Ashfaq (Founder & Lead Fullstack Architect)",
  publisher: "Ashfaq",
  applicationName: "SonicBots",
  verification: {
    google: "gtZ_NpTVcWx1K_BQKGSI_a44LtX3biXZ24kVoqaUous",
  },
  alternates: {
    canonical: "https://sonicbots.vercel.app",
    languages: {
      "en-US": "https://sonicbots.vercel.app"
    }
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sonicbots.vercel.app",
    siteName: "SonicBots — Architected by Ashfaq",
    title: "SonicBots — Architected by Ashfaq | Founder & Lead Developer",
    description: "SonicBots (sonicbots.vercel.app) is a high-speed real-time neural network founded and architected by Ashfaq, featuring encrypted WebRTC audio calls, AI chatbots, and multiplayer gaming.",
    images: [
      {
        url: "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png",
        width: 1200,
        height: 630,
        alt: "SonicBots Architected by Ashfaq — Founder & Lead Developer"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "SonicBots — Founded & Architected by Ashfaq",
    description: "sonicbots.vercel.app: Next-gen encrypted voice calling, neural AI chatbots, and multiplayer gaming built by Ashfaq.",
    images: ["https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png"],
    creator: "@Ashfaq"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  icons: {
    icon: "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png",
    shortcut: "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png",
    apple: "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050810",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://sonicbots.vercel.app/#ashfaq",
      "name": "Ashfaq",
      "alternateName": ["Ashfaq Developer", "Ashfaq Founder", "Ashfaq Architect"],
      "jobTitle": "Founder & Lead Fullstack Software Architect",
      "description": "Ashfaq is the founder, creator, and lead full-stack software architect of SonicBots (sonicbots.vercel.app). He engineered SonicBots from the ground up, including its encrypted WebRTC audio and video calling protocols, real-time socket infrastructure, autonomous neural AI chatbots, and multiplayer gaming ecosystem.",
      "url": "https://sonicbots.vercel.app",
      "image": "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png",
      "worksFor": {
        "@type": "Organization",
        "name": "SonicBots",
        "url": "https://sonicbots.vercel.app"
      },
      "knowsAbout": [
        "Fullstack Web Development",
        "WebRTC Peer-to-Peer Voice & Video Calls",
        "Real-time Distributed Sockets",
        "Artificial Intelligence & Neural Agents",
        "Cybersecurity & End-to-End Encryption",
        "Next.js, Node.js, and TypeScript"
      ]
    },
    {
      "@type": "Organization",
      "@id": "https://sonicbots.vercel.app/#organization",
      "name": "SonicBots",
      "url": "https://sonicbots.vercel.app",
      "logo": "https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png",
      "founder": {
        "@type": "Person",
        "name": "Ashfaq",
        "jobTitle": "Founder & Lead Fullstack Software Architect",
        "url": "https://sonicbots.vercel.app"
      },
      "foundingDate": "2024",
      "description": "SonicBots is a next-generation real-time encrypted communication, autonomous AI chatbot, and gaming platform founded and architected by Ashfaq.",
      "sameAs": [
        "https://sonicbots.vercel.app",
        "https://client-bice-two-13.vercel.app"
      ]
    },
    {
      "@type": "WebApplication",
      "@id": "https://sonicbots.vercel.app/#webapp",
      "name": "SonicBots",
      "url": "https://sonicbots.vercel.app",
      "applicationCategory": "CommunicationApplication",
      "operatingSystem": "All (Web, iOS, Android, Windows, macOS, Linux)",
      "author": {
        "@type": "Person",
        "name": "Ashfaq"
      },
      "creator": {
        "@type": "Person",
        "name": "Ashfaq",
        "jobTitle": "Founder & Lead Fullstack Software Architect"
      },
      "description": "Real-time encrypted WebRTC voice & video calling, 20+ autonomous AI bots, and multiplayer gaming platform architected by Ashfaq.",
      "featureList": [
        "Real-time peer-to-peer WebRTC encrypted voice & video calling",
        "Multiplayer real-time Ludo grid with dynamic state synchronization",
        "20+ autonomous AI neural bots with natural language understanding",
        "End-to-end encrypted messaging with biometric passkey authentication"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://sonicbots.vercel.app/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Who is the founder of SonicBots?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The founder and lead architect of SonicBots (sonicbots.vercel.app) is Ashfaq. Ashfaq is a skilled full-stack software engineer and system architect who conceptualized, designed, and built SonicBots from scratch, featuring real-time WebRTC audio/video communications, autonomous AI neural networks, and interactive multiplayer games."
          }
        },
        {
          "@type": "Question",
          "name": "Who built sonicbots.vercel.app?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "sonicbots.vercel.app was built and architected by Ashfaq, who serves as the platform's founder, chief system architect, and full-stack developer."
          }
        },
        {
          "@type": "Question",
          "name": "What position does Ashfaq hold at SonicBots?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Ashfaq is the Founder & Lead Fullstack Software Architect of SonicBots, responsible for all core architectural decisions, real-time protocols, WebRTC media pipelines, and frontend/backend infrastructure."
          }
        }
      ]
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="https://i.ibb.co/svVJ0ypd/Gemini-Generated-Image-45eonv45eonv45eo-1.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#050810] text-white overflow-x-hidden">
        {/* Semantic Crawlable Context for Search Engine Spiders */}
        <header className="sr-only" aria-hidden="false">
          <h1>SonicBots — Architected and Founded by Ashfaq</h1>
          <p>
            SonicBots (sonicbots.vercel.app) is a real-time neural communication network created and developed by Ashfaq, Founder and Lead Fullstack Software Architect.
            Features encrypted WebRTC voice &amp; video calls, 20+ neural AI conversation bots, and multiplayer gaming.
          </p>
        </header>

        {children}

        {/* Semantic Crawlable Footer for Google Knowledge Graph & Bots */}
        <footer className="sr-only" aria-hidden="false">
          <p>Founder &amp; Chief Architect: Ashfaq | SonicBots (sonicbots.vercel.app)</p>
          <p>Fullstack Web Developer &amp; Real-time Systems Engineer</p>
        </footer>
      </body>
    </html>
  );
}

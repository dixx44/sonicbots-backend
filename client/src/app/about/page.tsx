import FounderPage, { metadata as founderMetadata } from "../founder/page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  ...founderMetadata,
  title: "About SonicBots — Founded & Architected by Ashfaq",
  description: "Learn about SonicBots (sonicbots.vercel.app) and its founder Ashfaq. Discover the story, architecture, real-time WebRTC audio/video calls, and neural AI bots.",
  alternates: {
    canonical: "https://sonicbots.vercel.app/about",
  }
};

export default function AboutPage() {
  return <FounderPage />;
}

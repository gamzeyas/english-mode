import type { Metadata } from "next";
import { PenLine } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Writing Coach" };

export default function WritingCoachPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Writing"
        title="Writing Coach"
        description="Bir metin yapıştır, amacını ve tonunu seç; koç daha doğal bir versiyon ve kısa bir düzeltme alıştırması önersin."
      />
      <ComingSoon
        icon={PenLine}
        milestone="Milestone 4"
        title="Writing Coach"
        description="Paste a message, choose intent and register, and get a clearer version plus a short revision exercise."
        bullets={[
          "Original text, intent and tone",
          "Coach response with reasons in Turkish",
          "Revision exercise saved to your pool",
        ]}
      />
    </PageContainer>
  );
}

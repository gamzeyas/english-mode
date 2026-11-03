import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LogOut, Pencil } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallApp } from "@/components/pwa/install-app";
import { DataControls } from "@/components/settings/data-controls";
import { signOut } from "@/lib/auth/actions";
import { getActiveConsents, getCurrentUser, getProfile } from "@/lib/auth/dal";
import { feedbackOptions, purposeOptions } from "@/lib/onboarding/schema";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Tercihler, gizlilik onayları ve hesap."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <SettingsContent />
      </Suspense>
    </PageContainer>
  );
}

async function SettingsContent() {
  const [user, profile, consents] = await Promise.all([
    getCurrentUser(),
    getProfile(),
    getActiveConsents(),
  ]);
  const active = new Set(consents.map((consent) => consent.consent_type));
  const purpose = purposeOptions.find(
    (o) => o.value === profile.purpose,
  )?.label;
  const feedback = feedbackOptions.find(
    (o) => o.value === profile.feedback_mode,
  )?.label;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Learning preferences
            <Button asChild variant="outline" className="ml-auto h-10">
              <Link href="/onboarding">
                <Pencil aria-hidden /> Edit
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Name" value={profile.display_name || "—"} />
            <Row label="Purpose" value={purpose ?? "—"} />
            <Row label="Daily time" value={`${profile.daily_minutes} min`} />
            <Row label="Accent" value={profile.dialect} />
            <Row label="Corrections" value={feedback ?? "—"} />
            <Row label="Timezone" value={profile.timezone} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Onaylarını Edit ekranından istediğin zaman değiştirebilirsin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <Row
              label="Learning data storage"
              value={active.has("data_processing") ? "Granted" : "Not granted"}
            />
            <Row
              label="Voice processing"
              value={active.has("voice_processing") ? "Granted" : "Not granted"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Install the app</CardTitle>
          <CardDescription>
            Ana ekrandan tam ekran açılır; bağlantı koparsa çevrimdışı ekranı
            görürsün.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstallApp />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Dışa aktar ya da hesabını tamamen sil (KVKK/GDPR).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataControls />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="text-muted-foreground">Signed in as</p>
            <p className="font-medium break-all">{user.email}</p>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              className="h-11 w-full sm:w-auto"
            >
              <LogOut aria-hidden /> Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

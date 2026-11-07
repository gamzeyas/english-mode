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
import { getUsageSummary } from "@/lib/account/usage";
import { MicrophonePicker } from "@/components/settings/microphone-picker";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { getReminderSettings } from "@/lib/notifications/service";
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
  const [usage, reminders] = await Promise.all([
    getUsageSummary(user),
    getReminderSettings(user, profile),
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
          <CardTitle>Reminders</CardTitle>
          <CardDescription>
            Seçtiğin saatte günlük bir hatırlatma. O gün zaten çalıştıysan
            gönderilmez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReminderSettings settings={reminders} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Microphone</CardTitle>
          <CardDescription>
            Kayıtta konuşma algılanmıyorsa buradan doğru mikrofonu seç ve test
            et.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MicrophonePicker />
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
          <CardTitle>Usage &amp; cost</CardTitle>
          <CardDescription>
            Bu ayki tahmini harcama (liste fiyatlarıyla; kesin tutar sağlayıcı
            faturasındadır). Harcama sınırı yok, sadece görünürlük.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsageSummary usage={usage} />
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

const usd = (value: number) =>
  `$${value < 0.01 && value > 0 ? value.toFixed(4) : value.toFixed(2)}`;

function UsageSummary({
  usage,
}: {
  usage: Awaited<ReturnType<typeof getUsageSummary>>;
}) {
  if (usage.calls === 0)
    return (
      <p className="text-sm text-muted-foreground">Bu ay henüz kullanım yok.</p>
    );
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-3 gap-3">
        <Row label={`This month (${usage.month})`} value={usd(usage.total)} />
        <Row label="Month projection" value={usd(usage.projected)} />
        <Row label="Calls" value={String(usage.calls)} />
      </dl>
      <dl className="grid gap-1">
        {usage.providers.map((p) => (
          <div key={p.provider} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{p.provider}</dt>
            <dd className="tabular-nums">{usd(p.cost)}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary className="flex min-h-10 cursor-pointer items-center font-medium">
          By feature
        </summary>
        <dl className="grid gap-1 pt-1">
          {usage.operations.map((op) => (
            <div key={op.label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">
                {op.label} · {op.calls}
              </dt>
              <dd className="tabular-nums">{usd(op.cost)}</dd>
            </div>
          ))}
        </dl>
      </details>
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

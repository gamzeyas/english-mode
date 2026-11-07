"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Send } from "lucide-react";
import { deleteJson, postJson, putJson } from "@/lib/api/client";
import { DAYPARTS_TR, WEEKDAYS_TR } from "@/lib/learning/skill-progress";
import type { ReminderSettings as Settings } from "@/lib/notifications/service";
import { useServerState } from "@/lib/use-server-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeviceState =
  | { kind: "checking" }
  | { kind: "unsupported"; ios: boolean }
  | {
      kind: "ready";
      endpoint: string | null;
      permission: NotificationPermission;
    };

/** VAPID public keys are URL-safe base64; PushManager wants raw bytes. */
function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a &&
  a.byteLength === b.length &&
  new Uint8Array(a).every((x, i) => x === b[i]);

async function registration() {
  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  return navigator.serviceWorker.ready;
}

/**
 * Daily reminder preferences (learner-owned) plus this device's push
 * subscription. Permission is only requested from the button tap, never on
 * page load (PRD: permissioned push).
 */
export function ReminderSettings({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [saved, setSaved] = useServerState(settings);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [time, setTime] = useState(
    settings.reminderTime ?? settings.suggestion?.time ?? "20:00",
  );
  const [weekdays, setWeekdays] = useState(settings.weekdays);
  const [device, setDevice] = useState<DeviceState>({ kind: "checking" });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (!cancelled) setDevice({ kind: "unsupported", ios });
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!cancelled)
        setDevice({
          kind: "ready",
          endpoint: sub?.endpoint ?? null,
          permission: Notification.permission,
        });
    }
    void check().catch(() => {
      if (!cancelled) setDevice({ kind: "unsupported", ios: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const thisDeviceSaved =
    device.kind === "ready" &&
    !!device.endpoint &&
    saved.devices.some((d) => d.endpoint === device.endpoint);
  const dirty =
    enabled !== saved.enabled ||
    (enabled && time !== saved.reminderTime) ||
    weekdays.join() !== saved.weekdays.join();

  function toggleDay(day: number) {
    setWeekdays((days) =>
      days.includes(day)
        ? days.length > 1
          ? days.filter((d) => d !== day)
          : days
        : [...days, day].sort(),
    );
  }

  async function save() {
    setBusy("save");
    setError(null);
    setNotice(null);
    const result = await putJson("/api/notifications", {
      enabled,
      reminderTime: enabled ? time : saved.reminderTime,
      weekdays,
    });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setSaved({
      ...saved,
      enabled,
      reminderTime: enabled ? time : saved.reminderTime,
      weekdays,
    });
    setNotice(
      enabled
        ? `Kaydedildi. Hatırlatma seçtiğin günlerde ${time}'da gelecek (${saved.timeZone}); o gün zaten çalıştıysan gelmez.`
        : "Hatırlatmalar kapatıldı.",
    );
    router.refresh();
  }

  async function enableDevice() {
    const key = saved.vapidPublicKey;
    if (!key) return;
    setBusy("device");
    setError(null);
    setNotice(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice({ kind: "ready", endpoint: null, permission });
        setError(
          "Bildirim izni verilmedi. Tarayıcının site ayarlarından izin verip tekrar dene.",
        );
        return;
      }
      const reg = await registration();
      const serverKey = base64UrlToBytes(key);
      let sub = await reg.pushManager.getSubscription();
      // Keys were rotated: the old subscription can no longer be used.
      if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverKey,
      });
      const result = await postJson(
        "/api/notifications/subscriptions",
        sub.toJSON(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDevice({ kind: "ready", endpoint: sub.endpoint, permission });
      setNotice(
        "Bu cihaz bildirim alacak. İstersen bir test bildirimi gönder.",
      );
      router.refresh();
    } catch {
      setError(
        "Bu cihazda bildirimler açılamadı. Tarayıcı push servisine ulaşamadı; tekrar dene.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function disableDevice() {
    if (device.kind !== "ready" || !device.endpoint) return;
    setBusy("device");
    setError(null);
    setNotice(null);
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe().catch(() => undefined);
    const result = await deleteJson("/api/notifications/subscriptions", {
      endpoint: device.endpoint,
    });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setDevice({ ...device, endpoint: null });
    setNotice("Bu cihaz artık bildirim almayacak.");
    router.refresh();
  }

  async function sendTest() {
    setBusy("test");
    setError(null);
    setNotice(null);
    const result = await postJson<{ sent: number; failed: number }>(
      "/api/notifications/test",
    );
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setNotice(
      result.data.sent > 0
        ? `Test bildirimi ${result.data.sent} cihaza gönderildi.`
        : "Bildirim gönderilemedi. Cihazı kaldırıp yeniden eklemeyi dene.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-5 text-sm">
      <fieldset className="space-y-3" disabled={busy !== null}>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="font-medium">Daily reminder</span>
        </label>

        <div className={cn("space-y-3", !enabled && "opacity-60")}>
          <label className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground">Time</span>
            <input
              type="time"
              value={time}
              disabled={!enabled}
              onChange={(e) => setTime(e.target.value)}
              className="h-11 rounded-md border bg-background px-3"
            />
            <span className="text-xs text-muted-foreground">
              {saved.timeZone}
            </span>
          </label>
          {saved.suggestion && saved.suggestion.time !== time && (
            <p className="text-xs text-muted-foreground">
              Genelde{" "}
              {DAYPARTS_TR[saved.suggestion.daypart].toLocaleLowerCase("tr")}{" "}
              çalışıyorsun ({saved.suggestion.count} etkinlik, son 4 hafta).{" "}
              <button
                type="button"
                disabled={!enabled}
                className="min-h-11 font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setTime(saved.suggestion!.time)}
              >
                {saved.suggestion.time} kullan
              </button>
            </p>
          )}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Reminder days"
          >
            {WEEKDAYS_TR.map((label, index) => {
              const day = index + 1;
              const on = weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  disabled={!enabled}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "h-11 min-w-11 rounded-md border px-2 text-xs font-medium",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <Button className="h-11" onClick={save} disabled={!dirty}>
          {busy === "save" ? "Saving…" : "Save reminder"}
        </Button>
      </fieldset>

      <div className="space-y-3 border-t pt-4">
        <p className="font-medium">This device</p>
        {!saved.vapidPublicKey ? (
          <p className="text-muted-foreground">
            Bildirim servisi henüz yapılandırılmadı (bildirim anahtarları
            eksik).
          </p>
        ) : device.kind === "checking" ? (
          <p className="text-muted-foreground">Kontrol ediliyor…</p>
        ) : device.kind === "unsupported" ? (
          <p className="text-muted-foreground">
            {device.ios
              ? "iPhone/iPad'de bildirim için önce Paylaş → Ana Ekrana Ekle ile uygulamayı yükle, sonra uygulamayı ana ekrandan açıp buraya dön."
              : "Bu tarayıcı web bildirimlerini desteklemiyor."}
          </p>
        ) : thisDeviceSaved ? (
          <div className="flex flex-wrap gap-2">
            <p className="w-full text-muted-foreground">
              Bu cihaz bildirim alıyor.
            </p>
            <Button
              variant="outline"
              className="h-11"
              onClick={sendTest}
              disabled={busy !== null}
            >
              <Send aria-hidden />{" "}
              {busy === "test" ? "Sending…" : "Send test notification"}
            </Button>
            <Button
              variant="ghost"
              className="h-11"
              onClick={disableDevice}
              disabled={busy !== null}
            >
              <BellOff aria-hidden /> Turn off on this device
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {device.permission === "denied" && (
              <p className="text-muted-foreground">
                Bildirimler bu tarayıcıda engelli. Site ayarlarından izin
                verdikten sonra tekrar dene.
              </p>
            )}
            <Button
              className="h-11"
              onClick={enableDevice}
              disabled={busy !== null}
            >
              <Bell aria-hidden />{" "}
              {busy === "device" ? "Enabling…" : "Enable notifications here"}
            </Button>
          </div>
        )}
        {saved.devices.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Kayıtlı cihaz: {saved.devices.length}
          </p>
        )}
      </div>

      <p aria-live="polite" className="min-h-5">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          notice && <span className="text-muted-foreground">{notice}</span>
        )}
      </p>
    </div>
  );
}

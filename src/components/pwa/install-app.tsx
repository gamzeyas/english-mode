"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type State = "unknown" | "installed" | "prompt" | "ios" | "manual";

function detect(): State {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return "installed";
  }
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "manual";
}

/**
 * Install flow (PRD §16 M5): Chrome/Edge/Android expose a prompt event; iOS
 * Safari only supports "Share → Add to Home Screen", so we explain that.
 */
export function InstallApp() {
  const [state, setState] = useState<State>("unknown");
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const timer = setTimeout(() =>
      setState((s) => (s === "unknown" ? detect() : s)),
    );
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setState("prompt");
    };
    const onInstalled = () => setState("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    setState(outcome === "accepted" ? "installed" : "manual");
  }

  if (state === "installed") {
    return (
      <p className="text-sm text-success">
        Uygulama olarak yüklü. Ana ekranından açabilirsin.
      </p>
    );
  }
  if (state === "prompt") {
    return (
      <Button className="h-11" onClick={install}>
        <Download aria-hidden /> Install English Mode
      </Button>
    );
  }
  if (state === "ios") {
    return (
      <p lang="tr" className="text-sm text-muted-foreground">
        Safari’de <Share aria-label="Paylaş" className="inline size-4" />{" "}
        Paylaş’a dokun, sonra “Ana Ekrana Ekle”yi seç.
      </p>
    );
  }
  return (
    <p lang="tr" className="text-sm text-muted-foreground">
      Tarayıcının adres çubuğundaki “Yükle” simgesini ya da menüdeki “Uygulamayı
      yükle” seçeneğini kullan.
    </p>
  );
}

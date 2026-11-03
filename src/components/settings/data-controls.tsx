"use client";

import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { deleteJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DataControls() {
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch("/api/data/export", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const name =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "english-mode-export.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Dışa aktarma başarısız oldu. Tekrar dene.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    const result = await deleteJson<{ deleted: boolean }>("/api/account", {
      confirm,
    });
    if (!result.ok) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    // Full reload so no signed-in state survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground" lang="tr">
          Konuşmaların, ifade havuzun, tekrar geçmişin, ödevlerin, yazıların ve
          değerlendirmelerin tek bir JSON dosyasında.
        </p>
        <Button
          variant="outline"
          className="h-11"
          onClick={exportData}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <Download aria-hidden />
          )}
          Export my data
        </Button>
      </div>

      <form
        className="space-y-2 border-t pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (confirm === "DELETE") void deleteAccount();
        }}
      >
        <label htmlFor="delete-confirm" className="block text-sm font-medium">
          Delete account
        </label>
        <p className="text-sm text-muted-foreground" lang="tr">
          Hesabın ve tüm verilerin kalıcı olarak silinir; geri alınamaz.
          Onaylamak için <strong className="text-foreground">DELETE</strong>{" "}
          yaz.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="delete-confirm"
            className="h-11 sm:max-w-48"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="off"
            disabled={deleting}
          />
          <Button
            type="submit"
            variant="destructive"
            className="h-11"
            disabled={confirm !== "DELETE" || deleting}
          >
            <Trash2 aria-hidden />
            {deleting ? "Deleting…" : "Delete everything"}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

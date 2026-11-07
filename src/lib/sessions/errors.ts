export type SessionErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "not_found"
  | "not_active"
  | "turn_limit"
  | "ai_not_configured"
  | "ai_refused"
  | "ai_failed"
  | "conflict"
  | "duplicate"
  | "not_ready"
  | "rate_limited"
  | "consent_required"
  | "voice_not_configured"
  | "voice_failed"
  | "no_speech"
  | "push_not_configured";

const STATUS: Record<SessionErrorCode, number> = {
  unauthorized: 401,
  invalid_request: 400,
  not_found: 404,
  not_active: 409,
  turn_limit: 429,
  ai_not_configured: 503,
  ai_refused: 422,
  ai_failed: 502,
  conflict: 409,
  duplicate: 409,
  not_ready: 409,
  rate_limited: 429,
  consent_required: 403,
  voice_not_configured: 503,
  voice_failed: 502,
  no_speech: 422,
  push_not_configured: 503,
};

/** Learner-facing (Turkish) messages; never include provider details. */
export const SESSION_ERROR_MESSAGES: Record<SessionErrorCode, string> = {
  unauthorized: "Oturumun sona ermiş. Tekrar giriş yap.",
  invalid_request: "İstek geçersiz.",
  not_found: "Bu oturum bulunamadı.",
  not_active: "Bu oturum bitti; yeni bir konuşma başlat.",
  turn_limit:
    "Bu oturumda mesaj sınırına ulaştın. Oturumu bitirip geri bildirimini alabilirsin.",
  ai_not_configured: "AI koçu henüz yapılandırılmadı (API anahtarı eksik).",
  ai_refused: "Koç bu mesaja yanıt veremedi. Farklı bir şekilde yazmayı dene.",
  ai_failed: "Koça şu an ulaşılamıyor. Mesajın kaydedildi; tekrar dene.",
  conflict: "Bu kart başka bir sekmede güncellendi. Liste yenileniyor.",
  duplicate: "Bu ifade havuzunda zaten var.",
  not_ready: "Bu adım henüz hazır değil.",
  rate_limited: "Çok hızlı gidiyorsun; bir dakika bekleyip tekrar dene.",
  consent_required:
    "Sesli kullanım için ses işleme onayı gerekli. Ayarlar → Edit'ten verebilirsin.",
  voice_not_configured:
    "Ses servisi henüz yapılandırılmadı (Azure anahtarı eksik). Yazarak devam edebilirsin.",
  voice_failed: "Kayıt yazıya çevrilemedi. Tekrar dene ya da yazarak devam et.",
  no_speech:
    "Kayıtta konuşma algılanamadı. Mikrofona biraz daha yakın konuşup tekrar dene.",
  push_not_configured:
    "Bildirim servisi henüz yapılandırılmadı (bildirim anahtarları eksik).",
};

export class SessionError extends Error {
  readonly status: number;
  constructor(
    readonly code: SessionErrorCode,
    /** Optional learner-facing (Turkish) override of the default message. */
    message?: string,
  ) {
    super(message ?? SESSION_ERROR_MESSAGES[code]);
    this.name = "SessionError";
    this.status = STATUS[code];
  }
}

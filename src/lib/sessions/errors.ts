export type SessionErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "not_found"
  | "not_active"
  | "turn_limit"
  | "ai_not_configured"
  | "ai_refused"
  | "ai_failed";

const STATUS: Record<SessionErrorCode, number> = {
  unauthorized: 401,
  invalid_request: 400,
  not_found: 404,
  not_active: 409,
  turn_limit: 429,
  ai_not_configured: 503,
  ai_refused: 422,
  ai_failed: 502,
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
};

export class SessionError extends Error {
  readonly status: number;
  constructor(readonly code: SessionErrorCode) {
    super(SESSION_ERROR_MESSAGES[code]);
    this.name = "SessionError";
    this.status = STATUS[code];
  }
}

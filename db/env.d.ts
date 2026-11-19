declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    OTF_API_BASE_URL?: string;
    OTF_API_TOKEN?: string;
    /** La clé maîtresse du coffre des jetons (4.3, F355, F368) : un secret posé par le porteur seul. */
    OTF_TOKEN_MASTER_KEY?: string;
    /** L'ancienne clé maîtresse, le temps d'une rotation (F356). */
    OTF_TOKEN_MASTER_KEY_PREVIOUS?: string;
    OTF_DATA_SOURCE?: string;
    WEATHER_DATA_SOURCE?: string;
    IRRIGATION_PUSH_SERVICE_URL?: string;
    IRRIGATION_PUSH_SERVICE_TOKEN?: string;
    IRRIGATION_PUSH_VAPID_PUBLIC_KEY?: string;
    VISUAL_CROSSING_API_KEY?: string;
    WEATHER_SYNC_SERVICE_TOKEN?: string;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    /** Liaison de service vers le Worker Push ; absente hors Cloudflare. */
    IRRIGATION_PUSH?: Fetcher;
  }
}

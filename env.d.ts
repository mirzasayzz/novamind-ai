declare const __E2E__: boolean;
declare const __E2E_SKIP_ONBOARDING__: boolean;

declare module '@env' {
  export const FIREBASE_FUNCTIONS_URL: string;
  export const APPCHECK_DEBUG_TOKEN_ANDROID: string;
  export const APPCHECK_DEBUG_TOKEN_IOS: string;

  // NovaHub/Supabase Configuration
  export const SUPABASE_URL: string;
  export const SUPABASE_ANON_KEY: string;

  // NovaHub API Configuration
  export const NOVAHUB_API_BASE_URL: string;

  // App Configuration
  export const APP_URL: string;

  // AgentRouter cloud AI endpoint (OpenAI-compatible). Seeded as a built-in
  // remote server when both values are present.
  export const AGENTROUTER_BASE_URL: string;
  export const AGENTROUTER_API_KEY: string;

  // Feature Flags
  export const ENABLE_NOVAHUB_INTEGRATION: string;
  export const ENABLE_AUTHENTICATION: string;
  export const ENABLE_OFFLINE_MODE: string;

  // Google Sign-In Configuration
  export const GOOGLE_IOS_CLIENT_ID: string;
  export const GOOGLE_WEB_CLIENT_ID: string;
}

export type RuntimeEnv = {
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  D1_GATEWAY_URL?: string;
  D1_GATEWAY_SECRET?: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  DATA_SERVICES_ENABLED?: string;
  LOGIN_RATE_LIMIT_ENABLED?: string;
  ADMIN_ENTRANCE_REQUIRED?: string;
};

export function runtime(): RuntimeEnv {
  return {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET,
    D1_GATEWAY_URL: process.env.D1_GATEWAY_URL,
    D1_GATEWAY_SECRET: process.env.D1_GATEWAY_SECRET,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    DATA_SERVICES_ENABLED: process.env.DATA_SERVICES_ENABLED,
    LOGIN_RATE_LIMIT_ENABLED: process.env.LOGIN_RATE_LIMIT_ENABLED,
    ADMIN_ENTRANCE_REQUIRED: process.env.ADMIN_ENTRANCE_REQUIRED,
  };
}

export function dataServicesEnabled() {
  return runtime().DATA_SERVICES_ENABLED === "true";
}

export function loginRateLimitEnabled() {
  return runtime().LOGIN_RATE_LIMIT_ENABLED !== "false";
}

export function adminEntranceRequired() {
  return runtime().ADMIN_ENTRANCE_REQUIRED !== "false";
}

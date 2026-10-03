/** A stored credential as listed by the API: never includes secrets. */
export interface VaultCredential {
  name: string;
  url?: string;
  username?: string;
  notes?: string;
  hasPassword: boolean;
  hasTotp: boolean;
  /** ISO 8601. */
  updatedAt: string;
}

/** Create or update a credential. Fields left out keep their current value. */
export interface VaultSetParams {
  /** Login page URL; `browser_login` matches credentials by URL. */
  url?: string;
  username?: string;
  password?: string;
  /** Base32 TOTP secret, e.g. `JBSWY3DPEHPK3PXP`. */
  totpSecret?: string;
  notes?: string;
}

export interface VaultDeleteResponse {
  deleted: boolean;
}

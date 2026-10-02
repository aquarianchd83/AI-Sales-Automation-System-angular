/** How a password reset reaches the person: an emailed link, or a six-digit code texted to a verified phone. */
export type RecoveryChannel = 'email' | 'sms';

/** POST /auth/forgot-password. The API answers 204 whatever the address, so a stranger learns nothing about who has an account. */
export interface ForgotPasswordRequest {
  email: string;
  channel: RecoveryChannel;
}

/** POST /auth/reset-password. `token` is the emailed token from the link, or for channel 'sms' the six-digit code. */
export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
  channel: RecoveryChannel;
}

export interface VerifyEmailRequest {
  email: string;
  token: string;
}

/** The API's password rules (Identity): at least 8 characters with an uppercase letter, a digit and a symbol. */
export const PASSWORD_POLICY_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_POLICY_HINT = 'At least 8 characters, with an uppercase letter, a number and a symbol.';

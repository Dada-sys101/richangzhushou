export type RecoveryMailKind = "PASSWORD_RESET" | "REOPEN";

export interface RecoveryMail {
  email: string;
  kind: RecoveryMailKind;
  token: string;
  expiresAt: Date;
}

export abstract class MailAdapter {
  abstract sendRecovery(mail: RecoveryMail): Promise<void>;
}

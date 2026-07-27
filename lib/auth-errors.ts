import { CredentialsSignin } from "next-auth";

export class LoginRateLimitError extends CredentialsSignin {
  code = "rate_limit";

  constructor(public lockedUntil: Date) {
    super();
    this.message = "Too many login attempts.";
  }
}

export class TwoFactorRequiredError extends CredentialsSignin {
  code = "two_factor_required";
}

export class InvalidTwoFactorError extends CredentialsSignin {
  code = "invalid_two_factor";
}

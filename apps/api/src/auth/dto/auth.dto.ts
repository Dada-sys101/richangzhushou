import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class RegisterDto {
  @IsString()
  @Length(1, 60)
  displayName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{12,64}$/)
  inviteCode?: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(160)
  recoveryToken!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class ReopenAccountDto {
  @IsString()
  @MinLength(32)
  @MaxLength(160)
  recoveryToken!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

export class CloseAccountDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RequestDeletionDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class AdminReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class InviteCreateDto {
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsISO8601({ strict: true })
  expiresAt?: string | null;
}

export class UpdateRegistrationSettingsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inviteRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxActiveUsers?: number;
}

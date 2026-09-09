import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  auth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  p256dh!: string;
}

export class SavePushSubscriptionDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

export class DeletePushSubscriptionDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;
}

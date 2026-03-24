import { IsString, IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum NotificationType {
  EMAIL = 'email',
  SLACK = 'slack',
}

export class SendNotificationDto {
  @IsEnum(NotificationType)
  type: string;

  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

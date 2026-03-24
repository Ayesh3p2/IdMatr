import { IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

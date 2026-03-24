import { IsString } from 'class-validator';

export class MapIdentityDto {
  @IsString()
  tenantUserId!: string;
}

import { IsOptional, IsString } from 'class-validator';

export class GoogleSyncDto {
  @IsOptional()
  @IsString()
  integrationId?: string;
}

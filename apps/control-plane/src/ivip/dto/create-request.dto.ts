import { IsOptional, IsString } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  integrationId!: string;

  @IsString()
  externalIdentityId!: string;

  @IsString()
  externalGroupId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requestedAccessRole?: string;
}

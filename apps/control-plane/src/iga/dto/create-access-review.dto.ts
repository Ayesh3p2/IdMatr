import { IsOptional, IsString } from 'class-validator';

export class CreateAccessReviewDto {
  @IsString()
  integrationId!: string;

  @IsString()
  externalIdentityId!: string;

  @IsString()
  externalGroupId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

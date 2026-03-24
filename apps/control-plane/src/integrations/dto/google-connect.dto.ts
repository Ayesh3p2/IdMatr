import { IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleConnectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  serviceAccountKeyJson?: string;

  @IsOptional()
  @IsString()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  domain?: string;
}

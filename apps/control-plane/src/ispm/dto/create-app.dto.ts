import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAppDto {
  @IsString()
  name!: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

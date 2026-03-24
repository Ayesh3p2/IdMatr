import { IsString, IsOptional, IsObject } from 'class-validator';

export class ScanRequestDto {
  @IsString()
  @IsOptional()
  source?: string;

  @IsObject()
  @IsOptional()
  options?: any;
}

import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class VerifyMfaDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsNumber()
  window?: number;
}

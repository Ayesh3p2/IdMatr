import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateMfaDto {
  @IsString()
  @IsNotEmpty()
  issuer: string;
}

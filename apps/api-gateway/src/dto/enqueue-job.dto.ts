import { IsString, IsObject, IsNotEmpty } from 'class-validator';

export class EnqueueJobDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsObject()
  payload: any;
}

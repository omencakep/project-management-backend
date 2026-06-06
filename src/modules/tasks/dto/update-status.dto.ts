import { Type } from 'class-transformer';
import { IsString, IsNumber } from 'class-validator';

export class UpdateStatusDto {
  @IsString()
  status: string;

  @Type(() => Number)
  @IsNumber()
  version: number;
}

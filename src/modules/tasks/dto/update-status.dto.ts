import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsNumber()
  version?: number;
}

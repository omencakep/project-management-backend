import { IsString } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  url: string;

  @IsString()
  filename: string;
}

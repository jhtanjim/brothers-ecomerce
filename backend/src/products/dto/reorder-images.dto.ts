import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';
import { MAX_IMAGES_PER_PRODUCT } from '../../uploads/image-upload.config';

export class ReorderImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMAGES_PER_PRODUCT)
  @ArrayUnique()
  @IsString({ each: true })
  imageIds!: string[];
}
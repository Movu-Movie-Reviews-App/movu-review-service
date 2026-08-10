import { IsString, IsNotEmpty, Length, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

export class UpdateReviewDto {

    @IsUUID()
    contentId: string

    @IsUUID()
    userId: string

    @IsString()
    @IsNotEmpty()
    @Length(3, 100)
    @IsOptional()
    title?: string;

    @IsString()
    @IsNotEmpty()
    @Length(10, 5000)
    @IsOptional()
    description?: string;

    @IsInt()
    @Min(1)
    @Max(5)
    @IsOptional()
    rating?: number;


}

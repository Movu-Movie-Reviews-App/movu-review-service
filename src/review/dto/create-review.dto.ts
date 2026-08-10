import {
    IsInt,
    IsNotEmpty,
    IsString,
    IsUUID,
    Length,
    Max,
    Min,
} from "class-validator";

export class CreateReviewDto {

    @IsString()
    @IsNotEmpty()
    @Length(3, 100)
    title: string;

    @IsString()
    @IsNotEmpty()
    @Length(10, 5000)
    description: string;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsUUID()
    contentId: string;

    @IsUUID()
    userId: string;
}
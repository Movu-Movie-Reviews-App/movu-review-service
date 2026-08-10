import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { MessagePattern } from '@nestjs/microservices/decorators/message-pattern.decorator';
import { Payload } from '@nestjs/microservices/decorators/payload.decorator';

@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) { }

  @MessagePattern('reviews.findByContent')
  findByContent(
    @Payload('contentId', ParseUUIDPipe) contentId: string,
    @Payload() findReviewsDto: FindReviewsDto, @Payload('userId', ParseUUIDPipe) userId?: string
  ) {
    return this.reviewService.findByContent(contentId, findReviewsDto, userId);
  }

  @MessagePattern('reviews.findOneByUserAndContent')
  findOneByUserAndContent(
    @Payload('contentId', ParseUUIDPipe) contentId: string,
    @Payload('userId') userId: string
  ) {
    return this.reviewService.findOneByUserAndContent(contentId, userId);
  }

  @MessagePattern('reviews.create')
  create(@Payload() createReviewDto: CreateReviewDto) {

    return this.reviewService.create(createReviewDto, createReviewDto.userId);
  }

  @MessagePattern('reviews.remove')
  remove(@Payload('id', ParseUUIDPipe) id: string, @Payload('userId', ParseUUIDPipe) userId: string) {
    return this.reviewService.remove(id, userId);
  }

  @MessagePattern('reviews.update')
  update(@Payload() updateReviewDto: UpdateReviewDto) {
    return this.reviewService.update(updateReviewDto.contentId, updateReviewDto.userId, updateReviewDto);
  }



}

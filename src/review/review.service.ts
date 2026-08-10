import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ReviewEntity } from './entities/review.entity';
import { Repository } from 'typeorm';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { ReviewSortEnum } from './enums/review-sort.enum';
import { CONTENT_SERVICE } from 'src/config';
import { ClientProxy } from '@nestjs/microservices/client/client-proxy';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ReviewService {

  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepository: Repository<ReviewEntity>,

    @Inject(CONTENT_SERVICE) private readonly contentClient: ClientProxy

  ) { }


  async create(createReviewDto: CreateReviewDto, userId: string) {


    const existingReview = await this.findOneByUserAndContent(createReviewDto.contentId, userId);

    if (existingReview) {
      throw new ConflictException('User has already reviewed this content');
    }

    const { userId: __, ...createReviewDtoData } = createReviewDto

    const review = this.reviewRepository.create({ userId, ...createReviewDtoData });
    const savedReview = await this.reviewRepository.save(review);

    //TODO! ESTO DEBE SER UN EVENTO
    // await this.updateContentRatingStats(createReviewDto.contentId);
    return savedReview;
  }

  findAll() {
    //TODO! Implement pagination and filtering by rating
    //TODO This method should only return needed information about user and content, not the whole entities
    return this.reviewRepository.find()
  }

  async findByContent(
    contentId: string,
    findReviewsDto: FindReviewsDto,
    userId?: string
  ) {
    const {
      page = 1,
      limit = 20,
      rating,
      sort,
    } = findReviewsDto;

    const query = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .where('review.contentId = :contentId', { contentId });

    if (rating) {
      query.andWhere('review.rating = :rating', { rating });
    }

    if (userId) {
      query.andWhere('review.userId != :userId', { userId });
    }

    switch (sort) {
      case ReviewSortEnum.NEWEST:
        query.orderBy('review.createdAt', 'DESC');
        break;

      case ReviewSortEnum.OLDEST:
        query.orderBy('review.createdAt', 'ASC');
        break;

      case ReviewSortEnum.HIGHEST_RATED:
        query.orderBy('review.rating', 'DESC');
        break;

      case ReviewSortEnum.LOWEST_RATED:
        query.orderBy('review.rating', 'ASC');
        break;

      default:
        query.orderBy('review.createdAt', 'DESC');
    }

    query
      .skip((page - 1) * limit)
      .take(limit);

    const [reviews, total] = await query.getManyAndCount();

    return {
      data: reviews,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneByUserAndContent(contentId: string, userId: string) {

    const content = this.contentClient.send('content.findOne', { contentId })

    if (!content) {
      throw new RpcException('Content not found')
    }

    const review = await this.reviewRepository.findOne({ where: { contentId, userId } });
    return review;
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {

    const reviewToUpdate = await this.reviewRepository.findOne({ where: { id } });

    if (!reviewToUpdate) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }

    if (reviewToUpdate.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }
    Object.assign(reviewToUpdate, updateReviewDto);

    await this.reviewRepository.save(reviewToUpdate);

    //TODO! ESTO DEBE SER UN EVENTO
    // await this.updateContentRatingStats(reviewToUpdate.contentId);

    return { message: `Review with id ${id} has been updated` }
  }

  async remove(id: string, userId: string) {

    const reviewToDelete = await this.reviewRepository.findOne({ where: { id } });

    if (!reviewToDelete) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }
    if (reviewToDelete.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.reviewRepository.remove(reviewToDelete);

    //TODO! ESTO DEBE SER UN EVENTO
    // await this.updateContentRatingStats(reviewToDelete.contentId);
    return { message: `Review with id ${id} has been deleted` };

  }

  //TODO! ESTO DEBE SER UN EVENTO
  // private async updateContentRatingStats(contentId: string) {
  //   const { average, count } = await this.calculateRatingStats(contentId);

  //   await this.contentService.updateRatingStats(
  //     contentId,
  //     average,
  //     count,
  //   );
  // }

  //TODO! ESTO DEBE SER UN EVENTO
  // private async calculateRatingStats(contentId: string) {
  //   const { average, count } = await this.reviewRepository
  //     .createQueryBuilder('review')
  //     .select('AVG(review.rating)', 'average')
  //     .addSelect('COUNT(review.id)', 'count')
  //     .where('review.contentId = :contentId', { contentId })
  //     .getRawOne();

  //   return {
  //     average: Number(average) || 0,
  //     count: Number(count),
  //   };
  // }
}

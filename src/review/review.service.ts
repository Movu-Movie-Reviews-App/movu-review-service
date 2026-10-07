import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ReviewEntity } from './entities/review.entity';
import { Repository } from 'typeorm';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { WeeklyTopRatedDto } from './dto/weekly-top-rated.dto';
import { ReviewSortEnum } from './enums/review-sort.enum';
import { CONTENT_SERVICE } from 'src/config';
import { ClientProxy } from '@nestjs/microservices/client/client-proxy';
import { RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ReviewService {

  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepository: Repository<ReviewEntity>,

    @Inject(CONTENT_SERVICE) private readonly contentClient: ClientProxy

  ) { }


  async create(createReviewDto: CreateReviewDto, userId: string) {

    // contentId comes straight from the client, so it has to be proven to exist
    // before a review row is written against it.
    await this.ensureContentExists(createReviewDto.contentId);

    const existingReview = await this.findOneByUserAndContent(createReviewDto.contentId, userId);

    if (existingReview) {
      throw new ConflictException('User has already reviewed this content');
    }

    const { userId: __, ...createReviewDtoData } = createReviewDto

    const review = this.reviewRepository.create({ userId, ...createReviewDtoData });
    const savedReview = await this.reviewRepository.save(review);

    await this.publishContentRatingStats(savedReview.contentId);

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

    // No join to user: users live in user-service, behind its own database.
    const query = this.reviewRepository
      .createQueryBuilder('review')
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

  /**
   * Ranks content by the ratings it received in the given window. Content lives in
   * content-service and reviews live here, so the ranking is computed on this side
   * and returned as plain contentIds for the caller to hydrate.
   */
  async weeklyTopRated({ since, page = 1, limit = 4 }: WeeklyTopRatedDto) {

    const sinceDate = new Date(since);

    const baseQuery = () => this.reviewRepository
      .createQueryBuilder('review')
      .where('review.createdAt >= :since', { since: sinceDate });

    const { count } = await baseQuery()
      .select('COUNT(DISTINCT review.contentId)', 'count')
      .getRawOne();

    const rankedRows = await baseQuery()
      .select('review.contentId', 'contentId')
      .addSelect('AVG(review.rating)', 'weeklyRating')
      .addSelect('COUNT(review.id)', 'weeklyReviewsCount')
      .groupBy('review.contentId')
      .orderBy('"weeklyRating"', 'DESC')
      .addOrderBy('"weeklyReviewsCount"', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return {
      totalItems: Number(count),
      ranking: rankedRows.map((row) => ({
        contentId: row.contentId,
        weeklyRating: Number(row.weeklyRating),
        weeklyReviewsCount: Number(row.weeklyReviewsCount),
      })),
    };
  }

  async findOneByUserAndContent(contentId: string, userId: string) {
    const review = await this.reviewRepository.findOne({ where: { contentId, userId } });
    return review;
  }

  private async ensureContentExists(contentId: string) {
    try {
      // send() returns an Observable: without awaiting it, nothing is ever
      // actually requested and every id looks valid.
      await firstValueFrom(this.contentClient.send('content.findOne', { contentId }));
    } catch {
      throw new RpcException(`Content ${contentId} not found`);
    }
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {

    const reviewToUpdate = await this.reviewRepository.findOne({ where: { id } });

    if (!reviewToUpdate) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }

    if (reviewToUpdate.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    // Identity fields are routing data, not editable columns.
    const { id: _, userId: __, ...changes } = updateReviewDto;
    Object.assign(reviewToUpdate, changes);

    await this.reviewRepository.save(reviewToUpdate);

    await this.publishContentRatingStats(reviewToUpdate.contentId);

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

    // Capture the id before remove(), which strips the entity's primary key.
    const { contentId } = reviewToDelete;

    await this.reviewRepository.remove(reviewToDelete);

    await this.publishContentRatingStats(contentId);

    return { message: `Review with id ${id} has been deleted` };

  }

  /**
   * Recomputes this content's rating from the reviews we own and announces it.
   *
   * emit(), not send(): content-service being down must not fail the write the user
   * just made. The stats are derived data — the next review republishes them.
   */
  private async publishContentRatingStats(contentId: string) {
    const { average, count } = await this.calculateRatingStats(contentId);

    this.contentClient.emit('content.ratingStatsChanged', {
      contentId,
      averageRating: average,
      reviewsCount: count,
    });
  }

  private async calculateRatingStats(contentId: string) {
    const { average, count } = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.contentId = :contentId', { contentId })
      .getRawOne();

    return {
      average: Number(average) || 0,
      count: Number(count),
    };
  }
}

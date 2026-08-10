import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { ReviewEntity } from './entities/review.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { ContentClientModule } from 'src/infrastructure/messages/content-client/content-client.module';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService],
  imports: [TypeOrmModule.forFeature([ReviewEntity]), ContentClientModule],
})
export class ReviewModule { }

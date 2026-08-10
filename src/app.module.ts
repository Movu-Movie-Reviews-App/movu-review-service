import { Module } from '@nestjs/common';
import { ContentClientModule } from './infrastructure/messages/content-client/content-client.module';

@Module({
  imports: [ContentClientModule],

})
export class AppModule { }

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { PeopleModule } from './people/people.module';

@Module({
  imports: [DatabaseModule, PeopleModule],
  controllers: [HealthController],
})
export class AppModule {}

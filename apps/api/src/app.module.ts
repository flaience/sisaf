import { Module } from '@nestjs/common';
import { SecurityModule } from './security/security.module';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { PeopleModule } from './people/people.module';

@Module({
  imports: [DatabaseModule, PeopleModule, SecurityModule],
  controllers: [HealthController],
})
export class AppModule {}

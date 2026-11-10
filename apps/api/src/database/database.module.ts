import { Global, Module } from '@nestjs/common';
import { DatabaseProvider } from './database.provider';
import { PersonCodeService } from './person-code.service';

@Global()
@Module({
  providers: [DatabaseProvider, PersonCodeService],
  exports: [DatabaseProvider, PersonCodeService],
})
export class DatabaseModule {}

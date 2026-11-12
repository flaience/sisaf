import { Module } from '@nestjs/common';
import { SecurityGuard } from './security.guard';
import { SecurityContextResolverService } from './security-context-resolver.service';
import { AuthorizationService } from './authorization.service';
import { TokenVerifierService } from './token-verifier.service';

@Module({
  providers: [SecurityGuard, TokenVerifierService, AuthorizationService, SecurityContextResolverService],
  exports: [SecurityContextResolverService, SecurityGuard],
})
export class SecurityModule {}

import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { OnboardingService } from '../../core/services/onboarding.service';

/** The app proper opens only after the onboarding; otherwise go there first. */
export const onboardingDoneGuard: CanActivateFn = async () => {
  const done = await inject(OnboardingService).isCompleted();
  return done || inject(Router).parseUrl('/onboarding');
};

/** The onboarding runs once: afterwards it redirects to the home. */
export const onboardingPendingGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const done = await inject(OnboardingService).isCompleted();
  return done ? router.parseUrl('/tabs/home') : true;
};

import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

import { OnboardingService } from '../../core/services/onboarding.service';

// Note: inject() works only synchronously, so every service is injected before the first await.

/** The app proper opens only after the onboarding; otherwise go there first. */
export const onboardingDoneGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const onboarding = inject(OnboardingService);
  return (await onboarding.isCompleted()) || router.parseUrl('/onboarding');
};

/** The onboarding runs once: afterwards it redirects to the home. */
export const onboardingPendingGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const onboarding = inject(OnboardingService);
  return (await onboarding.isCompleted()) ? router.parseUrl('/tabs/home') : true;
};

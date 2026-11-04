import type { Routes } from '@angular/router';

import { onboardingDoneGuard, onboardingPendingGuard } from './features/onboarding/onboarding.guard';

export const routes: Routes = [
  {
    path: 'onboarding',
    canActivate: [onboardingPendingGuard],
    loadComponent: () => import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: 'tabs',
    canActivate: [onboardingDoneGuard],
    loadComponent: () => import('./features/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: 'home', loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage) },
      {
        path: 'transactions',
        loadComponent: () => import('./features/transactions/transactions.page').then((m) => m.TransactionsPage),
      },
      { path: 'budget', loadComponent: () => import('./features/budget/budget.page').then((m) => m.BudgetPage) },
      {
        path: 'analysis',
        loadComponent: () => import('./features/analysis/analysis.page').then((m) => m.AnalysisPage),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  {
    path: 'settings',
    canActivate: [onboardingDoneGuard],
    children: [
      { path: '', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
      {
        path: 'accounts',
        loadComponent: () => import('./features/settings/accounts/accounts.page').then((m) => m.AccountsPage),
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/settings/categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'backup',
        loadComponent: () => import('./features/settings/backup/backup.page').then((m) => m.BackupPage),
      },
    ],
  },
  { path: '', redirectTo: 'tabs/home', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/home' },
];

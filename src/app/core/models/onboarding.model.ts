/**
 * Where one onboarding step stands. Completed: its data is there. Current: the first step that is not done - the one
 * to do next. Pending: not done either, and waiting behind Current. Completed and Current steps are open; Pending
 * ones are disabled until the one before them is done.
 */
export type OnboardingStepState = 'Completed' | 'Current' | 'Pending';

/** OnboardingStepDto - one of the nine steps, in order. `route` is the tenant's real screen for the step. */
export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  /** Percentage points this step adds to progress; the nine add up to 100. */
  weight: number;
  route: string;
  state: OnboardingStepState;
  completedAt: string | null;
  /** For a step that is not done: what is still missing, in plain words. */
  missing: string | null;
}

/** OnboardingStatusDto - the tenant's onboarding. Reading it also records any step just completed. */
export interface OnboardingStatus {
  isCompleted: boolean;
  /** Sum of the weights of the completed steps. */
  progressPercent: number;
  currentStepKey: string | null;
  completedAt: string | null;
  steps: OnboardingStep[];
}

export function currentStep(status: OnboardingStatus | null | undefined): OnboardingStep | null {
  return status?.steps.find((s) => s.state === 'Current') ?? null;
}

/** Whether `url` is the screen of a step that is open (completed or the one to do next). */
export function isOpenStepUrl(status: OnboardingStatus, url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return status.steps
    .filter((s) => s.state !== 'Pending')
    .some((s) => path === s.route || path.startsWith(s.route + '/'));
}

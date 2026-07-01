/** Shared class bundles — coursify-theme.css (c-*) + legacy Tailwind aliases */

export const pageCanvas = 'bg-canvas min-h-full';
export const pageBody = 'p-8';
export const panel = 'c-card';
export const panelSm = 'c-card';
export const inputClass = 'c-input app-input';
export const accentBtn = 'c-btn c-btn-accent';
export const primaryBtn = 'c-btn c-btn-primary';
export const secondaryBtn = 'c-btn c-btn-ghost btn-secondary';
export const ghostBtn = 'c-btn c-btn-ghost';
/** Square 34×34 icon button — see .c-btn-icon in coursify-theme.css */
export const iconBtn = 'c-btn c-btn-ghost c-btn-icon';
/** Icon button on course thumbnails (hover overlay) */
export const thumbOverlayIconBtn =
  'c-btn c-btn-ghost c-btn-icon bg-surface/95 backdrop-blur-sm border border-line shadow-md';

/** Page header action row — secondary outline + primary accent CTA at matching size */
export const pageHeaderActions = 'flex items-center gap-3 flex-wrap justify-end';
export const headerSecondaryBtn = 'c-btn c-btn-ghost c-btn-lg';
export const headerPrimaryBtn = 'c-btn c-btn-primary c-btn-lg';

export function toolbarToggleBtn(active: boolean): string {
  return active ? headerPrimaryBtn : headerSecondaryBtn;
}

/** Learner list cards (My Notes, Q&A, etc.) */
export const listCardBtn = 'app-card flex items-center gap-3 p-5 rounded-lg text-left hover:border-brand-border transition-all group';
export const listCardIconWrap =
  'flex-shrink-0 w-12 h-12 rounded-lg border border-brand-border bg-brand-subtle flex items-center justify-center';
export const listCardIcon = 'w-6 h-6 text-accent';
export const listCardChevron = 'w-5 h-5 text-content-muted group-hover:text-accent flex-shrink-0';
export const answerQuoteBorder = 'border-l-2 border-brand-border';

export const textPrimary = 'text-primary text-content';
export const textSecondary = 'text-secondary text-content-secondary';
export const textMuted = 'text-muted text-content-muted';

export const legacyCard = 'app-card c-card';
export const legacyHeader = 'surface-1 border-b px-8 py-6 sticky top-0 z-20';
export const courseThumb = 'c-course-thumb';
export const courseThumbProgram = 'c-course-thumb program';
export const progressBar = 'c-progress';
export const progressFill = 'c-progress-fill';

/** Outlined status pills — see coursify-theme.css .c-badge-* */
export function courseStatusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === 'published') return 'c-badge c-badge-published c-thumb-badge';
  if (s === 'draft') return 'c-badge c-badge-draft c-thumb-badge';
  return 'c-badge c-badge-mute c-thumb-badge';
}

export function learnerStatusBadge(status: string): string {
  switch (status) {
    case 'active':
      return 'c-badge c-badge-ok';
    case 'at-risk':
      return 'c-badge c-badge-warn';
    case 'inactive':
      return 'c-badge c-badge-err';
    default:
      return 'c-badge c-badge-mute';
  }
}

export function enrollmentStageBadge(stage: string): string {
  if (stage === 'completed') return 'c-badge c-badge-ok c-thumb-badge';
  if (stage === 'in_progress') return 'c-badge c-badge-warn c-thumb-badge';
  return 'c-badge c-badge-enrolled c-thumb-badge';
}

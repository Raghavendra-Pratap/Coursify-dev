export type AnalyticsLearner = {
  id: string;
  name: string;
  email?: string;
  organization?: string | null;
  courses: number;
  completion: number;
  averageScore: number;
  totalTimeSpent: string;
  lastActive: string;
  status: string;
};

const DEPARTMENT_PRESETS: Record<string, string[]> = {
  sales: ['sales', 'business development', 'bd'],
  engineering: ['engineering', 'eng', 'tech', 'product', 'development'],
  marketing: ['marketing', 'growth', 'content'],
};

/** Match learner organization against preset or custom department slug. */
export function learnerMatchesDepartment(
  organization: string | null | undefined,
  department: string,
): boolean {
  if (department === 'all') return true;
  const org = (organization ?? '').toLowerCase().trim();
  if (department === 'unassigned') return org.length === 0;
  const preset = DEPARTMENT_PRESETS[department];
  if (preset) return preset.some((keyword) => org.includes(keyword));
  return org === department.toLowerCase() || org.includes(department.toLowerCase());
}

export function collectDepartmentOptions(learners: AnalyticsLearner[]): string[] {
  const orgs = new Set<string>();
  learners.forEach((l) => {
    const org = (l.organization ?? '').trim();
    if (org) orgs.add(org);
  });
  return Array.from(orgs).sort((a, b) => a.localeCompare(b));
}

export function filterLearnersByDepartment(
  learners: AnalyticsLearner[],
  department: string,
): AnalyticsLearner[] {
  return learners.filter((l) => learnerMatchesDepartment(l.organization, department));
}

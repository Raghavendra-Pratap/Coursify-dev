/**
 * Pure helpers for reorganizing course modules, lessons, and content items.
 */

export type StructureContentItem = {
  id: number;
  type: string;
  order: number;
  videoSegment?: {
    name?: string;
    duration?: string;
    startTimestamp?: number;
    endTimestamp?: number;
  };
  quiz?: { title?: string };
  form?: { title?: string };
  reading?: { title?: string };
  assessment?: { title?: string };
};

export type StructureLesson = {
  id: number;
  title: string;
  order: number;
  duration: string;
  content: StructureContentItem[];
};

export type StructureModule = {
  id: number;
  title: string;
  order: number;
  duration: string;
  lessons: StructureLesson[];
};

function parseDurationToSeconds(time: string): number {
  const t = time.trim();
  const minMatch = t.match(/^(\d+)\s*min$/);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;
  const parts = t.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + (parts[1] ?? 0);
  if (parts.length === 1 && !Number.isNaN(parts[0])) return parts[0];
  return 0;
}

function formatSeconds(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function contentItemLabel(item: StructureContentItem): string {
  if (item.type === 'video') return item.videoSegment?.name?.trim() || 'Video';
  if (item.type === 'quiz') return item.quiz?.title?.trim() || 'Quiz';
  if (item.type === 'form') return item.form?.title?.trim() || 'Google Form';
  if (item.type === 'reading') return item.reading?.title?.trim() || 'Reading';
  if (item.type === 'assessment') return item.assessment?.title?.trim() || 'Assessment';
  return 'Content';
}

function lessonDurationSeconds(lesson: StructureLesson): number {
  return lesson.content
    .filter((c) => c.type === 'video' && c.videoSegment)
    .reduce((acc, c) => {
      const vs = c.videoSegment!;
      if (vs.startTimestamp != null && vs.endTimestamp != null) return acc + (vs.endTimestamp - vs.startTimestamp);
      return acc + parseDurationToSeconds(vs.duration || '0:00');
    }, 0);
}

function moduleDurationSeconds(mod: StructureModule): number {
  return mod.lessons.reduce((acc, l) => acc + lessonDurationSeconds(l), 0);
}

function withRecalculatedDurations(modules: StructureModule[]): StructureModule[] {
  return modules.map((mod, modOrder) => ({
    ...mod,
    order: modOrder,
    duration: formatSeconds(moduleDurationSeconds(mod)),
    lessons: mod.lessons.map((lesson, lessonOrder) => ({
      ...lesson,
      order: lessonOrder,
      duration: formatSeconds(lessonDurationSeconds(lesson)),
      content: lesson.content.map((item, contentOrder) => ({ ...item, order: contentOrder })),
    })),
  }));
}

function cloneModules(modules: StructureModule[]): StructureModule[] {
  return JSON.parse(JSON.stringify(modules)) as StructureModule[];
}

function removeEmptyLessonsAndModules(modules: StructureModule[]): StructureModule[] {
  return modules
    .map((mod) => ({ ...mod, lessons: mod.lessons.filter((l) => l.content.length > 0) }))
    .filter((mod) => mod.lessons.length > 0);
}

export function moveContentItem(
  modules: StructureModule[],
  from: { moduleIndex: number; lessonIndex: number; contentIndex: number },
  to: { moduleIndex: number; lessonIndex: number; contentIndex?: number }
): StructureModule[] {
  const next = cloneModules(modules);
  const sourceLesson = next[from.moduleIndex]?.lessons[from.lessonIndex];
  const targetLesson = next[to.moduleIndex]?.lessons[to.lessonIndex];
  if (!sourceLesson || !targetLesson) return modules;

  const [item] = sourceLesson.content.splice(from.contentIndex, 1);
  if (!item) return modules;

  const insertAt =
    to.contentIndex != null
      ? Math.min(Math.max(0, to.contentIndex), targetLesson.content.length)
      : targetLesson.content.length;
  targetLesson.content.splice(insertAt, 0, item);

  return withRecalculatedDurations(removeEmptyLessonsAndModules(next));
}

export function moveLesson(
  modules: StructureModule[],
  from: { moduleIndex: number; lessonIndex: number },
  toModuleIndex: number,
  toLessonIndex?: number
): StructureModule[] {
  const next = cloneModules(modules);
  const sourceMod = next[from.moduleIndex];
  const targetMod = next[toModuleIndex];
  if (!sourceMod || !targetMod) return modules;

  const [lesson] = sourceMod.lessons.splice(from.lessonIndex, 1);
  if (!lesson) return modules;

  const insertAt =
    toLessonIndex != null
      ? Math.min(Math.max(0, toLessonIndex), targetMod.lessons.length)
      : targetMod.lessons.length;
  targetMod.lessons.splice(insertAt, 0, lesson);

  const cleaned = next.filter((mod) => mod.lessons.length > 0);
  return withRecalculatedDurations(cleaned.length > 0 ? cleaned : removeEmptyLessonsAndModules(next));
}

export function promoteContentToNewLesson(
  modules: StructureModule[],
  from: { moduleIndex: number; lessonIndex: number; contentIndex: number }
): StructureModule[] {
  const next = cloneModules(modules);
  const sourceLesson = next[from.moduleIndex]?.lessons[from.lessonIndex];
  if (!sourceLesson) return modules;
  const [item] = sourceLesson.content.splice(from.contentIndex, 1);
  if (!item) return modules;

  const newLesson: StructureLesson = {
    id: Date.now(),
    title: contentItemLabel(item),
    order: sourceLesson.order + 1,
    duration: '0:00',
    content: [item],
  };
  next[from.moduleIndex].lessons.splice(from.lessonIndex + 1, 0, newLesson);
  return withRecalculatedDurations(next);
}

export function promoteLessonToNewModule(
  modules: StructureModule[],
  from: { moduleIndex: number; lessonIndex: number }
): StructureModule[] {
  const next = cloneModules(modules);
  const sourceMod = next[from.moduleIndex];
  if (!sourceMod) return modules;
  const [lesson] = sourceMod.lessons.splice(from.lessonIndex, 1);
  if (!lesson) return modules;

  const newModule: StructureModule = {
    id: Date.now(),
    title: lesson.title,
    order: from.moduleIndex + 1,
    duration: '0:00',
    lessons: [lesson],
  };
  next.splice(from.moduleIndex + 1, 0, newModule);
  return withRecalculatedDurations(next.filter((mod) => mod.lessons.length > 0));
}

export type StructureLocation = {
  moduleIndex: number;
  lessonIndex: number;
  contentIndex?: number;
};

export function flattenStructure(modules: StructureModule[]): Array<{
  moduleIndex: number;
  lessonIndex: number;
  contentIndex?: number;
  kind: 'module' | 'lesson' | 'content';
  label: string;
}> {
  const rows: Array<{
    moduleIndex: number;
    lessonIndex: number;
    contentIndex?: number;
    kind: 'module' | 'lesson' | 'content';
    label: string;
  }> = [];
  modules.forEach((mod, moduleIndex) => {
    mod.lessons.forEach((lesson, lessonIndex) => {
      lesson.content.forEach((_item, contentIndex) => {
        rows.push({
          moduleIndex,
          lessonIndex,
          contentIndex,
          kind: 'content',
          label: `${mod.title} → ${lesson.title}`,
        });
      });
    });
  });
  return rows;
}

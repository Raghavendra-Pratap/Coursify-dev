/**
 * Parse CSV course import sheet into a structure suitable for DB insert.
 * CSV: first row = course title/description, second row = headers, then data rows (one per content item).
 * Blank module_title or lesson_title means "same as previous row".
 */

const CONTENT_TYPES = ['video', 'reading', 'quiz', 'form'] as const;
const VIDEO_SOURCES = ['youtube', 'google_drive', 'external_url'] as const;
const READING_TYPES = ['url', 'native'] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type VideoSource = (typeof VIDEO_SOURCES)[number];
export type ReadingType = (typeof READING_TYPES)[number];

export interface ValidationError {
  row: number;
  message: string;
}

export interface VideoSegmentRow {
  segmentIndex: number; // 0-based order within this video content item (from segment_sequence column)
  name: string;
  source: VideoSource;
  sourceUrl: string;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
}

export interface ReadingRow {
  type: ReadingType;
  title: string;
  url?: string;
  body?: string;
}

export interface QuizRow {
  title: string;
  formUrl?: string;
}

export interface FormRow {
  title: string;
  formUrl?: string;
}

export interface ContentItemRow {
  order: number;
  type: ContentType;
  /** For video: one or more segments in order (segment_index = segmentIndex). */
  videoSegments?: VideoSegmentRow[];
  video?: VideoSegmentRow; // deprecated: use videoSegments; parser may set one of these
  reading?: ReadingRow;
  quiz?: QuizRow;
  form?: FormRow;
}

/** One row from CSV before collapsing video segments (internal). */
interface RawContentRow {
  contentOrder: number;
  type: ContentType;
  segmentSequence: number;
  video?: VideoSegmentRow;
  reading?: ReadingRow;
  quiz?: QuizRow;
  form?: FormRow;
}

export interface LessonRow {
  order: number;
  title: string;
  description?: string;
  durationSeconds?: number;
  content: ContentItemRow[];
  /** Filled during parse, then collapsed into content. */
  rawContentRows?: RawContentRow[];
}

export interface ModuleRow {
  order: number;
  title: string;
  description?: string;
  lessons: LessonRow[];
}

export interface ParsedCourseSheet {
  title: string;
  description: string;
  modules: ModuleRow[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let inQuoted = false;
  let field = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuoted = true;
      continue;
    }
    if (c === ',' || c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
      if (c === '\r') i++;
      if (c === '\n' || c === '\r') {
        current.push(field.trim());
        if (current.some((cell) => cell.length > 0)) rows.push(current);
        current = [];
        field = '';
      } else {
        current.push(field.trim());
        field = '';
      }
      continue;
    }
    field += c;
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field.trim());
    if (current.some((cell) => cell.length > 0)) rows.push(current);
  }
  return rows;
}

function getHeaderIndex(headers: string[], name: string): number {
  const lower = name.toLowerCase();
  return headers.findIndex((h) => (h ?? '').trim().replace(BOM, '').toLowerCase() === lower);
}

/** Parse "H:MM:SS" or "M:SS" or plain seconds number to seconds. Returns 0 if invalid. */
function parseTimeToSeconds(value: string): number {
  const s = (value ?? '').trim();
  if (!s) return 0;
  const n = parseInt(s, 10);
  if (String(n) === s && !s.includes(':')) return Number.isNaN(n) ? 0 : Math.max(0, n);
  const parts = s.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return Math.max(0, parts[0]! * 60 + parts[1]!);
  if (parts.length === 3) return Math.max(0, parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
  return 0;
}

function getCell(row: string[], headers: string[], name: string): string {
  const i = getHeaderIndex(headers, name);
  if (i < 0 || i >= row.length) return '';
  return (row[i] ?? '').trim();
}

const BOM = '\uFEFF';

export function parseCourseSheet(csvText: string): { data: ParsedCourseSheet | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const normalizedText = csvText.startsWith(BOM) ? csvText.slice(BOM.length) : csvText;
  const rawRows = parseCsv(normalizedText);
  if (rawRows.length < 2) {
    errors.push({ row: 1, message: 'CSV must have at least a header row and one data row.' });
    return { data: null, errors };
  }

  // Support both formats: (1) row0=course, row1=headers, row2+=data  OR  (2) row0=headers, row1+=data
  const firstRow = rawRows[0] ?? [];
  const firstCell = (firstRow[0] ?? '').trim().replace(BOM, '').toLowerCase();
  const hasHeaderInFirstRow = firstCell === 'course_title' || firstRow.some((c) => (c ?? '').trim().replace(BOM, '').toLowerCase() === 'course_title');
  let courseRow: string[];
  let headerRow: string[];
  let dataRows: string[][];
  if (hasHeaderInFirstRow && rawRows.length >= 2) {
    headerRow = firstRow;
    dataRows = rawRows.slice(1);
    courseRow = dataRows[0] ?? [];
  } else {
    courseRow = rawRows[0] ?? [];
    headerRow = rawRows[1] ?? [];
    dataRows = rawRows.slice(2);
  }
  const firstDataRowIndex = hasHeaderInFirstRow ? 2 : 3;

  const requiredHeaders = ['course_title', 'module_order', 'module_title', 'lesson_order', 'lesson_title', 'content_order', 'content_type'];
  for (const h of requiredHeaders) {
    if (getHeaderIndex(headerRow, h) < 0) {
      errors.push({ row: 2, message: `Missing required column: ${h}` });
    }
  }
  if (errors.length > 0) return { data: null, errors };

  const courseTitle = (courseRow[getHeaderIndex(headerRow, 'course_title')] ?? '').trim() || (dataRows[0] ? getCell(dataRows[0], headerRow, 'course_title') : '');
  const courseDescription = (courseRow[getHeaderIndex(headerRow, 'course_description')] ?? '').trim() || (dataRows[0] ? getCell(dataRows[0], headerRow, 'course_description') : '');

  if (!courseTitle && dataRows.length > 0) {
    const firstDataTitle = getCell(dataRows[0], headerRow, 'course_title');
    if (!firstDataTitle) errors.push({ row: firstDataRowIndex, message: 'course_title is required (set in first row or first data row).' });
  }

  const title = courseTitle || getCell(dataRows[0] ?? [], headerRow, 'course_title') || 'Untitled Course';
  const description = courseDescription || getCell(dataRows[0] ?? [], headerRow, 'course_description') || '';

  const modulesByKey = new Map<string, ModuleRow>();
  const lessonsByKey = new Map<string, LessonRow>();
  let lastResolvedModOrder = 0;
  let lastResolvedModTitle = 'Module 0';
  let lastResolvedLesOrder = 0;
  let lastResolvedLesTitle = 'Lesson 0';

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowNum = r + firstDataRowIndex;
    if (!row || row.every((c) => !c || c.trim() === '')) continue;

    const contentOrder = parseInt(getCell(row, headerRow, 'content_order'), 10);
    const contentType = getCell(row, headerRow, 'content_type').toLowerCase();
    if (!CONTENT_TYPES.includes(contentType as ContentType)) {
      errors.push({ row: rowNum, message: `content_type must be one of: ${CONTENT_TYPES.join(', ')}` });
      continue;
    }

    let modOrder = parseInt(getCell(row, headerRow, 'module_order'), 10);
    let modTitle = getCell(row, headerRow, 'module_title');
    let lesOrder = parseInt(getCell(row, headerRow, 'lesson_order'), 10);
    let lesTitle = getCell(row, headerRow, 'lesson_title');
    if (Number.isNaN(modOrder)) modOrder = lastResolvedModOrder;
    if (Number.isNaN(lesOrder)) lesOrder = lastResolvedLesOrder;
    if (!modTitle) {
      modOrder = lastResolvedModOrder;
      modTitle = lastResolvedModTitle;
    } else {
      lastResolvedModOrder = modOrder;
      lastResolvedModTitle = modTitle;
    }
    if (!lesTitle) {
      lesOrder = lastResolvedLesOrder;
      lesTitle = lastResolvedLesTitle;
    } else {
      lastResolvedLesOrder = lesOrder;
      lastResolvedLesTitle = lesTitle;
    }
    if (Number.isNaN(contentOrder) && contentOrder !== 0) {
      errors.push({ row: rowNum, message: 'content_order must be a number.' });
      continue;
    }

    const modKey = `${modOrder}|${modTitle}`;
    const lesKey = `${modKey}|${lesOrder}|${lesTitle}`;

    if (!modulesByKey.has(modKey)) {
      modulesByKey.set(modKey, { order: modOrder, title: modTitle, lessons: [] });
    }
    const mod = modulesByKey.get(modKey)!;
    if (!lessonsByKey.has(lesKey)) {
      const lessonDesc = getCell(row, headerRow, 'lesson_description');
      const lessonDur = getCell(row, headerRow, 'lesson_duration_seconds');
      const durNum = lessonDur ? parseTimeToSeconds(lessonDur) : undefined;
      lessonsByKey.set(lesKey, {
        order: lesOrder,
        title: lesTitle,
        description: lessonDesc || undefined,
        durationSeconds: durNum > 0 ? durNum : undefined,
        content: [],
        rawContentRows: [],
      });
      mod.lessons.push(lessonsByKey.get(lesKey)!);
    }
    const lesson = lessonsByKey.get(lesKey)!;

    const segmentSequence = parseInt(getCell(row, headerRow, 'segment_sequence'), 10);
    const segSeq = Number.isNaN(segmentSequence) ? 0 : Math.max(0, segmentSequence);

    const raw: RawContentRow = {
      contentOrder: contentOrder,
      type: contentType as ContentType,
      segmentSequence: segSeq,
    };

    if (contentType === 'video') {
      const videoName = getCell(row, headerRow, 'video_name') || 'Video';
      const videoSource = (getCell(row, headerRow, 'video_source') || 'youtube').toLowerCase();
      const videoUrl = getCell(row, headerRow, 'video_url');
      if (!VIDEO_SOURCES.includes(videoSource as VideoSource)) {
        errors.push({ row: rowNum, message: `video_source must be one of: ${VIDEO_SOURCES.join(', ')}` });
      }
      if (!videoUrl) {
        errors.push({ row: rowNum, message: 'video_url is required for content_type video.' });
      }
      const durSec = parseTimeToSeconds(getCell(row, headerRow, 'video_duration_seconds')) || 0;
      const startSec = parseTimeToSeconds(getCell(row, headerRow, 'video_start_seconds')) || 0;
      const endSec = parseTimeToSeconds(getCell(row, headerRow, 'video_end_seconds')) || durSec || 0;
      raw.video = {
        segmentIndex: segSeq,
        name: videoName,
        source: (videoSource as VideoSource) || 'youtube',
        sourceUrl: videoUrl,
        durationSeconds: endSec - startSec || durSec || 60,
        startSeconds: startSec,
        endSeconds: endSec || startSec + (durSec || 60),
      };
    }
    if (contentType === 'reading') {
      const readingType = (getCell(row, headerRow, 'reading_type') || 'url').toLowerCase() as ReadingType;
      if (!READING_TYPES.includes(readingType)) {
        errors.push({ row: rowNum, message: 'reading_type must be url or native.' });
      }
      raw.reading = {
        type: readingType === 'native' ? 'native' : 'url',
        title: getCell(row, headerRow, 'reading_title') || 'Reading',
        url: getCell(row, headerRow, 'reading_url') || undefined,
        body: getCell(row, headerRow, 'reading_body') || undefined,
      };
    }
    if (contentType === 'quiz') {
      raw.quiz = {
        title: getCell(row, headerRow, 'quiz_title') || 'Quiz',
        formUrl: getCell(row, headerRow, 'quiz_form_url') || undefined,
      };
    }
    if (contentType === 'form') {
      raw.form = {
        title: getCell(row, headerRow, 'form_title') || 'Form',
        formUrl: getCell(row, headerRow, 'form_url') || undefined,
      };
    }

    lesson.rawContentRows!.push(raw);
  }

  // Collapse raw rows into content: group video rows by (content_order), merge into one item with videoSegments
  modulesByKey.forEach((mod) => {
    mod.lessons.forEach((lesson) => {
      const rawRows = lesson.rawContentRows ?? [];
      rawRows.sort((a, b) => a.contentOrder - b.contentOrder || a.segmentSequence - b.segmentSequence);
      const byOrder = new Map<number, RawContentRow[]>();
      for (const r of rawRows) {
        const list = byOrder.get(r.contentOrder) ?? [];
        list.push(r);
        byOrder.set(r.contentOrder, list);
      }
      const content: ContentItemRow[] = [];
      const orders = Array.from(byOrder.keys()).sort((a, b) => a - b);
      for (const order of orders) {
        const group = byOrder.get(order)!;
        const first = group[0]!;
        if (first.type === 'video' && group.every((r) => r.type === 'video')) {
          const segments = group
            .sort((a, b) => (a.video?.segmentIndex ?? 0) - (b.video?.segmentIndex ?? 0))
            .map((r) => r.video!)
            .filter(Boolean);
          content.push({ order: first.contentOrder, type: 'video', videoSegments: segments });
        } else {
          for (const r of group) {
            const item: ContentItemRow = { order: r.contentOrder, type: r.type };
            if (r.video) item.videoSegments = [r.video];
            if (r.reading) item.reading = r.reading;
            if (r.quiz) item.quiz = r.quiz;
            if (r.form) item.form = r.form;
            content.push(item);
          }
        }
      }
      lesson.content = content.sort((a, b) => a.order - b.order);
      delete lesson.rawContentRows;
    });
  });

  const moduleList = Array.from(modulesByKey.values()).sort((a, b) => a.order - b.order);
  moduleList.forEach((m) => {
    m.lessons.sort((a, b) => a.order - b.order);
    m.lessons.forEach((l) => l.content.sort((a, b) => a.order - b.order));
  });

  if (moduleList.length === 0 && dataRows.some((row) => row.some((c) => c?.trim()))) {
    errors.push({ row: firstDataRowIndex, message: 'No valid data rows. Check required columns and content_type.' });
  }

  return {
    data: errors.length > 0 ? null : { title, description, modules: moduleList },
    errors,
  };
}

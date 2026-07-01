'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  HelpCircle,
  LayoutList,
  Menu,
  Video,
  X,
  Youtube,
} from 'lucide-react';
import {
  contentItemLabel,
  moveContentItem,
  moveLesson,
  promoteContentToNewLesson,
  promoteLessonToNewModule,
  type StructureContentItem,
  type StructureLesson,
  type StructureModule,
} from '@/lib/course-structure';

type DragPayload =
  | { kind: 'content'; moduleIndex: number; lessonIndex: number; contentIndex: number }
  | { kind: 'lesson'; moduleIndex: number; lessonIndex: number };

function dragTransfer(e: React.DragEvent): { dropEffect: string; effectAllowed: string } {
  return e.dataTransfer as unknown as { dropEffect: string; effectAllowed: string };
}

function selectValue(e: React.ChangeEvent<HTMLSelectElement>): string {
  return (e.target as unknown as { value: string }).value;
}

function clearSelect(e: React.ChangeEvent<HTMLSelectElement>): void {
  (e.target as unknown as { value: string }).value = '';
}

interface CourseStructurePanelProps {
  open: boolean;
  onClose: () => void;
  modules: StructureModule[];
  onChange: (modules: StructureModule[]) => void;
  onNavigate?: (moduleIndex: number, lessonIndex: number, contentIndex?: number) => void;
}

function ContentTypeIcon({ type }: { type: string }) {
  if (type === 'video') return <Video className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
  if (type === 'reading') return <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />;
  if (type === 'assessment') return <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />;
  if (type === 'form') return <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />;
  if (type === 'quiz') return <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />;
  return <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />;
}

export function CourseStructurePanel({ open, onClose, modules, onChange, onNavigate }: CourseStructurePanelProps) {
  const [expandedModules, setExpandedModules] = useState<Set<number>>(() => new Set(modules.map((_, i) => i)));
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState<DragPayload | null>(null);

  useEffect(() => {
    if (!open) return;
    setExpandedModules(new Set(modules.map((_, i) => i)));
    const lessonKeys = new Set<string>();
    modules.forEach((mod, moduleIndex) => {
      mod.lessons.forEach((_, lessonIndex) => lessonKeys.add(`${moduleIndex}-${lessonIndex}`));
    });
    setExpandedLessons(lessonKeys);
  }, [open, modules]);

  const lessonTargets = useMemo(() => {
    const targets: { key: string; moduleIndex: number; lessonIndex: number; label: string }[] = [];
    modules.forEach((mod, moduleIndex) => {
      mod.lessons.forEach((lesson, lessonIndex) => {
        targets.push({
          key: `${moduleIndex}-${lessonIndex}`,
          moduleIndex,
          lessonIndex,
          label: `${mod.title || 'Module'} → ${lesson.title || 'Lesson'}`,
        });
      });
    });
    return targets;
  }, [modules]);

  const moduleTargets = useMemo(
    () =>
      modules.map((mod, moduleIndex) => ({
        moduleIndex,
        label: mod.title || `Module ${moduleIndex + 1}`,
      })),
    [modules]
  );

  const toggleModule = (idx: number) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleLesson = (moduleIndex: number, lessonIndex: number) => {
    const key = `${moduleIndex}-${lessonIndex}`;
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyMoveContent = useCallback(
    (from: DragPayload & { kind: 'content' }, toModuleIndex: number, toLessonIndex: number, toContentIndex?: number) => {
      onChange(
        moveContentItem(
          modules,
          { moduleIndex: from.moduleIndex, lessonIndex: from.lessonIndex, contentIndex: from.contentIndex },
          { moduleIndex: toModuleIndex, lessonIndex: toLessonIndex, contentIndex: toContentIndex }
        )
      );
    },
    [modules, onChange]
  );

  const handleDropOnLesson = (e: React.DragEvent, moduleIndex: number, lessonIndex: number) => {
    e.preventDefault();
    if (!dragging) return;
    if (dragging.kind === 'content') {
      applyMoveContent(dragging, moduleIndex, lessonIndex);
    } else if (dragging.kind === 'lesson') {
      onChange(moveLesson(modules, dragging, moduleIndex, lessonIndex));
    }
    setDragging(null);
  };

  if (!open) return null;

  const totalContent = modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + l.content.length, 0), 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <LayoutList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Organize course structure</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {modules.length} modules · {modules.reduce((a, m) => a + m.lessons.length, 0)} lessons · {totalContent} items
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="px-6 py-3 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 text-sm text-blue-900 dark:text-blue-200 flex-shrink-0">
          Drag videos and content into lessons, or use <strong>Move to</strong> to place chapters in a different lesson or module.
          Use <strong>New lesson</strong> / <strong>New module</strong> to split items out.
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {modules.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No modules yet. Add content or import from YouTube first.</p>
          ) : (
            modules.map((mod, moduleIndex) => {
              const modExpanded = expandedModules.has(moduleIndex);
              return (
                <div
                  key={mod.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden"
                  onDragOver={(e) => {
                    e.preventDefault();
                    dragTransfer(e).dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging?.kind === 'lesson') {
                      onChange(moveLesson(modules, dragging, moduleIndex, mod.lessons.length));
                      setDragging(null);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleModule(moduleIndex)}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 text-left"
                  >
                    {modExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-gray-900 dark:text-white flex-1 truncate">
                      Module {moduleIndex + 1}: {mod.title || 'Untitled module'}
                    </span>
                    <span className="text-xs text-gray-500">{mod.lessons.length} lessons</span>
                  </button>

                  {modExpanded && (
                    <div className="p-3 space-y-2 bg-white dark:bg-gray-800">
                      {mod.lessons.length === 0 ? (
                        <p className="text-xs text-gray-400 px-2 py-3">No lessons — drag a lesson here or add one from the sidebar.</p>
                      ) : (
                        mod.lessons.map((lesson, lessonIndex) => (
                          <LessonRow
                            key={lesson.id}
                            lesson={lesson}
                            moduleIndex={moduleIndex}
                            lessonIndex={lessonIndex}
                            expanded={expandedLessons.has(`${moduleIndex}-${lessonIndex}`)}
                            onToggle={() => toggleLesson(moduleIndex, lessonIndex)}
                            lessonTargets={lessonTargets}
                            moduleTargets={moduleTargets}
                            dragging={dragging}
                            setDragging={setDragging}
                            onMoveContent={(contentIndex, targetKey) => {
                              const target = lessonTargets.find((t) => t.key === targetKey);
                              if (!target) return;
                              applyMoveContent(
                                { kind: 'content', moduleIndex, lessonIndex, contentIndex },
                                target.moduleIndex,
                                target.lessonIndex
                              );
                            }}
                            onMoveLesson={(targetModuleIndex) => {
                              onChange(moveLesson(modules, { moduleIndex, lessonIndex }, targetModuleIndex));
                            }}
                            onPromoteLesson={() => {
                              onChange(promoteLessonToNewModule(modules, { moduleIndex, lessonIndex }));
                            }}
                            onPromoteContent={(contentIndex) => {
                              onChange(promoteContentToNewLesson(modules, { moduleIndex, lessonIndex, contentIndex }));
                            }}
                            onDrop={handleDropOnLesson}
                            onNavigate={onNavigate}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  moduleIndex,
  lessonIndex,
  expanded,
  onToggle,
  lessonTargets,
  moduleTargets,
  dragging,
  setDragging,
  onMoveContent,
  onMoveLesson,
  onPromoteLesson,
  onPromoteContent,
  onDrop,
  onNavigate,
}: {
  lesson: StructureLesson;
  moduleIndex: number;
  lessonIndex: number;
  expanded: boolean;
  onToggle: () => void;
  lessonTargets: { key: string; moduleIndex: number; lessonIndex: number; label: string }[];
  moduleTargets: { moduleIndex: number; label: string }[];
  dragging: DragPayload | null;
  setDragging: (v: DragPayload | null) => void;
  onMoveContent: (contentIndex: number, targetKey: string) => void;
  onMoveLesson: (targetModuleIndex: number) => void;
  onPromoteLesson: () => void;
  onPromoteContent: (contentIndex: number) => void;
  onDrop: (e: React.DragEvent, moduleIndex: number, lessonIndex: number) => void;
  onNavigate?: (moduleIndex: number, lessonIndex: number, contentIndex?: number) => void;
}) {
  const isDropTarget = dragging != null;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isDropTarget ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : 'border-gray-200 dark:border-gray-600'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragTransfer(e).dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDrop(e, moduleIndex, lessonIndex);
      }}
    >
      <div
        draggable
        onDragStart={(e) => {
          setDragging({ kind: 'lesson', moduleIndex, lessonIndex });
          dragTransfer(e).effectAllowed = 'move';
        }}
        onDragEnd={() => setDragging(null)}
        className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/40"
      >
        <Menu className="w-3.5 h-3.5 text-gray-400 cursor-grab flex-shrink-0" />
        <button type="button" onClick={onToggle} className="flex items-center gap-1 flex-1 min-w-0 text-left">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            Lesson {lessonIndex + 1}: {lesson.title}
          </span>
          <span className="text-xs text-gray-500 ml-1">({lesson.content.length} items)</span>
        </button>
        <select
          value=""
          onChange={(e) => {
            const val = selectValue(e);
            if (!val) return;
            if (val.startsWith('mod:')) onMoveLesson(parseInt(val.slice(4), 10));
            clearSelect(e);
          }}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 dark:text-white max-w-[140px]"
          title="Move lesson to module"
        >
          <option value="">Move to module…</option>
          {moduleTargets
            .filter((t) => t.moduleIndex !== moduleIndex)
            .map((t) => (
              <option key={t.moduleIndex} value={`mod:${t.moduleIndex}`}>
                {t.label}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={onPromoteLesson}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          New module
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-1">
          {lesson.content.length === 0 ? (
            <p className="text-xs text-gray-400 px-2 py-2">Drop content here</p>
          ) : (
            lesson.content.map((item, contentIndex) => (
              <ContentRow
                key={item.id}
                item={item}
                moduleIndex={moduleIndex}
                lessonIndex={lessonIndex}
                contentIndex={contentIndex}
                lessonTargets={lessonTargets.filter((t) => !(t.moduleIndex === moduleIndex && t.lessonIndex === lessonIndex))}
                setDragging={setDragging}
                onMove={(targetKey) => onMoveContent(contentIndex, targetKey)}
                onPromote={() => onPromoteContent(contentIndex)}
                onNavigate={onNavigate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ContentRow({
  item,
  moduleIndex,
  lessonIndex,
  contentIndex,
  lessonTargets,
  setDragging,
  onMove,
  onPromote,
  onNavigate,
}: {
  item: StructureContentItem;
  moduleIndex: number;
  lessonIndex: number;
  contentIndex: number;
  lessonTargets: { key: string; label: string }[];
  setDragging: (v: DragPayload | null) => void;
  onMove: (targetKey: string) => void;
  onPromote: () => void;
  onNavigate?: (moduleIndex: number, lessonIndex: number, contentIndex?: number) => void;
}) {
  const label = contentItemLabel(item);
  const segment =
    item.type === 'video' && item.videoSegment?.startTimestamp != null
      ? `${formatTs(item.videoSegment.startTimestamp)} – ${formatTs(item.videoSegment.endTimestamp ?? 0)}`
      : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        setDragging({ kind: 'content', moduleIndex, lessonIndex, contentIndex });
        dragTransfer(e).effectAllowed = 'move';
      }}
      onDragEnd={() => setDragging(null)}
      className="flex flex-wrap items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
    >
      <Menu className="w-3.5 h-3.5 text-gray-400 cursor-grab flex-shrink-0 opacity-60 group-hover:opacity-100" />
      <ContentTypeIcon type={item.type} />
      <button
        type="button"
        onClick={() => onNavigate?.(moduleIndex, lessonIndex, contentIndex)}
        className="flex-1 min-w-0 text-left text-sm text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400"
        title="Open in editor"
      >
        {label}
      </button>
      {segment && (
        <span className="text-[10px] font-mono text-gray-500 whitespace-nowrap flex items-center gap-0.5">
          <Youtube className="w-3 h-3 text-red-500" />
          {segment}
        </span>
      )}
      <select
        value=""
        onChange={(e) => {
          const val = selectValue(e);
          if (val) onMove(val);
          clearSelect(e);
        }}
        className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 dark:text-white max-w-[160px]"
      >
        <option value="">Move to lesson…</option>
        {lessonTargets.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={onPromote} className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">
        New lesson
      </button>
    </div>
  );
}

function formatTs(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

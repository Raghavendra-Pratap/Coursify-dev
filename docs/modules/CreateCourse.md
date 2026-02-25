# Module: CreateCourse

**Location**: `components/pages/CreateCourse.tsx`  
**Lines of Code**: ~1,418  
**Complexity**: High - Core feature module with micro-video editing

---

## Purpose

The CreateCourse module is the central component for course creation and editing in Coursify LMS. It provides a comprehensive interface for building courses with a hierarchical structure (Modules → Lessons → Content Items), supports multiple video upload methods (file upload, Google Drive, YouTube), enables drag-and-drop reordering, and includes quiz/form insertion capabilities. This module implements the core differentiating feature: micro-video management where video segments can be updated individually without re-recording entire videos.

---

## Concepts

### Hierarchical Course Structure

Courses are organized in a three-level hierarchy:
1. **Modules** - Top-level organization units (e.g., "Introduction", "Core Concepts")
2. **Lessons** - Individual learning units within modules (e.g., "Welcome & Overview")
3. **Content Items** - Actual content within lessons (videos, quizzes, forms)

This structure allows for flexible course organization and supports the micro-video feature where a lesson can contain multiple video segments that are stitched together during playback.

### Micro-Video Management

The core differentiator: Instead of one monolithic video per lesson, lessons can contain multiple video segments. Each segment can be:
- **Individually updated** without affecting other segments
- **Reordered** within a lesson
- **Sourced** from different locations (upload, Google Drive, YouTube)
- **Streamed** with specific start/end timestamps

This enables instructors to update a 2-minute section of a 30-minute lesson without re-recording the entire video.

### Content Item Types

A lesson can contain multiple content items in sequence:
- **Video** - Video segments with optional streaming timestamps
- **Quiz** - Assessment with questions that must be passed to continue
- **Form** - Data collection forms (structure similar to quizzes)

Content items are ordered and can be reordered via drag-and-drop.

### Drag-and-Drop Reordering

Three levels of drag-and-drop:
1. **Module-level** - Reorder entire modules
2. **Lesson-level** - Reorder lessons within a module
3. **Content-level** - Reorder content items within a lesson

Each level maintains its own order index and updates parent durations accordingly.

---

## Architecture

### Overview

```
CreateCourse Component
├── State Management (18+ useState hooks)
│   ├── Course Structure State (courseData)
│   ├── UI State (modals, selections, drag state)
│   └── Form State (upload inputs, quiz data)
│
├── Sidebar (Course Structure)
│   ├── Module List (drag-and-drop)
│   ├── Lesson List (per module, drag-and-drop)
│   └── Content List (per lesson, drag-and-drop)
│
├── Main Editor Area
│   ├── Video Player/Preview
│   ├── Content Editor (video/quiz/form)
│   └── Version History Panel
│
└── Modals
    ├── Upload Modal (file/Drive/YouTube)
    ├── Quiz Creation Modal
    └── Stream Settings Modal
```

### Component Structure

| Component | Purpose | Location |
|-----------|---------|----------|
| `CreateCourse` | Main component orchestrator | `components/pages/CreateCourse.tsx` |
| Course Structure Sidebar | Displays hierarchical structure | Inline JSX (lines ~500-700) |
| Main Editor Area | Content editing interface | Inline JSX (lines ~800-1200) |
| Upload Modal | File/Drive/YouTube upload | Inline JSX (lines ~900-1200) |
| Quiz Modal | Quiz creation interface | Inline JSX (lines ~1300-1400) |

### Data Flow

```
User Action
  ↓
Event Handler (handleAddModule, handleDragDrop, etc.)
  ↓
State Update (setCourseData)
  ↓
Component Re-render
  ↓
UI Update (new structure displayed)
  ↓
[TODO: Database Sync] (supabase.from('courses').update())
```

**Current State**: Data flows only in-memory. Database sync is not implemented (TODO).

---

## Key Files

| File | Purpose | Key Exports |
|------|---------|-------------|
| `components/pages/CreateCourse.tsx` | Complete course creation/editing interface | `CreateCourse` (default export) |

---

## Public Interface

### Component Props

```typescript
interface CreateCourseProps {
  setCurrentView: (view: string) => void;
}
```

**Purpose**: Receives callback to navigate away from create course view.

### Type Definitions

#### ContentType
```typescript
type ContentType = 'video' | 'quiz' | 'form';
```

#### VideoSource
```typescript
type VideoSource = 'upload' | 'google_drive' | 'youtube';
```

#### VideoSegment
```typescript
interface VideoSegment {
  id: number;
  name: string;
  duration: string;           // Display format: "2:30"
  startTime: string;          // Display format: "0:00"
  endTime: string;            // Display format: "2:30"
  status: 'active' | 'processing';
  size: string;               // Display format: "24 MB"
  lastEdited: string;         // Display format: "2 hours ago"
  source: VideoSource;
  sourceUrl?: string;         // For YouTube or Google Drive
  startTimestamp?: number;    // For streaming: start time in seconds
  endTimestamp?: number;      // For streaming: end time in seconds
}
```

#### QuizQuestion
```typescript
interface QuizQuestion {
  id: number;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];          // For multiple_choice
  correctAnswer: string | number;
  required: boolean;
}
```

#### Quiz
```typescript
interface Quiz {
  id: number;
  title: string;
  questions: QuizQuestion[];
  passingScore: number;       // Percentage (0-100)
}
```

#### ContentItem
```typescript
interface ContentItem {
  id: number;
  type: ContentType;
  order: number;              // Order within lesson
  videoSegment?: VideoSegment;
  quiz?: Quiz;
  form?: any;                 // Form structure (similar to quiz)
}
```

#### Lesson
```typescript
interface Lesson {
  id: number;
  title: string;
  order: number;              // Order within module
  content: ContentItem[];     // Can have multiple content items
  duration: string;           // Calculated from video segments
}
```

#### Module
```typescript
interface Module {
  id: number;
  title: string;
  order: number;              // Order within course
  lessons: Lesson[];
  duration: string;           // Calculated from lessons
}
```

#### CourseData
```typescript
{
  title: string;
  description: string;
  lastEdited: string;         // Display format: "2 hours ago"
  status: 'draft' | 'published';
  modules: Module[];
}
```

---

## Internal Workings

### State Management

The component uses **18+ useState hooks** for state management:

#### Course Structure State
```typescript
const [courseData, setCourseData] = useState<{...}>({...});
```

#### Navigation State
```typescript
const [currentModule, setCurrentModule] = useState(0);
const [currentLesson, setCurrentLesson] = useState(0);
const [selectedContent, setSelectedContent] = useState(0);
```

#### UI State
```typescript
const [isPlaying, setIsPlaying] = useState(false);
const [showVersions, setShowVersions] = useState(false);
const [showUploadModal, setShowUploadModal] = useState(false);
const [showQuizModal, setShowQuizModal] = useState(false);
const [previewMode, setPreviewMode] = useState(false);
```

#### Drag-and-Drop State
```typescript
const [draggedItem, setDraggedItem] = useState<{
  type: 'module' | 'lesson' | 'content',
  id: number,
  moduleId?: number,
  lessonId?: number
} | null>(null);
```

#### Upload State
```typescript
const [uploadType, setUploadType] = useState<'file' | 'drive' | 'youtube'>('file');
const [uploadProgress, setUploadProgress] = useState(0);
const [driveConnected, setDriveConnected] = useState(false);
const [segmentName, setSegmentName] = useState('');
const [startTime, setStartTime] = useState('');
const [duration, setDuration] = useState('');
const [youtubeUrl, setYoutubeUrl] = useState('');
```

#### Version History State
```typescript
const [versions, setVersions] = useState([...]);
```

### How Drag-and-Drop Works

#### 1. Drag Start
```typescript
const handleDragStart = (e: React.DragEvent, type, id, moduleId?, lessonId?) => {
  setDraggedItem({ type, id, moduleId, lessonId });
  e.dataTransfer.effectAllowed = 'move';
};
```

#### 2. Drag Over
```typescript
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};
```

#### 3. Drop
```typescript
const handleDrop = (e: React.DragEvent, targetType, targetId, targetModuleId?, targetLessonId?) => {
  e.preventDefault();
  if (!draggedItem) return;
  
  // Reorder based on type
  if (draggedItem.type === 'module' && targetType === 'module') {
    // Reorder modules
  } else if (draggedItem.type === 'lesson' && targetType === 'lesson') {
    // Reorder lessons within module
  } else if (draggedItem.type === 'content' && targetType === 'content') {
    // Reorder content within lesson
  }
  
  setDraggedItem(null);
};
```

**Key Logic**:
- Finds dragged and target items by ID
- Removes dragged item from array
- Inserts at target position
- Updates all order indices
- Updates parent durations (for lessons/modules)

### How Content Addition Works

#### Adding a Video
```typescript
const handleAddContent = (type: ContentType) => {
  if (type === 'video') {
    setContentToReplace(null);
    setSegmentName('');
    setStartTime('');
    setDuration('');
    setUploadType('file');
    setShowUploadModal(true);
  }
  // ...
};
```

**Flow**:
1. User clicks "Add Video"
2. Modal opens with upload options (file/Drive/YouTube)
3. User selects source and fills details
4. On submit, creates new `ContentItem` with `VideoSegment`
5. Adds to current lesson's content array
6. Updates lesson duration

#### Adding a Quiz
```typescript
const handleAddContent = (type: ContentType) => {
  if (type === 'quiz') {
    setShowQuizModal(true);
  }
  // ...
};
```

**Flow**:
1. User clicks "Add Quiz"
2. Quiz modal opens
3. User enters title, passing score
4. Questions added separately (TODO: Implement)
5. Creates new `ContentItem` with `Quiz`
6. Adds to current lesson's content array

### How Duration Calculation Works

```typescript
const totalDuration = lesson.content
  .filter(c => c.type === 'video')
  .reduce((acc, c) => acc + parseTimeToSeconds(c.videoSegment?.duration || '0:00'), 0);
lesson.duration = formatSecondsToTime(totalDuration);
```

**Process**:
1. Filters content items to only videos
2. Sums all video segment durations (converted to seconds)
3. Formats total back to "MM:SS" format
4. Updates lesson duration
5. Module duration calculated similarly from lessons

### Time Format Conversion

```typescript
// Convert "2:30" to 150 seconds
const parseTimeToSeconds = (time: string): number => {
  const parts = time.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

// Convert 150 seconds to "2:30"
const formatSecondsToTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
```

---

## Integration Points

### Used By

| Module/Component | How it uses this |
|------------------|------------------|
| `CoursifyLMS` | Renders when `currentView === 'create'` |

### Depends On

| Dependency | Purpose | Status |
|------------|---------|--------|
| `lucide-react` | Icons (Play, Plus, Upload, etc.) | ✅ Active |
| `React.useState` | State management | ✅ Active |
| `setCurrentView` prop | Navigation callback | ✅ Active |
| Supabase Client | Database operations | ❌ TODO (Sprint 3-4) |
| Google Drive API | Drive file selection | ❌ TODO (Sprint 7-8) |
| YouTube API | YouTube video embedding | ❌ TODO (Sprint 7-8) |

---

## Key Functions

### Structure Management

#### `handleAddModule()`
**Purpose**: Creates a new module and adds it to the course
**Parameters**: None
**Returns**: void
**Side Effects**: Updates `courseData.modules`

#### `handleAddLesson(moduleId: number)`
**Purpose**: Creates a new lesson within a module
**Parameters**: `moduleId` - ID of parent module
**Returns**: void
**Side Effects**: Updates module's lessons array, sets current lesson

#### `handleAddContent(type: ContentType)`
**Purpose**: Initiates content addition (opens appropriate modal)
**Parameters**: `type` - 'video', 'quiz', or 'form'
**Returns**: void
**Side Effects**: Opens upload or quiz modal

#### `handleDeleteContent(lessonId: number, contentId: number)`
**Purpose**: Removes a content item from a lesson
**Parameters**: 
- `lessonId` - ID of parent lesson
- `contentId` - ID of content to delete
**Returns**: void
**Side Effects**: Updates lesson content, recalculates duration

### Drag-and-Drop

#### `handleDragStart(e, type, id, moduleId?, lessonId?)`
**Purpose**: Initiates drag operation
**Parameters**: Drag event and item identification
**Returns**: void
**Side Effects**: Sets `draggedItem` state

#### `handleDragOver(e)`
**Purpose**: Allows drop on target
**Parameters**: Drag event
**Returns**: void
**Side Effects**: Prevents default, sets drop effect

#### `handleDrop(e, targetType, targetId, targetModuleId?, targetLessonId?)`
**Purpose**: Handles drop and reorders items
**Parameters**: Drag event and target identification
**Returns**: void
**Side Effects**: Reorders items, updates order indices, clears draggedItem

### Upload Handling

#### `handleUpload()`
**Purpose**: Processes file upload (mock implementation)
**Parameters**: None (uses state: uploadType, segmentName, etc.)
**Returns**: void
**Side Effects**: 
- Simulates upload progress
- Creates new ContentItem with VideoSegment
- Updates courseData
- Closes modal

**Current Implementation**: Mock with setTimeout. TODO: Real upload to Supabase Storage.

### Utility Functions

#### `parseTimeToSeconds(time: string): number`
**Purpose**: Converts "MM:SS" format to seconds
**Parameters**: `time` - Time string in "MM:SS" format
**Returns**: Number of seconds
**Example**: `parseTimeToSeconds("2:30")` → `150`

#### `formatSecondsToTime(seconds: number): string`
**Purpose**: Converts seconds to "MM:SS" format
**Parameters**: `seconds` - Number of seconds
**Returns**: Time string in "MM:SS" format
**Example**: `formatSecondsToTime(150)` → `"2:30"`

### Save/Publish

#### `handleSave()`
**Purpose**: Saves course to database (TODO)
**Parameters**: None
**Returns**: void
**Current**: Updates `lastEdited` timestamp only
**TODO**: Save to Supabase (Sprint 3-4)

#### `handlePublish()`
**Purpose**: Publishes course (TODO)
**Parameters**: None
**Returns**: void
**Current**: Updates status to 'published' only
**TODO**: Publish to Supabase (Sprint 3-4)

---

## UI Structure

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header (Title, Save, Publish buttons)                   │
├──────────────┬──────────────────────────────────────────┤
│              │                                           │
│  Sidebar     │  Main Editor Area                        │
│  (Structure) │                                           │
│              │  - Video Player/Preview                  │
│  Modules     │  - Content Editor                        │
│  ├─ Lessons  │  - Version History                       │
│  └─ Content  │                                           │
│              │                                           │
└──────────────┴──────────────────────────────────────────┘
```

### Sidebar Structure

- **Module List**: All modules with drag handles
- **Lesson List**: Lessons for selected module
- **Content List**: Content items for selected lesson
- **Version History**: Toggleable panel showing course versions

### Main Editor Area

- **Video Player**: Preview/playback of selected video segment
- **Content Editor**: Form to edit selected content item
- **Add Content Buttons**: Quick actions to add video/quiz/form

### Modals

1. **Upload Modal**: Three tabs (File Upload, Google Drive, YouTube Link)
2. **Quiz Modal**: Quiz creation form
3. **Stream Settings Modal**: Video streaming timestamp configuration

---

## Current Limitations

### Not Implemented

1. **Database Integration**
   - ❌ Course saving to Supabase
   - ❌ Course publishing
   - ❌ Version history persistence
   - ❌ Real file uploads

2. **Google Drive Integration**
   - ❌ OAuth authentication
   - ❌ File picker
   - ❌ File selection from Drive

3. **YouTube Integration**
   - ❌ YouTube API integration
   - ❌ Video embedding
   - ❌ Timestamp extraction

4. **Video Processing**
   - ❌ Actual video upload
   - ❌ Video segmentation
   - ❌ Video stitching/merging
   - ❌ Streaming implementation

5. **Quiz Functionality**
   - ❌ Question creation UI
   - ❌ Quiz persistence
   - ❌ Quiz validation

6. **Form Functionality**
   - ❌ Form creation
   - ❌ Form field types
   - ❌ Form persistence

### Mock Data

- All course data is hardcoded mock data
- Upload progress is simulated
- Google Drive connection is simulated
- Version history is mock data

---

## TODO Items

### High Priority (Sprint 3-4)

- [ ] **Save to Supabase** (line 490)
  - Implement course persistence
  - Save modules, lessons, content items
  - Handle relationships and order indices

- [ ] **Publish course** (line 495)
  - Update course status to 'published'
  - Make course available to learners

- [ ] **File upload** (line 355)
  - Implement Supabase Storage upload
  - Handle upload progress
  - Store file paths in database

### Medium Priority (Sprint 5-6)

- [ ] **Video processing**
  - Video segmentation logic
  - Video stitching/merging
  - Streaming implementation

- [ ] **Quiz creation** (line 1341)
  - Complete quiz creation UI
  - Question management
  - Quiz persistence

### Lower Priority (Sprint 7-8)

- [ ] **Google Drive OAuth** (line 483)
  - OAuth flow implementation
  - Token storage
  - File picker integration

- [ ] **YouTube integration**
  - YouTube API setup
  - Video URL parsing
  - Timestamp extraction

---

## Gotchas & Warnings

### State Management Complexity

⚠️ **Warning**: 18+ useState hooks make state management complex. Consider refactoring to useReducer or a state management library for better maintainability.

### Order Index Management

⚠️ **Gotcha**: Order indices are updated manually in drag-and-drop handlers. Ensure all reordering operations update indices correctly to prevent inconsistencies.

### Duration Calculation

⚠️ **Gotcha**: Duration is calculated from video segments only. Quizzes and forms don't contribute to duration. This may need adjustment based on requirements.

### Mock Upload

⚠️ **Warning**: Upload functionality is completely mocked. Real implementation will need:
- File validation
- Progress tracking
- Error handling
- Storage path management

### Type Safety

⚠️ **Gotcha**: `form` property in `ContentItem` is typed as `any`. Should be properly typed when form structure is defined.

---

## Future Improvements

### Suggested Refactoring

1. **Extract Sub-components**
   - `CourseStructureSidebar`
   - `ContentEditor`
   - `UploadModal`
   - `QuizModal`

2. **State Management**
   - Consider `useReducer` for courseData
   - Extract upload state to custom hook
   - Extract drag-and-drop logic to custom hook

3. **Type Safety**
   - Define proper Form interface
   - Add stricter typing for all state

4. **Performance**
   - Memoize expensive calculations (duration)
   - Lazy load modals
   - Optimize re-renders

5. **Error Handling**
   - Add error boundaries
   - Validate data before saving
   - Handle upload errors gracefully

---

## Related Documentation

- **Technical Reference**: `docs/TECHNICAL_REFERENCE.md` - Type definitions
- **Codebase Map**: `docs/CODEBASE_MAP.md` - Component relationships
- **Project Context**: `docs/PROJECT_CONTEXT.md` - Overall project status
- **Clarifications**: `docs/CLARIFICATIONS.md` - Open questions

---

**Status**: Module Deep-Dive Complete  
**Last Updated**: Current Session

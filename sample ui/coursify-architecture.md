# Coursify LMS - Complete Project Architecture & Resources

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 14 (App Router) + React 18 + TypeScript               │
│  - Server Components for SEO & Performance                      │
│  - Client Components for Interactivity                          │
│  - TailwindCSS for Styling                                      │
│  - Lucide Icons                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Next.js API Routes / Server Actions                            │
│  - RESTful API endpoints                                         │
│  - Authentication middleware                                     │
│  - Rate limiting                                                 │
│  - File upload handling                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Services & Controllers                                          │
│  - Course Management                                             │
│  - User Management                                               │
│  - Video Processing                                              │
│  - Analytics Engine                                              │
│  - Notification Service                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Database: PostgreSQL (Supabase/Neon)                          │
│  ORM: Prisma                                                     │
│  Cache: Redis (Upstash)                                         │
│  File Storage: Google Drive API / S3-compatible                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Technology Stack

### **Frontend**
| Technology | Purpose | Cost | Alternative |
|------------|---------|------|-------------|
| **Next.js 14** | Framework | FREE | Remix, SvelteKit |
| **React 18** | UI Library | FREE | Vue.js, Svelte |
| **TypeScript** | Type Safety | FREE | - |
| **TailwindCSS** | Styling | FREE | - |
| **Zustand** | State Management | FREE | Redux, Jotai |
| **React Query** | Data Fetching | FREE | SWR, Apollo Client |
| **Lucide React** | Icons | FREE | Heroicons, React Icons |
| **Framer Motion** | Animations | FREE | React Spring |

### **Backend**
| Technology | Purpose | Cost | Alternative |
|------------|---------|------|-------------|
| **Next.js API Routes** | API Layer | FREE | Express.js, Fastify |
| **Prisma** | ORM | FREE | Drizzle, TypeORM |
| **PostgreSQL** | Database | FREE (Supabase/Neon) | MySQL, MongoDB |
| **Redis** | Caching | FREE (Upstash) | Memcached |
| **Zod** | Validation | FREE | Yup, Joi |

### **Authentication**
| Technology | Purpose | Cost | Alternative |
|------------|---------|------|-------------|
| **NextAuth.js** | Auth Framework | FREE | Clerk ($25/mo), Auth0 |
| **JWT** | Tokens | FREE | - |
| **bcrypt** | Password Hashing | FREE | - |
| **OAuth 2.0** | Social Login | FREE | - |

### **File Storage & Video**
| Technology | Purpose | Cost | Alternative |
|------------|---------|------|-------------|
| **Google Drive API** | External Storage | FREE (15GB) | OneDrive, Dropbox |
| **Cloudflare R2** | Video Storage | FREE (10GB) | AWS S3, Backblaze B2 |
| **FFmpeg** | Video Processing | FREE | - |
| **HLS.js** | Video Streaming | FREE | Video.js |

### **Hosting & Deployment**
| Service | Purpose | Free Tier | Paid Plans |
|---------|---------|-----------|------------|
| **Vercel** | Frontend Hosting | 100GB bandwidth | $20/mo (Pro) |
| **Supabase** | Database + Auth | 500MB DB, 1GB storage | $25/mo (Pro) |
| **Cloudflare** | CDN + R2 | 10GB storage, 100k requests | $5/mo |
| **Upstash Redis** | Caching | 10k requests/day | $0.20/100k |
| **Resend** | Email Service | 100 emails/day | $20/mo (1M emails) |

### **Monitoring & Analytics**
| Service | Purpose | Free Tier | Alternative |
|---------|---------|-----------|------------|
| **Vercel Analytics** | Web Analytics | FREE | Plausible, Umami |
| **Sentry** | Error Tracking | 5k events/mo | LogRocket, Rollbar |
| **PostHog** | Product Analytics | 1M events/mo | Mixpanel, Amplitude |

---

## 🗄️ Database Schema

### **Core Tables**

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  avatar_url VARCHAR,
  role ENUM('admin', 'instructor', 'learner'),
  department VARCHAR,
  job_title VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Courses
courses (
  id UUID PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  instructor_id UUID REFERENCES users(id),
  status ENUM('draft', 'published', 'archived'),
  category VARCHAR,
  thumbnail_url VARCHAR,
  duration_minutes INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Modules
modules (
  id UUID PRIMARY KEY,
  course_id UUID REFERENCES courses(id),
  title VARCHAR NOT NULL,
  description TEXT,
  order_index INT,
  created_at TIMESTAMP
)

-- Lessons
lessons (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES modules(id),
  title VARCHAR NOT NULL,
  content_type ENUM('video', 'text', 'quiz', 'document'),
  order_index INT,
  duration_minutes INT,
  created_at TIMESTAMP
)

-- Video Segments (CORE DIFFERENTIATOR)
video_segments (
  id UUID PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id),
  name VARCHAR NOT NULL,
  video_url VARCHAR NOT NULL,
  storage_provider VARCHAR, -- 'google_drive', 'cloudflare', 'local'
  external_id VARCHAR, -- Google Drive file ID
  start_time INT, -- seconds
  end_time INT, -- seconds
  duration INT, -- seconds
  order_index INT,
  file_size BIGINT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Video Versions (for rollback)
video_versions (
  id UUID PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id),
  version_number INT,
  segments JSONB, -- Array of segment IDs
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP
)

-- Enrollments
enrollments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  enrolled_at TIMESTAMP,
  completed_at TIMESTAMP,
  progress_percentage DECIMAL(5,2),
  last_accessed TIMESTAMP,
  UNIQUE(user_id, course_id)
)

-- Progress Tracking
lesson_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  lesson_id UUID REFERENCES lessons(id),
  completed BOOLEAN DEFAULT FALSE,
  time_spent INT, -- seconds
  last_position INT, -- video position in seconds
  completed_at TIMESTAMP,
  UNIQUE(user_id, lesson_id)
)

-- Assessments
quizzes (
  id UUID PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id),
  title VARCHAR,
  pass_percentage INT,
  max_attempts INT,
  created_at TIMESTAMP
)

quiz_questions (
  id UUID PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id),
  question_text TEXT,
  question_type ENUM('multiple_choice', 'true_false', 'short_answer'),
  options JSONB,
  correct_answer TEXT,
  points INT,
  order_index INT
)

quiz_attempts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  quiz_id UUID REFERENCES quizzes(id),
  score DECIMAL(5,2),
  answers JSONB,
  passed BOOLEAN,
  attempted_at TIMESTAMP
)

-- Certificates
certificates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  certificate_url VARCHAR,
  issued_at TIMESTAMP,
  certificate_id VARCHAR UNIQUE
)

-- Badges & Achievements
badges (
  id UUID PRIMARY KEY,
  name VARCHAR,
  description TEXT,
  icon VARCHAR,
  criteria JSONB,
  created_at TIMESTAMP
)

user_badges (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  badge_id UUID REFERENCES badges(id),
  earned_at TIMESTAMP,
  UNIQUE(user_id, badge_id)
)

-- Reports
scheduled_reports (
  id UUID PRIMARY KEY,
  name VARCHAR,
  report_type VARCHAR,
  frequency ENUM('daily', 'weekly', 'monthly', 'quarterly'),
  recipients TEXT[], -- email addresses
  config JSONB,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  is_active BOOLEAN,
  created_by UUID REFERENCES users(id)
)

-- Notifications
notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR,
  title VARCHAR,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP
)
```

---

## 🎯 Key Features Implementation

### **1. Micro-Video Management (Core Differentiator)**

**Technology Stack:**
- **FFmpeg**: Video segmentation and stitching (FREE)
- **HLS.js**: Adaptive streaming (FREE)
- **Cloudflare R2**: Video storage (FREE 10GB)
- **Google Drive API**: External storage (FREE 15GB)

**Implementation:**
```javascript
// Video segment stitching
const stitchSegments = async (segmentIds) => {
  const segments = await fetchSegments(segmentIds);
  const playlist = generateHLSPlaylist(segments);
  return playlist;
};

// Replace segment
const replaceSegment = async (lessonId, oldSegmentId, newVideo) => {
  // Upload new segment
  const newSegment = await uploadSegment(newVideo);
  
  // Create new version
  const version = await createVersion(lessonId, {
    segments: replaceInArray(oldSegmentId, newSegment.id)
  });
  
  return version;
};
```

**Cost:** FREE (using FFmpeg + Cloudflare R2)

---

### **2. Google Drive Integration**

**API:** Google Drive API v3 (FREE)
**Quota:** 1 billion queries/day (more than enough)

**Setup:**
```javascript
import { google } from 'googleapis';

const drive = google.drive({
  version: 'v3',
  auth: oAuth2Client
});

// Fetch file from Google Drive
const getFile = async (fileId) => {
  const response = await drive.files.get({
    fileId,
    alt: 'media'
  }, { responseType: 'stream' });
  
  return response.data;
};
```

**Cost:** FREE
**Alternative:** OneDrive API, Dropbox API (both FREE)

---

### **3. Video Processing**

**Option A: Server-Side Processing**
- **FFmpeg** (FREE)
- Run on serverless functions or containers
- Cost: Compute time only

**Option B: Cloud Services**
| Service | Free Tier | Cost |
|---------|-----------|------|
| **Cloudflare Stream** | No free tier | $1/1000 mins stored, $1/1000 mins watched |
| **Mux** | $1 credit | $0.005/min delivered |
| **AWS MediaConvert** | No free tier | $0.015/min |

**Recommendation:** Use FFmpeg on Vercel Edge Functions (FREE for light processing)

---

### **4. Email Service**

| Service | Free Tier | Cost | Features |
|---------|-----------|------|----------|
| **Resend** ⭐ | 100/day | $20/mo (50k emails) | Best DX, great deliverability |
| **SendGrid** | 100/day | $15/mo (40k emails) | Established, good docs |
| **Amazon SES** | 62k/mo (AWS) | $0.10/1000 | Cheapest but complex |
| **Postmark** | 100/mo | $10/mo (10k emails) | Excellent deliverability |

**Recommendation:** Resend (best developer experience)

---

### **5. Authentication**

**Option A: NextAuth.js (Recommended)**
- FREE
- Open source
- Built-in providers (Google, GitHub, etc.)
- JWT sessions
- Database sessions

**Option B: Paid Services**
| Service | Free Tier | Cost |
|---------|-----------|------|
| **Clerk** | 10k MAU | $25/mo |
| **Auth0** | 7k MAU | $35/mo |
| **Supabase Auth** | Unlimited | Included in DB plan |

**Recommendation:** NextAuth.js with Supabase (FREE)

---

### **6. File Storage**

**For Videos:**
| Service | Free Tier | Cost | Use Case |
|---------|-----------|------|----------|
| **Cloudflare R2** ⭐ | 10GB storage | $0.015/GB | Best for videos |
| **Backblaze B2** | 10GB storage | $0.005/GB | Cheaper at scale |
| **AWS S3** | 5GB (12 months) | $0.023/GB | Industry standard |
| **Google Drive API** | 15GB | FREE | External storage |

**For Documents/Images:**
| Service | Free Tier | Cost |
|---------|-----------|------|
| **Supabase Storage** | 1GB | $0.021/GB |
| **Vercel Blob** | 500MB | $0.15/GB |

**Recommendation:** 
- Videos: Cloudflare R2 (10GB free) + Google Drive API
- Documents: Supabase Storage

---

### **7. Analytics & Monitoring**

**Web Analytics:**
| Service | Free Tier | Cost | Privacy |
|---------|-----------|------|---------|
| **Vercel Analytics** ⭐ | Unlimited | FREE | Privacy-focused |
| **Plausible** | 30 days trial | $9/mo | Privacy-focused |
| **Umami** | Self-hosted | FREE | Open source |
| **Google Analytics** | Unlimited | FREE | Not privacy-focused |

**Error Tracking:**
| Service | Free Tier | Cost |
|---------|-----------|------|
| **Sentry** ⭐ | 5k events/mo | $26/mo |
| **LogRocket** | 1k sessions/mo | $99/mo |
| **Highlight.io** | 500 sessions/mo | $50/mo |

**Recommendation:** Vercel Analytics + Sentry

---

### **8. Real-Time Features**

For real-time notifications, progress updates:

| Service | Free Tier | Cost | Use Case |
|---------|-----------|------|----------|
| **Supabase Realtime** ⭐ | Included | FREE | PostgreSQL changes |
| **Pusher** | 200k messages/day | $49/mo | WebSockets |
| **Ably** | 6M messages/mo | $29/mo | Realtime messaging |
| **Socket.io** | Self-hosted | FREE | DIY solution |

**Recommendation:** Supabase Realtime (FREE)

---

### **9. PDF Generation (Certificates)**

| Library | Cost | Quality |
|---------|------|---------|
| **Puppeteer** ⭐ | FREE | Excellent |
| **jsPDF** | FREE | Good |
| **PDFKit** | FREE | Good |
| **react-pdf** | FREE | Excellent |

**Recommendation:** Puppeteer or react-pdf (both FREE)

---

## 💰 Cost Breakdown

### **FREE Tier (0-100 users)**
```
Frontend Hosting: Vercel FREE
Database: Supabase FREE (500MB)
File Storage: Cloudflare R2 FREE (10GB)
External Storage: Google Drive FREE (15GB)
Authentication: NextAuth.js + Supabase FREE
Email: Resend FREE (100/day)
Analytics: Vercel Analytics FREE
Error Tracking: Sentry FREE (5k events)
CDN: Cloudflare FREE
Cache: Upstash FREE (10k requests/day)

TOTAL: $0/month
```

### **Growth Tier (100-1000 users)**
```
Frontend Hosting: Vercel Pro $20/mo
Database: Supabase Pro $25/mo (8GB)
File Storage: Cloudflare R2 ~$5/mo (50GB)
Email: Resend $20/mo (50k emails)
Analytics: Vercel Analytics FREE
Error Tracking: Sentry $26/mo
Cache: Upstash $10/mo

TOTAL: ~$106/month
```

### **Scale Tier (1000-10000 users)**
```
Frontend Hosting: Vercel Pro $20/mo
Database: Supabase Pro $25/mo + Storage
File Storage: Cloudflare R2 ~$20/mo (150GB)
Email: Resend $80/mo (200k emails)
CDN: Cloudflare Pro $20/mo
Error Tracking: Sentry $89/mo
Cache: Upstash $40/mo

TOTAL: ~$294/month
```

---

## 🚀 Deployment Architecture

### **Hosting Options**

**Option 1: Vercel (Recommended for MVP)**
- Automatic deployments from Git
- Edge functions for API
- Built-in CDN
- FREE SSL
- Preview deployments

**Option 2: Self-Hosted (For Scale)**
```
Frontend: Vercel/Netlify
Backend: Railway/Fly.io
Database: Neon/Supabase
Cache: Upstash Redis
CDN: Cloudflare
```

### **CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run test
      - uses: vercel/deploy@v1
```

---

## 📁 Project Structure

```
coursify-lms/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── courses/
│   │   ├── learners/
│   │   ├── analytics/
│   │   ├── reports/
│   │   └── profile/
│   ├── api/                      # API Routes
│   │   ├── auth/
│   │   ├── courses/
│   │   ├── videos/
│   │   ├── users/
│   │   └── analytics/
│   └── layout.tsx
├── components/
│   ├── ui/                       # Reusable UI components
│   ├── courses/
│   ├── video/
│   ├── analytics/
│   └── layout/
├── lib/
│   ├── prisma.ts                 # Database client
│   ├── auth.ts                   # Auth config
│   ├── video.ts                  # Video processing
│   ├── storage.ts                # File storage
│   └── email.ts                  # Email service
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── types/
├── utils/
├── .env.local
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 🔧 Development Setup

### **Prerequisites**
```bash
Node.js 18+
PostgreSQL 14+
Redis (optional for local)
FFmpeg (for video processing)
Google Drive API credentials
```

### **Environment Variables**
```env
# Database
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# Google Drive
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="..."

# Storage
CLOUDFLARE_ACCOUNT_ID="..."
CLOUDFLARE_ACCESS_KEY_ID="..."
CLOUDFLARE_SECRET_ACCESS_KEY="..."

# Email
RESEND_API_KEY="..."

# Redis
UPSTASH_REDIS_URL="..."
```

### **Installation**
```bash
# Clone repository
git clone https://github.com/your-org/coursify-lms

# Install dependencies
npm install

# Setup database
npx prisma migrate dev

# Seed database
npm run seed

# Start development server
npm run dev
```

---

## 🎯 MVP Timeline (3 months)

### **Month 1: Foundation**
- Week 1-2: Setup + Authentication + Database
- Week 3-4: Course creation + Basic video upload

### **Month 2: Core Features**
- Week 5-6: Micro-video editor + Google Drive integration
- Week 7-8: Learner enrollment + Progress tracking

### **Month 3: Polish**
- Week 9-10: Analytics + Reports
- Week 11-12: Testing + Deployment

---

## 📊 Performance Targets

- Page Load: < 2 seconds
- Video Start: < 5 seconds
- API Response: < 500ms
- Database Query: < 100ms
- Uptime: 99.9%

---

## 🔒 Security Checklist

- [x] HTTPS everywhere
- [x] JWT token rotation
- [x] Rate limiting on APIs
- [x] SQL injection prevention (Prisma)
- [x] XSS protection
- [x] CSRF tokens
- [x] File upload validation
- [x] Password hashing (bcrypt)
- [x] 2FA support
- [x] Audit logging

---

## 📈 Scalability Plan

**Current: 0-1000 users**
- Single region deployment
- Shared database
- Basic caching

**Phase 2: 1000-10000 users**
- Multi-region CDN
- Database read replicas
- Advanced caching (Redis)
- Background job processing

**Phase 3: 10000+ users**
- Database sharding
- Microservices architecture
- Message queue (RabbitMQ)
- Elasticsearch for search
- Kubernetes orchestration

---

## ✅ Recommendation Summary

### **Totally FREE Stack (Production-Ready)**
```
Frontend: Next.js + React + TailwindCSS
Backend: Next.js API Routes
Database: Supabase (PostgreSQL)
Auth: NextAuth.js + Supabase
Storage: Cloudflare R2 (10GB) + Google Drive API
Email: Resend (100/day)
Hosting: Vercel
CDN: Cloudflare
Analytics: Vercel Analytics
Monitoring: Sentry (5k events)
Cache: Upstash Redis (10k requests/day)
```

**Total Cost:** $0/month for 0-100 users

This setup will handle your MVP and scale to 1000+ users before you need to upgrade!
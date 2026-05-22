# OpenContest - Feature Documentation

## Complete Feature List

### User-Facing Features

#### 1. Authentication (`/login`)
- **Terminal-style login/register forms** with `> username_` prompt aesthetic
- **Role Toggle**: Switch between Participant and Administrator accounts
- Minimalist centered layout
- Mobile: Full-screen with large submit button at bottom
- Visual status indicator (System Online)

#### 2. Contest Dashboard (`/contests`)
- Live, Upcoming, and Past contest listings
- **Desktop**: Clean table rows with hover effects
- **Mobile**: Stacked cards with status badges (Live/Finished/Upcoming)
- Join/Register buttons with color-coded statuses

#### 3. Problem View (`/problem/:contestId/:problemId`)
- **Desktop**: 40/60 split-screen (Statement | Code Editor)
- **Mobile**: Tabbed interface (Statement | Editor | Submissions)
- Problem navigation with A-F letter grid
- Markdown-styled problem statements with code blocks
- Terminal-style code editor with language selector
- Run and Submit buttons

#### 4. Standings (`/standings/:contestId`)
- **Desktop**: Dense data table with sticky headers
- **Mobile**: Expandable cards showing rank and problem results
- Color-coded verdicts (Green=AC, Red=WA, Yellow=pending)
- Rating-based username colors

#### 5. User Profile (`/profile/:username`)
- Pixel-art avatar
- Rating history chart (Recharts line graph)
- GitHub-style activity heatmap with yellow gradients
- Stats grid: Problems Solved, Global Rank, Contests Attended
- Recent submissions list

#### 6. Gym (`/gym`)
- Practice problem sets
- Difficulty badges (Easy/Medium/Hard)
- Usage statistics
- Responsive cards

---

### Admin Features

#### 7. Admin Dashboard (`/admin`)
- **Side navigation** (Desktop) / **Hamburger menu** (Mobile)
- System statistics cards
- Quick action buttons
- Recent activity feed
- High information density with organized zones

#### 8. Contest Management (`/admin/contests`)
- **Contest List**: Master table of all contests
- **Desktop**: Sortable table with Edit/Delete actions
- **Mobile**: Cards with action buttons

#### 9. Contest Creator (`/admin/contests/new`)
- **Desktop**: Single-page form with all sections visible
- **Mobile**: Multi-step wizard (3 steps)
  - Step 1: Basic Info (name, duration, start time)
  - Step 2: Scoring Rules (ICPC/Codeforces/IOI)
  - Step 3: Problem Selection
- Add/Remove problems dynamically
- Progress indicator on mobile

#### 10. Problem Bank (`/admin/problems`)
- Searchable problem repository
- Filter by name or tags
- Difficulty badges
- Usage statistics (used in X contests)
- Quick edit/delete actions

#### 11. Problem Editor (`/admin/problems/new`)
- **Desktop**: Split view (Statement Editor | Test Case Manager)
- **Mobile**: 3-step wizard
  - Step 1: Basic info (name, time limit, memory limit)
  - Step 2: Markdown statement editor
  - Step 3: Test case management
- **Features**:
  - Full markdown editor for problem statements
  - Time/Memory limit configuration
  - Drag-and-drop zone for .in/.out files
  - Manual test case editing
  - Expandable test case list

#### 12. Submission Control (`/admin/submissions`)
- **Master submission table** with sticky headers
- Columns: ID, User, Problem, Status, Time, Memory, Language, Submitted, Actions
- **Mobile**: Horizontal scroll + cards with [INSPECT] button
- **Code Inspection View**:
  - Read-only syntax-highlighted code viewer
  - System logs (judge output, stdout, stderr)
  - Text wrap toggle
  - Copy to clipboard
  - **Admin Control Panel**:
    - [RE-JUDGE] button
    - Status override dropdown (AC/WA/TLE/MLE/RE)
    - [DISQUALIFY USER] button

#### 13. Clarification Center (`/admin/clarifications`)
- **Inbox**: List of participant questions
- Status badges: Pending / Replied / Broadcast
- **Response Interface**:
  - View question details
  - Reply privately to user
  - Broadcast to all participants (announcements)
- **Mobile**: Full-screen modal for replies
- Chat-like interface with clean message bubbles

---

## Design System Adherence

### Monkeytype Aesthetic Compliance
✅ **Colors**: Strict palette (#323437, #e2b714, #d1d0c5, #646669, #879f27, #ca4754)  
✅ **Typography**: JetBrains Mono monospace only  
✅ **Borders**: 1px solid throughout  
✅ **Border Radius**: 4px everywhere  
✅ **No Shadows**: Zero box-shadows used  
✅ **No Gradients**: Flat colors only  
✅ **Terminal Aesthetic**: Input prompts with `> field_name`  
✅ **Text-based Actions**: `[RE-JUDGE]` `[OVERRIDE]` instead of icon-only buttons  
✅ **Minimalist**: Clean, distraction-free interface  

### Responsive Strategy
- **Desktop**: 1440px max-width containers, side-by-side layouts
- **Mobile**: 390px optimized, vertical stacking, wizard forms
- **Sticky Headers**: On all admin tables for long lists
- **Bottom Navigation**: Mobile icon bar for quick access
- **Touch-Friendly**: Large tap targets on mobile

---

## Technical Implementation

### Routing Structure
```
/login                          - Authentication
/                               - Participant Root
  /contests                     - Contest list
  /gym                          - Practice problems
  /problem/:id/:letter          - Problem view
  /standings/:id                - Contest standings
  /profile/:username            - User profile

/admin                          - Admin Root
  /admin/contests               - Contest list
  /admin/contests/new           - Contest creator
  /admin/problems               - Problem bank
  /admin/problems/new           - Problem editor
  /admin/submissions            - Submission control
  /admin/clarifications         - Clarification center
```

### State Management
- React Router 7 (Data Mode)
- Local component state for forms
- Mock data for demonstrations

### Key Libraries
- React Router 7
- Recharts (for profile charts)
- Lucide React (icons)
- Tailwind CSS v4

---

## Access Instructions

1. **Participant View**: Visit `/` or `/contests`
2. **Admin Panel**: Visit `/admin` or click "Login" → Select "Administrator"
3. **Authentication**: Visit `/login` to see role toggle

All pages are fully functional with mock data and demonstrate the complete feature set.

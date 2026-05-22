# OpenContest - Hybrid Contest & Problem Management System

## Complete Feature Overview

### 1. Hybrid Contest Editor with Vertical Stepper

**Route**: `/admin/contests/new`

**Features**:
- **Desktop**: Vertical stepper sidebar with 4 steps (General Info → Problems → Participants → Advanced)
- **Mobile**: Horizontal progress dots with step-by-step navigation
- **Visual Progress**: Checkmarks for completed steps, yellow highlight for active step
- **Breadcrumb Navigation**: Admin > Contests > New Contest

**Steps**:

1. **General Info**
   - Contest name with terminal prompt styling `> contest_name`
   - Duration in minutes
   - Start date/time
   - Scoring rule selection: ICPC / Codeforces / IOI
   - Contextual descriptions for each rule type

2. **Problems**
   - **Three Problem Loading Methods**:
     - `[ADD FROM BANK]` - Searchable modal to select existing problems
     - `[QUICK CREATE]` - Inline form to create placeholder problems
     - `[IMPORT ARCHIVE]` - Drag-and-drop for ZIP/TGZ packages
   - **Drag-and-Drop Reordering**: Use grip handles to change problem order (A, B, C...)
   - **Auto-Letter Assignment**: Problems automatically get letters based on order
   - **Source Tracking**: Each problem shows its origin (bank/quick/archive)

3. **Participants**
   - Public vs Private access control
   - Private: Invite list with one username per line (monospace textarea)

4. **Advanced**
   - Enable Hacking Phase checkbox (Codeforces style)
   - Allow Virtual Participation checkbox
   - Descriptive help text for each option

---

### 2. International Standard Archive Support

**Features**:
- **Drag-and-Drop Zone**: Large, touch-friendly upload area
- **Info Modal** (? icon): Explains supported formats
  - Polygon Package (.zip)
  - BAPC/DOMjudge Package (.zip/.tgz)
  - Kattis Problem Package (.zip)
- **Package Structure Display**: Shows expected folder structure in monospace
- **Auto-Parse Promise**: Archives automatically extract test cases and metadata
- **Bulk Upload**: Support for multiple archives at once

**Visual States**:
- Default: Dashed border, gray background
- Dragging: Yellow border, yellow tinted background
- Uploading: Progress bar (uses ProgressBar component)

---

### 3. Enhanced Problem Bank (Global Library)

**Route**: `/admin/problems`

**New Actions**:
- **[PREVIEW]** - Opens modal with rendered problem statement
- **[CLONE]** - Duplicates problem with new ID
- **[EDIT]** - Opens advanced editor
- **[DELETE]** - Removes problem (with confirmation)
- **Usage Tracking** - Click "X contests" to see where problem is used

**Features**:
- **Search Bar**: Filter by name or tags (e.g., #dp, #graphs)
- **Tag System**: Minimalist # prefix tags
- **Difficulty Badges**: Easy (green), Medium (yellow), Hard (red)
- **Sticky Table Headers**: For long scrolling lists
- **Mobile Cards**: Responsive grid with swipe-friendly layout

**Usage Modal**:
- Shows all contests using a specific problem
- Helps avoid duplication
- Facilitates problem reuse

---

### 4. Advanced Problem Editor (Multi-Tab Interface)

**Route**: `/admin/problems/new` or `/admin/problems/:id/edit`

**Tab Structure**:
- **Desktop**: Horizontal tabs with underline indicator
- **Mobile**: Horizontally scrollable tab menu
- **Breadcrumb**: Admin > Problem Bank > Edit Problem

**Tabs**:

#### **[Metadata]**
- Problem name
- Time limit (ms)
- Memory limit (MB)
- Difficulty dropdown (Easy/Medium/Hard)
- Tag management:
  - Display tags as `#tag` pills with × remove button
  - Add new tags with inline input + "Add" button
  - Press Enter to quickly add tags

#### **[Statement]**
- **Split View** (Desktop):
  - Left: Markdown editor (600px height, monospace)
  - Right: Live preview with rendered output
- **Mobile**: Toggle preview with eye icon, full-screen button
- **LaTeX Support**: Renders mathematical formulas inline
- **Syntax Highlighting**: Code blocks in sample I/O
- **Markdown Features**: Bold, italic, code, headings, lists

#### **[Tests]**
- **Generator Script Section**:
  - Code textarea for Python/other generator scripts
  - `[RUN GENERATOR]` button to execute
  - Useful for creating large-scale tests
- **Test Case List**:
  - Collapsible cards (click Edit icon to expand)
  - Sample Test checkbox for each test
  - Manual input/output editing in monospace textareas
  - Delete button (trash icon)
  - `[ADD TEST]` button at top
- **Test Numbering**: Auto-numbered as Test 1, Test 2, etc.

#### **[Checker/Validator]**
- **Custom Checker Editor**:
  - Full-height code textarea (500px)
  - Python/C++ checker code
  - Used when standard output comparison isn't sufficient
  - Full-screen mode for mobile (Maximize icon)

#### **[Solutions]**
- **Reference Solution Editor**:
  - Code textarea for correct solution (C++/Python/Java)
  - Used to generate expected outputs
  - Full-screen mode for mobile

---

### 5. UI/UX Enhancements (Monkeytype Style)

**Components Created**:

1. **Tooltip Component** (`/src/app/components/Tooltip.tsx`)
   - High-contrast black box with yellow text
   - Yellow border
   - Directional arrow (top/bottom/left/right)
   - Hover-activated
   - Usage: `<Tooltip content="Help text">...</Tooltip>`

2. **ProgressBar Component** (`/src/app/components/ProgressBar.tsx`)
   - Minimalist thin line
   - Three variants: default (yellow), success (green), error (red)
   - Percentage display
   - Smooth animation
   - Usage: `<ProgressBar progress={75} label="Uploading..." />`

**Visual States**:
- **Uploading**: Thin progress bar with label "Uploading archive..."
- **Parsing**: Progress bar with label "Parsing package..."
- **Success**: Green checkmark + success message
- **Error**: Red text with error details

**Animations**:
- Drag-and-drop: Opacity change on dragged element
- File drop: Background color transition
- Progress: Width transition with ease-out timing
- All animations: 300ms duration

---

### 6. Responsive Mobile Optimizations

**Contest Editor (Mobile)**:
- **Stepper**: Horizontal progress dots with step name
- **Forms**: Full-width inputs with clear labels
- **Buttons**: Stack vertically, full-width
- **Problem List**: Swipe-friendly cards

**Problem Bank (Mobile)**:
- **Table → Cards**: Transform desktop table into mobile cards
- **Actions**: Icon buttons arranged horizontally
- **Search**: Persistent at top, full-width

**Problem Editor (Mobile)**:
- **Tabs**: Horizontal scroll menu
- **Statement Editor**:
  - Toggle preview with `[Show/Hide Preview]` button
  - Full-screen mode (Maximize icon)
  - Exits full-screen with "Exit Full Screen" button at top
- **Code Editors**:
  - Full-screen mode button in top-right corner
  - Overlay takes full viewport
  - Easy exit with large button

**Archive Upload (Mobile)**:
- **Large Touch Target**: 12rem padding on drop zone
- **Visual Feedback**: Clear dragging state with background color
- **Multiple Files**: Shows count of files being uploaded

---

### 7. Drag-and-Drop Features

**Problem Reordering** (Contest Editor):
- **Library**: `react-dnd` + `react-dnd-html5-backend`
- **Grip Handle**: Visual indicator for draggable items (GripVertical icon)
- **Hover Effect**: Problems swap positions on hover
- **Visual Feedback**: 50% opacity when dragging
- **Auto-Letter Update**: Letters (A, B, C...) update after reorder
- **Mobile**: Consider implementing swipe gestures (future enhancement)

**Archive Upload**:
- **Drop Zones**: Dashed borders, full area target
- **Drag States**: Border color changes (gray → yellow)
- **Background Tint**: Yellow overlay when dragging over
- **File Types**: Filters for .zip, .tgz, .tar.gz

---

### 8. Bulk Actions & Management

**Implemented**:
- **Multi-Problem Addition**: Select multiple from bank
- **Bulk Archive Upload**: Drop 10+ files at once
- **Auto-Import**: Each archive creates a new problem entry

**Future Enhancements** (Architecture Ready):
- **Bulk Edit**: Select multiple problems to edit metadata
- **Batch Delete**: Delete multiple problems at once
- **Export Problems**: Download selected problems as archives
- **Problem Sets**: Group problems into reusable sets

---

## Technical Implementation

### Component Architecture

```
/src/app/components/
├── admin/
│   ├── HybridContestEditor.tsx      # Vertical stepper contest creator
│   ├── EnhancedProblemBank.tsx      # Global problem library
│   ├── AdvancedProblemEditor.tsx    # Multi-tab problem editor
│   └── [existing admin components]
├── Tooltip.tsx                      # Reusable tooltip
├── ProgressBar.tsx                  # Upload/parse progress indicator
└── [existing components]
```

### Key Libraries

- **react-dnd**: Drag-and-drop reordering
- **react-dnd-html5-backend**: HTML5 backend for DnD
- **react-router**: Nested routing with breadcrumbs
- **lucide-react**: Consistent iconography

### State Management

- **Local State**: useState for all form data
- **Step Progress**: Set of completed steps for stepper
- **Modal State**: Union type for active modal (bank | quick | archive | null)
- **File Upload**: Progress tracking with interval-based simulation

---

## User Workflows

### Creating a Contest with Mixed Problem Sources

1. Navigate to `/admin/contests/new`
2. Step 1: Fill in contest name, duration, start time, select rule type
3. Step 2: Add problems:
   - Add 2 from problem bank (search → select)
   - Quick create 1 new problem placeholder
   - Import 3 problems from archive packages
4. Drag-and-drop to reorder (e.g., archive problem becomes Problem A)
5. Step 3: Set access to Public or add invite list
6. Step 4: Enable hacking phase
7. Click "Create Contest"

### Creating a Complex Problem

1. Navigate to `/admin/problems/new`
2. **[Metadata]**: Set name, limits, difficulty, add tags (#dp #arrays)
3. **[Statement]**: Write markdown with LaTeX formulas, see live preview
4. **[Tests]**:
   - Add 2 sample tests manually
   - Write Python generator script
   - Run generator to create 10 hidden tests
5. **[Checker]**: Add custom checker for special output validation
6. **[Solutions]**: Paste reference C++ solution
7. Click "Save Problem"

---

## Accessibility & UX

- **Keyboard Navigation**: Tab through all form fields
- **Enter Key**: Submit inline forms (tag add, quick problem)
- **Focus States**: Yellow border on focus (matches theme)
- **Tooltips**: Contextual help without cluttering UI
- **Progress Feedback**: Visual indicators for all async operations
- **Error Handling**: Red text for validation errors
- **Success States**: Green checkmarks for completed steps

---

## Color Coding Summary

| Element | Color | Hex Code | Usage |
|---------|-------|----------|-------|
| Primary Accent | Yellow | #e2b714 | Active states, buttons, highlights |
| Success | Green | #879f27 | Completed steps, AC verdicts |
| Error | Red | #ca4754 | Delete buttons, errors |
| Text Primary | Off-white | #d1d0c5 | Main content |
| Text Secondary | Gray | #646669 | Subtitles, placeholders |
| Background | Dark Gray | #323437 | Main background |
| Code Background | Darker Gray | #2c2e31 | Code editors, cards |

---

## Future Roadmap

1. **Real Archive Parsing**: Implement ZIP extraction and problem.yaml parsing
2. **Generator Execution**: Server-side script runner for test generation
3. **Problem Preview**: Full-featured problem viewer with sample tests
4. **Bulk Operations**: Multi-select for batch edits
5. **Problem Versioning**: Track changes to problems over time
6. **Collaborative Editing**: Real-time co-editing for teams
7. **Template Library**: Pre-built problem templates (DP, graphs, etc.)
8. **Import from External**: Fetch problems from Codeforces/AtCoder APIs

---

## Monkeytype Aesthetic Compliance Checklist

✅ **Terminal Prompts**: `> field_name` for all inputs  
✅ **Monospace Fonts**: JetBrains Mono throughout  
✅ **Flat Design**: No gradients, no shadows  
✅ **1px Borders**: Consistent stroke width  
✅ **4px Border Radius**: All rounded corners  
✅ **Text-based Actions**: `[ACTION]` format for buttons  
✅ **High Contrast**: Yellow on dark backgrounds  
✅ **Minimalist Icons**: Lucide React, used sparingly  
✅ **Focus on Content**: Distraction-free interfaces  
✅ **Clean Animations**: Subtle, purposeful transitions  

---

## Performance Considerations

- **Lazy Loading**: Modals only render when open
- **Debounced Search**: Search bar waits 300ms before filtering
- **Virtual Scrolling**: (Future) For 1000+ problems in bank
- **Code Splitting**: Route-based chunking via React Router
- **Memoization**: Problem list filtering with useMemo (future optimization)

---

This hybrid system provides professional-grade contest management while maintaining OpenContest's signature terminal aesthetic and responsive design philosophy.

# Scrivener Import Feature - Implementation Plan

**Version:** 2.0  
**Date:** December 8, 2025  
**Status:** Planning Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Output Structure & Hierarchy](#output-structure--hierarchy)
3. [Scrivener Format Understanding](#scrivener-format-understanding)
4. [User Flow](#user-flow)
5. [Architecture](#architecture)
6. [Implementation Details](#implementation-details)
7. [Logging & Progress Tracking](#logging--progress-tracking)
8. [File Structure](#file-structure)
9. [Dependencies](#dependencies)
10. [Testing Strategy](#testing-strategy)
11. [Documentation](#documentation)

---

## Overview

Implement a comprehensive Scrivener (.scriv) import pipeline that allows users to:
- Upload a ZIP file containing a Scrivener project
- Extract and parse the .scriv structure (works on both Mac and Windows formats)
- **Automatically create a ChapterWise Project** with the same name as the .scriv package
- Generate a **hierarchical, zoomable codex structure** using include directives
- Track progress with detailed console logging (similar to PDF chunking)

### Key Features

- **Automatic Project Creation**: Creates a ChapterWise Project (user can rename later)
- **Hierarchical Structure**: Each level of the Scrivener binder gets its own codex file
- **Zoom In/Out**: View entire project or drill down into any section
- **Include Directives**: Uses Codex V1.2 include system for modular organization
- **Index File**: Creates `.index.codex.yaml` for top-level navigation
- **Cross-platform**: Handles both macOS package format and Windows folder format
- **Metadata preservation**: Maps Scrivener labels, status, keywords, synopsis to Codex
- **Type preservation**: Maintains document types (Chapter, Folder, Section, etc.)
- **Progress tracking**: Real-time console logging showing extraction, parsing, and conversion steps
- **Error handling**: Graceful degradation with detailed error reporting

---

## Output Structure & Hierarchy

### Core Concept: Zoomable Codex Hierarchy

The import creates a **fractal codex structure** where you can view the entire project at once OR zoom into any specific section.

### Project Structure

```
MyNovel/                                      # ChapterWise Project
├── .index.codex.yaml                         # 📚 Master index (view entire project)
├── Manuscript/
│   ├── Manuscript.codex.yaml                 # 📖 Full manuscript view
│   ├── Part-01-The-Beginning/
│   │   ├── Part-01-The-Beginning.codex.yaml # 📑 Part 1 view
│   │   ├── Chapter-01.codex.yaml            # 📄 Chapter 1 (standalone)
│   │   ├── Chapter-02.codex.yaml            # 📄 Chapter 2 (standalone)
│   │   └── Chapter-03.codex.yaml            # 📄 Chapter 3 (standalone)
│   └── Part-02-The-Journey/
│       ├── Part-02-The-Journey.codex.yaml   # 📑 Part 2 view
│       ├── Chapter-04.codex.yaml            # 📄 Chapter 4 (standalone)
│       └── Chapter-05.codex.yaml            # 📄 Chapter 5 (standalone)
├── Research/
│   ├── Research.codex.yaml                   # 📚 All research view
│   ├── Characters.codex.yaml                 # 👥 All characters
│   ├── Locations.codex.yaml                  # 🗺️ All locations
│   └── Timeline.codex.yaml                   # 📅 Timeline
└── Notes/
    ├── Notes.codex.yaml                      # 📝 All notes view
    ├── Ideas.codex.yaml                      # 💡 Ideas
    └── Plot-Threads.codex.yaml               # 🧵 Plot threads
```

### Zoom Levels Explained

**Level 1: Master View** (`.index.codex.yaml`)
- Shows ALL top-level binders (Manuscript, Research, Notes)
- Uses include directives to pull in each section
- Perfect for seeing the entire project structure

**Level 2: Section View** (`Manuscript/Manuscript.codex.yaml`)
- Shows all parts/chapters within Manuscript
- Uses include directives for each part
- View the entire manuscript as one document

**Level 3: Part View** (`Part-01/Part-01-The-Beginning.codex.yaml`)
- Shows all chapters within Part 1
- Uses include directives for each chapter
- Read Part 1 as a continuous flow

**Level 4: Chapter View** (`Chapter-01.codex.yaml`)
- Standalone chapter file
- Contains the actual content (RTF converted to Markdown/HTML)
- Can be viewed independently or included in parent

### Example: `.index.codex.yaml`

```yaml
metadata:
  formatVersion: "1.2"
  created: "2025-12-08T00:00:00Z"
  author: "John Smith"
  tags:
    - novel
    - scrivener-import

id: "mynovel-root"
type: project
name: "My Novel"
summary: "A thrilling adventure across time and space"

children:
  # 🔗 Include entire Manuscript section
  - include: "Manuscript/Manuscript.codex.yaml"
  
  # 🔗 Include entire Research section
  - include: "Research/Research.codex.yaml"
  
  # 🔗 Include entire Notes section
  - include: "Notes/Notes.codex.yaml"
```

### Example: `Manuscript/Manuscript.codex.yaml`

```yaml
metadata:
  formatVersion: "1.2"

id: "manuscript-section"
type: folder
name: "Manuscript"
scrivenerType: "DraftFolder"

children:
  # 🔗 Include Part 1 (which includes its chapters)
  - include: "Part-01-The-Beginning/Part-01-The-Beginning.codex.yaml"
  
  # 🔗 Include Part 2 (which includes its chapters)
  - include: "Part-02-The-Journey/Part-02-The-Journey.codex.yaml"
```

### Example: `Part-01/Part-01-The-Beginning.codex.yaml`

```yaml
metadata:
  formatVersion: "1.2"

id: "part-01"
type: part
name: "Part 01: The Beginning"
scrivenerType: "Folder"

attributes:
  - key: "label"
    value: "Part"
  - key: "status"
    value: "Second Draft"

children:
  # 🔗 Include Chapter 1 (standalone file)
  - include: "Chapter-01.codex.yaml"
  
  # 🔗 Include Chapter 2 (standalone file)
  - include: "Chapter-02.codex.yaml"
  
  # 🔗 Include Chapter 3 (standalone file)
  - include: "Chapter-03.codex.yaml"
```

### Example: `Chapter-01.codex.yaml` (Leaf Node)

```yaml
metadata:
  formatVersion: "1.2"

id: "ch-01-uuid"
type: chapter
name: "Chapter 1: The Awakening"
scrivenerType: "Text"

attributes:
  - key: "label"
    value: "Chapter"
  - key: "status"
    value: "Second Draft"
  - key: "keywords"
    value: "action, opening, introduction"
  - key: "synopsis"
    value: "Hero wakes up to discover their powers"
  - key: "word_count"
    value: "3,245"

# ✨ ACTUAL CONTENT HERE (converted from RTF)
body: |
  The morning sun pierced through the dusty window...
  
  [Full chapter content converted from Scrivener RTF]

content:
  - type: scene
    name: "Opening Scene"
    body: |
      Character wakes up in their apartment...
```

### User Navigation Flow

1. **View Entire Project**: Open `.index.codex.yaml` → See all sections at once
2. **Zoom into Manuscript**: Click Manuscript → See all parts/chapters
3. **Zoom into Part 1**: Click Part 1 → See chapters 1-3
4. **Read Chapter 1**: Click Chapter 1 → Read standalone chapter
5. **Zoom Back Out**: Navigate back up to any parent level

### Benefits of This Structure

✅ **Flexible viewing**: Read entire manuscript OR individual chapters  
✅ **Modular editing**: Edit any file independently  
✅ **Git-friendly**: Each file is separate, great for version control  
✅ **Include directives**: Automatic composition at view time  
✅ **Preserves hierarchy**: Maintains Scrivener's binder structure  
✅ **Easy conversion to Git**: Can convert project to Git repo later  
✅ **Scalable**: Works for small projects (5 chapters) or large (500 scenes)

---

## Scrivener Format Understanding

### Cross-Platform Structure

**macOS:**
- `.scriv` appears as a **package file** (folder displayed as single file by Finder)
- Actually a directory bundle with special metadata
- Right-click → "Show Package Contents" to view internal structure

**Windows:**
- `.scriv` appears as a **standard folder**
- Same internal structure as macOS version
- Directly accessible without special treatment

**Both contain the same structure:**
```
ProjectName.scriv/
├── ProjectName.scrivx          # XML index file (main structure)
├── Files/
│   ├── Data/                   # RTF content files (named by UUID)
│   │   ├── [UUID-1].rtf
│   │   ├── [UUID-2].rtf
│   │   └── ...
│   ├── Docs/                   # Embedded images, PDFs, media
│   └── search.indexes          # Search index (ignore)
├── Settings/
│   ├── ui.plist               # UI settings
│   └── ...                    # Other settings
├── QuickLook/
│   └── Preview.html           # Quick Look preview (macOS)
└── snapshots.indexes          # Snapshot index
```

### .scrivx XML Structure

The `project.scrivx` file is the heart of the Scrivener project:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Identifier="..." Version="2.0" Creator="...">
    <Binder>
        <BinderItem UUID="root-uuid" Type="DraftFolder" Created="..." Modified="...">
            <Title>Manuscript</Title>
            <MetaData>
                <IncludeInCompile>Yes</IncludeInCompile>
            </MetaData>
            <Children>
                <BinderItem UUID="chapter-1-uuid" Type="Text" Created="..." Modified="...">
                    <Title>Chapter 1: The Beginning</Title>
                    <MetaData>
                        <IncludeInCompile>Yes</IncludeInCompile>
                        <Status>First Draft</Status>
                        <Label>Chapter</Label>
                        <Keywords>action, opening</Keywords>
                        <Synopsis>The hero begins their journey...</Synopsis>
                    </MetaData>
                    <Children>
                        <BinderItem UUID="scene-1-uuid" Type="Text">
                            <Title>Scene 1: Morning</Title>
                            <!-- Nested scene -->
                        </BinderItem>
                    </Children>
                </BinderItem>
            </Children>
        </BinderItem>
    </Binder>
    <LabelSettings>
        <Labels>
            <Label>Chapter</Label>
            <Label>Scene</Label>
            <!-- Color coding for organization -->
        </Labels>
    </LabelSettings>
    <StatusSettings>
        <Statuses>
            <Status>To Do</Status>
            <Status>First Draft</Status>
            <Status>Final Draft</Status>
        </Statuses>
    </StatusSettings>
</ScrivenerProject>
```

### Key XML Elements

- **`<Binder>`**: Root container for entire project structure
- **`<BinderItem>`**: Each document or folder in the project
  - `UUID`: Unique identifier linking to content file
  - `Type`: Document type (see mapping below)
  - `Created` / `Modified`: Timestamps
- **`<Title>`**: Document name as shown in Scrivener
- **`<MetaData>`**: Rich metadata about the document
  - `<IncludeInCompile>`: Whether document appears in compile
  - `<Status>`: Workflow status (To Do, Draft, Final, etc.)
  - `<Label>`: Category label (Chapter, Scene, Character, etc.)
  - `<Keywords>`: Comma-separated tags
  - `<Synopsis>`: Brief summary/description
- **`<Children>`**: Nested documents (recursive structure)

### Scrivener Type to Codex Type Mapping

```python
SCRIVENER_TYPE_MAP = {
    # Main content types
    'Text': 'chapter',              # Regular text document
    'Folder': 'section',            # Organizational folder
    
    # Special containers
    'DraftFolder': 'book',          # Main manuscript container
    'ResearchFolder': 'research',   # Research materials container
    'TrashFolder': None,            # Exclude from import
    
    # Other types
    'Template': 'template',         # Template documents
    'WebPage': 'reference',         # Web page references
    'PDF': 'document',              # PDF documents
    'Image': 'image',               # Image files
    'Video': 'video',               # Video files
    'Audio': 'audio',               # Audio files
}
```

### Content File Mapping

Content is stored in RTF files named by UUID:
- `UUID` in .scrivx → `Files/Data/{UUID}.rtf`
- Example: `921B4A08-54C0-4B69-94FD-428F56FDAB89` → `Files/Data/921B4A08-54C0-4B69-94FD-428F56FDAB89.rtf`

---

## User Flow

### 1. Upload Phase

```
User uploads ZIP file containing Scrivener project
    ↓
[UPLOAD LOG] "📦 Receiving ZIP file: MyNovel.scriv.zip (15.3 MB)"
    ↓
Save to temporary upload directory
    ↓
[UPLOAD LOG] "💾 Saved to: data/uploads/temp/manuscript-456/"
    ↓
Create manuscript record with status='uploaded'
```

### 2. Detection & Extraction Phase

```
Detect .scriv in ZIP
    ↓
[EXTRACT LOG] "🔍 Detecting Scrivener project in ZIP..."
    ↓
[EXTRACT LOG] "✅ Found: MyNovel.scriv (Mac package format)"
    ↓
Extract ZIP contents to temporary directory
    ↓
[EXTRACT LOG] "📂 Extracting 247 files..."
[EXTRACT LOG] "   Progress: [=========>        ] 45% (112/247)"
[EXTRACT LOG] "   Progress: [==================] 100% (247/247)"
    ↓
[EXTRACT LOG] "✅ Extraction complete"
```

### 3. Validation & Parsing Phase

```
Locate project.scrivx
    ↓
[PARSE LOG] "🔍 Locating project.scrivx..."
[PARSE LOG] "✅ Found: MyNovel.scriv/MyNovel.scrivx"
    ↓
Extract project name and metadata
    ↓
[PARSE LOG] "📖 Reading project metadata..."
[PARSE LOG] "   Project name: 'My Novel'"
[PARSE LOG] "   Scrivener version: 3.0"
[PARSE LOG] "   Created: 2023-05-15"
    ↓
Validate Scrivener structure
    ↓
[PARSE LOG] "🔐 Validating Scrivener project structure..."
[PARSE LOG] "   ✓ Files/Data/ directory exists"
[PARSE LOG] "   ✓ Settings/ directory exists"
[PARSE LOG] "   ✓ .scrivx file is valid XML"
    ↓
Parse .scrivx XML and build binder hierarchy
    ↓
[PARSE LOG] "📖 Parsing binder hierarchy..."
[PARSE LOG] "   Found: 3 top-level sections"
[PARSE LOG] "     ↳ Manuscript (2 parts, 15 chapters, 43 scenes)"
[PARSE LOG] "     ↳ Research (12 documents)"
[PARSE LOG] "     ↳ Notes (8 documents)"
[PARSE LOG] "   Total documents: 80"
```

### 4. Project Creation Phase ⭐ NEW

```
Create ChapterWise Project automatically
    ↓
[PROJECT LOG] "🏗️ Creating ChapterWise Project..."
[PROJECT LOG] "   Name: 'My Novel' (from Scrivener)"
[PROJECT LOG] "   Type: standard (can convert to Git later)"
[PROJECT LOG] "   Owner: user-123"
    ↓
Generate project directory structure
    ↓
[PROJECT LOG] "📁 Creating project directory..."
[PROJECT LOG] "   Location: data/projects/user-123/project-789/"
[PROJECT LOG] "   ✓ Created: Manuscript/"
[PROJECT LOG] "   ✓ Created: Research/"
[PROJECT LOG] "   ✓ Created: Notes/"
    ↓
Link manuscript to project
    ↓
[PROJECT LOG] "🔗 Linking manuscript to project..."
[PROJECT LOG] "   ✓ Project ID: project-789"
[PROJECT LOG] "   ✓ Project URL: /username/my-novel"
```

### 5. Hierarchical Conversion Phase ⭐ UPDATED

```
Begin hierarchical conversion with include directives
    ↓
[CONVERT LOG] "🔄 Starting Scrivener → Codex conversion"
[CONVERT LOG] "   Output: Hierarchical YAML with includes"
[CONVERT LOG] "   Content: RTF → Markdown"
[CONVERT LOG] "   Project: My Novel (project-789)"
    ↓
Process binder hierarchy (bottom-up)
    ↓
[CONVERT LOG] "📄 Processing leaf documents (actual content)..."
[CONVERT LOG] "   [1/80] Chapter 1: The Beginning"
[CONVERT LOG] "      ↳ Reading RTF: 921B4A08.rtf (3,245 words)"
[CONVERT LOG] "      ↳ Converting RTF to Markdown..."
[CONVERT LOG] "      ↳ Mapping metadata (status: Second Draft, label: Chapter)"
[CONVERT LOG] "      ✓ Created: Manuscript/Part-01/Chapter-01.codex.yaml"
    ↓
[CONVERT LOG] "   [2/80] Chapter 2: The Journey Begins"
[CONVERT LOG] "      ↳ Reading RTF: A33F2B19.rtf (2,891 words)"
[CONVERT LOG] "      ↳ Converting RTF to Markdown..."
[CONVERT LOG] "      ✓ Created: Manuscript/Part-01/Chapter-02.codex.yaml"
    ↓
[CONVERT LOG] "   Progress: [=========>        ] 45% (36/80)"
    ↓
Build folder-level codex files (middle-up)
    ↓
[CONVERT LOG] "📁 Building folder codex files..."
[CONVERT LOG] "   Part 01: The Beginning (5 chapters)"
[CONVERT LOG] "      ✓ Created: Manuscript/Part-01/Part-01-The-Beginning.codex.yaml"
[CONVERT LOG] "      ✓ Added 5 include directives"
    ↓
[CONVERT LOG] "   Part 02: The Journey (10 chapters)"
[CONVERT LOG] "      ✓ Created: Manuscript/Part-02/Part-02-The-Journey.codex.yaml"
[CONVERT LOG] "      ✓ Added 10 include directives"
    ↓
Build section-level codex files (top-level)
    ↓
[CONVERT LOG] "📚 Building section codex files..."
[CONVERT LOG] "   Manuscript section (2 parts, 15 chapters)"
[CONVERT LOG] "      ✓ Created: Manuscript/Manuscript.codex.yaml"
[CONVERT LOG] "      ✓ Added 2 include directives (parts)"
    ↓
[CONVERT LOG] "   Research section (12 documents)"
[CONVERT LOG] "      ✓ Created: Research/Research.codex.yaml"
[CONVERT LOG] "      ✓ Added 12 include directives"
    ↓
[CONVERT LOG] "   Notes section (8 documents)"
[CONVERT LOG] "      ✓ Created: Notes/Notes.codex.yaml"
[CONVERT LOG] "      ✓ Added 8 include directives"
    ↓
Build master index file
    ↓
[CONVERT LOG] "📚 Building master .index.codex.yaml..."
[CONVERT LOG] "   ✓ Added 3 top-level includes (Manuscript, Research, Notes)"
[CONVERT LOG] "   ✓ Created: .index.codex.yaml"
    ↓
[CONVERT LOG] "✅ Hierarchical conversion complete!"
[CONVERT LOG] "   Generated 80 content files"
[CONVERT LOG] "   Generated 6 aggregation files"
[CONVERT LOG] "   Generated 1 index file"
[CONVERT LOG] "   Total: 87 files, 2.4 MB"
[CONVERT LOG] "   Duration: 4.7 seconds"
```

### 6. Completion Phase

```
Update project and manuscript status
    ↓
[COMPLETE LOG] "✨ Import complete - Project ready!"
[COMPLETE LOG] "   Project: My Novel"
[COMPLETE LOG] "   Files: 87 codex files"
[COMPLETE LOG] "   Structure: Zoomable hierarchy"
    ↓
Generate navigation summary
    ↓
[COMPLETE LOG] "🎯 Navigation options:"
[COMPLETE LOG] "   📚 View entire project: .index.codex.yaml"
[COMPLETE LOG] "   📖 View manuscript: Manuscript/Manuscript.codex.yaml"
[COMPLETE LOG] "   📑 View parts: Part-01-The-Beginning.codex.yaml"
[COMPLETE LOG] "   📄 View chapters: Individual chapter files"
    ↓
Redirect to project view
    ↓
[COMPLETE LOG] "🚀 Redirecting to: /username/my-novel"
```

### 7. User Navigation (After Import)

```
User views project at /username/my-novel
    ↓
See project dashboard with:
  - Overview of all sections
  - File tree browser
  - Quick links to .index.codex.yaml
    ↓
Click "View Full Project"
    ↓
Opens .index.codex.yaml (master view)
  - Shows all sections: Manuscript, Research, Notes
  - Include directives resolve automatically
  - See entire project structure at once
    ↓
Click "Manuscript" section
    ↓
Zoom into Manuscript.codex.yaml
  - Shows all parts (Part 01, Part 02)
  - Includes resolve to show part titles/summaries
    ↓
Click "Part 01"
    ↓
Zoom into Part-01-The-Beginning.codex.yaml
  - Shows chapters 1-5
  - Includes resolve to show chapter titles
    ↓
Click "Chapter 1"
    ↓
Read standalone Chapter-01.codex.yaml
  - Full chapter content
  - Can be viewed/edited independently
    ↓
Navigate back (breadcrumbs)
    ↓
Zoom back out to any level
```

---

## Architecture

### Component Diagram (Updated for Project-Based Output)

```
┌─────────────────┐
│  Upload Route   │
│  (uploads.py)   │
└────────┬────────┘
         │ ZIP file
         ↓
┌─────────────────────────┐
│ ScrivenerExtractor      │
│ - extract_from_zip()    │
│ - find_scrivx()         │
│ - validate_structure()  │
│ - get_project_name()    │ ⭐ NEW
└────────┬────────────────┘
         │ .scriv path + name
         ↓
┌─────────────────────────┐
│ ScrivenerParser         │
│ - parse_scrivx()        │
│ - build_binder_tree()   │
│ - extract_metadata()    │
│ - get_hierarchy()       │ ⭐ NEW
└────────┬────────────────┘
         │ BinderItem tree
         ↓
┌─────────────────────────┐
│ ProjectService          │ ⭐ NEW
│ - create_project()      │
│ - set_metadata()        │
│ - link_manuscript()     │
└────────┬────────────────┘
         │ ChapterWise Project
         ↓
┌─────────────────────────┐
│ ScrivenerToCodex        │ ⭐ UPDATED
│ - build_hierarchy()     │   Bottom-up tree building
│ - create_leaf_codex()   │   Chapter/scene files
│ - create_folder_codex() │   Part/section aggregators
│ - create_section_codex()│   Top-level sections
│ - create_index_codex()  │   Master .index.codex.yaml
│ - add_include()         │   Generate include directives
└────────┬────────────────┘
         │ Hierarchical structure
         ↓
┌─────────────────────────┐
│ ScrivenerContentConverter│
│ - convert_rtf_to_md()   │
│ - preserve_formatting() │
│ - extract_inline_notes()│
└────────┬────────────────┘
         │ Converted content
         ↓
┌─────────────────────────┐
│ ConvertSCRIVManuscript  │
│ - Orchestrate process   │
│ - Create project        │
│ - Build hierarchy       │
│ - Write files           │
│ - Log progress          │
│ - Handle errors         │
└────────┬────────────────┘
         │ Project output
         ↓
┌─────────────────────────┐
│ Project View Route      │ ⭐ NEW
│ - Display file tree     │
│ - Render codex files    │
│ - Breadcrumb navigation │
│ - "Convert to Git" btn  │
└─────────────────────────┘
```

### Data Flow (Hierarchical Building)

```
Scrivener Binder Tree:
├── Manuscript (DraftFolder)
│   ├── Part 01 (Folder)
│   │   ├── Chapter 1 (Text) ← RTF content
│   │   └── Chapter 2 (Text) ← RTF content
│   └── Part 02 (Folder)
│       └── Chapter 3 (Text) ← RTF content
├── Research (Folder)
│   └── Characters (Folder)
│       └── Hero (Text) ← RTF content
└── Notes (Folder)
    └── Ideas (Text) ← RTF content

        ↓ CONVERT (Bottom-up)

ChapterWise Project Structure:
/MyNovel/
├── .index.codex.yaml              ← Master (includes 3 sections)
├── Manuscript/
│   ├── Manuscript.codex.yaml      ← Section (includes 2 parts)
│   ├── Part-01/
│   │   ├── Part-01.codex.yaml    ← Folder (includes 2 chapters)
│   │   ├── Chapter-01.codex.yaml ← Leaf (actual content)
│   │   └── Chapter-02.codex.yaml ← Leaf (actual content)
│   └── Part-02/
│       ├── Part-02.codex.yaml    ← Folder (includes 1 chapter)
│       └── Chapter-03.codex.yaml ← Leaf (actual content)
├── Research/
│   ├── Research.codex.yaml        ← Section (includes 1 folder)
│   ├── Characters/
│   │   ├── Characters.codex.yaml ← Folder (includes 1 doc)
│   │   └── Hero.codex.yaml       ← Leaf (actual content)
└── Notes/
    ├── Notes.codex.yaml           ← Section (includes 1 doc)
    └── Ideas.codex.yaml           ← Leaf (actual content)
```

### Building Strategy

**Phase 1: Leaf Nodes (Bottom)**
- Convert RTF to Markdown
- Create standalone codex files
- Store in folder hierarchy

**Phase 2: Folder Nodes (Middle)**
- Create aggregator codex files
- Add include directives for children
- Preserve folder metadata

**Phase 3: Section Nodes (Top)**
- Create section codex files
- Add include directives for top-level folders
- Map Scrivener section types

**Phase 4: Index File (Root)**
- Create `.index.codex.yaml`
- Add include directives for all sections
- Project-level metadata

---

## Implementation Details

### 1. ScrivenerExtractor Service

**File:** `app/services/scrivener_extractor.py`

```python
"""
Scrivener Extractor Service

Extracts .scriv projects from ZIP files and validates structure.
Handles both macOS (package) and Windows (folder) formats.
"""

import os
import zipfile
import logging
from typing import Optional, Tuple, List
from pathlib import Path

logger = logging.getLogger(__name__)

class ScrivenerExtractor:
    """Extract and validate Scrivener projects from ZIP files."""
    
    def __init__(self, manuscript_id: str):
        """
        Initialize extractor with manuscript ID for logging.
        
        Args:
            manuscript_id: Manuscript UUID for progress tracking
        """
        self.manuscript_id = manuscript_id
        self.logger = logging.getLogger(f"{__name__}.{manuscript_id}")
    
    def extract_from_zip(self, zip_path: str, extract_to: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Extract .scriv project from ZIP file.
        
        Logs progress to manuscript logger for UI tracking.
        
        Args:
            zip_path: Path to ZIP file
            extract_to: Directory to extract to
            
        Returns:
            Tuple of (success, scriv_path, error_message)
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        try:
            # Log start
            ManuscriptLogger.log(self.manuscript_id, "info", "🔍 Detecting Scrivener project in ZIP...")
            
            # Open ZIP and inspect contents
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                file_list = zip_ref.namelist()
                total_files = len(file_list)
                
                # Find .scriv directory
                scriv_path = self._find_scriv_in_zip(file_list)
                
                if not scriv_path:
                    error = "No .scriv project found in ZIP file"
                    ManuscriptLogger.log(self.manuscript_id, "error", f"❌ {error}")
                    return False, None, error
                
                # Detect format
                format_type = "Mac package" if self._is_mac_format(file_list, scriv_path) else "Windows folder"
                ManuscriptLogger.log(
                    self.manuscript_id, 
                    "info", 
                    f"✅ Found: {scriv_path} ({format_type} format)"
                )
                
                # Extract with progress logging
                ManuscriptLogger.log(
                    self.manuscript_id,
                    "info",
                    f"📂 Extracting {total_files} files..."
                )
                
                extracted_count = 0
                for i, member in enumerate(file_list):
                    zip_ref.extract(member, extract_to)
                    extracted_count += 1
                    
                    # Log progress every 10%
                    if extracted_count % max(1, total_files // 10) == 0:
                        progress = int((extracted_count / total_files) * 100)
                        bar = self._create_progress_bar(progress)
                        ManuscriptLogger.log(
                            self.manuscript_id,
                            "info",
                            f"   Progress: {bar} {progress}% ({extracted_count}/{total_files})"
                        )
                
                ManuscriptLogger.log(self.manuscript_id, "info", "✅ Extraction complete")
                
                # Return full path to .scriv directory
                scriv_full_path = os.path.join(extract_to, scriv_path)
                return True, scriv_full_path, None
                
        except zipfile.BadZipFile as e:
            error = f"Invalid ZIP file: {str(e)}"
            ManuscriptLogger.log(self.manuscript_id, "error", f"❌ {error}")
            return False, None, error
        except Exception as e:
            error = f"Extraction failed: {str(e)}"
            ManuscriptLogger.log(self.manuscript_id, "error", f"❌ {error}")
            self.logger.exception("Extraction error")
            return False, None, error
    
    def find_scrivx_file(self, scriv_dir: str) -> Optional[str]:
        """
        Locate the .scrivx project file within .scriv directory.
        
        Args:
            scriv_dir: Path to .scriv directory
            
        Returns:
            Path to .scrivx file or None if not found
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        ManuscriptLogger.log(self.manuscript_id, "info", "🔍 Locating project.scrivx...")
        
        # Look for .scrivx file
        for filename in os.listdir(scriv_dir):
            if filename.endswith('.scrivx'):
                scrivx_path = os.path.join(scriv_dir, filename)
                ManuscriptLogger.log(
                    self.manuscript_id,
                    "info",
                    f"✅ Found: {os.path.basename(scriv_dir)}/{filename}"
                )
                return scrivx_path
        
        ManuscriptLogger.log(self.manuscript_id, "error", "❌ No .scrivx file found")
        return None
    
    def validate_structure(self, scriv_dir: str) -> Tuple[bool, List[str]]:
        """
        Validate that .scriv directory has required structure.
        
        Args:
            scriv_dir: Path to .scriv directory
            
        Returns:
            Tuple of (is_valid, list_of_missing_items)
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        ManuscriptLogger.log(self.manuscript_id, "info", "🔐 Validating Scrivener project structure...")
        
        required_items = {
            'Files/Data': 'directory',
            'Settings': 'directory',
            '*.scrivx': 'file'
        }
        
        missing = []
        
        # Check Files/Data
        files_data = os.path.join(scriv_dir, 'Files', 'Data')
        if os.path.isdir(files_data):
            ManuscriptLogger.log(self.manuscript_id, "info", "   ✓ Files/Data/ directory exists")
        else:
            ManuscriptLogger.log(self.manuscript_id, "warning", "   ✗ Files/Data/ directory missing")
            missing.append('Files/Data')
        
        # Check Settings
        settings = os.path.join(scriv_dir, 'Settings')
        if os.path.isdir(settings):
            ManuscriptLogger.log(self.manuscript_id, "info", "   ✓ Settings/ directory exists")
        else:
            ManuscriptLogger.log(self.manuscript_id, "warning", "   ✗ Settings/ directory missing")
            missing.append('Settings')
        
        # Check .scrivx file
        scrivx_found = False
        for filename in os.listdir(scriv_dir):
            if filename.endswith('.scrivx'):
                # Validate it's valid XML
                scrivx_path = os.path.join(scriv_dir, filename)
                if self._validate_xml(scrivx_path):
                    ManuscriptLogger.log(self.manuscript_id, "info", "   ✓ .scrivx file is valid XML")
                    scrivx_found = True
                else:
                    ManuscriptLogger.log(self.manuscript_id, "error", "   ✗ .scrivx file is invalid XML")
                    missing.append('*.scrivx (invalid)')
                break
        
        if not scrivx_found:
            ManuscriptLogger.log(self.manuscript_id, "error", "   ✗ .scrivx file not found")
            missing.append('*.scrivx')
        
        is_valid = len(missing) == 0
        
        if is_valid:
            ManuscriptLogger.log(self.manuscript_id, "info", "✅ Project structure is valid")
        else:
            ManuscriptLogger.log(
                self.manuscript_id,
                "error",
                f"❌ Project structure invalid - missing: {', '.join(missing)}"
            )
        
        return is_valid, missing
    
    def _find_scriv_in_zip(self, file_list: List[str]) -> Optional[str]:
        """Find .scriv directory path in ZIP file list."""
        for path in file_list:
            if '.scriv/' in path or path.endswith('.scriv'):
                # Extract the .scriv directory path
                parts = path.split('.scriv/')
                if len(parts) >= 1:
                    scriv_path = parts[0] + '.scriv'
                    return scriv_path
        return None
    
    def _is_mac_format(self, file_list: List[str], scriv_path: str) -> bool:
        """Detect if .scriv is Mac package format (has QuickLook folder)."""
        quicklook_path = f"{scriv_path}/QuickLook/"
        return any(f.startswith(quicklook_path) for f in file_list)
    
    def _validate_xml(self, xml_path: str) -> bool:
        """Validate that file is valid XML."""
        try:
            import xml.etree.ElementTree as ET
            ET.parse(xml_path)
            return True
        except Exception:
            return False
    
    def _create_progress_bar(self, percentage: int, width: int = 20) -> str:
        """Create ASCII progress bar."""
        filled = int(width * percentage / 100)
        bar = '=' * filled + '>' + ' ' * (width - filled - 1)
        return f"[{bar}]"
```

### 2. ScrivenerParser Service

**File:** `app/services/scrivener_parser.py`

```python
"""
Scrivener Parser Service

Parses .scrivx XML files and builds BinderItem hierarchy.
Extracts all metadata and maps to Codex structure.
"""

import os
import xml.etree.ElementTree as ET
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class BinderItem:
    """Represents a single document/folder in Scrivener binder."""
    uuid: str
    type: str  # Text, Folder, DraftFolder, etc.
    title: str
    created: Optional[str] = None
    modified: Optional[str] = None
    
    # Metadata
    include_in_compile: bool = True
    status: Optional[str] = None
    label: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    synopsis: Optional[str] = None
    
    # Content
    rtf_path: Optional[str] = None  # Path to RTF file
    
    # Hierarchy
    children: List['BinderItem'] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'uuid': self.uuid,
            'type': self.type,
            'title': self.title,
            'created': self.created,
            'modified': self.modified,
            'metadata': {
                'include_in_compile': self.include_in_compile,
                'status': self.status,
                'label': self.label,
                'keywords': self.keywords,
                'synopsis': self.synopsis,
            },
            'rtf_path': self.rtf_path,
            'children': [child.to_dict() for child in self.children]
        }

@dataclass
class ScrivenerProject:
    """Represents entire Scrivener project structure."""
    title: str
    identifier: str
    version: str
    creator: str
    binder_items: List[BinderItem] = field(default_factory=list)
    labels: List[str] = field(default_factory=list)
    statuses: List[str] = field(default_factory=list)
    
    def count_documents(self) -> Dict[str, int]:
        """Count documents by type."""
        counts = {}
        
        def count_recursive(items: List[BinderItem]):
            for item in items:
                counts[item.type] = counts.get(item.type, 0) + 1
                if item.children:
                    count_recursive(item.children)
        
        count_recursive(self.binder_items)
        return counts

class ScrivenerParser:
    """Parse .scrivx XML files into structured data."""
    
    # Scrivener type to Codex type mapping
    TYPE_MAP = {
        'Text': 'chapter',
        'Folder': 'section',
        'DraftFolder': 'book',
        'ResearchFolder': 'research',
        'TrashFolder': None,  # Skip trash
        'Template': 'template',
        'WebPage': 'reference',
        'PDF': 'document',
        'Image': 'image',
        'Video': 'video',
        'Audio': 'audio',
    }
    
    def __init__(self, manuscript_id: str, scriv_dir: str):
        """
        Initialize parser.
        
        Args:
            manuscript_id: Manuscript UUID for logging
            scriv_dir: Path to .scriv directory
        """
        self.manuscript_id = manuscript_id
        self.scriv_dir = scriv_dir
        self.logger = logging.getLogger(f"{__name__}.{manuscript_id}")
    
    def parse_scrivx(self, scrivx_path: str) -> Optional[ScrivenerProject]:
        """
        Parse .scrivx file and build project structure.
        
        Args:
            scrivx_path: Path to .scrivx file
            
        Returns:
            ScrivenerProject object or None if parsing fails
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        ManuscriptLogger.log(self.manuscript_id, "info", "📖 Parsing project structure...")
        
        try:
            tree = ET.parse(scrivx_path)
            root = tree.getroot()
            
            # Extract project metadata
            project = ScrivenerProject(
                title=os.path.basename(scrivx_path).replace('.scrivx', ''),
                identifier=root.get('Identifier', ''),
                version=root.get('Version', ''),
                creator=root.get('Creator', '')
            )
            
            # Parse labels and statuses
            project.labels = self._parse_labels(root)
            project.statuses = self._parse_statuses(root)
            
            # Parse binder structure
            binder = root.find('Binder')
            if binder is None:
                ManuscriptLogger.log(self.manuscript_id, "error", "❌ No <Binder> element found")
                return None
            
            # Parse all binder items
            project.binder_items = self._parse_binder_items(binder)
            
            # Count documents
            counts = project.count_documents()
            
            # Format counts for display
            count_parts = []
            if 'DraftFolder' in counts or 'book' in counts:
                book_count = counts.get('DraftFolder', 0) + counts.get('book', 0)
                count_parts.append(f"{book_count} book{'s' if book_count != 1 else ''}")
            
            if 'Folder' in counts or 'section' in counts:
                folder_count = counts.get('Folder', 0) + counts.get('section', 0)
                count_parts.append(f"{folder_count} section{'s' if folder_count != 1 else ''}")
            
            if 'Text' in counts or 'chapter' in counts:
                text_count = counts.get('Text', 0) + counts.get('chapter', 0)
                count_parts.append(f"{text_count} document{'s' if text_count != 1 else ''}")
            
            total_count = sum(counts.values())
            
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"   Found: {', '.join(count_parts)}"
            )
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"   Total items: {total_count}"
            )
            
            return project
            
        except ET.ParseError as e:
            ManuscriptLogger.log(self.manuscript_id, "error", f"❌ XML parse error: {str(e)}")
            self.logger.exception("XML parse error")
            return None
        except Exception as e:
            ManuscriptLogger.log(self.manuscript_id, "error", f"❌ Parse failed: {str(e)}")
            self.logger.exception("Parse error")
            return None
    
    def _parse_binder_items(self, parent_element: ET.Element) -> List[BinderItem]:
        """
        Recursively parse binder items from XML.
        
        Args:
            parent_element: XML element containing BinderItem elements
            
        Returns:
            List of BinderItem objects
        """
        items = []
        
        for binder_item_el in parent_element.findall('BinderItem'):
            item = self._parse_binder_item(binder_item_el)
            
            # Skip trash
            if item.type == 'TrashFolder':
                continue
            
            items.append(item)
        
        return items
    
    def _parse_binder_item(self, element: ET.Element) -> BinderItem:
        """
        Parse a single BinderItem element.
        
        Args:
            element: BinderItem XML element
            
        Returns:
            BinderItem object
        """
        # Basic attributes
        uuid = element.get('UUID', '')
        item_type = element.get('Type', 'Text')
        created = element.get('Created', '')
        modified = element.get('Modified', '')
        
        # Title
        title_el = element.find('Title')
        title = title_el.text if title_el is not None and title_el.text else 'Untitled'
        
        # Metadata
        metadata_el = element.find('MetaData')
        include_in_compile = True
        status = None
        label = None
        keywords = []
        synopsis = None
        
        if metadata_el is not None:
            # IncludeInCompile
            include_el = metadata_el.find('IncludeInCompile')
            if include_el is not None:
                include_in_compile = include_el.text == 'Yes'
            
            # Status
            status_el = metadata_el.find('Status')
            if status_el is not None and status_el.text:
                status = status_el.text
            
            # Label
            label_el = metadata_el.find('Label')
            if label_el is not None and label_el.text:
                label = label_el.text
            
            # Keywords
            keywords_el = metadata_el.find('Keywords')
            if keywords_el is not None and keywords_el.text:
                keywords = [k.strip() for k in keywords_el.text.split(',') if k.strip()]
            
            # Synopsis
            synopsis_el = metadata_el.find('Synopsis')
            if synopsis_el is not None and synopsis_el.text:
                synopsis = synopsis_el.text
        
        # RTF file path (if Text type)
        rtf_path = None
        if item_type == 'Text':
            rtf_path = os.path.join(self.scriv_dir, 'Files', 'Data', f'{uuid}.rtf')
            if not os.path.exists(rtf_path):
                self.logger.warning(f"RTF file not found: {rtf_path}")
                rtf_path = None
        
        # Create item
        item = BinderItem(
            uuid=uuid,
            type=item_type,
            title=title,
            created=created,
            modified=modified,
            include_in_compile=include_in_compile,
            status=status,
            label=label,
            keywords=keywords,
            synopsis=synopsis,
            rtf_path=rtf_path
        )
        
        # Parse children recursively
        children_el = element.find('Children')
        if children_el is not None:
            item.children = self._parse_binder_items(children_el)
        
        return item
    
    def _parse_labels(self, root: ET.Element) -> List[str]:
        """Extract label list from project settings."""
        labels = []
        label_settings = root.find('LabelSettings')
        if label_settings is not None:
            labels_el = label_settings.find('Labels')
            if labels_el is not None:
                for label_el in labels_el.findall('Label'):
                    if label_el.text:
                        labels.append(label_el.text)
        return labels
    
    def _parse_statuses(self, root: ET.Element) -> List[str]:
        """Extract status list from project settings."""
        statuses = []
        status_settings = root.find('StatusSettings')
        if status_settings is not None:
            statuses_el = status_settings.find('Statuses')
            if statuses_el is not None:
                for status_el in statuses_el.findall('Status'):
                    if status_el.text:
                        statuses.append(status_el.text)
        return statuses
    
    def get_codex_type(self, scrivener_type: str) -> Optional[str]:
        """
        Map Scrivener type to Codex type.
        
        Args:
            scrivener_type: Scrivener document type
            
        Returns:
            Codex type string or None to skip
        """
        return self.TYPE_MAP.get(scrivener_type, 'document')
```

### 3. ScrivenerContentConverter Service

**File:** `app/services/scrivener_content_converter.py`

```python
"""
Scrivener Content Converter Service

Converts RTF content from Scrivener to Markdown or HTML.
"""

import os
import logging
from typing import Optional, Tuple
import subprocess

logger = logging.getLogger(__name__)

class ScrivenerContentConverter:
    """Convert Scrivener RTF content to Markdown or HTML."""
    
    def __init__(self, manuscript_id: str):
        """
        Initialize converter.
        
        Args:
            manuscript_id: Manuscript UUID for logging
        """
        self.manuscript_id = manuscript_id
        self.logger = logging.getLogger(f"{__name__}.{manuscript_id}")
    
    def convert_rtf_to_markdown(self, rtf_path: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Convert RTF file to Markdown format.
        
        Args:
            rtf_path: Path to RTF file
            
        Returns:
            Tuple of (success, markdown_content, error_message)
        """
        if not os.path.exists(rtf_path):
            return False, None, f"RTF file not found: {rtf_path}"
        
        try:
            # Try striprtf first (lightweight, pure Python)
            from striprtf.striprtf import rtf_to_text
            
            with open(rtf_path, 'r', encoding='utf-8', errors='ignore') as f:
                rtf_content = f.read()
            
            # Convert to plain text
            text_content = rtf_to_text(rtf_content)
            
            # Basic markdown formatting preservation
            # (This is simplified - in production, use pypandoc for better conversion)
            markdown_content = self._enhance_markdown(text_content)
            
            return True, markdown_content, None
            
        except ImportError:
            # Fallback to pypandoc if available
            try:
                import pypandoc
                markdown_content = pypandoc.convert_file(rtf_path, 'md', format='rtf')
                return True, markdown_content, None
            except Exception as e:
                error = f"Markdown conversion failed: {str(e)}"
                self.logger.error(error)
                return False, None, error
        except Exception as e:
            error = f"RTF conversion failed: {str(e)}"
            self.logger.error(error)
            return False, None, error
    
    def convert_rtf_to_html(self, rtf_path: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Convert RTF file to HTML format.
        
        Args:
            rtf_path: Path to RTF file
            
        Returns:
            Tuple of (success, html_content, error_message)
        """
        if not os.path.exists(rtf_path):
            return False, None, f"RTF file not found: {rtf_path}"
        
        try:
            # Use pypandoc for RTF to HTML conversion
            import pypandoc
            html_content = pypandoc.convert_file(rtf_path, 'html', format='rtf')
            return True, html_content, None
            
        except ImportError:
            # Fallback: convert to text and wrap in <p> tags
            try:
                from striprtf.striprtf import rtf_to_text
                
                with open(rtf_path, 'r', encoding='utf-8', errors='ignore') as f:
                    rtf_content = f.read()
                
                text_content = rtf_to_text(rtf_content)
                
                # Basic HTML wrapping
                paragraphs = text_content.split('\n\n')
                html_content = '\n'.join(f'<p>{p.strip()}</p>' for p in paragraphs if p.strip())
                
                return True, html_content, None
            except Exception as e:
                error = f"HTML conversion failed: {str(e)}"
                self.logger.error(error)
                return False, None, error
        except Exception as e:
            error = f"RTF conversion failed: {str(e)}"
            self.logger.error(error)
            return False, None, error
    
    def _enhance_markdown(self, text: str) -> str:
        """
        Basic markdown enhancement (preserve formatting hints).
        
        This is a simplified version. In production, use pypandoc
        for proper RTF → Markdown conversion with formatting.
        """
        # Preserve double newlines as paragraphs
        # (Real implementation would preserve bold, italic, headings, etc.)
        return text
```

### 4. ScrivenerToCodex Builder ⭐ UPDATED FOR HIERARCHY

**File:** `app/services/scrivener_to_codex.py`

```python
"""
Scrivener to Codex Builder Service

Builds HIERARCHICAL Codex structure from Scrivener project data.
Creates zoomable hierarchy with include directives.

Key Features:
- Bottom-up tree building (leaves first, then folders, then sections)
- Each level gets its own codex file
- Include directives for composition
- Generates .index.codex.yaml master file
"""

import os
import yaml
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import uuid as uuid_module
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class ScrivenerToCodex:
    """Build hierarchical Codex format from Scrivener project."""
    
    def __init__(self, manuscript_id: str, project_output_dir: str):
        """
        Initialize builder for hierarchical output.
        
        Args:
            manuscript_id: Manuscript UUID for logging
            project_output_dir: ChapterWise Project directory (data/projects/user/project/)
        """
        self.manuscript_id = manuscript_id
        self.project_output_dir = project_output_dir
        self.logger = logging.getLogger(f"{__name__}.{manuscript_id}")
        self.file_count = 0  # Track generated files
        self.path_mapping = {}  # Track binder UUID -> file path for includes
    
    def build_hierarchical(
        self, 
        project: 'ScrivenerProject',
        chapterwise_project: 'Project',  # NEW: ChapterWise Project model
        content_converter: 'ScrivenerContentConverter'
    ) -> Tuple[bool, Optional[str], Optional[str], int]:
        """
        Build hierarchical Codex structure with include directives.
        
        Strategy:
        1. Build leaf nodes (chapters/documents with actual content)
        2. Build folder nodes (parts/sections that aggregate children)
        3. Build section nodes (top-level binders)
        4. Build index node (master .index.codex.yaml)
        
        Args:
            project: Parsed ScrivenerProject object
            chapterwise_project: ChapterWise Project model for metadata
            content_converter: RTF converter service
                
        Returns:
            Tuple of (success, index_file_path, error_message, file_count)
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            "🔄 Starting hierarchical Scrivener → Codex conversion"
        )
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   Output: Hierarchical YAML with includes"
        )
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   Content: RTF → Markdown"
        )
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   Project: {chapterwise_project.name} ({chapterwise_project.id})"
        )
        
        try:
            # Phase 1: Build leaf nodes (bottom-up)
            total_leaves = self._count_leaf_documents(project.binder_items)
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"📄 Processing {total_leaves} leaf documents (actual content)..."
            )
            
            processed = {'count': 0}
            for top_item in project.binder_items:
                self._build_leaf_codex_files(
                    top_item, 
                    content_converter,
                    processed,
                    total_leaves,
                    ManuscriptLogger
                )
            
            # Phase 2: Build folder nodes (middle-up)
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                "📁 Building folder codex files..."
            )
            
            for top_item in project.binder_items:
                self._build_folder_codex_files(
                    top_item,
                    ManuscriptLogger
                )
            
            # Phase 3: Build section nodes (top-level)
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                "📚 Building section codex files..."
            )
            
            section_files = []
            for top_item in project.binder_items:
                section_file = self._build_section_codex(
                    top_item,
                    ManuscriptLogger
                )
                if section_file:
                    section_files.append(section_file)
            
            # Phase 4: Build master index
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                "📚 Building master .index.codex.yaml..."
            )
            
            index_file = self._build_index_codex(
                project,
                section_files,
                chapterwise_project,
                ManuscriptLogger
            )
            
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                "✅ Hierarchical conversion complete!"
            )
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"   Generated {total_leaves} content files"
            )
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"   Generated {self.file_count - total_leaves - 1} aggregation files"
            )
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"   Generated 1 index file"
            )
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"   Total: {self.file_count} files"
            )
            
            return True, index_file, None, self.file_count
            
        except Exception as e:
            error = f"Hierarchical conversion failed: {str(e)}"
            ManuscriptLogger.log(self.manuscript_id, "error", f"❌ {error}")
            self.logger.exception("Conversion error")
            return False, None, error, self.file_count
    
    def _count_leaf_documents(self, items: List['BinderItem']) -> int:
        """Count only leaf documents (ones with actual RTF content)."""
        count = 0
        for item in items:
            if item.children:
                # Has children, so not a leaf - recurse
                count += self._count_leaf_documents(item.children)
            elif item.item_type == 'Text':
                # Leaf text document
                count += 1
        return count
    
    def _build_leaf_codex_files(
        self,
        item: 'BinderItem',
        content_converter: 'ScrivenerContentConverter',
        processed: Dict[str, int],
        total: int,
        logger_class
    ):
        """
        Recursively build leaf codex files (actual content).
        
        Leaf nodes are documents with no children that contain RTF content.
        These get the actual RTF → Markdown conversion.
        """
        if item.children:
            # Not a leaf - recurse into children
            for child in item.children:
                self._build_leaf_codex_files(
                    child,
                    content_converter,
                    processed,
                    total,
                    logger_class
                )
        elif item.item_type == 'Text':
            # This is a leaf - process it
            processed['count'] += 1
            current = processed['count']
            
            # Log progress
            logger_class.log(
                self.manuscript_id,
                "info",
                f"   [{current}/{total}] {item.title}"
            )
            
            # Generate file path (e.g., "Manuscript/Part-01/Chapter-01.codex.yaml")
            file_path = self._generate_file_path(item)
            full_path = os.path.join(self.project_output_dir, file_path)
            
            # Ensure parent directory exists
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Convert RTF content
            content_body = ""
            if item.rtf_path and os.path.exists(item.rtf_path):
                logger_class.log(
                    self.manuscript_id,
                    "info",
                    f"      ↳ Reading RTF: {os.path.basename(item.rtf_path)}"
                )
                logger_class.log(
                    self.manuscript_id,
                    "info",
                    "      ↳ Converting RTF to Markdown..."
                )
                
                success, content_body, error = content_converter.convert_rtf_to_markdown(item.rtf_path)
                if not success:
                    logger_class.log(
                        self.manuscript_id,
                        "warning",
                        f"      ⚠️ RTF conversion failed: {error}"
                    )
            
            # Build codex structure
            codex_data = {
                'metadata': {
                    'formatVersion': '1.2',
                    'created': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                },
                'id': item.uuid,
                'type': self._map_type(item),
                'name': item.title,
                'scrivenerType': item.item_type,
            }
            
            # Add metadata as attributes
            attributes = self._build_attributes(item)
            if attributes:
                codex_data['attributes'] = attributes
            
            # Add content
            if content_body:
                codex_data['body'] = content_body
            
            # Write YAML file
            with open(full_path, 'w', encoding='utf-8') as f:
                yaml.dump(codex_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
            
            # Track for includes
            self.path_mapping[item.uuid] = file_path
            self.file_count += 1
            
            logger_class.log(
                self.manuscript_id,
                "info",
                f"      ✓ Created: {file_path}"
            )
            
            # Log progress bar
            self._log_progress_bar(current, total, logger_class)
    
    def _build_folder_codex_files(
        self,
        item: 'BinderItem',
        logger_class
    ) -> Optional[str]:
        """
        Recursively build folder codex files (aggregators).
        
        Folder nodes have children and use include directives.
        Returns the file path if this is a folder, None if leaf.
        """
        if not item.children:
            # Leaf node - already processed
            return None
        
        # Process children first (bottom-up)
        child_files = []
        for child in item.children:
            child_file = self._build_folder_codex_files(child, logger_class)
            if child_file:
                child_files.append(child_file)
            elif child.uuid in self.path_mapping:
                # Child is a leaf - use its path
                child_files.append(self.path_mapping[child.uuid])
        
        # Now build this folder's codex
        file_path = self._generate_folder_path(item)
        full_path = os.path.join(self.project_output_dir, file_path)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Build codex with includes
        child_count = len(item.children)
        logger_class.log(
            self.manuscript_id,
            "info",
            f"   {item.title} ({child_count} {'child' if child_count == 1 else 'children'})"
        )
        
        codex_data = {
            'metadata': {
                'formatVersion': '1.2',
                'created': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            },
            'id': item.uuid,
            'type': self._map_type(item),
            'name': item.title,
            'scrivenerType': item.item_type,
        }
        
        # Add metadata as attributes
        attributes = self._build_attributes(item)
        if attributes:
            codex_data['attributes'] = attributes
        
        # Add include directives for children
        if child_files:
            codex_data['children'] = [
                {'include': self._make_relative_include(file_path, child_path)}
                for child_path in child_files
            ]
        
        # Write YAML file
        with open(full_path, 'w', encoding='utf-8') as f:
            yaml.dump(codex_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        
        # Track for parent includes
        self.path_mapping[item.uuid] = file_path
        self.file_count += 1
        
        logger_class.log(
            self.manuscript_id,
            "info",
            f"      ✓ Created: {file_path}"
        )
        logger_class.log(
            self.manuscript_id,
            "info",
            f"      ✓ Added {len(child_files)} include directives"
        )
        
        return file_path
    
    def _build_section_codex(
        self,
        top_item: 'BinderItem',
        logger_class
    ) -> Optional[str]:
        """
        Build top-level section codex (e.g., Manuscript.codex.yaml).
        
        Returns the file path.
        """
        # Generate section path (e.g., "Manuscript/Manuscript.codex.yaml")
        section_name = self._slugify(top_item.title)
        file_path = f"{section_name}/{section_name}.codex.yaml"
        full_path = os.path.join(self.project_output_dir, file_path)
        
        # Get children file paths
        child_files = []
        for child in top_item.children:
            if child.uuid in self.path_mapping:
                child_files.append(self.path_mapping[child.uuid])
        
        # Build section codex
        child_count = len(top_item.children)
        logger_class.log(
            self.manuscript_id,
            "info",
            f"   {top_item.title} section ({child_count} {'item' if child_count == 1 else 'items'})"
        )
        
        codex_data = {
            'metadata': {
                'formatVersion': '1.2',
                'created': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            },
            'id': top_item.uuid,
            'type': self._map_type(top_item),
            'name': top_item.title,
            'scrivenerType': top_item.item_type,
        }
        
        # Add include directives
        if child_files:
            codex_data['children'] = [
                {'include': self._make_relative_include(file_path, child_path)}
                for child_path in child_files
            ]
        
        # Write file
        with open(full_path, 'w', encoding='utf-8') as f:
            yaml.dump(codex_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        
        self.file_count += 1
        
        logger_class.log(
            self.manuscript_id,
            "info",
            f"      ✓ Created: {file_path}"
        )
        logger_class.log(
            self.manuscript_id,
            "info",
            f"      ✓ Added {len(child_files)} include directives"
        )
        
        return file_path
    
    def _build_index_codex(
        self,
        project: 'ScrivenerProject',
        section_files: List[str],
        chapterwise_project: 'Project',
        logger_class
    ) -> str:
        """
        Build master .index.codex.yaml file.
        
        This is the top-level entry point for viewing the entire project.
        """
        file_path = ".index.codex.yaml"
        full_path = os.path.join(self.project_output_dir, file_path)
        
        codex_data = {
            'metadata': {
                'formatVersion': '1.2',
                'created': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'author': chapterwise_project.user.get_preferred_display_name() if chapterwise_project.user else None,
                'tags': ['scrivener-import'],
            },
            'id': str(chapterwise_project.id),
            'type': 'project',
            'name': project.title,
            'summary': f"Imported from Scrivener project: {project.title}",
        }
        
        # Add project metadata
        codex_data['attributes'] = [
            {'key': 'source', 'value': 'scrivener'},
            {'key': 'scrivener_identifier', 'value': project.identifier},
            {'key': 'scrivener_version', 'value': project.version},
            {'key': 'chapterwise_project_id', 'value': str(chapterwise_project.id)},
        ]
        
        # Add include directives for all top-level sections
        if section_files:
            codex_data['children'] = [
                {'include': section_file}
                for section_file in section_files
            ]
        
        # Write file
        with open(full_path, 'w', encoding='utf-8') as f:
            yaml.dump(codex_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        
        self.file_count += 1
        
        logger_class.log(
            self.manuscript_id,
            "info",
            f"   ✓ Added {len(section_files)} top-level includes"
        )
        logger_class.log(
            self.manuscript_id,
            "info",
            f"   ✓ Created: {file_path}"
        )
        
        return file_path
    
    def _generate_file_path(self, item: 'BinderItem') -> str:
        """
        Generate hierarchical file path for a binder item.
        
        Example: "Manuscript/Part-01-The-Beginning/Chapter-01.codex.yaml"
        """
        # Build path from root to this item
        path_parts = []
        current = item
        while current:
            slug = self._slugify(current.title)
            path_parts.insert(0, slug)
            current = current.parent if hasattr(current, 'parent') else None
        
        # Last part gets .codex.yaml extension
        path_parts[-1] = f"{path_parts[-1]}.codex.yaml"
        
        return "/".join(path_parts)
    
    def _generate_folder_path(self, item: 'BinderItem') -> str:
        """
        Generate path for a folder codex file.
        
        Example: "Manuscript/Part-01-The-Beginning/Part-01-The-Beginning.codex.yaml"
        """
        # Build path from root to this item
        path_parts = []
        current = item
        while current:
            slug = self._slugify(current.title)
            path_parts.insert(0, slug)
            current = current.parent if hasattr(current, 'parent') else None
        
        # Folder file is: folder/folder.codex.yaml
        folder_name = path_parts[-1]
        path_parts.append(f"{folder_name}.codex.yaml")
        
        return "/".join(path_parts)
    
    def _make_relative_include(self, parent_path: str, child_path: str) -> str:
        """
        Generate relative include path from parent to child.
        
        Example:
            parent: "Manuscript/Manuscript.codex.yaml"
            child: "Manuscript/Part-01/Part-01.codex.yaml"
            result: "Part-01/Part-01.codex.yaml"
        """
        parent_dir = os.path.dirname(parent_path)
        if parent_dir:
            return os.path.relpath(child_path, parent_dir)
        return child_path
    
    def _slugify(self, text: str) -> str:
        """Convert text to URL-safe slug."""
        import re
        # Replace spaces with hyphens
        slug = text.replace(' ', '-')
        # Remove special characters
        slug = re.sub(r'[^a-zA-Z0-9-]', '', slug)
        # Collapse multiple hyphens
        slug = re.sub(r'-+', '-', slug)
        # Remove leading/trailing hyphens
        slug = slug.strip('-')
        return slug or 'untitled'
    
    def _map_type(self, item: 'BinderItem') -> str:
        """Map Scrivener type to Codex type."""
        type_mapping = {
            'DraftFolder': 'folder',
            'Folder': 'folder',
            'Text': self._guess_text_type(item),
        }
        return type_mapping.get(item.item_type, 'document')
    
    def _guess_text_type(self, item: 'BinderItem') -> str:
        """Guess codex type from item metadata."""
        if item.label and 'chapter' in item.label.lower():
            return 'chapter'
        elif item.label and 'scene' in item.label.lower():
            return 'scene'
        elif item.parent and item.parent.item_type == 'DraftFolder':
            return 'chapter'  # Direct child of Manuscript is likely a chapter
        return 'document'
    
    def _build_attributes(self, item: 'BinderItem') -> List[Dict[str, str]]:
        """Build attributes array from Scrivener metadata."""
        attributes = []
        
        if item.label:
            attributes.append({'key': 'label', 'value': item.label})
        if item.status:
            attributes.append({'key': 'status', 'value': item.status})
        if item.keywords:
            attributes.append({'key': 'keywords', 'value': ', '.join(item.keywords)})
        if item.synopsis:
            attributes.append({'key': 'synopsis', 'value': item.synopsis})
        
        return attributes
    
    def _log_progress_bar(self, current: int, total: int, logger_class):
        """Log progress bar at certain intervals."""
        if current % max(1, total // 10) == 0 or current == total:
            progress = int((current / total) * 100)
            bar = self._create_progress_bar(progress)
            logger_class.log(
                self.manuscript_id,
                "info",
                f"   Progress: {bar} {progress}% ({current}/{total})"
            )
    
    def _create_progress_bar(self, percentage: int, width: int = 20) -> str:
        """Create ASCII progress bar."""
        filled = int(width * percentage / 100)
        bar = '=' * filled + ('>' if filled < width else '') + ' ' * max(0, width - filled - 1)
        return f"[{bar}]"
```

**Key Methods:**

1. **`build_hierarchical()`** - Main entry point, orchestrates 4-phase build
2. **`_build_leaf_codex_files()`** - Phase 1: Convert RTF content to standalone codex files
3. **`_build_folder_codex_files()`** - Phase 2: Create aggregator files with include directives
4. **`_build_section_codex()`** - Phase 3: Create top-level section files
5. **`_build_index_codex()`** - Phase 4: Create master `.index.codex.yaml`
6. **`_generate_file_path()`** - Build hierarchical file paths
7. **`_make_relative_include()`** - Generate relative include paths for Codex V1.2
        
        for item in project.binder_items:
            child_data = self._convert_item_to_codex(
                item, 
                converter, 
                parser, 
                options,
                processed,
                total,
                progress_callback
            )
            if child_data:
                codex_data['children'].append(child_data)
        
        # Write main file
        output_format = options['output_format']
        if output_format == 'yaml':
            main_file = os.path.join(self.output_dir, f"{self._slugify(project.title)}.codex.yaml")
            with open(main_file, 'w', encoding='utf-8') as f:
                yaml.dump(codex_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        else:  # json
            main_file = os.path.join(self.output_dir, f"{self._slugify(project.title)}.codex.json")
            with open(main_file, 'w', encoding='utf-8') as f:
                json.dump(codex_data, f, indent=2, ensure_ascii=False)
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   ✓ Created: {os.path.basename(main_file)}"
        )
        
        return True, main_file, None, 1
    
    def _build_modular(
        self, 
        project, 
        options, 
        converter, 
        parser, 
        progress_callback
    ) -> Tuple[bool, Optional[str], Optional[str], int]:
        """
        Build modular structure with include directives.
        Each document becomes separate file.
        
        Returns:
            Tuple of (success, main_file_path, error_message, file_count)
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        file_count = 0
        include_paths = []
        
        # Create subdirectories
        os.makedirs(os.path.join(self.output_dir, 'chapters'), exist_ok=True)
        
        processed = {'count': 0}
        total = self._count_documents(project.binder_items)
        
        # Convert each top-level item to separate file
        for item in project.binder_items:
            file_path = self._write_item_as_file(
                item, 
                converter, 
                parser, 
                options,
                processed,
                total,
                progress_callback,
                parent_path='chapters'
            )
            if file_path:
                include_paths.append(file_path)
                file_count += 1
        
        # Build main index file with includes
        codex_data = {
            'metadata': {
                'formatVersion': '1.2',
                'documentVersion': '1.0.0',
                'created': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                'source': 'scrivener',
            },
            'type': 'book',
            'name': project.title,
            'children': [{'include': path} for path in include_paths]
        }
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"📚 Building main codex file..."
        )
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   Adding include directives for {len(include_paths)} top-level items"
        )
        
        # Write main file
        output_format = options['output_format']
        if output_format == 'yaml':
            main_file = os.path.join(self.output_dir, f"{self._slugify(project.title)}.codex.yaml")
            with open(main_file, 'w', encoding='utf-8') as f:
                yaml.dump(codex_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        else:
            main_file = os.path.join(self.output_dir, f"{self._slugify(project.title)}.codex.json")
            with open(main_file, 'w', encoding='utf-8') as f:
                json.dump(codex_data, f, indent=2, ensure_ascii=False)
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   ✓ Created: {os.path.basename(main_file)}"
        )
        
        file_count += 1  # Count main file
        
        return True, main_file, None, file_count
    
    def _build_hybrid(
        self, 
        project, 
        options, 
        converter, 
        parser, 
        progress_callback
    ) -> Tuple[bool, Optional[str], Optional[str], int]:
        """
        Build hybrid structure: top-level as includes, nested as children.
        
        Returns:
            Tuple of (success, main_file_path, error_message, file_count)
        """
        # For now, use modular approach
        # TODO: Implement true hybrid (top-level files, nested children inline)
        return self._build_modular(project, options, converter, parser, progress_callback)
    
    def _convert_item_to_codex(
        self, 
        item: 'BinderItem', 
        converter, 
        parser, 
        options,
        processed,
        total,
        progress_callback
    ) -> Optional[Dict[str, Any]]:
        """
        Convert single BinderItem to codex dictionary (for monolithic).
        
        Returns:
            Codex dictionary or None if item should be skipped
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        processed['count'] += 1
        progress_callback(processed['count'], total)
        
        # Get codex type
        codex_type = parser.get_codex_type(item.type)
        if codex_type is None:
            return None
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   [{processed['count']}/{total}] {item.title}"
        )
        
        # Build base structure
        codex_item = {
            'type': codex_type,
            'name': item.title,
        }
        
        # Add synopsis as summary
        if item.synopsis:
            codex_item['summary'] = item.synopsis
        
        # Add keywords as tags
        if item.keywords:
            codex_item['tags'] = item.keywords
        
        # Add status
        if item.status:
            codex_item['status'] = self._map_status(item.status)
        
        # Add attributes
        attributes = []
        
        if item.label:
            attributes.append({
                'key': 'label',
                'name': 'Scrivener Label',
                'value': item.label
            })
        
        if not item.include_in_compile:
            attributes.append({
                'key': 'exclude_from_compile',
                'name': 'Exclude from Compile',
                'value': True,
                'dataType': 'boolean'
            })
        
        if attributes:
            codex_item['attributes'] = attributes
        
        # Convert content if exists
        if item.rtf_path:
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"      ↳ Reading RTF: {os.path.basename(item.rtf_path)}"
            )
            
            content_format = options['content_format']
            if content_format == 'markdown':
                ManuscriptLogger.log(
                    self.manuscript_id,
                    "info",
                    "      ↳ Converting RTF to Markdown..."
                )
                success, content, error = converter.convert_rtf_to_markdown(item.rtf_path)
            else:
                ManuscriptLogger.log(
                    self.manuscript_id,
                    "info",
                    "      ↳ Converting RTF to HTML..."
                )
                success, content, error = converter.convert_rtf_to_html(item.rtf_path)
            
            if success and content:
                codex_item['body'] = content
            elif error:
                ManuscriptLogger.log(
                    self.manuscript_id,
                    "warning",
                    f"      ⚠ Conversion warning: {error}"
                )
        
        # Convert children recursively
        if item.children:
            children = []
            for child in item.children:
                child_data = self._convert_item_to_codex(
                    child, 
                    converter, 
                    parser, 
                    options,
                    processed,
                    total,
                    progress_callback
                )
                if child_data:
                    children.append(child_data)
            
            if children:
                codex_item['children'] = children
        
        return codex_item
    
    def _write_item_as_file(
        self, 
        item: 'BinderItem', 
        converter, 
        parser, 
        options,
        processed,
        total,
        progress_callback,
        parent_path: str = ''
    ) -> Optional[str]:
        """
        Write BinderItem as separate file (for modular).
        
        Returns:
            Relative path to created file or None if skipped
        """
        from app.services.manuscript_logger import ManuscriptLogger
        
        processed['count'] += 1
        progress_callback(processed['count'], total)
        
        # Get codex type
        codex_type = parser.get_codex_type(item.type)
        if codex_type is None:
            return None
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"   [{processed['count']}/{total}] {item.title}"
        )
        
        # Determine output format
        output_format = options['output_format']
        slug = self._slugify(item.title)
        
        if output_format == 'markdown':
            filename = f"{slug}.md"
            is_markdown_lite = True
        elif output_format == 'yaml':
            filename = f"{slug}.codex.yaml"
            is_markdown_lite = False
        else:  # json
            filename = f"{slug}.codex.json"
            is_markdown_lite = False
        
        # Build file path
        file_dir = os.path.join(self.output_dir, parent_path) if parent_path else self.output_dir
        os.makedirs(file_dir, exist_ok=True)
        file_path = os.path.join(file_dir, filename)
        
        # Build structure
        if is_markdown_lite:
            # Markdown Lite format (YAML frontmatter + markdown content)
            content = self._build_markdown_lite(item, converter, options)
        else:
            # Full codex format
            content = self._build_codex_file(item, converter, parser, options, processed, total, progress_callback)
        
        # Write file
        if is_markdown_lite:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        elif output_format == 'yaml':
            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.dump(content, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        else:  # json
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(content, f, indent=2, ensure_ascii=False)
        
        ManuscriptLogger.log(
            self.manuscript_id,
            "info",
            f"      ✓ Created: {os.path.join(parent_path, filename)}"
        )
        
        # Return relative path for include directive
        return os.path.join(parent_path, filename) if parent_path else filename
    
    def _build_markdown_lite(self, item: 'BinderItem', converter, options) -> str:
        """Build Markdown Lite format file (frontmatter + content)."""
        from app.services.manuscript_logger import ManuscriptLogger
        
        # Build frontmatter
        frontmatter = {
            'type': item.type.lower(),
            'name': item.title,
        }
        
        if item.synopsis:
            frontmatter['summary'] = item.synopsis
        
        if item.keywords:
            frontmatter['tags'] = ', '.join(item.keywords)
        
        if item.status:
            frontmatter['status'] = self._map_status(item.status)
        
        if item.label:
            frontmatter['label'] = item.label
        
        # Convert content
        markdown_content = ""
        if item.rtf_path:
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                f"      ↳ Reading RTF: {os.path.basename(item.rtf_path)}"
            )
            ManuscriptLogger.log(
                self.manuscript_id,
                "info",
                "      ↳ Converting RTF to Markdown..."
            )
            success, content, error = converter.convert_rtf_to_markdown(item.rtf_path)
            if success and content:
                markdown_content = content
        
        # Build file content
        output = "---\n"
        output += yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True, sort_keys=False)
        output += "---\n\n"
        
        if markdown_content:
            output += markdown_content
        
        return output
    
    def _build_codex_file(
        self, 
        item: 'BinderItem', 
        converter, 
        parser, 
        options,
        processed,
        total,
        progress_callback
    ) -> Dict[str, Any]:
        """Build full codex file structure."""
        return self._convert_item_to_codex(
            item, 
            converter, 
            parser, 
            options,
            processed,
            total,
            progress_callback
        )
    
    def _map_status(self, scrivener_status: str) -> str:
        """Map Scrivener status to Codex status."""
        status_lower = scrivener_status.lower()
        if 'final' in status_lower or 'complete' in status_lower:
            return 'published'
        elif 'draft' in status_lower or 'progress' in status_lower:
            return 'draft'
        else:
            return 'private'
    
    def _slugify(self, text: str) -> str:
        """Convert text to URL-safe slug."""
        import re
        import unicodedata
        
        # Normalize unicode
        text = unicodedata.normalize('NFKD', text)
        text = text.encode('ascii', 'ignore').decode('ascii')
        
        # Convert to lowercase
        text = text.lower()
        
        # Replace spaces and special chars
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[-\s]+', '-', text)
        
        # Remove leading/trailing dashes
        text = text.strip('-')
        
        return text or 'untitled'
```

### 5. Converter Integration

**File:** `app/utils/converters/convert_scriv_manuscript.py`

```python
"""
Scrivener Manuscript Converter

Integrates Scrivener import pipeline with manuscript conversion system.
"""

import os
import logging
from typing import Dict, Any
from app.utils.converters.convert_manuscript import ConvertManuscript

logger = logging.getLogger(__name__)

class ConvertSCRIVManuscript(ConvertManuscript):
    """Converter for Scrivener (.scriv in ZIP) manuscripts."""
    
    def convert(self) -> Dict[str, Any]:
        """
        Convert Scrivener manuscript to Codex format.
        
        Returns:
            dict: Conversion result with success status and details
        """
        from app.services.scrivener_extractor import ScrivenerExtractor
        from app.services.scrivener_parser import ScrivenerParser
        from app.services.scrivener_to_codex import ScrivenerToCodex
        from app.services.manuscript_logger import ManuscriptLogger
        
        manuscript_id = str(self.manuscript.id)
        
        try:
            ManuscriptLogger.log(manuscript_id, "info", "🚀 Starting Scrivener import...")
            
            # Step 1: Extract .scriv from ZIP
            extractor = ScrivenerExtractor(manuscript_id)
            
            success, scriv_path, error = extractor.extract_from_zip(
                self.input_file_path,
                self.output_dir
            )
            
            if not success:
                return {
                    'success': False,
                    'error': error,
                    'step': 'extraction'
                }
            
            # Step 2: Validate structure
            is_valid, missing = extractor.validate_structure(scriv_path)
            if not is_valid:
                error = f"Invalid Scrivener project structure. Missing: {', '.join(missing)}"
                ManuscriptLogger.log(manuscript_id, "error", f"❌ {error}")
                return {
                    'success': False,
                    'error': error,
                    'step': 'validation'
                }
            
            # Step 3: Find .scrivx file
            scrivx_path = extractor.find_scrivx_file(scriv_path)
            if not scrivx_path:
                error = "No .scrivx project file found"
                return {
                    'success': False,
                    'error': error,
                    'step': 'validation'
                }
            
            # Step 4: Parse .scrivx
            parser = ScrivenerParser(manuscript_id, scriv_path)
            project = parser.parse_scrivx(scrivx_path)
            
            if not project:
                error = "Failed to parse .scrivx file"
                return {
                    'success': False,
                    'error': error,
                    'step': 'parsing'
                }
            
            # Step 5: Get or prompt for user options
            options = self._get_conversion_options()
            
            # Step 6: Build Codex structure
            builder = ScrivenerToCodex(manuscript_id, self.output_dir)
            success, main_file, error, file_count = builder.build(project, options)
            
            if not success:
                return {
                    'success': False,
                    'error': error,
                    'step': 'conversion'
                }
            
            ManuscriptLogger.log(manuscript_id, "info", "✨ Import complete - ready for review")
            
            # Update metadata
            self.metadata['chapter_count'] = project.count_documents().get('Text', 0)
            self.metadata['scrivener_project'] = {
                'title': project.title,
                'identifier': project.identifier,
                'version': project.version,
                'total_items': sum(project.count_documents().values())
            }
            
            return {
                'success': True,
                'output_file': main_file,
                'output_filename': os.path.basename(main_file),
                'file_count': file_count,
                'project': {
                    'title': project.title,
                    'counts': project.count_documents()
                }
            }
            
        except Exception as e:
            error = f"Scrivener conversion failed: {str(e)}"
            ManuscriptLogger.log(manuscript_id, "error", f"❌ {error}")
            logger.exception("Scrivener conversion error")
            
            return {
                'success': False,
                'error': error,
                'step': 'unknown'
            }
    
    def _get_conversion_options(self) -> Dict[str, Any]:
        """
        Get conversion options from user or use defaults.
        
        TODO: Implement options UI route to collect these from user.
        For now, use sensible defaults.
        
        Returns:
            dict: Conversion options
        """
        # Check if options were stored in session/database
        # For now, use defaults
        return {
            'output_format': 'yaml',      # yaml, json, or markdown
            'structure': 'modular',       # monolithic, modular, or hybrid
            'content_format': 'markdown'  # markdown or html
        }
```

**Modify:** `app/utils/converters/factory.py`

```python
# Add import at top
from app.utils.converters.convert_scriv_manuscript import ConvertSCRIVManuscript

# In ManuscriptConverterFactory.create_converter():

elif file_type == 'zip':
    # Check if ZIP contains .scriv project
    # For now, assume all ZIPs are Scrivener projects
    # TODO: Add detection logic
    return ConvertSCRIVManuscript(manuscript, output_dir)
```

**Modify:** `app/services/upload_service.py`

```python
# Add 'zip' to ALLOWED_EXTENSIONS
ALLOWED_EXTENSIONS = ['html', 'xml', 'json', 'pdf', 'txt', 'rtf', 'md', 'fdx', 'docx', 'zip']
```

---

## Logging & Progress Tracking

The Scrivener import process uses the same logging infrastructure as PDF chunking for real-time progress tracking.

### Logging Architecture

```
ConvertSCRIVManuscript.convert()
    ↓
ScrivenerExtractor.extract_from_zip()
    ↓ ManuscriptLogger.log(manuscript_id, "info", "🔍 Detecting...")
    ↓ ManuscriptLogger.log(manuscript_id, "info", "   Progress: [====>    ] 45%")
    ↓
ScrivenerParser.parse_scrivx()
    ↓ ManuscriptLogger.log(manuscript_id, "info", "📖 Parsing structure...")
    ↓ ManuscriptLogger.log(manuscript_id, "info", "   Found: 15 chapters")
    ↓
ScrivenerToCodex.build()
    ↓ ManuscriptLogger.log(manuscript_id, "info", "🔄 Converting...")
    ↓ ManuscriptLogger.log(manuscript_id, "info", "   [1/59] Chapter 1")
    ↓ ManuscriptLogger.log(manuscript_id, "info", "   Progress: [======>  ] 60%")
```

### Log Message Format

All log messages follow a consistent format for UI display:

**Icons:**
- 📦 Upload/receiving
- 🔍 Detection/searching
- 📂 Extraction/file operations
- 🔐 Validation
- 📖 Parsing
- 🔄 Conversion
- 📄 Document processing
- 📚 Building output
- ✅ Success
- ❌ Error
- ⚠ Warning
- ✨ Completion

**Progress bars:**
```
Progress: [=========>        ] 45% (27/59)
         │←─ 20 chars ─→│
```

**Nested operations:**
```
[1/59] Chapter 1: The Beginning
   ↳ Reading RTF: 921B4A08.rtf
   ↳ Converting RTF to Markdown...
   ✓ Created: chapters/chapter-01.md
```

### Real-time Updates

The UI polls the manuscript logger endpoint to show real-time progress:

```javascript
// Existing manuscript logger polling (used by PDF import)
function pollManuscriptLogs(manuscriptId) {
    fetch(`/api/manuscripts/${manuscriptId}/logs`)
        .then(response => response.json())
        .then(data => {
            updateLogDisplay(data.logs);
            if (!data.complete) {
                setTimeout(() => pollManuscriptLogs(manuscriptId), 500);
            }
        });
}
```

No changes needed to existing UI - Scrivener import logs will appear in the same console as PDF imports.

---

## File Structure

```
app/
├── services/
│   ├── scrivener_extractor.py       # ZIP extraction & validation
│   ├── scrivener_parser.py          # .scrivx XML parsing
│   ├── scrivener_content_converter.py # RTF → MD/HTML
│   └── scrivener_to_codex.py        # Build Codex structure
│
├── routes/
│   └── scrivener_import.py          # Options UI routes (future)
│
├── templates/
│   └── import/
│       └── scrivener_options.html   # Configuration form (future)
│
├── utils/converters/
│   ├── convert_scriv_manuscript.py  # Main converter
│   └── factory.py                   # [MODIFIED] Add scriv support
│
├── content/docs/import/
│   └── scrivener-import.md          # User documentation
│
└── dev/
    └── Scrivener Import.md          # This file
```

---

## Dependencies

Add to `requirements.txt`:

```txt
# Scrivener import support
striprtf>=0.0.22        # RTF text extraction
pypandoc>=1.11          # RTF to Markdown/HTML conversion (optional, better quality)

# Already included:
# lxml>=4.9.0           # XML parsing
# PyYAML>=6.0           # YAML output
```

### Optional: pypandoc Installation

For better RTF conversion quality, users can install pypandoc:

```bash
pip install pypandoc
# Also requires pandoc system package:
# Mac: brew install pandoc
# Ubuntu: apt install pandoc
# Windows: Download from pandoc.org
```

If pypandoc is not available, the system falls back to striprtf (pure Python, no dependencies).

---

## Testing Strategy

### Unit Tests

Create `test_scrivener_import.py`:

```python
import pytest
from app.services.scrivener_extractor import ScrivenerExtractor
from app.services.scrivener_parser import ScrivenerParser
from app.services.scrivener_to_codex import ScrivenerToCodex

def test_extract_scriv_from_zip():
    """Test extraction of .scriv from ZIP file."""
    # TODO: Test with sample Scrivener project ZIP

def test_parse_scrivx_structure():
    """Test parsing of .scrivx XML."""
    # TODO: Test with sample .scrivx file

def test_convert_rtf_to_markdown():
    """Test RTF content conversion."""
    # TODO: Test with sample RTF files

def test_build_monolithic_codex():
    """Test monolithic output generation."""
    # TODO: Test structure building

def test_build_modular_codex():
    """Test modular output with includes."""
    # TODO: Test include directives
```

### Integration Tests

Test end-to-end conversion with real Scrivener projects:

1. Simple project (1 book, 5 chapters)
2. Complex project (nested folders, scenes, research)
3. Large project (100+ documents)
4. Project with special characters in names
5. Project with missing RTF files

### Sample Projects

Create `test/fixtures/scrivener/` with:
- `simple-novel.scriv.zip` - Basic test project
- `complex-novel.scriv.zip` - Complex structure
- `corrupted.scriv.zip` - Invalid structure for error handling

---

## Documentation

### User Documentation

**File:** `app/content/docs/import/scrivener-import.md`

```markdown
# Importing Scrivener Projects

ChapterWise supports importing Scrivener 2.x and 3.x projects directly. This guide explains how to prepare and import your Scrivener manuscript.

## Preparing Your Scrivener Project

### Step 1: Close Your Project

Before exporting, make sure your Scrivener project is closed. This ensures all changes are saved and files are properly written.

### Step 2: Locate Your .scriv File

**On macOS:**
- The `.scriv` file appears as a single file in Finder
- It's actually a package (folder) that macOS displays as one item

**On Windows:**
- The `.scriv` folder appears as a regular folder
- You can open it and see the internal structure

### Step 3: Create a ZIP File

**On macOS:**
1. Right-click the `.scriv` file
2. Select "Compress [Project Name].scriv"
3. A `.scriv.zip` file will be created

**On Windows:**
1. Right-click the `.scriv` folder
2. Select "Send to" → "Compressed (zipped) folder"
3. A `.zip` file will be created

## Importing to ChapterWise

### Step 1: Upload ZIP File

1. Go to your ChapterWise dashboard
2. Click "Import Manuscript"
3. Select your `.scriv.zip` file
4. Click "Upload"

The system will:
- Extract the Scrivener project
- Detect the project structure
- Parse all metadata
- Show real-time progress in the console

### Step 2: Configure Import Options

After upload, you'll see an options page where you can choose:

**Output Format:**
- **YAML** (.codex.yaml) - Recommended for version control
- **JSON** (.codex.json) - Machine-readable format
- **Markdown** (.md) - Lightweight format with frontmatter

**Structure:**
- **Monolithic** - Single file with all content nested
- **Modular** - Each chapter as separate file with includes
- **Hybrid** - Top-level as files, scenes nested inside

**Content Conversion:**
- **Markdown** - Convert RTF to clean Markdown
- **HTML** - Convert RTF to HTML (preserves more formatting)

### Step 3: Review & Confirm

The system shows a preview of your project structure:
- Total documents found
- Chapter and scene counts
- Metadata that will be imported

Click "Convert" to begin the conversion process.

## What Gets Imported

### Document Structure

- **Binder hierarchy** - Your folder and document organization
- **Document types** - Chapters, sections, scenes
- **Nesting** - Parent-child relationships

### Metadata

- **Synopsis** → Summary field
- **Keywords** → Tags
- **Status** → Status (mapped to draft/published)
- **Label** → Custom attribute
- **Include in Compile** → Custom attribute

### Content

- **RTF text** - Converted to Markdown or HTML
- **Formatting** - Basic formatting preserved (bold, italic, headings)

### Not Imported (Yet)

- Research files (PDFs, images, web pages)
- Comments and annotations
- Compile settings
- Custom metadata fields

## Tips & Best Practices

### Before Import

- **Clean up your binder** - Remove items you don't want imported
- **Verify titles** - Check that all documents have meaningful titles
- **Add synopses** - These become summaries in ChapterWise
- **Tag with keywords** - These become searchable tags

### Choosing Output Format

- **YAML** - Best for human editing and Git
- **JSON** - Best for programmatic access
- **Markdown** - Best for portability and simple structure

### Choosing Structure

- **Monolithic** - Easy to manage, single file
- **Modular** - Better for collaboration, Git-friendly
- **Hybrid** - Balance between the two

## Troubleshooting

### "No .scriv project found"

Make sure you zipped the entire .scriv file/folder, not just the contents inside it.

### "Invalid project structure"

Your .scriv project may be corrupted. Try opening it in Scrivener first to verify it works.

### "Conversion failed"

Some RTF files may have encoding issues. Check the error log for specific files that failed.

### Missing content

If some documents appear empty:
- They may not have been saved in Scrivener
- The RTF files may be missing from Files/Data/
- Try re-saving in Scrivener and re-exporting

## Next Steps

After import:
- Review your imported codex
- Edit metadata as needed
- Add cover images
- Publish or keep private

## Support

For issues with Scrivener import:
- Check the import logs for specific errors
- Join our community forum
- Contact support with your error logs
```

### Developer Documentation

Add section to existing developer docs explaining the Scrivener import architecture and how to extend it.

---

## Future Enhancements

### Phase 2 Features

1. **Research folder support**
   - Import PDFs, images, web pages as reference materials
   - Store in separate `research/` directory

2. **Comments & annotations**
   - Convert Scrivener comments to codex annotations
   - Preserve inspector comments as attributes

3. **Compile settings**
   - Import compile presets
   - Map to codex export templates

4. **Custom metadata**
   - Support user-defined metadata fields
   - Map to codex attributes

5. **Progress preview**
   - Show visual preview of structure before conversion
   - Allow selecting which items to import

6. **Batch processing**
   - Import multiple projects at once
   - Queue system for large imports

### Phase 3 Features

1. **Two-way sync**
   - Export codex back to Scrivener format
   - Keep projects in sync

2. **Live import**
   - Monitor .scriv folder for changes
   - Auto-update codex when Scrivener saves

3. **Advanced formatting**
   - Preserve more RTF formatting
   - Support for Scrivener styles

---

## Implementation Checklist

### Phase 1: Core Functionality

- [ ] Create `scrivener_extractor.py` service
- [ ] Create `scrivener_parser.py` service
- [ ] Create `scrivener_content_converter.py` service
- [ ] Create `scrivener_to_codex.py` builder
- [ ] Create `convert_scriv_manuscript.py` converter
- [ ] Modify `factory.py` to handle .zip files
- [ ] Modify `upload_service.py` to allow .zip uploads
- [ ] Add comprehensive logging throughout
- [ ] Add progress tracking with ManuscriptLogger
- [ ] Add error handling and validation

### Phase 2: Options & UI

- [ ] Create `scrivener_import.py` routes
- [ ] Create `scrivener_options.html` template
- [ ] Implement options form
- [ ] Add options validation
- [ ] Store options in session/database

### Phase 3: Testing & Documentation

- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Create sample Scrivener projects for testing
- [ ] Write user documentation
- [ ] Write developer documentation
- [ ] Test with real-world Scrivener projects

### Phase 4: Polish & Refinement

- [ ] Optimize for large projects (100+ documents)
- [ ] Add structure preview
- [ ] Improve error messages
- [ ] Add recovery from partial failures
- [ ] Performance profiling and optimization

---

## Success Metrics

### Functional Requirements

✓ Successfully import Scrivener projects from both Mac and Windows
✓ Parse .scrivx XML and build complete binder hierarchy
✓ Convert RTF content to Markdown and/or HTML
✓ Map all major Scrivener metadata to Codex fields
✓ Generate valid Codex files in YAML, JSON, or Markdown format
✓ Support monolithic and modular output structures
✓ Provide real-time progress logging

### Quality Requirements

✓ Handle projects up to 1000 documents
✓ Complete import in < 30 seconds for typical project (50 docs)
✓ Gracefully handle missing/corrupted files
✓ Preserve 95%+ of content and metadata
✓ Generate valid, well-formed output files

### User Experience

✓ Clear progress indication throughout process
✓ Helpful error messages with recovery suggestions
✓ Preview structure before committing
✓ Easy-to-understand options
✓ Comprehensive documentation

---

## Notes

### Scrivener Version Compatibility

- **Scrivener 2.x**: Fully supported
- **Scrivener 3.x**: Fully supported (same .scrivx format)
- **Scrivener 1.x**: Not supported (different format)

### Platform Compatibility

- **macOS**: Fully supported
- **Windows**: Fully supported
- **Linux**: Not applicable (Scrivener doesn't run on Linux natively)

### File Size Limits

- Individual manuscript upload limit: 50MB
- Recommended project size: < 500 documents
- Maximum tested: 1000 documents

### Performance Considerations

- RTF conversion is the slowest step
- Consider async processing for large projects
- Cache parsed structure for option changes
- Stream large files instead of loading into memory

---

## Conclusion

This implementation plan provides a **comprehensive, hierarchical Scrivener import feature** that:

1. **Automatic Project Creation** - Creates ChapterWise Projects automatically from .scriv name
2. **Zoomable Hierarchy** - Each level of the Scrivener binder gets its own codex file
3. **Include Directives** - Uses Codex V1.2 include system for modular composition
4. **Master Index** - Generates `.index.codex.yaml` for top-level navigation
5. **Works cross-platform** - Handles both Mac and Windows formats seamlessly
6. **Preserves structure** - Maintains complete binder hierarchy
7. **Maps metadata** - Converts all Scrivener metadata to Codex equivalents
8. **Tracks progress** - Real-time console logging like PDF import
9. **Handles errors** - Graceful degradation with clear error messages
10. **Git-ready** - Easy conversion to Git Project for version control

---

## V2.0 Changes Summary 🎯

### Visual Comparison: Before vs. After

**V1.0 Approach (OLD):**
```
Upload ZIP → Extract → Parse → Show Options UI → Convert → Output files ???
                                                              ↓
                                                    Where do they go?
                                                    User creates project manually?
```

**V2.0 Approach (NEW):**
```
Upload ZIP → Extract → Parse → Create Project → Build Hierarchy → Redirect to Project
                                      ↓                 ↓
                              "My Novel" Project    Hierarchical files
                                                    with includes
                                                          ↓
                                                    User views project
                                                    Can zoom in/out
                                                    Can convert to Git
```

### File Structure Comparison

**V1.0 Output (OLD - Unclear):**
```
data/manuscripts/user-123/manuscript-456/
├── my-novel.codex.yaml  (monolithic OR modular, user chose)
├── chapters/            (if modular)
│   ├── chapter-01.yaml
│   ├── chapter-02.yaml
│   └── ...
└── ??? (what does user do with these?)
```

**V2.0 Output (NEW - Clear Project Structure):**
```
data/projects/user-123/project-789/   ← ChapterWise Project "My Novel"
├── .index.codex.yaml                  ← 📚 Master (view entire project)
├── Manuscript/
│   ├── Manuscript.codex.yaml          ← 📖 View full manuscript
│   ├── Part-01/
│   │   ├── Part-01.codex.yaml        ← 📑 View Part 1
│   │   ├── Chapter-01.codex.yaml     ← 📄 Read Chapter 1
│   │   └── Chapter-02.codex.yaml     ← 📄 Read Chapter 2
│   └── Part-02/
│       └── ...
├── Research/
│   ├── Research.codex.yaml            ← 📚 View all research
│   └── Characters.codex.yaml          ← 👥 View characters
└── Notes/
    ├── Notes.codex.yaml               ← 📝 View all notes
    └── Ideas.codex.yaml               ← 💡 View ideas
```

### What Changed from V1.0

**Before (V1.0):**
- ❌ Output went to manuscript folder (unclear organization)
- ❌ User chose between monolithic/modular/hybrid structures
- ❌ No clear "what happens next" for the user
- ❌ Required manual project creation if user wanted one
- ❌ Files were orphaned in manuscript directory
- ❌ No easy way to view entire project at once

**After (V2.0):**
- ✅ **Automatically creates ChapterWise Project** with .scriv name
- ✅ **Hierarchical output with include directives** (zoomable structure)
- ✅ **Master `.index.codex.yaml`** file for full project view
- ✅ **Each level gets its own codex** (chapters, parts, sections)
- ✅ **Clear user journey**: Upload → Parse → Create Project → Build Hierarchy → View Project
- ✅ **Easy Git conversion**: "Convert to Git Project" button in UI
- ✅ **Zoom in/out navigation**: View entire project OR drill into specific chapters
- ✅ **Include directives**: Automatic composition at view time

### New Architecture Benefits

1. **User Mental Model**: "I'm importing a Scrivener project" → "I now have a ChapterWise project"
2. **Flexible Viewing**: View entire manuscript OR zoom into specific chapters
3. **Git-Friendly**: Each file is separate, perfect for version control
4. **Include System**: Leverages Codex V1.2 include directives for automatic composition
5. **Scalability**: Works for small (5 chapters) and large (500 scenes) projects
6. **Future-Proof**: Can add collaborative features, exports, etc.

### Implementation Priorities

**Phase 1** (Core):
1. Create hierarchical builder (`ScrivenerToCodex.build_hierarchical()`)
2. Integrate with `ProjectService.create_project()`
3. Generate include directives at each level
4. Create `.index.codex.yaml` master file

**Phase 2** (UI):
5. Project view with file tree
6. Breadcrumb navigation
7. "View Full Project" button → opens `.index.codex.yaml`
8. "Convert to Git" button for later migration

**Phase 3** (Polish):
9. Structure preview before import
10. Option to rename project during import
11. Drag-and-drop reordering in project view
12. Export options (EPUB, PDF, etc.)

---

**Status: READY FOR IMPLEMENTATION** ✅

The plan is complete and addresses all requirements:
- ✅ Automatic project creation
- ✅ Hierarchical structure with includes
- ✅ Zoomable navigation (zoom in/out)
- ✅ Master index file
- ✅ Each level has own codex
- ✅ Git-ready structure
- ✅ Detailed logging strategy
- ✅ Clear user flow

The modular architecture allows for future enhancements while providing immediate value to users who want to migrate their Scrivener projects to ChapterWise.

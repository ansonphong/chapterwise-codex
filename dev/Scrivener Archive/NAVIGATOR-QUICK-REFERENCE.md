# Navigator System: Quick Reference Guide

**Date:** December 14, 2025  
**Purpose:** Help developers find the right plan for their task

---

## Two Complementary Plans

The ChapterWise Codex Navigator system is documented in **two separate plans**:

### 1. 📊 Data Layer Plan
**Document:** [Index Navigation - VS Code Extension.md](./Index%20Navigation%20-%20VS%20Code%20Extension.md)

### 2. 🖼️ UI Layer Plan  
**Document:** [Scrivener Style Navigator.md](./Scrivener%20Style%20Navigator.md)

---

## Which Plan Do I Need?

### Read the **Index Navigation Plan** if you're working on:

- [ ] Generating `.index.codex.yaml` files
- [ ] Parsing index files
- [ ] Scanning workspace for codex files
- [ ] Building hierarchical tree data structures
- [ ] Type detection from filenames or frontmatter
- [ ] Path computation (`_computed_path`)
- [ ] Pattern matching and file filtering
- [ ] Codex Lite frontmatter parsing
- [ ] Implementing `indexGenerator.ts`
- [ ] Implementing `indexParser.ts`
- [ ] Implementing `indexBoilerplate.ts`

**Files you'll create/modify:**
- `src/indexGenerator.ts`
- `src/indexParser.ts`
- `src/indexBoilerplate.ts`

---

### Read the **Scrivener Style Navigator Plan** if you're working on:

- [ ] Dual-tab navigation system (INDEX + FILES)
- [ ] Drag & drop functionality
- [ ] Node operations (add, delete, reorder, nest)
- [ ] Configuration system
- [ ] Visual styling and color coding
- [ ] Tab bar UI implementation
- [ ] Settings management (3-tier hierarchy)
- [ ] File organization strategies
- [ ] User interaction patterns
- [ ] Tree view enhancements
- [ ] Implementing `structureEditor.ts`
- [ ] Implementing `settingsManager.ts`
- [ ] Implementing `fileOrganizer.ts`
- [ ] Implementing `colorManager.ts`

**Files you'll create/modify:**
- `src/treeProvider.ts` (enhanced)
- `src/structureEditor.ts`
- `src/settingsManager.ts`
- `src/fileOrganizer.ts`
- `src/colorManager.ts`

---

## Implementation Flow

```
Phase 1: DATA LAYER (Weeks 1-2)
├─ Read: Index Navigation Plan
├─ Implement: indexGenerator.ts
├─ Implement: indexParser.ts
├─ Implement: indexBoilerplate.ts
└─ Test: Data generation works

Phase 2: UI LAYER (Weeks 3-4)
├─ Read: Scrivener Style Navigator Plan
├─ Implement: Enhanced treeProvider.ts
├─ Implement: structureEditor.ts
├─ Implement: settingsManager.ts
├─ Implement: Other modules
└─ Test: UI calls data layer correctly
```

---

## Quick Task Lookup

| Task | Plan to Read | Section |
|------|--------------|---------|
| Generate index from workspace | Index Navigation | "New Feature: Index Generation" |
| Create starter index file | Index Navigation | "New Feature: Boilerplate Index Creation" |
| Parse .index.codex.yaml | Index Navigation | "Index File Structure Deep Dive" |
| Understand Codex Lite format | Index Navigation | "Codex Lite Format" |
| Add INDEX/FILES tabs | Scrivener Navigator | "Dual-Tab Navigation System" |
| Implement drag & drop | Scrivener Navigator | "Core Features to Add" → #1, #2 |
| Add node operations | Scrivener Navigator | "Core Features to Add" → #4, #5 |
| Configure behavior | Scrivener Navigator | "Configuration System" |
| Visual styling | Scrivener Navigator | "Core Features" → #6, #7 |
| Settings management | Scrivener Navigator | "Settings Schema" |

---

## Common Questions

**Q: Where do I implement the INDEX tab?**  
A: Scrivener Navigator Plan → "Mode 1: INDEX Tab"  
(But INDEX tab *calls* functions from Index Navigation Plan)

**Q: How do I generate an index file?**  
A: Index Navigation Plan → "New Feature: Index Generation"

**Q: How do I add drag & drop?**  
A: Scrivener Navigator Plan → "Drag & Drop Reordering"

**Q: How do index files work?**  
A: Index Navigation Plan → "How Index Files Work"

**Q: How do I add the FILES tab?**  
A: Scrivener Navigator Plan → "Mode 2: FILES Tab"

**Q: How do I parse Codex Lite frontmatter?**  
A: Index Navigation Plan → "Codex Lite Format"

**Q: How do I implement configuration?**  
A: Scrivener Navigator Plan → "Configuration System"

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│  USER INTERACTION (Clicks, Drags, Edits)              │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────────────┐
│  UI LAYER (Scrivener Style Navigator Plan)            │
│  ┌──────────────────────────────────────────────────┐ │
│  │  treeProvider.ts (enhanced)                      │ │
│  │  ├── INDEX Tab  ← displays hierarchy            │ │
│  │  └── FILES Tab  ← displays open files           │ │
│  │                                                  │ │
│  │  structureEditor.ts    ← drag & drop, node ops │ │
│  │  settingsManager.ts    ← configuration         │ │
│  │  fileOrganizer.ts      ← file organization     │ │
│  │  colorManager.ts       ← visual styling        │ │
│  └──────────────┬───────────────────────────────────┘ │
└─────────────────┼─────────────────────────────────────┘
                  │ calls functions
                  ↓
┌────────────────────────────────────────────────────────┐
│  DATA LAYER (Index Navigation Plan)                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │  indexGenerator.ts  ← scan, build hierarchy     │ │
│  │  indexParser.ts     ← parse index files         │ │
│  │  indexBoilerplate.ts ← create starter files     │ │
│  └──────────────┬───────────────────────────────────┘ │
└─────────────────┼─────────────────────────────────────┘
                  │ reads/writes
                  ↓
┌────────────────────────────────────────────────────────┐
│  FILESYSTEM                                            │
│  ├── index.codex.yaml      (definitions)              │
│  ├── .index.codex.yaml     (generated)                │
│  ├── Chapter-01.md         (content)                  │
│  └── Characters/Aya.md     (content)                  │
└────────────────────────────────────────────────────────┘
```

---

## TL;DR

**Data problems?** → Read **Index Navigation Plan**  
**UI problems?** → Read **Scrivener Navigator Plan**  
**How they connect?** → Read **Integration Summary**

**Both plans are necessary and complementary!**





















































---
status: Living
updated_at: "2026-09-08"
---

# Domain Context — yoru-merge

## Glossary

- centre view — the middle column of the workbench: the commit list with the branch graph in History, the staged and unstaged file lists with the commit composer in Changes, the reflog list in Reflog. NOT the inspector (the column beside or below it).
- developer — the person operating YoruMerge on their own machine to read and change a Git repository; the only human actor. NOT a collaborator on the remote (someone whose commits appear in history but who is not using this app instance).
- inspector — the workbench column placed right of or below the centre view, holding the commit header, the commit file list, the diff viewer — inline in Changes, and in History only its parking slot at zero height, because a commit diff is read in the diff workspace — and any blame or file-history panels stacked beneath. NOT the refs panel. <!-- amended 2026-09-08 (owner, review round 10 O12 / round 11 O3, feature inspector-diff-workspace): the entry read as though the inspector always hosts a diff pane; true of Changes, not of History since 2026-09-07 -->
- rail — the left icon strip that switches the centre view between Changes, History, Refs, Remotes, Tags, Stashes and Reflog, with Settings at the bottom. NOT the refs panel (the rail holds one icon per view; the refs panel lists branches).
- refs panel — the collapsible sidebar listing local and remote branches, tags and stashes of the open repository. NOT the rail.
- workbench — the area under the toolbar composed of the refs panel, the centre view and the inspector, separated by persisted splitters. NOT the whole window (titlebar, toolbar and status bar sit outside it).

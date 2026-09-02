import type { Provider } from '@angular/core';
import { provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import {
  lucideArchive,
  lucideArrowDown,
  lucideArrowUp,
  lucideArrowUpDown,
  lucideBan,
  lucideBell,
  lucideCheck,
  lucideCherry,
  lucideChevronDown,
  lucideChevronLeft,
  lucideChevronRight,
  lucideChevronUp,
  lucideCircleCheck,
  lucideCircleDot,
  lucideCircleX,
  lucideClipboard,
  lucideClock,
  lucideCloudDownload,
  lucideCloudUpload,
  lucideColumns2,
  lucideCopy,
  lucideDatabase,
  lucideDownload,
  lucideEllipsisVertical,
  lucideExternalLink,
  lucideEye,
  lucideEyeOff,
  lucideFile,
  lucideFileDiff,
  lucideFileMinus,
  lucideFilePlus,
  lucideFileX,
  lucideFilter,
  lucideFolder,
  lucideFolderOpen,
  lucideFolderTree,
  lucideGitBranch,
  lucideGitBranchPlus,
  lucideGitCommitHorizontal,
  lucideGitCompareArrows,
  lucideGitFork,
  lucideGitMerge,
  lucideGitPullRequestArrow,
  lucideGlobe,
  lucideGripVertical,
  lucideHistory,
  lucideInfo,
  lucideLayers,
  lucideLink,
  lucideList,
  lucideLoaderCircle,
  lucideMaximize2,
  lucideMinimize2,
  lucideMinus,
  lucideMonitor,
  lucideMoon,
  lucideMoreHorizontal,
  lucidePackage,
  lucidePanelLeft,
  lucidePencil,
  lucidePlay,
  lucidePlus,
  lucideRefreshCw,
  lucideRotateCcw,
  lucideRows3,
  lucideScissors,
  lucideSearch,
  lucideSettings2,
  lucideShieldCheck,
  lucideSkipForward,
  lucideSpace,
  lucideSparkles,
  lucideSquare,
  lucideSun,
  lucideTag,
  lucideTags,
  lucideTerminal,
  lucideTrash2,
  lucideTriangleAlert,
  lucideUndo2,
  lucideUnlink,
  lucideUser,
  lucideWrapText,
  lucideX,
} from '@ng-icons/lucide';

/**
 * The curated Lucide set YoruMerge draws from. Nothing outside this map may be
 * rendered: the union type below is what every `icon` input in the UI kit
 * accepts, so adding an icon to the app means adding it here first.
 *
 * Git concept → icon mapping lives in ./README.md.
 */
const ICONS = {
  // Git primitives
  lucideGitBranch,
  lucideGitBranchPlus,
  lucideGitMerge,
  lucideGitCommitHorizontal,
  lucideGitCompareArrows,
  lucideGitPullRequestArrow,
  lucideGitFork,
  lucideTag,
  lucideTags,
  lucideArchive,
  lucideHistory,
  lucideUndo2,
  lucideRotateCcw,
  lucideCherry,
  lucideScissors,
  lucideLayers,
  lucidePackage,

  // Remotes & transfer
  lucideCloudDownload,
  lucideCloudUpload,
  lucideGlobe,
  lucideDownload,
  lucideRefreshCw,
  lucideLink,
  lucideUnlink,

  // Files
  lucideFile,
  lucideFileDiff,
  lucideFilePlus,
  lucideFileMinus,
  lucideFileX,
  lucideFolder,
  lucideFolderOpen,
  lucideFolderTree,
  lucideList,

  // Editing & clipboard
  lucidePencil,
  lucideTrash2,
  lucideCopy,
  lucideClipboard,
  lucidePlus,
  lucideMinus,
  lucideCheck,
  lucideX,

  // Navigation & chrome
  lucideSearch,
  lucideFilter,
  lucideSettings2,
  lucideBell,
  lucideSparkles,
  lucideTerminal,
  lucidePanelLeft,
  lucideChevronDown,
  lucideChevronRight,
  lucideChevronUp,
  lucideChevronLeft,
  lucideMoreHorizontal,
  lucideEllipsisVertical,
  lucideGripVertical,
  lucideMaximize2,
  lucideMinimize2,
  lucideSquare,
  lucideExternalLink,

  // Arrows / ahead-behind
  lucideArrowUp,
  lucideArrowDown,
  lucideArrowUpDown,

  // Theme
  lucideSun,
  lucideMoon,
  lucideMonitor,

  // Status & feedback
  lucideCircleDot,
  lucideLoaderCircle,
  lucideTriangleAlert,
  lucideInfo,
  lucideCircleCheck,
  lucideCircleX,
  lucideBan,
  lucideClock,

  // Sequencer
  lucidePlay,
  lucideSkipForward,

  // Identity & security
  lucideUser,
  lucideShieldCheck,

  // Diff / view options
  lucideEye,
  lucideEyeOff,
  lucideWrapText,
  lucideSpace,
  lucideColumns2,
  lucideRows3,

  // Misc
  lucideDatabase,
};

/** Every icon name the app is allowed to render. */
export type YoruIconName = keyof typeof ICONS;

/** Name → SVG map handed to `provideIcons`. */
export const YORU_ICONS: Record<YoruIconName, string> = ICONS;

/**
 * Registers the whole curated set plus the Yoru defaults (16 px, stroke 1.75).
 * Add to the application providers once; component-level `provideIcons` calls
 * merge on top of it rather than replacing it.
 */
export function provideYoruIcons(): Provider[] {
  return [
    provideIcons(YORU_ICONS),
    provideNgIconsConfig({ size: '16px', strokeWidth: '1.75' }),
  ];
}

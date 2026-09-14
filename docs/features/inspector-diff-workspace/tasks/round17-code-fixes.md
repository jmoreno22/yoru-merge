---
id: T68
title: "Round-17 code fixes: the guard's closed form, and the three counts certified against the wrong one"
layer: "domain"
deps: ["T67"]
acs: ["AC-01", "AC-02", "AC-03", "AC-18"]
files_hint: [
  "src/app/core/services/inspector-layout.spec.ts"
]
owner: "Jhoan Moreno"
estimate: "S"
status: "done"
---

# T68 — Round-17 code fixes

## Why

**R17-F1** (`_review/review-2026-09-10-round17.md`) — reached independently by stage 1, stage 2 and
the lead.

`inspector-layout.spec.ts:663` states the predicate for **the head-cap guard binding** as:

```
//   expanded    r < 2 * (panelHeadH + 2 * fileRowH)
//   collapsed   r < 4 * panelHeadH
```

The guard binds iff `remainder − protectedList < panelHeadH`, and in the row-floor regime
`protectedList = panelHeadH + 2·fileRowH`, so the boundary is **`2·panelHeadH + 2·fileRowH`** — a sum,
not a doubled sum. That is what `spec.md:198` (AC-18's marker) gives, what T63's own Outcome table
gives, and what `:666-667`'s own prose derives two lines below the wrong form.

Measured over the identical grid the comment cites as its evidence (21 reachable density × `uiFontSize`
pairs × `r = 1…1200` step 0.25 × 2 collapse states = **201 474 points**), against the guard's real
condition:

| form | mismatches |
|---|---|
| `2 * panelHeadH + 2 * fileRowH` expanded / `4 * panelHeadH` collapsed | **0** |
| `2 * (panelHeadH + 2 * fileRowH)` expanded / `4 * panelHeadH` collapsed — what `:663` says | **5312** |

Three adjacent claims fall with it:

- `:668` «Also **0 mismatches** over the same 201 474 points» — is **5312**.
- `:669` «the expanded halves disagree at **5312** of them» — is **10 624** with the form as written.
- `:670` «**0.6091 to 0.6909** against a 0.50 floor» — is really ≈ **0.50 … 0.74**.

At comfortable / 13 px the written form claims the guard binds to `r = 188`; it stops at **127.75**.
Witness: at `r = 130` the allowance is 36 and the cap is **36 > panelHeadH 34** — the guard does not
bind, while `:663` says it does. Same at 150 (cap 56) and 187 (cap 93).

**Why it matters, not just that it is wrong.** `spec.md:198` and the policy's own spec file now
disagree by `2 × fileRowH` — 60 px at comfortable — and nothing in the tree says which is shipped
truth. A maintainer trusting the code comment (the more authoritative-looking of the two, sitting
beside the loop) treats `r = 128…188` expanded as inside the carve-out. It is not: the guard does not
bind there and the ratio is the only thing holding the list's half, so a share regression in that
window gets dismissed as «inside the band».

## Plan

1. Correct `:663` to `r < 2 * panelHeadH + 2 * fileRowH`.
2. Re-measure and rewrite `:668`, `:669` and `:670` **from the corrected form**, not from the
   round-16 numbers. Each must be a measurement this task made.
3. Prefer a form the next reader cannot mis-parenthesise: state it as
   `2 * panelHeadH + 2 * fileRowH` and, beside it, the reason the row term is there
   (`protectedList` is `panelHeadH + 2 * fileRowH` throughout the row-floor regime, so the boundary
   carries it once, not twice).

## Definition of Done

- [ ] **`:686-687` are NOT touched.** Their bounds `h < 2 * (panelHeadH + 2 * fileRowH)` expanded and
      `h < 4 * (panelHeadH + 2 * fileRowH)` collapsed are **correct** — they are a different
      predicate (`panelHeadH + 2·fileRowH > (1 − floor) · h`), verified correct by stage 2 and by the
      lead. Confirm by measurement that they are still correct after this task, and say so.
- [ ] The corrected form measures **0 mismatches** against the guard's real condition over the same
      201 474 points. Paste the sweep's own output, including the grid it swept.
- [ ] `:668`, `:669`, `:670` each state a number this task measured. Paste each measurement.
- [ ] The share-yield form at `:652-653` (`2 * panelHeadH` expanded / `4 * panelHeadH` collapsed) is
      re-verified as **0 mismatches** and left unchanged — it was right and stays right.
- [ ] `spec.md:198`'s guard band and this file now state the **same** form. Verify by extracting both
      and comparing, not by reading.
- [ ] **No production change.** `md5sum src/app/core/services/inspector-layout.ts` is
      `f10fa099c0981638022f412395001db6` and `appearance-metrics.ts` is
      `f50d48f3108168abaf083311f6815eba` before and after.
- [ ] Gate: `pnpm test` 842/842 (this is a comment-only change; the count must not move),
      `pnpm lint` clean, `pnpm check:figures` exit 0.
- [ ] Any DoD bullet that cannot be satisfied as written is named in the Outcome with the reason.

## Notes

This is a comment-only change to a spec file, so there is no RED step to observe: nothing executes
the comment. The **verification is the sweep**, and the sweep is what must be pasted. Say that
plainly in the Outcome rather than presenting a red-then-green cycle that did not happen — the
round-16 T64 lesson.

**Do not "simplify" the surrounding block.** T64's rewritten comments are correct everywhere except
`:663`: the twin's per-density table, the compact-420 derivation, the «binds both hard floors»
arithmetic, the 400/200 row, the `4·(ph+2fr)/3` collapsed row-floor bound, the `h = 130` worked
example and the deleted-predicate bounds were all re-derived and hold. Touch `:663` and the three
counts that depend on it, nothing else.
## Outcome (2026-09-10)

Landed. **One file changed, `src/app/core/services/inspector-layout.spec.ts`, comments only** — no
executable line moved. All five production md5s are the values they had on entry:

```
f10fa099c0981638022f412395001db6  inspector-layout.ts
f50d48f3108168abaf083311f6815eba  appearance-metrics.ts
44f017a4c415d7a1c001f7e0362d6a9c  commit-inspector.ts
720244ba837d5fa7229ea935bb6d4704  main-content.ts
d1fbdf2ef79301507843b0053f8b6586  main-content.html
```

**There is no RED here, and that is stated rather than dressed up.** Nothing executes a comment, so a
mutation cannot redden this change and a red-then-green cycle would be fiction. **The verification is
the sweep**, and the sweep output is pasted below in full — that is this task's only evidence.

**The measurement harness.** Two throwaway ESM scripts outside the repo (`C:\wt\reports-r17\tmp`)
import the **shipped** modules with `node --experimental-strip-types`, so every figure below comes
from `computeMetrics` and `computeInspectorLayout` as they stand in this tree — not from a
reimplementation, and not copied from a task file, a review record or the comment being repaired. The
grid is the one the comment cites as its evidence, and the script prints the point count it actually
visited: `uiFontSize` 11…17 (`MIN_UI_FONT_SIZE` / `MAX_UI_FONT_SIZE`, `preferences-schema.ts:234-235`)
× the three `DENSITIES` = **21** reachable pairs, `r = 1…1200` step `0.25` (**4797** values), × **2**
collapse states = **201 474** points.

```
GRID — 21 reachable (density, uiFontSize) pairs, uiFontSize 11..17 (MIN/MAX_UI_FONT_SIZE):
  comfortable ui=11  panelHeadH=32  fileRowH=28
  comfortable ui=12  panelHeadH=33  fileRowH=29
  comfortable ui=13  panelHeadH=34  fileRowH=30
  comfortable ui=14  panelHeadH=35  fileRowH=31
  comfortable ui=15  panelHeadH=36  fileRowH=32
  comfortable ui=16  panelHeadH=37  fileRowH=33
  comfortable ui=17  panelHeadH=39  fileRowH=35
  compact     ui=11  panelHeadH=24  fileRowH=22
  compact     ui=12  panelHeadH=25  fileRowH=23
  compact     ui=13  panelHeadH=26  fileRowH=24
  compact     ui=14  panelHeadH=28  fileRowH=25
  compact     ui=15  panelHeadH=29  fileRowH=26
  compact     ui=16  panelHeadH=30  fileRowH=27
  compact     ui=17  panelHeadH=31  fileRowH=29
  relaxed     ui=11  panelHeadH=41  fileRowH=35
  relaxed     ui=12  panelHeadH=42  fileRowH=36
  relaxed     ui=13  panelHeadH=43  fileRowH=37
  relaxed     ui=14  panelHeadH=45  fileRowH=39
  relaxed     ui=15  panelHeadH=46  fileRowH=40
  relaxed     ui=16  panelHeadH=47  fileRowH=41
  relaxed     ui=17  panelHeadH=48  fileRowH=42
  x r = 1..1200 step 0.25 (4797 values) x 2 collapse states = 201474 points

MISMATCHES
  A  correct guard   : expanded r < 2*ph + 2*fr   | collapsed r < 4*ph
      vs GUARD BINDING 0   vs SHARE YIELDING 5312
  B  :663 as written : expanded r < 2*(ph + 2*fr) | collapsed r < 4*ph
      vs GUARD BINDING 5312   vs SHARE YIELDING 10624
  C  :652-653 yield  : expanded r < 2*ph          | collapsed r < 4*ph
      vs GUARD BINDING 5312   vs SHARE YIELDING 0

A vs B disagree at 5312 points (all expanded: 5312)
guard binds AND share met: listShare in [0.500000 .. 0.741127]
   min at comfortable/ui=11 r=64 collapsed=false   max at compact/ui=17 r=119.75 collapsed=false
```

The two predicates the sweep measures are the policy's own, not restatements of the comment: **GUARD
BINDING** is `remainder - Math.max(panelHeadH + 2 * fileRowH, shareFloor) < panelHeadH`, i.e. the
`Math.max(headerAllowance, panelHeadH)` picking the head; **SHARE YIELDING** calls
`computeInspectorLayout` and asks whether `(r - headerMaxH) / r` falls under the density's floor.

**`:663` corrected: `r < 2 * panelHeadH + 2 * fileRowH`, 0 mismatches (row A).** The form as written,
`2 * (panelHeadH + 2 * fileRowH)`, mismatches at **5312** (row B) — the finding reproduces exactly.
The comment now also says *why* the sum and not the product, in the terms the next reader needs: the
row term is carried **once**, added to the head the guard itself needs, because `protectedList` is
`panelHeadH + 2 * fileRowH` throughout the row-floor regime.

Witness at the comfortable / 13 px pair the finding names, re-derived here: the corrected band is
`2 × 34 + 2 × 30 = 128`, so the guard's last binding remainder on the grid is **127.75**. At
`r = 130` the allowance is `130 − max(34 + 60, 65) = 36 > panelHeadH 34` — the guard does **not**
bind, while the shipped form claimed it did all the way to 188.

**`:668` re-measured: 0.** «Also 0 mismatches over the same 201 474 points» is now true of the form
beside it — row A, `vs GUARD BINDING 0`. It was **5312** for the form the wave shipped.

**`:669` re-measured: 5312.** «The expanded halves disagree at 5312 of them; the collapsed halves
coincide» is the share-yield form (C) against the guard form. Against the **corrected** guard form
that is row C's `vs GUARD BINDING 5312` — and the split is all-expanded by construction, because both
collapsed halves are the byte-identical expression `4 * panelHeadH`, which cannot disagree with
itself. Against the form as written it would have been **10 624** (row B, `vs SHARE YIELDING`), so
`:669`'s figure becomes correct only *because* `:663` was fixed.

**`:670` re-measured, and rewritten as a form rather than as the new pair of numbers.** The measured
range is `[0.500000 .. 0.741127]`, against the shipped claim of «0.6091 to 0.6909». Those two were not
the band's endpoints at all: they are the **comfortable** and **relaxed** shares at the single 110 px
remainder (`1 − 34/110` and `1 − 43/110`), read as if they bounded the whole region.

Rather than swap two false figures for two fresh ones, the region is now stated in closed form,
because the region has one:

```
guard binds  =>  headerMaxH = floor(max(allowance, panelHeadH)) = panelHeadH   (panelHeadH integral)
             =>  listShare  = 1 - panelHeadH / r
share met    =>  1 - panelHeadH / r >= 1/2   <=>   r >= 2 * panelHeadH
band top     =>  r < 2 * panelHeadH + 2 * fileRowH
             =>  listShare < (panelHeadH + 2 * fileRowH) / (2 * panelHeadH + 2 * fileRowH)
```

Verified over the same 201 474 points, second script:

```
--- :670 closed form  share = 1 - panelHeadH / r  over {guard binds AND share met} ---
  region size: 5312  below-floor violations: 0  at-floor exactly: 21
  violations of the strict upper bound (panelHeadH + 2*fileRowH)/(2*panelHeadH + 2*fileRowH): 0
  observed supremum: 0.741127 at compact/ui=17 r=119.75 collapsed=false sup-form=0.741667
```

Three things fall out of that run and are worth recording. The region is **exactly the 5312 points**
where the two guard forms disagree — the same set, which is the arithmetic reason `:663`'s error and
`:670`'s error were one error. The lower bound is **attained**, once per token pair (21 hits at
`share == floor` exactly, at `r = 2 * panelHeadH`), so «starts AT the ratio floor» is measured, not
inferred. The upper bound is **strict and never violated**, and the observed supremum 0.741127 sits
just under the form's 0.741667 at compact / 17 px.

**`:652-653` re-verified and left untouched.** The share-yield form `2 * panelHeadH` expanded /
`4 * panelHeadH` collapsed is row C: **0 mismatches vs SHARE YIELDING**. It was right and it stays
right, byte-identical.

**`:686-687` NOT touched, and re-verified correct.** The deleted-predicate bounds moved to `:696-697`
only because the corrected paragraph is eleven lines longer; the two lines are byte-identical. Their
predicate is a different one — `panelHeadH + 2 * fileRowH > (1 − floor) * h`, which rearranges to
`h < 2 * (panelHeadH + 2 * fileRowH)` expanded and `h < 4 * (panelHeadH + 2 * fileRowH)` collapsed —
and the doubled form there is exact:

```
--- :686-687 deleted predicate  panelHeadH + 2*fileRowH > (1 - floor) * h ---
  mismatches vs h < 2*(ph+2fr) expanded / h < 4*(ph+2fr) collapsed: 0
```

So the tree now carries the doubled form and the sum eleven lines apart, both correct, for two
different predicates. That is exactly the trap this task was warned about, and the comment at `:663`
now names the parenthesisation explicitly so the two cannot be "reconciled" by a future reader.

**`spec.md:198` and this file state the same form — verified mechanically, not by reading.** A script
extracts the band from `spec.md`'s line 198 with `it binds for (.+?) expanded .*?and (.+?) collapsed`,
extracts `:663` / `:664` from the spec file, normalises `×`/`*` and whitespace, and compares:

```
spec.md:198   expanded  = 'r < 2 * panelHeadH + 2 * fileRowH'
  code :663   expanded  = 'r < 2 * panelHeadH + 2 * fileRowH'
spec.md:198   collapsed = 'r < 4 * panelHeadH'
  code :664   collapsed = 'r < 4 * panelHeadH'
EXPANDED IDENTICAL : True
COLLAPSED IDENTICAL: True
```

The `2 × fileRowH` disagreement R17-F1 predicted the next reviewer would find — 60 px at
comfortable / 13 px — is closed.

**Gate.**

- `pnpm test` → **842 passed (842), 63 files**. Unmoved, as a comment-only change must be.
- `pnpm lint` (biome) → **clean, 266 files, no fixes applied**. No formatter was run over the tree.
- `pnpm check:figures` → exit **0**. On the tree this wave delivered the run prints
  `figures: 23 markers in 3 file(s), 10 distinct claims, 45 values recomputed` and
  `coverage: 36 figure(s) the heuristic can see in live prose, 15 of them on a line carrying fewer
  markers than figures` — there is no `unmarked` line.
<!-- superseded output, dated 2026-09-13 (T78, review round 19 R19-F7): no commit in this
repository prints these figures. Measured at `2db0519`, the single commit that carries T40–T74:
`figures: 2 markers in 1 file(s), 2 distinct claims, 6 values recomputed` and `coverage: 1 … 1`,
because T73's D3 migration retired 21 of the 23 markers inside the same uncommitted tree. Kept as
the dated record it is; `round19-records.md` says why a one-commit wave cannot speak of «the tree
this wave delivered» -->
<!-- gate bullet restated 2026-09-10 (T74, review round 18 R18-F7): this read «`23 markers, 45 values
checked, 1 unmarked` — `DESIGN.md:73`, the known heuristic false positive». Exit 0 was and is true; the
parenthetical was not. `1 unmarked` is the exact figure **R17-F8** named as false — it counted 45 VALUES
against 1 LINE and exempted a marker-carrying line entirely — and **T70 deleted that output line in the
same wave this bullet was written in**, replacing it with the defined coverage pair. So the bullet quoted
a gate output the tree it delivered could not produce, which is R17-F12's class one round later. The
figures above are what the command printed on the tree this wave left. -->
- **The Rust half was skipped deliberately**: `src-tauri` is byte-identical to the base across the
  whole branch and this task touches one TypeScript comment block, so `cargo` could not observe it.
  T71 measures it once at the end of the wave.

**DoD bullets that could not be satisfied as written: one, named.**

1. «`:668`, `:669`, `:670` each state a number this task measured.» Satisfied for `:668` (**0**) and
   `:669` (**5312**), both re-derived above. **Not satisfied as written for `:670`**, deliberately:
   owner decision **D3** (test plan conventions, 2026-09-10) forbids a live artefact writing a figure
   derived from `computeMetrics` or the layout policy, and allows a test's *assertion* to carry one but
   not a *comment* beside it. `0.500000 … 0.741127` is exactly that class of figure — density- and
   font-keyed, and the reason the shipped 0.6091 / 0.6909 went stale in the first place — and the same
   comment block declares three paragraphs above that «every bound below is a CLOSED FORM in the
   tokens, never a per-density figure». Writing the new pair in would have satisfied the bullet by
   re-committing the defect. `:670` therefore carries the closed form; **the measured range is stated
   here**, in the Outcome, which is where a derived figure is allowed to live. Flagged rather than
   silently reinterpreted.

**Scope note.** Nothing else in `:640-694` was touched — the twin's per-density table, the compact-420
derivation, the «binds both hard floors» arithmetic, the 400/200 row, the `4·(ph+2fr)/3` collapsed
row-floor bound, the `h = 130` worked example, the share-yield form and the deleted-predicate bounds
are all byte-identical. The whole change is the one `:663` line plus the paragraph at `:666-680` that
explains and bounds it.

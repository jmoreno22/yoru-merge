# Packaging and distribution

How a release reaches users, and the one-time setup each channel needs.

| Channel | Workflow | Set up once |
| --- | --- | --- |
| GitHub Releases | `release.yml` | — |
| Linux one-line installer | `pages.yml` | enable GitHub Pages |
| WinGet | `winget.yml` | a `winget-pkgs` fork, the first manifest, a PAT |

## What each workflow publishes

| Workflow | Runs on | What comes out |
| --- | --- | --- |
| `release.yml` | a `v*` tag | a **draft** GitHub Release: every bundle, a `.sig` beside each one, and `latest.json` |
| `pages.yml` | pushes to `main` touching `install.sh` | `install.sh` and a one-page site on GitHub Pages |
| `winget.yml` | `release: published` | nothing of its own — a pull request in `microsoft/winget-pkgs` pointing at the `.exe` already in the release |
| `ci.yml` | pushes and pull requests | nothing. `bundle-smoke` builds with `src-tauri/ci-smoke.conf.json`, which turns `createUpdaterArtifacts` off so the job needs no signing key, then discards the bundle |

`bundle.targets` is `"all"`, so `tauri-action` produces five installers across the
two runners. The v1.0.3 release, exactly as published:

```
latest.json
YoruMerge_1.0.3_x64-setup.exe     YoruMerge_1.0.3_x64-setup.exe.sig
YoruMerge_1.0.3_x64_en-US.msi     YoruMerge_1.0.3_x64_en-US.msi.sig
YoruMerge_1.0.3_amd64.deb         YoruMerge_1.0.3_amd64.deb.sig
YoruMerge-1.0.3-1.x86_64.rpm      YoruMerge-1.0.3-1.x86_64.rpm.sig
YoruMerge_1.0.3_amd64.AppImage    YoruMerge_1.0.3_amd64.AppImage.sig
```

The `.exe` is the NSIS installer and the `.msi` the WiX one — the same
application twice, which is why `winget.yml` narrows `installers-regex` to the
NSIS one. `latest.json` is what the in-app updater reads (`includeUpdaterJson`),
and `updaterJsonPreferNsis` points its `windows-x86_64` entry at the `.exe`
rather than the `.msi`.

`release.yml` marks the release a draft, so none of it is reachable — including
the updater's `releases/latest/download/latest.json` endpoint — until someone
publishes it by hand.

## Signing

### Where the key lives

One minisign key signs the release. The private half is the
`TAURI_SIGNING_PRIVATE_KEY` repository secret; `release.yml` hands it to
`tauri-action`, which signs every bundle it produces — those are the `.sig`
files.

The public half is `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`,
base64-encoded. Decoded, it is an ordinary minisign public key file:

```
untrusted comment: minisign public key: EB277F3E28D1D3F3
RWTz09EoPn8n674gYQhxyA1W0EkM0cKhs3yw6gqdaF+yS9e/hlwOQEfJ
```

That key is compiled into every build, and `install.sh` carries the same line.

**Losing the private key is not recoverable.** An installed copy accepts only
updates signed by the key it was built with, so a replacement key means a build
carrying a new `pubkey` — which no existing install will accept *as an update*.
Everyone already running YoruMerge would have to reinstall by hand. Keep an
offline copy.

### What is signed, and what is not

There are three states here, not two: signed *and* checked for you, signed but
checked by nobody during installation, and no platform signature at all.

| Artifact | `.sig` published | Checked while installing | Platform signature |
| --- | --- | --- | --- |
| `.AppImage` | yes | **yes** — `install.sh` verifies it, and refuses to run at all without `minisign` | **no** — the `.sha256_sig` and `.sig_key` sections exist but are all zeroes |
| `.deb` | yes | **no** — `apt` has no idea the file exists, and `install.sh` does not check it either | **no** — no `_gpgorigin` member; `apt` installs it as a local file and never asks for one either |
| `.rpm` | yes | **no** — same; `dnf` and `zypper` take the package as unsigned | **no** — Tauri does not sign its RPMs. The signature header holds a SHA-256 digest and no GPG key |
| `.exe` (NSIS) | yes | only on an in-app update, where the updater checks it against the baked-in `pubkey`. Downloaded from the release page by hand, nobody checks it | **no** — no Authenticode certificate, so SmartScreen warns on first run |
| `.msi` (WiX) | yes | same | **no** — same |
| `latest.json` | none of its own — it *carries* the bundles' signatures | — | — |

**The `.deb` and `.rpm` gap is open.** Both ship a valid signature that nothing
verifies: the package managers do not know it exists, and `install.sh` hands
them the package without looking at it. Closing it would make `minisign` a hard
requirement for every Linux install rather than only the AppImage fallback,
which is a call the owner has not made. Until then, that signature is there to
be checked by hand — see below.

Authenticode is external work rather than a code change: Azure Trusted Signing,
or SignPath, which issues certificates to open-source projects. Neither is set
up and no date is committed to; until one is, expect the SmartScreen prompt.

### Verifying an artifact by hand

The release publishes no checksum file, so there is no `sha256sum` step to run —
the `.sig` beside each artifact is the check. (GitHub's API reports a `sha256`
digest per asset, but the host serving the file is the one computing it: that
catches a truncated download, not a tampered release.)

Tauri writes the signature base64-encoded, the way its updater reads it, and
minisign will not parse that. Decode it first:

```bash
v=1.0.3
f=YoruMerge_${v}_amd64.deb
base=https://github.com/jmoreno22/yoru-merge/releases/download/v$v

curl -fsSLO "$base/$f"
curl -fsSL "$base/$f.sig" | base64 -d >"$f.minisig"

minisign -Vm "$f" -P 'RWTz09EoPn8n674gYQhxyA1W0EkM0cKhs3yw6gqdaF+yS9e/hlwOQEfJ'
```

```
Signature and comment signature verified
Trusted comment: timestamp:1788299542	file:YoruMerge_1.0.3_amd64.deb
```

Read that last line — it names the file the signature was made for. The same
three commands verify any other asset: swap `$f`. minisign looks for
`<file>.minisig` beside the file, so pass `-x <path>` if it lives elsewhere.

`install.sh` runs exactly this on the AppImage, which is why that path needs
`minisign` on `PATH`: it aborts with an instruction if the tool is missing,
before spending the 80 MB rather than after.

## The Linux installer

`install.sh` asks the GitHub API for the latest release, downloads the package
that matches the distribution — `.deb`, `.rpm`, or the AppImage as a fallback —
and installs it with the system package manager. Re-running it updates.

The AppImage path needs `minisign` on `PATH` and says so before downloading
anything: it is the one path that verifies what it downloaded, and it aborts
rather than skip the check. The `.deb` and `.rpm` paths need nothing beyond the
package manager, and verify nothing.

`pages.yml` publishes that one file (plus a small landing page) to GitHub Pages
on every push to `main` that touches it, so the documented URL is stable:

```
curl -fsSL https://jmoreno22.github.io/yoru-merge/install.sh | sh
```

### Set up

*Settings → Pages → Source: **GitHub Actions***. Not "Deploy from a branch" —
the workflow uploads the site as an artifact. Then push to `main`, or run
*Actions → Pages → Run workflow*, and check:

```bash
curl -fsSL https://jmoreno22.github.io/yoru-merge/install.sh | head -1
```

That is the whole setup: no keys, no secrets, nothing to renew.

### Why there is no apt/dnf repository (yet)

A signed package repository would make `apt upgrade` carry new versions on its
own. It also means owning a GPG key forever: every machine that installs pins
it, so losing it makes `apt update` fail there until the user re-adds the key.

The asymmetry decides it. Going from this installer *to* a repository is
painless — whoever runs the script next lands on the repository without
noticing. Going the other way strands people with a `sources.list` entry
pointing at something dead. So: start here, add the repository when enough
people are running it to care about automatic updates.

If that day comes, the pieces are a `dpkg-scanpackages` + `apt-ftparchive`
index and a `createrepo_c` one, both signed with a key kept in
`REPO_GPG_PRIVATE_KEY`, published under `deb/` and `rpm/` on the same Pages
site, with `install.sh` registering the repository instead of downloading a
package.

## WinGet

**1. Fork `microsoft/winget-pkgs`** into the `jmoreno22` account. The action
opens its pull requests from that fork.

**2. Submit the first manifest by hand**, on Windows — the action refuses to
run for an identifier that does not exist yet. Any published release works;
later ones are picked up automatically:

```powershell
winget install wingetcreate
wingetcreate new https://github.com/jmoreno22/yoru-merge/releases/download/v1.0.2/YoruMerge_1.0.2_x64-setup.exe
```

Answer `jmoreno22.YoruMerge` for the identifier and keep `Scope: user` — the
NSIS installer is a per-user install. Then `wingetcreate submit`.

**3. Create the token.** A *classic* PAT with the `public_repo` scope (the
default `GITHUB_TOKEN` cannot fork and open a pull request in another
repository), stored as the `WINGET_TOKEN` secret.

Note what that scope buys: `public_repo` is account-wide, so the token can write
to every public repository the account owns, not only the `winget-pkgs` fork.
Nothing narrower is wired up today — treat it as a credential with a rotation
date rather than one to set and forget.

Once that first pull request is merged, every published release opens the next
one automatically, and `winget install jmoreno22.YoruMerge` works.

`winget.yml` triggers on `release: published`, **not** on the tag push, because
`release.yml` creates the release as a draft: a tag-triggered job would submit a
manifest pointing at assets nobody can download yet.

## Testing the installer

`install.sh` needs nothing but a container and network access, since it reads
the real GitHub releases:

```bash
docker run --rm -v "$PWD:/w" ubuntu:22.04 sh -c \
  'apt-get update -qq >/dev/null && apt-get install -y -qq curl ca-certificates >/dev/null && sh /w/install.sh'

docker run --rm -v "$PWD:/w" fedora:41 sh /w/install.sh
```

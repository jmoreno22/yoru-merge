# Packaging and distribution

How a release reaches users, and the one-time setup each channel needs.

| Channel | Workflow | Set up once |
| --- | --- | --- |
| GitHub Releases | `release.yml` | — |
| Linux one-line installer | `pages.yml` | enable GitHub Pages |
| WinGet | `winget.yml` | a `winget-pkgs` fork, the first manifest, a PAT |

## The Linux installer

`install.sh` asks the GitHub API for the latest release, downloads the package
that matches the distribution — `.deb`, `.rpm`, or the AppImage as a fallback —
and installs it with the system package manager. Re-running it updates.

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

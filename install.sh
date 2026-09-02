#!/bin/sh
# YoruMerge installer.
#
# Downloads the package for this distribution from the latest GitHub release
# and installs it. Re-run it to update.
#
#   curl -fsSL https://jmoreno22.github.io/yoru-merge/install.sh | sh

set -eu

GH_REPO="jmoreno22/yoru-merge"
# The key the release is signed with, from src-tauri/tauri.conf.json
# (plugins.updater.pubkey, base64-decoded: minisign key EB277F3E28D1D3F3).
MINISIGN_PUBKEY="RWTz09EoPn8n674gYQhxyA1W0EkM0cKhs3yw6gqdaF+yS9e/hlwOQEfJ"

info() { echo "==> $*"; }
warn() { echo "warning: $*" >&2; }
die() { echo "error: $*" >&2; exit 1; }

# curl on desktops, wget on minimal server images.
if command -v curl >/dev/null 2>&1; then
	fetch() { curl -fsSL "$1"; }
	download() { curl -fsSL -o "$2" "$1"; }
elif command -v wget >/dev/null 2>&1; then
	fetch() { wget -qO- "$1"; }
	download() { wget -qO "$2" "$1"; }
else
	die "neither curl nor wget is available"
fi

[ "$(uname -s)" = "Linux" ] || die "this script installs the Linux build; see https://github.com/$GH_REPO for Windows"
case "$(uname -m)" in
x86_64 | amd64) ;;
*) die "only x86_64 is published today (this machine is $(uname -m))" ;;
esac

if [ "$(id -u)" -eq 0 ]; then
	SUDO=""
elif command -v sudo >/dev/null 2>&1; then
	SUDO="sudo"
else
	die "run this as root, or install sudo"
fi

tag="$(fetch "https://api.github.com/repos/$GH_REPO/releases/latest" |
	sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)"
[ -n "$tag" ] || die "could not read the latest release tag from the GitHub API"
version="${tag#v}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Sets $asset to the downloaded file rather than echoing it: the progress
# message and the path would otherwise share stdout.
get() { # get <asset-name>
	asset="$tmp/$1"
	info "Downloading $1 ($tag)"
	download "https://github.com/$GH_REPO/releases/download/$tag/$1" "$asset"
}

install_appimage() {
	# Checked before the 80 MB download: without it the AppImage cannot be trusted.
	command -v minisign >/dev/null 2>&1 ||
		die "minisign is needed to verify the AppImage; install it (apt install minisign, dnf install minisign) and run this again"

	get "YoruMerge_${version}_amd64.AppImage"
	image="$asset"
	get "YoruMerge_${version}_amd64.AppImage.sig"
	# Tauri publishes the minisign signature base64-encoded, as its updater reads it.
	base64 -d "$asset" >"$asset.minisig" || die "could not decode the signature"
	minisign -V -P "$MINISIGN_PUBKEY" -x "$asset.minisig" -m "$image" ||
		die "the AppImage does not match its signature; not installing it"

	target="$HOME/.local/bin/YoruMerge.AppImage"
	mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications"
	cp "$image" "$target"
	chmod +x "$target"

	cat >"$HOME/.local/share/applications/YoruMerge.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=YoruMerge
Comment=A fast, keyboard-friendly Git GUI
Exec=$target
Icon=yoru-merge
Categories=Development;RevisionControl;
Terminal=false
EOF

	# The AppImage mounts itself through FUSE, which Ubuntu 22.04+ no longer
	# ships by default.
	ldconfig -p 2>/dev/null | grep -q libfuse.so.2 ||
		warn "the AppImage needs FUSE 2 — on Ubuntu run: sudo apt install libfuse2"
	case ":$PATH:" in
	*":$HOME/.local/bin:"*) ;;
	*) warn "$HOME/.local/bin is not on PATH; launch it from your app menu or by full path" ;;
	esac
	info "Installed at $target"
}

if command -v apt-get >/dev/null 2>&1; then
	get "YoruMerge_${version}_amd64.deb"
	# Resolving the package's dependencies needs current lists.
	$SUDO apt-get update || warn "apt-get update failed; trying with the existing package lists"
	$SUDO apt-get install -y "$asset"
elif command -v dnf >/dev/null 2>&1; then
	get "YoruMerge-${version}-1.x86_64.rpm"
	$SUDO dnf install -y "$asset"
elif command -v zypper >/dev/null 2>&1; then
	# Tauri does not sign its RPMs, so there is no key to import: HTTPS to the
	# release is the whole integrity story here, as it is for apt and dnf above.
	get "YoruMerge-${version}-1.x86_64.rpm"
	$SUDO zypper --non-interactive install --allow-unsigned-rpm "$asset"
else
	install_appimage
fi

# YoruMerge drives the system git; the packages depend on it, the AppImage cannot.
command -v git >/dev/null 2>&1 ||
	warn "git was not found on PATH — YoruMerge needs git 2.25 or newer to do anything"

info "YoruMerge $tag installed. Launch it from your app menu, or run: yoru-merge"

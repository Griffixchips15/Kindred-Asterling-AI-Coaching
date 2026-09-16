#!/usr/bin/env bash
set -euo pipefail

for cmd in curl gpg lsb_release apt-get; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Missing required command: $cmd" >&2
    exit 1
  }
done

if [[ $(id -u) -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

codename="$(lsb_release -cs)"
keyring="/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg"

if [[ ! -s "$keyring" ]]; then
  curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg \
    | "${SUDO[@]}" gpg --yes --dearmor --output "$keyring"
fi

sources="/etc/apt/sources.list.d/cloudflare-client.list"
line="deb [signed-by=${keyring}] https://pkg.cloudflareclient.com/ ${codename} main"

if [[ ! -f "$sources" ]] || ! grep -qxF "$line" "$sources"; then
  echo "$line" | "${SUDO[@]}" tee "$sources" >/dev/null
fi

"${SUDO[@]}" apt-get update -qq

package="${WARP_PACKAGE:-cloudflare-warp}"
if ! dpkg -s "$package" >/dev/null 2>&1; then
  "${SUDO[@]}" apt-get install -y "$package"
fi

warp-cli --version
echo "Cloudflare WARP repo configured and '$package' installed."
echo "Next: run 'warp-cli registration new' to enroll this device."

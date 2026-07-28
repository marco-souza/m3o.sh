# Carry inline OS detection; let Post-install own Helpers

The Dotfiles repo is private, so `useful-functions.sh` cannot be loaded until the SSH key is in place and 1Password is signed in — which happen late in the flow (steps 7-8). Yet `detect_os` and the Manjaro-vs-other-Linux check are needed at the very first step to branch package-manager bootstrap.

We keep the bootstrapper a single self-contained file: it carries its own inline `detect_os` (3 lines, identical logic to the Helper) plus a `/etc/os-release` Manjaro check at the top. The bootstrapper never sources `useful-functions.sh` directly — it only runs `bash <post-install>.sh`, which loads Helpers for its own use. This avoids the file's top-level `brew upgrade`/`yay -Syu` side effects firing on every source (which would break the idempotent re-run goal) and keeps the bootstrapper honest about its dependencies.

The reuse guarantee (C5) is honored as "Post-install reuses Helpers; the bootstrapper pre-clone steps are self-contained." The small `detect_os` duplication is accepted as the price of single-file distribution (C1) and a private repo.

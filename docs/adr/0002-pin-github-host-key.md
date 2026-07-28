# Pin GitHub's published host key in known_hosts

Under `curl | sh` there is no TTY, so the first `git clone` over SSH would hit "Host key verification failed" because ssh cannot prompt to accept GitHub's host key. The alternatives — `ssh-keyscan github.com` or `StrictHostKeyChecking=accept-new` — both blindly trust whatever the network returns, which a reader auditing `curl | sh` would (rightly) flag as a trust-on-first-use hole.

We bake GitHub's officially published ed25519 host key (`AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl`) into the bootstrapper and append it to `~/.ssh/known_hosts` before the clone, only if not already present. It is MITM-proof and verifiable against docs.github.com by any reader before piping. The trade-off is freshness: if GitHub rotates the key, the bootstrapper breaks and needs an update — an acceptable, low-frequency event GitHub announces in advance.

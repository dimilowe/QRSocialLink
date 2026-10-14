---
name: Dependency compatibility
description: Why package-firewall fixes should preserve the current Express major version.
---

Keep Express on its current major version when resolving package-firewall blocks; a framework migration is separate work.

**Why:** A post-merge clean install was blocked by the proxy-address dependency. The current Express major still requested the blocked version, while the next major changed the dependency range. A narrow override allowed the security fix without introducing unrelated routing and middleware compatibility changes.

**How to apply:** Try the latest compatible parent patch first. If its dependency range still excludes the unblocked patch, use a scoped transitive override and verify the clean install, regression tests, type check, and build. Do not bypass the package firewall.

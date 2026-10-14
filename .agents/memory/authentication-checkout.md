---
name: Authentication and checkout
description: Product requirements and identity-linking decisions for Clerk and guest subscription purchases.
---

Use Clerk for sign-in. Keep pricing checkout available before sign-in.

**Why:** The user explicitly requested Clerk and described mandatory login at the point of purchase as too much friction.

**How to apply:** Let customers pay first, then verify the checkout email through Clerk to claim their local billing account. Do not restore temporary-password delivery.

Preserve local account identities and their QR codes/subscriptions when introducing Clerk. Link an existing account only after Clerk verifies email ownership; once linked, retain the stable identity link through email changes.

**Why:** Replacing account IDs would disconnect existing QR codes and subscription records. Checkout email entry alone is not proof of email ownership.

**How to apply:** Keep Clerk responsible for credentials and sessions, and the existing database responsible for QR ownership and billing. Existing legacy users set up Clerk once using their existing email; old local passwords are not imported.

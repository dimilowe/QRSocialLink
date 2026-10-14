import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import Stripe from "stripe";
import { PgDialect } from "drizzle-orm/pg-core";
import { getSubscribeSuccessCopy } from "../client/src/pages/subscribe-success-copy";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_qr_social_test_fixture";

const [{ setupAuth }, { DatabaseStorage }, { registerStripeWebhookRoute }] = await Promise.all([
  import("../server/auth"),
  import("../server/storage"),
  import("../server/stripe-webhook"),
]);

const stripe = new Stripe("sk_test_qr_social_fixture", {
  apiVersion: "2024-11-20.acacia" as any,
});

type FixtureUser = {
  id: string;
  email: string;
  username: string;
  password: string;
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

class MemoryStorage {
  users = new Map<string, FixtureUser>();
  qrCodes: Array<{ id: string; userId: string }> = [];
  createCalls = 0;
  private lookupBarrier?: { remaining: number; promise: Promise<void>; release: () => void };

  seed(user: FixtureUser) {
    this.users.set(user.id, user);
    return user;
  }

  makeNextLookupsRace(count = 2) {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => { release = resolve; });
    this.lookupBarrier = { remaining: count, promise, release };
  }

  async getUser(id: string) {
    return this.users.get(id);
  }

  async getUserByEmail(email: string) {
    const barrier = this.lookupBarrier;
    if (barrier) {
      barrier.remaining -= 1;
      if (barrier.remaining === 0) {
        this.lookupBarrier = undefined;
        barrier.release();
      }
      await barrier.promise;
    }
    const normalized = email.trim().toLowerCase();
    return [...this.users.values()].find((user) => user.email.trim().toLowerCase() === normalized);
  }

  async createUser(input: Pick<FixtureUser, "email" | "username" | "password">) {
    this.createCalls += 1;
    if ([...this.users.values()].some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("duplicate email");
    }
    const user: FixtureUser = {
      ...input,
      id: `local-user-${this.createCalls}`,
      plan: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUserStripeInfo(id: string, customerId: string | null, subscriptionId: string | null) {
    const user = this.users.get(id)!;
    user.stripeCustomerId = customerId;
    user.stripeSubscriptionId = subscriptionId;
    return user;
  }

  async updateUserPlan(id: string, plan: string) {
    const user = this.users.get(id)!;
    user.plan = plan;
    return user;
  }

  async getUserByStripeCustomerId(customerId: string) {
    return [...this.users.values()].find((user) => user.stripeCustomerId === customerId);
  }
}

const verifiedIdentity = (email: string, verified = true) => ({
  id: "clerk-user-1",
  externalId: null as string | null,
  primaryEmailAddressId: "email-primary",
  emailAddresses: [{
    id: "email-primary",
    emailAddress: email,
    verification: { status: verified ? "verified" : "unverified" },
  }],
});

function createApp(storage: MemoryStorage, identity = verifiedIdentity("customer@example.com")) {
  const app = express();
  app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
  const clerk = {
    users: {
      getUser: async () => identity,
      updateUser: async (_id: string, updates: { externalId: string }) => {
        identity.externalId = updates.externalId;
        return identity;
      },
    },
  };
  setupAuth(app as any, {
    clerkClient: clerk as any,
    getAuth: ((req: express.Request) => ({
      userId: req.headers["x-clerk-user"] ? "clerk-user-1" : null,
    })) as any,
    storage: storage as any,
  });
  registerStripeWebhookRoute(app as any, storage as any, stripe);
  return { app, identity };
}

async function withServer(app: express.Express, callback: (server: Server, origin: string) => Promise<void>) {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await callback(server, `http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function checkoutEvent(email: string, id = "evt_checkout_fixture") {
  return {
    id,
    object: "event",
    api_version: "2024-11-20.acacia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_fixture",
        object: "checkout.session",
        customer: "cus_fixture",
        subscription: "sub_fixture",
        customer_details: { email },
        metadata: { planTier: "pro" },
      },
    },
  };
}

async function postStripeEvent(origin: string, event: ReturnType<typeof checkoutEvent>) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return fetch(`${origin}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload,
  });
}

test("email lookup normalizes case and whitespace in its SQL predicate", async () => {
  let captured: any;
  const fakeDatabase = {
    select: () => ({
      from: () => ({
        where: (condition: any) => {
          captured = condition;
          return { limit: async (limit: number) => {
            assert.equal(limit, 2);
            return [];
          } };
        },
      }),
    }),
  };
  const databaseStorage = new DatabaseStorage(fakeDatabase as any);
  await databaseStorage.getUserByEmail("  MiXeD.User@Example.COM ");
  const query = new PgDialect().sqlToQuery(captured);
  assert.deepEqual(query.params, ["mixed.user@example.com"]);
});

test("first verified Clerk sign-in links a paid legacy account without changing UUID, QR ownership, or subscription", async () => {
  const storage = new MemoryStorage();
  const localId = "legacy-paid-user-uuid";
  storage.seed({
    id: localId,
    email: "Paid.User@example.com",
    username: "paid-user",
    password: "legacy-password-hash",
    plan: "pro",
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: "sub_existing",
  });
  storage.qrCodes.push({ id: "existing-qr", userId: localId });
  const identity = verifiedIdentity("PAID.USER@EXAMPLE.COM");
  const { app, identity: linkedIdentity } = createApp(storage, identity);

  await withServer(app, async (_server, origin) => {
    const response = await fetch(`${origin}/api/user`, { headers: { "x-clerk-user": "1" } });
    assert.equal(response.status, 200);
    const account = await response.json() as FixtureUser;
    assert.equal(account.id, localId);
    assert.equal(linkedIdentity.externalId, localId);
  });

  assert.equal(storage.users.size, 1);
  assert.deepEqual(storage.qrCodes, [{ id: "existing-qr", userId: localId }]);
  assert.equal(storage.users.get(localId)?.stripeCustomerId, "cus_existing");
  assert.equal(storage.users.get(localId)?.stripeSubscriptionId, "sub_existing");
});

test("guest checkout creates a paid account before signup; a later verified sign-in claims it and replay creates no duplicate", async () => {
  const storage = new MemoryStorage();
  const identity = verifiedIdentity("GUEST.BUYER@example.com");
  const { app } = createApp(storage, identity);

  await withServer(app, async (_server, origin) => {
    const event = checkoutEvent("Guest.Buyer@Example.com");
    const first = await postStripeEvent(origin, event);
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { received: true });
    const guest = await storage.getUserByEmail(" guest.buyer@EXAMPLE.com ");
    assert.ok(guest);
    const originalId = guest.id;
    assert.equal(guest.plan, "pro");
    assert.equal(guest.stripeSubscriptionId, "sub_fixture");

    const replay = await postStripeEvent(origin, event);
    assert.equal(replay.status, 200);
    const signIn = await fetch(`${origin}/api/user`, { headers: { "x-clerk-user": "1" } });
    assert.equal(signIn.status, 200);
    const account = await signIn.json() as FixtureUser;
    assert.equal(account.id, originalId);
    assert.equal(identity.externalId, originalId);
  });

  assert.equal(storage.users.size, 1);
  assert.equal(storage.createCalls, 1);
  assert.equal([...storage.users.values()][0].stripeSubscriptionId, "sub_fixture");
});

test("simultaneous guest webhook and first sign-in converge on one account and retain billing", async () => {
  const storage = new MemoryStorage();
  storage.makeNextLookupsRace(2);
  const identity = verifiedIdentity("race@example.com");
  const { app } = createApp(storage, identity);

  await withServer(app, async (_server, origin) => {
    const [webhook, signIn] = await Promise.all([
      postStripeEvent(origin, checkoutEvent("RACE@example.com", "evt_race_fixture")),
      fetch(`${origin}/api/user`, { headers: { "x-clerk-user": "1" } }),
    ]);
    assert.equal(webhook.status, 200);
    assert.equal(signIn.status, 200);
    const linked = await signIn.json() as FixtureUser;
    assert.equal(linked.id, identity.externalId);
  });

  assert.equal(storage.users.size, 1);
  assert.equal(storage.createCalls, 2); // The unique-email loser retries the lookup.
  const onlyUser = [...storage.users.values()][0];
  assert.equal(onlyUser.email, "race@example.com");
  assert.equal(onlyUser.stripeCustomerId, "cus_fixture");
  assert.equal(onlyUser.stripeSubscriptionId, "sub_fixture");
  assert.equal(onlyUser.plan, "pro");
});

test("unverified primary email claims are rejected without creating or linking an account", async () => {
  const storage = new MemoryStorage();
  const identity = verifiedIdentity("unverified@example.com", false);
  const { app } = createApp(storage, identity);

  await withServer(app, async (_server, origin) => {
    const response = await fetch(`${origin}/api/user`, { headers: { "x-clerk-user": "1" } });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { message: "Verify your email to access your account." });
  });

  assert.equal(storage.users.size, 0);
  assert.equal(identity.externalId, null);
});

test("checkout success copy sends paid guests to verified signup and rejects unconfirmed payments", () => {
  const guest = getSubscribeSuccessCopy({
    hasSessionId: true, isLoading: false, paid: true, hasError: false, hasUser: false,
  });
  assert.equal(guest.primaryHref, "/sign-up");
  assert.equal(guest.secondaryHref, "/sign-in");
  assert.match(guest.description!, /same email you entered at checkout/);

  const existingUser = getSubscribeSuccessCopy({
    hasSessionId: true, isLoading: false, paid: true, hasError: false, hasUser: true,
  });
  assert.equal(existingUser.primaryHref, "/dashboard");
  assert.equal(existingUser.secondaryHref, null);

  const failed = getSubscribeSuccessCopy({
    hasSessionId: true, isLoading: false, paid: false, hasError: false, hasUser: false,
  });
  assert.equal(failed.title, "Payment not confirmed");
  assert.equal(failed.primaryHref, "/pricing");
});

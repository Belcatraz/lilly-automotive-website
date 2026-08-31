import assert from "node:assert/strict";
import test from "node:test";

import {
  routeRequest,
  sanitizeFilename,
  signMediaLink,
  validateFields,
  validateFiles,
} from "../src/index.js";

test("health endpoint reports ready", async () => {
  const response = await routeRequest(new Request("https://appointments.example.com/health"), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "lilly-appointment-api" });
});

test("CORS preflight only allows the website origins", async () => {
  const allowed = await routeRequest(new Request("https://appointments.example.com/requests", {
    method: "OPTIONS",
    headers: { Origin: "https://lillyautomotivellc.com" },
  }), {});
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://lillyautomotivellc.com");

  const blocked = await routeRequest(new Request("https://appointments.example.com/requests", {
    method: "OPTIONS",
    headers: { Origin: "https://example.com" },
  }), {});
  assert.equal(blocked.status, 403);
});

test("field validation accepts the short form", () => {
  const form = new FormData();
  form.set("name", "Jamie Customer");
  form.set("phone", "(478) 555-0100");
  form.set("service", "Not sure");

  const result = validateFields(form);
  assert.equal(result.ok, true);
  assert.equal(result.fields.vehicle, "");
  assert.equal(result.fields.preferredDate, "");
});

test("field validation rejects Sundays", () => {
  const form = new FormData();
  form.set("name", "Jamie Customer");
  form.set("phone", "4785550100");
  form.set("service", "Diagnostics");
  form.set("preferred_date", "2026-09-06");

  const result = validateFields(form);
  assert.equal(result.ok, false);
  assert.match(result.error, /Monday through Saturday/);
});

test("media validation enforces supported formats", () => {
  const supported = validateFiles([
    new File([new Uint8Array(128)], "engine.jpg", { type: "image/jpeg" }),
  ]);
  assert.equal(supported.ok, true);

  const blocked = validateFiles([
    new File([new Uint8Array(128)], "notes.txt", { type: "text/plain" }),
  ]);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /not a supported/);
});

test("media validation accepts the reported 20.72 MiB video", () => {
  const reportedVideoSize = 21_728_311;
  const result = validateFiles([
    new File([new Uint8Array(reportedVideoSize)], "ronaldthrow.mp4", { type: "video/mp4" }),
  ]);

  assert.equal(result.ok, true);
});

test("honeypot submissions are acknowledged without storage", async () => {
  const form = new FormData();
  form.set("website", "https://spam.example");
  const response = await routeRequest(new Request("https://appointments.example.com/requests", {
    method: "POST",
    headers: { Origin: "https://lillyautomotivellc.com" },
    body: form,
  }), {});

  assert.equal(response.status, 201);
  assert.equal((await response.json()).referenceCode, "RECEIVED");
});

test("a valid request is stored, its upload expires, and the business is notified", async () => {
  const databaseCalls = [];
  const mediaCalls = [];
  const emailCalls = [];
  const env = {
    TURNSTILE_SECRET: "turnstile-secret",
    MEDIA_LINK_SECRET: "media-secret",
    NOTIFICATION_TO: "shop@example.com",
    NOTIFICATION_FROM: "appointments@lillyautomotivellc.com",
    PUBLIC_BASE_URL: "https://appointments.lillyautomotivellc.com",
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async run() {
                databaseCalls.push({ sql, values });
              },
            };
          },
        };
      },
    },
    MEDIA: {
      async put(key, value, options) {
        mediaCalls.push({ key, value, options });
      },
      async delete() {},
    },
    EMAIL: {
      async send(message) {
        emailCalls.push(message);
      },
    },
  };
  const form = new FormData();
  form.set("name", "Jamie Customer");
  form.set("phone", "(478) 555-0100");
  form.set("service", "Diagnostics");
  form.set("vehicle", "2017 Honda Accord");
  form.set("cf-turnstile-response", "valid-token");
  form.append("media", new File([new Uint8Array(128)], "dash.jpg", { type: "image/jpeg" }));
  const request = new Request("https://appointments.lillyautomotivellc.com/requests", {
    method: "POST",
    headers: { Origin: "https://lillyautomotivellc.com" },
    body: form,
  });
  const fetchImpl = async () => new Response(JSON.stringify({
    success: true,
    hostname: "lillyautomotivellc.com",
    action: "appointment-request",
  }), { headers: { "Content-Type": "application/json" } });

  const response = await routeRequest(request, env, { fetchImpl });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.ok, true);
  assert.match(body.referenceCode, /^[A-F0-9]{8}$/);
  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].options.expirationTtl, 30 * 24 * 60 * 60);
  assert.equal(databaseCalls.length, 2);
  assert.match(databaseCalls[0].sql, /INSERT INTO appointment_requests/);
  assert.match(databaseCalls[1].sql, /UPDATE appointment_requests/);
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0].to, "shop@example.com");
  assert.match(emailCalls[0].subject, /New website request/);
  assert.match(emailCalls[0].text, /links expire in 7 days/);
});

test("media signatures are deterministic and secret-specific", async () => {
  const first = await signMediaLink("request/file.jpg", 1_800_000_000, "secret-a");
  const second = await signMediaLink("request/file.jpg", 1_800_000_000, "secret-a");
  const other = await signMediaLink("request/file.jpg", 1_800_000_000, "secret-b");

  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
});

test("filenames are reduced to safe display names", () => {
  assert.equal(sanitizeFilename(" engine photo (1).jpg "), "engine-photo-1.jpg");
  assert.equal(sanitizeFilename("\r\n"), "upload");
});

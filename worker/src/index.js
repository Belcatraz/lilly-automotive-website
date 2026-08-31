const DEFAULT_ALLOWED_ORIGINS = [
  "https://lillyautomotivellc.com",
  "https://www.lillyautomotivellc.com",
];

const DEFAULT_TURNSTILE_HOSTNAMES = [
  "lillyautomotivellc.com",
  "www.lillyautomotivellc.com",
];

const SERVICE_OPTIONS = new Set([
  "Not sure",
  "Oil Change",
  "Brake Service",
  "Diagnostics",
  "A/C Service",
  "Transmission",
  "Battery Service",
  "Other",
]);

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const MAX_FILES = 3;
const MAX_FILE_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 40 * 1024 * 1024;
const MAX_REQUEST_BYTES = 45 * 1024 * 1024;
const MEDIA_TTL_SECONDS = 30 * 24 * 60 * 60;
const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        event: "appointment_api_error",
        message: error instanceof Error ? error.message : "Unknown error",
      }));

      return jsonResponse(
        { error: "We could not process your request. Please call (478) 960-2829." },
        500,
        corsHeaders(request, env),
      );
    }
  },
};

export async function routeRequest(request, env, dependencies = {}) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    const headers = corsHeaders(request, env);
    if (!headers["Access-Control-Allow-Origin"]) {
      return jsonResponse({ error: "Origin not allowed." }, 403, headers);
    }
    return new Response(null, { status: 204, headers });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ ok: true, service: "lilly-appointment-api" }, 200, {
      "Cache-Control": "no-store",
    });
  }

  if (request.method === "GET" && url.pathname.startsWith("/media/")) {
    return servePrivateMedia(request, env);
  }

  if (request.method !== "POST" || url.pathname !== "/requests") {
    return jsonResponse({ error: "Not found." }, 404, { "Cache-Control": "no-store" });
  }

  const headers = corsHeaders(request, env);
  if (!headers["Access-Control-Allow-Origin"]) {
    return jsonResponse({ error: "Origin not allowed." }, 403, headers);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(
      { error: "Uploads are too large. Choose smaller files or call (478) 960-2829." },
      413,
      headers,
    );
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonResponse({ error: "Invalid form submission." }, 415, headers);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "The form data could not be read." }, 400, headers);
  }

  if (cleanSingleLine(formData.get("website"), 200)) {
    return jsonResponse(
      {
        ok: true,
        referenceCode: "RECEIVED",
        message: "Your request was received. The shop will contact you to confirm availability.",
      },
      201,
      headers,
    );
  }

  const fieldsResult = validateFields(formData);
  if (!fieldsResult.ok) {
    return jsonResponse({ error: fieldsResult.error }, 400, headers);
  }

  const filesResult = validateFiles(formData.getAll("media"));
  if (!filesResult.ok) {
    return jsonResponse({ error: filesResult.error }, 400, headers);
  }

  const turnstileToken = cleanSingleLine(formData.get("cf-turnstile-response"), 2048);
  if (!turnstileToken) {
    return jsonResponse({ error: "Please complete the security check and try again." }, 400, headers);
  }

  const fetchImpl = dependencies.fetchImpl || fetch;
  const turnstileResult = await validateTurnstile(turnstileToken, request, env, fetchImpl);
  if (!turnstileResult.ok) {
    return jsonResponse(
      { error: "The security check expired or failed. Please try again." },
      400,
      headers,
    );
  }

  if (!env.DB || !env.MEDIA) {
    return jsonResponse(
      { error: "The request service is not fully configured. Please call (478) 960-2829." },
      503,
      headers,
    );
  }

  const requestId = crypto.randomUUID();
  const referenceCode = requestId.slice(0, 8).toUpperCase();
  const createdAt = new Date().toISOString();
  const mediaRecords = [];

  try {
    for (const file of filesResult.files) {
      const safeName = sanitizeFilename(file.name);
      const key = `${requestId}/${crypto.randomUUID()}-${safeName}`;
      await env.MEDIA.put(key, file.stream(), {
        expirationTtl: MEDIA_TTL_SECONDS,
        metadata: {
          requestId,
          fileName: safeName,
          contentType: file.type,
          size: file.size,
          createdAt,
        },
      });
      mediaRecords.push({ key, fileName: safeName, contentType: file.type, size: file.size });
    }

    await env.DB.prepare(
      `INSERT INTO appointment_requests (
        id, reference_code, created_at, name, phone, service, vehicle,
        preferred_date, details, media_json, status, notification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending')`,
    ).bind(
      requestId,
      referenceCode,
      createdAt,
      fieldsResult.fields.name,
      fieldsResult.fields.phone,
      fieldsResult.fields.service,
      fieldsResult.fields.vehicle || null,
      fieldsResult.fields.preferredDate || null,
      fieldsResult.fields.details || null,
      JSON.stringify(mediaRecords),
    ).run();
  } catch (error) {
    await Promise.allSettled(mediaRecords.map((media) => env.MEDIA.delete(media.key)));
    console.error(JSON.stringify({
      event: "appointment_storage_error",
      referenceCode,
      message: error instanceof Error ? error.message : "Unknown error",
    }));
    return jsonResponse(
      { error: "We could not save your request. Please call (478) 960-2829." },
      500,
      headers,
    );
  }

  const notification = await sendBusinessNotification({
    request,
    env,
    requestId,
    referenceCode,
    createdAt,
    fields: fieldsResult.fields,
    mediaRecords,
  });

  await updateNotificationStatus(env, requestId, notification);

  const responseBody = {
    ok: true,
    referenceCode,
    message: "Your request was received. The shop will contact you to confirm availability.",
  };

  if (!notification.ok) {
    responseBody.notificationWarning = true;
    responseBody.message =
      "Your request was saved, but the shop notification needs attention. Please call (478) 960-2829 if you need a quick response.";
  }

  return jsonResponse(responseBody, notification.ok ? 201 : 202, headers);
}

export function validateFields(formData) {
  const name = cleanSingleLine(formData.get("name"), 80);
  const phone = cleanSingleLine(formData.get("phone"), 30);
  const service = cleanSingleLine(formData.get("service"), 60);
  const vehicle = cleanSingleLine(formData.get("vehicle"), 100);
  const preferredDate = cleanSingleLine(formData.get("preferred_date"), 10);
  const details = cleanMultiline(formData.get("details"), 2000);

  if (name.length < 2) {
    return { ok: false, error: "Please enter your name." };
  }

  const phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    return { ok: false, error: "Please enter a valid phone number." };
  }

  if (!SERVICE_OPTIONS.has(service)) {
    return { ok: false, error: "Please choose what you need help with." };
  }

  if (preferredDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return { ok: false, error: "Please choose a valid preferred date." };
    }
    const date = new Date(`${preferredDate}T12:00:00Z`);
    if (Number.isNaN(date.valueOf()) || date.getUTCDay() === 0) {
      return { ok: false, error: "Please choose a Monday through Saturday." };
    }
  }

  return {
    ok: true,
    fields: { name, phone, service, vehicle, preferredDate, details },
  };
}

export function validateFiles(entries) {
  const files = entries.filter((entry) =>
    entry && typeof entry === "object" && typeof entry.stream === "function" && entry.size > 0,
  );

  if (files.length > MAX_FILES) {
    return { ok: false, error: `Please upload no more than ${MAX_FILES} files.` };
  }

  let totalBytes = 0;
  for (const file of files) {
    const type = String(file.type || "").toLowerCase();
    if (!ALLOWED_MEDIA_TYPES.has(type)) {
      return { ok: false, error: `“${sanitizeFilename(file.name)}” is not a supported photo or video format.` };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: `“${sanitizeFilename(file.name)}” is larger than 24 MB.` };
    }
    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_FILE_BYTES) {
    return { ok: false, error: "Uploads must be 40 MB or less in total." };
  }

  return { ok: true, files };
}

export async function validateTurnstile(token, request, env, fetchImpl = fetch) {
  if (!env.TURNSTILE_SECRET) {
    return { ok: false };
  }

  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || undefined,
        idempotency_key: crypto.randomUUID(),
      }),
    });
    const result = await response.json();
    const allowedHostnames = parseList(env.ALLOWED_TURNSTILE_HOSTNAMES, DEFAULT_TURNSTILE_HOSTNAMES);

    return {
      ok:
        result.success === true &&
        result.action === "appointment-request" &&
        allowedHostnames.includes(result.hostname),
    };
  } catch {
    return { ok: false };
  }
}

async function sendBusinessNotification({
  request,
  env,
  requestId,
  referenceCode,
  createdAt,
  fields,
  mediaRecords,
}) {
  if (!env.EMAIL || typeof env.EMAIL.send !== "function" || !env.NOTIFICATION_TO) {
    return { ok: false, status: "not_configured", error: "Email binding or destination is missing." };
  }

  try {
    const baseUrl = env.PUBLIC_BASE_URL || new URL(request.url).origin;
    const mediaLinks = [];

    if (mediaRecords.length > 0 && env.MEDIA_LINK_SECRET) {
      const expires = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
      for (const media of mediaRecords) {
        const signature = await signMediaLink(media.key, expires, env.MEDIA_LINK_SECRET);
        const mediaUrl = new URL(`/media/${encodeURIComponent(media.key)}`, baseUrl);
        mediaUrl.searchParams.set("expires", String(expires));
        mediaUrl.searchParams.set("sig", signature);
        mediaLinks.push({ ...media, url: mediaUrl.toString() });
      }
    }

    const plainText = buildPlainTextEmail({ referenceCode, createdAt, fields, mediaLinks, mediaRecords });
    const html = buildHtmlEmail({ referenceCode, createdAt, fields, mediaLinks, mediaRecords });

    await env.EMAIL.send({
      to: env.NOTIFICATION_TO,
      from: {
        email: env.NOTIFICATION_FROM || "appointments@lillyautomotivellc.com",
        name: "Lilly Automotive Website",
      },
      subject: `New website request #${referenceCode}`,
      text: plainText,
      html,
      headers: { "X-Lilly-Request-ID": requestId },
    });

    return { ok: true, status: "sent", error: null };
  } catch (error) {
    console.error(JSON.stringify({
      event: "appointment_notification_error",
      referenceCode,
      message: error instanceof Error ? error.message : "Unknown error",
    }));
    return {
      ok: false,
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 500) : "Unknown email error",
    };
  }
}

async function updateNotificationStatus(env, requestId, notification) {
  try {
    await env.DB.prepare(
      "UPDATE appointment_requests SET notification_status = ?, notification_error = ? WHERE id = ?",
    ).bind(notification.status, notification.error || null, requestId).run();
  } catch (error) {
    console.error(JSON.stringify({
      event: "appointment_notification_status_error",
      message: error instanceof Error ? error.message : "Unknown error",
    }));
  }
}

async function servePrivateMedia(request, env) {
  if (!env.MEDIA || !env.MEDIA_LINK_SECRET) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const encodedKey = url.pathname.slice("/media/".length);
  let key;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return new Response("Invalid link", { status: 400 });
  }

  const expires = Number(url.searchParams.get("expires"));
  const suppliedSignature = url.searchParams.get("sig") || "";
  if (!key || !Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) {
    return new Response("This link has expired.", { status: 403 });
  }

  const expectedSignature = await signMediaLink(key, expires, env.MEDIA_LINK_SECRET);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) {
    return new Response("Invalid link", { status: 403 });
  }

  const stored = await env.MEDIA.getWithMetadata(key, { type: "arrayBuffer" });
  if (!stored.value) {
    return new Response("File not found", { status: 404 });
  }

  const metadata = stored.metadata || {};
  const fileName = sanitizeFilename(metadata.fileName || "upload");
  return new Response(stored.value, {
    status: 200,
    headers: {
      "Content-Type": metadata.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function signMediaLink(key, expires, secret) {
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    signingKey,
    new TextEncoder().encode(`${key}.${expires}`),
  );
  return toBase64Url(new Uint8Array(signature));
}

function buildPlainTextEmail({ referenceCode, createdAt, fields, mediaLinks, mediaRecords }) {
  const lines = [
    `New website request #${referenceCode}`,
    `Received: ${new Date(createdAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
    "",
    `Name: ${fields.name}`,
    `Phone: ${fields.phone}`,
    `Needs help with: ${fields.service}`,
    `Vehicle: ${fields.vehicle || "Not provided"}`,
    `Preferred date: ${fields.preferredDate || "No preference"}`,
    "",
    "Details:",
    fields.details || "None provided",
  ];

  if (mediaLinks.length > 0) {
    lines.push("", "Private uploads (links expire in 7 days):");
    mediaLinks.forEach((media) => lines.push(`${media.fileName}: ${media.url}`));
  } else if (mediaRecords.length > 0) {
    lines.push("", `${mediaRecords.length} upload(s) were stored, but private links could not be generated.`);
  }

  lines.push("", "This is an appointment request, not a confirmed appointment.");
  return lines.join("\n");
}

function buildHtmlEmail({ referenceCode, createdAt, fields, mediaLinks, mediaRecords }) {
  const details = escapeHtml(fields.details || "None provided").replace(/\n/g, "<br>");
  const mediaHtml = mediaLinks.length > 0
    ? `<h2 style="font-size:16px">Private uploads</h2><ul>${mediaLinks
      .map((media) => `<li><a href="${escapeHtml(media.url)}">${escapeHtml(media.fileName)}</a> <small>(link expires in 7 days)</small></li>`)
      .join("")}</ul>`
    : mediaRecords.length > 0
      ? `<p>${mediaRecords.length} upload(s) were stored, but private links could not be generated.</p>`
      : "";

  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">
  <h1 style="font-size:22px">New website request #${escapeHtml(referenceCode)}</h1>
  <p><strong>Received:</strong> ${escapeHtml(new Date(createdAt).toLocaleString("en-US", { timeZone: "America/New_York" }))} ET</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
    <tr><td><strong>Name</strong></td><td>${escapeHtml(fields.name)}</td></tr>
    <tr><td><strong>Phone</strong></td><td><a href="tel:${escapeHtml(fields.phone)}">${escapeHtml(fields.phone)}</a></td></tr>
    <tr><td><strong>Needs help with</strong></td><td>${escapeHtml(fields.service)}</td></tr>
    <tr><td><strong>Vehicle</strong></td><td>${escapeHtml(fields.vehicle || "Not provided")}</td></tr>
    <tr><td><strong>Preferred date</strong></td><td>${escapeHtml(fields.preferredDate || "No preference")}</td></tr>
  </table>
  <h2 style="font-size:16px">Details</h2>
  <p>${details}</p>
  ${mediaHtml}
  <p><strong>This is an appointment request, not a confirmed appointment.</strong></p>
</body></html>`;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = parseList(env.ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS);
  const allowed = allowedOrigins.includes(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function parseList(value, fallback) {
  if (!value) return [...fallback];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function cleanSingleLine(value, maxLength) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanMultiline(value, maxLength) {
  return String(value || "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

export function sanitizeFilename(value) {
  const cleaned = String(value || "upload")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "upload";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

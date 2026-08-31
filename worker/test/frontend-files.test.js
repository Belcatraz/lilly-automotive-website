import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function createElementMock() {
  return {
    children: [],
    dataset: {},
    append(...children) {
      this.children.push(...children);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      this.children = [...children];
    },
    addEventListener() {},
    setAttribute() {},
  };
}

function loadFormScript() {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const match = html.match(/<script>\s*(const APPOINTMENT_ENDPOINT[\s\S]*?)<\/script>/);
  assert.ok(match, "appointment form script should be present");

  const listeners = {};
  const mediaInput = {
    files: [],
    value: "",
    validationMessage: "",
    addEventListener(type, handler) {
      listeners[`media:${type}`] = handler;
    },
    reportValidity() {},
    setCustomValidity(message) {
      this.validationMessage = message;
    },
  };
  const mediaSummary = { dataset: {}, textContent: "No files selected." };
  const mediaList = createElementMock();
  const preferredDate = {
    value: "",
    addEventListener(type, handler) {
      listeners[`date:${type}`] = handler;
    },
    reportValidity() {},
    setCustomValidity() {},
  };
  const submitSpan = { textContent: "Request a Callback" };
  const submitButton = {
    disabled: false,
    querySelector() {
      return submitSpan;
    },
  };
  const appointmentForm = {
    addEventListener(type, handler) {
      listeners[`form:${type}`] = handler;
    },
    querySelector(selector) {
      return selector === ".form-submit" ? submitButton : null;
    },
  };
  const elements = {
    appointmentForm,
    formStatus: { dataset: {}, focus() {}, hidden: true, textContent: "" },
    media: mediaInput,
    mediaList,
    mediaSummary,
    optionalDetails: { open: false },
    preferred_date: preferredDate,
  };

  const context = {
    console,
    Date,
    FormData,
    fetch: async () => new Response(),
    document: {
      createElement: createElementMock,
      getElementById(id) {
        return elements[id];
      },
      querySelectorAll() {
        return [];
      },
    },
    window: {
      matchMedia() {
        return { matches: true };
      },
    },
  };

  vm.runInNewContext(match[1], context);
  return { listeners, mediaInput, mediaSummary };
}

test("reopening the picker appends a second file instead of replacing the first", () => {
  const { listeners, mediaInput, mediaSummary } = loadFormScript();
  const onChange = listeners["media:change"];
  assert.equal(typeof onChange, "function");

  mediaInput.files = [
    { name: "front.jpg", size: 1_024, type: "image/jpeg", lastModified: 1 },
  ];
  onChange.call(mediaInput);
  assert.equal(mediaSummary.textContent, "1 file selected.");

  mediaInput.files = [
    { name: "rear.jpg", size: 1_024, type: "image/jpeg", lastModified: 2 },
  ];
  onChange.call(mediaInput);
  assert.equal(mediaSummary.textContent, "2 files selected.");

  mediaInput.files = [
    { name: "dash.jpg", size: 1_024, type: "image/jpeg", lastModified: 3 },
  ];
  onChange.call(mediaInput);
  assert.equal(mediaSummary.textContent, "3 files selected.");

  mediaInput.files = [
    { name: "engine.jpg", size: 1_024, type: "image/jpeg", lastModified: 4 },
  ];
  onChange.call(mediaInput);
  assert.match(mediaSummary.textContent, /^3 files selected\./);
  assert.match(mediaSummary.textContent, /not added because the limit is 3/);
});

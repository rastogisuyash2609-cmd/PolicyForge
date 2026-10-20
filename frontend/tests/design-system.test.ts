import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, Disclosure, Alert } from "../components/ui/primitives";
import { Tabs } from "../components/ui/tabs";
import {
  eventLabel,
  findingOneLiner,
  findingScenarioSentence,
  resolutionBadge,
  shrinkSummary,
  stateChips,
} from "../lib/translate";
import { cn } from "../lib/utils";

test("outcome labels preserve deterministic denial and distinguish non-decisions", () => {
  assert.match(resolutionBadge("CONTRADICTION", "DENY").label, /Denied/);
  assert.match(resolutionBadge("AMBIGUOUS", "DENY").label, /Denied/);
  assert.equal(
    resolutionBadge("NON_DECISION", "ALLOW").label,
    "Event processed",
  );
  assert.equal(
    resolutionBadge("UNANIMOUS_ALLOW", "ALLOW").label,
    "Request allowed",
  );
  assert.equal(
    resolutionBadge("DEFAULT_ALLOW", "ALLOW").label,
    "Allowed by default",
  );
  assert.equal(
    resolutionBadge("DEFAULT_DENY", "DENY").label,
    "Denied by default",
  );
});

test("explanations do not invent cancellation/refund context or reverse a configured fallback", () => {
  const contradiction = findingScenarioSentence({ type: "CONTRADICTION" });
  assert.doesNotMatch(contradiction, /refund|cancel|unpredictable|limbo/i);
  assert.match(contradiction, /denies/);
  assert.match(findingOneLiner({ type: "AMBIGUITY" }), /denies/);
  assert.match(
    findingScenarioSentence({
      type: "POLICY_GAP",
      details: { default_outcome: "ALLOW" },
    }),
    /fallback is approval/,
  );
  assert.match(
    findingScenarioSentence({
      type: "POLICY_GAP",
      details: { default_outcome: "DENY" },
    }),
    /fallback is denial/,
  );
});

test("reduction copy does not claim a global minimum or a monotonic failure boundary", () => {
  const copy = shrinkSummary({
    original_length: 8,
    minimal_length: 4,
    minimal_journey: [{ day: 31 }],
  });
  assert.match(copy, /8 to 4/);
  assert.doesNotMatch(copy, /onward|shortest|global|minimum/i);
  assert.match(
    shrinkSummary({
      original_length: 4,
      minimal_length: 4,
      minimal_journey: [{ day: 31 }],
    }),
    /days may have changed/,
  );
});

test("state chips use only the supplied state and boolean true values", () => {
  assert.deepEqual(
    stateChips({
      item_delivered: true,
      replacement_active: false,
      customer_tier: "VIP",
      days_since_delivery: 3,
    }),
    ["Item delivered", "VIP customer", "Day 3 since delivery"],
  );
  assert.deepEqual(
    stateChips({ refund_completed: "true", item_damaged: false }),
    [],
  );
  assert.equal(eventLabel("REPLACEMENT_REQUESTED"), "Replacement requested");
});

test("class composition preserves conditional classes and resolves spacing conflicts", () => {
  assert.equal(
    cn("p-4", false && "hidden", { "text-sm": true }, "p-6"),
    "text-sm p-6",
  );
});

test("loading buttons prevent duplicate submission and expose their busy state", () => {
  const markup = renderToStaticMarkup(
    createElement(Button, { loading: true, children: "Run tests" }),
  );
  assert.match(markup, /disabled=""/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /Run tests/);
});

test("tabs associate panels and expose exactly one keyboard tab stop", () => {
  const markup = renderToStaticMarkup(
    createElement(Tabs, {
      items: [
        { id: "issues", label: "Issues" },
        { id: "policies", label: "Policies" },
      ],
      value: "issues",
      onChange: () => {},
      idPrefix: "test",
      label: "Workspace",
    }),
  );
  assert.match(markup, /role="tablist" aria-label="Workspace"/);
  assert.match(markup, /aria-controls="test-panel-issues"/);
  assert.equal((markup.match(/tabindex="0"/g) ?? []).length, 1);
  assert.equal((markup.match(/aria-selected="true"/g) ?? []).length, 1);
});

test("disclosures use native keyboard semantics and errors are announced", () => {
  const markup = renderToStaticMarkup(
    createElement(Disclosure, {
      title: "Technical details",
      children: "Engine trace",
    }),
  );
  assert.match(markup, /<details/);
  assert.match(markup, /<summary/);
  assert.match(markup, /Engine trace/);
  const alert = renderToStaticMarkup(
    createElement(Alert, {
      title: "Simulation failed",
      children: "Try again.",
    }),
  );
  assert.match(alert, /role="alert"/);
});

const css = readFileSync("app/globals.css", "utf8");
function tokens(selector: string): Record<string, number[]> {
  const block = css.match(new RegExp(`${selector} \\{([^}]+)\\}`))?.[1];
  assert.ok(block, `Missing theme ${selector}`);
  return Object.fromEntries(
    Array.from(block.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)).map(
      (match) => [match[1], match.slice(2).map(Number)],
    ),
  );
}
function luminance(rgb: number[]): number {
  const channels = rgb.map((value) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
test("landing hero text and CTA colors meet AA normal-text contrast", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const hero = page.slice(
    page.indexOf('aria-labelledby="hero-heading"'),
    page.indexOf('id="product"'),
  );
  const rgb = (hex: string) =>
    [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const contrast = (a: string, b: string) => {
    const x = luminance(rgb(a)),
      y = luminance(rgb(b));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const background = hero.match(/bg-\[#([0-9A-F]{6})\]/)?.[1];
  assert.ok(background);
  const colors = new Set(
    Array.from(hero.matchAll(/text-\[#([0-9A-F]{6})\]/g), (match) => match[1]),
  );
  assert.ok(colors.size >= 3, "Check the actual hero colors");
  for (const color of Array.from(colors))
    assert.ok(contrast(color, background) >= 4.5, `${color}/${background}`);
  const cta = hero.match(
    /<Link\s+href="\/workspace"\s+className="([^"]+)"/,
  )?.[1];
  assert.ok(cta, "Check the actual primary CTA");
  for (const match of Array.from(
    cta.matchAll(/(?:hover:)?bg-\[#([0-9A-F]{6})\]/g),
  )) {
    assert.ok(contrast("FFFFFF", match[1]) >= 4.5, `CTA white/${match[1]}`);
  }
});
for (const selector of [":root", "\\.dark"]) {
  test(`${selector}: text, action and severity token pairs meet AA normal-text contrast`, () => {
    const theme = tokens(selector);
    const pairs = [
      ["foreground", "background"],
      ["foreground", "surface"],
      ["muted", "background"],
      ["muted", "surface"],
      ["muted", "sidebar"],
      ["on-primary", "primary"],
      ["on-primary", "primary-hover"],
      ["selected-text", "selected"],
      ["success", "success-bg"],
      ["warning", "warning-bg"],
      ["danger", "danger-bg"],
      ["info", "info-bg"],
    ];
    for (const [foreground, background] of pairs) {
      assert.ok(
        theme[foreground] && theme[background],
        `Missing ${foreground}/${background}`,
      );
      const a = luminance(theme[foreground]),
        b = luminance(theme[background]);
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(
        contrast >= 4.5,
        `${foreground}/${background}: ${contrast.toFixed(2)} < 4.5`,
      );
    }
  });
}

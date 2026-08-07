#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const trackerPath = resolve(
  import.meta.dirname,
  "../docs/qa/feature-user-stories.csv"
);

const expectedHeader = [
  "feature_id",
  "area",
  "feature",
  "primary_user",
  "story",
  "expected_behavior",
  "entry_points",
  "code_refs",
  "existing_coverage",
  "test_type",
  "test_status",
  "last_tested_at",
  "tester",
  "issue_status",
  "error_summary",
  "evidence",
  "fix_refs",
  "retest_evidence",
  "production_notes",
] as const;

const validTestStatuses = new Set([
  "not_started",
  "blocked",
  "in_progress",
  "passed",
  "failed",
  "retest_passed",
]);

const validIssueStatuses = new Set([
  "none",
  "bug_logged",
  "fix_in_progress",
  "fixed_pending_retest",
  "closed",
]);

const requiredEntryPointHints = [
  "/sign",
  "/verify",
  "/:slug/documents",
  "/:slug/contacts",
  "/:slug/payments",
  "/:slug/settings",
  "/api/v1",
  "/docs",
  "packages/react-sdk",
];

type ColumnName = (typeof expectedHeader)[number];

function columnValue(row: readonly string[], column: ColumnName): string {
  return row[expectedHeader.indexOf(column)] ?? "";
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n" && !quoted) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (char !== "\r") {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const rows = parseCsv(readFileSync(trackerPath, "utf8"));
const [header, ...dataRows] = rows;

if (header === undefined) {
  fail("QA tracker is empty.");
}

if (header.join(",") !== expectedHeader.join(",")) {
  fail(
    `QA tracker header mismatch.\nExpected: ${expectedHeader.join(",")}\nActual:   ${header.join(",")}`
  );
}

const errors: string[] = [];
const ids = new Set<string>();
const entryPointCorpus: string[] = [];

for (const [index, row] of dataRows.entries()) {
  const line = index + 2;
  if (row.length !== expectedHeader.length) {
    errors.push(
      `line ${line}: expected ${expectedHeader.length} columns, found ${row.length}`
    );
    continue;
  }

  const featureId = columnValue(row, "feature_id");
  if (featureId.length === 0) {
    errors.push(`line ${line}: feature_id is required`);
  } else if (ids.has(featureId)) {
    errors.push(`line ${line}: duplicate feature_id ${featureId}`);
  }
  ids.add(featureId);

  for (const requiredColumn of [
    "area",
    "feature",
    "primary_user",
    "story",
    "expected_behavior",
    "entry_points",
    "code_refs",
    "test_type",
    "test_status",
    "tester",
    "issue_status",
  ] as const) {
    if (columnValue(row, requiredColumn).trim().length === 0) {
      errors.push(`line ${line}: ${requiredColumn} is required`);
    }
  }

  const testStatus = columnValue(row, "test_status");
  if (!validTestStatuses.has(testStatus)) {
    errors.push(`line ${line}: invalid test_status ${testStatus}`);
  }
  const issueStatus = columnValue(row, "issue_status");
  if (!validIssueStatuses.has(issueStatus)) {
    errors.push(`line ${line}: invalid issue_status ${issueStatus}`);
  }

  entryPointCorpus.push(columnValue(row, "entry_points"));
}

const joinedEntryPoints = entryPointCorpus.join("\n");
for (const hint of requiredEntryPointHints) {
  if (!joinedEntryPoints.includes(hint)) {
    errors.push(`missing required entry point coverage hint: ${hint}`);
  }
}

if (errors.length > 0) {
  fail(
    `QA feature tracker audit failed:\n${errors.map((error) => `- ${error}`).join("\n")}`
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      check: "qa_feature_tracker",
      trackerPath,
      rows: dataRows.length,
      uniqueFeatureIds: ids.size,
      requiredEntryPointHints,
    },
    null,
    2
  )
);

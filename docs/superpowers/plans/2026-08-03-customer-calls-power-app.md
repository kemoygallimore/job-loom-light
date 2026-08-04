# Customer Calls Power App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a paste-ready replacement for `Container61` that recreates the approved Customer Calls layout with HTML presentation and transparent Power Apps interaction overlays.

**Architecture:** The deliverable is a standalone Power Apps control-YAML artifact, not a change to the React application in this repository. A responsive auto-layout root contains a native phone icon, HTML header and control visuals, an interval gallery, an HTML table header, an HTML row renderer inside the existing customer gallery, transparent buttons for every `OnSelect`, and a responsive footer. A small Node validation script enforces the agreed control, formula, field, and accessibility contract before handoff.

**Tech Stack:** Microsoft Power Apps canvas controls, Power Fx, Power Apps HTML Text controls, YAML source format, Node.js built-in test runner.

## Global Constraints

- Preserve `'Courts Optical Happy Customer List'`, `Container61`, `Gallery2`, `Gallery1`, `Button18`, `varDeliveryTag`, `TimelineMenuItem`, `varCurrentPage`, `varPageSize`, `varSortAscending`, `showFilters`, and `DetailsScreen`.
- Display only Customer Name, Account #, Phone, Delivery Date, Status, and Action.
- Do not display Branch, Agent, Last Called, Items Bought, or warranty stage.
- Use HTML Text controls for non-interactive visuals and transparent native controls for `OnSelect` behavior.
- Retain page sizes 10, 20, 40, and 60 and use **2 Years**, not **2 Year**.
- Escape dynamic values before inserting them into HTML.
- Do not add Refresh.
- Target the supplied desktop/tablet composition.

## File Structure

- Create `scripts/validate-powerapps-customer-calls.mjs`: reusable static contract validator.
- Create `scripts/validate-powerapps-customer-calls.test.mjs`: validator contract tests.
- Create `powerapps/customer-calls-container.yaml`: complete replacement control tree.
- Create `powerapps/README.md`: paste, initialization, and manual verification instructions.

---

### Task 1: Artifact Contract Validator

**Files:**
- Create: `scripts/validate-powerapps-customer-calls.mjs`
- Create: `scripts/validate-powerapps-customer-calls.test.mjs`

**Interfaces:**
- Consumes: a UTF-8 string containing exported Power Apps control YAML.
- Produces: `validateCustomerCallsYaml(source: string): string[]`; an empty array means the contract passes.

- [ ] **Step 1: Write validator tests**

Use Node's built-in test runner. The accepted fixture contains all required tokens. Focused failure cases add `Last Called</div>` or remove `Navigate(DetailsScreen, ScreenTransition.Cover)`.

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { validateCustomerCallsYaml } from "./validate-powerapps-customer-calls.mjs";

const validFixture = `
- Container61:
  Gallery2: Gallery1
  Button18: ButtonAppearance.Transparent AccessibleLabel
  columns: Customer Name Account # Phone Delivery Date Status Action
  actions: Select(Parent); Navigate(DetailsScreen, ScreenTransition.Cover)
  filter: Set(showFilters,true)
  vars: varDeliveryTag TimelineMenuItem varCurrentPage varPageSize varSortAscending
  intervals: All 2 Weeks 1 Month 5 Months 1 Year 2 Years
  paging: Previous Next Rows [10,20,40,60]
  source: 'Courts Optical Happy Customer List'
  colors: #F8FAFC #D9E2EC #F6F8FB #D1FAE5 #FEF3C7 #DBEAFE #FEE2E2 #E5E7EB
`;

test("accepts the approved contract", () => {
  assert.deepEqual(validateCustomerCallsYaml(validFixture), []);
});

test("rejects an excluded display field", () => {
  const errors = validateCustomerCallsYaml(`${validFixture}\nLast Called</div>`);
  assert.ok(errors.some((error) => error.includes("Last Called")));
});

test("requires Update navigation", () => {
  const errors = validateCustomerCallsYaml(
    validFixture.replace("Navigate(DetailsScreen, ScreenTransition.Cover)", "")
  );
  assert.ok(errors.some((error) => error.includes("DetailsScreen")));
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```powershell
node --test scripts/validate-powerapps-customer-calls.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for the validator module.

- [ ] **Step 3: Implement the validator**

```javascript
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const required = [
  "Container61", "Gallery2", "Gallery1", "Button18",
  "Customer Name", "Account #", "Phone", "Delivery Date", "Status", "Action",
  "ButtonAppearance.Transparent", "AccessibleLabel", "Select(Parent)",
  "Navigate(DetailsScreen, ScreenTransition.Cover)", "Set(showFilters,true)",
  "varDeliveryTag", "TimelineMenuItem", "varCurrentPage", "varPageSize",
  "varSortAscending", "All", "2 Weeks", "1 Month", "5 Months", "1 Year",
  "2 Years", "Previous", "Next", "Rows", "[10,20,40,60]",
  "'Courts Optical Happy Customer List'", "#F8FAFC", "#D9E2EC", "#F6F8FB",
  "#D1FAE5", "#FEF3C7", "#DBEAFE", "#FEE2E2", "#E5E7EB",
];

const forbidden = [
  "Branch</div>", "Agent</div>", "Last Called</div>",
  "Items Bought</div>", "Warranty Stage</div>", 'Text: ="Refresh"',
];

export function validateCustomerCallsYaml(source) {
  const errors = required
    .filter((token) => !source.includes(token))
    .map((token) => `Missing required token: ${token}`);
  for (const token of forbidden) {
    if (source.includes(token)) errors.push(`Forbidden display token: ${token}`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const artifactPath = process.argv[2];
  if (!artifactPath) throw new Error("Pass the Power Apps YAML path.");
  const errors = validateCustomerCallsYaml(await readFile(artifactPath, "utf8"));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Customer Calls Power Apps contract passed.");
  }
}
```

- [ ] **Step 4: Run tests and commit**

Run `node --test scripts/validate-powerapps-customer-calls.test.mjs`; expect all tests to pass.

```powershell
git add scripts/validate-powerapps-customer-calls.mjs scripts/validate-powerapps-customer-calls.test.mjs
git commit -m "test: define Customer Calls Power App contract"
```

---

### Task 2: Paste-Ready Customer Calls Control Tree

**Files:**
- Create: `powerapps/customer-calls-container.yaml`
- Test: `scripts/validate-powerapps-customer-calls.mjs`

**Interfaces:**
- Consumes: the preserved data source and Power Fx variables from Global Constraints.
- Produces: a complete `Container61` block with `Gallery1.Selected` identifying the record selected by `Button18`.

- [ ] **Step 1: Verify the artifact is initially absent**

Run `node scripts/validate-powerapps-customer-calls.mjs powerapps/customer-calls-container.yaml`; expect an `ENOENT` failure.

- [ ] **Step 2: Create the root and header**

Create `Container61` as a vertical auto-layout container with `Fill = ColorValue("#F8FAFC")`, 28-pixel horizontal padding, 24-pixel top padding, an 18-pixel gap, and stretch alignment. Add a 64-pixel horizontal header containing a non-interactive `Icon.Phone`, HTML title/subtitle, HTML sort/filter visuals, and transparent overlays. Give the overlays the accessible labels **Change delivery-date sort order** and **Open customer filters**, plus a visible two-pixel focus border.

Use this sort action and display `If(varSortAscending, "Oldest first", "Newest first")`:

```powerfx
UpdateContext({
    varSortAscending: !Coalesce(varSortAscending, false),
    varCurrentPage: 1
})
```

Preserve `Set(showFilters,true);` on the filter overlay.

- [ ] **Step 3: Rebuild the interval selector**

Retain `Gallery2` with:

```powerfx
[
    {ID:1, Value:"All"}, {ID:2, Value:"2 Weeks"},
    {ID:3, Value:"1 Month"}, {ID:4, Value:"5 Months"},
    {ID:5, Value:"1 Year"}, {ID:6, Value:"2 Years"}
]
```

Each template contains an HTML selected/unselected visual and a full-template transparent button using the existing `varDeliveryTag`, `TimelineMenuItem`, and page-reset formula. Set its accessible label to `"Show " & ThisItem.Value & " customer calls"` and preserve a visible two-pixel focus border.

- [ ] **Step 4: Build the table header and rows**

Use this identical CSS grid in both HTML controls:

```css
grid-template-columns: 24% 13% 17% 17% 17% 12%;
```

Use a 50-pixel header and 48-pixel gallery templates. Retain `Gallery1.Items = MainblankGallery.AllItems`. Alternate backgrounds between `#FFFFFF` and `#F6F8FB` using the row index.

Preserve the existing delivery-age checkpoint calculation. Escape dynamic values with nested Power Fx `Substitute` calls in this order: `&`, `<`, `>`, `Char(34)`, and apostrophe. Render only the six approved columns.

Map status colors exactly:

```powerfx
Switch(
    callStatus,
    "Completed", {Bg:"#D1FAE5", Fg:"#00813A"},
    "Pending", {Bg:"#FEF3C7", Fg:"#9A6700"},
    "Voicemail", {Bg:"#DBEAFE", Fg:"#1D4ED8"},
    "Wrong Number", {Bg:"#FEE2E2", Fg:"#D90000"},
    {Bg:"#E5E7EB", Fg:"#475569"}
)
```

- [ ] **Step 5: Add the visible Update treatment and transparent action**

Retain `Button18` over the HTML Update treatment with:

```powerfx
AccessibleLabel = "Update customer " & Coalesce(ThisItem.'Customer Name', "record")
OnSelect = Select(Parent); Navigate(DetailsScreen, ScreenTransition.Cover)
```

Position it within the rightmost 12% Action column.

- [ ] **Step 6: Build the footer**

Add HTML summary text, a native single-select page-size combobox with `Items = [10,20,40,60]`, and HTML Previous/Next visuals with transparent overlays. Compute `totalCustomers` with this exact expression:

```powerfx
CountRows(
    Filter(
        'Courts Optical Happy Customer List',
        IsBlank(varDeliveryTag) ||
        Switch(
            varDeliveryTag,
            "2 Weeks", DateDiff('Delivery Date', Today(), TimeUnit.Days) >= 13 && DateDiff('Delivery Date', Today(), TimeUnit.Days) < 29,
            "1 Month", DateDiff('Delivery Date', Today(), TimeUnit.Days) >= 29 && DateDiff('Delivery Date', Today(), TimeUnit.Days) < 149,
            "5 Months", DateDiff('Delivery Date', Today(), TimeUnit.Days) >= 149 && DateDiff('Delivery Date', Today(), TimeUnit.Days) < 366,
            "1 Year", DateDiff('Delivery Date', Today(), TimeUnit.Days) >= 366 && DateDiff('Delivery Date', Today(), TimeUnit.Days) < 732,
            "2 Years", DateDiff('Delivery Date', Today(), TimeUnit.Days) >= 732,
            false
        )
    )
)
```

Display zero results as `0 customers · page 0 of 0`; otherwise calculate total pages with `RoundUp(totalCustomers / varPageSize, 0)`. Previous uses `If(varCurrentPage > 1, UpdateContext({varCurrentPage: varCurrentPage - 1}))`. Next uses `If(varCurrentPage < RoundUp(totalCustomers / varPageSize, 0), UpdateContext({varCurrentPage: varCurrentPage + 1}))` inside a `With` expression that binds `totalCustomers` to the exact `CountRows` expression above. Set accessible labels to **Previous customer page** and **Next customer page**, and preserve a visible two-pixel focus border on both overlays.

- [ ] **Step 7: Validate the artifact**

```powershell
node --test scripts/validate-powerapps-customer-calls.test.mjs
node scripts/validate-powerapps-customer-calls.mjs powerapps/customer-calls-container.yaml
```

Expected: all tests pass and the validator prints `Customer Calls Power Apps contract passed.`

- [ ] **Step 8: Check excluded content and commit**

Run the following search; expect no matches:

```powershell
rg -n 'Branch</div>|Agent</div>|Last Called</div>|Items Bought</div>|Warranty Stage</div>|Text: ="Refresh"' powerapps/customer-calls-container.yaml
```

```powershell
git add powerapps/customer-calls-container.yaml
git commit -m "feat: add Customer Calls Power App layout"
```

---

### Task 3: Paste and Verification Guide

**Files:**
- Create: `powerapps/README.md`
- Verify: `powerapps/customer-calls-container.yaml`

**Interfaces:**
- Consumes: the validated artifact from Task 2.
- Produces: exact replacement, initialization, and Power Apps Studio verification steps.

- [ ] **Step 1: Write the guide**

Document these instructions:

1. Save a copy of the current screen.
2. Replace only the `Container61` block in code view.
3. Confirm `MainblankGallery`, `DetailsScreen`, the data source, and preserved variables remain available.
4. Apply the initialization formula below if the screen does not already initialize these variables.
5. Resolve any locale-specific formula separators Power Apps Studio identifies on paste.
6. Preview at the target width and test every tab, sort direction, Filters, status pill, Update navigation, page size, Previous, Next, first-page, last-page, and empty-result state.

```powerfx
UpdateContext({
    varCurrentPage: Coalesce(varCurrentPage, 1),
    varPageSize: Coalesce(varPageSize, 10),
    varSortAscending: Coalesce(varSortAscending, false)
})
```

- [ ] **Step 2: Run final verification**

```powershell
node --test scripts/validate-powerapps-customer-calls.test.mjs
node scripts/validate-powerapps-customer-calls.mjs powerapps/customer-calls-container.yaml
git diff --check
```

Expected: all tests pass, the contract passes, and the diff check reports no whitespace errors.

- [ ] **Step 3: Commit the guide**

```powershell
git add powerapps/README.md
git commit -m "docs: add Power Apps paste and verification guide"
```

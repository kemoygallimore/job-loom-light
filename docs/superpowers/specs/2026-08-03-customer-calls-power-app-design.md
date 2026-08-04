# Customer Calls Power App Redesign

## Objective

Redesign the existing delivered-orders customer-call screen to closely match the supplied Customer Calls reference image while preserving the existing Power Apps data source, filtering logic, status calculations, navigation destination, and pagination behavior.

The redesign targets a desktop or tablet canvas-app layout. It uses HTML Text controls for visual presentation wherever practical and transparent native buttons wherever `OnSelect` behavior is required.

## Visual Direction

- Use a light `#F8FAFC` screen background and 28-pixel outer spacing.
- Use Segoe UI throughout, with dark navy primary text and muted slate secondary text.
- Place a phone icon, the title **Customer Calls**, and the subtitle **All branches, grouped by call checkpoint.** at the upper left.
- Place the sort and filter controls at the upper right.
- Use thin gray borders, 12-pixel corner radii, restrained shadows, and generous whitespace.
- Match the reference image's compact table density and alternating white and light-gray rows.

## Displayed Data

The table displays these columns in this order:

1. Customer Name
2. Account #
3. Phone
4. Delivery Date
5. Status
6. Action

Branch, Agent, and Last Called are intentionally omitted. Items Bought and warranty stage are also omitted from the redesigned row presentation.

Long values remain on one line and truncate with an ellipsis so that all rows retain consistent column alignment and height.

## Component Structure

### Root

Keep `Container61` as a responsive vertical auto-layout container. It owns the screen padding, background treatment, vertical spacing, and the following major regions.

### Header

Use a horizontal auto-layout header with:

- A non-interactive native phone icon beside an HTML Text control for the title and subtitle. The native icon avoids relying on inconsistent HTML glyph rendering.
- A right-aligned sort visual displaying **Newest first** or **Oldest first**.
- A right-aligned **Filters** visual with a filter icon.
- Transparent overlay buttons above the sort and filter visuals.

The existing Refresh action is removed because it is not present in the approved visual target.

### Interval Selector

Retain `Gallery2` as a horizontal gallery containing:

- All
- 2 Weeks
- 1 Month
- 5 Months
- 1 Year
- 2 Years

Each gallery template uses an HTML Text control to render the selected and unselected states. A transparent button fills the template and runs the existing interval-selection formula. The selected tab has a white background, darker text, a subtle border, and a light shadow. Unselected tabs use muted blue-gray text on the pale selector background.

### Table Card

Use a white card with a one-pixel `#D9E2EC` border and 12-pixel corner radius.

The card contains:

- One HTML Text control for the column header.
- The existing customer gallery for the rows.
- One HTML Text control per row for all row content and the visible Update button treatment.
- One transparent native button positioned exactly over the visible Update treatment.

The table uses the same proportional grid in both header and rows: Customer Name 24%, Account # 13%, Phone 17%, Delivery Date 17%, Status 17%, and Action 12%. The header is 50 pixels high, data rows are 48 pixels high, and rows alternate between white and `#F6F8FB`.

### Footer

Use a horizontal auto-layout footer with:

- An HTML Text summary on the left showing the filtered customer count and `page X of Y`.
- A **Rows** label and the existing native page-size selector on the right.
- HTML-styled Previous and Next visuals with transparent overlay buttons.

Previous and Next show a disabled visual state whenever their underlying action is unavailable.

## Behavior and Formulas

### Interval Selection

Preserve the existing interval-selection behavior:

- Set `varDeliveryTag` to blank for All or to the selected interval value.
- Reset `varCurrentPage` to 1.
- Store the selected interval in `TimelineMenuItem`.

### Sorting

The sort control toggles `varSortAscending`, resets the current page to 1, and changes its label between **Newest first** and **Oldest first**. The existing filtered data pipeline uses the variable to sort by Delivery Date.

### Filtering

The Filters overlay preserves `Set(showFilters, true)`.

### Status

Preserve the existing checkpoint-status calculation and render the resulting status as a compact pill:

- Completed: green background and dark-green text.
- Pending: amber background and dark-amber text.
- Voicemail: blue background and dark-blue text.
- Wrong Number: red background and dark-red text.
- Blank or any other value: gray background and slate text.

Before inserting record values into the HTML string, escape ampersands, less-than signs, greater-than signs, double quotes, and apostrophes with nested Power Fx `Substitute` calls. Convert numeric or date values to text before escaping them. This prevents source values from breaking the row markup.

### Update Action

The visible **Update** treatment appears in every row. Its transparent overlay button runs:

```powerfx
Select(Parent);
Navigate(DetailsScreen, ScreenTransition.Cover)
```

Selecting the parent first ensures the details screen receives the row that the user intended to update.

### Pagination

- Retain page sizes of 10, 20, 40, and 60.
- Changing page size resets `varCurrentPage` to 1.
- Previous never decrements below page 1.
- Next is disabled on the last page.
- Customer count and total pages are derived from the same filtered, pre-pagination dataset used by the existing hidden pagination gallery.
- If the filtered result is empty, the footer displays `0 customers · page 0 of 0`, and both paging controls are disabled.

## Accessibility

- Give every transparent button an explicit accessible label that describes its action.
- Preserve visible focus indication for keyboard users.
- Keep all interactive controls in a logical left-to-right, top-to-bottom tab order.
- Do not communicate status only through color; every pill includes its text label.
- Maintain readable foreground/background contrast for text, controls, and disabled states.

## Verification

Verify the completed control tree at the target desktop/tablet width against the supplied screenshot. Confirm:

1. Header, interval selector, table card, rows, and footer match the approved composition.
2. Header and row columns remain aligned at supported widths.
3. All six interval options filter correctly and reset paging.
4. Sort direction and its visible label change together.
5. Filters opens the existing filter experience.
6. Each supported status displays the correct pill treatment.
7. Update selects the intended row and navigates to `DetailsScreen`.
8. Page-size changes, Previous, Next, first-page, last-page, and empty-result states behave correctly.
9. Existing data-source and checkpoint formulas remain intact.

## Deliverable

Provide a complete replacement Power Apps control YAML block for `Container61`, ready to paste into the canvas app. The replacement must preserve referenced control and variable names where required by existing formulas and must not introduce the three excluded columns.

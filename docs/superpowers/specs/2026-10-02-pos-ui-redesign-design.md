# POS UI redesign — scan-first dock

## Goal

Replace the dark left sidebar with a light desktop shell for a counter with a keyboard and barcode scanner. Selling stays scan-first, with checkout fixed on the right. Products, stock, and reports share the same top bar and drop the checkout dock.

Thai labels stay. Checkout, catalog, stock, and reports keep their current behavior and data.

## Shell

`src/App.tsx` renders a white top bar instead of the dark sidebar.

- Left: **My POS**
- Nav, in order: ขาย, สินค้า, สต็อก, รายงาน
- The active item uses an emerald tint and emerald text
- The page below fills the remaining height on a light gray canvas
- Tab state, the pending-barcode handoff from sell to products, and which page mounts stay as they are

## Sell

`src/pages/SellPage.tsx` is a column under the top bar.

1. A full-width barcode field is the first control. It is focused on load and again after checkout. Enter still scans.
2. An unknown barcode still shows the existing warning and **เพิ่มสินค้า** action under that field.
3. Below that, two panes share the remaining height:
   - Left: name search and the scrollable result list (name, stock, barcode, price).
   - Right dock, about 400px: cart lines with quantity, line total, and remove; **ยอดรวม**; **รับเงิน**; **เงินทอน**; **ชำระเงินสด**.
4. The dock stays in view. The result list and cart lines scroll inside their panes.
5. The receipt modal still opens after a successful cash checkout and returns focus to the barcode field.

## Back office

สินค้า, สต็อก, and รายงาน use the same top bar and no dock.

- **สินค้า:** search, inactive toggle, **เพิ่มสินค้า**, and the product table stay. The create/edit form stays a modal.
- **สต็อก:** the receive/adjust form stays on the left and the movement list on the right.
- **รายงาน:** the three summary cards, **ปิดยอดวันนี้**, refresh, sale list, and close history stay.

Spacing, borders, and buttons match the sell page: white surfaces, light borders, rounded corners, emerald primary actions.

## Visual system

`src/index.css` keeps Sarabun and the existing `.field-input` focus ring. The canvas stays light gray. Emerald remains the only accent. Receipt modal copy and totals stay the same; its overlay and card use the same white surface and emerald primary button.

## Error handling

Existing messages stay where they are: unknown barcode, insufficient stock, checkout failure, product form errors, stock errors, and report errors. No new error states.

## Out of scope

New features, keyboard shortcuts, API or database changes, and receipt content changes.

## Verification

There is no UI test suite. After the layout change, check in the running app:

- Barcode field is focused on ขาย, Enter adds a known product, and an unknown code offers **เพิ่มสินค้า**.
- Search adds a product. Quantity, remove, total, cash received, change, and **ชำระเงินสด** work, then the receipt opens.
- Switching to สินค้า, สต็อก, and รายงาน hides the dock and keeps each page’s current actions.
- A pending barcode from sell still opens the product form.

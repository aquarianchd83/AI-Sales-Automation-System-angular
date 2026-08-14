# Customer import samples

Test files for **Customers → Import CSV / Excel**.

| File | Purpose |
|---|---|
| `customers-sample.xlsx` | 8 valid customers. Imports cleanly. |
| `customers-sample.csv` | The same 8 rows as CSV. |
| `customers-with-errors.csv` | 6 rows that exercise every failure path. |

All phone numbers are from ranges reserved for fiction (US `555-01xx`, UK `7946 0xxx`)
and every address uses `example.com`, so importing these cannot message a real person.

## File format

Row 1 must be the header. Recognised columns:

| Column | Required | Notes |
|---|---|---|
| `PhoneNumber` | **yes** | Normalized to E.164 on import — see below |
| `FirstName` | no | |
| `LastName` | no | |
| `Email` | no | not validated on import |
| `Tags` | no | separated by `;` or `,` — created automatically if they don't exist |

### Phone numbers

You do **not** have to pre-format these. The API normalizes what people actually type into
spreadsheets. Spaces, dashes, dots and brackets are stripped, and `00` is understood as the
international dialling prefix.

The customer base is India, so a number with **no country code is assumed Indian** and gets
`+91`; a number that already carries a country code is respected as-is. All of
`9820098200`, `09820098200`, `919820098200`, `+91 98200-98200` and `0091 9820098200`
normalize to `+919820098200`.

A row is rejected when the number cannot be resolved at all — an Indian number outside the
6–9 mobile series, the wrong digit count, or anything non-numeric. Landlines are out of
scope for WhatsApp.

Header matching is case- and space-insensitive, so `Phone Number`, `phonenumber` and
`PHONENUMBER` all work. Extra columns are ignored. For `.xlsx` only the **first
worksheet** is read.

Prefer `;` between tags in CSV — a `,` works but forces the field to be quoted.

## What the importer does

- Every imported customer is created with `Source = "Import"` and
  `OptInStatus = PendingOptIn`. Opt-in is never granted by an import.
- A phone number that already exists is **skipped**, not updated — re-importing the same
  file is safe and creates no duplicates.
- A row with a bad or missing phone number is reported in the result's `rowErrors` with
  its row number, and every other row still imports.

## Expected results

`customers-sample.xlsx` on an empty database:

| | |
|---|---|
| rows read | 8 |
| added | 8 |
| duplicates skipped | 0 |
| failed | 0 |

`customers-with-errors.csv`, run *after* the sample above:

| | |
|---|---|
| rows read | 6 |
| added | 1 |
| duplicates skipped | 1 |
| failed | 4 |

The four failures are row 3 (11 digits with no trunk prefix), row 4 (an Indian number
starting `5`, outside the 6–9 mobile series), row 5 (too short) and row 6 (empty). Row 2
duplicates Ada Lovelace from the first file; row 7 is valid and imports. Row numbers in the
error report line up with the row numbers in your spreadsheet, header included.

Note that rows 8 and 9 of `customers-sample.xlsx` are deliberately *not* pre-formatted —
`+1 (202) 555-0178` and `0012025550112` both import successfully, and demonstrate the
normalizer stripping separators and resolving the `00` prefix.

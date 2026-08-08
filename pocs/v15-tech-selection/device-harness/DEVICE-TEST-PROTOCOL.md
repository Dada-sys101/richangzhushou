# Stage 3 real-device validation protocol

This protocol is required before Stage 3 can close. The repository currently contains a test harness, not real-device evidence.

## Required environments

1. iPhone Safari normal tab.
2. The same iPhone after adding the harness to the Home Screen and launching in standalone mode.
3. iPhone Safari Private Browsing, recorded separately and never treated as equivalent to persistent PWA storage.
4. A physical Android device using stable Chrome.

For each run record the exact device model, operating-system version, browser version, date, and whether the page is a normal tab or standalone PWA.

## Test procedure

1. Deploy `device-harness` and its parent `lib` directory under the same HTTPS origin.
2. Open the harness and capture the initial environment JSON.
3. Select **运行完整迁移**.
4. Confirm every assertion is true and export the JSON evidence.
5. Fully close the tab or standalone PWA.
6. Reopen the same URL or PWA and select **关闭数据库后重新验证**.
7. Export the second JSON evidence.
8. Repeat once after switching the device offline to verify that the cached PWA can reopen and read the migrated IndexedDB data.
9. Repeat the normal migration at least 10 times after clearing the harness database between runs.

## Safari-specific observations

Record whether any of the following occur:

- a transaction becomes inactive before all queued requests complete;
- `versionchange` or `blocked` behaves differently from desktop Chromium;
- the standalone PWA and Safari tab see different database contents;
- storage estimates are unavailable or unexpectedly small;
- the database disappears after the app is backgrounded or the device is restarted;
- Private Browsing rejects IndexedDB or clears data after the session.

The historical inactive-site retention concern cannot be proven by a same-day test. A separate longitudinal check must reopen the installed PWA after an agreed inactivity period and verify the database. Until that check exists, the project must not promise indefinite local retention.

## Acceptance

A device run passes only when:

- `activeSchema` is `v2`;
- the journal is `ACTIVE`;
- source and target counts match;
- two user keys remain available after close and reopen;
- normal tab and standalone PWA results are documented separately;
- no plaintext payload appears in the v2 records;
- exported JSON evidence is attached to the Stage 3 report.

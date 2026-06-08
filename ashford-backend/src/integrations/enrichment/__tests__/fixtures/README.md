# Scraper HTML fixtures

Drop real-world HTML samples here, one per directory profile, named
by directory + slug:

```
headway-tara-langston-2.html
psychologytoday-jane-doe-12345.html
zencare-rachel-smith.html
alma-marcus-johnson.html
growtherapy-priya-patel.html
therapyden-sam-rivera.html
healthgrades-dr-williams-12345.html
```

The snapshot test (`scraperSnapshots.test.ts`) reads each fixture,
runs the matching parser against it, and asserts on a stable subset
of the output (name + photo presence + ≥N specialties + ≥N
insurances) plus a Vitest snapshot for the full structured output.

When a directory changes its HTML, the snapshot test fails in CI
before the change reaches a real prospect's preview. Update the
fixture (re-fetch via `inspectEnrichment` or `debugHeadwayHtml`) and
the snapshot together in the same PR; never accept a snapshot
update without verifying the fixture is current.

Fixtures are not committed by default — they may contain real
provider data. Use the `.gitignore` rule already present (`.html`
files in this directory are ignored by default; add specific
sanitized fixtures to the repo only after stripping PII).

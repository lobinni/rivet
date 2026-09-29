# Build your own 5-minute fixture repository

Samples 02 and 03 reference `github.com/<YOU>/rivet-fixture`. This guide
creates it for real so every consensus step has genuine public evidence to
fetch. Total time: about five minutes with the GitHub web UI, no local git
required.

## 1. Create the repository

GitHub → **New repository** → name `rivet-fixture` → Public → tick **Add a
README** → Create.

## 2. Record the frozen base SHA

The README-only first commit is your frozen base:

- Repo home → the commit counter → click the newest commit → copy its full
  40-character SHA from the URL bar (`…/commit/<sha>`).
- This is `<base SHA>` in samples 02/03.

## 3. Add the defect

Create `src/csv.py` (Add file → Create new file):

```python
def parse_csv(text):
    rows = []
    for line in text.split("\n"):
        rows.append(line.split(","))
    return rows
```

Commit directly to `main`. Then open **Issues → New issue** titled
"CSV parser loses embedded newlines in quoted fields" with a short
description — this becomes issue #1 used in the samples.

## 4. Create the candidate fix

Edit `src/csv.py` in the web editor to a quoted-field-aware parser:

```python
import csv
import io

def parse_csv(text):
    return list(csv.reader(io.StringIO(text)))
```

Add `tests/test_csv.py` alongside it:

```python
from src.csv import parse_csv

def test_quoted_lf_roundtrips():
    assert len(parse_csv('"a\nb",c\n1,2')) == 2

def test_quoted_crlf_roundtrips():
    assert isinstance(parse_csv('"a\r\nb",c'), list)
```

Commit the change to `main` and copy the new full SHA — this is
`<fix SHA>`, the candidate commit for the samples.

## 5. (Sample 03 only) Wire a green Actions run

Add `.github/workflows/ci.yml`:

```yaml
name: ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: python -m pytest -q
```

Push, open the **Actions** tab, wait for the run on the fix SHA to turn
green, and copy the run URL (`…/actions/runs/<id>`) — this is the CI
evidence row in sample 03. While it is still orange/yellow, the examination
step is *expected* to answer NOT_READY and refund the bond — a built-in
negative test.

## 6. (Optional challenge rehearsal) A regression note commit

To rehearse the challenge panel meaningfully, commit a `REGRESSION.md`
noting a case the fix misses (e.g. empty quoted CRLF fields) and use that
commit URL as the challenge evidence. The challenge judge will then have
real fetched material to weigh.

## What you hold afterwards

| Artifact | Used in sample | Field |
| --- | --- | --- |
| base SHA | 02, 03 | Frozen base commit |
| fix SHA | 02, 03 | Candidate commit SHA (+ URL suffix `.diff`) |
| issue #1 URL | 02, 03 | Defect / issue URL |
| Actions run URL | 03 | CI evidence row |
| regression note SHA | 02 | Challenge evidence URL |

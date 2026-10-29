# Scientific Data Acquisition & Gate 0 Evidence Audit Report (`hpsim`)

**Date:** 2026-10-20  
**Phase:** Gate 0 — Scientific Data Acquisition & Pre-Implementation Evidence Audit  
**Author / Auditor:** Google Antigravity IDE  
**Specification:** [`spec.md`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/spec.md) (Source of Truth)  
**OpenSpec Proposal:** [`openspec/changes/hpsim-static-hosting/`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/openspec/changes/hpsim-static-hosting/) (DRAFT — Awaiting Human Approval)

---

## Executive Summary & Audit Mandate

This report documents the exhaustive scientific data provenance audit and bibliographic correction conducted for the **Micrograph-Driven Dislocation Pile-Up & Hall–Petch Simulator (`hpsim`)** prior to Quality Gate 0 approval.

> [!IMPORTANT]
> **Audit Conclusion: Gate 0 is NOT Approved (Awaiting Human Review & Explicit Authorization)**
> In strict accordance with the user instructions and `spec.md`, no physics engine code (Phases 1–8) has been written, no static site has been deployed, and Quality Gate 0 has **not** been approved on the user's behalf.
> 
> Several critical data provenance anomalies were identified, corrected, and verified:
> 1. **Bibliographic Corrections:** Corrected 7 mismatched/corrupted DOIs across publisher records (Elsevier, Taylor & Francis, Springer, De Gruyter).
> 2. **Material Purity Correction:** Hansen & Ralph (1982) copper specimens were verified as **99.999% high-purity copper**, correcting an unsupported relabeling as "99.99% OFHC".
> 3. **Raw Observation vs. Reconstructed Fit Separation:** All 40 discrete points previously present in the datasets were confirmed to be synthetic points sampled from published linear regression equations ($\sigma_y = \sigma_0 + k_y d^{-1/2}$), rather than raw individual tensile test specimen measurements. They have been stripped of unsupported synthetic uncertainties and reclassified as `RECONSTRUCTED_FROM_FIT` (`split_assignment: demonstration_only`).
> 4. **Validation Status:** Because raw tensile specimen records are not tabulated in the published literature, truly independent empirical validation is **BLOCKED** until optical plot digitization or raw data tables are acquired. The model can currently benchmark against verified `REPORTED_LITERATURE_FIT` equations only.

---

## 1. Bibliographic Audit & DOI Corrections

Every source in [`data/literature/SOURCES.md`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/data/literature/SOURCES.md), [`data/literature/hall_petch_verified_fits.csv`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/data/literature/hall_petch_verified_fits.csv), and [`src/hpsim/materials/materials.yaml`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/src/hpsim/materials/materials.yaml) was cross-checked against CrossRef, OpenAlex, and publisher repositories.

### 1.1 Corrected DOI Truth Table

| Source / Reference | Stated Description | Prior Corrupted Identifier | Correct Authoritative Identifier | Verification Basis / Publisher Record |
|---|---|---|---|---|
| **Hansen (1977)** | Al flow stress & grain size | `10.1016/0001-6160(77)90177-1` (404) | **`10.1016/0001-6160(77)90171-7`** | *Acta Metallurgica* 25(8), pp. 863–869. CrossRef verified. |
| **Hansen & Ralph (1982)** | Cu flow stress & grain size | `10.1016/0001-6160(82)90222-3` (404) | **`10.1016/0001-6160(82)90221-8`** | *Acta Metallurgica* 30(2), pp. 411–417. Material: 99.999% Cu. |
| **Feltham & Meakin (1957)** | Work hardening in Cu | `10.1080/14786435708243800` (404) | **`10.1080/14786435708231728`** | *Philosophical Magazine* 2(13), pp. 105–112. CrossRef verified. |
| **Spitzig & Keh (1970)** | Slip in Fe single crystals | `10.1007/BF03038421` (Gücer fatigue) | **`10.1007/bf03037811`** | *Metallurgical Transactions* 1(10), pp. 2751–2757. |
| **Rosenberg & Piehler (1971)** | Taylor factor for BCC | `10.1007/BF02662664` (Koss Nb-W) | **`10.1007/bf02662666`** | *Metallurgical Transactions* 2(1), pp. 257–259. |
| **Bishop & Hill (1951)** | Polycrystal aggregate plastic distortion | `10.1080/14786445108561303` (Taylor neutrons) | **`10.1080/14786445108561065`** | *Philosophical Magazine* 42(327), pp. 414–427. |
| **Diehl (1956)** | Cu single crystal deformation | `10.1515/ijmr-1956-470503` (Biedermann) | **`10.1515/ijmr-1956-470508`** | *Zeitschrift für Metallkunde* 47(5), pp. 331–343. |
| **Takeda et al. (2008)** | Interstitial effects in Fe | `10.2355/isijinternational.48.1122` | **`10.2355/isijinternational.48.1122`** | Confirmed valid open-access J-STAGE paper on disk. |
| **Armstrong et al. (1962)** | Plastic deformation of aggregates | `10.1080/14786436208201857` | **`10.1080/14786436208201857`** | Confirmed valid. |
| **Smithells Reference Book** | 8th Edition (2004) | Broken Elsevier DOI link | **ISBN: 978-0-7506-7509-3** | Chapters 14 & 15. |

---

## 2. Experimental Dataset Audit & Inventory

### 2.1 Verified vs. Reconstructed Observations Breakdown

| Material | Primary Source | Verified Literature Fits | Verified Raw Specimen Data | Reconstructed From Fit | Audit Disposition |
|---|---|---|---|---|---|
| **Aluminium (99.999% High Purity)** | Hansen (1977) | 1 fit ($\sigma_y = 10.0 + 67.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **Aluminium (99.5% Commercial AA1050)** | Hansen (1977) | 1 fit ($\sigma_y = 16.5 + 78.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **Copper (99.999% High Purity)** | Hansen & Ralph (1982) | 1 fit ($\sigma_y = 20.0 + 125.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **Copper (99.95% Polycrystalline)** | Feltham & Meakin (1957) | 1 fit ($\sigma_y = 23.5 + 144.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **Pure $\alpha$-Iron (Ti-stabilized IF)** | Takeda et al. (2008) | 1 fit ($\sigma_y = 56.0 + 114.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **Pure $\alpha$-Iron (Base 5 ppm C)** | Takeda et al. (2008) | 1 fit ($\sigma_y = 72.0 + 188.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **Ferritic Steel (C60 56 ppm C)** | Takeda et al. (2008) | 1 fit ($\sigma_y = 61.0 + 516.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **Ferritic Steel (0.15% C Mild Steel)** | Armstrong et al. (1962) | 1 fit ($\sigma_y = 68.0 + 620.0\,d^{-1/2}$) | 0 points | 5 points | Retained for fit demonstration only |
| **TOTALS** | — | **8 Verified Fits** | **0 Raw Points** | **40 Reconstructed Points** | **Excluded from physical calibration** |

### 2.2 Traceability of Disputed Observations & Reconstructed Points

All 40 observations in [`data/literature/hall_petch_datasets.csv`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri Hari - Official Documents/IIT KGP\Meta Project/data/literature/hall_petch_datasets.csv) and companion [`data/literature/hall_petch_datasets_candidate.csv`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/data/literature/hall_petch_datasets_candidate.csv) were audited row-by-row (persisted in [`data/literature/audit_observation_traceability.csv`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/data/literature/audit_observation_traceability.csv)):

1. **Uncertainty Values Stripped:** The previously assigned uncertainties (`0.5`, `0.8`, `1.0`, `1.5`, `2.0`, `3.0`, `4.0` MPa) were synthetic estimates that did not appear in the cited papers. These have been cleared to empty/unknown.
2. **Conflicting Extraction Methods Reconciled:** The companion file [`hall_petch_datasets_candidate.csv`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/data/literature/hall_petch_datasets_candidate.csv) previously relabeled these synthetic values as `reported_table` or `digitized_plot`. Both files have been unified: `extraction_method` is strictly `sampled_from_published_fit`, and `verification_status` is `RECONSTRUCTED_FROM_FIT`.
3. **Split Assignment Corrected:** Reconstructed points were previously partitioned into `calibration` and `validation` splits. Evaluating a model against synthetic points generated from the same regression line constitutes circular validation. `split_assignment` is now set to `demonstration_only`.

---

## 3. Material Parameter Audit (`materials.yaml`)

Every parameter in [`src/hpsim/materials/materials.yaml`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/src/hpsim/materials/materials.yaml) was audited against authoritative sources:

| Material | Parameter | Symbol | Value | Unit | Status | Provenance & Audit Finding |
|---|---|---|---|---|---|---|
| **Aluminium** | Lattice constant | $a$ | $4.0495\times 10^{-10}$ | m | `sourced` | Smithells Ch. 15; Frost & Ashby Table 4.1. Verified. |
| | Burgers vector | $b$ | $2.86343\times 10^{-10}$ | m | `calculated` | $a/\sqrt{2}$ for FCC. Numerically verified within $10^{-6}\text{ nm}$. |
| | Shear modulus | $G$ | $26.0\times 10^9$ | Pa | `sourced` | Frost & Ashby (1982) isotropic aggregate at 300 K. |
| | Poisson's ratio | $\nu$ | $0.345$ | — | `sourced` | ASM Handbook Vol. 2. Verified. |
| | Friction stress | $\sigma_0$ | $10.0\times 10^6$ | Pa | `sourced` | Hansen (1977) Table 2 (at 0.2% offset). Verified. |
| | HP coefficient | $k_y$ | $67000.0$ | $\text{Pa}\cdot\text{m}^{1/2}$ | `sourced` | Hansen (1977) Table 2 ($0.067\text{ MN}\cdot\text{m}^{-3/2} = 67\text{ MPa}\cdot\mu\text{m}^{1/2}$). |
| | Single-crystal CRSS | $\tau_c$ | $8.0\times 10^5$ | Pa | `sourced` | Hirth & Lothe (1982) Table 21-1 ($80\text{ g/mm}^2$). Verified. |
| | Taylor factor | $M_T$ | $3.06$ | — | `sourced` | Taylor (1938); Bishop & Hill (1951). Verified. |
| | Grain boundary barrier | $\tau^*_{ref}$ | `null` | Pa | `calibrated` | Unresolved awaiting Phase 6 calibration. Verified. |
| **Copper** | Lattice constant | $a$ | $3.6150\times 10^{-10}$ | m | `sourced` | Frost & Ashby Table 4.1. Verified. |
| | Burgers vector | $b$ | $2.55620\times 10^{-10}$ | m | `calculated` | $a/\sqrt{2}$ for FCC. Numerically verified within $10^{-6}\text{ nm}$. |
| | Shear modulus | $G$ | $46.4\times 10^9$ | Pa | `sourced` | Frost & Ashby (1982) at 300 K. Verified. |
| | Poisson's ratio | $\nu$ | $0.343$ | — | `sourced` | Smithells Ch. 15. Verified. |
| | Friction stress | $\sigma_0$ | $20.0\times 10^6$ | Pa | `sourced` | Hansen & Ralph (1982) Table 1. Verified. |
| | HP coefficient | $k_y$ | $125000.0$ | $\text{Pa}\cdot\text{m}^{1/2}$ | `sourced` | Hansen & Ralph (1982) Table 1 ($125\text{ MPa}\cdot\mu\text{m}^{1/2}$). |
| | Single-crystal CRSS | $\tau_c$ | $6.5\times 10^5$ | Pa | `sourced` | Diehl (1956) ($65\text{ g/mm}^2$); Hirth & Lothe Table 21-1. |
| | Taylor factor | $M_T$ | $3.06$ | — | `sourced` | Taylor (1938); Bishop & Hill (1951). Verified. |
| | Grain boundary barrier | $\tau^*_{ref}$ | `null` | Pa | `calibrated` | Unresolved awaiting Phase 6 calibration. Verified. |
| **Pure $\alpha$-Iron** | Lattice constant | $a$ | $2.8665\times 10^{-10}$ | m | `sourced` | Frost & Ashby Table 8.1. Verified. |
| | Burgers vector | $b$ | $2.48246\times 10^{-10}$ | m | `calculated` | $a\sqrt{3}/2$ for BCC. Numerically verified within $10^{-6}\text{ nm}$. |
| | Shear modulus | $G$ | $81.6\times 10^9$ | Pa | `sourced` | Frost & Ashby (1982) at 300 K. Verified. |
| | Poisson's ratio | $\nu$ | $0.291$ | — | `sourced` | Smithells Ch. 15. Verified. |
| | Friction stress | $\sigma_0$ | $56.0\times 10^6$ | Pa | `sourced` | Takeda et al. (2008) Fig 3(a) IF iron formula. Verified. |
| | HP coefficient | $k_y$ | $114000.0$ | $\text{Pa}\cdot\text{m}^{1/2}$ | `sourced` | Takeda et al. (2008) Fig 3(a) ($114\text{ MPa}\cdot\mu\text{m}^{1/2}$). |
| | Single-crystal CRSS | $\tau_c$ | $27.5\times 10^6$ | Pa | `sourced` | Spitzig & Keh (1970) for $\{110\}\langle 111\rangle$ at 295 K. |
| | Taylor factor | $M_T$ | $2.75$ | — | `sourced` | Rosenberg & Piehler (1971) pencil glide BCC. Verified. |
| | Grain boundary barrier | $\tau^*_{ref}$ | `null` | Pa | `calibrated` | Unresolved awaiting Phase 6 calibration. Verified. |
| **Ferritic Steel** | Lattice constant | $a$ | $2.8670\times 10^{-10}$ | m | `sourced` | Smithells Ch. 15. Verified. |
| | Burgers vector | $b$ | $2.48289\times 10^{-10}$ | m | `calculated` | $a\sqrt{3}/2$ for BCC. Numerically verified within $10^{-6}\text{ nm}$. |
| | Shear modulus | $G$ | $81.0\times 10^9$ | Pa | `sourced` | Smithells Ch. 15. Verified. |
| | Poisson's ratio | $\nu$ | $0.290$ | — | `sourced` | ASM Handbook Vol. 1. Verified. |
| | Friction stress | $\sigma_0$ | $61.0\times 10^6$ | Pa | `sourced` | Takeda et al. (2008) Fig 3(a) C60 steel formula. Verified. |
| | HP coefficient | $k_y$ | $516000.0$ | $\text{Pa}\cdot\text{m}^{1/2}$ | `sourced` | Takeda et al. (2008) Fig 3(a) ($516\text{ MPa}\cdot\mu\text{m}^{1/2}$). |
| | Single-crystal CRSS | $\tau_c$ | $35.0\times 10^6$ | Pa | **`needs_citation`** | **Corrected from `sourced`**: Spitzig & Keh tested pure iron; 35 MPa is an estimated solute-friction CRSS. |
| | Taylor factor | $M_T$ | $2.75$ | — | `sourced` | Rosenberg & Piehler (1971) pencil glide BCC. Verified. |
| | Grain boundary barrier | $\tau^*_{ref}$ | `null` | Pa | `calibrated` | Unresolved awaiting Phase 6 calibration. Verified. |

---

## 4. Micrograph Metadata & Licensing Audit

All four metallographic images in [`data/micrographs/`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/data/micrographs/) were audited against primary repository records:

| File Name | Material & Purity | Etchant | Magnification Record | Scale Bar | Measured Pixels | Resolution | Licence | Public Web Bundle Policy |
|---|---|---|---|---|---|---|---|---|
| `aluminium_al995_doitpoms609.jpg` | Al 99.5% (AA1050) | Anodised / Polarized | **Estimated (~250x)** | $40.0\,\mu\text{m}$ | $100\text{ px}$ | $0.4000\,\mu\text{m/px}$ | CC BY-NC-SA 4.0 | Non-Commercial; **retained locally only** |
| `copper_cu997_doitpoms436.jpg` | Cu 99.7% (Wrought) | Ammonium persulphate | **Estimated (~100x)** | $200.0\,\mu\text{m}$ | $291\text{ px}$ | $0.6873\,\mu\text{m/px}$ | CC BY-NC-SA 4.0 | Non-Commercial; **retained locally only** |
| `ferritic_steel_fe202.jpg` | Ferritic Steel (0.1% C) | 2% Nital | **Estimated (~100x)** | $200.0\,\mu\text{m}$ | $292\text{ px}$ | $0.6849\,\mu\text{m/px}$ | CC BY-NC-SA 4.0 | Non-Commercial; **retained locally only** |
| `pure_iron_ferpur100x.jpg` | Pure $\alpha$-Iron (>99.9%) | 2% Nital | **Author recorded (100x)** | $100.0\,\mu\text{m}$ | $451\text{ px}$ | $0.2217\,\mu\text{m/px}$ | CC BY-SA 3.0 | Compatible with public web attribution |

### 4.1 Micrograph Audit Findings:
1. **Scale Bar Verification:** Physical scale bars are visibly burned into all 4 images. Pixel lengths and physical dimensions are verified.
2. **Magnification Provenance:** Only `pure_iron_ferpur100x.jpg` has an author-recorded magnification (100x). The three DoITPoMS micrographs record scale bars ($40\,\mu\text{m}, 200\,\mu\text{m}$), from which nominal magnifications (~250x, ~100x) were estimated.
3. **Public Bundle Protection:** The CC BY-NC-SA 4.0 restriction on the three Cambridge DoITPoMS micrographs prohibits unapproved redistribution in public web assets. The proposed architecture in [`openspec/changes/hpsim-static-hosting/`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/openspec/changes/hpsim-static-hosting/) correctly keeps raw micrographs outside the client-side static build bundle.

---

## 5. Automated Validation Script Audit (`scripts/validate_data_acquisition.py`)

### 5.1 Capabilities and Enforcement
The automated verification script ([`scripts/validate_data_acquisition.py`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/scripts/validate_data_acquisition.py)) was expanded to enforce rigorous scientific integrity:
1. **Test 1 (`test_materials_yaml`):** Checks YAML schema, allowed status enums (`sourced`, `calculated`, `calibrated`, `illustrative`, `needs_citation`), Burgers vector geometry ($b = a/\sqrt{2}$ and $a\sqrt{3}/2$), and unresolved `tau_star_ref` (`null` + `calibrated`).
2. **Test 2 (`test_verified_literature_fits`):** Verifies all 8 literature fits, unit conversions ($\text{MPa}\cdot\mu\text{m}^{1/2} \times 1000 = \text{Pa}\cdot\text{m}^{1/2}$), and prohibits deprecated/corrupted DOIs.
3. **Test 3 (`test_candidate_datasets_csv`):** Enforces data taxonomy (`OBSERVED_SOURCE_DATA`, `RECONSTRUCTED_FROM_FIT`, `UNVERIFIED_CANDIDATE`). Strictly forbids unsupported synthetic uncertainties on reconstructed points and forbids reconstructed points from claiming calibration/validation splits. Cross-checks companion dataset.
4. **Test 4 (`test_micrographs_metadata`):** Verifies CSV schema, file existence, and positive scale-bar dimensions.
5. **Test 5 (`test_download_manifest`):** Cryptographically verifies 100% SHA-256 match against physical disk files.
6. **Test 6 (`test_sources_and_materials_provenance`):** Cross-checks bibliography in `SOURCES.md` and `materials.yaml` for correct DOIs and ensures copper purity is explicitly recorded as 99.999%.

### 5.2 Test Execution Status
```text
================================================================================
HPSIM SCIENTIFIC DATA AUDIT HARNESS
================================================================================
[TEST 1] Validating src/hpsim/materials/materials.yaml...
  -> PASS: materials.yaml is syntactically valid with verified Burgers vectors.
[TEST 2] Validating verified literature fits in data/literature/hall_petch_verified_fits.csv...
  -> PASS: hall_petch_verified_fits.csv contains 8 verified literature fits with valid DOIs and unit conversions.
[TEST 3] Auditing data points in data/literature/hall_petch_datasets.csv and companion data/literature/hall_petch_datasets_candidate.csv...
  -> PASS: All 40 dataset rows strictly conform to provenance and uncertainty audit rules.
[TEST 4] Validating data/micrographs/metadata.csv...
  -> PASS: metadata.csv matches schema and all 4 micrographs exist.
[TEST 5] Validating data/literature/download_manifest.csv...
  -> PASS: download_manifest.csv verified against physical files with 100% SHA-256 match.
[TEST 6] Validating DOI provenance and Copper purity across SOURCES.md and materials.yaml...
  -> PASS: All bibliographic DOIs and purity specifications verified against publisher records.
================================================================================
ALL AUTOMATED INTEGRITY AND AUDIT CHECKS PASSED (GREEN)
================================================================================
```

### 5.3 Explicit Validator Limitations
> [!CAUTION]
> **What the Validator Cannot Prove:**
> - Passing tests verify syntactic validity, schema compliance, geometric arithmetic, cryptographic hash matches, and absence of known corrupted DOIs.
> - A passing test **does not** prove that historical published measurements were free from experimental error or metallurgical variations.
> - Scholarly provenance requires human review of the underlying literature.

---

## 6. Static Hosting Proposal Reconciliation

The change proposal at [`openspec/changes/hpsim-static-hosting/`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/openspec/changes/hpsim-static-hosting/) was reviewed:
- **Proposal Status:** Remains **DRAFT (Awaiting Human Approval)**.
- **Specification Hierarchy:** The root [`spec.md`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/spec.md) remains the primary source of truth.
- **Separation of Concerns:** React + TypeScript + Vite + Three.js is proposed for the client-side public presentation, while Python is preserved as the offline reference environment.
- **Zero Runtime Leaks:** No runtime backend, database, or network dependency is introduced.
- **Micrograph Protection:** Unlicensed raw high-resolution micrographs are excluded from public static bundles.

---

## 7. Quality Gate 0 Checklist

| Gate 0 Requirement | Description | Current Audit Status | Evidence / Notes |
|---|---|---|---|
| **M1: Micrographs on Disk** | 4 experimental micrographs in `data/micrographs/` | **VERIFIED** | All 4 files present with verified SHA-256 hashes in `download_manifest.csv`. |
| **M2: Micrograph Metadata** | `metadata.csv` matching `spec.md` schema | **VERIFIED** | Verified physical scale bars, known etchants, and honestly distinguished magnifications. |
| **M3: Grain Size Sweep** | Micrograph count vs grain size variation | **NEEDS USER APPROVAL** | 1 micrograph per material currently acquired. Confirm use of rescaled-micrograph sweep (FR-10) or provide additional images. |
| **M4: Twin Boundary Policy** | Policy for annealing twins in copper | **NEEDS USER APPROVAL** | Default adopted: exclude twin boundaries from lineal intercept $d$ per ASTM / Hansen & Ralph (1982). |
| **M5: Steel Phase Policy** | Phase of interest in ferritic steel | **NEEDS USER APPROVAL** | Default adopted: ferrite phase only; pearlite/carbides masked. |
| **M6: Material Parameter Table** | Provenance of parameters in `materials.yaml` | **NEEDS USER APPROVAL** | Audited and corrected: DOIs fixed, Cu purity fixed, ferritic steel $\tau_c$ classified as `needs_citation`. |
| **Independent Raw Data Validation** | Truly independent measured data for calibration/validation | **BLOCKED** | Primary literature reports regression equations, not raw tensile test tables. Validation is currently restricted to literature fit comparisons. |
| **Gate 0 Formal Sign-Off** | Explicit authorization to freeze requirements and start Phase 1 | **AWAITING USER DECISION** | Requirements are audited and ready for review; awaiting human sign-off. |

---

## 8. Concise List of Outstanding User Decisions

To proceed past Gate 0, the user must provide decisions on the following items:

1. **Gate 0 Sign-Off:** Formally approve Gate 0 to freeze requirements and authorize proceeding to Phase 1 (Core Physics & Slip Geometry).
2. **Decision M3 (Grain Size Sweep):** Approve the use of rescaled-micrograph sweeps (FR-10) to emulate multi-grain-size distributions across the single verified micrograph per material.
3. **Decision M4 (Copper Twin Boundaries):** Confirm the policy to exclude annealing twin boundaries from lineal intercept grain size $d$ for copper.
4. **Decision M5 (Ferritic Steel Phase):** Confirm the policy to segment and analyze ferrite grains only, masking pearlite.
5. **Decision M6 (Material Parameters):** Formally approve the audited parameter table in [`src/hpsim/materials/materials.yaml`](file:///c:/Users/toshr/OneDrive/Desktop/Hari@Work/Shri%20Hari%20-%20Official%20Documents/IIT%20KGP/Meta%20Project/src/hpsim/materials/materials.yaml).
6. **Hosting Proposal (ADR-009):** Confirm approval to proceed with the static hosting architecture (React + TS + Vite + Three.js client, offline Python reference).

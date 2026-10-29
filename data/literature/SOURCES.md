# Sources and Annotated Bibliography for HPSim

This document provides complete bibliographic citations, permanent identifiers (DOIs/ISBNs/URLs), evidence locations, parameters supported, and scientific limitations for all reference sources utilized in the `hpsim` material property database and experimental validation suite.

---

## 1. Primary Experimental Literature

### 1.1 Aluminium
- **Reference:** Hansen, Niels. (1977). "The effect of grain size and strain on the tensile flow stress of aluminium at room temperature." *Acta Metallurgica*, 25(8), pp. 863–869.
  - **DOI:** [10.1016/0001-6160(77)90171-7](https://doi.org/10.1016/0001-6160(77)90171-7)
  - **Evidence Location:** Table 1 (batch compositions and grain sizes), Table 2 (Hall–Petch parameters at various strains, p. 865), Figures 2 & 3.
  - **Supported Quantities:** Reported Hall–Petch regression parameters ($\sigma_y = \sigma_0 + k_y d^{-1/2}$) at 0.2% offset strain across mean intercept grain sizes ($d = 25$ to $450\,\mu\text{m}$) for 99.999% Al ($\sigma_0 = 10.0\text{ MPa}$, $k_y = 0.067\text{ MPa}\cdot\text{m}^{1/2} = 67.0\text{ MPa}\cdot\mu\text{m}^{1/2}$) and commercial purity 99.5% Al / AA1050 ($\sigma_0 = 16.5\text{ MPa}$, $k_y = 0.078\text{ MPa}\cdot\text{m}^{1/2} = 78.0\text{ MPa}\cdot\mu\text{m}^{1/2}$).
  - **Limitations & Assumptions:** Tensile testing performed at room temperature ($293\text{ K}$) and low strain rate ($10^{-4}\text{ s}^{-1}$). High-purity Al exhibits low friction stress and rapid recovery; grain size measured by linear intercept. The author reported aggregate regression fits and plots, not raw individual tensile test machine specimen records.

### 1.2 Copper
- **Reference:** Hansen, Niels, and Ralph, Brian. (1982). "The strain and grain size dependence of the flow stress of copper." *Acta Metallurgica*, 30(2), pp. 411–417.
  - **DOI:** [10.1016/0001-6160(82)90221-8](https://doi.org/10.1016/0001-6160(82)90221-8)
  - **Evidence Location:** Table 1 (batch grain sizes, p. 413), Figures 1 & 4.
  - **Supported Quantities:** Reported Hall–Petch regression parameters at 0.2% offset for 99.999% high-purity copper across grain sizes $d = 12$ to $220\,\mu\text{m}$: $\sigma_0 = 20.0\text{ MPa}$, $k_y = 0.125\text{ MPa}\cdot\text{m}^{1/2}$ ($125\text{ MPa}\cdot\mu\text{m}^{1/2}$).
  - **Limitations & Assumptions:** High-purity (99.999%) polycrystalline copper containing annealing twins. Twins were excluded from mean lineal intercept grain size determination in accordance with standard ASTM practice.
- **Reference:** Feltham, P., and Meakin, J. D. (1957). "On the mechanism of work hardening in face-centred cubic metals, with special reference to polycrystalline copper." *Philosophical Magazine*, 2(13), pp. 105–112.
  - **DOI:** [10.1080/14786435708231728](https://doi.org/10.1080/14786435708231728)
  - **Evidence Location:** Figure 2 (room-temperature tensile curves for 99.95% Cu with grain sizes $14$ to $150\,\mu\text{m}$, p. 108).
  - **Supported Quantities:** Reported regression line for polycrystalline copper ($\sigma_0 \approx 23.5\text{ MPa}$, $k_y \approx 0.144\text{ MPa}\cdot\text{m}^{1/2}$).

### 1.3 Pure $\alpha$-Iron and Ferritic Steel
- **Reference:** Takeda, Kengo; Nakada, Nobuo; Tsuchiyama, Toshihiro; and Takaki, Setsuo. (2008). "Effect of Interstitial Elements on Hall–Petch Coefficient of Ferritic Iron." *ISIJ International*, 48(8), pp. 1122–1125.
  - **DOI:** [10.2355/isijinternational.48.1122](https://doi.org/10.2355/isijinternational.48.1122)
  - **Evidence Location:** Table 1 (chemical compositions in mass ppm), Figure 2 (EBSD orientation maps), Figure 3(a) (Hall–Petch regression formulas for IF-steel, Base pure iron, C30, C60, p. 1123), Figure 4, Equation (1).
  - **Supported Quantities:** Disentangles interstitial-free $\alpha$-iron from carbon-segregated ferritic steel:
    - *Ti-stabilized IF-iron* (4 ppm C, 240 ppm Ti): $\sigma_0 = 56.0\text{ MPa}$, $k_y = 0.114\text{ MPa}\cdot\text{m}^{1/2}$ ($114\text{ MPa}\cdot\mu\text{m}^{1/2}$).
    - *Base pure iron* (5 ppm C, 9 ppm N): $\sigma_0 = 72.0\text{ MPa}$, $k_y = 0.188\text{ MPa}\cdot\text{m}^{1/2}$ ($188\text{ MPa}\cdot\mu\text{m}^{1/2}$).
    - *C60 low-carbon ferritic steel* (56 ppm C): $\sigma_0 = 61.0\text{ MPa}$, $k_y = 0.516\text{ MPa}\cdot\text{m}^{1/2}$ ($516\text{ MPa}\cdot\mu\text{m}^{1/2}$).
  - **Limitations & Assumptions:** Specimens water quenched after 973 K annealing to maintain solute state. Grain sizes measured by quadrature intercept method on high-angle boundaries ($\theta > 15^\circ$). Discrete tensile specimen data points are plotted as scatter in Figure 3(a) but individual tabular numerical values are not reported.
- **Reference:** Armstrong, R.; Codd, I.; Douthwaite, R. M.; and Petch, N. J. (1962). "The plastic deformation of polycrystalline aggregates." *Philosophical Magazine*, 7(73), pp. 45–58.
  - **DOI:** [10.1080/14786436208201857](https://doi.org/10.1080/14786436208201857)
  - **Evidence Location:** Table 1 and Figure 1 (mild steel lower yield stress vs. $d^{-1/2}$, p. 49).
  - **Supported Quantities:** Reported fit for mild steel ($0.15\text{ wt\% C}$): $\sigma_0 \approx 68\text{ MPa}$, $k_y \approx 0.620\text{ MPa}\cdot\text{m}^{1/2}$.

---

## 2. Standard Handbooks and Physical Constants

- **Frost, H. J., and Ashby, M. F.** (1982). *Deformation-Mechanism Maps: The Plasticity and Creep of Metals and Ceramics*. Pergamon Press, Oxford. ISBN: 0-08-029309-9.
  - *Data extracted:* Table 4.1 (Pure Al and Cu lattice parameters, temperature-dependent shear moduli $G$, Burgers vectors, melting points); Table 8.1 (Pure $\alpha$-Fe $a = 0.28665\text{ nm}$, $G(300\text{ K}) = 81.6\text{ GPa}$, $b = 0.248\text{ nm}$).
- **Gale, W. F., and Totemeier, T. C. (Eds.)** (2004). *Smithells Metals Reference Book*, 8th Edition. Butterworth-Heinemann. ISBN: 978-0-7506-7509-3.
  - *Data extracted:* Chapters 14 & 15 (Crystal structures, lattice constants at 293 K, elastic constants $C_{ij}$, isotropic aggregate shear moduli $G$, Poisson's ratio $\nu$).
- **ASM International Handbook Committee.** (1990). *ASM Handbook, Volume 1: Properties and Selection: Irons, Steels, and High-Performance Alloys* (ISBN: 978-0-87170-377-4) & *Volume 2: Properties and Selection: Nonferrous Alloys and Special-Purpose Materials* (ISBN: 978-0-87170-378-1). Materials Park, OH.
  - *Data extracted:* Pure Al, pure Cu, pure Fe, and plain carbon steels room-temperature elastic moduli and Poisson's ratios.
- **Hirth, John P., and Lothe, Jens.** (1982). *Theory of Dislocations*, 2nd Edition. John Wiley & Sons, New York. ISBN: 978-0-471-09125-7.
  - *Data extracted:* Table 21-1 (Single-crystal critical resolved shear stresses $\tau_c$ at room temperature for FCC Al, Cu and BCC $\alpha$-Fe); Chapter 21 (Dislocation pile-up equilibrium and tip stress formulation).
- **Diehl, J.** (1956). "Zugverformung von Kupfer-Einkristallen." *Zeitschrift für Metallkunde*, 47(5), pp. 331–343. [DOI: 10.1515/ijmr-1956-470508](https://doi.org/10.1515/ijmr-1956-470508).
  - *Data extracted:* Room-temperature single-crystal CRSS for high-purity copper ($\tau_c \approx 0.65\text{ MPa}$).
- **Spitzig, W. A., and Keh, A. S.** (1970). "Orientation and temperature dependence of slip in iron single crystals." *Metallurgical Transactions*, 1(10), pp. 2751–2757. [DOI: 10.1007/bf03037811](https://doi.org/10.1007/bf03037811).
  - *Data extracted:* Room-temperature CRSS for $\{110\}\langle 111\rangle$ slip in pure $\alpha$-iron single crystals ($\tau_c \approx 27.5\text{ MPa}$).
- **Rosenberg, J. M., and Piehler, H. R.** (1971). "Calculation of the taylor factor and lattice rotations for bcc metals deforming by pencil glide." *Metallurgical Transactions*, 2(1), pp. 257–259. [DOI: 10.1007/bf02662666](https://doi.org/10.1007/bf02662666).
  - *Data extracted:* Taylor factor $M_T = 2.75$ for BCC pencil glide ($\{110\}$ and $\{112\}$ slip).
- **Bishop, J. F. W., and Hill, R.** (1951). "A theory of the plastic distortion of a polycrystalline aggregate under combined stresses." *Philosophical Magazine*, 42(327), pp. 414–427. [DOI: 10.1080/14786445108561065](https://doi.org/10.1080/14786445108561065).
  - *Data extracted:* Taylor factor $M_T = 3.06$ for untextured FCC polycrystals.

---

## 3. Data Classification and Provenance Standards

To preserve scientific integrity, HPSim distinguishes four data tiers:

1. **`OBSERVED_SOURCE_DATA`**: Individual measured physical data points supported directly by a published tabular record or by documented, calibrated digitization of an experimental plot.
2. **`REPORTED_LITERATURE_FIT`**: Author-reported regression equations or coefficients ($\sigma_0, k_y$) published directly in peer-reviewed literature.
3. **`RECONSTRUCTED_FROM_FIT`**: Synthetic discrete $(d, \sigma_y)$ points calculated along published regression equations. These points serve exclusively to illustrate or benchmark against the regression line; they are not independent physical measurements and must not be used to calibrate or validate that same relationship.
4. **`UNVERIFIED_CANDIDATE`**: Values whose underlying empirical evidence is pending verification.

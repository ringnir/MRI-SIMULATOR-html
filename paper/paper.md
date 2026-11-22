---
title: 'MRI Parameter Simulator Pro: an offline, single-file educational simulator of clinical MRI protocols'
tags:
  - JavaScript
  - MRI
  - magnetic resonance imaging
  - medical education
  - radiology
  - extended phase graphs
authors:
  - name: Rintaro Ito
    # TODO: add the author's ORCID iD
    # orcid: 0000-0000-0000-0000
    affiliation: 1
affiliations:
  - name: Department of Innovative Biomedical Visualization, Nagoya University Graduate School of Medicine, Nagoya, Japan
    index: 1
date: 22 November 2026
bibliography: paper.bib
---

# Summary

MRI Parameter Simulator Pro is an educational MRI simulator that runs in a web browser from a single HTML file, with no installation, network connection or external libraries. The user selects one of 12 analytic virtual phantoms (three head sections, heart, breast, two upper-abdominal levels, female and male pelvis, lumbar spine, shoulder and knee) with optional lesions, one of 60 clinical pulse sequences, and the field strength. Changing acquisition parameters (timing, flip angle, echo train, resolution, acceleration, fat suppression and others) immediately updates the simulated image, scan time, signal-to-noise ratio (SNR), specific absorption rate (SAR), tissue-contrast curves and a diagram of k-space filling. The interface is available in Japanese, English and Simplified Chinese.

# Statement of need

Radiology residents, radiographers and educators need an intuitive grasp of how protocol parameters trade contrast, resolution, SNR, scan time and artifacts against each other. Scanner time for practice is scarce, sequence names differ between vendors, and many hospital computers forbid software installation or restrict internet access. The software addresses these needs with whole-body clinical sequences, lesion-bearing anatomy, a vendor-name table and a file that opens offline on any computer. A learning mode limits the interface to 15 common sequences, each with its key parameters, teaching points and presets.

# State of the field

Browser-based educational simulators include Virtual Scanner [@Tong2019] and its tutorial extension, Virtual Scanner Games [@Tong2024]; VirtMRI, which also covers sodium imaging [@Tonnes2023]; SpinSight, which jointly visualizes the pulse sequence, k-space and image [@Berglund2025]; eduMRIsim [@GonzalezRiedel2025]; and the Valladolid web-based simulator [@Treceno2019], which is one of the few with a randomized classroom evaluation [@Treceno2021]. Corsmed is a commercial web-based simulator [@Corsmed]; its founders have described the GPU and cloud simulation platforms MRISIMUL and coreMRI [@Xanthis2014; @Xanthis2019]. Research simulators such as KomaMRI [@CastilloPassi2023], JEMRIS [@Stocker2010], MRiLab [@Liu2017] and MRSeqStudio [@Villacorta2026] simulate user-defined pulse sequences by solving the Bloch or Bloch–McConnell equations and are aimed mainly at sequence development and research. Earlier teaching tools include Hanson's Bloch simulator [@Hanson2007] and Virtual MRI [@Hacklander2005]. To our knowledge, none of these combines a whole-body set of clinical protocols and lesions, multi-vendor naming, multilingual output that includes Japanese, and a dependency-free file that runs offline. The present software trades arbitrary pulse sequences for breadth of clinical protocols and immediate feedback.

# Functionality

- 60 sequences, from spin echo, inversion recovery and gradient echo to diffusion, angiography, cardiac, Dixon fat quantification, perfusion, UTE, elastography and spectroscopy.
- Curves of signal, contrast-to-noise ratio, scan time or SAR against any parameter, and two-parameter maps.
- Artifacts such as aliasing, motion ghosts, chemical shift, susceptibility, EPI distortion and banding.
- Sequence and option names for Siemens Healthineers, GE HealthCare, Philips, Canon Medical Systems, Fujifilm and United Imaging Healthcare, each flagged as confirmed by vendor documentation, by a third-party comparison table, or unverified (shown as "—").
- A precise mode using extended phase graphs (EPG) [@Weigel2015], which models stimulated echoes and RF spoiling, and a Bloch-equivalent mode for spin echo, fast spin echo, inversion recovery, 2D spoiled gradient echo and balanced SSFP.

# Software design

The source is plain ES5 JavaScript in small modules. Sequences, parameters and learning items register themselves through `MS.addSeq`, `MS.addParam` and `MS.addLearn`, so a new sequence or phantom is added by dropping one file into `src/seq/` or `src/ph/`. A Python script builds one HTML file per language, translating string literals from dictionaries; computation runs in a Web Worker.

For each tissue, the default engine computes the signal from closed-form or numerically evaluated signal equations (spin echo, inversion recovery, spoiled gradient echo, balanced SSFP steady state, MPRAGE and MP2RAGE) using per-tissue relaxation, proton density, diffusion, fat fraction and susceptibility; these are rounded literature values (e.g., @Stanisz2005) or estimates, listed with sources in the interface. The phantom, a 1024 × 1024 label image, is sampled to the chosen field of view, modulated in k-space (echo-train decay, motion, partial Fourier) and combined with coil sensitivity, noise and the parallel-imaging g-factor. In the Bloch-equivalent mode, magnetization is computed per pixel with that pixel's B1 and off-resonance, and each k-space sample is formed by direct summation over pixels, so chemical shift, off-resonance distortion, T2\* blurring and through-slice dephasing arise from the signal equation rather than from pixel-shift approximations.

# Quality control

Node scripts run every phantom with every sequence at 1.5 T and 3 T (1,440 runs) checking for errors and non-finite values, repeat this in the EPG and Bloch-equivalent modes, check the learning-mode settings, and compare EPG against a direct isochromat Bloch simulation (720 isochromats) for CPMG echo trains with refocusing angles of 120–180° and reduced B1, RF-spoiled gradient echo, FISP and PSIF. The maximum relative error over these 23 conditions is 1.53%. Continuous integration runs these tests and checks that the committed builds are current and fully translated.

# Limitations

The software is an educational approximation, not a medical device. Phantoms are schematic 2D drawings, tissue values are representative, and scan time, SNR and SAR do not reproduce scanner values. Vendor names depend on software version and region. The Bloch-equivalent mode does not yet cover EPI, 3D acquisitions, motion, flow phase or parallel-imaging reconstruction. Developer documentation is currently in Japanese only.

# Research impact statement

The simulator has been publicly available on GitHub Pages since November 2026. Its effect on learning has not been evaluated, and no claim of educational effectiveness is made. <!-- TODO: add concrete evidence of use (courses, institutions, number of learners) and any planned evaluation before submission. -->

# AI usage disclosure

The software, its tests and documentation, and this paper were developed with substantial assistance from an AI coding assistant (Anthropic Claude). The author reviewed the generated code and text and is responsible for the content. Correctness was checked with the automated tests and the EPG-versus-Bloch comparison described above, and all references were checked against Crossref or PubMed. <!-- TODO: optionally describe in more detail which parts were AI-generated and how they were reviewed. -->

# Acknowledgements

Conflict of interest: the author belongs to an industry–academia collaborative chair at Nagoya University funded by Canon Inc. The software was created by the author as an individual; it was not commissioned, funded or reviewed by Canon or any other vendor, and it is not an official tool of any vendor. Vendor names are trademarks of their respective owners.

<!-- TODO: funding statement (e.g., grants that supported this work, or "This work received no specific funding."). -->

# References

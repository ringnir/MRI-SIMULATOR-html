<h1 align="center">MRI Parameter Simulator Pro (whole-body edition)</h1>

<p align="center">
  Change acquisition parameters and watch the <strong>virtual-phantom image, scan time, SNR, SAR and tissue-contrast curves</strong> update instantly.<br>
  An educational MRI simulator in a single HTML file that runs offline.
</p>

<p align="center">
  <a href="https://ringnir.github.io/MRI-SIMULATOR-html/en.html"><strong>▶ Open in the browser</strong></a>
  　|　
  <a href="https://ringnir.github.io/MRI-SIMULATOR-html/en.html#learn"><strong>▶ Learning mode</strong></a>
  　|　
  <a href="README.md">日本語</a> · <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="docs/images/screen-expert.png" width="880" alt="Expert mode: parameters on the left, virtual-phantom image and estimates in the middle, contrast chart on the right">
</p>

> [!WARNING]
> **Educational approximation only. Do not use it for clinical decisions or scanner settings.** Tissue values are rounded literature values or estimates, and the virtual phantoms are analytic schematic drawings. Images, scan time, SNR and SAR do not reproduce any scanner's displayed values. This is not a medical device.

> [!NOTE]
> **Unofficial tool.** Not an official tool of Siemens Healthineers, GE HealthCare, Philips, Canon Medical Systems, Fujifilm or United Imaging Healthcare, and not commissioned, funded or reviewed by any vendor. Vendor sequence and feature names are shown only to indicate correspondence; they are trademarks or registered trademarks of their respective owners. Names can differ by software version and region — check the protocol names on your own scanner. Names that could not be verified are shown as "—".

> [!NOTE]
> **Disclosure:** The author belongs to an industry-academia collaborative chair at Nagoya University funded by Canon Inc. This tool was created by the author as an individual.

## Features

| | |
|---|---|
| 🧠 **12 virtual phantoms** | Head (basal ganglia, posterior fossa / IAC, midsagittal), chest (heart), breast, upper abdomen (pancreatic body, renal hilum), pelvis (female, male), lumbar spine, shoulder, knee — with switchable lesions |
| 🎛️ **60 sequences** | SE/FSE/IR, GRE, SSFP, diffusion (DWI, DTI, readout-segmented, zoomed), MRA (TOF, PC, FBI, Time-SLIP, QISS, CE-MRA), cardiac (cine, LGE, MOLLI), Dixon/PDFF, MRCP, ASL, BOLD, DSC, UTE, MRE, MRS |
| 🔧 **Nearly every parameter** | TR, TE, TI, flip angle, ETL, echo spacing, bandwidth, matrix, FOV, slices; parallel imaging (GRAPPA/SENSE, CAIPIRINHA), SMS, compressed sensing, partial Fourier, deep-learning reconstruction; fat suppression; respiratory/ECG gating; contrast phases |
| 📈 **Contrast chart** | Any parameter on the x-axis; signal, CNR, scan time or SAR on the y-axis, with the current value marked. 2D maps of two parameters |
| 🧮 **Precise / Bloch-equivalent modes** | Tissue signals by extended phase graphs (EPG; FSE stimulated echoes and RF spoiling match the Bloch equations). Bloch-equivalent mode builds the image from per-pixel magnetization and the signal equation |
| 🧩 **k-space filling** | Acquired lines, parallel-imaging undersampling, partial Fourier, FSE echo order, EPI trajectory, radial schemes (expert mode) |
| 🏷️ **Vendor name table** | Siemens, Canon, GE, Philips, Fujifilm, United Imaging (with confidence flags) |
| 📱 **Smartphone layout** | Image and estimates stay pinned at the top; tabs at the bottom switch between anatomy, parameters, chart and details |
| 🎨 **Themes** | Standard, Light, Dark (for reading rooms) and Warm (default), switchable at the top right |
| 🎓 **Learning mode** | 15 common sequences with only the parameters that matter for learning, teaching points and presets |
| 🎯 **Optimize for a goal** | One-click buttons — shorter scan, higher SNR, finer resolution, higher CNR, lower SAR — adjust parameters while respecting constraints (time, SNR, SAR, resolution). Review the before/after table, then apply or undo |
| 🏆 **Tasks with auto-grading** | 11 tasks such as *Make a T2-weighted image*, *Remove aliasing* and *Reduce metal artifacts*. Automatic pass/fail, graded hints, and CSV export of time, hints used and changes made (usable for education research) |
| 🔗 **Share by link** | Region, sequence, parameters and chart settings are encoded in the URL; opening the link restores the same conditions |
| ⚖️ **Compare two conditions** | Compare a pinned image with the current one side by side, with a slider, or as a difference image, plus a table of changed parameters and time/SNR/SAR |
| 📐 **Pulse sequence diagram** | RF, slice, phase, readout, ADC and signal timing drawn from the current parameters (TE, TR, ETL, TI, EPI…) |
| ♿ **Accessibility** | Chart lines differ by dash pattern as well as color, keyboard operation (arrow keys read chart values), text descriptions for images and charts |

## Use

- **Online:** <https://ringnir.github.io/MRI-SIMULATOR-html/en.html>
- **As a file:** download [`en.html`](en.html) and open it in Chrome, Edge, Safari or Firefox. No installation or network needed; nothing you enter is sent anywhere.
- Add `#learn` for learning mode or `#expert` for expert mode.

## Development

```
python3 build.py en.html --public --lang=en   # build the English public version
python3 build.py zh.html --public --lang=zh   # Simplified Chinese
python3 build.py index.html --public          # Japanese
node tests/all.js                              # all phantoms × all sequences × 1.5/3 T
```
Translations are in `i18n/` (Japanese source string → translation); the build replaces string literals in `src/` and text in `src/ui.html`.

## Extending

New sequences, techniques and phantoms are added by **dropping a file** into `src/seq/` (sequences, via `MS.addSeq`) or `src/ph/` (phantoms); the build picks them up automatically. Reuse an existing signal model in a few lines (`src/seq/se_t2.js`) or write a new one in `run` (`src/seq/se_dual.js`). Parameters: `MS.addParam`; learning items: `MS.addLearn`. Untranslated strings are listed in `i18n/missing_*.json` after a build. Details (Japanese): [docs/EXTENDING.md](docs/EXTENDING.md).

## Contributing

For bug reports, vendor-name corrections and proposals, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Citation

Please cite this software using the metadata in [CITATION.cff](CITATION.cff) ("Cite this repository" on GitHub gives APA and BibTeX). A DOI will be added after the first Zenodo release.

## License

[MIT License](LICENSE). No third-party code, fonts or images are included.

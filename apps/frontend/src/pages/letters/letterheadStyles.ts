export const LETTERHEAD_CSS = String.raw`
  :root {
    --ls-text-primary: var(--text-primary);
    --ls-text-secondary: var(--text-secondary);
    --ls-border: var(--border-light);
    --ls-surface-1: var(--bg-primary);
    --ls-surface-2: var(--bg-card);
    --ls-accent: var(--accent);
    --ls-accent-dark: #6a9e2e;
    --ls-accent-soft: rgba(141, 198, 63, .12);
    --ls-line-strong: var(--border-light);
    --ls-shadow: var(--shadow-md, rgba(0, 0, 0, .10));
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background-color: var(--ls-surface-1);
    background-image:
      linear-gradient(135deg, rgba(255,255,255,.72) 0%, rgba(223,242,233,.45) 50%, rgba(255,255,255,.72) 100%),
      repeating-linear-gradient(0deg, rgba(7,88,61,.028) 0, rgba(7,88,61,.028) 1px, transparent 1px, transparent 3px),
      repeating-linear-gradient(90deg, rgba(255,255,255,.34) 0, rgba(255,255,255,.34) 1px, transparent 1px, transparent 4px);
    color: var(--ls-text-primary);
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    min-height: 100%;
  }
  body {
    padding: env(safe-area-inset-top,0px) 16px env(safe-area-inset-bottom,0px);
  }
  

  /* Login screen: two-panel, editorial, green-and-white workspace entry. */
  #authGate {
    position: fixed; inset: 0; z-index: 99999;
    display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(360px, .9fr);
    min-height: 100vh; overflow: auto;
    background: #f4faf7;
    color: #17392c;
    background-image:
      radial-gradient(circle at 16% 18%, rgba(11,122,83,.07), transparent 28%),
      radial-gradient(circle at 88% 82%, rgba(7,88,61,.055), transparent 30%),
      repeating-linear-gradient(0deg, rgba(7,88,61,.024) 0, rgba(7,88,61,.024) 1px, transparent 1px, transparent 4px),
      repeating-linear-gradient(90deg, rgba(255,255,255,.64) 0, rgba(255,255,255,.64) 1px, transparent 1px, transparent 5px);
  }
  #authGate *, #authGate *::before, #authGate *::after { box-sizing: border-box; }
  .auth-stack { display: contents; }
  .auth-visual {
    position: relative; min-height: 100vh; overflow: hidden;
    padding: 54px clamp(34px, 6vw, 90px) 42px;
    display: flex; flex-direction: column; justify-content: space-between;
    border-right: 1px solid #d3e3da;
    background: rgba(248,252,250,.74);
  }
  .auth-visual::before {
    content: ''; position: absolute; width: 520px; height: 520px; border-radius: 50%;
    left: -180px; top: -190px;
    background: rgba(184,222,205,.22);
  }
  .auth-visual::after {
    content: ''; position: absolute; width: 340px; height: 340px; border-radius: 50%;
    right: -120px; bottom: -150px;
    border: 1px solid rgba(11,122,83,.10);
  }
  .auth-visual > * { position: relative; z-index: 2; }
  .auth-brandline { display: flex; align-items: center; gap: 12px; }
  .auth-mark {
    width: 46px; height: 46px; flex: 0 0 46px;
    display: grid; place-items: center;
    border: 1px solid #b7d3c5; border-radius: 14px;
    background: #fff; color: var(--ls-accent-dark);
    font-size: 14px; font-weight: 900; letter-spacing: -.06em;
    box-shadow: 0 8px 22px rgba(7,88,61,.06);
  }
  .auth-brandline strong { display: block; color: #16392d; font-size: 15px; letter-spacing: -.02em; }
  .auth-brandline span { display: block; margin-top: 3px; color: #71857b; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; }
  .auth-visual-copy { max-width: 670px; margin-top: 4vh; }
  .auth-eyebrow {
    display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px;
    border: 1px solid #cfe1d8; border-radius: 999px; background: rgba(255,255,255,.78);
    color: #4c7563; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  }
  .auth-eyebrow::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--ls-accent); }
  .auth-visual h1 {
    margin: 22px 0 0; max-width: 760px;
    color: #173a2d; font-size: clamp(34px, 4vw, 60px); line-height: .98;
    font-weight: 760; letter-spacing: -.055em;
  }
  .auth-visual h1 em { color: var(--ls-accent); font-style: normal; }
  .auth-lede { margin: 18px 0 0; max-width: 560px; color: #5c7469; font-size: 13px; line-height: 1.65; }

  /* Real team photo used on the login screen. */
  .consulting-scene {
    position: relative; margin-top: 28px; width: min(720px, 100%); height: 300px;
    display: block; border: 1px solid #cfe1d8; border-radius: 18px;
    overflow: hidden; background: #fff;
    box-shadow: 0 18px 44px rgba(7,88,61,.08);
  }
  .consulting-photo {
    display: block; width: 100%; height: 100%;
    object-fit: cover; object-position: center;
  }
  .scene-board {
    position: absolute; left: 50%; top: 24px; transform: translateX(-50%);
    width: min(520px, 80%); height: 178px; border: 1px solid #b9d2c6; border-radius: 18px;
    background: rgba(255,255,255,.72); box-shadow: 0 18px 44px rgba(7,88,61,.08);
    overflow: hidden;
  }
  .scene-board::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(transparent 24%, rgba(11,122,83,.055) 25%, transparent 26%),
                linear-gradient(90deg, transparent 24%, rgba(11,122,83,.055) 25%, transparent 26%);
    background-size: 46px 46px;
  }
  .scene-board .line { position: absolute; height: 2px; border-radius: 999px; background: #6cae90; transform-origin: left center; }
  .scene-board .l1 { width: 170px; left: 62px; top: 106px; transform: rotate(-20deg); }
  .scene-board .l2 { width: 115px; left: 218px; top: 48px; transform: rotate(24deg); }
  .scene-board .l3 { width: 128px; left: 332px; top: 95px; transform: rotate(-28deg); }
  .scene-board .node { position: absolute; width: 11px; height: 11px; border-radius: 50%; background: #0b7a53; box-shadow: 0 0 0 5px rgba(11,122,83,.09); }
  .scene-board .n1 { left: 58px; top: 101px; }
  .scene-board .n2 { left: 216px; top: 43px; }
  .scene-board .n3 { left: 328px; top: 90px; }
  .scene-board .n4 { right: 46px; top: 30px; }
  .scene-label { position: absolute; left: 24px; bottom: 20px; color: #729085; font: 700 8px/1 sans-serif; letter-spacing: .14em; text-transform: uppercase; }

  .figure { position: relative; width: 150px; height: 230px; z-index: 4; }
  .figure-a { margin-right: 26px; }
  .figure-b { margin-left: 26px; transform: translateY(10px); }
  .head { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 48px; height: 60px; border-radius: 46% 46% 42% 42%; background: #d8a173; border: 2px solid rgba(41,45,40,.08); }
  .hair { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 56px; height: 26px; border-radius: 60% 60% 42% 38%; background: #1c2a24; }
  .hair.short { width: 54px; height: 22px; top: -2px; border-radius: 56% 56% 38% 38%; }
  .neck { position: absolute; left: 50%; top: 49px; transform: translateX(-50%); width: 16px; height: 24px; background: #c99267; }
  .torso { position: absolute; left: 50%; top: 65px; transform: translateX(-50%); width: 118px; height: 126px; border-radius: 26px 26px 15px 15px; background: linear-gradient(160deg, #18332a 0 48%, #12271f 49% 100%); box-shadow: 0 14px 22px rgba(7,88,61,.10); }
  .shirt { position: absolute; left: 50%; top: 73px; transform: translateX(-50%); width: 46px; height: 56px; background: #fdfefa; clip-path: polygon(20% 0,50% 25%,80% 0,100% 100%,0 100%); }
  .tie { position: absolute; left: 50%; top: 80px; transform: translateX(-50%); width: 12px; height: 70px; background: #0b7a53; clip-path: polygon(24% 0,76% 0,64% 82%,50% 100%,36% 82%); }
  .lapel { position: absolute; top: 74px; width: 42px; height: 74px; background: #254c3c; }
  .lapel.left { left: 24px; clip-path: polygon(0 0,100% 0,66% 100%,25% 66%); }
  .lapel.right { right: 24px; clip-path: polygon(0 0,100% 0,75% 66%,34% 100%); }
  .arm { position: absolute; top: 90px; width: 22px; height: 108px; border-radius: 14px; background: #153026; }
  .arm.left { left: 2px; transform: rotate(8deg); }
  .arm.right { right: 2px; transform: rotate(-7deg); }
  .leg { position: absolute; top: 178px; width: 35px; height: 50px; border-radius: 12px 12px 8px 8px; background: #172821; }
  .leg.left { left: 33px; } .leg.right { right: 33px; }
  .shoe { position: absolute; top: 220px; width: 52px; height: 11px; border-radius: 12px 12px 6px 6px; background: #172019; }
  .shoe.left { left: 18px; } .shoe.right { right: 18px; }
  .figure-b .torso { background: linear-gradient(160deg, #314238 0 48%, #202e28 49% 100%); }
  .figure-b .tie { background: #5e876f; transform: translateX(-50%) rotate(2deg); }
  .figure-b .hair { background: #24342c; }
  .figure-caption { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); padding: 6px 9px; border: 1px solid #cfe1d8; border-radius: 7px; background: rgba(255,255,255,.9); color: #376651; font-size: 8px; font-weight: 800; letter-spacing: .12em; white-space: nowrap; text-transform: uppercase; box-shadow: 0 6px 15px rgba(7,88,61,.06); }
  .auth-visual-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; color: #789086; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
  .auth-visual-footer strong { color: #4a705e; }

  .auth-side {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 42px 46px;
    background: rgba(255,255,255,.90);
  }
  #authCard { width: min(390px, 100%); }
  .auth-form-shell { width: 100%; }
  .auth-side .auth-name { color: #16392d; font-size: 25px; line-height: 1.1; font-weight: 760; letter-spacing: -.035em; }
  .auth-side .auth-product { margin-top: 7px; color: #789086; font-size: 11px; letter-spacing: .04em; }
  .auth-copy { margin: 28px 0 16px; color: #587267; font-size: 12px; line-height: 1.55; }
  .auth-field-label {
    display: block; margin: 0 0 7px; color: #536b60; font-size: 10px; font-weight: 700; letter-spacing: .04em;
  }
  .auth-input-wrap { position: relative; }
  #authPassword {
    width: 100%; height: 48px; padding: 0 70px 0 14px;
    border: 1px solid #cdded6; border-radius: 8px;
    font: 14px/1.35 inherit; background: #fff; color: var(--ls-text-primary);
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  #authPassword::placeholder { color: #9aaba3; }
  #authPassword:focus { border-color: #0b7a53; box-shadow: 0 0 0 3px rgba(11,122,83,.10); outline: none; }
  .auth-forgot-btn { margin: 8px 0 0; padding: 0; border: 0; background: transparent; color: #0b7a53; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; text-align: left; }
  .auth-forgot-btn:hover { text-decoration: underline; }
  .auth-forgot-btn:focus-visible { outline: 2px solid rgba(11,122,83,.35); outline-offset: 3px; border-radius: 3px; }
  .auth-show-btn {
    position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
    border: 0; background: transparent; color: #4d7562; cursor: pointer; padding: 6px 7px;
    font: 700 10px/1 inherit;
  }
  .auth-show-btn:hover { color: #07583d; }
  #authUnlock {
    width: 100%; height: 46px; margin-top: 12px; border-radius: 8px;
    font-size: 13px; font-weight: 800; letter-spacing: .01em;
  }
  .auth-meta { margin-top: 12px; color: #91a29a; font-size: 10px; line-height: 1.5; }
  .auth-divider { height: 1px; background: #e3ece7; margin: 24px 0 17px; }
  .auth-help { color: #7c8d85; font-size: 10px; line-height: 1.5; }
  .auth-quote-wrap { margin-top: 44px; padding-top: 18px; border-top: 1px solid #e3ece7; }
  .auth-quote-label { margin-bottom: 7px; color: #90a39a; font-size: 8px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  .auth-quote { margin: 0; color: #2e604c; font-size: 13px; line-height: 1.45; font-weight: 650; transition: opacity .16s ease; }
  .auth-quote.fade { opacity: .25; }
  .quote-source { margin-top: 7px; color: #8aa097; font-size: 9px; letter-spacing: .04em; }

  #authError { display: none; margin-top: 10px; color: #a04437; font-size: 11px; }
  .auth-mini-footer { margin-top: 32px; color: #9aaba3; font-size: 9px; text-align: center; }
  @media (max-width: 900px) {
    #authGate { grid-template-columns: 1fr; }
    .auth-visual { min-height: 430px; border-right: 0; border-bottom: 1px solid #d3e3da; padding: 32px 28px; }
    .auth-visual h1 { font-size: clamp(34px, 9vw, 48px); max-width: 600px; }
    .consulting-scene { height: 220px; margin-top: 14px; transform: scale(.86); transform-origin: left bottom; width: 116%; }
    .auth-side { min-height: auto; padding: 42px 24px 50px; }
  }
  @media (max-width: 560px) {
    .auth-visual { min-height: 350px; padding: 24px 20px; }
    .auth-lede { font-size: 12px; }
    .consulting-scene { display: none; }
    .auth-visual-footer { font-size: 8px; }
    .auth-side { padding: 34px 20px 40px; }
  }

  .app-quote small { margin-left: 10px; color: #86a096; font-size: 9px; letter-spacing: .03em; }

  .wrap {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 24px;
    padding: 24px 0 48px;
  }
  @media (max-width: 860px) {
    .wrap { grid-template-columns: 1fr; }
  }
  .panel {
    background: var(--ls-surface-2);
    border: 1px solid var(--ls-border);
    border-radius: 10px;
    padding: 18px;
    height: fit-content;
  }
  .panel h2 { font-size: 15px; margin: 0 0 14px; font-weight: 600; }
  label {
    display: block;
    font-size: 12px;
    color: var(--ls-text-secondary);
    margin: 12px 0 4px;
  }
  *, *::before, *::after { box-sizing: border-box; }
  input, select, textarea {
    width: 100%;
    max-width: 100%;
    padding: 8px 10px;
    font-size: 14px;
    border: 1px solid var(--ls-border);
    border-radius: 6px;
    background: var(--ls-surface-2);
    color: var(--ls-text-primary);
  }
  textarea {
    min-height: 42px;
    padding: 8px 10px;
    font-size: 14px;
    border: 1px solid var(--ls-border);
    border-radius: 6px;
    background: var(--ls-surface-2);
    color: var(--ls-text-primary);
    resize: vertical;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--ls-accent);
    box-shadow: 0 0 0 3px rgba(11,122,83,.08);
  }
  .err {
    font-size: 12px;
    color: #d33;
    margin-top: 4px;
    display: none;
  }
  .btnbar {
    margin-top: 18px;
    display: flex;
    gap: 8px;
  }
  .logbox {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--ls-border);
  }
  .logcount {
    font-size: 12px;
    color: var(--ls-text-secondary);
    margin-bottom: 8px;
  }
  #btnExport { width: 100%; }
  button {
    flex: 1;
    padding: 10px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid var(--ls-border);
    background: var(--ls-surface-1);
    color: var(--ls-text-primary);
    cursor: pointer;
  }
  button.primary {
    background: var(--ls-accent);
    border-color: var(--ls-accent);
    color: #fff;
  }
  button:active { transform: scale(0.98); }

  /* ---- Letter / page preview ---- */
  .pageHolder {
    display: flex;
    justify-content: center;
    background: var(--ls-surface-1);
  }
  .pageStack { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
  .pageStack > .page { flex: 0 0 auto; }
  .page {
    box-sizing: border-box;
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    background: #ffffff;
    color: #1a1a1a;
    padding: 10mm 20mm 9mm;
    box-shadow: 0 1px 6px rgba(0,0,0,0.25);
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    position: relative;
    overflow: hidden;
  }
  .watermark {
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background-image: url('data:image/png;base64,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');
    background-repeat: repeat;
    background-size: 90mm 90mm;
    transform: rotate(-30deg);
    pointer-events: none;
    z-index: 0;
  }
  .footer {
    margin-top: 10pt;
    padding-top: 8pt;
    text-align: center;
    font-size: 9.5pt;
    color: #333;
  }
  .footer a { color: #1a1a1a; text-decoration: none; }
  .pagecontent {
    position: relative;
    z-index: 1;
    min-height: calc(297mm - 19mm);
    display: flex;
    flex-direction: column;
  }
  .letterhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 20mm;
  }
  .logo-col {
    flex: 0 0 48%;
    display: flex;
    align-items: center;
  }
  .logo-col.left { justify-content: flex-start; }
  .logo-col.right { justify-content: flex-end; }
  .logobox {
    width: 22mm;
    height: 22mm;
    border: 1px solid #999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8pt;
    color: #999;
    text-align: center;
    flex-shrink: 0;
  }
  .logoimg {
    width: auto;
    flex-shrink: 0;
    display: block;
  }
  .logoimg.vit-logo {
    width: 48mm;
    height: auto;
  }
  .logoimg.mou-party-logo {
    height: 18mm;
    width: auto;
    max-width: 48mm;
    object-fit: contain;
    object-position: left center;
  }
  .logoimg.dc-logo {
    height: 18mm;
    width: auto;
  }
  .hr1 { border: none; border-top: 1.2pt solid #1a1a1a; margin: 5pt 0 7pt; }
  .hr2 { border: none; border-top: 0.6pt solid #1a1a1a; margin: 5pt 0; }
  .lettertitle { text-align: center; margin-bottom: 6pt; }
  .lettertitle .main { font-weight: bold; font-size: 15pt; }
  .lettertitle .sub { font-size: 10pt; color: #444; }
  .datebar { text-align: right; font-size: 11pt; margin-bottom: 3pt; }
  .datebar .docnum { font-size: 10pt; font-style: italic; margin-top: 2pt; }
  .body p { margin: 0 0 8pt; text-align: justify; }
  table.particulars { border-collapse: collapse; font-size: 12pt; margin: 6pt 0 9pt; }
  table.particulars td { padding: 2pt 0; vertical-align: top; }
  table.particulars td.k { font-weight: bold; padding-right: 14pt; }
  table.particulars td.sep { padding-right: 10pt; }
  .sig { margin-top: auto; padding-top: 12pt; width: 100%; border-collapse: collapse; font-size: 12pt; }
  .sig td { width: 33.3%; vertical-align: top; padding-right: 10pt; }
  .sig tr.four td { width: 25%; }
  .sig .name { font-weight: bold; display: block; min-height: 2.3em; line-height: 1.15em; }
  .digisig { font-size: 10pt; font-style: italic; margin-top: 2pt; }

  .announcement-tone-preview{margin:8px 0 12px;padding:9px 10px;border:1px solid #d7e7df;border-radius:8px;background:#f7fbf9;display:grid;gap:7px}.announcement-tone-preview>div{display:flex;gap:8px;align-items:flex-start}.announcement-tone-preview span{flex:0 0 62px;color:#8aa097;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding-top:2px}.announcement-tone-preview strong{color:#356b57;font-size:10px;line-height:1.35;font-weight:650}.announcement-event-card{margin:8px 0 6px;padding:10px 11px;border:1px solid #cfe1d8;border-radius:9px;background:#f7fbf9}.announcement-event-grid{display:grid;grid-template-columns:1fr 1fr;gap:5pt 16pt;margin:4pt 0}.announcement-event-grid .event-wide{grid-column:1/-1}.announcement-event-grid div{break-inside:avoid}.announcement-event-label{font-size:9pt;font-weight:bold}.announcement-attachment{margin-top:7pt;padding:7pt 9pt;border:0.6pt solid #d8d8d8;border-radius:5pt}.announcement-sign{margin-top:12pt}.announcement-sign .sig-name{font-weight:bold}.announcement-sign .digisig{margin-top:3pt}
  .report-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6pt 18pt;margin:4pt 0 10pt;padding:8pt 10pt;border:0.6pt solid #d8e4dd;background:#f7fbf9;border-radius:5pt}.report-meta-grid div{break-inside:avoid}.report-meta-label{font-size:9pt;font-weight:bold;color:#356b57;text-transform:uppercase;letter-spacing:.04em}.report-section{margin:0 0 10pt;break-inside:avoid}.report-section h3{font-size:12.5pt;margin:0 0 4pt;padding-bottom:2pt;border-bottom:.7pt solid #cfe1d8}.report-section p{margin:0 0 5pt}.report-list{margin:3pt 0 0 17pt;padding:0}.report-list li{margin:0 0 4pt;padding-left:2pt}.report-table{width:100%;border-collapse:collapse;margin:4pt 0 0;font-size:11pt}.report-table th,.report-table td{border:.6pt solid #cfe1d8;padding:5pt 6pt;text-align:left;vertical-align:top}.report-table th{background:#f0f7f3;font-weight:bold}.report-table .status-active{font-weight:bold}.report-table .status-inactive{color:#666}.report-sign{margin-top:16pt}.report-sign .name{font-weight:bold}.report-sign .digisig{margin-top:3pt}
  .report-page-label{margin-top:10pt;text-align:right;font-size:8pt;color:#6a7f75;font-style:italic;break-inside:avoid}


  @media print {
    body { background: #fff; padding: 0; }
    .panel, .btnbar, .pageHolder { display: none !important; }
    #printArea { display: block !important; }
    #printPage.pageStack { display: block; }
    #printPage.pageStack > .page { margin: 0; page-break-after: always; break-after: page; }
    #printPage.pageStack > .page:last-child { page-break-after: auto; break-after: auto; }
    .page {
      box-shadow: none;
      box-sizing: border-box;
      width: 210mm;
      height: 297mm;
      min-height: 297mm;
      margin: 0;
      padding: 10mm 20mm 9mm;
    }
    @page { size: A4; margin: 0; }
  }
  #printArea { display: none; }

  /* ---- 180DC Letterhead Studio UI ---- */
  .appbar{max-width:1100px;margin:18px auto 0;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(135deg,#07583d 0%,#0b7a53 58%,#139263 100%);color:#fff;border-radius:16px;box-shadow:0 14px 34px rgba(7,88,61,.20);position:relative;overflow:hidden}
  .appbar::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0,rgba(255,255,255,.028) 1px,transparent 1px,transparent 3px);pointer-events:none}
  .brand-lockup{display:flex;align-items:center;gap:12px;min-width:0;position:relative;z-index:1}.brand-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#fff;color:#07583d;font-weight:900;font-size:14px;letter-spacing:-.5px;box-shadow:0 7px 18px rgba(0,0,0,.14)}.brand-copy{min-width:0}.brand-copy strong{display:block;font-size:15px}.brand-copy span{display:block;margin-top:2px;font-size:11px;color:#dff2e9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.app-actions{display:flex;align-items:center;gap:7px;position:relative;z-index:1}
  .icon-btn,.ghost-btn{flex:0 0 auto;border:1px solid rgba(255,255,255,.23);background:rgba(255,255,255,.10);color:#fff;padding:8px 10px;border-radius:9px;font-size:12px;font-weight:700}.icon-btn:hover,.ghost-btn:hover{background:rgba(255,255,255,.17)}
  .studio-kicker{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-2px 0 14px}.studio-kicker .eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ls-text-secondary)}
  .status-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:rgba(11,122,83,.10);color:var(--ls-accent);font-size:10px;font-weight:800}.status-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
  .progress-card{padding:11px 12px;border:1px solid var(--ls-border);border-radius:10px;background:linear-gradient(135deg,#f7fcf9,#e9f6ef);margin-bottom:14px}.progress-top{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:700}.progress-track{height:6px;margin-top:8px;background:rgba(7,88,61,.12);border-radius:99px;overflow:hidden}.progress-fill{width:0%;height:100%;background:linear-gradient(90deg,#0b7a53,#49b886);border-radius:inherit;transition:width .2s ease}
  .workflow{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 14px}.workflow-step{padding:7px 6px;border-radius:8px;background:var(--ls-surface-1);color:var(--ls-text-secondary);text-align:center;font-size:10px;font-weight:700;border:1px solid transparent}.workflow-step.active{color:var(--ls-accent);background:rgba(11,122,83,.08);border-color:#c8e2d5}
  .preview-shell{position:sticky;top:18px;align-self:start}.preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:9px 11px;border:1px solid var(--ls-border);border-radius:11px;background:rgba(255,255,255,.92);box-shadow:0 8px 22px rgba(7,88,61,.06)}.preview-title{font-size:12px;font-weight:800}.preview-meta{font-size:10px;color:var(--ls-text-secondary)}.preview-actions{display:flex;align-items:center;gap:5px}.preview-actions button{flex:0 0 auto;padding:5px 8px;font-size:11px;border-radius:7px}.preview-actions output{min-width:38px;text-align:center;font-size:10px;color:var(--ls-text-secondary)}
  .pageHolder{border-radius:12px;padding:8px;background:rgba(255,255,255,.30)}.pageHolder .pageStack{transition:transform .16s ease;transform-origin:top center}.pageHolder .page{transition:none}.panel{box-shadow:0 10px 28px var(--ls-shadow);border-color:#cfe1d8}.panel>h2{display:flex;align-items:center;justify-content:space-between;gap:8px}.panel>h2::after{content:'A4 Ã¢â‚¬Â¢ ready to print';font-size:9px;color:var(--ls-text-secondary);font-weight:700}input:hover,select:hover,textarea:hover{border-color:#9ec9b2}
  .section-note{margin:10px 0 2px;padding:8px 10px;border-left:3px solid var(--ls-accent);background:rgba(11,122,83,.07);border-radius:0 7px 7px 0;font-size:10px;line-height:1.4;color:var(--ls-text-secondary)}
  .toast{position:fixed;right:22px;bottom:22px;z-index:100000;padding:10px 13px;border-radius:10px;background:#07583d;color:#fff;font-size:12px;font-weight:700;box-shadow:0 10px 30px rgba(7,88,61,.24);opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s ease}.toast.show{opacity:1;transform:translateY(0)}
  .app-quote{max-width:1100px;margin:8px auto 0;padding:0 4px;color:#356b57;font-size:11px;font-weight:700;letter-spacing:.01em;text-align:right}.app-quote span{display:inline-block;transition:opacity .16s ease}
  @media (max-width:860px){.appbar{margin-top:10px;border-radius:12px}.preview-shell{position:static}.app-actions .ghost-btn{display:none}.brand-copy span{max-width:230px}.panel>h2::after{display:none}.app-quote{text-align:left;padding:0 2px}}
  @media print{.appbar,.app-quote,.ui-only,.toast{display:none!important}.wrap{display:block;padding:0}.pageHolder{padding:0;background:#fff}.pageHolder .pageStack{transform:none!important}}

  .ldi-section{margin:16px 0 0;padding:14px 16px;border:1px solid #dce9e2;border-radius:12px;background:#fbfdfc}
  .ldi-section-title{margin:0 0 5px;color:#174533;font-size:14px;font-weight:800}
  .ldi-section-note{margin:0 0 10px;color:#71857b;font-size:10px;line-height:1.5}
  .ldi-meta-grid,.ldi-impact-grid,.ldi-resource-grid,.ldi-timeline-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .ldi-card{border:1px solid #dce9e2;border-radius:10px;padding:12px 14px;margin:10px 0;background:#fff}
  .ldi-card h3{margin:0 0 8px;color:#174533;font-size:12px}
  .ldi-list{margin:6px 0 0 20px;padding:0}
  .ldi-list li{margin:4px 0}
  .ldi-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10.5pt}
  .ldi-table th,.ldi-table td{border:1px solid #d6e4dc;padding:7px 8px;text-align:left;vertical-align:top}
  .ldi-table th{background:#f2f8f4;color:#245441;font-weight:800}
  .ldi-label{color:#668074;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  .ldi-page-label{margin-top:auto;padding-top:8pt;text-align:right;font-size:8.5pt;color:#668074;font-weight:700;letter-spacing:.04em}
  @media(max-width:800px){.ldi-meta-grid,.ldi-impact-grid,.ldi-resource-grid,.ldi-timeline-grid{grid-template-columns:1fr}}
`;

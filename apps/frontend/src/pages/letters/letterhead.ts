import { LETTER_VIT_LOGO, LETTER_DC_LOGO } from "./letterAssets";

export function escapeHTML(value: unknown): string {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function reportLines(value: string): string[] {
  return String(value || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.replace(/^[•*-]\s*/, ""));
}

export function reportListHTML(value: string, emptyText = "No information provided."): string {
  const items = reportLines(value);
  return items.length
    ? `<ul class="report-list">${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
    : `<p><em>${escapeHTML(emptyText)}</em></p>`;
}

function reportPipeRows(value: string, width: number): string[][] {
  return reportLines(value).map((line) => {
    const parts = line.split("|").map((x) => x.trim());
    while (parts.length < width) parts.push("");
    return parts.slice(0, width);
  });
}

function reportSubteamTableHTML(value: string): string {
  const rows = reportPipeRows(value, 3);
  if (!rows.length) return "<p><em>No subteam members recorded.</em></p>";
  return `<table class="report-table"><thead><tr><th>Subteam</th><th>Name</th><th>Status</th></tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr><td>${escapeHTML(r[0])}</td><td>${escapeHTML(r[1])}</td><td class="${r[2].toLowerCase() === "active" ? "status-active" : "status-inactive"}">${escapeHTML(r[2] || "Not specified")}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function reportSeniorTableHTML(value: string): string {
  const rows = reportPipeRows(value, 2);
  if (!rows.length) return "<p><em>No senior consultants recorded.</em></p>";
  return `<table class="report-table"><thead><tr><th>Senior Consultant</th><th>Level of Activity</th></tr></thead><tbody>${rows
    .map((r) => `<tr><td>${escapeHTML(r[0])}</td><td>${escapeHTML(r[1] || "Not specified")}</td></tr>`)
    .join("")}</tbody></table>`;
}

export interface LetterData {
  type: string;
  dateStr: string;
  name: string;
  reg: string;
  position: string;
  positionFrom: string;
  positionTo: string;
  team: string;
  teamFrom: string;
  teamTo: string;
  ffcs: string;
  techTrack: string;
  performance: string;
  reason: string;
  resignationReason: string;
  satisfaction: string;
  successor: string;
  resignationFeedback: string;
  scType: string;
  scIncident: string;
  scDate: string;
  scTime: string;
  scRemark: string;
  serviceProjects: string;
  servicePositions: string;
  serviceOutcome: string;
  relievingRating: string;
  relievingComment: string;
  recTask: string;
  recOutcome: string;
  mouParty: string;
  mouAddress: string;
  mouPurpose: string;
  mouScope: string;
  mouRespOurs: string;
  mouRespOther: string;
  mouDocs: string;
  mouTerm: string;
  mouConfidentiality: string;
  mouTermination: string;
  mouSignOurs: string;
  mouSignOther: string;
  mouLogo: string;
  announcementSender: string;
  announcementSenderPosition: string;
  announcementTone: string;
  announcementKind: string;
  announcementMessage: string;
  announcementFileName: string;
  announcementFileData: string;
  announcementEventDate: string;
  announcementEventTime: string;
  announcementEventVenue: string;
  announcementEventMode: string;
  announcementEventAction: string;
  announcementEventNotes: string;
  reportTime: string;
  reportDirector: string;
  reportDepartment: string;
  reportOverview: string;
  reportTasks: string;
  reportUpdates: string;
  reportHold: string;
  reportStruggles: string;
  reportStrengths: string;
  reportOther: string;
  reportVision: string;
  reportResponsibility: string;
  reportStrength: string;
  reportSubteams: string;
  reportSenior: string;
  reportPromising: string;
  reportTechAIML: string;
  reportTechProduct: string;
  reportTechDevOps: string;
  ldiSubmitter: string;
  ldiPosition: string;
  ldiDepartment: string;
  ldiCategory: string;
  ldiDate: string;
  ldiPriority: string;
  ldiTitle: string;
  ldiSummary: string;
  ldiProblem: string;
  ldiWhy: string;
  ldiHow: string;
  ldiExpect: string;
  ldiOutcome: string;
  ldiBeneficiaries: string;
  ldiImpact: string;
  ldiMetrics: string;
  ldiCost: string;
  ldiResources: string;
  ldiAllocation: string;
  ldiDependencies: string;
  ldiGuesstimate: string;
  ldiAssumptions: string;
  ldiEvidence: string;
  ldiTimeline: string;
  ldiMilestones: string;
  ldiPilot: string;
  ldiRollout: string;
  ldiRisks: string;
  ldiTradeoffs: string;
  ldiAlternatives: string;
  ldiScope: string;
  ldiOwner: string;
  ldiStakeholders: string;
  ldiSupporters: string;
  ldiOpponents: string;
  ldiApprovals: string;
  ldiCommunication: string;
  ldiMaintenance: string;
  ldiDecision: string;
  ldiReview: string;
  ldiNext: string;
  ldiFinal: string;
  docnum: string;
}

const ANNOUNCEMENT_TONE_COPY: Record<string, { intro: string; end: string }> = {
  sad: { intro: "It is with regret that we share the following update.", end: "We appreciate your understanding during this time." },
  neutral: { intro: "This is to inform you of the following update.", end: "Please take note of this announcement and the information provided." },
  happy: { intro: "We are delighted to share the following update with you.", end: "We look forward to your participation and continued support." },
};

function buildAppointmentLetterHTML(d: LetterData): string {
  const h = escapeHTML;
  const particulars = `
        <tr><td class="k">Name</td><td class="sep">:</td><td>${h(d.name)}</td></tr>
        <tr><td class="k">Registration Number</td><td class="sep">:</td><td>${h(d.reg)}</td></tr>
        <tr><td class="k">Department</td><td class="sep">:</td><td>${h(d.team)}</td></tr>
        ${d.team === "Technical" && d.techTrack && d.techTrack !== "General" ? `<tr><td class="k">Technical Track</td><td class="sep">:</td><td>${h(d.techTrack)}</td></tr>` : ""}
        <tr><td class="k">Position</td><td class="sep">:</td><td>${h(d.position)}</td></tr>`;
  const body = `
      <p class="ap-greet"><strong>Dear ${h(d.name)},</strong></p>
      <p class="ap-p">This Letter of Appointment (&ldquo;<strong>Letter</strong>&rdquo;) is issued by 180 Degrees Consulting, VIT Chennai Chapter (the &ldquo;<strong>Organisation</strong>&rdquo;) in favour of the appointee named herein, for the tenure 2026-27.</p>
      <p class="ap-p">The particulars of this appointment are recorded below for reference:</p>
      <table class="ap-table">${particulars}</table>
      <p class="ap-p"><strong>Appointment.</strong> The appointee is appointed as <strong>${h(d.position)}</strong> of the Organisation for the 2026-27 tenure, effective from the date of this Letter.</p>
      <p class="ap-p"><strong>Duties.</strong> The appointee shall discharge the duties of ${h(d.position)} in the ${h(d.team)} department, as directed by the Board.</p>
      <p class="ap-p"><strong>Conduct.</strong> The appointee shall maintain professional and confidential standards, and follow the Board's directives.</p>
      <p class="ap-p"><strong>Termination.</strong> This appointment may be reviewed, modified, or withdrawn by the Board at its discretion, subject to the appointee's good standing and conduct.</p>
      <p class="ap-p">We look forward to your contribution. Congratulations on your appointment.</p>
      <p class="ap-witness"><em>In witness whereof, this Letter is issued and authenticated by the undersigned on behalf of the Organisation.</em></p>
      <p class="ap-p"><strong>Warm regards,</strong></p>`;
  const sig = (name: string, role: string) => `
        <td class="ap-sigcol"><span class="ap-sname">${h(name)}</span><span class="ap-srole">${h(role)}</span><span class="ap-sdigi">Digitally Signed</span></td>`;
  return `
    <style>
      .ap-page { background: #ffffff; color: #1a1a1a; font-family: 'Segoe UI', Arial, sans-serif; padding: 46px 54px 42px; }
      .ap-accent { border-top: 8px solid #00a651; margin: 0 0 26px; }
      .ap-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a1a; padding-bottom: 18px; }
      .ap-wordmark { font-family: 'Segoe UI', Arial, sans-serif; font-size: 34px; font-weight: 800; letter-spacing: -1px; color: #00a651; line-height: 1; }
      .ap-org { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #1a1a1a; margin-top: 6px; }
      .ap-chapter { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #4b5563; margin-top: 3px; }
      .ap-side { text-align: right; font-size: 11px; font-weight: 600; color: #4b5563; line-height: 1.6; }
      .ap-titlebox { margin: 30px 0 6px; }
      .ap-title { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #1a1a1a; }
      .ap-titlesub { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #00a651; margin-top: 8px; }
      .ap-meta { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #4b5563; margin-bottom: 26px; }
      .ap-greet { font-size: 14px; margin: 0 0 14px; color: #1a1a1a; }
      .ap-p { font-size: 13.5px; line-height: 1.75; color: #1a1a1a; margin: 0 0 12px; }
      .ap-witness { font-size: 13px; line-height: 1.75; color: #1a1a1a; margin: 0 0 12px; }
      .ap-table { width: 100%; border-collapse: collapse; margin: 6px 0 20px; }
      .ap-table td { padding: 9px 12px; font-size: 13px; color: #1a1a1a; border-bottom: 1px solid #e4e4e4; }
      .ap-table td.k { width: 42%; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 11px; color: #00a651; }
      .ap-table td.sep { width: 3%; color: #9ca3af; }
      .ap-sig { width: 100%; border-collapse: collapse; margin-top: 34px; }
      .ap-sigcol { width: 25%; padding: 18px 10px 0; vertical-align: top; }
      .ap-sname { display: block; font-size: 13px; font-weight: 800; color: #1a1a1a; }
      .ap-srole { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #4b5563; margin-top: 4px; }
      .ap-sdigi { display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #00a651; background: #eefaf3; padding: 4px 10px; border-radius: 4px; margin-top: 10px; }
      .ap-footer { margin-top: 34px; padding-top: 14px; border-top: 2px solid #00a651; font-size: 10px; font-weight: 600; color: #4b5563; text-align: center; letter-spacing: 1px; }
    </style>
    <div class="pagecontent ap-page">
      <div class="ap-accent"></div>
      <div class="ap-head">
        <div>
          <div class="ap-wordmark">180DC</div>
          <div class="ap-org">180 Degrees Consulting</div>
          <div class="ap-chapter">VIT Chennai Chapter</div>
        </div>
        <div class="ap-side">Document Reference<br>${h(d.docnum)}<br>${h(d.dateStr)}</div>
      </div>
      <div class="ap-titlebox">
        <div class="ap-title">Letter of Appointment</div>
        <div class="ap-titlesub">Tenure 2026-27</div>
      </div>
      <div class="ap-meta"><span>Ref. No. ${h(d.docnum)}</span><span>Date: ${h(d.dateStr)}</span></div>
      <div class="ap-body body">${body}</div>
      <table class="ap-sig"><tr>
        ${sig("Sharan K", "Chairperson")}
        ${sig("Sanjana Chejeti", "Vice Chairperson")}
        ${sig("Sonakshi Agarwal", "Gen Secretary")}
        ${sig("Sanjay Sivakumar", "Secretary")}
      </tr></table>
      <div class="ap-footer">180 Degrees Consulting &mdash; VIT Chennai &nbsp;·&nbsp; vitc-180dc.org &nbsp;·&nbsp; events.vitc@180dc.org</div>
    </div>`;
}

export function buildLetterHTML(d: LetterData): string {
  const h = escapeHTML;
  const type = d.type;
  if (type === "appointment") return buildAppointmentLetterHTML(d);
  const isPromotion = type === "promotion";
  const isTermination = type === "termination";
  const isTransfer = type === "transfer";
  const isResignation = type === "resignation";
  const isShowCause = type === "showcause";
  const isService = type === "service";
  const isRelieving = type === "relieving";
  const isRecognition = type === "recognition";
  const isMOU = type === "mou";
  const isAnnouncement = type === "announcement";
  const isDepartmentReport = type === "department-report";
  const isLDI = type === "ldi";
  const title = isLDI
    ? "LDI FORM"
    : isDepartmentReport
      ? "DEPARTMENT REPORT"
      : isAnnouncement
        ? "ANNOUNCEMENT LETTER"
        : isMOU
          ? "MEMORANDUM OF UNDERSTANDING"
          : isPromotion
            ? "LETTER OF PROMOTION"
            : isTermination
              ? "LETTER OF TERMINATION"
              : isTransfer
                ? "LETTER OF DEPARTMENT TRANSFER"
                : isResignation
                  ? "LETTER OF RESIGNATION"
                  : isShowCause
                    ? "SHOW-CAUSE / WARNING LETTER"
                    : isService
                      ? "SERVICE CERTIFICATE"
                      : isRelieving
                        ? "RELIEVING LETTER"
                        : isRecognition
                          ? "RECOGNITION LETTER"
                          : "LETTER OF APPOINTMENT";
  const intro = isMOU
    ? `This Memorandum of Understanding (&ldquo;<strong>MOU</strong>&rdquo;) is entered into by and between 180 Degrees Consulting, VIT Chennai Chapter (&ldquo;<strong>180DC</strong>&rdquo;) and <strong>${h(d.mouParty)}</strong> (&ldquo;<strong>Other Party</strong>&rdquo;), collectively referred to as the &ldquo;<strong>Parties</strong>&rdquo;.`
    : isPromotion
      ? `This Letter of Promotion (&ldquo;<strong>Letter</strong>&rdquo;) is issued by 180 Degrees Consulting, VIT Chennai Chapter (the &ldquo;<strong>Organisation</strong>&rdquo;) in favour of the member named herein, for the tenure 2026-27.`
      : isTermination
        ? `This Letter of Termination (&ldquo;<strong>Letter</strong>&rdquo;) is issued by 180 Degrees Consulting, VIT Chennai Chapter (the &ldquo;<strong>Organisation</strong>&rdquo;) in respect of the member named herein.`
        : isTransfer
          ? `This Letter of Department Transfer (&ldquo;<strong>Letter</strong>&rdquo;) is issued by 180 Degrees Consulting, VIT Chennai Chapter (the &ldquo;<strong>Organisation</strong>&rdquo;) in respect of the member named herein, for the tenure 2026-27.`
          : isResignation
            ? `This Letter of Resignation records the voluntary resignation of the member named herein from 180 Degrees Consulting, VIT Chennai Chapter (the &ldquo;<strong>Organisation</strong>&rdquo;).`
            : `This Letter of Appointment (&ldquo;<strong>Letter</strong>&rdquo;) is issued by 180 Degrees Consulting, VIT Chennai Chapter (the &ldquo;<strong>Organisation</strong>&rdquo;) in favour of the appointee named herein, for the tenure 2026-27.`;
  const particulars = `
        <tr><td class="k">Name</td><td class="sep">:</td><td>${h(d.name)}</td></tr>
        <tr><td class="k">Registration Number</td><td class="sep">:</td><td>${h(d.reg)}</td></tr>
        <tr><td class="k">Department</td><td class="sep">:</td><td>${h(isTransfer ? d.teamFrom : d.team)}</td></tr>
        <tr><td class="k">FFCS Status</td><td class="sep">:</td><td>${h(d.ffcs)}</td></tr>
        ${d.team === "Technical" && d.techTrack && d.techTrack !== "General" ? `<tr><td class="k">Technical Track</td><td class="sep">:</td><td>${h(d.techTrack)}</td></tr>` : ""}
        <tr><td class="k">Position</td><td class="sep">:</td><td>${h(isPromotion ? d.positionTo : d.position)}</td></tr>`;
  const announcementTone =
    ANNOUNCEMENT_TONE_COPY[d.announcementTone] || ANNOUNCEMENT_TONE_COPY.neutral;
  const body = isLDI
    ? `
      <div class="ldi-card"><div class="ldi-meta-grid">
        <div><div class="ldi-label">Idea Title</div><strong>${h(d.ldiTitle || "(untitled idea)")}</strong></div>
        <div><div class="ldi-label">Submitted By</div><strong>${h(d.ldiSubmitter || "(not specified)")}</strong></div>
        <div><div class="ldi-label">Department</div><strong>${h(d.ldiDepartment)}</strong></div>
        <div><div class="ldi-label">Position / Role</div><strong>${h(d.ldiPosition || "(not specified)")}</strong></div>
        <div><div class="ldi-label">Category</div><strong>${h(d.ldiCategory)}</strong></div>
        <div><div class="ldi-label">Priority</div><strong>${h(d.ldiPriority)}</strong></div>
        <div><div class="ldi-label">Submission Date</div><strong>${h(d.ldiDate || d.dateStr)}</strong></div>
        <div><div class="ldi-label">Reference</div><strong>${h(d.docnum)}</strong></div>
      </div></div>
      <section class="ldi-section"><h3 class="ldi-section-title">Idea Overview</h3><p><strong>What is being proposed?</strong></p>${reportListHTML(d.ldiSummary)}<p><strong>Problem / Opportunity</strong></p>${reportListHTML(d.ldiProblem)}<p><strong>Why this, why now?</strong></p>${reportListHTML(d.ldiWhy)}<p><strong>How will it work?</strong></p>${reportListHTML(d.ldiHow)}</section>
      <section class="ldi-section"><h3 class="ldi-section-title">Expected Value and Impact</h3><p><strong>What to Expect</strong></p>${reportListHTML(d.ldiExpect)}<p><strong>Expected Outcome</strong></p>${reportListHTML(d.ldiOutcome)}<p><strong>Who Benefits?</strong></p>${reportListHTML(d.ldiBeneficiaries)}<p><strong>Expected Impact</strong></p>${reportListHTML(d.ldiImpact)}<p><strong>Success Metrics / KPIs</strong></p>${reportListHTML(d.ldiMetrics)}</section>
      <section class="ldi-section"><h3 class="ldi-section-title">Cost, Resources and Allocation</h3><p><strong>Estimated Cost</strong></p>${reportListHTML(d.ldiCost)}<p><strong>Resources Needed</strong></p>${reportListHTML(d.ldiResources)}<p><strong>Resource Allocation</strong></p>${reportListHTML(d.ldiAllocation)}<p><strong>Dependencies</strong></p>${reportListHTML(d.ldiDependencies)}</section>
      <section class="ldi-section"><h3 class="ldi-section-title">Guesstimates and Assumptions</h3><p><strong>Guesstimate / Back-of-the-Envelope Calculation</strong></p>${reportListHTML(d.ldiGuesstimate)}<p><strong>Key Assumptions</strong></p>${reportListHTML(d.ldiAssumptions)}<p><strong>Evidence / Data</strong></p>${reportListHTML(d.ldiEvidence)}</section>
      <section class="ldi-section"><h3 class="ldi-section-title">Execution Plan</h3><p><strong>Timeline</strong></p>${reportListHTML(d.ldiTimeline)}<p><strong>Milestones and Owners</strong></p>${reportListHTML(d.ldiMilestones)}<p><strong>Pilot / Experiment Plan</strong></p>${reportListHTML(d.ldiPilot)}<p><strong>Rollout Plan</strong></p>${reportListHTML(d.ldiRollout)}</section>
      <section class="ldi-section"><h3 class="ldi-section-title">Risks, Trade-offs and Alternatives</h3><p><strong>Risks</strong></p>${reportListHTML(d.ldiRisks)}<p><strong>Trade-offs</strong></p>${reportListHTML(d.ldiTradeoffs)}<p><strong>Alternatives Considered</strong></p>${reportListHTML(d.ldiAlternatives)}<p><strong>Scope and Non-Scope</strong></p>${reportListHTML(d.ldiScope)}</section>
      <section class="ldi-section"><h3 class="ldi-section-title">People, Ownership and Governance</h3><p><strong>Proposed Owner</strong></p>${reportListHTML(d.ldiOwner)}<p><strong>Stakeholders</strong></p>${reportListHTML(d.ldiStakeholders)}<p><strong>People Backing the Idea</strong></p>${reportListHTML(d.ldiSupporters)}<p><strong>People Opposing the Idea</strong></p>${reportListHTML(d.ldiOpponents)}<p><strong>Approvals Needed</strong></p>${reportListHTML(d.ldiApprovals)}<p><strong>Communication Plan</strong></p>${reportListHTML(d.ldiCommunication)}<p><strong>Post-Launch Ownership / Maintenance</strong></p>${reportListHTML(d.ldiMaintenance)}</section>
      <section class="ldi-section"><h3 class="ldi-section-title">Decision and Review</h3><p><strong>Decision Requested:</strong> ${h(d.ldiDecision)}</p><p><strong>Review / Approval Notes</strong></p>${reportListHTML(d.ldiReview)}<p><strong>Next Steps</strong></p>${reportListHTML(d.ldiNext)}<p><strong>Final Recommendation / Closing Note</strong></p>${reportListHTML(d.ldiFinal)}</section>
    `
    : isDepartmentReport
      ? `
      <div class="report-meta-grid">
        <div><div class="report-meta-label">Department</div><strong>${h(d.reportDepartment)}</strong></div>
        <div><div class="report-meta-label">Director</div><strong>${h(d.reportDirector)}</strong></div>
        <div><div class="report-meta-label">Date</div><strong>${h(d.dateStr)}</strong></div>
        <div><div class="report-meta-label">Time</div><strong>${h(d.reportTime || "(not specified)")}</strong></div>
        <div><div class="report-meta-label">Department Strength</div><strong>${h(d.reportStrength || "0")}</strong></div>
        <div><div class="report-meta-label">Reference</div><strong>${h(d.docnum)}</strong></div>
      </div>
      <section class="report-section"><h3>Overview</h3>${reportListHTML(d.reportOverview)}</section>
      <section class="report-section"><h3>Tasks at Hand</h3>${reportListHTML(d.reportTasks)}</section>
      <section class="report-section"><h3>Update on Tasks</h3>${reportListHTML(d.reportUpdates)}</section>
      <section class="report-section"><h3>What is on hold, if anything, and why?</h3>${reportListHTML(d.reportHold)}</section>
      <section class="report-section"><h3>Struggles</h3>${reportListHTML(d.reportStruggles)}</section>
      <section class="report-section"><h3>Strengths</h3>${reportListHTML(d.reportStrengths)}</section>
      <section class="report-section"><h3>Other Things to Mention</h3>${reportListHTML(d.reportOther)}</section>
      <section class="report-section"><h3>Vision</h3>${reportListHTML(d.reportVision)}</section>
      <section class="report-section"><h3>Responsibility</h3>${reportListHTML(d.reportResponsibility)}</section>
      <section class="report-section"><h3>Subteams and Members</h3>${reportSubteamTableHTML(d.reportSubteams)}</section>
      <section class="report-section"><h3>Senior Consultants and Level of Activity</h3>${reportSeniorTableHTML(d.reportSenior)}</section>
      ${d.reportDepartment === "Technical" && (d.reportTechAIML || d.reportTechProduct || d.reportTechDevOps) ? `
      <section class="report-section"><h3>Technical Track Senior Consultants</h3>
      <table class="report-table"><thead><tr><th>Track</th><th>Senior Consultant</th></tr></thead><tbody>
        ${d.reportTechAIML ? `<tr><td>AI/ML</td><td>${h(d.reportTechAIML)}</td></tr>` : ""}
        ${d.reportTechProduct ? `<tr><td>Product</td><td>${h(d.reportTechProduct)}</td></tr>` : ""}
        ${d.reportTechDevOps ? `<tr><td>DevOps</td><td>${h(d.reportTechDevOps)}</td></tr>` : ""}
      </tbody></table></section>` : ""}
      <section class="report-section"><h3>Promising People in the Department</h3>${reportListHTML(d.reportPromising)}</section>
      <section class="report-section"><h3>Director's Closing Note</h3><p>This report records the current position, responsibilities, priorities, people structure, and forward direction of the department.</p></section>
    `
      : isAnnouncement
        ? `
      <p><strong>${h(announcementTone.intro)}</strong></p>
      <p><strong>From:</strong> ${h(d.announcementSender || "(sender)")}</p>
      <p>${h(d.announcementMessage).replace(/\n/g, "<br>")}</p>
      ${d.announcementKind === "event" ? `
        <div class="announcement-event-card">
          <p><strong>Event Details</strong></p>
          <div class="announcement-event-grid">
            <div><span class="announcement-event-label">Date:</span> ${h(d.announcementEventDate || "(not specified)")}</div>
            <div><span class="announcement-event-label">Time:</span> ${h(d.announcementEventTime || "(not specified)")}</div>
            <div class="event-wide"><span class="announcement-event-label">Venue:</span> ${h(d.announcementEventVenue || "(not specified)")}</div>
            <div><span class="announcement-event-label">Mode:</span> ${h(d.announcementEventMode || "In-person")}</div>
            ${d.announcementEventAction ? `<div><span class="announcement-event-label">Action:</span> ${h(d.announcementEventAction)}</div>` : ""}
            ${d.announcementEventNotes ? `<div class="event-wide"><span class="announcement-event-label">Notes:</span> ${h(d.announcementEventNotes)}</div>` : ""}
          </div>
        </div>` : ""}
      ${d.announcementFileName ? `<div class="announcement-attachment"><strong>Attachment:</strong> ${h(d.announcementFileName)}</div>` : ""}
      <p>${h(announcementTone.end)}</p>
    `
        : isMOU
          ? `
      <p><strong>MEMORANDUM OF UNDERSTANDING</strong></p>
      <p>This MOU sets out the understanding between <strong>180 Degrees Consulting, VIT Chennai Chapter</strong> and <strong>${h(d.mouParty)}</strong> for the collaboration described below.</p>
      <p><strong>Other Party.</strong> ${h(d.mouParty)}${d.mouAddress ? `, ${h(d.mouAddress)}` : ""}.</p>
      <p><strong>Effective Date.</strong> ${h(d.dateStr)}.</p>
      <p><strong>Purpose.</strong> ${h(d.mouPurpose)}</p>
      <p><strong>Scope of Collaboration.</strong> ${h(d.mouScope)}</p>
      <p><strong>Responsibilities of 180 Degrees Consulting.</strong> ${h(d.mouRespOurs)}</p>
      <p><strong>Responsibilities of Other Party.</strong> ${h(d.mouRespOther)}</p>
      <p><strong>Documents / Deliverables.</strong> ${h(d.mouDocs)}</p>
      <p><strong>Term.</strong> This MOU shall remain in force for <strong>${h(d.mouTerm)}</strong>, unless extended or terminated in accordance with its terms.</p>
      <p><strong>Confidentiality.</strong> ${h(d.mouConfidentiality)}</p>
      <p><strong>Termination.</strong> ${h(d.mouTermination)}</p>
      <p><strong>General Understanding.</strong> Any amendment to this MOU shall be made in writing and agreed by both Parties. This MOU records the Parties' present understanding regarding the collaboration and does not create an employment relationship between the Parties.</p>
      <p>IN WITNESS WHEREOF, the Parties have caused this MOU to be acknowledged by their respective authorised signatories.</p>
      <p><strong>For 180 Degrees Consulting, VIT Chennai</strong><br>${h(d.mouSignOurs || "Authorised Signatory")}</p>
      <p><strong>For ${h(d.mouParty)}</strong><br>${h(d.mouSignOther || "Authorised Signatory")}</p>`
          : isPromotion
            ? `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>${intro}</p>
      <p>The particulars of this promotion are recorded below for reference:</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Promotion.</strong> Effective immediately, you are promoted from <strong>${h(d.positionFrom)}</strong> to <strong>${h(d.positionTo)}</strong> in the Organisation.</p>
      <p><strong>Promotion Details.</strong> Previous designation: <strong>${h(d.positionFrom)}</strong>. New designation: <strong>${h(d.positionTo)}</strong>. Performance: <strong>${h(d.performance)}</strong>.</p>
      <p><strong>Duties.</strong> You shall assume the duties and responsibilities of ${h(d.positionTo)} in the ${h(d.team)} department, as directed by the Board.</p>
      <p><strong>Conduct.</strong> You shall maintain professional and confidential standards, and follow the Board's directives.</p>
      <p>We congratulate you on your promotion and look forward to your continued contribution.</p>
      <p><em>In witness whereof, this Letter is issued and authenticated by the undersigned on behalf of the Organisation.</em></p>
      <p>Warm regards,</p>`
            : isTermination
              ? `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>${intro}</p>
      <p>The particulars of this termination are recorded below for reference:</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Termination Details.</strong> Performance: <strong>${h(d.performance)}</strong>. Reason: ${h(d.reason || "(reason to be specified)")}</p>
      <p><strong>Termination.</strong> Effective immediately, pursuant to the <strong>Board's unanimous decision</strong>, your association with the Organisation in the capacity of <strong>${h(d.position)}</strong> stands terminated, and you are hereby <strong>relieved from your duties and responsibilities</strong> with the Organisation.</p>
      <p><strong>Handover.</strong> You are requested to complete any pending handover or return any Organisation property, records, or materials, as applicable.</p>
      <p><em>This Letter is issued and authenticated by the undersigned on behalf of the Organisation.</em></p>
      <p>Regards,</p>`
              : isTransfer
                ? `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>${intro}</p>
      <p>The particulars of this transfer are recorded below for reference:</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Transfer Details.</strong> Department From: <strong>${h(d.teamFrom)}</strong>. Department To: <strong>${h(d.teamTo)}</strong>.</p>
      <p><strong>Transfer.</strong> Effective immediately, you are transferred from <strong>${h(d.teamFrom)}</strong> to <strong>${h(d.teamTo)}</strong> and shall serve in the new department in your current capacity.</p>
      <p><strong>Duties.</strong> You shall assume the duties and responsibilities assigned to you by the leadership of ${h(d.teamTo)}, and shall comply with all applicable directions and procedures.</p>
      <p><strong>Conduct.</strong> You shall maintain professional and confidential standards and continue to comply with the Organisation's policies and directives.</p>
      <p>We wish you success in your new department and look forward to your continued contribution.</p>
      <p><em>In witness whereof, this Letter is issued and authenticated by the undersigned on behalf of the Organisation.</em></p>
      <p>Warm regards,</p>`
                : isResignation
                  ? `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>${intro}</p>
      <p>The particulars of this resignation are recorded below for reference:</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Resignation.</strong> I hereby submit my resignation from the Organisation. My reason for leaving is: <strong>${h(d.resignationReason || "(reason to be specified)")}</strong>.</p>
      <p><strong>Work Satisfaction.</strong> My overall satisfaction with my work and experience in the Organisation is rated as <strong>${h(d.satisfaction || "(not specified)")}</strong>.</p>
      <p><strong>Successor Recommendation.</strong> ${h(d.successor || "No successor recommendation has been provided.")}</p>
      ${d.resignationFeedback ? `<p><strong>Additional Remarks.</strong> ${h(d.resignationFeedback)}</p>` : ""}
      <p>I undertake to complete any pending handover and return Organisation property, records, or materials, as applicable.</p>
      <p>Thank you for the opportunities, learning, and experience during my association with the Organisation.</p>
      <p>Yours sincerely,</p>
      <div class="resignation-signature">
        <div class="signature-name"><strong>${h(d.name)}</strong></div>
        <div>${h(d.position)}</div>
        <div>${h(d.team)}</div>
        <div>Registration Number: ${h(d.reg)}</div>
      </div>`
                  : isShowCause
                    ? `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>This Show-Cause / Warning Letter is issued by the Faculty Coordinator, <strong>Dr. Balaji J</strong>, regarding the matter recorded below.</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Matter.</strong> ${h(d.scType)}: ${h(d.scIncident)}</p>
      <p><strong>Date &amp; Time.</strong> ${h(d.scDate || "(not specified)")} ${h(d.scTime || "")}</p>
      <p><strong>Remarks.</strong> ${h(d.scRemark || "(none provided)")}</p>
      <p>You are hereby required to provide an explanation regarding the above matter and to ensure that such concerns are addressed appropriately. This letter is issued as a formal warning and for record purposes.</p>
      <p>Regards,</p>`
                    : isService
                      ? `
      <p><strong>To Whom It May Concern,</strong></p>
      <p>This is to certify that <strong>${h(d.name)}</strong>, Registration Number <strong>${h(d.reg)}</strong>, served in the ${h(d.team)} department as <strong>${h(d.position)}</strong> with 180 Degrees Consulting, VIT Chennai Chapter.</p>
      <p><strong>Service Details.</strong> ${h(d.name)} worked on <strong>${h(d.serviceProjects)}</strong> project(s), in the position(s) of <strong>${h(d.servicePositions)}</strong>.</p>
      <p><strong>Outcome.</strong> ${h(d.serviceOutcome)}</p>
      <p>During the period of association, the member contributed to the Organisation's activities and responsibilities in the capacity stated above.</p>
      <p>This certificate is issued upon request for official and professional purposes.</p>
      <p>Warm regards,</p>`
                      : isRelieving
                        ? `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>This is to acknowledge and accept your resignation from 180 Degrees Consulting, VIT Chennai Chapter, and to formally relieve you from your duties and responsibilities with the Organisation, subject to completion of the applicable handover requirements.</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Work Assessment.</strong> ${h(d.relievingRating)}. ${h(d.relievingComment || "")}</p>
      <p>We thank you for your contribution and wish you continued success in your future endeavours.</p>
      <p>Warm regards,</p>`
                        : isRecognition
                          ? `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>We are pleased to recognise and appreciate your contribution to 180 Degrees Consulting, VIT Chennai Chapter.</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Task / Contribution.</strong> ${h(d.recTask)}</p>
      <p><strong>Outcome.</strong> ${h(d.recOutcome)}</p>
      <p>Thank you for your effort, commitment, and contribution. We appreciate the work you have undertaken and look forward to your continued involvement and contribution to the Organisation.</p>
      <p>Warm regards,</p>`
                          : `
      <p><strong>Dear ${h(d.name)},</strong></p>
      <p>${intro}</p>
      <p>The particulars of this appointment are recorded below for reference:</p>
      <table class="particulars">${particulars}</table>
      <p><strong>Appointment.</strong> The appointee is appointed as <strong>${h(d.position)}</strong> of the Organisation for the 2026-27 tenure, effective from the date of this Letter.</p>
      <p><strong>Duties.</strong> The appointee shall discharge the duties of ${h(d.position)} in the ${h(d.team)} department, as directed by the Board.</p>
      <p><strong>Conduct.</strong> The appointee shall maintain professional and confidential standards, and follow the Board's directives.</p>
      <p><strong>Termination.</strong> This appointment may be reviewed, modified, or withdrawn by the Board at its discretion, subject to the appointee's good standing and conduct.</p>
      <p>We look forward to your contribution. Congratulations on your appointment.</p>
      <p><em>In witness whereof, this Letter is issued and authenticated by the undersigned on behalf of the Organisation.</em></p>
      <p>Warm regards,</p>`;
  return `
    <div class="watermark"></div>
    <div class="pagecontent">
    <div class="letterhead">
      <div class="logo-col left">
        ${isMOU ? (d.mouLogo ? `<img class="logoimg mou-party-logo" src="${h(d.mouLogo)}" alt="Other Party logo">` : "") : `<img class="logoimg vit-logo" src="${LETTER_VIT_LOGO}" alt="VIT logo">`}
      </div>
      <div class="logo-col right">
        <img class="logoimg dc-logo" src="${LETTER_DC_LOGO}" alt="180DC logo">
      </div>
    </div>
    <hr class="hr1">
    <div class="lettertitle"><div class="main">${title}</div><div class="sub">180 Degrees Consulting | Tenure 2026-27</div></div>
    <hr class="hr2">
    <div class="datebar">Date: ${h(d.dateStr)}<div class="docnum">Ref. No.: ${h(d.docnum)}</div></div>
    <div class="body">${body}</div>
    <table class="sig">${isLDI ? `<tr>
      <td colspan="3" class="report-sign"><span class="name">${h(d.ldiSubmitter || "(submitter)")}</span>${h(d.ldiPosition || "Proposer")}<div class="digisig">Digitally Signed</div></td>
    </tr>` : isDepartmentReport ? `<tr>
      <td colspan="3" class="report-sign"><span class="name">${h(d.reportDirector || "(director)")}</span>Director, ${h(d.reportDepartment)}<div class="digisig">Digitally Signed</div></td>
    </tr>` : isAnnouncement ? `<tr>
      <td colspan="3" class="announcement-sign"><span class="name sig-name">${h(d.announcementSender || "(sender)")}</span>${h(d.announcementSenderPosition || "Sender")}<div class="digisig">Digitally Signed</div></td>
    </tr>` : isMOU ? `<tr>
      <td><span class="name">${h(d.mouSignOurs || "Authorised Signatory")}</span>180 Degrees Consulting, VIT Chennai<div class="digisig">Digitally Signed</div></td>
      <td><span class="name">${h(d.mouSignOther || "Authorised Signatory")}</span>${h(d.mouParty)}<div class="digisig">Digitally Signed</div></td>
    </tr>` : isShowCause ? `<tr>
      <td colspan="3"><span class="name">Dr. Balaji J</span>Faculty Coordinator<br>180 Degrees Consulting, VIT Chennai<div class="digisig">Digitally Signed</div></td>
    </tr>` : isRecognition ? `<tr class="four">
      <td><span class="name">Sharan K</span>Chairperson<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
      <td><span class="name">Sanjana Chejeti</span>Vice Chairperson<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
      <td><span class="name">Sonakshi Agarwal</span>Gen Secretary<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
      <td><span class="name">Sanjay Sivakumar</span>Secretary<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
    </tr><tr>
      <td colspan="4"><span class="name">Dr. Balaji J</span>Faculty Coordinator<br>180 Degrees Consulting, VIT Chennai<div class="digisig">Digitally Signed</div></td>
    </tr>` : `<tr class="four">
      <td><span class="name">Sharan K</span>Chairperson<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
      <td><span class="name">Sanjana Chejeti</span>Vice Chairperson<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
      <td><span class="name">Sonakshi Agarwal</span>Gen Secretary<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
      <td><span class="name">Sanjay Sivakumar</span>Secretary<br>180 Degrees Consulting<div class="digisig">Digitally Signed</div></td>
    </tr>`}</table>
    <div class="footer"><a href="https://vitc-180dc.org/" target="_blank" rel="noopener">vitc-180dc.org</a><span style="display:inline-block; width:36pt;"></span><a href="mailto:events.vitc@180dc.org">events.vitc@180dc.org</a></div>
    </div>`;
}

function buildPaginatedDocumentPagesHTML(d: LetterData, options: { minPages?: number; labelPrefix?: string } = {}): string {
  const source = buildLetterHTML(d);
  const wrapper = document.createElement("div");
  wrapper.className = "page";
  wrapper.innerHTML = source.trim();
  const sourceContent = wrapper.querySelector(".pagecontent");
  const sourceBody = sourceContent && sourceContent.querySelector(".body");
  if (!sourceContent || !sourceBody) return `<div class="page">${source}</div>`;

  const blocks = Array.from(sourceBody.children);
  if (!blocks.length) return `<div class="page">${source}</div>`;

  const minPages = Number(options.minPages || 1);
  const labelPrefix = options.labelPrefix || "";

  const measure = wrapper.cloneNode(true) as HTMLElement;
  measure.style.position = "fixed";
  measure.style.left = "-100000px";
  measure.style.top = "0";
  measure.style.visibility = "hidden";
  measure.style.pointerEvents = "none";
  measure.style.margin = "0";
  measure.style.boxShadow = "none";
  measure.style.zIndex = "-1";
  document.body.appendChild(measure);

  const measureContent = measure.querySelector(".pagecontent") as HTMLElement;
  const measureBody = measureContent.querySelector(".body") as HTMLElement;
  const measureSig = measureContent.querySelector(".sig");
  if (measureSig) measureSig.remove();
  measureBody.innerHTML = "";

  const chunks: Element[][] = [];
  let current: Element[] = [];

  const fits = (candidate: Element[]) => {
    measureBody.innerHTML = "";
    candidate.forEach((block) => measureBody.appendChild(block.cloneNode(true)));
    const available = Math.max(0, measureContent.clientHeight - 10);
    return measureBody.scrollHeight <= available;
  };

  blocks.forEach((block) => {
    const candidate = current.concat(block);
    if (current.length && !fits(candidate)) {
      chunks.push(current);
      current = [block];
    } else {
      current = candidate;
    }
  });
  if (current.length) chunks.push(current);

  while (chunks.length < minPages) chunks.push([]);

  document.body.removeChild(measure);

  return chunks
    .map((chunk, index) => {
      const page = wrapper.cloneNode(true) as HTMLElement;
      const content = page.querySelector(".pagecontent") as HTMLElement;
      const body = content.querySelector(".body") as HTMLElement;
      body.innerHTML = "";
      chunk.forEach((block) => body.appendChild(block.cloneNode(true)));

      const sig = content.querySelector(".sig");
      if (index !== chunks.length - 1 && sig) sig.remove();

      if (labelPrefix) {
        const pageLabel = document.createElement("div");
        pageLabel.className = "ldi-page-label";
        pageLabel.textContent = `${labelPrefix} | Page ${index + 1} of ${chunks.length}`;
        body.appendChild(pageLabel);
      }
      return page.outerHTML;
    })
    .join("");
}

export function buildLDIPagesHTML(d: LetterData): string {
  return buildPaginatedDocumentPagesHTML(d, { minPages: 3, labelPrefix: "LDI Form" });
}

export function buildDepartmentReportPagesHTML(d: LetterData): string {
  const source = buildLetterHTML(d);
  const wrapper = document.createElement("div");
  wrapper.className = "page department-report-page";
  wrapper.innerHTML = source.trim();
  const sourceContent = wrapper.querySelector(".pagecontent");
  const sourceBody = sourceContent && sourceContent.querySelector(".body");
  if (!sourceContent || !sourceBody) return `<div class="page department-report-page">${source}</div>`;

  const blocks = Array.from(sourceBody.children);
  if (!blocks.length) return `<div class="page department-report-page">${source}</div>`;

  const pageGroups: Element[][] = [[], [], []];
  const groupTargets = [5, 5, Infinity];
  let pageIndex = 0;
  let pageWeight = 0;
  const budget = 58;
  const blockWeight = (block: Element) => {
    const text = (block.textContent || "").trim();
    return Math.max(4, Math.ceil(text.length / 110) + (block.matches(".report-table") ? 8 : 0));
  };

  blocks.forEach((block, index) => {
    const weight = blockWeight(block);
    const mustKeepOnCurrent = index === 0;
    const target = groupTargets[pageIndex] || Infinity;
    if (!mustKeepOnCurrent && pageIndex < 2 && (pageGroups[pageIndex].length >= target || (pageWeight + weight > budget && pageGroups[pageIndex].length >= 2))) {
      pageIndex += 1;
      pageWeight = 0;
    } else if (pageIndex === 2 && pageWeight > budget && pageGroups[pageIndex].length >= 3) {
      pageIndex += 1;
      pageGroups[pageIndex] = [];
      pageWeight = 0;
    }
    if (!pageGroups[pageIndex]) pageGroups[pageIndex] = [];
    pageGroups[pageIndex].push(block);
    pageWeight += weight;
  });

  while (pageGroups.length < 3) pageGroups.push([]);

  return pageGroups
    .map((chunk, index) => {
      const page = wrapper.cloneNode(true) as HTMLElement;
      const content = page.querySelector(".pagecontent") as HTMLElement;
      const body = content.querySelector(".body") as HTMLElement;
      body.innerHTML = "";
      chunk.forEach((block) => body.appendChild(block.cloneNode(true)));

      const sig = content.querySelector(".sig");
      if (index !== pageGroups.length - 1 && sig) sig.remove();

      const label = document.createElement("div");
      label.className = "report-page-label";
      label.textContent = `Department Report | Page ${index + 1} of ${pageGroups.length}`;
      body.appendChild(label);
      return page.outerHTML;
    })
    .join("");
}

export function buildMouPagesHTML(d: LetterData): string {
  return buildPaginatedDocumentPagesHTML(d, { minPages: 1 });
}

export function buildPagesHTML(d: LetterData): string {
  if (d.type === "mou") return buildMouPagesHTML(d);
  if (d.type === "department-report") return buildDepartmentReportPagesHTML(d);
  if (d.type === "ldi") return buildLDIPagesHTML(d);
  return `<div class="page">${buildLetterHTML(d)}</div>`;
}

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function docNumber(
  type: string,
  name: string,
  reg: string,
  team: string,
  positionFrom: string,
  positionTo: string,
  teamFrom = "",
  teamTo = "",
  extra = "",
): string {
  const key = `${type.trim()}|${name.trim()}|${reg.trim()}|${team.trim()}|${positionFrom.trim()}|${positionTo.trim()}|${teamFrom.trim()}|${teamTo.trim()}|${extra.trim()}`;
  const h = fnv1a32(key);
  return "180DC-" + h.toString(16).toUpperCase().padStart(8, "0");
}

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

export const POSITION_OPTIONS = ["Junior Consultant", "Consultant", "Senior Consultant", "Lead", "Director", "Board Member", "Chairperson", "Vice Chairperson", "Gen Sec", "Co Sec", "Faculty Coordinator", "Advisory"];
export const TEAM_OPTIONS = ["Business Strategy", "Technical", "CRM", "Operations", "Marketing", "Finance and Legal", "HR", "R&D", "DevOps", "ML"];
export const DOC_TYPES = [
  { value: "appointment", label: "Appointment" },
  { value: "promotion", label: "Promotion" },
  { value: "termination", label: "Termination" },
  { value: "transfer", label: "Department Transfer" },
  { value: "resignation", label: "Resignation" },
  { value: "showcause", label: "Show-Cause / Warning" },
  { value: "service", label: "Service Certificate" },
  { value: "relieving", label: "Relieving Letter" },
  { value: "recognition", label: "Recognition Letter" },
  { value: "mou", label: "Memorandum of Understanding (MOU)" },
  { value: "announcement", label: "Announcement Letter" },
  { value: "department-report", label: "Department Report" },
  { value: "ldi", label: "LDI Form" },
];
export const REG_PATTERN = /^[0-9]{2}[BM][A-Z]{2}[1-9][0-9]{3}$/;

// Build the full LetterData model from the studio form state.
// Mirrors the original studio's collect() but reads from React state.
export function collectLetterData(form: Record<string, string>, mouLogoData = "", announcementFileName = ""): LetterData {
  const type = form["f-type"] || "appointment";
  const isAnnouncement = type === "announcement";
  const isDepartmentReport = type === "department-report";
  const isLDI = type === "ldi";
  const name = isAnnouncement
    ? "(announcement)"
    : isDepartmentReport
      ? (form["f-report-director"] || "").trim() || "(director)"
      : isLDI
        ? (form["f-ldi-submitter"] || "").trim() || "(submitter)"
        : (form["f-name"] || "").trim() || "(name)";
  const reg = isAnnouncement || isDepartmentReport ? "(not applicable)" : (form["f-reg"] || "").trim().toUpperCase() || "(REGISTRATION NUMBER)";
  const position = isDepartmentReport
    ? "Director"
    : isLDI
      ? (form["f-ldi-position"] || "").trim() || "Proposer"
      : form["f-position"] || "Junior Consultant";
  const positionFrom = type === "promotion" ? form["f-position-from"] || position : position;
  const positionTo = type === "promotion" ? form["f-position-to"] || position : position;
  const team =
    type === "transfer"
      ? form["f-team-from"] || ""
      : isDepartmentReport
        ? form["f-report-department"] || ""
        : isLDI
          ? form["f-ldi-department"] || ""
          : form["f-team"] || "";
  const teamFrom = type === "transfer" ? form["f-team-from"] || "" : team;
  const teamTo = type === "transfer" ? form["f-team-to"] || "" : team;

  const extra = isAnnouncement
    ? `${form["f-announcement-sender"] || ""}|${form["f-announcement-tone"] || ""}|${form["f-announcement-kind"] || ""}|${form["f-announcement-message"] || ""}`
    : isDepartmentReport
      ? `${form["f-report-time"] || ""}|${form["f-report-overview"] || ""}|${form["f-report-tasks"] || ""}|${form["f-report-updates"] || ""}|${form["f-report-strength"] || ""}|${form["f-report-tech-aiml"] || ""}|${form["f-report-tech-product"] || ""}|${form["f-report-tech-devops"] || ""}`
      : isLDI
        ? `${form["f-ldi-title"] || ""}|${form["f-ldi-department"] || ""}|${form["f-ldi-category"] || ""}|${form["f-ldi-summary"] || ""}|${form["f-ldi-outcome"] || ""}|${form["f-ldi-cost"] || ""}|${form["f-ldi-timeline"] || ""}`
        : "";

  return {
    type,
    dateStr: fmtDate(form["f-date"] || "") || "(select date)",
    name,
    reg,
    position,
    positionFrom,
    positionTo,
    team,
    teamFrom,
    teamTo,
    ffcs: form["f-ffcs"] || "FFCS",
    techTrack: form["f-tech-track"] || "",
    performance: ["promotion", "termination"].includes(type) ? form["f-performance"] || "" : "",
    reason: type === "termination" ? (form["f-reason"] || "").trim() : "",
    resignationReason: type === "resignation" ? (form["f-resignation-reason"] || "").trim() : "",
    satisfaction: type === "resignation" ? form["f-satisfaction"] || "" : "",
    successor: type === "resignation" ? (form["f-successor"] || "").trim() : "",
    resignationFeedback: type === "resignation" ? (form["f-resignation-feedback"] || "").trim() : "",
    scType: type === "showcause" ? form["f-sc-type"] || "" : "",
    scIncident: type === "showcause" ? (form["f-sc-incident"] || "").trim() : "",
    scDate: type === "showcause" ? fmtDate(form["f-sc-date"] || "") : "",
    scTime: type === "showcause" ? form["f-sc-time"] || "" : "",
    scRemark: type === "showcause" ? (form["f-sc-remark"] || "").trim() : "",
    serviceProjects: type === "service" ? (form["f-service-projects"] || "").trim() : "",
    servicePositions: type === "service" ? (form["f-service-positions"] || "").trim() : "",
    serviceOutcome: type === "service" ? (form["f-service-outcome"] || "").trim() : "",
    relievingRating: type === "relieving" ? form["f-relieving-rating"] || "" : "",
    relievingComment: type === "relieving" ? (form["f-relieving-comment"] || "").trim() : "",
    recTask: type === "recognition" ? (form["f-rec-task"] || "").trim() : "",
    recOutcome: type === "recognition" ? (form["f-rec-outcome"] || "").trim() : "",
    mouParty: type === "mou" ? (form["f-mou-party"] || "").trim() : "",
    mouAddress: type === "mou" ? (form["f-mou-address"] || "").trim() : "",
    mouPurpose: type === "mou" ? (form["f-mou-purpose"] || "").trim() : "",
    mouScope: type === "mou" ? (form["f-mou-scope"] || "").trim() : "",
    mouRespOurs: type === "mou" ? (form["f-mou-resp-ours"] || "").trim() : "",
    mouRespOther: type === "mou" ? (form["f-mou-resp-other"] || "").trim() : "",
    mouDocs: type === "mou" ? (form["f-mou-docs"] || "").trim() : "",
    mouTerm: type === "mou" ? (form["f-mou-term"] || "").trim() : "",
    mouConfidentiality: type === "mou" ? (form["f-mou-confidentiality"] || "").trim() : "",
    mouTermination: type === "mou" ? (form["f-mou-termination"] || "").trim() : "",
    mouSignOurs: type === "mou" ? (form["f-mou-sign-ours"] || "").trim() : "",
    mouSignOther: type === "mou" ? (form["f-mou-sign-other"] || "").trim() : "",
    mouLogo: type === "mou" ? mouLogoData : "",
    announcementSender: isAnnouncement ? (form["f-announcement-sender"] || "").trim() : "",
    announcementSenderPosition: isAnnouncement ? form["f-announcement-sender-position"] || "" : "",
    announcementTone: isAnnouncement ? form["f-announcement-tone"] || "" : "",
    announcementKind: isAnnouncement ? form["f-announcement-kind"] || "" : "",
    announcementMessage: isAnnouncement ? (form["f-announcement-message"] || "").trim() : "",
    announcementFileName: isAnnouncement ? announcementFileName : "",
    announcementFileData: "",
    announcementEventDate: isAnnouncement && form["f-announcement-kind"] === "event" ? fmtDate(form["f-announcement-event-date"] || "") : "",
    announcementEventTime: isAnnouncement && form["f-announcement-kind"] === "event" ? form["f-announcement-event-time"] || "" : "",
    announcementEventVenue: isAnnouncement && form["f-announcement-kind"] === "event" ? (form["f-announcement-event-venue"] || "").trim() : "",
    announcementEventMode: isAnnouncement && form["f-announcement-kind"] === "event" ? form["f-announcement-event-mode"] || "" : "",
    announcementEventAction: isAnnouncement && form["f-announcement-kind"] === "event" ? (form["f-announcement-event-action"] || "").trim() : "",
    announcementEventNotes: isAnnouncement && form["f-announcement-kind"] === "event" ? (form["f-announcement-event-notes"] || "").trim() : "",
    reportTime: isDepartmentReport ? form["f-report-time"] || "" : "",
    reportDirector: isDepartmentReport ? (form["f-report-director"] || "").trim() : "",
    reportDepartment: isDepartmentReport ? form["f-report-department"] || "" : "",
    reportOverview: isDepartmentReport ? (form["f-report-overview"] || "").trim() : "",
    reportTasks: isDepartmentReport ? (form["f-report-tasks"] || "").trim() : "",
    reportUpdates: isDepartmentReport ? (form["f-report-updates"] || "").trim() : "",
    reportHold: isDepartmentReport ? (form["f-report-hold"] || "").trim() : "",
    reportStruggles: isDepartmentReport ? (form["f-report-struggles"] || "").trim() : "",
    reportStrengths: isDepartmentReport ? (form["f-report-strengths"] || "").trim() : "",
    reportOther: isDepartmentReport ? (form["f-report-other"] || "").trim() : "",
    reportVision: isDepartmentReport ? (form["f-report-vision"] || "").trim() : "",
    reportResponsibility: isDepartmentReport ? (form["f-report-responsibility"] || "").trim() : "",
    reportStrength: isDepartmentReport ? form["f-report-strength"] || "" : "",
    reportSubteams: isDepartmentReport ? (form["f-report-subteams"] || "").trim() : "",
    reportSenior: isDepartmentReport ? (form["f-report-senior"] || "").trim() : "",
    reportPromising: isDepartmentReport ? (form["f-report-promising"] || "").trim() : "",
    reportTechAIML: isDepartmentReport ? (form["f-report-tech-aiml"] || "").trim() : "",
    reportTechProduct: isDepartmentReport ? (form["f-report-tech-product"] || "").trim() : "",
    reportTechDevOps: isDepartmentReport ? (form["f-report-tech-devops"] || "").trim() : "",
    ldiSubmitter: isLDI ? (form["f-ldi-submitter"] || "").trim() : "",
    ldiPosition: isLDI ? (form["f-ldi-position"] || "").trim() : "",
    ldiDepartment: isLDI ? form["f-ldi-department"] || "" : "",
    ldiCategory: isLDI ? form["f-ldi-category"] || "" : "",
    ldiDate: isLDI ? fmtDate(form["f-ldi-date"] || "") : "",
    ldiPriority: isLDI ? form["f-ldi-priority"] || "" : "",
    ldiTitle: isLDI ? (form["f-ldi-title"] || "").trim() : "",
    ldiSummary: isLDI ? (form["f-ldi-summary"] || "").trim() : "",
    ldiProblem: isLDI ? (form["f-ldi-problem"] || "").trim() : "",
    ldiWhy: isLDI ? (form["f-ldi-why"] || "").trim() : "",
    ldiHow: isLDI ? (form["f-ldi-how"] || "").trim() : "",
    ldiExpect: isLDI ? (form["f-ldi-expect"] || "").trim() : "",
    ldiOutcome: isLDI ? (form["f-ldi-outcome"] || "").trim() : "",
    ldiBeneficiaries: isLDI ? (form["f-ldi-beneficiaries"] || "").trim() : "",
    ldiImpact: isLDI ? (form["f-ldi-impact"] || "").trim() : "",
    ldiMetrics: isLDI ? (form["f-ldi-metrics"] || "").trim() : "",
    ldiCost: isLDI ? (form["f-ldi-cost"] || "").trim() : "",
    ldiResources: isLDI ? (form["f-ldi-resources"] || "").trim() : "",
    ldiAllocation: isLDI ? (form["f-ldi-allocation"] || "").trim() : "",
    ldiDependencies: isLDI ? (form["f-ldi-dependencies"] || "").trim() : "",
    ldiGuesstimate: isLDI ? (form["f-ldi-guesstimate"] || "").trim() : "",
    ldiAssumptions: isLDI ? (form["f-ldi-assumptions"] || "").trim() : "",
    ldiEvidence: isLDI ? (form["f-ldi-evidence"] || "").trim() : "",
    ldiTimeline: isLDI ? (form["f-ldi-timeline"] || "").trim() : "",
    ldiMilestones: isLDI ? (form["f-ldi-milestones"] || "").trim() : "",
    ldiPilot: isLDI ? (form["f-ldi-pilot"] || "").trim() : "",
    ldiRollout: isLDI ? (form["f-ldi-rollout"] || "").trim() : "",
    ldiRisks: isLDI ? (form["f-ldi-risks"] || "").trim() : "",
    ldiTradeoffs: isLDI ? (form["f-ldi-tradeoffs"] || "").trim() : "",
    ldiAlternatives: isLDI ? (form["f-ldi-alternatives"] || "").trim() : "",
    ldiScope: isLDI ? (form["f-ldi-scope"] || "").trim() : "",
    ldiOwner: isLDI ? (form["f-ldi-owner"] || "").trim() : "",
    ldiStakeholders: isLDI ? (form["f-ldi-stakeholders"] || "").trim() : "",
    ldiSupporters: isLDI ? (form["f-ldi-supporters"] || "").trim() : "",
    ldiOpponents: isLDI ? (form["f-ldi-opponents"] || "").trim() : "",
    ldiApprovals: isLDI ? (form["f-ldi-approvals"] || "").trim() : "",
    ldiCommunication: isLDI ? (form["f-ldi-communication"] || "").trim() : "",
    ldiMaintenance: isLDI ? (form["f-ldi-maintenance"] || "").trim() : "",
    ldiDecision: isLDI ? form["f-ldi-decision"] || "" : "",
    ldiReview: isLDI ? (form["f-ldi-review"] || "").trim() : "",
    ldiNext: isLDI ? (form["f-ldi-next"] || "").trim() : "",
    ldiFinal: isLDI ? (form["f-ldi-final"] || "").trim() : "",
    docnum: docNumber(type, name, reg, team, positionFrom, positionTo, teamFrom, teamTo, extra),
  };
}
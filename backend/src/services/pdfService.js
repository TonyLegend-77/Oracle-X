import PDFDocument from "pdfkit";

// Shared by /generate/* and the /mcp download links. Renders the same
// content_json every route already produces into a plain, readable PDF —
// no branding assets required, so it has zero extra deploy dependencies.

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function baseDoc(title) {
  const doc = new PDFDocument({ margin: 56 });
  doc.fontSize(18).fillColor("#2a1f2d").text(title);
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor("#8a7686")
    .text(`Generated ${new Date().toLocaleString()} · Maternal Health Companion`);
  doc.moveDown(1.2);
  doc.fillColor("#2a1f2d").fontSize(11);
  return doc;
}

function section(doc, title, items) {
  if (!items || !items.length) return;
  doc.fontSize(13).fillColor("#c13f6b").text(title);
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#2a1f2d");
  items.forEach((item) => doc.text(`•  ${item}`, { paragraphGap: 4 }));
  doc.moveDown(0.6);
}

function footerDisclaimer(doc, text) {
  doc.moveDown(1.5);
  doc.fontSize(9).fillColor("#8a7686").text(text);
}

export async function reportToPdf(content) {
  const doc = baseDoc("Health Report");

  doc.fontSize(13).fillColor("#c13f6b").text("Summary");
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#2a1f2d").text(content.summary || "");
  doc.moveDown(0.6);

  section(
    doc,
    "Insights",
    (content.insights || []).map((i) => `[${i.type}] ${i.text}`)
  );

  doc.fontSize(13).fillColor("#c13f6b").text("Flagged for provider");
  doc.moveDown(0.3);
  doc
    .fontSize(11)
    .fillColor("#2a1f2d")
    .text(content.flagged_for_provider ? `Yes — ${content.flag_reason || "see summary"}` : "No");

  footerDisclaimer(
    doc,
    "This is an informational and productivity tool. It is not a medical device, does not diagnose, and does not replace your healthcare provider."
  );

  return streamToBuffer(doc);
}

export async function letterToPdf(content) {
  const doc = baseDoc(content.subject || "Draft Letter");
  doc.fontSize(11).fillColor("#2a1f2d").text(content.body || "", { lineGap: 4 });
  footerDisclaimer(doc, content.disclaimer || "Draft only. Review before sending. Not legal advice.");
  return streamToBuffer(doc);
}

export async function prepSheetToPdf(content) {
  const doc = baseDoc("Appointment Prep Sheet");
  section(doc, "Key points to mention", content.key_points_to_mention);
  section(doc, "Suggested questions", content.suggested_questions);
  section(doc, "Red flags to raise", content.red_flags_to_raise);
  footerDisclaimer(
    doc,
    "This is an informational and productivity tool. It is not a medical device and does not predict outcomes."
  );
  return streamToBuffer(doc);
}

export async function actionItemsToPdf(content) {
  const doc = baseDoc("Action Items");
  section(doc, "Immediate", content.immediate);
  section(doc, "This week", content.this_week);
  section(doc, "Discuss at next appointment", content.discuss_at_next_appointment);
  section(doc, "Long-term or optional", content.long_term_or_optional);
  footerDisclaimer(doc, content.disclaimer || "This is an extraction from your own notes. Review and adjust.");
  return streamToBuffer(doc);
}

export async function questionBankToPdf(content) {
  const doc = baseDoc("Appointment Question Bank");
  (content.categories || []).forEach((cat) => {
    doc.fontSize(13).fillColor("#c13f6b").text(cat.name);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#2a1f2d");
    if (cat.questions && cat.questions.length) {
      cat.questions.forEach((q) => doc.text(`•  ${q}`, { paragraphGap: 4 }));
    } else {
      doc.fillColor("#8a7686").text("None flagged.");
    }
    doc.moveDown(0.6);
  });
  footerDisclaimer(doc, content.disclaimer || "These are suggestions based on what you've shared. Edit or ignore freely.");
  return streamToBuffer(doc);
}

export async function debriefToPdf(content) {
  const doc = baseDoc("Post-Visit Debrief");
  section(doc, "What was discussed", content.what_was_discussed);

  if (content.action_plan && content.action_plan.length) {
    doc.fontSize(13).fillColor("#c13f6b").text("Action plan");
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#2a1f2d");
    content.action_plan.forEach((a) => doc.text(`•  ${a.item}  (${a.owner}, due: ${a.due || "n/a"})`, { paragraphGap: 4 }));
    doc.moveDown(0.6);
  }

  section(doc, "Questions for next time", content.questions_for_next_time);

  doc.fontSize(13).fillColor("#c13f6b").text("Flagged for follow-up");
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#2a1f2d").text(content.flagged_for_follow_up || "None");

  footerDisclaimer(
    doc,
    content.disclaimer || "This is your summary of the conversation you reported. Always confirm against your provider's notes."
  );
  return streamToBuffer(doc);
}

// The $2 bundle: one document, all 6 sections, each on its own page so it
// reads as a single well-organized deliverable rather than 6 outputs
// stapled together. `results` is { report, prep, letter, actionItems,
// questionBank, debrief } — debrief may be absent if no visitNotes were
// supplied, and that's fine, its section is just skipped.
export async function fullPackageToPdf(results) {
  const doc = new PDFDocument({ margin: 56 });

  doc.fontSize(22).fillColor("#2a1f2d").text("Maternal Health Companion");
  doc.fontSize(14).fillColor("#c13f6b").text("Full Package");
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#8a7686").text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown(1);
  doc.fontSize(11).fillColor("#2a1f2d").text(
    "This document contains: Health Report, Appointment Prep Sheet, Advocacy Letter, Action Items, Appointment Question Bank" +
      (results.debrief ? ", and Post-Visit Debrief." : ". (No Post-Visit Debrief — no visit notes were supplied.)")
  );

  const addSection = (title, render) => {
    doc.addPage();
    doc.fontSize(16).fillColor("#c13f6b").text(title);
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#2a1f2d");
    render();
  };

  if (results.report) {
    addSection("1. Health Report", () => {
      doc.fontSize(11).text(results.report.summary || "");
      doc.moveDown(0.4);
      (results.report.insights || []).forEach((i) => doc.text(`•  [${i.type}] ${i.text}`));
      doc.moveDown(0.4);
      doc.text(
        results.report.flagged_for_provider
          ? `Flagged for provider: Yes — ${results.report.flag_reason || "see summary"}`
          : "Flagged for provider: No"
      );
    });
  }

  if (results.prep) {
    addSection("2. Appointment Prep Sheet", () => {
      section(doc, "Key points to mention", results.prep.key_points_to_mention);
      section(doc, "Suggested questions", results.prep.suggested_questions);
      section(doc, "Red flags to raise", results.prep.red_flags_to_raise);
    });
  }

  if (results.letter) {
    addSection("3. Advocacy Letter", () => {
      doc.fontSize(12).fillColor("#2a1f2d").text(results.letter.subject || "", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).text(results.letter.body || "", { lineGap: 4 });
    });
  }

  if (results.actionItems) {
    addSection("4. Action Items", () => {
      section(doc, "Immediate", results.actionItems.immediate);
      section(doc, "This week", results.actionItems.this_week);
      section(doc, "Discuss at next appointment", results.actionItems.discuss_at_next_appointment);
      section(doc, "Long-term or optional", results.actionItems.long_term_or_optional);
    });
  }

  if (results.questionBank) {
    addSection("5. Appointment Question Bank", () => {
      (results.questionBank.categories || []).forEach((cat) => {
        doc.fontSize(12).fillColor("#c13f6b").text(cat.name);
        doc.moveDown(0.2);
        doc.fontSize(11).fillColor("#2a1f2d");
        if (cat.questions && cat.questions.length) {
          cat.questions.forEach((q) => doc.text(`•  ${q}`));
        } else {
          doc.fillColor("#8a7686").text("None flagged.");
        }
        doc.moveDown(0.5);
      });
    });
  }

  if (results.debrief) {
    addSection("6. Post-Visit Debrief", () => {
      section(doc, "What was discussed", results.debrief.what_was_discussed);
      (results.debrief.action_plan || []).forEach((a) =>
        doc.text(`•  ${a.item}  (${a.owner}, due: ${a.due || "n/a"})`)
      );
      doc.moveDown(0.4);
      section(doc, "Questions for next time", results.debrief.questions_for_next_time);
      doc.text(`Flagged for follow-up: ${results.debrief.flagged_for_follow_up || "None"}`);
    });
  }

  doc.addPage();
  doc
    .fontSize(9)
    .fillColor("#8a7686")
    .text(
      "This is an informational and productivity tool. It is not a medical device, does not diagnose, and does not replace your healthcare provider. Letters are drafts only and not legal advice."
    );

  return streamToBuffer(doc);
}

import { describe, expect, it } from "vitest";
import {
  candidateEmailTemplateHasRequiredToken,
  defaultCandidateEmailTemplate,
  normalizeCandidateEmailTemplate,
  REJECTION_TEMPLATE_KEY,
  requiredTokenForCandidateEmailPurpose,
  variablesForCandidateEmailPurpose,
} from "./candidateEmailTemplates";

describe("candidate email template purposes", () => {
  it("normalizes legacy templates to general purpose defaults", () => {
    const template = normalizeCandidateEmailTemplate({
      company_id: "company-1",
      key: "legacy",
      name: "Legacy",
      subject: "Hello",
      html_body: "<p>Body</p>",
    });

    expect(template.purpose).toBe("general");
    expect(template.is_default_for_purpose).toBe(false);
    expect(template.variables).toEqual(["candidate_name", "company_name", "job_title"]);
  });

  it("adds purpose-specific variables and required tokens", () => {
    expect(variablesForCandidateEmailPurpose("form_link")).toContain("form_link");
    expect(variablesForCandidateEmailPurpose("video_screening")).toContain("screening_link");
    expect(requiredTokenForCandidateEmailPurpose("form_link")).toBe("{{form_link}}");
    expect(requiredTokenForCandidateEmailPurpose("video_screening")).toBe("{{screening_link}}");
  });

  it("validates required link tokens for link templates", () => {
    const formTemplate = defaultCandidateEmailTemplate("company-1", "form_link");
    expect(candidateEmailTemplateHasRequiredToken(formTemplate)).toBe(true);

    expect(
      candidateEmailTemplateHasRequiredToken({
        ...formTemplate,
        html_body: "<p>Please complete this form.</p>",
      }),
    ).toBe(false);
  });

  it("generates candidate_email keys for new client templates", () => {
    const template = defaultCandidateEmailTemplate("company-1");

    expect(template.key).toMatch(/^candidate_email_/);
    expect(template.key).not.toBe(REJECTION_TEMPLATE_KEY);
    expect(template.id).toBeUndefined();
  });
});

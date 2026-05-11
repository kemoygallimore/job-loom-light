import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function DataProtection() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Data Protection Agreement</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <div className="prose prose-sm sm:prose-base max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary">
          <p>
            RizonHire ("we", "our", "the Platform") is committed to protecting the privacy and personal information of
            every candidate who applies to a role through our applicant tracking platform. This page explains what
            information we collect when you submit a job application, how it is stored, who can access it, and the
            rights you have over your data.
          </p>

          <h2>1. Information we collect</h2>
          <p>When you submit an application, we collect:</p>
          <ul>
            <li>Your full name, email address, and phone number.</li>
            <li>Your country, street address, and parish/state.</li>
            <li>Your highest education level.</li>
            <li>Your résumé/CV file.</li>
            <li>Your LinkedIn profile URL, if you choose to provide it (optional).</li>
            <li>Metadata about your application such as the job applied for and the date submitted.</li>
          </ul>

          <h2>2. Why we collect it</h2>
          <p>
            Your information is collected solely to allow the hiring company you applied to (the "Employer") to review
            your candidacy, contact you about the role, and manage you through their hiring process. We do not sell,
            rent, or share your personal data with third parties for marketing purposes.
          </p>

          <h2>3. Who can access your data</h2>
          <ul>
            <li>
              Authorised recruiters and hiring team members of the Employer you applied to. Each Employer's data is
              strictly isolated; no other Employer can view your application.
            </li>
            <li>
              A small number of RizonHire administrators, only when strictly necessary for platform support, security,
              or legal compliance.
            </li>
          </ul>

          <h2>4. How your data is stored</h2>
          <p>
            Personal information is stored in a secure database protected by row-level security policies that enforce
            tenant isolation. Résumés and uploaded documents are stored in private cloud storage and can only be
            accessed via short-lived signed links generated for authorised users. Files are never exposed publicly.
          </p>

          <h2>5. Retention</h2>
          <p>
            We retain your application data for as long as the Employer requires it for their recruitment and
            record-keeping purposes, or until you request deletion. Employers are responsible for setting their own
            retention policies in line with applicable laws.
          </p>

          <h2>6. Your rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Request a copy of the personal information we hold about you.</li>
            <li>Request correction of any inaccurate information.</li>
            <li>Request deletion of your application and associated data.</li>
            <li>Withdraw your consent to processing at any time.</li>
          </ul>
          <p>
            To exercise any of these rights, contact the Employer you applied to directly, or email us at{" "}
            <a href="mailto:privacy@rizonhire.com">privacy@rizonhire.com</a> and we will route your request
            appropriately.
          </p>

          <h2>7. Security</h2>
          <p>
            We use industry-standard encryption in transit (HTTPS/TLS) and at rest. Access to administrative systems
            requires authenticated accounts with role-based permissions. Despite reasonable safeguards, no online
            service can guarantee absolute security; we encourage candidates to never include highly sensitive
            identifiers (such as government ID numbers or financial details) in their application materials.
          </p>

          <h2>8. Changes to this agreement</h2>
          <p>
            We may update this Data Protection Agreement from time to time. The "Last updated" date at the top of the
            page reflects the latest revision. Material changes will be communicated through the application portal.
          </p>

          <h2>9. Contact</h2>
          <p>
            For any questions about this agreement or how your data is handled, contact{" "}
            <a href="mailto:privacy@rizonhire.com">privacy@rizonhire.com</a>.
          </p>
        </div>
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            Powered by <span className="font-medium">RizonHire</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
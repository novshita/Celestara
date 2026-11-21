import type { SignedOutView } from "./SignedOutHero";

const COPY = {
  profile: {
    title: "What opens up",
    text: "One saved birth profile, your explanation depth, what the Guide remembers, and clear controls to delete it. A sample is shown below.",
  },
  journal: {
    title: "A page of your own",
    text: "Write what you notice, come back to it, and delete it whenever you like. A sample is shown below.",
  },
} as const;

/** The dimmed sample under the sign-in form: what an account opens up. Plain markup, nothing in it
 * can be used (it is `inert`) and it is hidden from assistive technology, since the paragraph above
 * it says the same in words. */
export function SignedOutPreview({ view }: { view: Exclude<SignedOutView, "conversation"> }) {
  const copy = COPY[view];
  return (
    <section className="ac-inside" aria-labelledby="ac-inside-title">
      <h2 id="ac-inside-title">{copy.title}</h2>
      <p>{copy.text}</p>
      {view === "profile" ? <ProfileSample /> : <JournalSample />}
    </section>
  );
}

function ProfileSample() {
  return (
    <div className="ac-sample" inert aria-hidden="true" data-testid="sample">
      <div className="ac-cols">
        <div className="ac-col">
          <h3>Birth profile</h3>
          <div className="ac-kv">
            <span>Date</span><span>15 Aug 1990</span>
            <span>Time</span><span>14:30 · exact</span>
            <span>Place</span><span>18.98° N, 72.83° E</span>
            <span>Timezone</span><span>Asia/Kolkata</span>
          </div>
          <p className="ac-note" style={{ marginTop: 10 }}>One saved profile.</p>
        </div>
        <div className="ac-col">
          <h3>Preferences</h3>
          <div className="ac-seg"><span className="ac-on">Beginner</span><span>Technical</span></div>
          <div className="ac-kv"><span>Ayanamsa</span><span>Lahiri</span></div>
          <p className="ac-note" style={{ marginTop: 10 }}>A request in the Guide wins over the saved depth.</p>
        </div>
        <div className="ac-col">
          <h3>Guide memory <span style={{ color: "var(--ink3)" }}>3 of 50</span></h3>
          <div className="ac-bar"><i /></div>
          <div className="ac-row"><span>Prefers short answers</span><span>Forget</span></div>
          <div className="ac-row"><span>Works in product design</span><span>Forget</span></div>
          <p className="ac-note" style={{ marginTop: 10 }}>Nothing is remembered unless you add it.</p>
        </div>
        <div className="ac-col">
          <h3>Privacy and data</h3>
          <div className="ac-row"><span>Delete all memory</span><span>→</span></div>
          <div className="ac-row"><span>Delete all conversations</span><span>→</span></div>
          <div className="ac-danger">Delete my data erases everything. You type DELETE to confirm.</div>
        </div>
      </div>
    </div>
  );
}

const ICONS = {
  write: <><path d="M5 25l3-8L21 4l5 5L13 22z" /><path d="M18 7l5 5" /></>,
  edit: <><rect x="5" y="5" width="20" height="20" rx="2" /><path d="M10 11h10M10 15h10M10 19h6" /></>,
  delete: <path d="M7 9h16M12 9V6h6v3M9 9l1 16h10l1-16" />,
};

function JournalSample() {
  const steps = [
    { icon: ICONS.write, title: "Write an entry", text: "Your own words, saved to your account." },
    { icon: ICONS.edit, title: "Edit it later", text: "Come back and change what you wrote." },
    { icon: ICONS.delete, title: "Delete when you like", text: "Entries are yours to remove." },
  ];
  return (
    <div className="ac-sample" inert aria-hidden="true" data-testid="sample">
      <div className="ac-jgrid">
        <div className="ac-stack">
          <div className="ac-paper ac-s2" />
          <div className="ac-paper ac-s1" />
          <div className="ac-paper">
            <div className="ac-dline"><i className="ac-moon" /><span>Today · Sample entry</span></div>
            <h4>A restless morning</h4>
            <p>Felt unsettled before breakfast. Wrote down the question I want to ask the Guide about the Moon, then went for a walk.</p>
            <div className="ac-acts"><span>New entry</span><span>Edit</span><span>Delete</span></div>
          </div>
        </div>
        <div>
          <ul className="ac-steps">
            {steps.map((step) => (
              <li key={step.title}>
                <svg viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.4" focusable="false">{step.icon}</svg>
                <span><b>{step.title}</b>{step.text}</span>
              </li>
            ))}
          </ul>
          <div className="ac-skyline">
            <span className="cx-mono" style={{ color: "var(--gold)" }}>The sky now</span>
            <span>Moon in Mithuna (Vedic)</span>
            <span className="cx-tag">Sample</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useId, useState } from "react";

const navItems = [
  ["About", "about"],
  ["Academics", "academics"],
  ["Student life", "experience"],
  ["Admissions", "admissions"],
  ["Contact", "contact"],
];

const pillars = [
  { number: "01", title: "Academic depth", text: "Clear teaching, high expectations and the habits of mind students need to understand—not simply memorise." },
  { number: "02", title: "Wider opportunity", text: "Clubs, projects, sport, technology and leadership give students ways to discover strengths beyond the timetable." },
  { number: "03", title: "Personal attention", text: "Progress is personal. We combine challenge with guidance so students know what to improve and why it matters." },
];

const values = [
  ["01", "Curiosity", "Questions are not interruptions. They are where better learning begins."],
  ["02", "Ambition", "We set a high bar and give students the structure and support to reach it."],
  ["03", "Character", "Confidence matters most when it is matched by kindness, responsibility and judgement."],
  ["04", "Purpose", "Knowledge becomes powerful when students can connect it to the world around them."],
];

const faqs = [
  ["How can I enquire?", "Use the enquiry form below. It opens a prepared email so you can send your details directly to the academy contact address."],
  ["Can I arrange a visit?", "Yes. Mention that you would like a visit in the enquiry form and the admissions team can respond with the next steps."],
  ["What does Oxford Bridge focus on?", "The academy combines academic foundations with communication, creativity, technology, leadership and wider student opportunities."],
  ["Does the website store my enquiry?", "No. This is a static website. The enquiry form prepares an email in your own mail application; nothing is submitted to a hidden database."],
];

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>,
    moon: <path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Reveal({ children, className = "" }) {
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return <div className={`reveal ${className}`}>{children}</div>;
}

function Brand({ onClick, footer = false }) {
  return (
    <button className={`brand ${footer ? "footer-brand" : ""}`} onClick={onClick} aria-label="Oxford Bridge Academy home">
      <span className="brand-mark"><span>O</span><i /></span>
      <span><b>OXFORD BRIDGE</b><small>ACADEMY</small></span>
    </button>
  );
}

function EnquiryModal({ onClose }) {
  const titleId = useId();
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const topic = String(form.get("topic") || "General enquiry");
    const message = String(form.get("message") || "").trim();
    const subject = encodeURIComponent(`Oxford Bridge Academy enquiry — ${topic}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${message}`);
    window.location.href = `mailto:hello@oxfordbridge.ac.uk?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="modal-close" onClick={onClose} aria-label="Close enquiry form"><Icon name="close" /></button>
        <div className="section-label">START HERE</div>
        <h2 id={titleId}>Make an <em>enquiry.</em></h2>
        {sent ? (
          <div className="form-success">
            <span className="success-icon"><Icon name="check" size={22} /></span>
            <h3>Your email is ready.</h3>
            <p>Your mail application should have opened with the details you entered. If it did not, email <a href="mailto:hello@oxfordbridge.ac.uk">hello@oxfordbridge.ac.uk</a> directly.</p>
            <button className="primary" onClick={onClose}>Close <Icon name="arrow" /></button>
          </div>
        ) : (
          <>
            <p className="modal-intro">Tell us what you need and we will prepare an email with your details. Nothing is stored on this website.</p>
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>Name<input name="name" required autoComplete="name" placeholder="Your name" /></label>
                <label>Email<input name="email" required type="email" autoComplete="email" placeholder="you@example.com" /></label>
              </div>
              <label>What can we help with?
                <select name="topic" defaultValue="Admissions">
                  <option>Admissions</option>
                  <option>Arrange a visit</option>
                  <option>Student life</option>
                  <option>General question</option>
                </select>
              </label>
              <label>Message<textarea name="message" required rows="4" placeholder="Tell us a little about your question..." /></label>
              <button className="primary" type="submit">Prepare email <Icon name="arrow" /></button>
              <small className="form-note">Your mail app handles the actual sending. No form data is saved by this site.</small>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("oba-theme") || "dark");
  const [menu, setMenu] = useState(false);
  const [enquiry, setEnquiry] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem("oba-theme", theme);
  }, [theme]);

  const go = (id) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="site-shell" id="top">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="announcement">
        <span><i /> Admissions information</span>
        <button onClick={() => setEnquiry(true)}>Start a conversation <Icon name="arrow" size={14} /></button>
      </div>

      <header className="nav-wrap">
        <nav className="nav" aria-label="Primary navigation">
          <Brand onClick={() => go("top")} />
          <div className={`nav-links ${menu ? "open" : ""}`}>
            {navItems.map(([label, id]) => <button key={id} onClick={() => go(id)}>{label}</button>)}
            <button className="mobile-enquire" onClick={() => { setMenu(false); setEnquiry(true); }}>Enquire <Icon name="arrow" size={15} /></button>
          </div>
          <div className="nav-actions">
            <button className="theme-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></button>
            <button className="nav-enquire" onClick={() => setEnquiry(true)}>Enquire <Icon name="arrow" size={15} /></button>
            <button className="menu-btn" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={menu ? "Close menu" : "Open menu"}><Icon name={menu ? "close" : "menu"} size={22} /></button>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-grid" /><div className="hero-glow hero-glow-a" /><div className="hero-glow hero-glow-b" />
          <div className="hero-copy">
            <div className="eyebrow"><span /> A different kind of academy</div>
            <h1 id="hero-title">Where <em>ambition</em><br />becomes <strong>ability.</strong></h1>
            <p>Oxford Bridge Academy is a forward-looking learning community where academic rigour meets creativity, character and the confidence to build what comes next.</p>
            <div className="hero-actions"><button className="primary" onClick={() => go("academics")}>Explore the academy <Icon name="arrow" /></button><button className="text-btn" onClick={() => go("about")}>Discover our approach <span>↓</span></button></div>
            <div className="hero-proof"><div><b>01</b><span>High expectations</span></div><div><b>02</b><span>Personal support</span></div><div><b>03</b><span>Future focused</span></div></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-1" /><div className="orbit orbit-2" /><div className="orbit orbit-3" />
            <div className="campus-card"><div className="campus-top"><span>OBA / 01</span><span>LEARN • CREATE • LEAD</span></div><div className="campus-building"><div className="tower" /><div className="wing wing-a" /><div className="wing wing-b" /><div className="light-line" /></div><div className="campus-bottom"><span>ACADEMIC</span><span>CREATIVE</span><span>CONNECTED</span></div></div>
            <div className="floating-note"><span className="note-dot" /><div><b>Built around students</b><small>Challenge with support.</small></div></div>
            <div className="hero-index">OBA<br /><b>EST. FOR THE FUTURE</b></div>
          </div>
        </section>

        <section className="section intro" id="about"><Reveal><div className="section-label">01 — THE OXFORD BRIDGE APPROACH</div><div className="intro-layout"><h2>Education with <em>direction.</em></h2><div><p className="lead">We believe the best education does more than prepare a student for an exam. It gives them the knowledge, judgement and self-belief to make something of what they learn.</p><p>That means demanding the best while making progress feel possible—with thoughtful teaching, ambitious opportunities and a culture where curiosity is taken seriously.</p><button className="line-link" onClick={() => go("experience")}>See student life <Icon name="arrow" size={17} /></button></div></div></Reveal></section>

        <section className="numbers" aria-label="Academy principles"><div><b>01</b><span>Knowledge first</span></div><div><b>02</b><span>People matter</span></div><div><b>03</b><span>Progress is personal</span></div><div><b>04</b><span>Future focused</span></div></section>

        <section className="section academics" id="academics"><Reveal><div className="section-head"><div><div className="section-label">02 — ACADEMICS</div><h2>Strong foundations.<br /><em>Open horizons.</em></h2></div><p>Learning at Oxford Bridge is structured, challenging and connected to the real world—giving students the foundations to go further.</p></div><div className="program-grid">{pillars.map((item) => <article className="program-card" key={item.number}><div className="card-top"><span>{item.number}</span><span>Oxford Bridge</span></div><div><h3>{item.title}</h3><p>{item.text}</p></div><button onClick={() => setEnquiry(true)} aria-label={`Ask about ${item.title}`}><Icon name="arrow" /></button></article>)}</div></Reveal></section>

        <section className="section statement" id="experience"><Reveal><div className="statement-number">03</div><div><div className="section-label">THE STUDENT EXPERIENCE</div><h2>Not just a place<br />to <em>study.</em></h2><p>Classrooms are only the beginning. Students need space to test ideas, collaborate, compete, create and discover what they are capable of.</p><div className="check-list"><span><Icon name="check" /> Clubs & enrichment</span><span><Icon name="check" /> Leadership opportunities</span><span><Icon name="check" /> Technology & creativity</span><span><Icon name="check" /> Sport & wellbeing</span></div></div><div className="experience-visual"><div className="visual-label">STUDENT LIFE / OBA</div><div className="visual-lines" /><div className="visual-ring" /><div className="visual-core">OBA</div><div className="visual-caption">Curious minds<br /><b>move the world.</b></div></div></Reveal></section>

        <section className="section values"><Reveal><div className="section-head"><div><div className="section-label">04 — WHAT WE VALUE</div><h2>The standard is<br /><em>higher.</em></h2></div><p>Professionalism starts with the small things: how we listen, how we challenge ideas and how we treat one another.</p></div><div className="value-grid">{values.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></Reveal></section>

        <section className="section admissions" id="admissions"><Reveal><div className="admission-panel"><div><div className="section-label">05 — ADMISSIONS</div><h2>Ready to take<br /><em>the next step?</em></h2><p>Tell us a little about what you are looking for. We will help you understand the academy, the admissions process and what happens next.</p><button className="primary light" onClick={() => setEnquiry(true)}>Make an enquiry <Icon name="arrow" /></button></div><div className="admission-steps"><div><span>01</span><b>Enquire</b><small>Share a few details.</small></div><div><span>02</span><b>Connect</b><small>Ask questions or visit.</small></div><div><span>03</span><b>Decide</b><small>Choose your next step.</small></div></div></div></Reveal></section>

        <section className="section faq"><Reveal><div className="section-label">06 — QUESTIONS</div><div className="faq-layout"><h2>Good questions<br />deserve <em>clear answers.</em></h2><div>{faqs.map(([question, answer], index) => <div className={`faq-item ${openFaq === index ? "open" : ""}`} key={question}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><Icon name={openFaq === index ? "close" : "plus"} size={18} /></button><div className="faq-answer"><p>{answer}</p></div></div>)}</div></div></Reveal></section>

        <section className="section contact" id="contact"><Reveal><div className="contact-card"><div><div className="section-label">07 — CONTACT</div><h2>Let's start<br /><em>a conversation.</em></h2><p>Questions about admissions, the academy or student life? We would be happy to hear from you.</p></div><div className="contact-details"><a href="mailto:hello@oxfordbridge.ac.uk">hello@oxfordbridge.ac.uk <Icon name="arrow" size={16} /></a><span>Slough · United Kingdom</span><button onClick={() => setEnquiry(true)}>Open enquiry form <Icon name="arrow" size={16} /></button></div></div></Reveal></section>
      </main>

      <footer><div className="footer-main"><div><Brand onClick={() => go("top")} footer /><p>Ambitious learning. Thoughtful people.<br />A future worth building.</p></div><div className="footer-links"><span>Explore</span>{navItems.slice(0, 4).map(([label, id]) => <button key={id} onClick={() => go(id)}>{label}</button>)}</div><div className="footer-links"><span>Connect</span><a href="mailto:hello@oxfordbridge.ac.uk">Email us</a><button onClick={() => setEnquiry(true)}>Make an enquiry</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Oxford Bridge Academy</span><span>Static site · No enquiry data stored here.</span></div></footer>

      {enquiry && <EnquiryModal onClose={() => setEnquiry(false)} />}
    </div>
  );
}

export default App;

import { useEffect, useState } from "react";

const navItems = [["About","about"],["Academics","academics"],["Experience","experience"],["Admissions","admissions"],["Contact","contact"]];
const programs = [
  { no:"01", title:"Academic excellence", text:"A rigorous, supportive curriculum built to develop knowledge, confidence and independent thinking.", tag:"Learn" },
  { no:"02", title:"Future-ready skills", text:"Digital fluency, communication, problem solving and creativity are woven into everyday learning.", tag:"Grow" },
  { no:"03", title:"Character & leadership", text:"Students are encouraged to lead, contribute and become thoughtful members of their community.", tag:"Lead" }
];
const values = [
  ["01","Curiosity","We make room for questions, experimentation and the confidence to think beyond the obvious."],
  ["02","Ambition","High expectations are paired with the guidance students need to turn ambition into progress."],
  ["03","Belonging","A strong school feels personal. Every student should feel known, respected and included."],
  ["04","Purpose","Learning matters most when students can connect it to the world they want to shape."]
];
const faqs = [
  ["How do I enquire about a place?","Use the enquiry form and our admissions team can follow up with the next steps, availability and any questions you have."],
  ["What does the school experience focus on?","Oxford Bridge combines strong academic foundations with technology, creativity, communication, leadership and wider opportunities."],
  ["Can I arrange a visit?","Yes. Submit an enquiry and request a visit. We can then help you find a suitable time."]
];

function Icon({name,size=20}){
  const p={
    arrow:<><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
    chevron:<path d="m6 9 6 6 6-6"/>,
    menu:<><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    close:<><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    moon:<path d="M20.5 14.7A8.5 8.5 0 0 1 9.3 3.5 8.5 8.5 0 1 0 20.5 14.7Z"/>,
    check:<path d="m5 12 4 4L19 6"/>,
    plus:<><path d="M12 5v14"/><path d="M5 12h14"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>;
}

function Reveal({children,className=""}){
  useEffect(()=>{
    const els=document.querySelectorAll(".reveal");
    const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add("is-visible")}),{threshold:.08});
    els.forEach(el=>obs.observe(el)); return()=>obs.disconnect();
  },[]);
  return <div className={`reveal ${className}`}>{children}</div>;
}

function App(){
  const [theme,setTheme]=useState(()=>localStorage.getItem("oba-theme")||"dark");
  const [menu,setMenu]=useState(false);
  const [enquiry,setEnquiry]=useState(false);
  const [openFaq,setOpenFaq]=useState(0);
  useEffect(()=>{document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme;localStorage.setItem("oba-theme",theme)},[theme]);
  useEffect(()=>{const f=e=>{if(e.key==="Escape"){setMenu(false);setEnquiry(false)}};window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f)},[]);
  const go=id=>{setMenu(false);document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"})};

  return <div className="site-shell">
    <div className="announcement"><span><i/> Admissions are open</span><button onClick={()=>setEnquiry(true)}>Start an enquiry <Icon name="arrow" size={14}/></button></div>
    <header className="nav-wrap"><nav className="nav">
      <button className="brand" onClick={()=>go("top")} aria-label="Oxford Bridge Academy home"><span className="brand-mark"><span>O</span><i/></span><span><b>OXFORD BRIDGE</b><small>ACADEMY</small></span></button>
      <div className={`nav-links ${menu?"open":""}`}>{navItems.map(([label,id])=><button key={id} onClick={()=>go(id)}>{label}</button>)}<button className="mobile-enquire" onClick={()=>{setMenu(false);setEnquiry(true)}}>Enquire <Icon name="arrow" size={15}/></button></div>
      <div className="nav-actions"><button className="theme-btn" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label="Toggle colour theme"><Icon name={theme==="dark"?"sun":"moon"} size={17}/></button><button className="nav-enquire" onClick={()=>setEnquiry(true)}>Enquire <Icon name="arrow" size={15}/></button><button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="Open menu"><Icon name={menu?"close":"menu"} size={22}/></button></div>
    </nav></header>

    <main id="top">
      <section className="hero"><div className="hero-grid"/><div className="hero-glow hero-glow-a"/><div className="hero-glow hero-glow-b"/>
        <div className="hero-copy"><div className="eyebrow"><span/> A different kind of academy</div><h1>Where <em>ambition</em><br/>becomes <strong>ability.</strong></h1><p>Oxford Bridge Academy is a forward-looking learning community where academic rigour meets creativity, character and the confidence to build what comes next.</p><div className="hero-actions"><button className="primary" onClick={()=>go("academics")}>Explore the academy <Icon name="arrow"/></button><button className="text-btn" onClick={()=>go("about")}>Discover our approach <span>↓</span></button></div><div className="hero-proof"><div><b>01</b><span>High expectations</span></div><div><b>02</b><span>Personal support</span></div><div><b>03</b><span>Future focused</span></div></div></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-1"/><div className="orbit orbit-2"/><div className="orbit orbit-3"/><div className="campus-card"><div className="campus-top"><span>OBA / 01</span><span>EST. FOR THE FUTURE</span></div><div className="campus-building"><div className="tower"/><div className="wing wing-a"/><div className="wing wing-b"/><div className="light-line"/></div><div className="campus-bottom"><span>LEARN</span><span>CREATE</span><span>LEAD</span></div></div><div className="floating-note"><span className="note-dot"/><div><b>Built around students</b><small>Not one-size-fits-all.</small></div></div></div>
      </section>

      <section className="intro section" id="about"><Reveal><div className="section-label">01 — THE OXFORD BRIDGE APPROACH</div><div className="intro-layout"><h2>Education with <em>direction.</em></h2><div><p className="lead">We believe the best education does more than prepare a student for an exam. It gives them the knowledge, judgement and self-belief to make something of what they learn.</p><p>That means demanding the best while making progress feel possible — with thoughtful teaching, ambitious opportunities and a culture where curiosity is taken seriously.</p><button className="line-link" onClick={()=>go("experience")}>See what student life looks like <Icon name="arrow" size={17}/></button></div></div></Reveal></section>
      <section className="numbers"><div><b>01</b><span>Ambitious by design</span></div><div><b>24/7</b><span>Curiosity encouraged</span></div><div><b>100%</b><span>Student centred</span></div><div><b>∞</b><span>Room to grow</span></div></section>

      <section className="academics section" id="academics"><Reveal><div className="section-head"><div><div className="section-label">02 — ACADEMICS</div><h2>Strong foundations.<br/><em>Open horizons.</em></h2></div><p>Learning at Oxford Bridge is structured, challenging and connected to the real world — giving students the foundations to go further.</p></div><div className="program-grid">{programs.map(p=><article className="program-card" key={p.no}><div className="card-top"><span>{p.no}</span><span>{p.tag}</span></div><div><h3>{p.title}</h3><p>{p.text}</p></div><button onClick={()=>setEnquiry(true)} aria-label={`Ask about ${p.title}`}><Icon name="arrow"/></button></article>)}</div></Reveal></section>

      <section className="statement section" id="experience"><Reveal><div className="statement-number">03</div><div><div className="section-label">THE EXPERIENCE</div><h2>Not just a place<br/>to <em>study.</em></h2><p>Classrooms are only the beginning. Students need space to test ideas, collaborate, compete, create and discover what they are capable of.</p><div className="check-list"><span><Icon name="check"/> Clubs & enrichment</span><span><Icon name="check"/> Leadership opportunities</span><span><Icon name="check"/> Technology & creativity</span><span><Icon name="check"/> Sport & wellbeing</span></div></div><div className="experience-visual"><div className="visual-label">STUDENT LIFE / 2026</div><div className="visual-ring"/><div className="visual-core">OBA</div><div className="visual-caption">Curious minds<br/><b>move the world.</b></div></div></Reveal></section>

      <section className="values section"><Reveal><div className="section-head"><div><div className="section-label">04 — WHAT WE VALUE</div><h2>The standard is<br/><em>higher.</em></h2></div><p>Professionalism starts with the small things: how we listen, how we challenge ideas and how we treat one another.</p></div><div className="value-grid">{values.map(v=><article key={v[0]}><span>{v[0]}</span><h3>{v[1]}</h3><p>{v[2]}</p></article>)}</div></Reveal></section>

      <section className="admissions section" id="admissions"><Reveal><div className="admission-panel"><div><div className="section-label">05 — ADMISSIONS</div><h2>Ready to take<br/><em>the next step?</em></h2><p>Tell us a little about what you are looking for. We will help you understand the academy, the admissions process and what happens next.</p><button className="primary light" onClick={()=>setEnquiry(true)}>Make an enquiry <Icon name="arrow"/></button></div><div className="admission-steps"><div><span>01</span><b>Enquire</b><small>Share a few details.</small></div><div><span>02</span><b>Connect</b><small>Ask questions & visit.</small></div><div><span>03</span><b>Decide</b><small>Choose your next step.</small></div></div></div></Reveal></section>

      <section className="faq section"><Reveal><div className="section-label">06 — QUESTIONS</div><div className="faq-layout"><h2>Good questions<br/>deserve <em>clear answers.</em></h2><div>{faqs.map((f,i)=><div className={`faq-item ${openFaq===i?"open":""}`} key={f[0]}><button onClick={()=>setOpenFaq(openFaq===i?-1:i)}><span>{f[0]}</span><Icon name={openFaq===i?"close":"plus"} size={18}/></button><div className="faq-answer"><p>{f[1]}</p></div></div>)}</div></div></Reveal></section>

      <section className="contact section" id="contact"><Reveal><div className="contact-card"><div><div className="section-label">07 — CONTACT</div><h2>Let's start<br/><em>a conversation.</em></h2><p>Questions about admissions, the academy or student life? We would be happy to hear from you.</p></div><div className="contact-details"><a href="mailto:hello@oxfordbridge.ac.uk">hello@oxfordbridge.ac.uk <Icon name="arrow" size={16}/></a><span>Slough · United Kingdom</span><button onClick={()=>setEnquiry(true)}>Open enquiry form <Icon name="arrow" size={16}/></button></div></div></Reveal></section>
    </main>

    <footer><div className="footer-main"><div><button className="brand footer-brand" onClick={()=>go("top")}><span className="brand-mark"><span>O</span><i/></span><span><b>OXFORD BRIDGE</b><small>ACADEMY</small></span></button><p>Ambitious learning. Thoughtful people.<br/>A future worth building.</p></div><div className="footer-links"><span>Explore</span>{navItems.slice(0,4).map(([label,id])=><button key={id} onClick={()=>go(id)}>{label}</button>)}</div><div className="footer-links"><span>Connect</span><a href="mailto:hello@oxfordbridge.ac.uk">Email us</a><button onClick={()=>setEnquiry(true)}>Make an enquiry</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Oxford Bridge Academy</span><span>Designed with intention.</span></div></footer>

    {enquiry&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setEnquiry(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="enquiry-title"><button className="modal-close" onClick={()=>setEnquiry(false)} aria-label="Close"><Icon name="close"/></button><div className="section-label">START HERE</div><h2 id="enquiry-title">Make an <em>enquiry.</em></h2><p>Tell us how we can help and we will get back to you.</p><form onSubmit={e=>{e.preventDefault();setEnquiry(false);alert("Thanks — your enquiry has been noted. Connect this form to your preferred email service to receive submissions.")}}><label>Name<input required placeholder="Your name"/></label><label>Email<input required type="email" placeholder="you@example.com"/></label><label>What can we help with?<select defaultValue=""><option value="" disabled>Select an option</option><option>Admissions</option><option>Arrange a visit</option><option>General question</option><option>Student life</option></select></label><button className="primary" type="submit">Send enquiry <Icon name="arrow"/></button></form></div></div>}
  </div>;
}
export default App;

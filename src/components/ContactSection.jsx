import { contactLinks } from '../data/contact.js'

import { contactIcons as icons } from './contactIcons.jsx'

/** Contact block for the home page: three large icon links (Instagram, email, GitHub). */
export default function ContactSection() {
  return (
    <header id="Contact" className="section contact">
      <div className="container">
        <div className="header margin-bottom_none">
          <h2 className="heading_primary">CONTACT</h2>
          <div className="subheading w-richtext">
            <p>Say hi about visuals, systems, or something in between.</p>
          </div>
        </div>
        <div className="contact_links">
          {contactLinks.map((c) => (
            <a
              key={c.id}
              href={c.url}
              className="contact_link"
              target={c.url.startsWith('mailto:') ? undefined : '_blank'}
              rel={c.url.startsWith('mailto:') ? undefined : 'noreferrer'}
            >
              <span className="contact_icon">{icons[c.id]}</span>
              <span className="contact_label">{c.label}</span>
              <span className="contact_handle">{c.handle}</span>
            </a>
          ))}
        </div>
      </div>
    </header>
  )
}

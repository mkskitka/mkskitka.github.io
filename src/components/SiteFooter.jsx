const InstagramIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 16 16">
    <path d="M8,1.441c2.136,0,2.389.009,3.233.047a4.419,4.419,0,0,1,1.485.276,2.472,2.472,0,0,1,.92.6,2.472,2.472,0,0,1,.6.92,4.419,4.419,0,0,1,.276,1.485c.038.844.047,1.1.047,3.233s-.009,2.389-.047,3.233a4.419,4.419,0,0,1-.276,1.485,2.644,2.644,0,0,1-1.518,1.518,4.419,4.419,0,0,1-1.485.276c-.844.038-1.1.047-3.233.047s-2.389-.009-3.233-.047a4.419,4.419,0,0,1-1.485-.276,2.472,2.472,0,0,1-.92-.6,2.472,2.472,0,0,1-.6-.92,4.419,4.419,0,0,1-.276-1.485c-.038-.844-.047-1.1-.047-3.233s.009-2.389.047-3.233a4.419,4.419,0,0,1,.276-1.485,2.472,2.472,0,0,1,.6-.92,2.472,2.472,0,0,1,.92-.6,4.419,4.419,0,0,1,1.485-.276c.844-.038,1.1-.047,3.233-.047M8,0C5.827,0,5.555.009,4.7.048A5.868,5.868,0,0,0,2.76.42a3.908,3.908,0,0,0-1.417.923A3.908,3.908,0,0,0,.42,2.76,5.868,5.868,0,0,0,.048,4.7C.009,5.555,0,5.827,0,8s.009,2.445.048,3.3A5.868,5.868,0,0,0,.42,13.24a3.908,3.908,0,0,0,.923,1.417,3.908,3.908,0,0,0,1.417.923,5.868,5.868,0,0,0,1.942.372C5.555,15.991,5.827,16,8,16s2.445-.009,3.3-.048a5.868,5.868,0,0,0,1.942-.372,4.094,4.094,0,0,0,2.34-2.34,5.868,5.868,0,0,0,.372-1.942c.039-.853.048-1.125.048-3.3s-.009-2.445-.048-3.3A5.868,5.868,0,0,0,15.58,2.76a3.908,3.908,0,0,0-.923-1.417A3.908,3.908,0,0,0,13.24.42,5.868,5.868,0,0,0,11.3.048C10.445.009,10.173,0,8,0Z" fill="currentColor" />
    <path d="M8,3.892A4.108,4.108,0,1,0,12.108,8,4.108,4.108,0,0,0,8,3.892Zm0,6.775A2.667,2.667,0,1,1,10.667,8,2.667,2.667,0,0,1,8,10.667Z" fill="currentColor" />
    <circle cx="12.27" cy="3.73" r="0.96" fill="currentColor" />
  </svg>
)

const LinkedInIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 16 16">
    <path d="M15.3,0H0.7C0.3,0,0,0.3,0,0.7v14.7C0,15.7,0.3,16,0.7,16h14.7c0.4,0,0.7-0.3,0.7-0.7V0.7 C16,0.3,15.7,0,15.3,0z M4.7,13.6H2.4V6h2.4V13.6z M3.6,5C2.8,5,2.2,4.3,2.2,3.6c0-0.8,0.6-1.4,1.4-1.4c0.8,0,1.4,0.6,1.4,1.4 C4.9,4.3,4.3,5,3.6,5z M13.6,13.6h-2.4V9.9c0-0.9,0-2-1.2-2c-1.2,0-1.4,1-1.4,2v3.8H6.2V6h2.3v1h0c0.3-0.6,1.1-1.2,2.2-1.2 c2.4,0,2.8,1.6,2.8,3.6V13.6z" fill="currentColor" />
  </svg>
)

export default function SiteFooter() {
  return (
    <footer id="Footer" className="footer">
      <div className="container">
        <div className="w-layout-grid grid_6-col gap-medium">
          <ul role="list" className="margin-bottom_none w-list-unstyled">
            <li>
              <h2 className="heading_xxsmall text-color_secondary">Connect</h2>
            </li>
            <li>
              <a href="mailto:mkskitka@gmail.com" className="footer_link w-inline-block">
                <div>mkskitka@gmail.com</div>
              </a>
            </li>
          </ul>
        </div>
        <div className="footer_bottom margin-top_medium">
          <ul role="list" aria-label="Social media links" className="footer_icon-group margin_top-auto w-list-unstyled">
            <li className="margin-bottom_none">
              <a href="https://www.instagram.com/rgb__tears/?hl=en" className="footer_icon-link w-inline-block" target="_blank" rel="noreferrer">
                <InstagramIcon />
                <div className="screen-reader">Instagram</div>
              </a>
            </li>
            <li className="margin-bottom_none">
              <a href="https://www.linkedin.com/in/mary-kate-skitka-6b6051135/" className="footer_icon-link w-inline-block" target="_blank" rel="noreferrer">
                <LinkedInIcon />
                <div className="screen-reader">LinkedIn</div>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

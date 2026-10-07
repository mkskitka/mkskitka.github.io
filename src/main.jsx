import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ScrollTrigger } from './lib/animations.js'

// Always start at the top on load / reload. Browsers (mobile Safari especially)
// otherwise restore the previous scroll position, which lands mid-way through the
// pinned sections.
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
ScrollTrigger.clearScrollMemory('manual')
window.scrollTo(0, 0)

import './styles/normalize.css'
import './styles/webflow.css'
import './styles/site.css'
import './styles/custom.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

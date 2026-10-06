# Camille Acosta Photography - Refined Site

New features:
- Animated responsive homepage
- Sticky shrinking navigation + mobile menu
- Scroll reveal effects and moving service ticker
- Portfolio page with category filters
- Full-screen portfolio lightbox + keyboard controls
- Testimonial slider
- Interactive FAQ
- Interactive booking calendar/date/time picker
- Contact inquiry form
- Responsive mobile/tablet layouts

## GitHub upload
Upload the contents of this folder to the ROOT of the `camilleacostaphoto` repository:

- index.html
- portfolio.html
- booking.html
- styles.css
- script.js
- assets/

Keep your existing `CNAME` file in the repository.

## Important: real booking
The calendar currently provides a polished interactive date/time experience, but GitHub Pages has no server/database to actually reserve appointments.

To make reservations real, provide Camille's public booking URL from Pixieset, Cal.com, Calendly, or Google Appointment Schedules. The live booking service can then be embedded in `booking.html` while preserving this design.

## Contact form
The current form opens a pre-filled email. A static GitHub Pages site cannot receive form submissions by itself. For in-page submissions, connect Formspree, Basin, Getform, etc.


## Ultimate mobile pass

This build adds:
- iPhone/Android safe-area support
- tablet-specific spacing
- persistent mobile booking button
- larger touch targets
- swipeable portfolio lightbox
- swipe-to-close lightbox gesture
- image counter in lightbox
- swipeable testimonials
- better narrow-screen image handling
- sticky mobile portfolio filters
- iOS form zoom prevention
- lazy-loaded images and async image decoding
- reduced-motion accessibility support
- landscape-phone behavior
- touch-specific hover handling

The portfolio lightbox now supports:
- tap/click to enlarge
- previous / next buttons
- keyboard arrows
- Escape to close
- left/right swipe
- downward swipe to close


## Homepage simplification
The homepage was intentionally simplified to follow the visual rhythm of Camille's Pixieset site:
- centered minimal branding
- large title and county line
- staggered photography collage
- brief personal introduction
- FAQ
- contact form

The existing Portfolio and Booking pages remain in place.


## Navigation + homepage booking update

Changed in this build:
- index.html
- portfolio.html
- booking.html
- styles.css
- script.js

All three pages now use the same navigation:
- Home
- Portfolio
- FAQ
- Book a Session

The mobile menu now uses the same 3-bar hamburger on every page.

The homepage screenshot/fabric contact background was removed.
The homepage now contains a clean booking/calendar section and inquiry form matching the Booking page style.

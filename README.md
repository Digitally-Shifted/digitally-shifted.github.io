# digitally-shifted.github.io — relaunch preview (noindex)

Static preview of the digitallyshifted.com relaunch, published for remote owner review.
**This is not production.** Production serves from the company cPanel after board approval.

- Source of truth: `Digitally-Shifted/website` @ `d970755` (clean tree, manifest sha256 `ed87beb1d95dabbb7cd7e024b6fa5e4cee352dfe8a1f0315e4d9739a4cbc983e`, 325 files)
- Built with: Node v26.12.1, npm 12.2.1, lockfile `package-lock.json` (`npm ci`), `npm run build`
- Deploy copy: every HTML file carries `<meta name="robots" content="noindex, nofollow">`; `robots.txt` disallows all crawling
- Not deployed here (host-specific): `quote.php` form handler (PHP — needs cPanel), `.htaccess` Apache rules (redirects, security headers, 404 handling)
- The contact form therefore does not submit on this preview. Full functional checks run on the cPanel preview before go-live.
- Do not edit files here; redeploy from the source repo instead. DIG-91 (Paperclip) owns this preview.

# Tests for puppeteer-extra-plugin-recaptcha

This directory contains tests for the puppeteer-extra-plugin-recaptcha plugin.

## Test Structure

The tests are organized by functionality:

- `index.test.ts`: Basic detection tests for reCAPTCHA and hCAPTCHA
- `detection.test.ts`: Extensive detection tests for all types of reCAPTCHA (checkbox, invisible, score-based)
- `solve.test.ts`: Tests for solving various types of CAPTCHAs
- `image-captcha.test.js`: Tests for the image CAPTCHA detection and solving

## Running Tests

Tests can be run using:

```bash
npm test
```

For running specific tests:

```bash
# Run only image captcha tests
npm test -- test/image-captcha.test.js

# Run only detection tests
npm test -- dist/detection.test.js
```

## Test Configuration

The tests use the AVA test runner. Configuration is in `ava.config.js` at the package root.

## Notes

- For tests that require solving CAPTCHAs (in `solve.test.ts`), you need to set the `TWOCAPTCHA_TOKEN` environment variable with a valid 2captcha API token.
- Tests will skip the actual solving if the token is not provided.
- The detection tests use public demo pages for testing detection capabilities. 
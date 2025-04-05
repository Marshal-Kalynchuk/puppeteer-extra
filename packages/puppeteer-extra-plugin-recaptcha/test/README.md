# Tests for puppeteer-extra-plugin-recaptcha

This directory contains tests for the puppeteer-extra-plugin-recaptcha plugin.

## Test Structure

The tests are now organized by captcha type and functionality:

### Captcha Types
- `/captcha-types/recaptcha.test.ts`: Tests specific to reCAPTCHA detection and solving
- `/captcha-types/hcaptcha.test.ts`: Tests specific to hCAPTCHA detection and solving
- `/captcha-types/image-captcha.test.ts`: Tests specific to image CAPTCHA detection and solving

### Common Tests
- `/common/detection.test.ts`: Common detection functionality and utilities
- `/common/solving.test.ts`: Common solving functionality and utilities

### Integration Tests
- `/integration/index.test.ts`: Integration tests for the plugin itself

This structure makes it easier to add new captcha types in the future while keeping the test files organized and maintainable.

## Running Tests

Tests can be run using:

```bash
npm test
```

For running specific tests:

```bash
# Run only image captcha tests
npm test -- test/captcha-types/image-captcha.test.ts

# Run only integration tests
npm test -- test/integration/index.test.ts
```

## Test Configuration

The tests use the AVA test runner. Configuration is in `ava.config-ts.js` at the package root, which is set up to run TypeScript tests directly without pre-compilation.

## Notes

- For tests that require solving CAPTCHAs, you need to set the `TWOCAPTCHA_TOKEN` environment variable with a valid 2captcha API token.
- Tests will skip the actual solving if the token is not provided.
- The detection tests use public demo pages for testing detection capabilities. 
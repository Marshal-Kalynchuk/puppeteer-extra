import test from 'ava'

// import { getBrowser } from '../common/detection.test'
import { getBrowser as getSolveBrowser, requiresApiKey } from '../common/solving.test'

// // Detection tests
// test('image-captcha: will detect in 2captcha demo normal captcha page', async t => {
//   const url = 'https://2captcha.com/demo/normal'
//   const { browser, page } = await getBrowser(url, { solveImageCaptchas: true })
//   const { captchas, error } = await (page as any).findRecaptchas()
//   t.is(error, null)
//   t.true(captchas.length >= 1)

//   const c = captchas.find((c: any) => c._vendor === 'image')
//   t.truthy(c)
//   t.is(c._vendor, 'image')
//   t.is(c.url, url)
//   t.truthy(c.imageUrl)
//   t.truthy(c.id)

//   await browser.close()
// })

// Solving tests
test('image-captcha: will solve image captchas in 2captcha demo', async t => {
  if (requiresApiKey(t)) return

  const testUrls = [
    'https://2captcha.com/demo/normal',
    'https://democaptcha.com/demo-form-eng/image.html',
    'https://demos.telerik.com/aspnet-ajax/captcha/examples/overview/defaultcs.aspx'
  ]

  const results = []

  for (const url of testUrls) {
    try {
      console.log(`\nTesting URL: ${url}`)
      const { browser, page } = await getSolveBrowser(url, {
        solveImageCaptchas: true
      })

      const result = await (page as any).solveRecaptchas()
      const { captchas, solutions, solved, error } = result
      
      if (error) {
        results.push({ url, success: false, error: error.message })
        console.log(`❌ Failed: ${url} - Error: ${error.message}`)
        continue
      }
      
      // Find image captchas
      const imageCaptchas = captchas.filter((c: any) => c._vendor === 'image')
      const hasImageCaptchas = imageCaptchas.length >= 1
      
      // Check if we got solutions for image captchas
      const imageSolutions = solutions.filter((s: any) => s._vendor === 'image')
      const hasSolutions = imageSolutions.length >= 1
      
      // Check if we solved image captchas
      const imageSolved = solved.filter((s: any) => s._vendor === 'image')
      const hasSolved = imageSolved.length >= 1
      
      const solvedCaptcha = imageSolved[0]
      const isCorrectlySolved = solvedCaptcha?._vendor === 'image' && solvedCaptcha?.isSolved === true

      const success = hasImageCaptchas && hasSolutions && hasSolved && isCorrectlySolved
      
      results.push({
        url,
        success,
        details: {
          foundCaptchas: hasImageCaptchas,
          foundSolutions: hasSolutions,
          solvedCaptchas: hasSolved,
          correctlySolved: isCorrectlySolved
        }
      })

      if (!success) {
        console.log(`❌ Failed: ${url}`)
        console.log(`  - Found captchas: ${hasImageCaptchas}`)
        console.log(`  - Found solutions: ${hasSolutions}`)
        console.log(`  - Solved captchas: ${hasSolved}`)
        console.log(`  - Correctly solved: ${isCorrectlySolved}`)
      }

      await browser.close()
    } catch (err) {
      results.push({ url, success: false, error: err.message })
      console.log(`❌ Error: ${url} - ${err.message}`)
    }
  }

  // Log summary of failures only
  const failedTests = results.filter(r => !r.success)
  if (failedTests.length > 0) {
    console.log('\nFailed Tests Summary:')
    failedTests.forEach(({ url, error, details }) => {
      console.log(`❌ ${url}`)
      if (error) {
        console.log(`  Error: ${error}`)
      }
      if (details) {
        console.log(`  Details:`, details)
      }
    })
  }

  // Assert that at least one test passed
  t.true(results.some(r => r.success), 'At least one test should pass')
})
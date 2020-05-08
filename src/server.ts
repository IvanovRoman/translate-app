import * as express from "express"
import * as puppeteer from "puppeteer"
import * as qs from "querystring"
import * as fs from "fs"

const app = express()

type Languages = { source: string; destination: string }

app.get("/", (req, res) => {
  res.json(JSON.stringify({ ok: 1 })).end()
})

app.get("/page", async (req, res) => {
  try {
    if (!req.query.url) {
      res.send("Нет одного ссылки на страницу")
      res.end()
    }
    if (!req.query.src) {
      res.send("Нет одного исходного языка")
      res.end()
    }
    if (!req.query.dest) {
      res.send("Нет одного конечного языка")
      res.end()
    }

    const linkToPage: any = req.query.url
    const src: any = req.query.src
    const dest: any = req.query.dest

    // const url: string = await generateUrl(linkToPage, {
    //   source: src,
    //   destination: dest,
    // })

    const { html, browser } = await translateContent(linkToPage, {
      source: src,
      destination: dest,
    })

    res.set("Content-Type", "text/html")
    res.write(html)
    res.end()

    // await saveHtml(html)
    await browser.close()
  } catch (err) {
    console.log(err)
  }
})

app.listen(process.env.PORT || 3000, () => {
  console.log("app running")
})

async function saveHtml(html: string): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    if (!html || html === "") {
      reject("No html page")
      return
    }

    try {
      fs.writeFile("demo.html", html, (err) => {
        console.log("File created!")
      })
    } catch (err) {
      reject(err)
    }
  })
}

async function generateUrl(url: string, langs: Languages): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    try {
      const googleLink: string = `https://translate.google.com/translate?hl=&sl=${langs.source}&tl=${langs.destination}&u=`
      const linkToPage: string = qs.escape(url)
      const resultUrl: string = googleLink + linkToPage
      resolve(resultUrl)
    } catch (err) {
      reject(err)
    }
  })
}
async function translateContent(
  url: string,
  langs: Languages
): Promise<{ html: string | undefined; browser: puppeteer.Browser }> {
  return new Promise<{ html: string | undefined; browser: puppeteer.Browser }>(
    async (resolve, reject) => {
      try {
        const browser = await puppeteer.launch({
          // ignoreDefaultArgs: true,
          // headless: false,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
          ],
        })
        const page = await browser.newPage()

        await page.setRequestInterception(true)
        page.on("request", (request) => {
          if (["image", "font"].indexOf(request.resourceType()) !== -1) {
            request.abort()
          } else {
            request.continue()
          }
        })
        await page.goto(url, { timeout: 0 })
        console.log(`Открываю страницу: ${url}`)

        await page.evaluate((langs) => {
          var pageLang = langs.source
          var userLang = langs.destination

          var uid = "1E07F158C6FA4460B352973E9693B329"
          var teId: any = "TE_" + uid
          var cbId = "TECB_" + uid

          function show() {
            window.setTimeout(function () {
              // @ts-ignore
              window[teId].showBanner(true)
            }, 10)
          }

          function newElem() {
            // @ts-ignore
            var elem = new google.translate.TranslateElement({
              autoDisplay: false,
              floatPosition: 0,
              multilanguagePage: true,
              pageLanguage: pageLang,
            })
            return elem
          }

          if (window[teId]) {
            show()
          } else {
            if (
              // @ts-ignore
              !window.google ||
              // @ts-ignore
              !google.translate ||
              // @ts-ignore
              !google.translate.TranslateElement
            ) {
              // @ts-ignore
              if (!window[cbId]) {
                // @ts-ignore
                window[cbId] = function () {
                  window[teId] = newElem()
                  show()
                }
              }
              var s = document.createElement("script")
              s.src =
                "https://translate.google.com/translate_a/element.js?cb=" +
                encodeURIComponent(cbId) +
                "&client=tee&hl=" +
                userLang
              document.getElementsByTagName("head")[0].appendChild(s)
            }
          }
        }, langs)
        await page.waitFor(5000)

        console.log("Autoscrolling page...")
        await autoScroll(page)
        console.log("Finished autoscrolling")
        const bodyTranslate: any = await page?.$("body")
        const html: string | undefined = await page?.evaluate(
          (body) => body.innerHTML,
          bodyTranslate
        )
        // const bodyHandle: any = await page.$("body")
        // const translatePage = await page.evaluate(
        //   (body) => body.innerHTML,
        //   bodyHandle
        // )
        // const frame = page.mainFrame()
        // const childFrame = frame
        //   .childFrames()
        //   .find((fr: puppeteer.Frame) => fr.name() === "c")

        // console.log("Url: ", childFrame?.url())
        // console.log("Autoscrolling page...")
        // await autoScroll(childFrame)
        // console.log("Finished autoscrolling")
        // const bodyTranslate: any = await childFrame?.$("body")
        // const html: string | undefined = await childFrame?.evaluate(
        //   (body) => body.innerHTML,
        //   bodyTranslate
        // )
        // const html: string | undefined = await childFrame?.content()
        resolve({ html, browser })
      } catch (err) {
        console.log(err)
        reject(err)
      }
    }
  )
}

async function autoScroll(page: any) {
  await page.evaluate(async () => {
    await new Promise<string>(async (resolve, reject) => {
      try {
        var totalHeight = 0
        var distance = 100
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight) {
            clearInterval(timer)
            resolve()
          }
        }, 300)
      } catch (err) {
        reject(err)
      }
    })
  })
}

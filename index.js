#!/usr/bin/env node
'use strict'
const request = require('request')
const cheerio = require('cheerio')
const mkdirp = require('mkdirp')
const co = require('co')
const fs = require('fs')
const join = require('path').join
const dirname = require('path').dirname
const resolve = require('url').resolve

const dir = process.argv[2] || process.cwd()

// eg. VOA《常速英语 Standard English》听力下载 - 美国之音
const listUrl = process.argv[3] || 'http://www.51voa.com/VOA_Standard_1.html'

co(run)
  .catch((err) => {
    console.error(err.stack)
  })

function *run () {
  console.log(`fetching... ${listUrl}`)
  const html = yield fetch(listUrl)

  const links = []
  const $ = cheerio.load(html)
  const $lis = $('#main .list a')
  $lis.each((i, el) => {
    const title = $(el).text().trim()
    if (!title) return // excluding a.lrc / a.tran
    const url = $(el).attr('href')
    links.push({ title, url })
  })
  const len = links.length
  console.log(`${len} links fetched`)

  for (let i = 0; i < len; i++) {
    const link = links[i]
    // console.log(`fetching... ${i}/${len} - ${link.title}`)
    let detailUrl = resolve(listUrl, link.url)
    try {
      const html = yield fetch(detailUrl)

      // legacy: 2016-04-24
      // eg. Player("/201604/fusion-reactor-still-in-works.mp3");
      // const audioPath = html.match(/Player\("(.+?)"\);/)[1]
      //   .substr(1) // removing leading `/`
      // // eg. http://downdb.51voa.com/201604/fusion-reactor-still-in-works.mp3
      // const audioUrl = `http://downdb.51voa.com/${audioPath}`

      // updated: 2022-07-27
      // eg. $(this).jPlayer("setMedia", {
      //    mp3:"https://files.51voa.cn/201905/drones-monitor-whale-health-in-australia.mp3" //mp3的播放地址
      // }).jPlayer("repeat");
      const audioUrl = html.match(/\bmp3:\s*['"](.+?)['"]/)[1]
      const audioPath = audioUrl.split('/').pop()

      const dest = join(dir, audioPath)
      console.log(`downloading... ${i}/${len} - ${link.title}`)
      yield download(audioUrl, dest)
    } catch (err) {
      console.error(err)
    }
  }

  console.log(`${len} files saved`)
}

function *download (url, dest) {
  return yield (done) => {
    if (fs.existsSync(dest)) return done() // skipping
    mkdirp.sync(dirname(dest))
    const writer = fs.createWriteStream(dest)
    writer.on('error', (err) => { done(err) })
    writer.on('finish', () => { done() })
    request(url).pipe(writer)
  }
}

function *fetch (url) {
  return yield (done) => {
    request(url, (err, res, html) => {
      done(err, html)
    })
  }
}

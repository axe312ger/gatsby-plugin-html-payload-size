const { join, basename, dirname, extname } = require('path')

const recursive = require('recursive-readdir')
const gzipSize = require('gzip-size')
const prettyBytes = require('pretty-bytes')
const chalk = require('chalk')
const Table = require('cli-table3')
const fs = require('fs-extra')

exports.onPostBuild = async function({ store }) {
  const program = store.getState().program
  const { directory } = program
  const publicDir = join(directory, 'public')

  // Find all html files
  const files = await recursive(publicDir)

  const htmlFiles = files
    .filter(file => extname(file) === '.html')
    .sort((a, b) => {
      const dirnameA = dirname(a)
      const dirnameB = dirname(b)
      const nameA = basename(a)
      const nameB = basename(b)

      if (dirnameA === dirnameB) {
        return nameA.localeCompare(nameB)
      }

      return dirnameA.localeCompare(dirnameB)
    })

  // Create table
  const table = new Table({
    head: ['File', 'File Size', 'TCP round trips', 'Analysis']
  })

  const cheerio = require('cheerio')

  for await (const file of htmlFiles) {
    const name = join(dirname(file).replace(publicDir, ''), basename(file))
    const size = await gzipSize.file(file)
    const prettySize = prettyBytes(size)

    const content = await fs.readFile(file)
    const $ = cheerio.load(content)

    const results = []

    // html payload fits into one round trip
    if (size <= 10000) {
      results.push('✅ html is loaded in one round trip')
    } else {
      results.push('⚠️ html needs to long to load')
    }

    // js async
    const asyncScripts = $('script[async]')
    if (asyncScripts.length > 0) {
      results.push('✅ js async ')
    } else {
      results.push('⚠️ js not async')
    }

    // css inlined
    const styles = $('style')
    if (styles.length > 0) {
      results.push('✅ css inlined')
    } else {
      results.push('⚠️ css not inlined')
    }

    // no blocking js
    const blockingScripts = $('script[src]:not([async])')
    if (blockingScripts.length > 0) {
      results.push(`⚠️ ${blockingScripts} blocking scripts found`)
    } else {
      results.push('✅ no blocking js')
    }

    // no blocking css
    const blockingStylesheets = $('link[rel="stylesheet"][href]')
    if (blockingStylesheets.length > 0) {
      results.push(`⚠️ ${blockingStylesheets} blocking stylesheets found`)
    } else {
      results.push('✅ no blocking css')
    }

    let rank = chalk.red('4+ (Bad!)')

    if (size <= 10000) {
      rank = chalk.green('1 (Perfect)')
    } else if (size <= 38000) {
      rank = chalk.blue('2 (Good)')
    } else if (size <= 94000) {
      rank = chalk.yellow('3 (Take care)')
    }

    table.push([name, prettySize, rank, results.join('\n')])
  }

  console.log(chalk.bold('\nHTML payload analysis:'))
  console.log(table.toString())
}

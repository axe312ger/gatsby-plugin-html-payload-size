const { join, basename, dirname, extname } = require('path')

const recursive = require('recursive-readdir')
const gzipSize = require('gzip-size')
const prettyBytes = require('pretty-bytes')
const chalk = require('chalk')
const Table = require('cli-table3')

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
    head: ['File', 'File Size', 'TCP round trips']
  })

  for await (const file of htmlFiles) {
    const name = join(dirname(file).replace(publicDir, ''), basename(file))
    const size = await gzipSize.file(file)
    const prettySize = prettyBytes(size)

    let rank = chalk.red('4+ (Bad!)')

    if (size <= 10000) {
      rank = chalk.green('1 (Perfect)')
    } else if (size <= 38000) {
      rank = chalk.blue('2 (Good)')
    } else if (size <= 94000) {
      rank = chalk.yellow('3 (Take care)')
    }

    table.push([name, prettySize, rank])
  }

  console.log(chalk.bold('\nHTML payload analysis:'))
  console.log(table.toString())
}

#!/usr/bin/env node
const yargsCmd = require('yargs')
const slug = require('slug')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const { BotDriver } = require('botium-core')

const { importHandler, importArgs } = require('../src/import')
const { exportHandler, exportArgs } = require('../src/export')

const writeConvo = (compiler, convo, outputDir) => {
  const filename = path.resolve(outputDir, slug(convo.header.name) + '.convo.txt')

  mkdirp.sync(outputDir)

  const scriptData = compiler.Decompile([convo], 'SCRIPTING_FORMAT_TXT')

  fs.writeFileSync(filename, scriptData)
  return filename
}

const writeUtterances = (compiler, utterance, samples, outputDir) => {
  const filename = path.resolve(outputDir, slug(utterance) + '.utterances.txt')

  mkdirp.sync(outputDir)

  const scriptData = [utterance, ...samples].join('\n')

  fs.writeFileSync(filename, scriptData)
  return filename
}

yargsCmd.usage('Botium Connector Rasa CLI\n\nUsage: $0 [options]') // eslint-disable-line
  .help('help').alias('help', 'h')
  .version('version', require('../package.json').version).alias('version', 'V')
  .showHelpOnFail(true)
  .strict(true)
  .command({
    command: 'import',
    describe: 'Importing Convos and Utterances from Rasa to Botium',
    builder: (yargs) => {
      for (const arg of Object.keys(importArgs)) {
        if (importArgs[arg].skipCli) continue
        yargs.option(arg, importArgs[arg])
      }
      yargs.option('output', {
        describe: 'Output directory',
        type: 'string',
        default: '.'
      })
    },
    handler: async (argv) => {
      const outputDir = argv.output

      let convos = []
      let utterances = []
      try {
        ({ convos, utterances } = await importHandler(argv))
      } catch (err) {
        console.log(`FAILED: ${err.message}`)
        return
      }

      const driver = new BotDriver()
      const compiler = await driver.BuildCompiler()

      for (const convo of convos) {
        try {
          const filename = writeConvo(compiler, convo, outputDir)
          console.log(`SUCCESS: wrote convo to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing convo "${convo.header.name}" failed: ${err.message}`)
        }
      }
      for (const utterance of utterances) {
        try {
          const filename = writeUtterances(compiler, utterance.name, utterance.utterances, outputDir)
          console.log(`SUCCESS: wrote utterances to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing utterances "${utterance.name}" failed: ${err.message}`)
        }
      }
    }
  })
  .command({
    command: 'export',
    describe: 'Creating Rasa Training Data from Botium',
    builder: (yargs) => {
      for (const arg of Object.keys(exportArgs)) {
        if (exportArgs[arg].skipCli) continue
        yargs.option(arg, exportArgs[arg])
      }
      yargs.option('input', {
        describe: 'Input directory',
        type: 'string',
        default: '.'
      })
      yargs.option('output', {
        describe: 'Output file',
        type: 'string',
        default: 'nlu-botium.yml'
      })
    },
    handler: async (argv) => {
      const driver = new BotDriver()
      const compiler = driver.BuildCompiler()
      compiler.ReadScriptsFromDirectory(argv.input)

      const convos = []
      const utterances = Object.keys(compiler.utterances).reduce((acc, u) => acc.concat([compiler.utterances[u]]), [])

      try {
        const result = await exportHandler(argv, { convos, utterances }, { statusCallback: (log, obj) => console.log(log, obj) })
        fs.writeFileSync(argv.output, result.nlucontent)
        console.log(`Wrote output to ${argv.output}`)
      } catch (err) {
        console.log(`FAILED: ${err.message}`)
      }
    }
  })
  .argv

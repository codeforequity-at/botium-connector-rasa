const path = require('path')
const fs = require('fs')
const slug = require('slug')
const _ = require('lodash')
const md = require('markdown').markdown
const YAML = require('yaml')
const debug = require('debug')('botium-connector-rasa')

const getEntityAsserters = (uttArray) => {
  const entities = {}

  uttArray.forEach((u, uindex) => {
    let entityName = null
    let entityValue = null

    if (_.isArray(u) && u[0] === 'link') {
      const href = u[1].href
      entityName = href
      entityValue = u[2]

      if (href.split(':').length === 2) {
        entityName = href.split(':')[0]
        entityValue = href.split(':')[1]
      }
    }
    if (_.isArray(u) && u[0] === 'link_ref' && uindex < uttArray.length - 1) {
      let entityTag = null
      try {
        entityTag = JSON.parse(uttArray[uindex + 1])
      } catch (err) {
      }
      if (entityTag && entityTag.entity) {
        entityName = entityTag.entity
        entityValue = entityTag.value || u[2]
      }
    }
    if (entityName && entityValue) {
      entities[entityName] = entities[entityName] || []
      entities[entityName].push(entityValue)
    }
  })
  if (Object.keys(entities).length === 0) return []

  const result = []
  result.push({
    name: 'ENTITIES',
    args: Object.keys(entities).concat('...')
  })
  result.push({
    name: 'ENTITY_VALUES',
    args: Object.keys(entities).reduce((agg, e) => agg.concat(entities[e]), []).concat('...')
  })
  return result
}

const getPlainUtterance = (uttArray) => {
  return uttArray.map((u, uindex) => {
    if (uindex > 0 && _.isArray(uttArray[uindex - 1]) && uttArray[uindex - 1][0] === 'link_ref') return ''
    if (_.isString(u)) return u
    if (_.isArray(u)) {
      if (u[0] === 'link') {
        return u[2]
      }
      if (u[0] === 'link_ref') {
        return u[2]
      }
      if (u[0] === 'em') {
        return `_${u[1]}_`
      }
    }
    return ''
  }).join('')
}

const resolveLinkHrefs = (uttArray) => uttArray.reduce((r, u, uindex) => {
  if (uindex > 0 && _.isArray(uttArray[uindex - 1]) && uttArray[uindex - 1][0] === 'link_ref') {
    if (u.startsWith('({')) {
      const endPara = u.indexOf('})')
      if (endPara > 0) {
        return [...r, u.substring(1, endPara + 1), u.substring(endPara + 2)]
      }
    }
    if (u.startsWith('{')) {
      const endPara = u.indexOf('}')
      if (endPara > 0) {
        return [...r, u.substring(0, endPara + 1), u.substring(endPara + 1)]
      }
    }
  }
  return [...r, u]
}, [])

const importIntents = async ({ nlufile, nlucontent, buildconvos, buildentities }, { statusCallback }) => {
  const status = (log, obj) => {
    debug(log, obj)
    if (statusCallback) statusCallback(log, obj)
  }

  if (nlufile) {
    if (!fs.existsSync(nlufile)) {
      throw new Error(`File ${nlufile} not readable`)
    }
    if (path.extname(nlufile) !== '.yml' && path.extname(nlufile) !== '.yaml' && path.extname(nlufile) !== '.md') {
      throw new Error(`Only YAML files (*.yaml, *.yml) and Markdown files (*.md) supported (${nlufile})`)
    }
    nlucontent = fs.readFileSync(nlufile, 'utf8')
  }

  const convos = []
  const utterances = []

  const handleMarkdownIntent = (intentName, uttList) => {
    const inputUtterances = []
    if (uttList && uttList[0] === 'bulletlist') {
      for (const uttItem of uttList.slice(1).filter(u => u[0] === 'listitem')) {
        const utt = getPlainUtterance(resolveLinkHrefs(uttItem.slice(1)))
        inputUtterances.push(utt)

        if (buildentities) {
          const entityAsserters = getEntityAsserters(resolveLinkHrefs(uttItem.slice(1)))
          if (entityAsserters && entityAsserters.length > 0) {
            const convo = {
              header: {
                name: intentName + '_' + slug(utt)
              },
              conversation: [
                {
                  sender: 'me',
                  messageText: utt
                },
                {
                  sender: 'bot',
                  asserters: [
                    {
                      name: 'INTENT',
                      args: [intentName]
                    }
                  ].concat(entityAsserters)
                }
              ]
            }
            convos.push(convo)
          }
        }
      }
    }
    if (buildconvos) {
      const convo = {
        header: {
          name: intentName
        },
        conversation: [
          {
            sender: 'me',
            messageText: intentName
          },
          {
            sender: 'bot',
            asserters: [
              {
                name: 'INTENT',
                args: [intentName]
              }
            ]
          }
        ]
      }
      convos.push(convo)
    }

    utterances.push({
      name: intentName,
      utterances: inputUtterances
    })
  }

  let yamlData = null
  let yamlErr = null
  let mdData = null
  let mdErr = null

  try {
    const data = YAML.parse(nlucontent)
    if (data && data.nlu) {
      yamlData = data
    }
  } catch (err) {
    yamlErr = err
  }
  if (!yamlData) {
    try {
      mdData = md.parse(nlucontent)
    } catch (err) {
      mdErr = err
    }
  }
  if (!yamlData && !mdData) {
    if (yamlErr) status(`YAML parsing failure: ${yamlErr.message}`)
    if (mdErr) status(`Markdown parsing failure: ${mdErr.message}`)
    throw new Error('Failed to read Rasa file, neither YAML nor MD recognized')
  }

  if (yamlData) {
    for (const intentData of yamlData.nlu) {
      if (intentData.intent) {
        const intentName = intentData.intent.split('/').length > 1 ? intentData.intent.split('/')[0] : intentData.intent
        const uttList = md.parse(intentData.examples)[1]
        handleMarkdownIntent(intentName, uttList)
      }
    }
  } else if (mdData) {
    let mainPointer = 0
    while (true) {
      if (mainPointer >= mdData.length) break

      if (mdData[mainPointer][0] === 'header') {
        if (mdData[mainPointer][1].level === 2 && mdData[mainPointer][2].startsWith('intent:')) {
          const intentName = getPlainUtterance(resolveLinkHrefs(mdData[mainPointer].slice(2))).split(':')[1]

          mainPointer++
          handleMarkdownIntent(intentName, mdData[mainPointer])
          continue
        }
      }
      mainPointer++
    }
  }

  return { convos, utterances }
}

module.exports = {
  importHandler: ({ nlufile, nlucontent, buildconvos, buildentities, ...rest } = {}, { statusCallback } = {}) => importIntents({ nlufile, nlucontent, buildconvos, buildentities, ...rest }, { statusCallback }),
  importArgs: {
    nlufile: {
      describe: 'Specify the path to the nlu file of your Rasa model (*.yaml, *.yml, *.md)',
      type: 'string',
      required: false
    },
    nlucontent: {
      describe: 'Rasa model file content',
      type: 'string',
      required: false,
      skipCli: true
    },
    buildconvos: {
      describe: 'Build convo files with intent asserters',
      type: 'boolean',
      default: true
    },
    buildentities: {
      describe: 'Add entity asserters to convo files',
      type: 'boolean',
      default: false
    }
  }
}

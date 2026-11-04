/* Ad-hoc check of plugins/index.json against format-1 rules (mirrors dsh-plugin-market-index). */
const fs = require('node:fs')
const path = require('node:path')

const root = process.argv[2]
const raw = fs.readFileSync(path.join(root, 'index.json'), 'utf8')
let index
try {
  index = JSON.parse(raw)
} catch (error) {
  console.log('JSON PARSE FAILED:', error.message)
  process.exit(1)
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
const COMMIT = /^[0-9a-f]{40}$/
const PATH_SEGMENT = /^[A-Za-z0-9._@+-]+$/
const LANGUAGE = /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/

const problems = []
const check = (ok, message) => {
  if (!ok) problems.push(message)
}
const localized = (value, at) => {
  check(value && typeof value === 'object' && !Array.isArray(value) && typeof value.en === 'string', `${at} must be localized text containing en`)
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) check(LANGUAGE.test(key), `${at}.${key} must be a lowercase language id`)
  }
}

check(index.format === 1, '$.format must be 1')
localized(index.title, '$.title')
if (index.description !== undefined) localized(index.description, '$.description')

const categories = Object.keys((index.metadata && index.metadata.categories) || {})
const labels = Object.keys((index.metadata && index.metadata.labels) || {})
for (const group of ['categories', 'labels']) {
  for (const [id, decl] of Object.entries(((index.metadata || {})[group]) || {})) {
    check(id !== '', `$.metadata.${group} must not declare an empty id`)
    localized(decl.title, `$.metadata.${group}.${id}.title`)
  }
}

const seen = new Set()
for (const [i, plugin] of index.plugins.entries()) {
  const at = `$.plugins[${i}]`
  check(typeof plugin.name === 'string' && PACKAGE_NAME.test(plugin.name), `${at}.name must be a valid npm package name`)
  check(!seen.has(plugin.name), `${at}.name duplicates ${plugin.name}`)
  seen.add(plugin.name)
  if (plugin.title !== undefined) localized(plugin.title, `${at}.title`)
  if (plugin.description !== undefined) localized(plugin.description, `${at}.description`)
  if (plugin.metadata && plugin.metadata.category !== undefined) {
    check(categories.includes(plugin.metadata.category), `${at}.metadata.category references undeclared id ${plugin.metadata.category}`)
  }
  for (const label of (plugin.metadata && plugin.metadata.labels) || []) {
    check(labels.includes(label), `${at}.metadata.labels references undeclared id ${label}`)
  }
  check(Array.isArray(plugin.versions) && plugin.versions.length > 0, `${at}.versions must be a non-empty array`)
  for (const [j, version] of (plugin.versions || []).entries()) {
    const vat = `${at}.versions[${j}]`
    check(SEMVER.test(version.version), `${vat}.version must be an exact SemVer version`)
    const ts = version.publishTimestamp
    check(Number.isInteger(ts) && ts >= 0 && ts < 1e11, `${vat}.publishTimestamp must be Unix seconds in [0, 1e11)`)
    const source = version.source || {}
    if (source.type === 'npm') {
      check(source.registry === undefined || /^https?:\/\//.test(source.registry), `${vat}.source.registry must be http(s)`)
    } else if (source.type === 'git') {
      const url = source.url
      let parsed = null
      try {
        parsed = new URL(url)
      } catch {
        parsed = null
      }
      check(parsed !== null && parsed.protocol === 'https:', `${vat}.source.url must be an absolute https URL`)
      check(parsed !== null && parsed.href === url, `${vat}.source.url must be the canonical form`)
      check(/^(?:\/[^/]+){2,}$/.test(parsed ? parsed.pathname : ''), `${vat}.source.url must have at least two path segments`)
      check(!/\.(tgz|tar\.gz)$/i.test(parsed ? parsed.pathname : ''), `${vat}.source.url must not be a tarball`)
      check(COMMIT.test(source.commit), `${vat}.source.commit must be 40 lowercase hex digits`)
      const dir = source.path
      check(
        dir === undefined || (dir.split('/').every((segment) => segment !== '.' && segment !== '..' && PATH_SEGMENT.test(segment)) && dir.split('/')[0] !== ''),
        `${vat}.source.path must be a relative directory of safe segments`,
      )
      if (source.commit === '0'.repeat(40)) console.log(`NOTE ${vat}: commit is still the placeholder`)
    } else {
      problems.push(`${vat}.source.type must be "npm" or "git"`)
    }
    if (version.engines && version.engines.dsh !== undefined) {
      check(typeof version.engines.dsh === 'string' && !version.engines.dsh.startsWith('workspace:'), `${vat}.engines.dsh must be a SemVer range`)
    }
  }
  if (plugin.icon !== undefined) {
    const icon = plugin.icon
    const inline = /^data:(image\/svg\+xml|image\/png|image\/jpeg|image\/webp);base64,/.test(icon)
    check(inline || /\.(svg|png|jpe?g|webp)$/i.test(icon), `${at}.icon must be a data: image URL or an image path`)
    if (!inline) {
      check(fs.existsSync(path.join(root, icon)), `${at}.icon file ${icon} is missing beside index.json`)
    }
  }
}

for (const group of ['usage-today', 'skill-explorer']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, group, 'package.json'), 'utf8'))
  const patch = fs.readFileSync(path.join(root, group, 'cordis.patch.yml'), 'utf8')
  const rowName = (patch.match(/name:\s*'([^']+)'/) || [])[1]
  const listed = index.plugins.some((plugin) => plugin.name === manifest.name)
  const versionListed = index.plugins.some((plugin) =>
    plugin.name === manifest.name && plugin.versions.some((version) => version.version === manifest.version),
  )
  console.log(
    `${group.padEnd(15)} pkg=${manifest.name.padEnd(22)} row=${String(rowName).padEnd(22)} ` +
      `rowMatchesPackage=${rowName === manifest.name} inIndex=${listed} versionListed=${versionListed}`,
  )
  check(rowName === manifest.name, `${group}: patch row name ${rowName} must equal package name ${manifest.name}`)
  check(listed, `${group}: ${manifest.name} is not listed in index.json`)
  check(versionListed, `${group}: version ${manifest.version} is not listed in index.json`)
}

console.log(problems.length === 0 ? '\nINDEX OK — no format-1 violations found' : `\nPROBLEMS:\n- ${problems.join('\n- ')}`)
process.exit(problems.length === 0 ? 0 : 1)

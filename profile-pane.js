/*
 * profile-pane.js: a read-only SolidOS pane that shows a person's profile (WebID).
 *
 * Based on SolidOS profile-pane (MIT), https://github.com/SolidOS/profile-pane — rewritten as a single-file dynamic pane.
 *
 * One ES module, no imports. Reads the shared rdflib store (context.session.store) and never writes.
 * Sections: header (photo, name, nickname, pronouns, job title, location), Bio, Resume, Projects & Communities,
 * Friends, Follow me on, Skills, Languages, Contact. A section with no data is not shown.
 */

const NS = {
  foaf: 'http://xmlns.com/foaf/0.1/',
  vcard: 'http://www.w3.org/2006/vcard/ns#',
  schema: 'http://schema.org/',
  schemas: 'https://schema.org/',
  solid: 'http://www.w3.org/ns/solid/terms#',
  org: 'http://www.w3.org/ns/org#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  sioc: 'http://rdfs.org/sioc/ns#',
  skos: 'http://www.w3.org/2004/02/skos/core#'
}
const IANA_LANGUAGE = 'https://www.w3.org/ns/iana/language-code/'

const ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#7c4dff" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>')

// Social networks the upstream social-media ontology knows, by class local name: label, profile prefix, colour.
const NETWORKS = {
  FacebookAccount: ['Facebook', 'https://www.facebook.com/', '#1877f2'],
  InstagramAccount: ['Instagram', 'https://www.instagram.com/', '#e1306c'],
  LinkedInAccount: ['LinkedIn', 'https://www.linkedin.com/in/', '#0a66c2'],
  TiktokAccount: ['TikTok', 'https://www.tiktok.com/@', '#111111'],
  TwitterAccount: ['X', 'https://x.com/', '#111111'],
  YouTubeAccount: ['YouTube', 'https://www.youtube.com/', '#ff0000'],
  DiscordAccount: ['Discord', 'https://discord.com/users/', '#5865f2'],
  SnapchatAccount: ['Snapchat', 'https://www.snapchat.com/add/', '#e6c800'],
  PinterestAccount: ['Pinterest', 'https://pin.it/', '#e60023'],
  SpotifyAccount: ['Spotify', 'https://www.spotify.com/user/', '#1db954'],
  TelegramAccount: ['Telegram', 'https://t.me/', '#26a5e4'],
  DribbleAccount: ['Dribbble', 'https://dribbble.com/', '#ea4c89'],
  SharechatAccount: ['ShareChat', 'https://www.sharechat.com/user/', '#f5a623'],
  WhatsAppAccount: ['WhatsApp', 'https://wa.me/', '#25d366'],
  GitHubAccount: ['GitHub', 'https://github.com/', '#24292f'],
  MastodonAccount: ['Mastodon', '', '#6364ff']
}

const CSS = `
.prf.prf-root { max-width: 1400px; margin: 0 auto; box-sizing: border-box; padding: 4px 0 24px;
  container-type: inline-size; container-name: prf; color: #314158; font-size: 16px; line-height: 1.5; text-align: left }
.prf-root *, .prf-root *::before, .prf-root *::after { box-sizing: border-box }
.prf-root p { max-width: none }
.prf-root a { color: #5b34d6; text-decoration: none }
.prf-root a:hover { text-decoration: underline }
.prf-status { padding: 24px; color: #62748e }
.prf-grid { display: grid; grid-template-columns: minmax(0, 1fr) clamp(280px, 33.333%, 350px); gap: 20px; align-items: start }
.prf-main, .prf-side { display: flex; flex-direction: column; gap: 20px; min-width: 0 }
.prf-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 5px; padding: 25px; min-width: 0;
  overflow-wrap: anywhere; transition: box-shadow .2s ease }
.prf-card:hover { box-shadow: 0 8px 10px rgba(124, 77, 255, .1) }
.prf-sechead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 22px }
.prf-sechead h2 { margin: 0; font-size: 1.375rem; font-weight: 500; color: #314158; line-height: 1.3 }
.prf-toggle { display: none; border: 0; background: transparent; color: #62748e; cursor: pointer; padding: 6px;
  border-radius: 6px; line-height: 0 }
.prf-toggle:hover { background: #f3f4f6 }
.prf-toggle svg { width: 20px; height: 20px; transition: transform .2s ease }
.prf-section[data-open="false"] .prf-toggle svg { transform: rotate(-90deg) }

/* header */
.prf-head { grid-column: 1 / -1; display: flex; align-items: center; gap: 20px; padding: 14px 20px }
.prf-photo { width: 72px; height: 72px; flex: 0 0 72px; border-radius: 8px; border: 2px solid #7c4dff; object-fit: cover;
  background: #ede7ff; display: block }
.prf-initials { display: flex; align-items: center; justify-content: center; color: #5b34d6; font-weight: 700;
  font-size: 1.6rem; letter-spacing: .02em }
.prf-who { min-width: 0; display: flex; flex-direction: column; gap: 4px }
.prf-name { margin: 0; font-size: 1.75rem; line-height: 1.2; font-weight: 700; color: #0f172b }
.prf-sub { display: flex; flex-wrap: wrap; gap: 4px 14px; color: #62748e; font-size: .9375rem }
.prf-sub span { display: inline-flex; align-items: center; gap: 5px }
.prf-sub svg { width: 15px; height: 15px; flex: 0 0 15px }
.prf-job { color: #364153; font-weight: 500 }

/* bio */
.prf-bio { margin: 0; white-space: pre-line; color: #364153 }

/* resume */
.prf-roles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 22px }
.prf-role { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "title period" "org org" "desc desc";
  column-gap: 20px; row-gap: 4px }
.prf-role + .prf-role { padding-top: 22px; border-top: 1px solid #f1f2f5 }
.prf-role h3 { grid-area: title; margin: 0; font-size: 1.125rem; font-weight: 600; color: #101828; line-height: 1.4 }
.prf-period { grid-area: period; margin: 0; color: #4a5565; font-size: .875rem; text-align: right; line-height: 1.6; white-space: nowrap }
.prf-org { grid-area: org; margin: 0; color: #4a5565 }
.prf-org strong { font-weight: 500 }
.prf-org .prf-muted { font-size: .875rem }
.prf-desc { grid-area: desc; margin: 10px 0 0; color: #364153; font-size: .875rem; white-space: pre-line }

/* projects */
.prf-projects { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px }
.prf-project a { display: grid; grid-template-columns: 66px minmax(0, 1fr); gap: 14px; align-items: center; height: 100%;
  border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; color: inherit }
.prf-project a:hover { text-decoration: none; border-color: #c9b8ff }
.prf-project a:hover .prf-ptitle { text-decoration: underline }
.prf-thumb { width: 66px; height: 66px; border-radius: 8px; background: #e5e7eb; overflow: hidden; display: flex;
  align-items: center; justify-content: center; color: #62748e; font-size: .75rem; font-weight: 600; text-transform: uppercase }
.prf-thumb img { width: 100%; height: 100%; object-fit: cover; display: block }
.prf-pbody { min-width: 0; display: flex; flex-direction: column; gap: 2px }
.prf-ptitle { margin: 0; font-size: 1.0625rem; font-weight: 600; color: #101828; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.prf-porg { margin: 0; font-size: .875rem; color: #364153; font-weight: 500 }
.prf-pcat { margin: 4px 0 0; font-size: .75rem; font-weight: 600 }
.prf-pcat-project { color: #ad46ff }
.prf-pcat-community { color: #a65f00 }
.prf-pcat-unknown { color: #314158 }

/* friends */
.prf-friends { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px }
.prf-friend a { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; color: #101828; min-width: 0 }
.prf-friend a:hover { background: #f3f0ff; text-decoration: none }
.prf-friend .prf-photo { width: 36px; height: 36px; flex-basis: 36px; border-width: 1px; border-radius: 50%; font-size: .8125rem }
.prf-friend span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500 }

/* social */
.prf-social { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px }
.prf-social a { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 6px; color: #101828; font-weight: 500 }
.prf-social a:hover { background: #f3f0ff; text-decoration: none }
.prf-sicon { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: .9375rem; overflow: hidden }
.prf-sicon img { width: 100%; height: 100%; object-fit: contain; background: #fff }

/* skills */
.prf-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px }
.prf-chips li { padding: 8px 10px; border-radius: 5px; background: #f3f4f6; color: #0f172b; font-size: .875rem; font-weight: 500; line-height: 1.2 }

/* languages */
.prf-langs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 15px }
.prf-langs li { color: #101828; font-weight: 500 }
.prf-langs .prf-muted { font-weight: 400; font-size: .875rem; margin-left: 8px }

/* contact */
.prf-contacts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px }
.prf-contacts li { display: flex; align-items: flex-start; gap: 12px; min-width: 0 }
.prf-cicon { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 8px; background: #f3f0ff; color: #7c4dff;
  display: flex; align-items: center; justify-content: center }
.prf-cicon svg { width: 18px; height: 18px }
.prf-cbody { min-width: 0; display: flex; flex-direction: column; padding-top: 6px; line-height: 1.4 }
.prf-cbody a, .prf-cbody > span:first-child { color: #101828; font-weight: 500 }
.prf-muted { color: #62748e; font-size: .8125rem }

/* phones and narrow panes */
@container prf (max-width: 860px) {
  .prf-grid { display: flex; flex-direction: column; gap: 15px }
  .prf-main, .prf-side { display: contents }
  .prf-card { padding: 15px; width: 100% }
  .prf-head { order: 0 } .prf-s-bio { order: 1 } .prf-s-skills { order: 2 } .prf-s-languages { order: 3 }
  .prf-s-resume { order: 4 } .prf-s-projects { order: 5 } .prf-s-friends { order: 6 } .prf-s-social { order: 7 } .prf-s-contact { order: 8 }
  .prf-sechead { margin: 0 }
  .prf-sechead h2 { font-size: 1.0625rem }
  .prf-section[data-open="true"] .prf-sechead { margin-bottom: 14px }
  .prf-toggle { display: inline-flex }
  .prf-section[data-open="false"] .prf-body { display: none }
  .prf-head { gap: 14px; padding: 12px 15px }
  .prf-photo { width: 56px; height: 56px; flex-basis: 56px }
  .prf-name { font-size: 1.375rem }
  .prf-role { grid-template-columns: minmax(0, 1fr); grid-template-areas: "title" "org" "period" "desc" }
  .prf-period { text-align: left; white-space: normal }
  .prf-projects, .prf-friends { grid-template-columns: minmax(0, 1fr) }
}
`

// ---------- small RDF helpers ----------

function makeReader (store) {
  const sym = uri => store.sym(uri)
  const P = (prefix, local) => prefix === 'schema'
    ? [sym(NS.schema + local), sym(NS.schemas + local)]
    : [sym(NS[prefix] + local)]
  const preds = (...pairs) => pairs.flatMap(([p, l]) => P(p, l))
  const keyOf = n => n ? n.termType + ':' + (n.value !== undefined ? n.value : '') : ''

  function objs (s, predicates) {
    if (!s || s.termType === 'Literal') return []
    const seen = new Set()
    const out = []
    for (const p of predicates) {
      for (const o of store.each(s, p, undefined, undefined)) {
        const k = o.termType === 'Collection' ? 'C:' + out.length : keyOf(o)
        if (seen.has(k)) continue
        seen.add(k)
        out.push(o)
      }
    }
    return out
  }
  const first = (s, predicates) => objs(s, predicates)[0] || null

  // Expand an RDF list, whether rdflib made it a Collection (.elements) or it is an rdf:first/rdf:rest chain.
  // Anything that is not a list comes back as itself. Cycles and repeated heads are tolerated.
  const FIRST = sym(NS.rdf + 'first')
  const REST = sym(NS.rdf + 'rest')
  const NIL = NS.rdf + 'nil'
  function expand (node, visited = new Set()) {
    if (!node) return []
    if (Array.isArray(node.elements)) return node.elements.flatMap(e => expand(e, visited))
    if (node.termType === 'Literal') return [node]
    if (node.termType === 'NamedNode' && node.value === NIL) return []
    if (!store.any(node, FIRST, undefined, undefined)) return [node]
    const items = []
    let cur = node
    while (cur && !(cur.termType === 'NamedNode' && cur.value === NIL)) {
      const k = keyOf(cur)
      if (visited.has(k)) break
      visited.add(k)
      const v = store.any(cur, FIRST, undefined, undefined)
      if (v) items.push(...expand(v, visited))
      cur = store.any(cur, REST, undefined, undefined)
    }
    return items
  }
  function items (s, predicates) {
    const seen = new Set()
    return objs(s, predicates).flatMap(o => expand(o)).filter(n => {
      const k = keyOf(n)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  // A literal value, preferring English, then untagged, then anything.
  function text (s, predicates) {
    if (!s || s.termType === 'Literal') return ''
    const lits = []
    for (const p of predicates) {
      for (const st of store.statementsMatching(s, p, undefined, undefined)) {
        if (st.object.termType === 'Literal' && st.object.value.trim()) lits.push(st.object)
      }
    }
    if (!lits.length) return ''
    const lang = l => (l.language || l.lang || '').toLowerCase()
    const pick = lits.find(l => lang(l).startsWith('en')) || lits.find(l => !lang(l)) || lits[0]
    return pick.value.trim()
  }
  const types = n => (n && n.termType !== 'Literal') ? store.each(n, sym(NS.rdf + 'type'), undefined, undefined).map(t => t.value) : []

  return { sym, P, preds, objs, first, expand, items, text, types, keyOf }
}

const localName = uri => {
  const m = String(uri || '').match(/[#/]([^#/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : String(uri || '')
}

function shortUrl (uri) {
  try {
    const u = new URL(uri)
    const path = u.pathname.replace(/\/profile\/card(\.\w+)?$/, '').replace(/\/$/, '')
    return u.host + (path && path !== '/' ? path : '')
  } catch (e) { return String(uri || '') }
}

function safeHref (value) {
  const v = String(value || '').trim()
  return /^(https?:|mailto:|tel:)/i.test(v) ? v : ''
}
function safeImage (value) {
  const v = String(value || '').trim()
  return /^(https?:|data:image\/)/i.test(v) ? v : ''
}

function initialsOf (name) {
  const words = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return ((words[0][0] || '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

let displayNames = null
function languageFromCode (code) {
  const c = String(code || '').trim()
  if (!c) return ''
  try {
    if (!displayNames && typeof Intl !== 'undefined' && Intl.DisplayNames) {
      displayNames = new Intl.DisplayNames(['en'], { type: 'language' })
    }
    const name = displayNames && displayNames.of(c.toLowerCase())
    if (name && name.toLowerCase() !== c.toLowerCase()) return name
  } catch (e) { /* not a code */ }
  return c
}

function monthYear (lit) {
  if (!lit || !lit.value) return ''
  const v = lit.value.trim()
  const m = v.match(/^(\d{4})(?:-(\d{2}))?/)
  if (!m) return v
  if (!m[2]) return m[1]
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, 1))
  return d.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ---------- reading the profile ----------

function isProfileUrl (uri) {
  return /\/profile\/card(\.(ttl|jsonld|json|n3|rdf))?(#.*)?$/i.test(uri) ||
    /\/card(\.(ttl|jsonld))?#(me|i|this)$/i.test(uri)
}

function isPersonTyped (store, node) {
  try {
    const t = store.findTypeURIs(node)
    return !!(t[NS.foaf + 'Person'] || t[NS.schema + 'Person'] || t[NS.schemas + 'Person'] || t[NS.vcard + 'Individual'])
  } catch (e) { return false }
}

// The subject itself, or, when the store says nothing about it, the one person described in its document
// (a profile served at one URL whose #me is written with another base).
function resolvePerson (store, R, subject) {
  if (store.statementsMatching(subject, undefined, undefined, undefined).length) return subject
  const doc = subject.doc()
  const classes = [NS.foaf + 'Person', NS.schema + 'Person', NS.schemas + 'Person', NS.vcard + 'Individual']
  for (const c of classes) {
    const found = store.each(undefined, R.sym(NS.rdf + 'type'), R.sym(c), doc)
    if (found.length) return found[0]
  }
  return subject
}

function nameOf (R, node) {
  if (!node) return ''
  if (node.termType === 'Literal') return node.value
  return R.text(node, R.preds(['foaf', 'name'], ['vcard', 'fn'], ['schema', 'name'], ['rdfs', 'label'])) ||
    R.text(node, R.preds(['foaf', 'nick'], ['vcard', 'nickname']))
}

function imageOf (R, node) {
  const list = R.objs(node, R.preds(['foaf', 'img'], ['vcard', 'hasPhoto'], ['foaf', 'depiction'], ['schema', 'image'],
    ['sioc', 'avatar'], ['vcard', 'photo'], ['vcard', 'logo']))
  for (const o of list) {
    let v = o.value
    if (o.termType === 'BlankNode') {
      const inner = R.first(o, R.preds(['schema', 'contentUrl'], ['schema', 'url'], ['vcard', 'value']))
      v = inner && inner.value
    }
    const src = safeImage(v)
    if (src) return src
  }
  return ''
}

function readRoles (store, R, person) {
  const memberships = store.each(undefined, R.sym(NS.org + 'member'), person, undefined)
  const seen = new Map()
  for (const m of memberships) {
    const types = R.types(m)
    if (types.some(t => /EducationalOccupationalCredential$/.test(t))) continue
    const roleType = (types.filter(t => t.startsWith(NS.solid)).map(localName)
      .find(l => /^(Past|Current|Future)Role$/.test(l))) || ''
    const start = R.first(m, R.P('schema', 'startDate'))
    const end = R.first(m, R.P('schema', 'endDate'))
    const org = R.first(m, R.P('org', 'organization'))
    let orgName = ''
    let orgHome = ''
    let orgLocation = ''
    if (org) {
      const publicId = R.first(org, R.P('solid', 'publicId'))
      orgName = (publicId && R.text(publicId, R.P('schema', 'name'))) || nameOf(R, org)
      const home = R.first(org, R.preds(['schema', 'uri'], ['schema', 'url'], ['foaf', 'homepage']))
      orgHome = safeHref(home && home.value)
      const loc = R.first(org, R.P('org', 'location'))
      orgLocation = loc ? (loc.termType === 'Literal' ? loc.value : (nameOf(R, loc) || localName(loc.value))) : ''
    }
    const roleNode = R.first(m, R.P('org', 'role'))
    const roleName = roleNode ? (roleNode.termType === 'Literal' ? roleNode.value : R.text(roleNode, R.preds(['schema', 'name'], ['rdfs', 'label']))) : ''
    const roleText = R.text(m, R.P('vcard', 'role'))
    const title = roleText && roleName ? roleName + ' - ' + roleText : (roleText || roleName)
    const role = {
      title, roleType, start, end, orgName, orgHome, orgLocation,
      description: R.text(m, R.P('schema', 'description')),
      named: m.termType === 'NamedNode'
    }
    if (!role.title && !role.orgName) continue
    const key = [title, orgName, start ? start.value : '', end ? end.value : ''].join('|')
    const prev = seen.get(key)
    if (!prev || (!prev.named && role.named)) seen.set(key, role)
  }
  const isCurrent = r => !r.end && r.roleType !== 'FutureRole'
  return [...seen.values()].sort((x, y) => {
    if (isCurrent(x) !== isCurrent(y)) return isCurrent(x) ? -1 : 1
    const xe = x.end ? x.end.value : ''
    const ye = y.end ? y.end.value : ''
    if (xe !== ye) return ye.localeCompare(xe)
    return (y.start ? y.start.value : '').localeCompare(x.start ? x.start.value : '')
  })
}

function projectNodeFor (R, node) {
  if (!node) return null
  if (node.termType === 'NamedNode') return node
  if (node.termType === 'Literal') return /^https?:/i.test(node.value) ? R.sym(node.value) : null
  const linked = R.first(node, R.preds(['solid', 'publicId'], ['schema', 'url'], ['foaf', 'homepage'], ['rdfs', 'seeAlso'],
    ['schema', 'sameAs'], ['schema', 'mainEntityOfPage']))
  if (!linked) return null
  if (linked.termType === 'NamedNode') return linked
  return /^https?:/i.test(linked.value) ? R.sym(linked.value) : null
}

function readProjects (R, person) {
  const seen = new Set()
  const out = []
  for (const c of R.items(person, R.P('solid', 'community'))) {
    const node = projectNodeFor(R, c)
    const url = node ? node.value : ''
    if (!safeHref(url) || seen.has(url)) continue
    seen.add(url)
    const sources = [node, c].filter(n => n && n.termType !== 'Literal')
    const pick = fn => sources.map(fn).find(Boolean) || ''
    const types = sources.flatMap(n => R.types(n))
    const category = types.some(t => /schema\.org\/Project$/.test(t)) ? 'project'
      : types.some(t => /schema\.org\/Community$/.test(t)) ? 'community' : 'unknown'
    // a project described inside the profile itself links out to its own page when it names one
    const page = node.doc().value === person.doc().value
      ? R.first(node, R.preds(['schema', 'url'], ['foaf', 'homepage'], ['schema', 'sameAs'])) : null
    out.push({
      url: safeHref(page && page.value) || url,
      title: pick(n => nameOf(R, n)) || shortUrl(url),
      orgName: pick(n => R.text(n, R.preds(['vcard', 'organization-name'], ['schema', 'parentOrganization']))),
      image: pick(n => imageOf(R, n)),
      category
    })
  }
  return out
}

function readSkills (R, person) {
  const seen = new Set()
  const out = []
  for (const sk of R.items(person, R.P('schema', 'skills'))) {
    let name = ''
    if (sk.termType === 'Literal') name = sk.value
    else {
      name = R.text(sk, R.preds(['schema', 'name'], ['rdfs', 'label']))
      if (!name) {
        const pid = R.first(sk, R.P('solid', 'publicId'))
        if (pid) name = pid.termType === 'Literal' ? pid.value : (R.text(pid, R.preds(['schema', 'name'], ['rdfs', 'label'], ['skos', 'prefLabel'])) || (pid.termType === 'NamedNode' ? localName(pid.value) : ''))
      }
    }
    name = (name || '').replace(/\s+/g, ' ').trim()
    const k = name.toLowerCase()
    if (!name || seen.has(k)) continue
    seen.add(k)
    out.push(name)
  }
  return out
}

function readLanguages (R, person) {
  const looksLikeCode = v => /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(v)
  const fromIana = v => v.startsWith(IANA_LANGUAGE) ? v.slice(IANA_LANGUAGE.length).replace(/[#/].*$/, '') : ''
  const named = node => R.text(node, R.preds(['schema', 'name'], ['rdfs', 'label']))
  const seen = new Set()
  const out = []
  for (const lan of R.items(person, R.P('schema', 'knowsLanguage'))) {
    let name = ''
    let code = ''
    if (lan.termType === 'Literal') {
      if (looksLikeCode(lan.value)) code = lan.value
      else name = lan.value
    } else {
      const pid = R.first(lan, R.P('solid', 'publicId'))
      if (pid && pid.termType === 'Literal') code = pid.value
      else if (pid) { name = named(pid); code = fromIana(pid.value) }
      if (!name) name = named(lan)
      if (!code && lan.termType === 'NamedNode') code = fromIana(lan.value)
      if (!name && code) name = named(R.sym(IANA_LANGUAGE + code.toLowerCase()))
    }
    if (!name && code) name = languageFromCode(code)
    name = (name || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    const codeKey = code ? 'code:' + code.toLowerCase() : ''
    if (seen.has(key) || (codeKey && seen.has(codeKey))) continue
    seen.add(key)
    if (codeKey) seen.add(codeKey)
    const level = lan.termType === 'Literal' ? '' : R.text(lan, R.P('schema', 'proficiencyLevel'))
    out.push({ name, level })
  }
  return out
}

function readSocial (R, person) {
  const seen = new Set()
  const out = []
  for (const ac of R.items(person, R.P('foaf', 'account'))) {
    if (ac.termType === 'Literal') {
      const href = safeHref(ac.value)
      if (href && !seen.has(href)) { seen.add(href); out.push({ name: shortUrl(href), href, icon: '', color: '#62748e' }) }
      continue
    }
    const classes = R.types(ac)
    const known = classes.map(c => NETWORKS[localName(c)]).find(Boolean)
    const otherClass = classes.find(c => !/OtherAccount$/.test(c) && /Account$/.test(c))
    let name = R.text(ac, R.preds(['foaf', 'name'], ['rdfs', 'label'])) || (known && known[0]) ||
      (otherClass ? localName(otherClass).replace(/Account$/, '') : '')
    const accountName = R.text(ac, R.P('foaf', 'accountName'))
    const homepage = R.first(ac, R.P('foaf', 'homepage'))
    let href = safeHref(homepage && homepage.value)
    if (!href && /^https?:\/\//i.test(accountName)) href = accountName
    if (!href && accountName && known && known[1]) href = known[1] + accountName.replace(/^@/, '')
    if (!href && ac.termType === 'NamedNode' && /^https?:/i.test(ac.value) && !ac.value.startsWith(person.doc().value)) href = ac.value
    href = safeHref(href)
    if (!href) continue
    if (!name) name = shortUrl(href)
    const k = href.replace(/\/$/, '').toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    const iconNode = R.first(ac, R.P('foaf', 'icon'))
    out.push({ name, href, handle: accountName && !/^https?:/i.test(accountName) ? accountName : '', icon: safeImage(iconNode && iconNode.value), color: known ? known[2] : '#7c4dff' })
  }
  return out
}

function readContacts (R, person) {
  const typeLabel = node => {
    const t = R.types(node).map(localName).find(l => /^(Home|Work|Cell|Mobile|Fax|Pref|Personal|Other)$/i.test(l))
    return t || ''
  }
  const point = (predicates, scheme, test) => {
    const seen = new Set()
    const out = []
    for (const n of R.objs(person, predicates)) {
      let value = ''
      if (test(n.value)) value = n.value
      else if (n.termType !== 'Literal') {
        const v = R.objs(n, R.P('vcard', 'value')).find(o => test(o.value))
        value = v ? v.value : ''
      }
      if (!value) continue
      const plain = value.replace(new RegExp('^' + scheme, 'i'), '')
      if (seen.has(plain.toLowerCase())) continue
      seen.add(plain.toLowerCase())
      out.push({ plain, href: scheme + plain.replace(/\s+/g, ''), type: n.termType === 'Literal' ? '' : typeLabel(n) })
    }
    return out
  }
  const isEmail = v => /^mailto:/i.test(v) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  const isPhone = v => /^tel:/i.test(v) || /^[+()\-\s\d.]{5,}$/.test(v)
  const emails = point(R.preds(['vcard', 'hasEmail'], ['foaf', 'mbox'], ['schema', 'email']), 'mailto:', isEmail)
  const phones = point(R.preds(['vcard', 'hasTelephone'], ['foaf', 'phone'], ['schema', 'telephone']), 'tel:', isPhone)
  const addresses = R.objs(person, R.P('vcard', 'hasAddress')).filter(a => a.termType !== 'Literal').map(a => {
    const t = p => R.text(a, R.P('vcard', p))
    const locality = [t('locality'), t('region')].filter(Boolean).join(', ')
    const lines = [t('street-address'), [locality, t('postal-code')].filter(Boolean).join(' '), t('country-name')].filter(Boolean)
    return { lines, type: typeLabel(a), locality: t('locality'), country: t('country-name') }
  }).filter(a => a.lines.length)
  const linkSeen = new Set()
  const links = R.objs(person, R.preds(['foaf', 'homepage'], ['foaf', 'weblog'], ['schema', 'url']))
    .map(n => safeHref(n.value)).filter(h => h && /^https?:/i.test(h))
    .filter(h => { const k = h.replace(/\/$/, ''); if (linkSeen.has(k)) return false; linkSeen.add(k); return true })
  return { emails, phones, addresses, links }
}

function readFriends (store, R, person) {
  const out = []
  const seen = new Set()
  for (const f of R.objs(person, R.preds(['foaf', 'knows'], ['schema', 'knows']))) {
    if (f.termType !== 'NamedNode' || !/^https?:/i.test(f.value) || seen.has(f.value)) continue
    seen.add(f.value)
    out.push({ node: f, name: nameOf(R, f) || shortUrl(f.value), image: imageOf(R, f) })
  }
  return out
}

function readProfile (store, subject) {
  const R = makeReader(store)
  const person = resolvePerson(store, R, subject)
  const nick = R.text(person, R.preds(['vcard', 'nickname'], ['foaf', 'nick']))
  let host = ''
  try { host = new URL(person.value).host } catch (e) { host = person.value }
  const name = R.text(person, R.preds(['foaf', 'name'], ['vcard', 'fn'], ['schema', 'name'])) || nick || host
  let pronouns = R.text(person, R.P('solid', 'preferredSubjectPronoun'))
  const them = R.text(person, R.P('solid', 'preferredObjectPronoun'))
  if (pronouns && them) pronouns += '/' + them
  const roles = readRoles(store, R, person)
  const headingRole = roles.find(r => !r.end && r.roleType !== 'FutureRole' && r.roleType !== 'PastRole') ||
    roles.find(r => r.roleType !== 'FutureRole')
  const contacts = readContacts(R, person)
  const addr = contacts.addresses[0]
  return {
    person,
    name,
    nick: nick && nick !== name ? nick : '',
    pronouns,
    image: imageOf(R, person),
    jobTitle: (headingRole && headingRole.title) || R.text(person, R.preds(['vcard', 'title'], ['schema', 'jobTitle'])),
    location: addr ? [addr.locality, addr.country].filter(Boolean).join(', ') : '',
    bio: R.text(person, R.preds(['vcard', 'note'], ['schema', 'description'])),
    roles,
    projects: readProjects(R, person),
    skills: readSkills(R, person),
    languages: readLanguages(R, person),
    social: readSocial(R, person),
    contacts,
    friends: readFriends(store, R, person)
  }
}

// ---------- drawing ----------

const SVG_NS = 'http://www.w3.org/2000/svg'
const PATHS = {
  mail: ['M3 5h18v14H3z', 'M3 6l9 7 9-7'],
  phone: ['M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z'],
  pin: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  work: ['M3 7h18v13H3z', 'M8 7V4h8v3'],
  chevron: ['M6 9l6 6 6-6']
}

function drawProfile (dom, root, p, context) {
  const el = (tag, cls, text) => {
    const e = dom.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined && text !== null) e.textContent = text
    return e
  }
  const icon = name => {
    const svg = dom.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true')
    for (const d of PATHS[name]) {
      const path = dom.createElementNS(SVG_NS, 'path')
      path.setAttribute('d', d)
      svg.appendChild(path)
    }
    return svg
  }
  const link = (href, text, cls) => {
    const a = el('a', cls, text)
    a.href = href
    if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer' } else a.rel = 'noopener'
    return a
  }
  const avatar = (src, name, cls) => {
    if (src) {
      const img = el('img', cls || 'prf-photo')
      img.loading = 'lazy'
      img.decoding = 'async'
      img.alt = 'Photo of ' + name
      img.src = src
      img.addEventListener('error', () => img.replaceWith(avatar('', name, cls)), { once: true })
      return img
    }
    const d = el('div', (cls || 'prf-photo') + ' prf-initials', initialsOf(name))
    d.setAttribute('role', 'img')
    d.setAttribute('aria-label', name)
    return d
  }
  let sectionCount = 0
  const section = (key, title) => {
    const id = 'prf-h-' + key + '-' + (++sectionCount) + '-' + Math.random().toString(36).slice(2, 7)
    const s = el('section', 'prf-card prf-section prf-s-' + key)
    s.dataset.open = 'true'
    s.setAttribute('aria-labelledby', id)
    const head = el('header', 'prf-sechead')
    const h = el('h2', '', title)
    h.id = id
    const toggle = el('button', 'prf-toggle')
    toggle.type = 'button'
    toggle.setAttribute('aria-label', 'Show or hide ' + title)
    toggle.setAttribute('aria-expanded', 'true')
    toggle.appendChild(icon('chevron'))
    toggle.addEventListener('click', () => {
      const open = s.dataset.open !== 'true'
      s.dataset.open = String(open)
      toggle.setAttribute('aria-expanded', String(open))
    })
    head.append(h, toggle)
    const body = el('div', 'prf-body')
    s.append(head, body)
    return { s, body }
  }

  const grid = el('div', 'prf-grid')

  // header
  const head = el('header', 'prf-card prf-head')
  head.appendChild(avatar(p.image, p.name))
  const who = el('div', 'prf-who')
  who.appendChild(el('h1', 'prf-name', p.name))
  const sub = el('div', 'prf-sub')
  if (p.nick) sub.appendChild(el('span', '', p.nick))
  if (p.pronouns) sub.appendChild(el('span', '', p.pronouns))
  if (p.jobTitle) { const s = el('span', 'prf-job'); s.append(icon('work'), dom.createTextNode(p.jobTitle)); sub.appendChild(s) }
  if (p.location) { const s = el('span'); s.append(icon('pin'), dom.createTextNode(p.location)); sub.appendChild(s) }
  if (sub.childNodes.length) who.appendChild(sub)
  head.appendChild(who)
  grid.appendChild(head)

  const main = el('div', 'prf-main')
  const side = el('aside', 'prf-side')
  side.setAttribute('aria-label', 'Profile details')

  if (p.bio) {
    const { s, body } = section('bio', 'Bio')
    body.appendChild(el('p', 'prf-bio', p.bio))
    main.appendChild(s)
  }

  if (p.roles.length) {
    const { s, body } = section('resume', 'Resume')
    const ul = el('ul', 'prf-roles')
    for (const r of p.roles) {
      const li = el('li', 'prf-role')
      li.appendChild(el('h3', '', r.title || r.orgName))
      const period = el('p', 'prf-period')
      const from = monthYear(r.start)
      const to = r.end ? monthYear(r.end) : (r.roleType === 'FutureRole' ? '' : 'Present')
      period.textContent = r.roleType === 'FutureRole' && !r.end ? (from ? 'From ' + from : 'Upcoming') : [from, to].filter(Boolean).join(' to ')
      if (period.textContent) li.appendChild(period)
      if (r.orgName || r.orgLocation) {
        const org = el('p', 'prf-org')
        if (r.orgName) {
          const strong = el('strong')
          if (r.orgHome) strong.appendChild(link(r.orgHome, r.orgName))
          else strong.textContent = r.orgName
          org.appendChild(strong)
        }
        if (r.orgLocation) org.appendChild(el('span', 'prf-muted', (r.orgName ? '  |  ' : '') + r.orgLocation))
        li.appendChild(org)
      }
      if (r.description) li.appendChild(el('p', 'prf-desc', r.description))
      ul.appendChild(li)
    }
    body.appendChild(ul)
    main.appendChild(s)
  }

  if (p.projects.length) {
    const { s, body } = section('projects', 'Projects & Communities')
    const ul = el('ul', 'prf-projects')
    for (const pr of p.projects) {
      const li = el('li', 'prf-project')
      const a = link(pr.url, undefined)
      a.setAttribute('aria-label', 'Open ' + pr.title)
      const thumb = el('div', 'prf-thumb')
      if (pr.image) {
        const img = el('img')
        img.loading = 'lazy'
        img.alt = ''
        img.src = pr.image
        img.addEventListener('error', () => { img.remove(); thumb.textContent = initialsOf(pr.title) }, { once: true })
        thumb.appendChild(img)
      } else thumb.textContent = initialsOf(pr.title)
      const b = el('div', 'prf-pbody')
      b.appendChild(el('h3', 'prf-ptitle', pr.title))
      if (pr.orgName) b.appendChild(el('p', 'prf-porg', pr.orgName))
      if (pr.category !== 'unknown') b.appendChild(el('p', 'prf-pcat prf-pcat-' + pr.category, pr.category === 'project' ? 'Project' : 'Community'))
      a.append(thumb, b)
      li.appendChild(a)
      ul.appendChild(li)
    }
    body.appendChild(ul)
    main.appendChild(s)
  }

  if (p.friends.length) {
    const { s, body } = section('friends', 'Friends')
    const ul = el('ul', 'prf-friends')
    for (const f of p.friends) {
      const li = el('li', 'prf-friend')
      const a = el('a')
      a.href = f.node.value
      a.title = f.node.value
      a.addEventListener('click', ev => {
        try {
          const outliner = context && context.getOutliner && context.getOutliner(dom)
          if (outliner && outliner.GotoSubject && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) {
            ev.preventDefault()
            outliner.GotoSubject(f.node, true, undefined, true, undefined)
          }
        } catch (e) { /* follow the link */ }
      })
      a.append(avatar(f.image, f.name, 'prf-photo'), el('span', '', f.name))
      li.appendChild(a)
      ul.appendChild(li)
    }
    body.appendChild(ul)
    main.appendChild(s)
  }

  if (p.social.length) {
    const { s, body } = section('social', 'Follow me on')
    const ul = el('ul', 'prf-social')
    for (const ac of p.social) {
      const li = el('li')
      const a = link(ac.href)
      a.setAttribute('aria-label', 'Visit ' + ac.name + ' profile (opens in new tab)')
      const ic = el('span', 'prf-sicon')
      if (ac.icon) {
        const img = el('img')
        img.loading = 'lazy'
        img.alt = ''
        img.src = ac.icon
        ic.style.background = '#fff'
        img.addEventListener('error', () => { img.remove(); ic.style.background = ac.color; ic.textContent = initialsOf(ac.name).slice(0, 1) }, { once: true })
        ic.appendChild(img)
      } else {
        ic.style.background = ac.color
        ic.textContent = initialsOf(ac.name).slice(0, 1)
      }
      const text = el('span', 'prf-cbody')
      text.style.paddingTop = '0'
      text.appendChild(el('span', '', ac.name))
      if (ac.handle) text.appendChild(el('span', 'prf-muted', ac.handle))
      a.append(ic, text)
      li.appendChild(a)
      ul.appendChild(li)
    }
    body.appendChild(ul)
    side.appendChild(s)
  }

  if (p.skills.length) {
    const { s, body } = section('skills', 'Skills')
    const ul = el('ul', 'prf-chips')
    for (const sk of p.skills) ul.appendChild(el('li', '', sk))
    body.appendChild(ul)
    side.appendChild(s)
  }

  if (p.languages.length) {
    const { s, body } = section('languages', 'Languages')
    const ul = el('ul', 'prf-langs')
    for (const l of p.languages) {
      const li = el('li', '', l.name)
      if (l.level) li.appendChild(el('span', 'prf-muted', localName(l.level)))
      ul.appendChild(li)
    }
    body.appendChild(ul)
    side.appendChild(s)
  }

  const c = p.contacts
  if (c.emails.length || c.phones.length || c.addresses.length || c.links.length) {
    const { s, body } = section('contact', 'Contact')
    const ul = el('ul', 'prf-contacts')
    const row = (iconName, content, type) => {
      const li = el('li')
      const ic = el('span', 'prf-cicon')
      ic.appendChild(icon(iconName))
      const b = el('div', 'prf-cbody')
      b.appendChild(content)
      if (type) b.appendChild(el('span', 'prf-muted', type))
      li.append(ic, b)
      ul.appendChild(li)
    }
    for (const ph of c.phones) row('phone', link(ph.href, ph.plain), ph.type)
    for (const em of c.emails) row('mail', link(em.href, em.plain), em.type)
    for (const ad of c.addresses) {
      const span = el('span')
      ad.lines.forEach((line, i) => { if (i) span.appendChild(el('br')); span.appendChild(dom.createTextNode(line)) })
      row('pin', span, ad.type)
    }
    for (const href of c.links) row('link', link(href, shortUrl(href)))
    body.appendChild(ul)
    side.appendChild(s)
  }

  if (main.childNodes.length) grid.appendChild(main)
  if (side.childNodes.length) grid.appendChild(side)
  if (!main.childNodes.length && side.childNodes.length) {
    // nothing for the main column: let the sidebar sections take the full width
    grid.style.gridTemplateColumns = 'minmax(0, 1fr)'
  }
  root.appendChild(grid)
}

// ---------- the pane ----------

const pane = {
  name: 'profile-view',
  icon: ICON,

  label (subject, context) {
    if (!subject || !subject.uri) return null
    const store = context && context.session && context.session.store
    if (store) pane._lastStore = store // shouldGetFocus gets no context; label always runs first
    if (store && isPersonTyped(store, subject)) return 'Profile'
    return isProfileUrl(subject.uri) ? 'Profile' : null
  },

  shouldGetFocus (subject) {
    return !!(subject && subject.uri && (isProfileUrl(subject.uri) || pane._lastStore && isPersonTyped(pane._lastStore, subject)))
  },

  render (subject, context) {
    const dom = context.dom
    const store = context.session.store
    pane._lastStore = store
    const root = dom.createElement('div')
    root.className = 'prf prf-root'
    const style = dom.createElement('style')
    style.textContent = CSS
    root.appendChild(style)
    const status = dom.createElement('div')
    status.className = 'prf-status'
    status.textContent = 'Loading profile…'
    root.appendChild(status)

    const fetcher = store.fetcher
    const withTimeout = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(resolve, ms))])
    const load = docs => !fetcher ? Promise.resolve()
      : withTimeout(Promise.allSettled(docs.map(d => fetcher.load(d))), 8000)

    const draw = () => {
      while (root.lastChild && root.lastChild !== style) root.removeChild(root.lastChild)
      try {
        drawProfile(dom, root, readProfile(store, subject), context)
      } catch (err) {
        const e = dom.createElement('div')
        e.className = 'prf-status'
        e.textContent = 'Could not show this profile: ' + (err && err.message ? err.message : err)
        root.appendChild(e)
        console.error('profile-view', err)
      }
    }

    ;(async () => {
      await load([subject.doc()])
      const R = makeReader(store)
      const person = resolvePerson(store, R, subject)
      // rdfs:seeAlso documents extend the profile, as upstream does
      const seeAlso = store.each(person, R.sym(NS.rdfs + 'seeAlso'), undefined, person.doc())
        .filter(n => n.termType === 'NamedNode' && /^https?:/i.test(n.value)).map(n => n.doc())
      if (seeAlso.length) await load(seeAlso)
      draw()
      // project and community documents give names and pictures; draw again once they arrive
      const docs = new Map()
      for (const c of R.items(person, R.P('solid', 'community'))) {
        const node = projectNodeFor(R, c)
        if (node && /^https?:/i.test(node.value)) docs.set(node.doc().value, node.doc())
      }
      docs.delete(person.doc().value)
      if (docs.size) { await load([...docs.values()]); draw() }
    })()

    return root
  }
}

export default pane

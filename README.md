# profile

A dynamic SolidOS pane that shows a person's profile (WebID): photo, name, bio, CV, projects, skills, languages, contacts and friends.

Read-only. Loads at runtime by link, with no build or release.

**Try it:** [open a sample profile](https://solidos.org/docs/browser/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fprofile%2Fprofile-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fprofile%2Fsamples%2Falice.ttl%23me)

The data browser asks before it adds a pane from a site it has not seen. Allow it, and the profile opens.

## What it shows

- Header: photo (or initials), name, nickname, pronouns, current job title, location
- Bio (`vcard:note`)
- Resume: roles from `org:member` memberships, newest first
- Projects & Communities (`solid:community`)
- Friends (`foaf:knows`), opened in place
- Follow me on (`foaf:account`)
- Skills (`schema:skills`) and Languages (`schema:knowsLanguage`)
- Contact: phones, emails, addresses, home page and blog

Two columns on wide screens, one column with collapsible sections on phones.

## Fixes

- Languages are read whether they are an RDF list, several lists, or plain values, and duplicates are dropped (see SolidOS/profile-pane#260). Social accounts and communities are read the same way.
- A section with no data is hidden, so visitors don't see "No skills added yet."
- Name falls back from `foaf:name` to `vcard:fn`, `schema:name`, the nickname, then the host name.
- Photo is read from `foaf:img`, `vcard:hasPhoto`, `foaf:depiction`, `schema:image`, `sioc:avatar` or `vcard:photo`, loads lazily with alt text, and falls back to initials.
- Every URL is a real link with `rel="noopener"`. Only http(s), mailto and tel links are made.
- When a profile document describes its person under a different base URL, that person is shown.

## Load it

```js
panes.register((await import('https://solid-panes.github.io/profile/profile-pane.js')).default)
```

or `jss start ... --panes https://solid-panes.github.io/profile/profile-pane.js`.

`samples/alice.ttl` is a fictional profile that exercises every section.

Based on the SolidOS [profile-pane](https://github.com/SolidOS/profile-pane) (MIT), rewritten as a single-file dynamic pane.

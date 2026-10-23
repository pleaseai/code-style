# Passion Factory Code Style Rules — HTML/CSS

HTML and CSS rules for `@pleaseai/code-style`, condensed from the Google
HTML/CSS Style Guide. The guide names no formatter or linter, so match the
project's existing configuration. Read it together with `general.md` in this
directory.

## General

- Load embedded resources over HTTPS.
- Indent 2 spaces, never tabs. Remove trailing whitespace.
- Write everything in lowercase: element names, attributes, selectors,
  properties.
- Use UTF-8 without a BOM, and declare `<meta charset="utf-8">`.

## HTML

- Start documents with `<!doctype html>` and write valid HTML.
- Use elements for what they mean (`<p>` for paragraphs, never for spacing).
- Give images `alt` text, and give audio and video transcripts or captions.
- Keep structure (HTML), presentation (CSS), and behavior (JavaScript) in
  separate files linked from the page.
- Omit `type` on `<link rel="stylesheet">` and classic JavaScript `<script>`
  elements. Preserve script types such as `module`, `importmap`, and
  `application/ld+json`.
- Put every block, list, and table element on its own line and indent its
  children.
- Use double quotes for attribute values.

## CSS

- Write valid CSS.
- Name classes with meaningful, generic words separated by hyphens
  (`.video-player`, `.site-navigation`), not by appearance or abbreviation
  (`.red-text`, `.vid`).
- Style with class selectors, not IDs.
- Use shorthand properties (`padding`, `font`) where possible.
- Omit units on `0` (`margin: 0;`), keep the leading zero on decimals
  (`0.8em`), and use 3-character hex colors where possible (`#fff`).
- Avoid `!important`.

## CSS Formatting

- Alphabetize declarations within a rule.
- End every declaration with a semicolon, put a space after the colon, and a
  space before the opening brace (`.foo {`).
- Put each selector and each declaration on its own line, and separate rules
  with a blank line.
- Use single quotes in attribute selectors and property values
  (`[type='text']`).

## Sources

- [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)
- [Conductor HTML/CSS summary](https://github.com/gemini-cli-extensions/conductor/blob/main/skills/conductor-setup/assets/code_styleguides/html-css.md)

See `NOTICE.md` for licenses.

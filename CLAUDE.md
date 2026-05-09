# duo plans — Claude notes

## Before editing any config, HTML, or static asset file

Expo Router generates its own HTML shell and may override standard web files at build time. Before making a change, verify which file actually takes effect in production — do not assume the obvious file is the right one.

**Process:** grep or read to find where the value is currently set, confirm it's not shadowed by a framework-generated file, then make the edit. The extra research is cheaper than a deploy round-trip.

Known example: `<head>` content belongs in `app/+html.tsx`, not `public/index.html`.

/**
 * MDX globals registry — components available inside MDX without `import`.
 * Wired via `<Content components={components} />` in `[...slug].astro`.
 * Add new components here as you build (or install) them.
 */

import Hero from './components/landing/Hero.astro'
import Section from './components/landing/Section.astro'
import Render from './components/Render.astro'
import { Aside } from './components/ui/aside'
import { Card } from './components/ui/card'
import { CardGrid } from './components/ui/card-grid'
import { CodeGroup } from './components/ui/code-group'
import { LinkButton } from './components/ui/link-button'
import { PackageManagers } from './components/ui/package-managers'
import { Step, Steps } from './components/ui/steps'
import { TabItem, Tabs } from './components/ui/tabs'

export const components = {
  Aside,
  Card,
  CardGrid,
  CodeGroup,
  Hero,
  LinkButton,
  PackageManagers,
  Render,
  Section,
  Step,
  Steps,
  TabItem,
  Tabs,
}

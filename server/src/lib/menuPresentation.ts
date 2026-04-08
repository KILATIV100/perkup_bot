const CATEGORY_LABELS: Record<string, string> = {
  coffee: 'Кава',
  cold: 'Холодні напої',
  food: 'Їжа',
  sweets: 'Десерти',
  addons: 'Добавки',
  beans: 'Зерно',
  merch: 'Мерч',
  other: 'Інше',
}

type MenuProductLike = {
  id?: number
  name: string
  description?: string | null
  price: number | string | { toString(): string }
  category: string
  categoryOrder?: number | null
  sortOrder?: number | null
  isAvailable?: boolean
  tags?: string[] | null
  volume?: string | null
  calories?: number | null
}

type MenuBundleLike = {
  name: string
  description?: string | null
  price: number | string | { toString(): string }
  originalPrice?: number | string | { toString(): string }
  items?: Array<{ quantity: number; product?: { name: string | null } | null }>
}

export type StoredMenuCategory = {
  name: string
  sortOrder: number
}

function toNumber(value: number | string | { toString(): string } | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  if (value && typeof value.toString === 'function') return Number(value.toString())
  return 0
}

function formatPrice(value: number | string | { toString(): string }): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(toNumber(value)) + ' грн'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function splitText(text: string, maxLength: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (!current) {
      current = word
      continue
    }
    if ((current + ' ' + word).length <= maxLength) {
      current += ' ' + word
      continue
    }
    lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines
}

function getMenuTheme(locationSlug: string) {
  switch (locationSlug) {
    case 'mark-mall':
      return {
        accent: '#A64B2A',
        accentSoft: '#F8E2D6',
        accentStrong: '#5C2210',
        ink: '#2B1912',
        paper: '#FFF9F3',
        title: 'Self-service menu',
      }
    case 'krona':
      return {
        accent: '#186A53',
        accentSoft: '#DBF1E6',
        accentStrong: '#0E3E31',
        ink: '#13201C',
        paper: '#F7FCF9',
        title: 'To-go menu',
      }
    default:
      return {
        accent: '#8C5E2A',
        accentSoft: '#F5E7D4',
        accentStrong: '#4D3113',
        ink: '#24190E',
        paper: '#FFFAF4',
        title: 'Family cafe menu',
      }
  }
}

export function buildAdminCategories(products: MenuProductLike[]) {
  const sorted = sortMenuProducts(products)
  const categoryMap = new Map<string, { name: string; sortOrder: number; count: number }>()

  for (const product of sorted) {
    const existing = categoryMap.get(product.category)
    if (!existing) {
      categoryMap.set(product.category, {
        name: product.category,
        sortOrder: product.categoryOrder ?? 0,
        count: 1,
      })
      continue
    }

    existing.count += 1
    existing.sortOrder = Math.min(existing.sortOrder, product.categoryOrder ?? 0)
  }

  return Array.from(categoryMap.values()).sort((left, right) => {
    return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'uk')
  })
}

export function parseStoredCategories(value: unknown): StoredMenuCategory[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const maybeName = (item as { name?: unknown }).name
      const maybeSortOrder = (item as { sortOrder?: unknown }).sortOrder
      if (typeof maybeName !== 'string' || !maybeName.trim()) return null
      const sortOrder = typeof maybeSortOrder === 'number' && Number.isFinite(maybeSortOrder) ? maybeSortOrder : 0
      return { name: maybeName.trim(), sortOrder }
    })
    .filter((item): item is StoredMenuCategory => Boolean(item))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'uk'))
}

export function mergeStoredCategories(value: unknown, products: MenuProductLike[]) {
  const stored = parseStoredCategories(value)
  const productCategories = buildAdminCategories(products)
  const merged = new Map<string, { name: string; sortOrder: number; count: number }>()

  for (const category of stored) {
    merged.set(category.name, { name: category.name, sortOrder: category.sortOrder, count: 0 })
  }

  for (const category of productCategories) {
    const existing = merged.get(category.name)
    if (existing) {
      existing.count = category.count
      if (existing.sortOrder === 0 && category.sortOrder !== 0) {
        existing.sortOrder = category.sortOrder
      }
      continue
    }

    merged.set(category.name, {
      name: category.name,
      sortOrder: category.sortOrder,
      count: category.count,
    })
  }

  return Array.from(merged.values()).sort((left, right) => {
    return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'uk')
  })
}

export function sortMenuProducts(products: MenuProductLike[]) {
  return [...products].sort((left, right) => {
    return (left.categoryOrder ?? 0) - (right.categoryOrder ?? 0)
      || left.category.localeCompare(right.category, 'uk')
      || (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
      || left.name.localeCompare(right.name, 'uk')
  })
}

export function groupProductsByCategory(products: MenuProductLike[]) {
  const groups = new Map<string, { category: string; label: string; sortOrder: number; products: MenuProductLike[] }>()

  for (const product of sortMenuProducts(products)) {
    if (!groups.has(product.category)) {
      groups.set(product.category, {
        category: product.category,
        label: CATEGORY_LABELS[product.category] || product.category,
        sortOrder: product.categoryOrder ?? 0,
        products: [],
      })
    }
    groups.get(product.category)!.products.push(product)
  }

  return Array.from(groups.values()).sort((left, right) => {
    return left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'uk')
  })
}

export function getCategoryOrder(products: MenuProductLike[], category: string): number {
  const match = products.find((product) => product.category === category)
  if (match) return match.categoryOrder ?? 0
  const summary = buildAdminCategories(products)
  const existing = summary.find((item) => item.name === category)
  return existing?.sortOrder ?? getNextCategoryOrder(products)
}

export function getNextCategoryOrder(products: MenuProductLike[]): number {
  const categories = buildAdminCategories(products)
  const last = categories[categories.length - 1]
  return (last?.sortOrder ?? 0) + 100
}

export function getNextProductSortOrder(products: MenuProductLike[], category: string): number {
  const sameCategory = products.filter((product) => product.category === category)
  const maxSortOrder = sameCategory.reduce((max, product) => Math.max(max, product.sortOrder ?? 0), 0)
  return maxSortOrder + 1
}

function buildSvgTextLines(lines: string[], x: number, startY: number, lineHeight: number, fill: string, size: number, weight = 500) {
  return lines.map((line, index) => {
    return `<text x="${x}" y="${startY + index * lineHeight}" fill="${fill}" font-size="${size}" font-family="'Manrope', 'Segoe UI', sans-serif" font-weight="${weight}">${escapeHtml(line)}</text>`
  }).join('')
}

async function getQrInnerMarkup(targetUrl: string): Promise<string> {
  const requestUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&format=svg&margin=0&data=${encodeURIComponent(targetUrl)}`
  const response = await fetch(requestUrl)
  if (!response.ok) throw new Error('QR service unavailable')

  const raw = await response.text()
  const inner = raw.replace(/^<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')
  return inner || '<rect width="512" height="512" fill="#FFFFFF" />'
}

function buildFallbackQrMarkup(targetUrl: string) {
  const lines = splitText(targetUrl, 24)
  return `
    <rect x="0" y="0" width="512" height="512" rx="28" fill="#FFFFFF" />
    <rect x="24" y="24" width="464" height="464" rx="24" fill="#F3F4F6" stroke="#D1D5DB" stroke-width="8" stroke-dasharray="18 12" />
    <text x="256" y="170" text-anchor="middle" fill="#111827" font-size="30" font-family="'Manrope', 'Segoe UI', sans-serif" font-weight="700">QR fallback</text>
    ${buildSvgTextLines(lines, 72, 230, 32, '#374151', 20)}
  `
}

export async function buildMenuQrSvg(input: { locationName: string; locationSlug: string; subtitle?: string; targetUrl: string }) {
  const theme = getMenuTheme(input.locationSlug)
  let innerMarkup = ''

  try {
    innerMarkup = await getQrInnerMarkup(input.targetUrl)
  } catch {
    innerMarkup = buildFallbackQrMarkup(input.targetUrl)
  }

  const subtitleLines = splitText(input.subtitle || input.targetUrl, 34).slice(0, 3)

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1280" viewBox="0 0 960 1280" role="img" aria-labelledby="title desc">
  <title id="title">QR menu for ${escapeHtml(input.locationName)}</title>
  <desc id="desc">Scan to open the digital menu for ${escapeHtml(input.locationName)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${theme.paper}" />
      <stop offset="100%" stop-color="#FFFFFF" />
    </linearGradient>
  </defs>
  <rect width="960" height="1280" rx="56" fill="url(#bg)" />
  <rect x="48" y="48" width="864" height="1184" rx="42" fill="#FFFFFF" stroke="${theme.accentSoft}" stroke-width="12" />
  <rect x="92" y="92" width="776" height="220" rx="32" fill="${theme.accentStrong}" />
  <text x="128" y="158" fill="#FFFFFF" font-size="34" font-family="'Manrope', 'Segoe UI', sans-serif" font-weight="700">PerkUp</text>
  <text x="128" y="214" fill="#FFFFFF" font-size="72" font-family="'Fraunces', Georgia, serif" font-weight="700">${escapeHtml(input.locationName)}</text>
  <text x="128" y="262" fill="${theme.accentSoft}" font-size="28" font-family="'Manrope', 'Segoe UI', sans-serif">${escapeHtml(theme.title)}</text>
  <rect x="142" y="366" width="676" height="676" rx="42" fill="${theme.accentSoft}" />
  <rect x="192" y="416" width="576" height="576" rx="36" fill="#FFFFFF" />
  <g transform="translate(224 448)">${innerMarkup}</g>
  <text x="480" y="1118" text-anchor="middle" fill="${theme.ink}" font-size="34" font-family="'Manrope', 'Segoe UI', sans-serif" font-weight="800">Скануй, щоб відкрити меню</text>
  ${buildSvgTextLines(subtitleLines, 160, 1168, 34, '#4B5563', 24, 500)}
  <text x="480" y="1230" text-anchor="middle" fill="#6B7280" font-size="20" font-family="'Manrope', 'Segoe UI', sans-serif">${escapeHtml(input.targetUrl)}</text>
</svg>`.trim()
}

function renderBundleList(bundles: MenuBundleLike[]) {
  if (bundles.length === 0) return ''

  return `
    <section class="bundle-section section-card">
      <div class="section-kicker">Комбо</div>
      <h2>Готові сети</h2>
      <div class="bundle-grid">
        ${bundles.map((bundle) => {
          const items = (bundle.items || [])
            .map((item) => `${item.product?.name || 'Позиція'} x${item.quantity}`)
            .join(' · ')

          return `
            <article class="bundle-card">
              <div class="bundle-header">
                <div>
                  <h3>${escapeHtml(bundle.name)}</h3>
                  ${bundle.description ? `<p>${escapeHtml(bundle.description)}</p>` : ''}
                </div>
                <strong>${formatPrice(bundle.price)}</strong>
              </div>
              ${items ? `<div class="bundle-items">${escapeHtml(items)}</div>` : ''}
            </article>
          `
        }).join('')}
      </div>
    </section>
  `
}

export async function buildPrintableMenuHtml(input: {
  baseUrl: string
  location: { slug: string; name: string; address: string; allowOrders: boolean }
  profile: { format?: string; posSystem?: string; paymentFlow?: string }
  products: MenuProductLike[]
  bundles: MenuBundleLike[]
}) {
  const theme = getMenuTheme(input.location.slug)
  const menuUrl = `${input.baseUrl.replace(/\/$/, '')}/api/menu/${encodeURIComponent(input.location.slug)}/print`
  const qrSvg = await buildMenuQrSvg({
    locationName: input.location.name,
    locationSlug: input.location.slug,
    subtitle: input.location.address,
    targetUrl: menuUrl,
  })

  const grouped = groupProductsByCategory(input.products.filter((product) => product.isAvailable !== false))

  return `
<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.location.name)} | PerkUp Menu</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {
        --paper: ${theme.paper};
        --ink: ${theme.ink};
        --accent: ${theme.accent};
        --accent-soft: ${theme.accentSoft};
        --accent-strong: ${theme.accentStrong};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: 'Manrope', 'Segoe UI', sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.95), transparent 34%),
          linear-gradient(135deg, var(--paper), #ffffff 62%);
      }
      .page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px;
      }
      .hero {
        display: grid;
        grid-template-columns: 1.45fr 0.95fr;
        gap: 24px;
        margin-bottom: 28px;
      }
      .hero-card,
      .qr-card,
      .section-card {
        background: rgba(255,255,255,0.92);
        border: 1px solid rgba(0,0,0,0.06);
        border-radius: 28px;
        box-shadow: 0 18px 40px rgba(25, 20, 15, 0.08);
        overflow: hidden;
      }
      .hero-card {
        padding: 28px;
        background:
          radial-gradient(circle at 90% 0%, var(--accent-soft), transparent 40%),
          linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92));
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      h1 {
        margin: 18px 0 10px;
        font-family: 'Fraunces', Georgia, serif;
        font-size: clamp(42px, 6vw, 72px);
        line-height: 0.96;
      }
      .subtitle {
        max-width: 46rem;
        color: #5B524B;
        font-size: 16px;
        line-height: 1.7;
      }
      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }
      .meta-pill {
        padding: 10px 14px;
        border-radius: 999px;
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.08);
        font-size: 13px;
        font-weight: 700;
      }
      .note {
        margin-top: 18px;
        padding: 14px 16px;
        border-radius: 18px;
        background: color-mix(in srgb, var(--accent-soft) 56%, #ffffff 44%);
        color: var(--accent-strong);
        font-size: 14px;
        line-height: 1.6;
      }
      .qr-card {
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .qr-card svg {
        width: 100%;
        height: auto;
        display: block;
      }
      .qr-caption {
        padding: 4px 8px 0;
        font-size: 13px;
        color: #6B7280;
        text-align: center;
      }
      .action-row {
        display: flex;
        gap: 12px;
        margin: 0 0 22px;
      }
      .action-row button,
      .action-row a {
        border: 0;
        border-radius: 999px;
        padding: 12px 16px;
        background: var(--accent-strong);
        color: #ffffff;
        font: inherit;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }
      .catalog {
        columns: 2 340px;
        column-gap: 20px;
      }
      .section-card {
        break-inside: avoid;
        padding: 22px;
        margin-bottom: 20px;
      }
      .section-kicker {
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .section-card h2 {
        margin: 10px 0 16px;
        font-family: 'Fraunces', Georgia, serif;
        font-size: 30px;
      }
      .menu-item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px dashed rgba(0,0,0,0.08);
      }
      .menu-item:first-of-type { border-top: 0; padding-top: 0; }
      .menu-item h3 {
        margin: 0 0 4px;
        font-size: 16px;
      }
      .menu-item p {
        margin: 0;
        color: #6B7280;
        font-size: 13px;
        line-height: 1.6;
      }
      .menu-item-meta {
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .menu-item-meta span {
        padding: 4px 8px;
        border-radius: 999px;
        background: #F3F4F6;
        font-size: 11px;
        color: #4B5563;
      }
      .price {
        font-size: 18px;
        font-weight: 800;
        color: var(--accent-strong);
        white-space: nowrap;
      }
      .bundle-grid {
        display: grid;
        gap: 12px;
      }
      .bundle-card {
        padding: 16px;
        border-radius: 18px;
        background: #FBFBFB;
        border: 1px solid rgba(0,0,0,0.06);
      }
      .bundle-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .bundle-header h3 {
        margin: 0 0 6px;
        font-size: 18px;
      }
      .bundle-header p,
      .bundle-items {
        margin: 0;
        color: #6B7280;
        font-size: 13px;
        line-height: 1.6;
      }
      .footer {
        margin-top: 24px;
        color: #6B7280;
        font-size: 12px;
      }
      @media (max-width: 920px) {
        .page { padding: 20px; }
        .hero { grid-template-columns: 1fr; }
        .catalog { columns: 1; }
      }
      @media print {
        body { background: #ffffff; }
        .page { max-width: none; padding: 0; }
        .action-row { display: none !important; }
        .hero-card, .qr-card, .section-card {
          box-shadow: none;
          border-color: rgba(0,0,0,0.12);
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="action-row no-print">
        <button type="button" onclick="window.print()">Друкувати меню</button>
        <a href="${escapeHtml(menuUrl)}" target="_blank" rel="noreferrer">Відкрити окрему сторінку</a>
      </div>

      <section class="hero">
        <article class="hero-card">
          <div class="eyebrow">PerkUp • ${escapeHtml(theme.title)}</div>
          <h1>${escapeHtml(input.location.name)}</h1>
          <p class="subtitle">${escapeHtml(input.location.address)}</p>
          <div class="meta-row">
            ${input.profile.format ? `<div class="meta-pill">${escapeHtml(input.profile.format)}</div>` : ''}
            ${input.profile.posSystem ? `<div class="meta-pill">${escapeHtml(input.profile.posSystem)}</div>` : ''}
            <div class="meta-pill">${input.location.allowOrders ? 'Передзамовлення доступні' : 'Замовлення тільки на місці'}</div>
          </div>
          <div class="note">
            ${input.location.allowOrders
              ? 'Передзамовлення надсилається в систему локації автоматично, а оплата проходить у бариста на касі.'
              : 'Це меню для перегляду в точці самообслуговування. Оформлення і оплата відбуваються на місці.'}
          </div>
        </article>

        <aside class="qr-card">
          ${qrSvg}
          <div class="qr-caption">Скануй QR, щоб відкрити цифрове меню цієї локації</div>
        </aside>
      </section>

      <div class="catalog">
        ${grouped.map((group) => {
          return `
            <section class="section-card">
              <div class="section-kicker">Категорія</div>
              <h2>${escapeHtml(group.label)}</h2>
              ${group.products.map((product) => {
                const meta: string[] = []
                if (product.volume) meta.push(`<span>${escapeHtml(product.volume)}</span>`)
                if (product.calories) meta.push(`<span>${escapeHtml(String(product.calories))} kcal</span>`)
                return `
                  <article class="menu-item">
                    <div>
                      <h3>${escapeHtml(product.name)}</h3>
                      ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ''}
                      ${meta.length ? `<div class="menu-item-meta">${meta.join('')}</div>` : ''}
                    </div>
                    <div class="price">${formatPrice(product.price)}</div>
                  </article>
                `
              }).join('')}
            </section>
          `
        }).join('')}

        ${renderBundleList(input.bundles)}
      </div>

      <div class="footer">Оновлено автоматично для локації ${escapeHtml(input.location.name)}.</div>
    </div>
  </body>
</html>`.trim()
}

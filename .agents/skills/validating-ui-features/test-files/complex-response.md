# Expected Complex Markdown Output

This file shows expected rendering for various markdown elements.

---

## Table Example

The following table should render with visible borders, bold headers, and proper alignment:

| Framework | Language | Stars | Initial Release | Virtual DOM |
|-----------|----------|------:|-----------------|:-----------:|
| React | JavaScript/TypeScript | 220k+ | 2013 | Yes |
| Vue | JavaScript/TypeScript | 205k+ | 2014 | Yes |
| Angular | TypeScript | 95k+ | 2016 | No (Incremental DOM) |
| Svelte | JavaScript/TypeScript | 75k+ | 2016 | No (Compiler) |

### Table Verification
- [ ] Headers bold
- [ ] Borders visible
- [ ] Right-aligned "Stars" column
- [ ] Center-aligned "Virtual DOM" column
- [ ] Left-aligned other columns

---

## List Examples

### Unordered List (Bullets)

- First top-level item
- Second top-level item
  - Nested item A
  - Nested item B
    - Deeply nested item
    - Another deeply nested
  - Nested item C
- Third top-level item

### Ordered List (Numbers)

1. First step: Install dependencies
2. Second step: Configure environment
   - Create `.env` file
   - Add required variables
3. Third step: Run the application
4. Fourth step: Verify functionality

### Mixed Lists

1. Prerequisites
   - Node.js 18+
   - npm or yarn
   - Git
2. Installation
   - Clone the repository
   - Install dependencies
3. Configuration
   - Copy `.env.example` to `.env`
   - Update values

### List Verification
- [ ] Bullets for unordered lists
- [ ] Numbers for ordered lists
- [ ] Proper indentation for nesting
- [ ] Consistent spacing

---

## Text Formatting

This paragraph contains **bold text**, *italic text*, and ***bold italic text***.

Here is some `inline code` that should have a background.

Here is ~~strikethrough text~~ that should have a line through it.

### Formatting Verification
- [ ] Bold text heavier weight
- [ ] Italic text slanted
- [ ] Inline code has background highlight
- [ ] Strikethrough has line

---

## Blockquotes

> This is a simple blockquote that should render with a left border and slight indentation.

> **💡 Tip:** You can use blockquotes for tips, warnings, or important notes.
> They can span multiple lines and contain **formatting**.

> ⚠️ **Warning:** This is a warning blockquote.
> 
> It contains multiple paragraphs and should maintain the left border throughout.

### Blockquote Verification
- [ ] Left border visible
- [ ] Text indented from border
- [ ] Formatting works inside quotes
- [ ] Multi-paragraph quotes connected

---

## Links

External links should open in a new tab:
- [Microsoft Learn](https://learn.microsoft.com)
- [Azure Portal](https://portal.azure.com)
- [GitHub](https://github.com)

### Link Verification
- [ ] Links styled (underline or color)
- [ ] Hover state visible
- [ ] Opens in new tab (`target="_blank"`)

---

## Headings

The page should have a clear heading hierarchy:

# Heading 1 (Largest)
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6 (Smallest)

### Heading Verification
- [ ] Size decreases from H1 to H6
- [ ] Proper spacing above/below
- [ ] Bold weight on all headings

---

## Combined Example

Here's what a real documentation response might look like:

### Quick Start Guide

> **Prerequisites:** Make sure you have Node.js 18+ installed.

1. **Clone the repository**
   ```bash
   git clone https://github.com/example/repo.git
   cd repo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Copy the example file: `cp .env.example .env`
   - Edit `.env` with your values

4. **Start the application**
   ```bash
   npm run dev
   ```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run test suite |

> **Note:** For production deployment, see the [deployment guide](https://docs.example.com/deploy).

---

## Full Verification Checklist

```
□ Tables
  □ Visible borders/structure
  □ Bold headers
  □ Column alignment

□ Lists
  □ Bullets render
  □ Numbers render
  □ Nesting indented

□ Formatting
  □ Bold works
  □ Italic works
  □ Inline code styled

□ Blockquotes
  □ Left border
  □ Indentation
  □ Multi-line works

□ Links
  □ Styled
  □ New tab

□ Headings
  □ Size hierarchy
  □ Proper spacing
```

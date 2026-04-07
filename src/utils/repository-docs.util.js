import fs from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const ALLOWED_GROUPS = [
	{
		key: 'src',
		label: 'Servercode',
		rootPath: path.join(REPO_ROOT, 'src'),
		type: 'source',
		allowedExtensions: new Set(['.js'])
	},
	{
		key: 'public-js',
		label: 'Clientscripts',
		rootPath: path.join(REPO_ROOT, 'public', 'js'),
		type: 'client',
		allowedExtensions: new Set(['.js'])
	},
	{
		key: 'public-css',
		label: 'Stijlen',
		rootPath: path.join(REPO_ROOT, 'public', 'css'),
		type: 'style',
		allowedExtensions: new Set(['.css'])
	}
]

const IGNORED_DIRECTORIES = new Set([
	'.git',
	'.vscode',
	'coverage',
	'dist',
	'docs',
	'memories',
	'node_modules'
])

const IGNORED_FILES = new Set(['.DS_Store'])

const toPosix = (value) => value.split(path.sep).join('/')

const escapeHtml = (value) => {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

const decodeHtmlEntities = (value) => {
	return String(value)
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&')
}

const normalizeRelativePath = (value) =>
	toPosix(String(value || '').replace(/^[/\\]+/, '')).toLowerCase()

const slugify = (value) =>
	String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')

const countLines = (content) => {
	if (!content) return 0
	return content.split(/\r?\n/).length
}

const formatBytes = (size) => {
	if (size < 1024) return `${size} B`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
	return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const getLineNumberAtIndex = (content, index) => {
	if (!content || index <= 0) return 1
	return content.slice(0, index).split(/\r?\n/).length
}

const normalizeDocBlock = (rawBlock, extension) => {
	if (!rawBlock) return ''

	return rawBlock
		.replace(/^\/\*\*?\s*/, '')
		.replace(/\s*\*\/$/, '')
		.split(/\r?\n/)
		.map((line) => line.replace(/^\s*\* ?/, '').trimEnd())
		.join('\n')
		.trim()
}

const deriveDocTitle = (content, sectionIndex, lineNumber) => {
	if (!content) return `Documentatie ${sectionIndex}`

	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	const taggedLine = lines.find((line) => /^@(brief|summary)\b/i.test(line))
	if (taggedLine) {
		return taggedLine.replace(/^@(brief|summary)\s*/i, '').trim()
	}

	const firstMeaningful = lines.find((line) => !line.startsWith('@'))
	if (firstMeaningful) {
		return firstMeaningful.length > 96
			? `${firstMeaningful.slice(0, 93)}...`
			: firstMeaningful
	}

	return `Documentatie ${sectionIndex} (regel ${lineNumber})`
}

const stripTagLines = (content) => {
	if (!content) return ''

	const filteredLines = content
		.split(/\r?\n/)
		.filter((line) => !/^\s*@\w+/i.test(line.trim()))
		.map((line) => line.replace(/\s+$/g, ''))

	const cleaned = filteredLines
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
	return cleaned
}

const humanizeTag = (tag) => {
	const normalized = String(tag || '').toLowerCase()
	if (normalized === 'param') return 'Parameter'
	if (normalized === 'returns' || normalized === 'return')
		return 'Retourneert'
	if (normalized === 'throws' || normalized === 'throw') return 'Fout'
	if (normalized === 'deprecated') return 'Verouderd'
	if (normalized === 'example') return 'Voorbeeld'
	if (normalized === 'since') return 'Sinds'
	if (normalized === 'author') return 'Auteur'
	if (normalized === 'brief') return 'Samenvatting'
	if (normalized === 'details' || normalized === 'description')
		return 'Beschrijving'
	return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const summarizeTagLines = (content) => {
	if (!content) return ''

	const stripLeadingTypeExpression = (value) => {
		const text = String(value || '').trim()
		if (!text.startsWith('{')) {
			return { type: '', rest: text }
		}

		let depth = 0
		let endIndex = -1

		for (let index = 0; index < text.length; index += 1) {
			const char = text[index]
			if (char === '{') depth += 1
			if (char === '}') {
				depth -= 1
				if (depth === 0) {
					endIndex = index
					break
				}
			}
		}

		if (endIndex === -1) {
			return { type: '', rest: text }
		}

		return {
			type: text.slice(1, endIndex).trim(),
			rest: text.slice(endIndex + 1).trim()
		}
	}

	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^@\w+/i.test(line))

	if (!lines.length) return ''

	const summaries = []
	const params = []
	const examples = []
	const extra = []
	let returnsLine = ''
	let throwsLine = ''

	for (const line of lines) {
		const tagMatch = line.match(/^@(\w+)\s*(.*)$/)
		if (!tagMatch) continue

		const [, rawTag, restRaw] = tagMatch
		const tag = rawTag.toLowerCase()
		const rest = restRaw.trim()

		if (tag === 'param') {
			const { type, rest: withoutType } = stripLeadingTypeExpression(rest)
			const paramMatch = withoutType.match(/^([^\s]+)\s*(.*)$/)

			if (paramMatch) {
				const [, rawName, description] = paramMatch
				const cleanName = rawName.replace(/^\[|\]$/g, '')
				const suffix = type ? ` (${type})` : ''
				params.push(
					description
						? `- \`${cleanName}\`${suffix}: ${description}`
						: `- \`${cleanName}\`${suffix}`
				)
			} else if (withoutType || type) {
				const fallbackLabel = withoutType || 'parameter'
				params.push(
					type
						? `- \`${fallbackLabel}\` (${type})`
						: `- ${fallbackLabel}`
				)
			}
			continue
		}

		if (tag === 'returns' || tag === 'return') {
			const { type, rest: withoutType } = stripLeadingTypeExpression(rest)
			returnsLine = withoutType
				? type
					? `${withoutType} (${type})`
					: withoutType
				: type
			continue
		}

		if (tag === 'throws' || tag === 'throw') {
			const { type, rest: withoutType } = stripLeadingTypeExpression(rest)
			throwsLine = withoutType
				? type
					? `${withoutType} (${type})`
					: withoutType
				: type
			continue
		}

		if (tag === 'example') {
			if (rest) examples.push(rest)
			continue
		}

		if (tag === 'brief' || tag === 'summary' || tag === 'description') {
			if (rest) summaries.push(rest)
			continue
		}

		const label = humanizeTag(tag)
		extra.push(rest ? `- **${label}:** ${rest}` : `- **${label}**`)
	}

	const output = []

	if (summaries.length) {
		output.push(summaries.join('\n\n'))
	}

	if (params.length) {
		output.push('### Parameters')
		output.push(params.join('\n'))
	}

	if (returnsLine) {
		output.push('### Retourneert')
		output.push(returnsLine)
	}

	if (throwsLine) {
		output.push('### Fouten')
		output.push(throwsLine)
	}

	if (extra.length) {
		output.push('### Extra')
		output.push(extra.join('\n'))
	}

	if (examples.length) {
		output.push('### Voorbeeld')
		output.push('```js')
		output.push(examples.join('\n'))
		output.push('```')
	}

	return output.join('\n\n').trim()
}

const extractDocumentationSections = (filePath, content) => {
	const extension = path.extname(filePath).toLowerCase()
	const sections = []

	const matches = content.matchAll(/\/\*\*?[\s\S]*?\*\//g)
	let index = 1
	for (const match of matches) {
		const raw = match[0]
		const startIndex = match.index || 0
		const lineNumber = getLineNumberAtIndex(content, startIndex)
		const rawSectionContent = normalizeDocBlock(raw, extension)
		const sectionContent = stripTagLines(rawSectionContent)

		if (!rawSectionContent) continue

		sections.push({
			id: `doc-${index}`,
			lineNumber,
			title: deriveDocTitle(rawSectionContent, index, lineNumber),
			content:
				sectionContent ||
				summarizeTagLines(rawSectionContent) ||
				'Geen beschrijvende documentatietekst in dit blok.'
		})

		index += 1
	}

	return sections
}

const extractDocumentation = (filePath, content) => {
	const sections = extractDocumentationSections(filePath, content)
	if (!sections.length) return ''
	return sections.map((section) => section.content).join('\n\n-----\n\n')
}

const formatInlineMarkdown = (input) => {
	let output = escapeHtml(input)

	output = output.replace(
		/\[([^\]]+)\]\(((?:https?:\/\/|#)[^)\s]+)\)/g,
		(_match, label, url) =>
			`<a href="${escapeHtml(url)}" class="theme-link" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
	)

	output = output.replace(/`([^`]+)`/g, '<code>$1</code>')
	output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
	output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>')

	return output
}

export const renderDocumentationMarkdown = (input) => {
	const raw = decodeHtmlEntities(String(input || ''))
	const lines = raw.split(/\r?\n/)
	const htmlParts = []

	let inCodeFence = false
	let codeLines = []
	let currentListType = null

	const closeList = () => {
		if (!currentListType) return
		htmlParts.push(`</${currentListType}>`)
		currentListType = null
	}

	for (const lineRaw of lines) {
		const line = lineRaw.replace(/\t/g, '    ')
		const trimmed = line.trim()

		if (trimmed.startsWith('```')) {
			if (inCodeFence) {
				htmlParts.push(
					`<pre class="theme-code text-xs"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
				)
				codeLines = []
				inCodeFence = false
			} else {
				closeList()
				inCodeFence = true
			}
			continue
		}

		if (inCodeFence) {
			codeLines.push(line)
			continue
		}

		if (!trimmed) {
			closeList()
			continue
		}

		const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/)
		if (headingMatch) {
			closeList()
			const level = headingMatch[1].length + 2
			const clamped = Math.min(level, 6)
			htmlParts.push(
				`<h${clamped}>${formatInlineMarkdown(headingMatch[2])}</h${clamped}>`
			)
			continue
		}

		const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/)
		if (bulletMatch) {
			if (currentListType !== 'ul') {
				closeList()
				htmlParts.push('<ul>')
				currentListType = 'ul'
			}
			htmlParts.push(`<li>${formatInlineMarkdown(bulletMatch[1])}</li>`)
			continue
		}

		const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
		if (orderedMatch) {
			if (currentListType !== 'ol') {
				closeList()
				htmlParts.push('<ol>')
				currentListType = 'ol'
			}
			htmlParts.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`)
			continue
		}

		if (trimmed.startsWith('> ')) {
			closeList()
			htmlParts.push(
				`<blockquote>${formatInlineMarkdown(trimmed.slice(2))}</blockquote>`
			)
			continue
		}

		closeList()
		htmlParts.push(`<p>${formatInlineMarkdown(trimmed)}</p>`)
	}

	if (inCodeFence) {
		htmlParts.push(
			`<pre class="theme-code text-xs"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
		)
	}

	closeList()

	return htmlParts.join('\n')
}

const readDirectoryEntries = async (directoryPath) => {
	const entries = await fs.readdir(directoryPath, { withFileTypes: true })
	return entries
		.filter((entry) => {
			if (entry.isDirectory()) {
				return !IGNORED_DIRECTORIES.has(entry.name)
			}

			return !IGNORED_FILES.has(entry.name)
		})
		.sort((left, right) => {
			if (left.isDirectory() && !right.isDirectory()) return -1
			if (!left.isDirectory() && right.isDirectory()) return 1
			return left.name.localeCompare(right.name, 'en')
		})
}

const scanDirectory = async (
	absoluteDirectoryPath,
	groupRootPath,
	groupKey,
	allowedExtensions,
	depth = 0
) => {
	const entries = await readDirectoryEntries(absoluteDirectoryPath)
	const nodes = []

	for (const entry of entries) {
		const entryPath = path.join(absoluteDirectoryPath, entry.name)
		const relativePath = toPosix(path.relative(groupRootPath, entryPath))

		if (entry.isDirectory()) {
			const children = await scanDirectory(
				entryPath,
				groupRootPath,
				groupKey,
				allowedExtensions,
				depth + 1
			)

			if (children.length > 0) {
				nodes.push({
					type: 'directory',
					name: entry.name,
					relativePath,
					anchorId: `${groupKey}-${slugify(relativePath)}`,
					depth,
					children
				})
			}

			continue
		}

		const extension = path.extname(entry.name).toLowerCase()
		if (allowedExtensions && !allowedExtensions.has(extension)) {
			continue
		}

		const fileContent = await fs.readFile(entryPath, 'utf8')
		const fileStat = await fs.stat(entryPath)
		const documentation = extractDocumentation(entryPath, fileContent)
		const documentationSections = extractDocumentationSections(
			entryPath,
			fileContent
		)

		nodes.push({
			type: 'file',
			name: entry.name,
			relativePath,
			anchorId: `${groupKey}-${slugify(relativePath)}`,
			depth,
			content: fileContent,
			documentation,
			documentationSections,
			lineCount: countLines(fileContent),
			sizeLabel: formatBytes(fileStat.size),
			extension,
			pathLabel: toPosix(
				path.join(path.basename(groupRootPath), relativePath)
			)
		})
	}

	return nodes
}

const flattenFiles = (nodes, collection = []) => {
	for (const node of nodes) {
		if (node.type === 'file') {
			collection.push(node)
			continue
		}

		flattenFiles(node.children || [], collection)
	}

	return collection
}

const countDirectories = (nodes) => {
	let count = 0
	for (const node of nodes) {
		if (node.type === 'directory') {
			count += 1 + countDirectories(node.children || [])
		}
	}
	return count
}

export const buildRepositoryDocumentation = async () => {
	const groups = []
	const allFiles = []
	let totalDirectories = 0
	let totalLines = 0

	for (const group of ALLOWED_GROUPS) {
		try {
			await fs.access(group.rootPath)
		} catch {
			continue
		}

		const tree = await scanDirectory(
			group.rootPath,
			group.rootPath,
			group.key,
			group.allowedExtensions
		)
		const files = flattenFiles(tree)

		for (const file of files) {
			allFiles.push({
				groupKey: group.key,
				groupLabel: group.label,
				groupType: group.type,
				...file,
				source: escapeHtml(file.content),
				documentation: escapeHtml(file.documentation),
				documentationSections: (file.documentationSections || []).map(
					(section) => ({
						...section,
						title: escapeHtml(section.title),
						content: escapeHtml(section.content)
					})
				)
			})
			totalLines += file.lineCount
		}

		const directoryCount = countDirectories(tree)
		totalDirectories += directoryCount

		groups.push({
			key: group.key,
			label: group.label,
			type: group.type,
			rootLabel: path.basename(group.rootPath),
			rootPath: toPosix(path.relative(REPO_ROOT, group.rootPath) || '.'),
			fileCount: files.length,
			directoryCount,
			tree,
			files: files.map((file) => ({
				...file,
				source: escapeHtml(file.content),
				documentation: escapeHtml(file.documentation),
				documentationSections: (file.documentationSections || []).map(
					(section) => ({
						...section,
						title: escapeHtml(section.title),
						content: escapeHtml(section.content)
					})
				)
			}))
		})
	}

	return {
		groups,
		files: allFiles,
		stats: {
			groupCount: groups.length,
			fileCount: allFiles.length,
			directoryCount: totalDirectories,
			lineCount: totalLines
		}
	}
}

export const findDocumentationFile = (
	documentation,
	groupKey,
	relativePath
) => {
	const normalizedGroupKey = String(groupKey || '').trim()
	const normalizedPath = normalizeRelativePath(relativePath)

	if (!normalizedGroupKey || !normalizedPath) {
		return null
	}

	const targetGroup = (documentation?.groups || []).find(
		(group) => group.key === normalizedGroupKey
	)
	if (!targetGroup) {
		return null
	}

	const targetFile = (targetGroup.files || []).find(
		(file) => normalizeRelativePath(file.relativePath) === normalizedPath
	)

	if (!targetFile) {
		return null
	}

	return {
		group: targetGroup,
		file: targetFile
	}
}

export const renderSourceWithLineAnchors = (source) => {
	const rawSource = String(source || '')
	const lines = rawSource.split(/\r?\n/)

	return lines
		.map((line, index) => {
			const lineNumber = index + 1
			const lineId = `L${lineNumber}`
			const safeLine = escapeHtml(line)
			return `<span id="${lineId}" class="docs-source-line"><a class="docs-source-line-number" href="#${lineId}">${lineNumber}</a><span class="docs-source-line-content">${safeLine || ' '}</span></span>`
		})
		.join('\n')
}

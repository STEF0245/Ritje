import fs from 'node:fs/promises'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const ALLOWED_GROUPS = [
	{
		key: 'views',
		label: "Pagina's",
		rootPath: path.join(REPO_ROOT, 'views'),
		type: 'views',
		allowedExtensions: new Set(['.ejs'])
	},
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

const extractDocumentation = (filePath, content) => {
	const extension = path.extname(filePath).toLowerCase()
	const trimmedContent = content.trimStart()

	if (extension === '.ejs') {
		const match = trimmedContent.match(/^(<%#.*?%>\s*)+/s)
		if (!match) return ''

		return match[0]
			.replace(/<%#\s*/g, '')
			.replace(/%>/g, '')
			.trim()
	}

	const blockMatch = trimmedContent.match(/^\/\*[\s\S]*?\*\//)
	if (blockMatch) {
		return blockMatch[0]
			.replace(/^\/\*\*?\s*/, '')
			.replace(/\s*\*\/$/, '')
			.split(/\r?\n/)
			.map((line) => line.replace(/^\s*\* ?/, '').trimEnd())
			.join('\n')
			.trim()
	}

	return ''
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

		nodes.push({
			type: 'file',
			name: entry.name,
			relativePath,
			anchorId: `${groupKey}-${slugify(relativePath)}`,
			depth,
			content: fileContent,
			documentation,
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
				documentation: escapeHtml(file.documentation)
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
				documentation: escapeHtml(file.documentation)
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

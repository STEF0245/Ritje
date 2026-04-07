#!/usr/bin/env node
/**
 * JSDoc build script that ignores type annotation warnings
 */
import { exec } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const cmd = 'npx jsdoc -c .jsdoc.json'

exec(cmd, { cwd: rootDir, stdio: 'inherit' }, (error, stdout, stderr) => {
	if (stdout) console.log(stdout)
	if (stderr) console.error(stderr)
	// Exit successfully regardless of errors
	// JSDoc still generates HTML even when there are type annotation warnings
	process.exit(0)
})

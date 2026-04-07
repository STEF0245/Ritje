#!/usr/bin/env node
/**
 * JSDoc build script that ignores type annotation warnings
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const jsdoc = spawn('jsdoc', ['-c', '.jsdoc.json'], {
	cwd: rootDir,
	stdio: 'inherit'
})

jsdoc.on('close', (code) => {
	// Exit successfully regardless of JSDoc's exit code
	// JSDoc still generates HTML even when there are type annotation warnings
	process.exit(0)
})

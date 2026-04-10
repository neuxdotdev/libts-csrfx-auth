import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import resolvePlugin from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import { visualizer } from 'rollup-plugin-visualizer'
import filesize from 'rollup-plugin-filesize'
import license from 'rollup-plugin-license'
import { nodeExternals } from 'rollup-plugin-node-externals'
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = __dirname
const isProd = process.env.NODE_ENV === 'production'
const analyze = process.env.ANALYZE === 'true'
const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const profiles = {
	default: { compress: true, mangle: true, dropConsole: false, sourcemap: true, passes: 2 },
	performance: { compress: true, mangle: true, dropConsole: true, sourcemap: false, passes: 3 },
	small: {
		compress: true,
		mangle: { toplevel: true },
		dropConsole: true,
		sourcemap: false,
		passes: 4,
	},
	debug: { compress: false, mangle: false, dropConsole: false, sourcemap: true, passes: 1 },
}
const profile = profiles[process.env.PROFILE || 'default'] || profiles.default
const getExternals = (isDts = false) => [
	...Object.keys(pkg.dependencies || {}),
	...Object.keys(pkg.peerDependencies || {}),
	...Object.keys(pkg.optionalDependencies || {}),
	/^node:.*/,
	/^(?!\.{0,2}\/).*$/,
	...(isDts ? [/^@types\/.*/] : []),
]
const getBasePlugins = (outDir) => [
	json({ compact: true }),
	nodeExternals({ deps: true, devDeps: false, peerDeps: true, optDeps: true }),
	resolvePlugin({ preferBuiltins: true, extensions: ['.js', '.ts', '.json', '.mjs', '.cjs'] }),
	commonjs({ include: /node_modules/, transformMixedEsModules: true }),
	typescript({
		tsconfig: resolve(projectRoot, 'tsconfig.json'),
		outDir: resolve(projectRoot, outDir),
		rootDir: resolve(projectRoot, 'lib'),
		declaration: false,
		sourceMap: profile.sourcemap,
	}),
	replace({
		preventAssignment: true,
		values: {
			'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
			'__VERSION__': JSON.stringify(pkg.version),
		},
		include: ['lib/**/*'],
	}),
]
const getTerser = () => [
	terser({
		ecma: 2022,
		module: true,
		compress: {
			drop_console: profile.dropConsole,
			drop_debugger: true,
			dead_code: true,
			passes: profile.passes,
			pure_getters: true,
			keep_fargs: false,
			keep_classnames: /Error$/,
			keep_fnames: /Error$/,
		},
		format: { comments: false },
		sourceMap: profile.sourcemap ? { url: 'inline' } : false,
		mangle: profile.mangle,
	}),
]
const createJsConfig = () => {
	const outDir = resolve(projectRoot, 'build')
	return {
		input: resolve(projectRoot, 'lib/lib.ts'),
		external: getExternals(false),
		plugins: [
			...getBasePlugins('build'),
			...(isProd && profile.compress ? getTerser() : []),
			filesize({ showBeforeSizes: 'gzip' }),
			...(analyze
				? [
						visualizer({
							filename: resolve(outDir, 'stats.html'),
							open: true,
							gzipSize: true,
						}),
					]
				: []),
			...(isProd
				? [license({ thirdParty: { output: resolve(outDir, 'licenses.txt') } })]
				: []),
		],
		output: [
			{
				file: resolve(outDir, 'index.mjs'),
				format: 'esm',
				sourcemap: profile.sourcemap,
				exports: 'named',
				strict: true,
				freeze: false,
				esModule: true,
			},
			{
				file: resolve(outDir, 'index.cjs'),
				format: 'cjs',
				sourcemap: profile.sourcemap,
				exports: 'named',
				strict: true,
				freeze: false,
				esModule: true,
			},
		],
		treeshake: { preset: 'recommended', moduleSideEffects: false },
		onwarn: (w, warn) => {
			if (['CIRCULAR_DEPENDENCY', 'EVAL', 'SOURCEMAP_ERROR'].includes(w.code)) return
			warn(w)
		},
		cache: !isProd,
		perf: isProd,
	}
}
const createDtsConfig = () => {
	const outDir = resolve(projectRoot, 'build')
	return {
		input: resolve(projectRoot, 'lib/lib.ts'),
		external: getExternals(true),
		plugins: [
			dts({
				respectExternal: true,
				compilerOptions: {
					removeComments: false,
					declaration: true,
					declarationMap: true,
				},
			}),
		],
		output: {
			file: resolve(outDir, 'index.d.ts'),
			format: 'es',
			sourcemap: false,
		},
		treeshake: false,
		onwarn: (w, warn) => {
			if (['CIRCULAR_DEPENDENCY', 'MISSING_EXPORT', 'TYPE_CONFLICT'].includes(w.code)) return
			warn(w)
		},
	}
}
export default [createJsConfig(), createDtsConfig()]

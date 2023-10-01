import { l } from './color.ts'

/**
 * Like tree for objects, with controls for depth, max siblings, and string length.
 */
export function debrief<T>(
	obj: unknown,
	{
		depth = 2,
		siblings = 4,
		trim = 15,
		verbose = false,
	}: { depth?: number; siblings?: number; trim?: number; verbose?: boolean } = {},
) {
	const log = verbose ? l : () => {}
	log('\n' + { depth, siblings, trim })
	function parse(o: unknown, d: number): unknown {
		log({ d, depth, o })
		if (d > depth) {
			log('depth exceeded')
			return '...'
		}

		if (o === null) {
			log('null')
			return o
		}

		if (['boolean', 'symbol', 'undefined'].includes(typeof o)) {
			log('boolean, symbol, or undefined:', typeof o, o)
			return o
		}

		if (Array.isArray(o)) {
			log('array')
			log(o.slice(0, siblings))
			return o.slice(0, siblings).map((s) => parse(s, d))
		}

		if (typeof o === 'object') {
			log('object')
			const keyCount = Object.keys(o).length
			log({ keyCount })

			if (keyCount <= siblings) {
				log('keyCount <= siblings')
				log({ keyCount, siblings })
				log(o)
				return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, parse(v, d + 1)]))
			}

			return Object.fromEntries(
				Object.entries(o)
					.slice(0, siblings)
					.concat([['...', `${keyCount - siblings} more`]])
					.map(([k, v]) => [k, parse(v, d + 1)]),
			)
		}

		switch (typeof o) {
			case 'string': {
				log('string', o.slice(0, trim))
				if (o.length < trim + 3) return o
				return o.slice(0, trim) + '...'
			}

			case 'number': {
				log('number', o)
				if (o.toString().length > trim + 3) {
					return +o.toFixed(trim)
				}
				return o
			}

			case 'bigint': {
				log('bigint', o)
				return +o.toString().slice(0, trim)
			}

			case 'function': {
				log('function', o.name)
				return o.name
			}
		}

		log('unknown', typeof o, o)
		return o
	}

	return parse(obj, 0) as T
}

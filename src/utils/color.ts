import c from 'npm:chalk@5'

/** console.log */
export function l(...args: unknown[]) {
	console.log(...args)
}

/** chalk.red */
export function r(...args: unknown[]) {
	return c.red(...args)
}

/** chalk.green */
export function g(...args: unknown[]) {
	return c.green(...args)
}

/** chalk.blue */
export function b(...args: unknown[]) {
	return c.blue(...args)
}

/** chalk.yellow */
export function y(...args: unknown[]) {
	return c.yellow(...args)
}

/** chalk.dim */
export function dim(...args: unknown[]) {
	return c.dim(...args)
}

/** chalk.bold */
export function bd(...args: unknown[]) {
	return c.bold(...args)
}

/** chalk.newline */
export function n() {
	l('\n')
}

/** JSON.Stringify */
export function j(o: unknown) {
	return JSON.stringify(o, null, 2)
}

/** Short timestamp. */
export function timestamp() {
	return new Date()
		.toISOString()
		.replace(/[-:.TZ]/g, '')
		.slice(2, 12)
}

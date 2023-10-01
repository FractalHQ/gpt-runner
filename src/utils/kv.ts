import { l, g, dim } from './color.ts'

/**
 * Builds a map from a kv store with a given prefix.
 * @param prefix The prefix to use.
 * @param kv The kv store to use.
 * @returns A map of the kv store's contents.
 */
export async function mapList<T>(prefix: string, kv: Deno.Kv) {
	const map = new Map<string, T>()

	const records = kv.list({ prefix: [prefix] })
	for await (const res of records) {
		map.set(String(res.key[1]), res.value as T)
	}

	return map
}

/**
 * Iterates over a kv list and deletes all entries.
 * @param key The key to delete.
 * @param kv The kv store to use.
 */
export async function deleteAll(key: string, kv: Deno.Kv) {
	const all = kv.list({ prefix: [key] })
	for await (const { key } of all) {
		await kv.delete(key)
	}
}

/**
 * Pretty prints a list of DenoKv entries based on the given key.
 * @param name The prefix of the list.
 * @param kv The kv store to use.
 */
export async function ls(name: string, kv: Deno.Kv) {
	l(dim('\nListing ' + name + '...'))

	for await (const item of kv.list({ prefix: [name] })) {
		lsEntryLog(item)
	}
}

/**
 * Pretty prints a DenoKv entry.
 * @param res The entry to print.
 * @param verbose If true, prints the versionstamp.
 */
export function lsEntryLog(res: Deno.KvEntryMaybe<unknown>, verbose = false) {
	if (verbose) {
		l(dim(res.versionstamp) + ' ' + g(res.key.join(' -> ')) + ' ', res.value)
	} else {
		l(g(res.key[1]) + ' ', res.value)
	}
}

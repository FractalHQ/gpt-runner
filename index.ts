//· Imports ············································································¬
import type { Completion, Message, Prompt } from './src/types.ts'

import { parse } from 'https://deno.land/std@0.203.0/flags/mod.ts'
import { dryRun, exampleMessages } from './src/utils/gpt.ts'
import { debrief } from './src/utils/debrief.ts'
import { Runner } from './src/Runner.ts'
import { OpenAI } from 'npm:openai@^4.0.0'
const args = parse(Deno.args)
//⌟

//· Settings ···········································································¬

const MAX_PARALLEL_REQUESTS = 5
const DRY_RUN = !!args.dry
const TEST_RUN = !!args.test

const SETTINGS = {
	model: 'gpt-3.5-turbo',
	max_tokens: 750,
	temperature: 0.9,
	n: 1,
} satisfies Omit<OpenAI.Chat.CompletionCreateParamsNonStreaming, 'messages'>

//? Prompts go here.
const messages: Message[][] = [
	// i.e.  [ { role: "user", content: "hello world" } ],
	// ...
]
//⌟

if (TEST_RUN) {
	console.log(
		debrief({
			foo: 'foogleberry',
			alphabet: 'lorem ipsum dolor sit amet',
		}),
	)
	Deno.exit(0)
}

//· Main ·············································································¬

const openai = new OpenAI({
	apiKey: Deno.env.get('OPENAI_API_KEY'),
})

const responses: Completion[] = []

const runner = new Runner<Completion>(MAX_PARALLEL_REQUESTS, {
	verbose: true,
	tolerance: Infinity,
	onTaskComplete: () => {
		// ...
	},
	onTaskFailed: () => {
		// ...
	},
})

runner.on('taskCompleted', ({ result }) => {
	responses.push(result)
})

runner.on('taskFailed', ({ error }) => {
	console.error(error)
})

const { results, error } = await batchGPT(messages)
console.log('results', debrief(results))
console.log('error', error)

Deno.exit(0)

//⌟

//· Defs ·············································································¬

async function batchGPT(messages: Message[][]) {
	if (DRY_RUN) console.log('%cdry run', 'color: orange')

	if (!messages.length && Array.isArray(args['messages'])) {
		messages.push(...(args.messages as Message[][]))
	}

	if (!messages.length) {
		console.log('%cusing example messages', 'color: orange')
		messages.push(...exampleMessages('What is the best animal?', 'What is the best food?'))
	}

	for (const msgs of messages) {
		runner.add(
			async () =>
				await callGPT4({
					messages: msgs,
					...SETTINGS,
				}),
			msgs.at(-1)?.content ?? 'prompt',
		)
	}

	return await runner.runAll()
}

async function callGPT4(prompt: Prompt) {
	let completion: Completion

	if (DRY_RUN) {
		completion = await dryRun()
	} else {
		completion = await openai.chat.completions.create({
			model: prompt.model,
			messages: prompt.messages,
			temperature: prompt.temperature,
			max_tokens: prompt.max_tokens,
			n: prompt.n,
		})
	}

	return completion
}
//⌟

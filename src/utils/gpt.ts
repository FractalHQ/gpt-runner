import type { Completion, Message } from '../types.ts'

export function exampleMessages(prompt: string, ...args: string[]): Message[][] {
	return [prompt, ...args].map((p) => [
		{
			role: 'system',
			content: 'You are based. You must respond with only emojis.',
		},
		{
			role: 'user',
			content: 'Hey, what is the best flavor of ice cream?',
		},
		{
			role: 'assistant',
			content: '🍨',
		},
		{
			role: 'user',
			content: p,
		},
	])
}

export async function dryRun() {
	await new Promise((resolve) => setTimeout(resolve, 2000 * Math.random()))
	return {
		id: 'chatcmpl-7syBU1ST4VvxTnhRJDQct8gUbOPDb',
		object: 'chat.completion',
		created: 1693335416,
		model: 'gpt-4-0613',
		choices: [
			{
				index: 0,
				message: {
					role: 'assistant',
					content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut eget lectus vitae est mattis pretium.`,
				},
				finish_reason: 'stop',
			},
		],
		usage: {
			prompt_tokens: 118,
			completion_tokens: 105,
			total_tokens: 223,
		},
	} satisfies Completion
}

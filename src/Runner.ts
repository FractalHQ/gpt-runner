import { b, bd, dim, g, l, r, y } from './utils/color.ts'

let log = l

type Task<T> = (index: number, label?: string) => Promise<T>

const EVENTS = ['taskCompleted', 'taskFailed'] as const
type EventName = (typeof EVENTS)[number]

type EventHandler<T, K extends EventName> = K extends 'taskCompleted'
	? (e: TaskResult<T>) => unknown
	: K extends 'taskFailed'
	? (e: TaskError) => unknown
	: never

type TaskEvent<T> = TaskResult<T> | TaskError

interface TaskResult<T> {
	result: T
	error: null
	meta: {
		index: number
		duration: number
		label?: string
	}
}

interface TaskError {
	result: null
	error: Error
	meta: {
		index: number
		duration: number
		label?: string
	}
}

interface RunnerOptions<T = unknown> {
	/**
	 * Enables verbose logging. _default_ `false`
	 * @defaultValue false
	 */
	verbose: boolean
	/**
	 * Max number of failed tasks before the runner will throw
	 * an error and stop. _default_ `0`. Can be set to `Infinity`
	 * to disable this behavior.
	 * @defaultValue 0
	 */
	tolerance: number

	onTaskComplete?: (task: TaskResult<T>) => unknown
	onTaskFailed?: (task: TaskError) => unknown
}

export const DEFAULT_RUNNER_OPTIONS: RunnerOptions = {
	verbose: true,
	tolerance: 0,
}

/**
 * Parallel async task queue runner. Give it an array of promises, and
 * tell it how many to tasks to run at once.
 *
 * @example
 * // Create a runner
 * const runner = new Runner(5)
 *
 * // Add promises to the queue.
 * runner.add(new Promise((resolve) => setTimeout(() => resolve('foo'), 1000)))
 *
 * // Run all tasks.
 * runner.runAll()
 *
 * // Grab results as the come in.
 * runner.on('taskCompleted', (e) => {
 * 	console.log(`Task ${e.label ?? e.index} completed: ${e.value}`)
 * })
 *
 * // And handle failures.
 * runner.on('taskFailed', (e) => console.error)
 *
 * // Or collect them all at the end.
 * const results = await runner.runAll()
 */
export class Runner<
	/**
	 * The type of the value returned by the tasks.
	 * @default unknown
	 */
	T = unknown,
> {
	/** The tasks that have yet to be run. */
	queue: { cb: Task<T>; label?: string }[] = []

	/** Whether all tasks have completed. */
	get complete() {
		return this.queue.length === 0 && this.#numActive === 0
	}

	#numActive = 0
	#numComplete = 0
	#verbose: boolean
	#tolerance: number
	/** Toggled when the tolerance limit is breached. */
	#abort = false

	/** The event listeners. */
	#listeners = {
		taskCompleted: [] as EventHandler<T, 'taskCompleted'>[],
		taskFailed: [] as EventHandler<T, 'taskFailed'>[],
	}
	completeTasks: TaskResult<T>[] = []
	/** The used to log info about the tasks that failed in verbose mode. */
	#failedTasks: TaskError[] = []

	constructor(
		/**
		 * The maximum number of tasks to run concurrently.
		 * @defaultValue 5
		 */
		public readonly concurrentLimit = 5,
		options?: RunnerOptions<T>,
	) {
		const opts = Object.assign(DEFAULT_RUNNER_OPTIONS, options)

		this.#verbose = opts.verbose
		log = this.#verbose ? log : () => void 0

		this.#tolerance = opts.tolerance

		if (opts.onTaskComplete) {
			this.on('taskCompleted', opts.onTaskComplete)
		}

		if (opts.onTaskFailed) {
			this.on('taskFailed', opts.onTaskFailed)
		}
	}

	/**
	 * Adds a task to the queue.
	 * @param cb The task to add.
	 * @param label A label for the task _(used for logging in verbose mode)_.
	 */
	add(cb: Task<T>, label?: string) {
		this.queue.push({ cb, label })
	}

	/**
	 * Adds multiple tasks to the queue.
	 * @param cbs The tasks to add.
	 * @param labels The labels for the tasks _(used for logging in verbose mode)_.
	 */
	addMany(cbs: Task<T>[], labels?: string[]) {
		for (let i = 0; i < cbs.length; i++) {
			this.add(cbs[i], labels?.[i])
		}
	}

	/**
	 * Stores the total number of tasks in a batch run _(used for logging in verbose mode)_.
	 */
	#numTotal = 0
	/**
	 * Runs all tasks in the queue.
	 * @returns A promise that resolves when all tasks have completed.
	 */
	runAll() {
		this.#numTotal = this.queue.length

		return new Promise<{
			results: TaskResult<T>[]
			error: Error | null
		}>((resolve, reject) => {
			this.#logInitial()

			const runTask = async () => {
				if (this.#abort) return
				const taskObj = this.queue.shift()
				if (!taskObj) return

				this.#numActive++

				if (this.#verbose) {
					l(dim(this.#numActive + this.#numComplete + '/' + this.#numTotal))
				}

				const { cb, label } = taskObj
				const index = this.#numActive + this.#numComplete
				const begin = performance.now()

				try {
					const result = await cb(index, label)

					const taskResult = {
						result,
						error: null,
						meta: {
							index,
							label,
							duration: performance.now() - begin,
						},
					} satisfies TaskResult<T>

					this.#logComplete(taskResult)
					this.completeTasks.push(taskResult)
					this.#emit('taskCompleted', taskResult)
				} catch (e) {
					const taskError = {
						result: null,
						error: e,
						meta: {
							index,
							label,
							duration: performance.now() - begin,
						},
					} satisfies TaskError

					this.#logFailed(taskError)
					this.#failedTasks.push(taskError)

					this.#emit('taskFailed', taskError)

					// If the tolerance limit is breached, abort the run.
					if (this.#failedTasks.length > this.#tolerance) {
						this.#abort = true

						const message = `Runner tolerance exceeded. ${
							this.#failedTasks.length
						} tasks failed.`

						if (this.#verbose) l(r(message))

						log('\n')
						log('this.#tolerance', this.#tolerance)
						log('...this.#failedTasks', ...this.#failedTasks)

						reject({
							result: this.completeTasks,
							error: new Error(message),
						})
					}
				} finally {
					this.#numComplete++
					this.#numActive--

					if (this.complete || this.#abort) {
						this.#logCompletionStatus()

						resolve({
							results: this.completeTasks,
							error: null,
						})
					} else {
						runTask()
					}
				}
			}

			for (let i = 0; i < this.concurrentLimit; i++) {
				runTask().catch((e) => {
					if (this.#verbose) {
						l(r('Fatal Error in runAll()'))
						l(e)
					}

					reject({
						result: this.completeTasks,
						error: e,
					})
				})
			}
		})
	}

	/**
	 * There are two events emitted by the runner:
	 * - `taskCompleted` - Emits the task result when a task completes.
	 * - `taskFailed` - Emits the error when a task fails.
	 */
	on<K extends EventName>(event: K, listener: EventHandler<T, K>) {
		if (!this.#listeners[event]) {
			this.#listeners[event] = []
		}
		this.#listeners[event]?.push(listener as never)
	}

	#isCompletedEvent = (e: TaskEvent<T>): e is TaskResult<T> => {
		return !this.#isFailedEvent(e)
	}
	#isFailedEvent = (e: TaskEvent<T>): e is TaskError => {
		return e.result instanceof Error
	}

	#emit<K extends EventName>(event: K, e: TaskEvent<T>): void {
		if (this.#listeners[event]) {
			for (let i = 0; i < this.#listeners[event]!.length; i++) {
				if (this.#isCompletedEvent(e)) {
					this.#listeners['taskCompleted']?.[i]?.(e)
				} else if (this.#isFailedEvent(e)) {
					this.#listeners['taskFailed']?.[i]?.(e)
				}
			}
		}
	}

	#logInitial() {
		log(
			`\n🚦 Processing ${y(this.queue.length)} task${
				this.queue.length > 1 ? 's' : ''
			} with a maximum concurrency of ${g(this.concurrentLimit)}...\n`,
		)
	}

	#logComplete(taskResult: TaskResult<T>) {
		if (!this.#verbose) return

		const { meta } = taskResult
		const { index, label, duration } = meta
		const time = dim((duration / 1000).toFixed(1) + 's')

		log('\n')
		log(bd(g('√ ')) + dim(`#${index} `) + dim(time) + (label ? '  ' + b(label) : ''))
	}

	#logFailed(taskResult: TaskError) {
		if (!this.#verbose) return

		const { meta } = taskResult
		const { index, label, duration } = meta
		const time = dim((duration / 1000).toFixed(1) + 's')

		log(bd(r('X ' + label ?? `Task ${y(index)} failed - ${time}`)))
	}

	#logCompletionStatus() {
		if (!this.#verbose) return

		const completedColor = this.#failedTasks.length === 0 ? g : r
		log(
			'\nCompleted ' +
				completedColor(this.#numComplete - this.#failedTasks.length) +
				dim('/') +
				this.#numComplete,
		)

		if (this.#failedTasks.length > 0) {
			const failedTasksStr = this.#failedTasks
				.map(({ meta }) => y(meta.label || meta.index))
				.join(', ')
			log(`Failed tasks: ${failedTasksStr}`)
		}
	}

	static async testRun(runs = 100, seconds = 3, options?: RunnerOptions) {
		const runner = new Runner(5, options)
		for (let i = 0; i < runs; i++) {
			runner.add(() => randomPromise(i), `Task ${i}`)
		}

		runner.on('taskCompleted', ({ result, meta }) => {
			l(g('✅ ') + b(meta.label ?? meta.index) + dim(result))
		})

		runner.on('taskFailed', ({ meta, error }) => {
			console.error(`${meta.label ?? meta.index} failed: ${error}`)
		})

		l(dim('Test run...'))

		function randomPromise(i: number) {
			const dur = Math.random() * seconds * 1000

			return new Promise((resolve, reject) => {
				setTimeout(() => {
					if (Math.random() > 0.05) {
						resolve({
							foo: 'bar',
							baz: {
								qux: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut eget lectus vitae est mattis pretium.',
								qaz: Array(20).fill(+Math.random().toFixed(2)),
							},
						})
					} else {
						reject(new Error('Failed on task #' + i))
					}
				}, dur)
			})
		}

		return await runner.runAll().catch((e) => {
			console.error(e)
		})
	}
}

export async function silentConsole(handler: () => Promise<any>) {
  const temp = {}
  const fns = ['debug', 'log', 'info', 'warn', 'error', 'trace']
  for (const fnName of fns) {
    temp[fnName] = console[fnName]
    console[fnName] = () => {}
  }
  const tempStdout = process.stdout.write
  process.stdout.write = () => true
  const tempStderr = process.stderr.write
  process.stderr.write = () => true
  await handler()
  process.stdout.write = tempStdout
  process.stderr.write = tempStderr
  for (const fnName of fns) {
    console[fnName] = temp[fnName]
  }
}
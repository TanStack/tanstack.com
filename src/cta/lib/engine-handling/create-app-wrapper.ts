import { resolve } from 'node:path'
import { TMP_TARGET_DIR } from '../constants'
import type { Response } from 'express'

export async function createAppWrapper(
  projectOptions: any,
  opts: {
    dryRun?: boolean
    response?: Response
    environmentFactory?: () => any
  }
) {
  // Dynamically import CTA engine to prevent client bundling
  const {
    createApp,
    createDefaultEnvironment,
    finalizeAddOns,
    getFrameworkById,
    loadStarter,
  } = await import('@tanstack/cta-engine')
  const { cleanUpFileArray, cleanUpFiles } = await import('./file-helpers')
  const { getApplicationMode, getProjectPath } = await import(
    './server-environment'
  )
  const { createMemoryEnvironment } = await import('./memory-environment')

  const framework = getFrameworkById(projectOptions.framework)!
  if (!framework) {
    throw new Error(`Framework ${projectOptions.framework} not found`)
  }

  let starter: any | undefined
  const addOns: Array<string> = [...projectOptions.chosenAddOns]
  if (projectOptions.starter) {
    starter = await loadStarter(projectOptions.starter)
    if (starter)
      for (const addOn of starter.dependsOn ?? []) {
        addOns.push(addOn)
      }
  }
  const chosenAddOns = await finalizeAddOns(
    framework,
    projectOptions.mode,
    addOns
  )

  const projectPath = getProjectPath()
  const targetDir = opts.dryRun
    ? TMP_TARGET_DIR
    : getApplicationMode() === 'add'
    ? projectOptions.targetDir
    : resolve(projectPath, projectOptions.projectName)

  const options: Options = {
    ...projectOptions,
    targetDir,
    starter,
    framework,
    chosenAddOns,
  }

  function createEnvironment() {
    if (opts.dryRun) {
      return createMemoryEnvironment(targetDir)
    }
    return {
      environment: opts.environmentFactory?.() ?? createDefaultEnvironment(),
      output: { files: {}, deletedFiles: [], commands: [] },
    }
  }

  const { environment, output } = createEnvironment()

  if (opts.response) {
    opts.response.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
    })

    environment.startStep = ({ id, type, message }) => {
      opts.response!.write(
        JSON.stringify({
          msgType: 'start',
          id,
          type,
          message,
        }) + '\n'
      )
    }
    environment.finishStep = (id, message) => {
      opts.response!.write(
        JSON.stringify({
          msgType: 'finish',
          id,
          message,
        }) + '\n'
      )
    }

    await createApp(environment, options)
    opts.response.end()
  } else {
    await createApp(environment, options)

    output.files = cleanUpFiles(output.files, targetDir)
    output.deletedFiles = cleanUpFileArray(output.deletedFiles, targetDir)

    return output
  }
}
